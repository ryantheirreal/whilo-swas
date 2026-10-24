'use strict';

const crypto = require('node:crypto');
const { send, redirect, appUrl, db } = require('../../api/_lib/platform');
const { signChatGPTSession } = require('../security/whilo-session');

const OPENAI_ORIGIN = 'https://auth.openai.com';
const PROVIDER = 'openai_chatgpt';
const COOKIE_NAME = 'whilo_chatgpt_flow';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let discoveryCache = null;

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}
function b64url(value) { return Buffer.from(value).toString('base64url'); }
function randomValue(bytes) { return crypto.randomBytes(bytes || 32).toString('base64url'); }
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function htmlPage(res, status, title, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    title + ' · Whilo</title><body style="margin:0;background:#080808;color:#f7f7f7;font:16px/1.6 system-ui,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="max-width:560px;padding:32px"><p style="letter-spacing:.18em;text-transform:uppercase;color:#aaa;font-size:12px">WHILO · IDENTITY</p><h1 style="line-height:1.1;letter-spacing:-.04em">' +
    title + '</h1><p style="color:#bbb">' + message + '</p><a style="color:#fff" href="/">Return to Whilo</a></main></body></html>');
}

function cookieValue(req, name) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0 || part.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch (_) { return ''; }
  }
  return '';
}
function clearFlowCookie(res) {
  res.setHeader('Set-Cookie', COOKIE_NAME + '=; Path=/api/auth/chatgpt; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}
function publicCallbackUri() {
  const base = appUrl().replace(/\/+$/, '');
  const expected = base + '/api/auth/chatgpt/callback';
  const configured = String(process.env.OPENAI_SIWC_REDIRECT_URI || '').trim();
  if (configured !== expected) fail(503, 'ChatGPT sign-in requires its exact registered callback URL.');
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password || url.hash || url.search) {
    fail(503, 'ChatGPT sign-in callback configuration is invalid.');
  }
  return configured;
}
function config() {
  if (String(process.env.OPENAI_SIWC_ENABLED || '').toLowerCase() !== 'true') {
    fail(503, 'ChatGPT sign-in is not enabled for this deployment.');
  }
  const clientId = String(process.env.OPENAI_SIWC_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.OPENAI_SIWC_CLIENT_SECRET || '').trim();
  if (!/^oaiapp_[A-Za-z0-9_-]{8,160}$/.test(clientId) || clientSecret.length < 16) {
    fail(503, 'ChatGPT sign-in needs an approved OpenAI OAuth client and server-side secret.');
  }
  if (Buffer.byteLength(String(process.env.WHILO_OPENAI_SESSION_SECRET || ''), 'utf8') < 32) {
    fail(503, 'The private Whilo session signing secret is not configured.');
  }
  return { clientId, clientSecret, redirectUri: publicCallbackUri() };
}
async function discovery() {
  if (discoveryCache && discoveryCache.expiresAt > Date.now()) return discoveryCache.value;
  const response = await fetch(OPENAI_ORIGIN + '/.well-known/openid-configuration', { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) fail(502, 'The OpenAI identity service could not be reached.');
  const value = await response.json();
  const endpoints = [value.authorization_endpoint, value.token_endpoint, value.jwks_uri];
  if (value.issuer !== OPENAI_ORIGIN || endpoints.some(function (item) {
    try { const u = new URL(item); return u.protocol !== 'https:' || u.origin !== OPENAI_ORIGIN; } catch (_) { return true; }
  })) fail(502, 'The OpenAI identity service returned an unexpected configuration.');
  discoveryCache = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
  return value;
}
async function fetchJson(url, options, failureMessage) {
  let response;
  try { response = await fetch(url, options); } catch (_) { fail(502, failureMessage); }
  let value = {};
  try { value = await response.json(); } catch (_) {}
  if (!response.ok) fail(502, failureMessage);
  return value;
}
function decodeJwtPart(value) {
  try { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); }
  catch (_) { fail(401, 'The identity response could not be verified.'); }
}
async function verifyIdentityToken(idToken, clientId, nonce, oidc) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) fail(401, 'The identity response could not be verified.');
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string') fail(401, 'The identity response could not be verified.');
  const keyResponse = await fetchJson(oidc.jwks_uri, { headers: { Accept: 'application/json' }, cache: 'no-store' }, 'OpenAI signing keys could not be loaded.');
  const jwk = Array.isArray(keyResponse.keys) ? keyResponse.keys.find(function (key) { return key.kid === header.kid && key.kty === 'RSA' && (!key.use || key.use === 'sig'); }) : null;
  if (!jwk) fail(401, 'The identity response could not be verified.');
  let valid = false;
  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    valid = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), publicKey, Buffer.from(parts[2], 'base64url'));
  } catch (_) { valid = false; }
  const now = Math.floor(Date.now() / 1000);
  const audience = claims && claims.aud;
  const hasAudience = typeof audience === 'string' ? audience === clientId : Array.isArray(audience) && audience.includes(clientId);
  if (!valid || !claims || claims.iss !== oidc.issuer || !hasAudience ||
      (Array.isArray(audience) && audience.length > 1 && claims.azp !== clientId) ||
      claims.nonce !== nonce || !Number.isInteger(claims.exp) || claims.exp <= now ||
      !Number.isInteger(claims.iat) || claims.iat > now + 60 ||
      claims.email_verified !== true ||
      typeof claims.email !== 'string' || !/^\S+@\S+\.\S+$/.test(claims.email) ||
      typeof claims.sub !== 'string' || claims.sub.length < 1 || claims.sub.length > 255) {
    fail(401, 'The identity response could not be verified.');
  }
  return {
    subject: claims.sub,
    email: claims.email.trim().toLowerCase(),
    name: String(claims.name || claims.preferred_username || claims.email.split('@')[0]).replace(/\s+/g, ' ').trim().slice(0, 80)
  };
}
async function exchangeCode(code, transaction, settings, oidc) {
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: transaction.redirect_uri,
    client_id: settings.clientId,
    code_verifier: transaction.code_verifier
  });
  const basic = Buffer.from(encodeURIComponent(settings.clientId) + ':' + encodeURIComponent(settings.clientSecret)).toString('base64');
  return fetchJson(oidc.token_endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + basic },
    body: form.toString(),
    cache: 'no-store'
  }, 'ChatGPT sign-in could not exchange the authorization code.');
}
async function adminCreateAuthUser(identity) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) fail(503, 'Workspace identity provisioning is not configured.');
  const response = await fetch(base + '/auth/v1/admin/users', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: identity.email,
      email_confirm: true,
      password: randomValue(48),
      user_metadata: { full_name: identity.name || identity.email.split('@')[0] }
    }),
    cache: 'no-store'
  });
  let value = {};
  try { value = await response.json(); } catch (_) {}
  if (!response.ok || !value.id || !UUID_RE.test(value.id)) fail(503, 'Whilo could not provision an account for this verified identity.');
  return { id: value.id, email: identity.email };
}
async function resolveAuthUser(identity, clientId) {
  const identityQuery = 'whilo_external_identities?provider=eq.' + encodeURIComponent(PROVIDER) +
    '&client_id=eq.' + encodeURIComponent(clientId) + '&provider_subject=eq.' + encodeURIComponent(identity.subject) +
    '&select=auth_user_id,verified_email&limit=1';
  const alreadyLinked = await db(identityQuery);
  if (Array.isArray(alreadyLinked) && alreadyLinked[0]) {
    if (String(alreadyLinked[0].verified_email || '').toLowerCase() !== identity.email) {
      fail(409, 'This ChatGPT identity changed its verified email. Sign in with your existing Whilo account and contact support before relinking.');
    }
    const id = alreadyLinked[0].auth_user_id;
    const rows = await db('profiles?id=eq.' + encodeURIComponent(id) + '&select=id,email&limit=1');
    if (!Array.isArray(rows) || !rows[0]) fail(403, 'The linked Whilo account is no longer available.');
    return { id: rows[0].id, email: identity.email };
  }

  // Matching an already-verified email links the OAuth identity to an existing Whilo account;
  // otherwise provision a new Auth user and let the database bootstrap trigger create its workspace.
  let users = await db('profiles?email=eq.' + encodeURIComponent(identity.email) + '&select=id,email&limit=1');
  let user = Array.isArray(users) && users[0] ? { id: users[0].id, email: identity.email } : await adminCreateAuthUser(identity);
  if (!UUID_RE.test(String(user.id || ''))) fail(503, 'Whilo could not resolve the signed-in account.');

  try {
    await db('whilo_external_identities', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ provider: PROVIDER, client_id: clientId, provider_subject: identity.subject, auth_user_id: user.id, verified_email: identity.email })
    });
  } catch (error) {
    // A simultaneous callback for the same provider identity must use the canonical row.
    const linked = await db(identityQuery).catch(function () { return []; });
    if (!Array.isArray(linked) || !linked[0]) throw error;
    user = { id: linked[0].auth_user_id, email: identity.email };
  }
  return user;
}
function deliverAppSession(res, user) {
  const session = signChatGPTSession(user);
  const sessionJson = JSON.stringify({
    access_token: session.token,
    expires_at: session.expiresAt,
    auth_provider: 'chatgpt',
    user: session.user
  }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const cspNonce = randomValue(18);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'nonce-" + cspNonce + "'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Complete sign-in · Whilo</title><body style="background:#080808;color:#f7f7f7;font:16px system-ui;padding:36px"><p>Completing your secure Whilo sign-in…</p><script nonce="' + cspNonce + '">try{localStorage.setItem("sb-whilo-auth-token",JSON.stringify(' + sessionJson + '));window.location.replace("/")}catch(e){document.body.textContent="This browser could not save the sign-in session. Enable browser storage and return to Whilo."}</script></body></html>');
}
function genericCallbackError(res, status) {
  clearFlowCookie(res);
  const code = status >= 500 ? 503 : status === 401 ? 401 : 400;
  return htmlPage(res, code, 'Sign-in could not be completed', 'The identity response was not accepted. Return to Whilo and try again. No provider token was saved.');
}

async function start(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { error: 'Method not allowed' }); }
  let settings, oidc;
  try {
    settings = config();
    oidc = await discovery();
    const browserSecret = randomValue(32);
    const state = randomValue(32);
    const verifier = randomValue(48);
    const nonce = randomValue(32);
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db('whilo_auth_oauth_transactions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        provider: PROVIDER,
        state_hash: sha256(state),
        browser_session_hash: sha256(browserSecret),
        nonce,
        code_verifier: verifier,
        client_id: settings.clientId,
        redirect_uri: settings.redirectUri,
        expires_at: expiresAt
      })
    });
    res.setHeader('Set-Cookie', COOKIE_NAME + '=' + encodeURIComponent(browserSecret) + '; Path=/api/auth/chatgpt; HttpOnly; Secure; SameSite=Lax; Max-Age=600');
    const authorize = new URL(oidc.authorization_endpoint);
    authorize.searchParams.set('client_id', settings.clientId);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('redirect_uri', settings.redirectUri);
    authorize.searchParams.set('scope', 'openid profile email');
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('nonce', nonce);
    authorize.searchParams.set('code_challenge', challenge);
    authorize.searchParams.set('code_challenge_method', 'S256');
    authorize.searchParams.set('prompt', 'select_account');
    return redirect(res, authorize.toString());
  } catch (error) {
    return htmlPage(res, error.statusCode || 503, 'ChatGPT sign-in is not ready', 'This login method requires an approved OpenAI website OAuth client, exact callback registration and server-side secrets. Email and Google identity login remain separate.');
  }
}

