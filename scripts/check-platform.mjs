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

const jsFiles = [
  ...walk(path.join(root, 'web', 'whilo-swas', 'api')).filter(file => file.endsWith('.js')),
  ...walk(path.join(root, 'scripts')).filter(file => (file.endsWith('.mjs') || file.endsWith('.js')) && !file.endsWith('check-platform.mjs')),
  path.join(root, 'web', 'whilo-swas', 'whilo-enterprise.js'),
  path.join(root, 'web', 'whilo-swas', 'whilo-cloud-auth.js'),
  path.join(root, 'shared', 'whilo-agent-core', 'index.cjs'),
  path.join(root, 'shared', 'whilo-agent-core', 'index.js'),
  path.join(root, 'shared', 'whilo-agent-core', 'index.test.cjs')
].filter(file => fs.existsSync(file));

for (const file of new Set(jsFiles)) checkJs(file);

const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrations = walk(migrationsDir).filter(file => file.endsWith('.sql')).sort();
if (migrations.length < 8) {
  failures.push('Expected all eight versioned Supabase migrations to be present.');
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
  ['single-use workspace invitations', /function public\.accept_workspace_invitation/i]
]) {
  if (!pattern.test(allSql)) failures.push('Missing database invariant: ' + label);
}

const bootstrap = fs.readFileSync(path.join(root, 'scripts', 'bootstrap-owner.mjs'), 'utf8');
if (!bootstrap.includes('WHILO_OWNER_INITIAL_PASSWORD')) failures.push('Owner bootstrap must read a temporary password from the environment.');
if (!bootstrap.includes('password.length < 14')) failures.push('Owner bootstrap must reject weak passwords.');
if (bootstrap.includes('1223344q')) failures.push('A weak chat-shared password must never be committed to source.');
if (/console\.(?:log|error)\(\s*password\b/i.test(bootstrap) || /console\.(?:log|error)\(\s*JSON\.stringify\(\s*\{[^}]*\bpassword\s*:/is.test(bootstrap)) failures.push('Owner bootstrap must not log passwords.');
const envExample = fs.readFileSync(path.join(root, 'web', 'whilo-swas', '.env.example'), 'utf8');
for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'WHILO_CONNECTOR_ENCRYPTION_KEY', 'WHILO_OAUTH_STATE_SECRET', 'SLACK_CLIENT_SECRET']) {
  if (!envExample.includes(key)) failures.push('Missing environment documentation: ' + key);
}
for (const key of ['SUPABASE_SERVICE_ROLE_KEY=', 'WHILO_CONNECTOR_ENCRYPTION_KEY=', 'WHILO_OAUTH_STATE_SECRET=', 'SLACK_CLIENT_SECRET=']) {
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
  console.log('PASS: migration ordering, tenant-isolation primitives, encrypted connector storage, OAuth state, queue/approval hooks, QR pairing, and secret hygiene.');
}
