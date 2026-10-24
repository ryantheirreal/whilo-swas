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
  ...walk(path.join(root, 'web', 'whilo-swas', 'server', 'security')).filter(file => file.endsWith('.js')),
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
if (migrations.length < 25) {
  failures.push('Expected all twenty-five versioned Supabase migrations to be present.');
}
const migrationVersions = migrations.map(file => path.basename(file).match(/^(\d{12})_/));
if (migrationVersions.some(match => !match)) failures.push('Every SQL migration must start with a 12-digit version and underscore.');
const versionValues = migrationVersions.filter(Boolean).map(match => match[1]);
if (new Set(versionValues).size !== versionValues.length) failures.push('Supabase migration version prefixes must be unique.');
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
  ['transactional marketplace install RPC', /function public\.install_marketplace_asset/i],
  ['affiliate profile and rank ledger', /create table if not exists public\.affiliate_profiles/i],
  ['first-touch customer attribution', /function public\.claim_whilo_affiliate_referral/i],
  ['idempotent affiliate commission ledger', /create table if not exists public\.affiliate_commissions/i],
  ['refund and dispute commission reversal', /function public\.reverse_whilo_affiliate_source/i],
  ['net affiliate payout adjustments', /create table if not exists public\.affiliate_adjustments/i],
  ['exact full-ledger affiliate summary', /function public\.whilo_affiliate_summary/i],
  ['membership table browser privilege lockdown', /revoke all privileges on table public\.organization_members from public, anon, authenticated/i],
  ['integration view invoker security', /alter view public\.integration_connections_safe set \(security_invoker = true, security_barrier = true\)/i],
  ['trigger functions not executable by browser roles', /revoke all on function public\.handle_new_user\(\) from public, anon, authenticated, service_role/i],
  ['safe integration view grants authenticated read only', /grant select on table public\.integration_connections_safe to authenticated/i],
  ['integration table column-level allowlist', /grant select \(id, organization_id, provider, status, external_account_id, external_account_name, scopes, metadata, connected_at, last_verified_at, revoked_at\)\s+on table public\.integration_connections to authenticated/i],
  ['workspace library asset model', /create table if not exists public\.whilo_library_assets/i],
  ['durable approval-gated routine runs', /create table if not exists public\.whilo_routine_runs/i],
  ['database-native routine scheduler', /function private\.dispatch_due_whilo_routines/i],
  ['Willow Bucks usage wallet', /create table if not exists public\.whilo_credit_wallets/i],
  ['atomic usage metering', /function public\.charge_whilo_usage/i],
  ['idempotent Willow Bucks topups', /function public\.apply_whilo_credit_purchase/i],
  ['server-only business table grants', /revoke all privileges on all tables in schema public from public, anon, authenticated/i],
  ['post-feature foreign-key index pass', /whilo_fk_/i],
  ['per-run Willow Bucks budget ceiling', /add column if not exists max_cost_wb bigint not null default 1000/i],
  ['conservative provider cost conversion', /function public\.whilo_bucks_for_provider_cost/i],
  ['provider cost cap metadata', /provider_cost_cap_40pct/i],
]) {
  if (!pattern.test(allSql)) failures.push('Missing database invariant: ' + label);
}

