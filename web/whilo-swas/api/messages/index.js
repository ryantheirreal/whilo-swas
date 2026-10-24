'use strict';
const { send, authenticate, organizationFor, db, readJson, audit, safeError } = require('../_lib/platform');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REACTIONS = ['👍','❤️','😂','🎉','🔥','👀','✅','🙏','💡'];
const MESSAGE_ROUTES = Object.freeze({
  conversations: require('../../server/routes/messages/conversations'),
  reactions: require('../../server/routes/messages/reactions'),
  people: require('../../server/routes/messages/people'),
  invitations: require('../../server/routes/messages/invitations'),
  members: require('../../server/routes/messages/members'),
  pins: require('../../server/routes/messages/pins'),
  marketplace: require('../../server/routes/marketplace'),
  'marketplace-webhook': require('../../server/routes/marketplace').webhook,
  'account-bootstrap': require('../../server/routes/account-bootstrap'),
  affiliates: require('../../server/routes/affiliates'),
  routines: require('../../server/routes/routines'),
  credits: require('../../server/routes/credits'),
  'credits-webhook': require('../../server/routes/credits').webhook,
  'chatgpt-auth-start': require('../../server/routes/chatgpt-auth').start,
  'chatgpt-auth-callback': require('../../server/routes/chatgpt-auth').callback
});

function inFilter(values) { return 'in.(' + values.map(String).join(',') + ')'; }

async function membership(orgId, conversationId, userId) {
  const rows = await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
    '&conversation_id=eq.' + encodeURIComponent(conversationId) +
    '&user_id=eq.' + encodeURIComponent(userId) +
    '&member_status=eq.active&select=member_role,member_status&limit=1');
  if (!Array.isArray(rows) || !rows.length) {
    const error = new Error('You are not an active member of this conversation');
    error.statusCode = 403;
    throw error;
  }
  return rows[0];
}

