'use strict';
const { send, authenticate, organizationFor, db, readJson, audit, safeError } = require('../_lib/platform');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function conversation(orgId, conversationId) {
  const rows = await db('message_conversations?organization_id=eq.' + encodeURIComponent(orgId) +
    '&id=eq.' + encodeURIComponent(conversationId) +
    '&archived_at=is.null&select=id,conversation_type,title,created_by&limit=1');
  if (!Array.isArray(rows) || !rows[0]) {
    const error = new Error('Conversation not found');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
}

async function getMembership(orgId, conversationId, userId) {
  const rows = await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
    '&conversation_id=eq.' + encodeURIComponent(conversationId) +
    '&user_id=eq.' + encodeURIComponent(userId) +
    '&member_status=eq.active&select=member_role&limit=1');
  if (!Array.isArray(rows) || !rows[0]) {
    const error = new Error('You are not an active member of this conversation');
    error.statusCode = 403;
    throw error;
  }
  return rows[0];
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
      await getMembership(orgId, conversationId, user.id);
      const rows = await db('message_pins?organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&select=organization_id,conversation_id,message_id,pinned_by,pinned_at&order=pinned_at.desc&limit=100');
      const pins = Array.isArray(rows) ? rows : [];
      const ids = pins.map(pin => pin.message_id).filter(id => UUID_RE.test(id));
      if (!ids.length) return send(res, 200, { pins: [] });
      const messages = await db('message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&id=in.(' + ids.join(',') + ')&deleted_at=is.null&select=id,sender_user_id,sender_kind,content,created_at,pinned_at');
      const map = new Map((Array.isArray(messages) ? messages : []).map(message => [message.id, message]));
      return send(res, 200, {
        pins: pins.filter(pin => map.has(pin.message_id)).map(pin => Object.assign({}, pin, { message: map.get(pin.message_id) }))
      });
    }

    const body = await readJson(req, 8192);
    const conversationId = String(body.conversationId || '');
    const messageId = String(body.messageId || '');
    const action = String(body.action || 'pin');
    if (!UUID_RE.test(conversationId) || !UUID_RE.test(messageId) || !['pin','unpin'].includes(action)) {
      return send(res, 400, { error: 'Valid conversation, message and pin action are required' });
    }
    const room = await conversation(orgId, conversationId);
    const me = await getMembership(orgId, conversationId, user.id);
    const privileged = ['owner','admin','moderator'].includes(me.member_role);
    if (room.conversation_type !== 'direct' && !privileged) {
      return send(res, 403, { error: 'Only conversation moderators can pin messages in groups and channels' });
    }

    const targetRows = await db('message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
      '&conversation_id=eq.' + encodeURIComponent(conversationId) +
      '&id=eq.' + encodeURIComponent(messageId) + '&deleted_at=is.null&select=id,pinned_at&limit=1');
    if (!Array.isArray(targetRows) || !targetRows[0]) return send(res, 404, { error: 'Message not found in this conversation' });

    if (action === 'pin') {
      const now = new Date().toISOString();
      await db('message_pins?on_conflict=conversation_id,message_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          organization_id: orgId,
          conversation_id: conversationId,
          message_id: messageId,
          pinned_by: user.id,
          pinned_at: now
        })
      });
      await db('message_messages?id=eq.' + encodeURIComponent(messageId) +
        '&organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ pinned_at: now, updated_at: now })
        });
    } else {
      await db('message_pins?organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&message_id=eq.' + encodeURIComponent(messageId), {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' }
        });
      await db('message_messages?id=eq.' + encodeURIComponent(messageId) +
        '&organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ pinned_at: null, updated_at: new Date().toISOString() })
        });
    }
    await audit(orgId, user.id, 'messages.message_' + action + 'ned', 'message', messageId, 'success', { conversation_id: conversationId });
    return send(res, 200, { ok: true, action, messageId, pinnedAt: action === 'pin' ? new Date().toISOString() : null });
  } catch (error) {
    return safeError(res, error);
  }
};
