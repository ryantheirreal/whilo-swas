'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { signChatGPTSession, verifyChatGPTSession, SESSION_TTL_SECONDS } = require('../web/whilo-swas/server/security/whilo-session');

process.env.WHILO_OPENAI_SESSION_SECRET = 'test-only-secret-with-at-least-32-bytes';

const user = { id: '90f810b3-9f8c-4113-97ae-120e4e18912f', email: 'chatgpt.user@example.com' };
const now = 1_800_000_000;
const session = signChatGPTSession(user, now);
assert.equal(session.expiresAt, now + SESSION_TTL_SECONDS);
assert.deepEqual(verifyChatGPTSession(session.token, now + 1), {
  id: user.id, email: user.email, provider: 'chatgpt'
});
assert.throws(() => verifyChatGPTSession(session.token, now + SESSION_TTL_SECONDS + 1), { statusCode: 401 });

const parts = session.token.split('.');
const tampered = parts[0] + '.' + Buffer.from(JSON.stringify({
  iss: 'whilo', aud: 'whilo-api', sub: user.id, email: user.email,
  provider: 'chatgpt', iat: now, exp: now + SESSION_TTL_SECONDS, jti: crypto.randomUUID()
})).toString('base64url') + '.' + parts[2];
assert.throws(() => verifyChatGPTSession(tampered, now + 1), { statusCode: 401 });
assert.throws(() => signChatGPTSession({ id: user.id, email: 'not-an-email' }, now));
process.env.WHILO_OPENAI_SESSION_SECRET = 'short';
assert.throws(() => signChatGPTSession(user, now), { statusCode: 503 });
console.log('Whilo signed-session tests passed.');