async function loadConversation(orgId, conversationId) {
  const rows = await db('message_conversations?organization_id=eq.' + encodeURIComponent(orgId) +
    '&id=eq.' + encodeURIComponent(conversationId) +
    '&archived_at=is.null&select=id,conversation_type,title,description,is_public,created_by,slow_mode_seconds&limit=1');
  if (!Array.isArray(rows) || !rows.length) {
    const error = new Error('Conversation not found');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
}

async function loadHydrated(orgId, conversationId, messages) {
  const rows = Array.isArray(messages) ? messages : [];
  if (!rows.length) return [];
  const senderIds = [...new Set(rows.map(m => m.sender_user_id).filter(Boolean))];
  const ids = rows.map(m => m.id).filter(Boolean);
  const [profiles, reactions] = await Promise.all([
    senderIds.length ? db('human_profiles?id=' + inFilter(senderIds) + '&select=id,username,display_name,avatar_url,presence,last_seen_at') : [],
    ids.length ? db('message_reactions?organization_id=eq.' + encodeURIComponent(orgId) + '&message_id=' + inFilter(ids) + '&select=id,message_id,user_id,emoji,created_at') : []
  ]);
  const profileMap = new Map((Array.isArray(profiles) ? profiles : []).map(p => [p.id, p]));
  const reactionRows = Array.isArray(reactions) ? reactions : [];
  const grouped = new Map();
  for (const reaction of reactionRows) {
    const collection = grouped.get(reaction.message_id) || [];
    collection.push(reaction);
    grouped.set(reaction.message_id, collection);
  }
  const counts = new Map();
  const threadIds = rows.map(m => m.id).filter(Boolean);
  if (threadIds.length) {
    const replies = await db('message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
      '&conversation_id=eq.' + encodeURIComponent(conversationId) +
      '&thread_root_id=' + inFilter(threadIds) +
      '&deleted_at=is.null&select=id,thread_root_id');
    for (const reply of Array.isArray(replies) ? replies : []) counts.set(reply.thread_root_id, (counts.get(reply.thread_root_id) || 0) + 1);
  }
  return rows.map(message => Object.assign({}, message, {
    sender: profileMap.get(message.sender_user_id) || (message.sender_kind === 'system' ? { display_name: 'Whilo system', username: 'system' } : null),
    reactions: grouped.get(message.id) || [],
    thread_reply_count: counts.get(message.id) || 0
  }));
}

module.exports = async function handler(req, res) {
  const routedPath = new URL(req.url, 'https://whilo.invalid').searchParams.get('route') || '';
  if (routedPath) {
    const routedHandler = MESSAGE_ROUTES[routedPath];
    if (!routedHandler) return send(res, 404, { error: 'Unknown Messages route' });
    return routedHandler(req, res);
  }
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
      const conversationId = String(url.searchParams.get('conversationId') || '');
      const threadRootId = String(url.searchParams.get('threadRootId') || '');
      const before = String(url.searchParams.get('before') || '');
      const requestedLimit = Number(url.searchParams.get('limit') || 50);
      const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, Math.floor(requestedLimit))) : 50;
      if (!UUID_RE.test(conversationId)) return send(res, 400, { error: 'Valid conversationId is required' });
      await membership(orgId, conversationId, user.id);
      const conversation = await loadConversation(orgId, conversationId);
      if (threadRootId && !UUID_RE.test(threadRootId)) return send(res, 400, { error: 'Invalid thread root ID' });

      let messages = [];
      if (threadRootId) {
        const rootRows = await db('message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
          '&conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&id=eq.' + encodeURIComponent(threadRootId) +
          '&deleted_at=is.null&select=id,conversation_id,sender_user_id,sender_kind,sender_agent_id,content,content_type,reply_to_message_id,thread_root_id,edited_at,deleted_at,pinned_at,metadata,created_at,updated_at&limit=1');
        if (!Array.isArray(rootRows) || !rootRows.length) return send(res, 404, { error: 'Thread root was not found in this conversation' });
        const replyRows = await db('message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
          '&conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&thread_root_id=eq.' + encodeURIComponent(threadRootId) +
          '&deleted_at=is.null&select=id,conversation_id,sender_user_id,sender_kind,sender_agent_id,content,content_type,reply_to_message_id,thread_root_id,edited_at,deleted_at,pinned_at,metadata,created_at,updated_at&order=created_at.desc&limit=' + limit);
        messages = [...rootRows, ...(Array.isArray(replyRows) ? replyRows.reverse() : [])];
      } else {
        let query = 'message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
          '&conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&thread_root_id=is.null&deleted_at=is.null' +
          '&select=id,conversation_id,sender_user_id,sender_kind,sender_agent_id,content,content_type,reply_to_message_id,thread_root_id,edited_at,deleted_at,pinned_at,metadata,created_at,updated_at&order=created_at.desc&limit=' + limit;
        if (before) {
          const time = new Date(before);
          if (!Number.isFinite(time.getTime())) return send(res, 400, { error: 'Invalid before timestamp' });
          query += '&created_at=lt.' + encodeURIComponent(time.toISOString());
        }
        const rows = await db(query);
        messages = Array.isArray(rows) ? rows.reverse() : [];
      }
      const hydrated = await loadHydrated(orgId, conversationId, messages);
      return send(res, 200, {
        conversation,
        messages: hydrated,
        hasMore: messages.length === limit,
        currentUserId: user.id
      });
    }

    const body = await readJson(req, 24576);
    const conversationId = String(body.conversationId || '');
    if (!UUID_RE.test(conversationId)) return send(res, 400, { error: 'Valid conversationId is required' });
    const me = await membership(orgId, conversationId, user.id);
    const conversation = await loadConversation(orgId, conversationId);
    const action = String(body.action || 'send');

    if (action === 'mark_read') {
      const lastReadMessageId = body.lastReadMessageId ? String(body.lastReadMessageId) : null;
      if (lastReadMessageId) {
        if (!UUID_RE.test(lastReadMessageId)) return send(res, 400, { error: 'Invalid message ID' });
        const found = await db('message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
          '&conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&id=eq.' + encodeURIComponent(lastReadMessageId) + '&select=id&limit=1');
        if (!Array.isArray(found) || !found.length) return send(res, 400, { error: 'Read receipt must reference a message in this conversation' });
      }
      await db('message_conversation_members?organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&user_id=eq.' + encodeURIComponent(user.id), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ last_read_at: new Date().toISOString(), last_read_message_id: lastReadMessageId, updated_at: new Date().toISOString() })
        });
      return send(res, 200, { ok: true, lastReadMessageId });
    }

    if (action === 'edit' || action === 'delete') {
      const messageId = String(body.messageId || '');
      if (!UUID_RE.test(messageId)) return send(res, 400, { error: 'Valid messageId is required' });
      const targets = await db('message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&id=eq.' + encodeURIComponent(messageId) +
        '&select=id,sender_user_id,sender_kind,content,created_at&limit=1');
      const target = Array.isArray(targets) && targets[0] ? targets[0] : null;
      if (!target) return send(res, 404, { error: 'Message not found' });
      const canModerate = ['owner','admin','moderator'].includes(me.member_role);
      if (target.sender_user_id !== user.id && !canModerate) return send(res, 403, { error: 'You can only change your own messages unless you moderate this conversation' });
      if (action === 'edit') {
        const content = String(body.content || '').trim();
        if (!content || content.length > 12000) return send(res, 400, { error: 'Edited messages must contain 1–12000 characters' });
        await db('message_messages?id=eq.' + encodeURIComponent(messageId) +
          '&conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&organization_id=eq.' + encodeURIComponent(orgId), {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ content, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          });
        await audit(orgId, user.id, 'messages.message_edited', 'message', messageId, 'success', { conversation_id: conversationId });
        return send(res, 200, { ok: true, messageId, edited: true });
      }
      await db('message_messages?id=eq.' + encodeURIComponent(messageId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&organization_id=eq.' + encodeURIComponent(orgId), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ content: '', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        });
      await audit(orgId, user.id, 'messages.message_deleted', 'message', messageId, 'success', { conversation_id: conversationId });
      return send(res, 200, { ok: true, messageId, deleted: true });
    }

    if (conversation.conversation_type === 'channel' && !['owner','admin','moderator'].includes(me.member_role)) {
      return send(res, 403, { error: 'Only channel owners and moderators can publish. Subscribers can read and react.' });
    }
    const content = String(body.content || '').trim();
    if (!content || content.length > 12000) return send(res, 400, { error: 'Messages must contain 1–12000 characters' });
    const threadRootId = body.threadRootId ? String(body.threadRootId) : null;
    const replyToMessageId = body.replyToMessageId ? String(body.replyToMessageId) : null;
    if (threadRootId && !UUID_RE.test(threadRootId)) return send(res, 400, { error: 'Invalid thread root ID' });
    if (replyToMessageId && !UUID_RE.test(replyToMessageId)) return send(res, 400, { error: 'Invalid reply-to message ID' });
    for (const referenceId of [threadRootId, replyToMessageId].filter(Boolean)) {
      const target = await db('message_messages?organization_id=eq.' + encodeURIComponent(orgId) +
        '&conversation_id=eq.' + encodeURIComponent(conversationId) +
        '&id=eq.' + encodeURIComponent(referenceId) + '&deleted_at=is.null&select=id,thread_root_id&limit=1');
      if (!Array.isArray(target) || !target.length) return send(res, 400, { error: 'Reply and thread references must belong to this conversation' });
      if (referenceId === threadRootId && target[0].thread_root_id) return send(res, 400, { error: 'A thread root must be a top-level message' });
    }
    if (threadRootId && !replyToMessageId) body.replyToMessageId = threadRootId;

    const now = new Date().toISOString();
    const inserted = await db('message_messages', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        organization_id: orgId,
        conversation_id: conversationId,
        sender_user_id: user.id,
        sender_kind: 'human',
        content,
        content_type: 'text',
        reply_to_message_id: body.replyToMessageId || null,
        thread_root_id: threadRootId,
        metadata: {},
        created_at: now,
        updated_at: now
      })
    });
    const message = Array.isArray(inserted) && inserted[0] ? inserted[0] : null;
    if (!message) throw new Error('Message was not persisted');
    await db('rpc/touch_message_conversation', {
      method: 'POST',
      body: JSON.stringify({ p_conversation_id: conversationId, p_org_id: orgId, p_message_at: now })
    });
    await db('message_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        organization_id: orgId, conversation_id: conversationId, message_id: message.id,
        actor_user_id: user.id, event_type: 'message.sent',
        details: { content_length: content.length, has_thread: Boolean(threadRootId), has_reply: Boolean(replyToMessageId) }
      })
    });
    return send(res, 201, {
      ok: true,
      message: Object.assign({}, message, {
        sender: { id: user.id, username: user.user_metadata && user.user_metadata.username || '', display_name: user.user_metadata && user.user_metadata.full_name || user.email || 'You' },
        reactions: [], thread_reply_count: 0
      })
    });
  } catch (error) {
    return safeError(res, error);
  }
};

// Stripe signature verification requires exact raw request bytes; the other JSON routes use readJson().
module.exports.config = { api: { bodyParser: false } };
