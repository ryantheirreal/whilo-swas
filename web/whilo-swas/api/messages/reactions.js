'use strict';
const { send, authenticate, organizationFor, db, readJson, audit, safeError } = require('../_lib/platform');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED = new Set(['👍','❤️','😂','🎉','🔥','👀','✅','🙏','💡']);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    const orgId = member.organization_id;
    const body = await readJson(req, 4096);
    const conversationId = String(body.conversationId || '');
    const messageId = String(body.messageId || '');
    const emoji = String(body.emoji || '');
    if (!UUID_RE.test(conversationId) || !UUID_RE.test(messageId) || !ALLOWED.has(emoji)) {
      return send(res, 400, { error: 'A valid conversation, message and supported reaction are required' });
    }

    const membership = await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
      '&conversation_id=eq.' + encodeURIComponent(conversationId) +
      '&user_id=eq.' + encodeURIComponent(user.id) +
      '&member_status=eq.active&select=user_id&limit=1');
    if (!Array.isArray(membership) || !membership.length) return send(res, 403, { error: 'Join this conversation before reacting' });

    const message = await db('message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
      '&conversation_id=eq.' + encodeURIComponent(conversationId) +
      '&id=eq.' + encodeURIComponent(messageId) +
      '&deleted_at=is.null&select=id&limit=1');
    if (!Array.isArray(message) || !message.length) return send(res, 404, { error: 'Message was not found' });

    const prior = await db('message_reactions?organization_id=eq.' + encodeURIComponent(orgId) +
      '&conversation_id=eq.' + encodeURIComponent(conversationId) +
      '&message_id=eq.' + encodeURIComponent(messageId) +
      '&user_id=eq.' + encodeURIComponent(user.id) +
      '&emoji=eq.' + encodeURIComponent(emoji) +
      '&select=id&limit=1');
    if (Array.isArray(prior) && prior.length) {
      await db('message_reactions?id=eq.' + encodeURIComponent(prior[0].id) +
        '&organization_id=eq.' + encodeURIComponent(orgId), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await audit(orgId, user.id, 'messages.reaction_removed', 'message', messageId, 'success', { emoji });
      return send(res, 200, { ok: true, reacted: false, emoji, messageId });
    }

    await db('message_reactions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify({
        organization_id: orgId,
        conversation_id: conversationId,
        message_id: messageId,
        user_id: user.id,
        emoji
      })
    });
    await audit(orgId, user.id, 'messages.reaction_added', 'message', messageId, 'success', { emoji });
    return send(res, 200, { ok: true, reacted: true, emoji, messageId });
  } catch (error) {
    return safeError(res, error);
  }
};
