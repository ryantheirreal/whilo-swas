'use strict';
const {
  send, authenticate, organizationFor, db, readJson, audit, safeError
} = require('../_lib/platform');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE_RE = /^@?[a-z0-9][a-z0-9_-]{1,39}$/i;
const TYPES = new Set(['direct','group','supergroup','channel']);

function inFilter(values) {
  return 'in.(' + values.map(value => String(value)).join(',') + ')';
}

async function visibleConversation(req, orgId, userId, conversationId) {
  const memberships = await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
    '&conversation_id=eq.' + encodeURIComponent(conversationId) +
    '&user_id=eq.' + encodeURIComponent(userId) +
    '&member_status=eq.active&select=conversation_id,member_role,member_status,last_read_at,pinned,notifications_enabled&limit=1');
  if (!Array.isArray(memberships) || !memberships.length) {
    const error = new Error('You are not a member of this conversation');
    error.statusCode = 403;
    throw error;
  }
  return memberships[0];
}

async function conversationById(orgId, conversationId) {
  const rows = await db('message_conversations?organization_id=eq.' + encodeURIComponent(orgId) +
    '&id=eq.' + encodeURIComponent(conversationId) +
    '&select=id,conversation_type,title,description,is_public,created_by,slow_mode_seconds,created_at,last_message_at&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    const orgId = member.organization_id;

    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://whilo.invalid');
      const scope = url.searchParams.get('scope') || 'inbox';
      if (scope === 'discover') {
        const publicRows = await db('message_conversations?organization_id=eq.' + encodeURIComponent(orgId) +
          '&is_public=eq.true&conversation_type=eq.channel&archived_at=is.null' +
          '&select=id,conversation_type,title,description,is_public,created_by,created_at,last_message_at,slow_mode_seconds&order=last_message_at.desc.nullsfirst&limit=100');
        const channels = Array.isArray(publicRows) ? publicRows : [];
        if (!channels.length) return send(res, 200, { conversations: [], scope: 'discover' });
        const ids = channels.map(row => row.id).filter(id => UUID_RE.test(id));
        const allMembers = await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
          '&conversation_id=' + inFilter(ids) + '&member_status=eq.active&select=conversation_id,user_id,member_role');
        const memberRows = Array.isArray(allMembers) ? allMembers : [];
        const mine = new Set(memberRows.filter(row => row.user_id === user.id).map(row => row.conversation_id));
        const result = channels.map(row => ({
          ...row,
          member_count: memberRows.filter(m => m.conversation_id === row.id).length,
          is_member: mine.has(row.id)
        }));
        return send(res, 200, { conversations: result, scope: 'discover' });
      }

      const memberships = await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
        '&user_id=eq.' + encodeURIComponent(user.id) +
        '&member_status=eq.active&select=conversation_id,member_role,last_read_at,pinned,notifications_enabled&order=updated_at.desc&limit=200');
      const mine = Array.isArray(memberships) ? memberships : [];
      const ids = mine.map(row => row.conversation_id).filter(id => UUID_RE.test(id));
      if (!ids.length) return send(res, 200, { conversations: [], scope: 'inbox' });

      const [conversationRows, messageRows, memberRows] = await Promise.all([
        db('message_conversations?organization_id=eq.' + encodeURIComponent(orgId) +
          '&id=' + inFilter(ids) +
          '&archived_at=is.null&select=id,conversation_type,title,description,is_public,created_by,created_at,last_message_at,slow_mode_seconds&limit=200'),
        db('message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
          '&conversation_id=' + inFilter(ids) +
          '&deleted_at=is.null&select=id,conversation_id,sender_user_id,sender_kind,content,content_type,created_at,thread_root_id,reply_to_message_id&order=created_at.desc&limit=500'),
        db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
          '&conversation_id=' + inFilter(ids) +
          '&member_status=eq.active&select=conversation_id,user_id,member_role')
      ]);

      const conversations = Array.isArray(conversationRows) ? conversationRows : [];
      const messages = Array.isArray(messageRows) ? messageRows : [];
      const allMembers = Array.isArray(memberRows) ? memberRows : [];
      const senderIds = [...new Set([
        ...messages.map(message => message.sender_user_id).filter(Boolean),
        ...allMembers.map(row => row.user_id).filter(Boolean)
      ])];
      const profiles = senderIds.length
        ? await db('human_profiles?id=' + inFilter(senderIds) + '&select=id,username,display_name,avatar_url,presence,last_seen_at')
        : [];
      const profileMap = new Map((Array.isArray(profiles) ? profiles : []).map(profile => [profile.id, profile]));
      const membershipMap = new Map(mine.map(row => [row.conversation_id, row]));
      const lastMessageMap = new Map();
      for (const message of messages) {
        if (!lastMessageMap.has(message.conversation_id)) {
          lastMessageMap.set(message.conversation_id, Object.assign({}, message, { sender: profileMap.get(message.sender_user_id) || null }));
        }
      }
      const counts = new Map();
      for (const row of allMembers) counts.set(row.conversation_id, (counts.get(row.conversation_id) || 0) + 1);
      const result = conversations.map(conversation => {
        const mine = membershipMap.get(conversation.id) || null;
        const sharedMembers = allMembers.filter(row => row.conversation_id === conversation.id);
        const peer = conversation.conversation_type === 'direct'
          ? sharedMembers.find(row => row.user_id !== user.id)
          : null;
        const peerProfile = peer ? profileMap.get(peer.user_id) : null;
        return Object.assign({}, conversation, {
          title: conversation.conversation_type === 'direct' && peerProfile ? peerProfile.display_name : conversation.title,
          peer: peerProfile || null,
          my_membership: mine,
          member_count: counts.get(conversation.id) || 0,
          last_message: lastMessageMap.get(conversation.id) || null,
          unread: Boolean(lastMessageMap.get(conversation.id) &&
            lastMessageMap.get(conversation.id).sender_user_id !== user.id &&
            (!mine || !mine.last_read_at || Date.parse(lastMessageMap.get(conversation.id).created_at) > Date.parse(mine.last_read_at)))
        });
      }).sort((a,b) => {
        const ad = Date.parse(a.last_message_at || a.created_at || 0) || 0;
        const bd = Date.parse(b.last_message_at || b.created_at || 0) || 0;
        return bd - ad;
      });
      return send(res, 200, { conversations: result, scope: 'inbox' });
    }

    const body = await readJson(req, 16384);
    if (body.action === 'join') {
      const conversationId = String(body.conversationId || '');
      if (!UUID_RE.test(conversationId)) return send(res, 400, { error: 'Invalid channel ID' });
      const conversation = await conversationById(orgId, conversationId);
      if (!conversation || conversation.conversation_type !== 'channel' || !conversation.is_public) {
        return send(res, 404, { error: 'A joinable public channel was not found' });
      }
      await db('message_conversation_members?on_conflict=conversation_id,user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          organization_id: orgId,
          conversation_id: conversationId,
          user_id: user.id,
          member_role: 'subscriber',
          member_status: 'active',
          joined_at: new Date().toISOString()
        })
      });
      await audit(orgId, user.id, 'messages.channel_joined', 'message_conversation', conversationId, 'success', { type: 'channel' });
      return send(res, 200, { ok: true, conversationId, detail: 'Joined the public channel.' });
    }

    const type = String(body.type || '');
    if (!TYPES.has(type)) return send(res, 400, { error: 'Choose direct, group, supergroup or channel.' });
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const isPublic = type === 'channel' && body.isPublic === true;
    if (title.length > 100 || description.length > 1600) return send(res, 400, { error: 'Title or description is too long.' });
    if (type !== 'direct' && !title) return send(res, 400, { error: 'Enter a name for this conversation.' });
    const rawHandles = Array.isArray(body.participants) ? body.participants : [];
    if (rawHandles.length > (type === 'direct' ? 1 : 199)) return send(res, 400, { error: 'Too many participants for this creation request.' });
    const handles = [...new Set(rawHandles.map(value => String(value || '').trim().replace(/^@/,'').toLowerCase()).filter(Boolean))];
    if (handles.some(handle => !HANDLE_RE.test(handle))) return send(res, 400, { error: 'Use Whilo usernames such as @name; email addresses are not accepted here.' });

    if (type === 'direct' && handles.length !== 1) return send(res, 400, { error: 'A direct chat requires exactly one other Whilo username.' });
    if (type !== 'direct' && type !== 'channel' && handles.length < 1) return send(res, 400, { error: 'Add at least one participant to this conversation.' });

    let profiles = [];
    if (handles.length) {
      profiles = await db('human_profiles?username=' + inFilter(handles) +
        '&searchable=eq.true&select=id,username,display_name');
      if (!Array.isArray(profiles) || profiles.length !== handles.length) {
        return send(res, 400, { error: 'One or more usernames were not found or are not discoverable. Search for people in your workspace first.' });
      }
      if (profiles.some(profile => profile.id === user.id)) return send(res, 400, { error: 'You are already included as the conversation creator.' });
      const ids = profiles.map(profile => profile.id);
      const members = await db('organization_members?organization_id=eq.' + encodeURIComponent(orgId) +
        '&user_id=' + inFilter(ids) + '&select=user_id');
      if (!Array.isArray(members) || members.length !== ids.length) {
        return send(res, 400, { error: 'Every participant must belong to this Whilo workspace.' });
      }
    }

    if (type === 'direct' && !String(body.title || '').trim()) {
      // Direct conversation titles are set by the participant profile instead of user-provided text.
    }
    const result = await db('rpc/create_message_conversation', {
      method: 'POST',
      body: JSON.stringify({
        p_organization_id: orgId,
        p_creator_id: user.id,
        p_type: type,
        p_title: type === 'direct' ? profiles[0].display_name : title,
        p_description: description,
        p_member_ids: profiles.map(profile => profile.id),
        p_is_public: isPublic
      })
    });
    const conversationId = typeof result === 'string' ? result : (Array.isArray(result) ? result[0] : result);
    if (!conversationId || !UUID_RE.test(String(conversationId))) throw new Error('Conversation was not persisted.');
    await audit(orgId, user.id, 'messages.conversation_created', 'message_conversation', String(conversationId), 'success', {
      type, participant_count: handles.length + 1, is_public: isPublic
    });
    return send(res, 201, {
      ok: true,
      conversationId: String(conversationId),
      type,
      title: type === 'direct' ? profiles[0].display_name : title,
      detail: 'Conversation created and member access recorded.'
    });
  } catch (error) {
    return safeError(res, error);
  }
};
