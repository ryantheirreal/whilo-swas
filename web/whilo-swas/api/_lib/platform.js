'use strict';

const crypto = require('node:crypto');
const { verifyChatGPTSession } = require('../../server/security/whilo-session');

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(body));
}

function redirect(res, url) {
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end();
}

function appUrl() {
  const value = process.env.WHILO_PUBLIC_URL;
  if (!value) throw new Error('WHILO_PUBLIC_URL is not configured');
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error('WHILO_PUBLIC_URL must use HTTPS');
  }
  return parsed.origin;
}

function requiredEnv(...keys) {
  const missing = keys.filter(key => !process.env[key] || !process.env[key].trim());
  if (missing.length) {
    const error = new Error('Server integration is not configured');
    error.missingEnv = missing;
    throw error;
  }
}

function supabaseUrl() {
  requiredEnv('SUPABASE_URL');
  return process.env.SUPABASE_URL.replace(/\/+$/, '');
}

function serviceKey() {
  requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function anonKey() {
  requiredEnv('SUPABASE_ANON_KEY');
  return process.env.SUPABASE_ANON_KEY;
}

function bearer(req) {
  const value = String(req.headers.authorization || '');
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function authenticate(req) {
  const token = bearer(req);
  if (!token) {
    const error = new Error('Sign in to Whilo before continuing');
    error.statusCode = 401;
    throw error;
  }
  // ChatGPT is an identity-only login here. This short-lived app token is HMAC-verified;
  // no OpenAI provider access/refresh token is accepted by this session path.
  if (token.startsWith('whilo1.')) return verifyChatGPTSession(token);
  const url = supabaseUrl();
  const response = await fetch(url + '/auth/v1/user', {
    headers: { apikey: anonKey(), Authorization: 'Bearer ' + token }
  });
  if (!response.ok) {
    const error = new Error('Your Whilo session is missing or expired');
    error.statusCode = 401;
    throw error;
  }
  const user = await response.json();
  if (!user || !user.id || !user.email) {
    const error = new Error('Authenticated user identity is unavailable');
    error.statusCode = 401;
    throw error;
  }
  return user;
}

async function db(path, options = {}) {
  const url = supabaseUrl();
  const key = serviceKey();
  const headers = Object.assign({
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json'
  }, options.headers || {});
  const response = await fetch(url + '/rest/v1/' + path.replace(/^\/+/, ''), Object.assign({}, options, { headers }));
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch (_) { data = { message: 'Database returned a non-JSON response' }; }
  }
  if (!response.ok) {
    const error = new Error('Database request failed');
    error.statusCode = response.status >= 500 ? 503 : 400;
    error.dbStatus = response.status;
    error.dbMessage = data && data.message ? String(data.message).slice(0, 400) : '';
    throw error;
  }
  return data;
}

async function organizationFor(user) {
  const rows = await db('organization_members?user_id=eq.' + encodeURIComponent(user.id) +
    '&select=organization_id,role&order=created_at.asc&limit=1');
  if (!Array.isArray(rows) || !rows.length) {
    const error = new Error('This account does not belong to a Whilo workspace yet');
    error.statusCode = 403;
    throw error;
  }
  return rows[0];
}

async function readJson(req, maxBytes = 16384) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
      const error = new Error('Request body is too large');
      error.statusCode = 413;
      throw error;
    }
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) {
    const error = new Error('Invalid JSON request body');
    error.statusCode = 400;
    throw error;
  }
}

function encryptPayload(value) {
  requiredEnv('WHILO_CONNECTOR_ENCRYPTION_KEY');
  const key = Buffer.from(process.env.WHILO_CONNECTOR_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) throw new Error('WHILO_CONNECTOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    encrypted_payload: encrypted.toString('base64'),
    encryption_iv: iv.toString('base64'),
    encryption_tag: cipher.getAuthTag().toString('base64')
  };
}

function decryptPayload(row) {
  requiredEnv('WHILO_CONNECTOR_ENCRYPTION_KEY');
  const key = Buffer.from(process.env.WHILO_CONNECTOR_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) throw new Error('WHILO_CONNECTOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(row.encryption_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.encryption_tag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_payload, 'base64')),
    decipher.final()
  ]);
  return JSON.parse(plain.toString('utf8'));
}

function hmacHex(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeError(res, error) {
  const status = Number.isInteger(error.statusCode) ? error.statusCode : (error.missingEnv ? 503 : 500);
  const message = status >= 500
    ? (error.missingEnv ? 'Server integration is not configured. Ask the workspace owner to finish setup.' : 'The request could not be completed safely.')
    : error.message;
  if (status >= 500) console.error('[whilo-api]', error.message, error.dbStatus || '', error.missingEnv || '');
  return send(res, status, { error: message, code: error.missingEnv ? 'configuration_required' : 'request_failed' });
}

async function audit(organizationId, actorId, action, resourceType, resourceId, outcome = 'success', detail = {}) {
  return db('audit_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      organization_id: organizationId, actor_id: actorId, action,
      resource_type: resourceType, resource_id: resourceId || null, outcome, detail
    })
  });
}

module.exports = {
  send, redirect, appUrl, requiredEnv, authenticate, organizationFor, db, readJson,
  encryptPayload, decryptPayload, hmacHex, sha256Hex, safeError, audit, supabaseUrl
};
