#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];
let checked = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function checkJs(file) {
  const original = fs.readFileSync(file, 'utf8');
  const source = original.replace(/^#![^\n]*\n/, '');
  try {
    new vm.Script(source, { filename: path.relative(root, file) });
    checked += 1;
  } catch (error) {
    failures.push(path.relative(root, file) + ': ' + error.message);
  }
}

const apiRoot = path.join(root, 'web', 'whilo-swas', 'api');
const apiFiles = walk(apiRoot).filter(file => file.endsWith('.js'));
const apiEntrypoints = apiFiles.filter(file => !path.relative(apiRoot, file).split(path.sep)[0].startsWith('_'));
if (apiEntrypoints.length > 12) failures.push('Vercel Hobby supports at most 12 API function entrypoints; currently found ' + apiEntrypoints.length + '. Consolidate routes before deploying.');

const jsFiles = [
  ...apiFiles,
  ...walk(path.join(root, 'web', 'whilo-swas', 'server', 'routes')).filter(file => file.endsWith('.js')),
  ...walk(path.join(root, 'scripts')).filter(file => (file.endsWith('.mjs') || file.endsWith('.js')) && !file.endsWith('check-platform.mjs')),
  path.join(root, 'web', 'whilo-swas', 'whilo-enterprise.js'),
  path.join(root, 'web', 'whilo-swas', 'whilo-marketplace.js'),
  path.join(root, 'web', 'whilo-swas', 'whilo-cloud-auth.js'),
  path.join(root, 'shared', 'whilo-agent-core', 'index.cjs'),
  path.join(root, 'shared', 'whilo-agent-core', 'index.js'),
  path.join(root, 'shared', 'whilo-agent-core', 'index.test.cjs')
].filter(file => fs.existsSync(file));

for (const file of new Set(jsFiles)) checkJs(file);

const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrations = walk(migrationsDir).filter(file => file.endsWith('.sql')).sort();
if (migrations.length < 10) {
  failures.push('Expected all ten versioned Supabase migrations to be present.');
}
const allSql = migrations.map(file => fs.readFileSync(file, 'utf8')).join('\n');
for (const [label, pattern] of [
  ['tenant isolation', /create table if not exists public\.organization_members/i],
  ['RLS enablement', /alter table public\.missions enable row level security/i],
  ['encrypted connector storage', /encrypted_payload text not null/i],
  ['OAuth one-time state consumption', /function public\.consume_oauth_state/i],
  ['durable mission queue', /create table if not exists public\.mission_jobs/i],
  ['approval-gated enqueue', /function public\.decide_mission_bundle/i],
  ['QR bridge identity', /function public\.claim_bridge_pair_session/i],
  ['owner provisioning without password column', /function public\.ensure_owner_workspace/i],
  ['human messaging entities', /create table if not exists public\.message_conversations/i],
  ['message membership roles', /create table if not exists public\.message_conversation_members/i],
  ['single-use workspace invitations', /function public\.accept_workspace_invitation/i],
  ['pinned message storage', /create table if not exists public\.message_pins/i],
  ['marketplace listings and creator moderation', /create table if not exists public\.marketplace_listings/i],
  ['20 percent marketplace commission snapshot', /platform_fee_bps integer not null default 2000/i],
  ['idempotent Stripe webhook events', /create table if not exists public\.marketplace_webhook_events/i],
  ['subscription entitlement ledger', /create table if not exists public\.marketplace_entitlements/i],
  ['workspace asset installation ledger', /create table if not exists public\.marketplace_installations/i],
  ['transactional marketplace install RPC', /function public\.install_marketplace_asset/i]
]) {
  if (!pattern.test(allSql)) failures.push('Missing database invariant: ' + label);
}

const bootstrap = fs.readFileSync(path.join(root, 'scripts', 'bootstrap-owner.mjs'), 'utf8');
if (!bootstrap.includes('WHILO_OWNER_INITIAL_PASSWORD')) failures.push('Owner bootstrap must read a temporary password from the environment.');
if (!bootstrap.includes('password.length < 14')) failures.push('Owner bootstrap must reject weak passwords.');
if (bootstrap.includes('1223344q')) failures.push('A weak chat-shared password must never be committed to source.');
if (/console\.(?:log|error)\(\s*password\b/i.test(bootstrap) || /console\.(?:log|error)\(\s*JSON\.stringify\(\s*\{[^}]*\bpassword\s*:/is.test(bootstrap)) failures.push('Owner bootstrap must not log passwords.');
const cloudAuth = fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'whilo-cloud-auth.js'), 'utf8');
const enterpriseUi = fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'whilo-enterprise.js'), 'utf8');
const accountBootstrap = fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'server', 'routes', 'account-bootstrap.js'), 'utf8');
const routeMap = fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'api', 'messages', 'index.js'), 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'vercel.json'), 'utf8'));
if (!cloudAuth.includes('resetPasswordForEmail') || !cloudAuth.includes('updatePassword')) failures.push('Cloud auth must provide password reset request and password update flows.');
if (!enterpriseUi.includes("data-mode=\"signup\"") || !enterpriseUi.includes("data-mode=\"reset-request\"") || !enterpriseUi.includes("data-tab=\"account\"")) failures.push('The workspace must expose sign-up, recovery and a direct Account tab.');
if (!enterpriseUi.includes('/api/account/bootstrap')) failures.push('Successful and restored sessions must provision the signed-in workspace.');
if (!accountBootstrap.includes('authenticate(req)') || !accountBootstrap.includes('user.email') || accountBootstrap.includes('body.email')) failures.push('Account bootstrap must bind workspace provisioning only to the authenticated account email.');
if (!routeMap.includes("'account-bootstrap': require('../../server/routes/account-bootstrap')")) failures.push('Account bootstrap must be routed through the shared API function.');
if (!(vercelConfig.rewrites || []).some(item => item.source === '/api/account/bootstrap' && item.destination === '/api/messages?route=account-bootstrap')) failures.push('Account bootstrap rewrite is missing.');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'package.json'), 'utf8'));
if (!packageJson.dependencies || packageJson.dependencies.stripe !== '22.6.2') {
  failures.push('Marketplace webhooks must use the pinned official Stripe SDK version 22.6.2.');
}
const envExample = fs.readFileSync(path.join(root, 'web', 'whilo-swas', '.env.example'), 'utf8');
for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'WHILO_CONNECTOR_ENCRYPTION_KEY', 'WHILO_OAUTH_STATE_SECRET', 'SLACK_CLIENT_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) {
  if (!envExample.includes(key)) failures.push('Missing environment documentation: ' + key);
}
for (const key of ['SUPABASE_SERVICE_ROLE_KEY=', 'WHILO_CONNECTOR_ENCRYPTION_KEY=', 'WHILO_OAUTH_STATE_SECRET=', 'SLACK_CLIENT_SECRET=', 'STRIPE_SECRET_KEY=', 'STRIPE_WEBHOOK_SECRET=']) {
  const lines = envExample.split(/\r?\n/).filter(line => line.startsWith(key));
  if (lines.some(line => line.slice(key.length).trim() && !line.trim().endsWith('='))) {
    failures.push('Real secrets must not be committed in .env.example (' + key + ').');
  }
}

console.log('Whilo platform static checks: ' + checked + ' JavaScript files parsed; ' + migrations.length + ' SQL migrations inspected.');
if (failures.length) {
  for (const failure of failures) console.error('FAIL: ' + failure);
  process.exitCode = 1;
} else {
  console.log('PASS: migration ordering, tenant isolation, encrypted connectors, OAuth state, mission queue/approvals, QR pairing, marketplace fee ledger/webhook tables, and secret hygiene.');
}
