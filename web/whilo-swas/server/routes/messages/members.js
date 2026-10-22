'use strict';
const { send, authenticate, organizationFor, db, readJson, audit, safeError } = require('../../../api/_lib/platform');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE_RE = /^@?[a-z0-9][a-z0-9_-]{1,39}$/i;
function inFilter(values) { return 'in.(' + values.map(String).join(',') + ')'; }

async function getConversation(orgId, id) {
  const rows = await db('message_conversations?organization_id=eq.' + encodeURIComponent(orgId) +
    '&id=eq.' + encodeURIComponent(id) + '&archived_at=is.null&select=id,conversation_type,title,created_by,is_public&limit=1');
  if (!Array.isArray(rows) || !rows[0]) {
    const error = new Error('Conversation was not found');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
}

async function activeMember(orgId, conversationId, userId) {
  const rows = await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
    '&conversation_id=eq.' + encodeURIComponent(conversationId) +
    '&user_id=eq.' + encodeURIComponent(userId) + '&member_status=eq.active&select=member_role,member_status&limit=1');
  if (!Array.isArray(rows) || !rows[0]) {
    const error = new Error('You are not an active member of this conversation');
    error.statusCode = 403;
    throw error;
  }
  return rows[0];
}

async function listMembers(orgId, conversationId, userId) {
  const rows = await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
    '&conversation_id=eq.' + encodeURIComponent(conversationId) +
    '&member_status=eq.active&select=user_id,member_role,member_status,joined_at,last_read_at,pinned,notifications_enabled&order=created_at.asc&limit=500');
  const members = Array.isArray(rows) ? rows : [];
  const ids = [...new Set(members.map(row => row.user_id).filter(Boolean))];
  const profiles = ids.length
    ? await db('human_profiles?id=' + inFilter(ids) + '&select=id,username,display_name,avatar_url,presence,last_seen_at')
    : [];
  const profileMap = new Map((Array.isArray(profiles) ? profiles : []).map(profile => [profile.id, profile]));
  return members.map(row => ({
    user_id: row.user_id,
    member_role: row.member_role,
    joined_at: row.joined_at,
    last_read_at: row.last_read_at,
    pinned: row.pinned,
    notifications_enabled: row.notifications_enabled,
    is_self: row.user_id === userId,
    profile: profileMap.get(row.user_id) || null
  }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const user = await authenticate(req);
    const workspace = await organizationFor(user);
    const orgId = workspace.organization_id;

    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://whilo.invalid');
      const conversationId = String(url.searchParams.get('conversationId') || '');
      if (!UUID_RE.test(conversationId)) return send(res, 400, { error: 'Valid conversationId is required' });
      await activeMember(orgId, conversationId, user.id);
      const conversation = await getConversation(orgId, conversationId);
      return send(res, 200, {
        conversationId,
        conversationType: conversation.conversation_type,
        members: await listMembers(orgId, conversationId, user.id)
      });
    }

    const body = await readJson(req, 16384);
    const conversationId = String(body.conversationId || '');
    if (!UUID_RE.test(conversationId)) return send(res, 400, { error: 'Valid conversationId is required' });
    const actor = await activeMember(orgId, conversationId, user.id);
    const conversation = await getConversation(orgId, conversationId);
    const action = String(body.action || '');

    if (action === 'leave') {
      if (actor.member_role === 'owner') return send(res, 409, { error: 'Transfer ownership before leaving this conversation.' });
      await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&user_id=eq.' + encodeURIComponent(user.id), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ member_status: 'left', updated_at: new Date().toISOString() })
        });
      await audit(orgId, user.id, 'messages.member_left', 'message_conversation', conversationId, 'success', {});
      return send(res, 200, { ok: true, detail: 'You left the conversation.' });
    }

    if (action === 'add') {
      if (!['owner','admin','moderator'].includes(actor.member_role)) return send(res, 403, { error: 'Only conversation admins can add members' });
      const rawHandles = Array.isArray(body.participants) ? body.participants : [];
      if (!rawHandles.length || rawHandles.length > 100) return send(res, 400, { error: 'Add between 1 and 100 usernames at a time' });
      const handles = [...new Set(rawHandles.map(value => String(value || '').trim().replace(/^@/,'').toLowerCase()).filter(Boolean))];
      if (!handles.length || handles.some(handle => !HANDLE_RE.test(handle))) return send(res, 400, { error: 'Use valid Whilo usernames such as @alex' });
      const profiles = await db('human_profiles?username=' + inFilter(handles) + '&searchable=eq.true&select=id,username,display_name');
      if (!Array.isArray(profiles) || profiles.length !== handles.length) return send(res, 400, { error: 'One or more usernames were not found or are not discoverable' });
      const ids = profiles.map(profile => profile.id);
      if (ids.includes(user.id)) return send(res, 400, { error: 'You are already a member of this conversation' });
      const workspaceMembers = await db('organization_members?organization_id=eq.' + encodeURIComponent(orgId) +
        '&user_id=' + inFilter(ids) + '&select=user_id');
      if (!Array.isArray(workspaceMembers) || workspaceMembers.length !== ids.length) return send(res, 400, { error: 'All people must first belong to this Whilo workspace' });
      const existingRows = await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&user_id=' + inFilter(ids) + '&select=user_id,member_role,member_status');
      const existingMap = new Map((Array.isArray(existingRows) ? existingRows : []).map(row => [row.user_id, row]));
      const now = new Date().toISOString();
      let addedCount = 0;
      for (const id of ids) {
        const existing = existingMap.get(id);
        if (existing && existing.member_status === 'active') continue; // Do not silently demote an existing admin.
        if (existing && existing.member_status === 'banned' && actor.member_role === 'moderator') {
          return send(res, 403, { error: 'Only an owner or admin can restore a banned member.' });
        }
        const values = {
          organization_id: orgId,
          conversation_id: conversationId,
          user_id: id,
          member_role: conversation.conversation_type === 'channel' ? 'subscriber' : 'member',
          member_status: 'active',
          joined_at: now,
          updated_at: now
        };
        if (existing) {
          await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
            '&conversation_id=eq.' + encodeURIComponent(conversationId) +
            '&user_id=eq.' + encodeURIComponent(id), {
              method: 'PATCH',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify(values)
            });
        } else {
          await db('message_conversation_members', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(values)
          });
        }
        addedCount += 1;
      }
      await audit(orgId, user.id, 'messages.members_added', 'message_conversation', conversationId, 'success', { member_count: addedCount });
      await db('message_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          organization_id: orgId, conversation_id: conversationId, actor_user_id: user.id,
          event_type: 'members.added', details: { member_count: addedCount }
        })
      });
      return send(res, 200, { ok: true, addedCount, members: await listMembers(orgId, conversationId, user.id) });
    }

    if (action === 'remove' || action === 'promote' || action === 'demote') {
      if (!['owner','admin'].includes(actor.member_role)) return send(res, 403, { error: 'Only owners and admins can manage member roles' });
      const targetId = String(body.userId || '');
      if (!UUID_RE.test(targetId) || targetId === user.id) return send(res, 400, { error: 'Choose another valid member; use Leave to remove yourself' });
      const targetRows = await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&user_id=eq.' + encodeURIComponent(targetId) + '&member_status=eq.active&select=user_id,member_role&limit=1');
      if (!Array.isArray(targetRows) || !targetRows.length) return send(res, 404, { error: 'Active member was not found' });
      const target = targetRows[0];
      if (target.member_role === 'owner') return send(res, 409, { error: 'Conversation ownership cannot be removed from this panel' });

      let patch;
      if (action === 'remove') patch = { member_status: 'banned', updated_at: new Date().toISOString() };
      else if (action === 'promote') {
        const role = String(body.role || '');
        if (!['admin','moderator'].includes(role)) return send(res, 400, { error: 'Promote to admin or moderator only' });
        if (role === 'admin' && actor.member_role !== 'owner') return send(res, 403, { error: 'Only the owner can grant admin status' });
        if (conversation.conversation_type === 'channel' && role === 'admin') patch = { member_role: 'admin', updated_at: new Date().toISOString() };
        else patch = { member_role: role, updated_at: new Date().toISOString() };
      } else {
        patch = { member_role: conversation.conversation_type === 'channel' ? 'subscriber' : 'member', updated_at: new Date().toISOString() };
      }

      await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&user_id=eq.' + encodeURIComponent(targetId), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(patch)
        });
      await audit(orgId, user.id, 'messages.member_' + action, 'message_conversation', conversationId, 'success', {
        target_user_id: targetId, role: patch.member_role || null
      });
      return send(res, 200, { ok: true, action, userId: targetId, role: patch.member_role || null });
    }

    return send(res, 400, { error: 'Unsupported member management action' });
  } catch (error) {
    return safeError(res, error);
  }
};