const routinesRoute = fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'server', 'routes', 'routines.js'), 'utf8');
if (!routinesRoute.includes('let selectedAsset = null')) failures.push('Routine creation must validate the selected library asset outside its branch scope.');
const routineAuthorizeAt = routinesRoute.indexOf('// Authorize the target routine before looking up a prior run; idempotency is not an access-control bypass.');
const routinePriorAt = routinesRoute.indexOf("const prior = await db('whilo_routine_runs");
if (routineAuthorizeAt < 0 || routinePriorAt < 0 || routineAuthorizeAt > routinePriorAt) failures.push('Routine idempotency lookup must follow workspace and routine authorization.');
if (!routinesRoute.includes('This idempotency key was already used for another routine.')) failures.push('Routine idempotency keys must not be reused across unrelated routines.');
if (!routinesRoute.includes('up to five manual runs per minute')) failures.push('Routine manual launch rate limiting is missing.');
if (!routinesRoute.includes("scopes.includes('computer:read')") || !routinesRoute.includes("scopes.includes('computer:control')")) failures.push('Computer routines must require explicit read and control scopes.');
if (!routinesRoute.includes('now - lastSeen <= 5 * 60 * 1000')) failures.push('Computer routines must require a recent device heartbeat.');
const enterpriseUi = fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'whilo-enterprise.js'), 'utf8');
for (const [label, pattern] of [
  ['library-target routine playbooks', /const ROUTINE_TEMPLATES/],
  ['visible chat entrypoint for @Routines', /Build in Chat @Routines/],
  ['playbook attachment to user-owned assets', /data-act="routine-use-asset"/],
  ['transparent progress milestones', /Workspace mastery/],
  ['reduced-motion 3D support', /prefers-reduced-motion/],
  ['interactive 3D tilt handler', /pointermove/],
  ['per-run Willow Bucks budget input', /maxCostWB/]
]) if (!pattern.test(enterpriseUi)) failures.push('Missing routine product invariant: ' + label);

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
if (!routeMap.includes("affiliates: require('../../server/routes/affiliates')")) failures.push('The affiliate API must be routed through the shared Vercel function.');
if (!(vercelConfig.rewrites || []).some(item => item.source === '/api/affiliates' && item.destination === '/api/messages?route=affiliates')) failures.push('The affiliate API rewrite is missing.');
const affiliateRoute = fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'server', 'routes', 'affiliates.js'), 'utf8');
if (!affiliateRoute.includes("action==='claim-referral'") || !affiliateRoute.includes('authenticate(req)')) failures.push('Affiliate attribution must use an authenticated server endpoint.');
if (!affiliateRoute.includes('WHILO_AFFILIATE_PAYOUTS_ENABLED')) failures.push('Real affiliate transfers must be protected by an explicit server-side kill switch.');
const routinesRoute = fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'server', 'routes', 'routines.js'), 'utf8');
const publicTarget = fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'server', 'security', 'public-target.js'), 'utf8');
const routineSecurityTests = fs.readFileSync(path.join(root, 'scripts', 'test-routine-security.cjs'), 'utf8');
if (!routinesRoute.includes('resolvePublicHttpsTarget')) failures.push('Routine URL targets must pass DNS-aware public-address validation at save and run time.');
if (!routinesRoute.includes('max_cost_wb')) failures.push('Routine execution records must carry a per-run budget ceiling.');
if (!publicTarget.includes('blockedAddresses.check') || !publicTarget.includes('lookup(new URL(normalized).hostname')) failures.push('Routine target validator must block private/reserved DNS answers.');
if (!routineSecurityTests.includes('mixedLookup') || !routineSecurityTests.includes('169.254.169.254')) failures.push('Routine SSRF tests must cover metadata IPs and mixed public/private DNS answers.');
if (!enterpriseUi.includes('function affiliateHubPage()') || !enterpriseUi.includes('affiliate-enroll-form')) failures.push('The Account screen must expose affiliate enrollment and dashboard UI.');

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'web', 'whilo-swas', 'package.json'), 'utf8'));
if (!packageJson.dependencies || packageJson.dependencies.stripe !== '22.6.2') {
  failures.push('Marketplace webhooks must use the pinned official Stripe SDK version 22.6.2.');
}
const envExample = fs.readFileSync(path.join(root, 'web', 'whilo-swas', '.env.example'), 'utf8');
for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'WHILO_CONNECTOR_ENCRYPTION_KEY', 'WHILO_OAUTH_STATE_SECRET', 'SLACK_CLIENT_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'WHILO_AFFILIATE_PAYOUT_ADMIN_USER_IDS', 'WHILO_AFFILIATE_PAYOUTS_ENABLED', 'STRIPE_CREDITS_WEBHOOK_SECRET']) {
  if (!envExample.includes(key)) failures.push('Missing environment documentation: ' + key);
}
for (const key of ['SUPABASE_SERVICE_ROLE_KEY=', 'WHILO_CONNECTOR_ENCRYPTION_KEY=', 'WHILO_OAUTH_STATE_SECRET=', 'SLACK_CLIENT_SECRET=', 'STRIPE_SECRET_KEY=', 'STRIPE_WEBHOOK_SECRET=', 'WHILO_AFFILIATE_PAYOUT_ADMIN_USER_IDS=', 'WHILO_AFFILIATE_PAYOUTS_ENABLED=', 'STRIPE_CREDITS_WEBHOOK_SECRET=']) {
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
  console.log('PASS: migration ordering, tenant isolation, integration view/grants, DNS-aware routine targets and SSRF tests, encrypted connectors, OAuth state, mission approvals, marketplace fee ledger/webhooks, Willow Bucks idempotency, affiliate attribution, refunds, payout netting and secret hygiene.');
}
