'use strict';

const crypto = require('node:crypto');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_TTL_SECONDS = 4 * 60 * 60;

function sessionSecret() {
  const value = String(process.env.WHILO_OPENAI_SESSION_SECRET || '');
  if (Buffer.byteLength(value, 'utf8') < 32) {
    const error = new Error('The ChatGPT identity session secret is not configured.');
    error.statusCode = 503;
    throw error;
  }
  return value;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function signChatGPTSession(user, nowSeconds) {
  const now = Number.isInteger(nowSeconds) ? nowSeconds : Math.floor(Date.now() / 1000);
  const id = String(user && user.id || '');
  const email = String(user && user.email || '').trim().toLowerCase();
  if (!UUID_RE.test(id) || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('A verified Whilo user is required to create a session.');
  }
  const payload = {
    iss: 'whilo',
    aud: 'whilo-api',
    sub: id,
    email,
    provider: 'chatgpt',
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    jti: crypto.randomUUID()
  };
  const encoded = base64UrlJson(payload);
  const content = 'whilo1.' + encoded;
  const signature = crypto.createHmac('sha256', sessionSecret()).update(content).digest('base64url');
  return { token: content + '.' + signature, expiresAt: payload.exp, user: { id, email, provider: 'chatgpt' } };
}

function verifyChatGPTSession(token, nowSeconds) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'whilo1') {
    const error = new Error('Invalid Whilo session.');
    error.statusCode = 401;
    throw error;
  }
  const secret = sessionSecret();
  const content = parts[0] + '.' + parts[1];
  const expected = crypto.createHmac('sha256', secret).update(content).digest();
  let supplied;
  try { supplied = Buffer.from(parts[2], 'base64url'); } catch (_) { supplied = Buffer.alloc(0); }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    const error = new Error('Invalid Whilo session.');
    error.statusCode = 401;
    throw error;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (_) {
    const error = new Error('Invalid Whilo session.');
    error.statusCode = 401;
    throw error;
  }
  const now = Number.isInteger(nowSeconds) ? nowSeconds : Math.floor(Date.now() / 1000);
  if (!payload || payload.iss !== 'whilo' || payload.aud !== 'whilo-api' ||
      payload.provider !== 'chatgpt' || !UUID_RE.test(String(payload.sub || '')) ||
      !/^\S+@\S+\.\S+$/.test(String(payload.email || '')) ||
      !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) ||
      payload.iat > now + 60 || payload.exp <= now ||
      payload.exp - payload.iat > SESSION_TTL_SECONDS || !payload.jti) {
    const error = new Error('Whilo session is expired or invalid.');
    error.statusCode = 401;
    throw error;
  }
  return { id: payload.sub, email: String(payload.email).toLowerCase(), provider: 'chatgpt' };
}

module.exports = { signChatGPTSession, verifyChatGPTSession, SESSION_TTL_SECONDS };