async function callback(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { error: 'Method not allowed' }); }
  let settings;
  try { settings = config(); } catch (error) { return genericCallbackError(res, error.statusCode || 503); }
  const url = new URL(req.url, appUrl());
  const returnedState = String(url.searchParams.get('state') || '');
  const code = String(url.searchParams.get('code') || '');
  const oauthError = String(url.searchParams.get('error') || '');
  const browserSecret = cookieValue(req, COOKIE_NAME);
  clearFlowCookie(res);
  if (!returnedState || !browserSecret) return genericCallbackError(res, 401);
  try {
    const rows = await db('rpc/consume_whilo_siwc_transaction', {
      method: 'POST',
      body: JSON.stringify({ p_state_hash: sha256(returnedState), p_browser_session_hash: sha256(browserSecret) })
    });
    const transaction = Array.isArray(rows) ? rows[0] : rows;
    if (!transaction || transaction.provider !== PROVIDER || transaction.client_id !== settings.clientId ||
        transaction.redirect_uri !== settings.redirectUri) return genericCallbackError(res, 401);
    if (oauthError || !code) return genericCallbackError(res, 400);
    const oidc = await discovery();
    const tokens = await exchangeCode(code, transaction, settings, oidc);
    if (typeof tokens.id_token !== 'string') return genericCallbackError(res, 401);
    const identity = await verifyIdentityToken(tokens.id_token, settings.clientId, transaction.nonce, oidc);
    const user = await resolveAuthUser(identity, settings.clientId);
    const session = signChatGPTSession(user);
    return deliverAppSession(res, user);
  } catch (error) {
    return genericCallbackError(res, error && error.statusCode || 400);
  }
}

module.exports = { start, callback };
