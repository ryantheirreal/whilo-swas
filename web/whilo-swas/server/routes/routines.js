'use strict';

const crypto = require('node:crypto');
const { validateHttpsTarget, resolvePublicHttpsTarget } = require('../security/public-target');
const { send, authenticate, organizationFor, db, readJson, safeError, audit } = require('../../api/_lib/platform');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSET_TYPES = new Set(['dashboard','web_app','document','report','workflow','template','dataset']);
const TARGET_KINDS = new Set(['library_asset','dashboard','web_app','website','computer','api']);
const RUNTIME_MODES = new Set(['browser','desktop','api','chat','hybrid']);
const SCHEDULE_KINDS = new Set(['manual','daily','weekly']);
const APPROVAL_POLICIES = new Set(['always','first_run','for_writes']);
const STEP_KINDS = new Set(['inspect','extract','summarize','compare','draft','review','verify','ask_approval','notify','open_library_asset','navigate_website']);
const MAX_BODY_BYTES = 32768;

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}
function text(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}
function jsonObject(value, maxBytes) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = JSON.stringify(value);
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) fail(400, 'The asset definition is too large.');
  return JSON.parse(raw);
}
function ensureUuid(value, name) {
  const id = String(value || '');
  if (!UUID_RE.test(id)) fail(400, name + ' must be a valid ID.');
  return id;
}
function safeHttpsUrl(value) {
  return validateHttpsTarget(value);
}
function boundedList(value, maxItems, maxLength, label) {
  if (!Array.isArray(value)) fail(400, label + ' must be a list.');
  const result = value.map(item => text(item, maxLength)).filter(Boolean);
  if (!result.length || result.length > maxItems || value.length !== result.length) fail(400, label + ' must contain between 1 and ' + maxItems + ' valid items.');
  return [...new Set(result)];
}
function normalizedSteps(value) {
  const raw = Array.isArray(value) ? value : [];
  if (raw.length > 16) fail(400, 'A routine can include at most 16 structured steps.');
  return raw.map((step, i) => {
    const label = text(step && step.label, 300);
    const kind = String(step && step.kind || 'inspect');
    if (!label || !STEP_KINDS.has(kind)) fail(400, 'Each step needs a title and an allowed step type.');
    return { id: 'step-' + (i + 1), label, kind };
  });
}
function validateTimezone(value) {
  const timezone = text(value || 'America/Sao_Paulo', 80);
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date()); }
  catch (_) { fail(400, 'Choose a valid IANA time zone.'); }
  return timezone;
}
function validateSchedule(body) {
  const kind = String(body.scheduleKind || 'manual');
  if (!SCHEDULE_KINDS.has(kind)) fail(400, 'Choose manual, daily or weekly scheduling.');
  const time = text(body.scheduleTime, 5);
  const days = Array.isArray(body.scheduleDays) ? [...new Set(body.scheduleDays.map(Number))] : [];
  if (kind !== 'manual' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(400, 'Scheduled routines need a valid local time (HH:MM).');
  if (kind === 'weekly' && (!days.length || days.some(day => !Number.isInteger(day) || day < 0 || day > 6))) {
    fail(400, 'Weekly schedules need one or more days between Sunday (0) and Saturday (6).');
  }
  return { kind, time: kind === 'manual' ? null : time, days: kind === 'weekly' ? days : [], timezone: validateTimezone(body.timezone) };
}
function extractMissionId(value) {
  if (typeof value === 'string' && UUID_RE.test(value)) return value;
  if (Array.isArray(value) && value.length) return extractMissionId(value[0]);
  if (value && typeof value === 'object') {
    for (const key of ['create_mission_bundle','id','mission_id']) if (value[key]) return extractMissionId(value[key]);
  }
  return null;
}
async function readOrgRows(table, orgId, query) {
  const rows = await db(table + '?organization_id=eq.' + encodeURIComponent(orgId) + '&' + query);
  return Array.isArray(rows) ? rows : [];
}
async function getWorkspace(user, member) {
  const orgId = member.organization_id;
  const [routines, assets, runs, onboarding, wallet, devices] = await Promise.all([
    readOrgRows('whilo_routines', orgId, 'select=id,created_by,title,description,target_kind,asset_id,target_url,runtime_mode,schedule_kind,schedule_time,schedule_days,timezone,next_run_at,last_run_at,steps,acceptance_criteria,approval_policy,enabled,created_at,updated_at&order=updated_at.desc&limit=100'),
    readOrgRows('whilo_library_assets', orgId, 'select=id,created_by,name,asset_type,description,source_url,definition,status,version,created_at,updated_at&order=updated_at.desc&limit=100'),
    readOrgRows('whilo_routine_runs', orgId, 'select=id,routine_id,requested_by,mission_id,trigger_source,status,result,error_code,started_at,finished_at,created_at,updated_at&order=created_at.desc&limit=50'),
    db('whilo_onboarding_state?organization_id=eq.' + encodeURIComponent(orgId) + '&user_id=eq.' + encodeURIComponent(user.id) + '&select=current_step,completed_at,preferences,updated_at&limit=1'),
    db('whilo_credit_wallets?organization_id=eq.' + encodeURIComponent(orgId) + '&select=balance_wb,total_purchased_wb,total_spent_wb&limit=1'),
    db('bridge_devices?organization_id=eq.' + encodeURIComponent(orgId) + '&owner_id=eq.' + encodeURIComponent(user.id) + '&status=eq.active&revoked_at=is.null&select=scopes,last_seen_at&limit=20')
  ]);
  const currentTime = Date.now();
  const deviceRows = Array.isArray(devices) ? devices : [];
  const computerRuntimeReady = deviceRows.some(function (device) {
    const lastSeen = Date.parse(device.last_seen_at || '');
    const scopes = Array.isArray(device.scopes) ? device.scopes : [];
    return Number.isFinite(lastSeen) && currentTime - lastSeen <= 5 * 60 * 1000
      && scopes.includes('computer:read') && scopes.includes('computer:control');
  });
  return {
    routines, assets, runs,
    onboarding: Array.isArray(onboarding) && onboarding[0] ? onboarding[0] : { current_step: 0, completed_at: null, preferences: {} },
    wallet: Array.isArray(wallet) && wallet[0] ? wallet[0] : { balance_wb: 0, total_purchased_wb: 0, total_spent_wb: 0 },
    runtime: {
      computerReady: computerRuntimeReady,
      reason: computerRuntimeReady ? 'paired_scoped_recent_heartbeat' : 'no_recent_authorized_computer',
      lastDeviceSeenAt: deviceRows.reduce(function (latest, device) {
        return device.last_seen_at && (!latest || Date.parse(device.last_seen_at) > Date.parse(latest)) ? device.last_seen_at : latest;
      }, null)
    }
  };
}
async function createAsset(user, member, body) {
  const name = text(body.name, 100);
  const type = String(body.assetType || 'dashboard');
  const description = text(body.description, 1500);
  if (name.length < 2 || !ASSET_TYPES.has(type)) fail(400, 'Provide an asset name and an allowed asset type.');
  const sourceUrl = safeHttpsUrl(body.sourceUrl);
  if (sourceUrl) await resolvePublicHttpsTarget(sourceUrl);
  const definition = jsonObject(body.definition, 12000);
  // A library artifact is data, not executable HTML or JavaScript.
  const encodedDefinition = JSON.stringify(definition);
  if (/<\s*script\b|javascript:|<\s*iframe\b|onerror\s*=|onload\s*=/i.test(encodedDefinition)) {
    fail(400, 'Library definitions may contain data and widget settings, not executable HTML or JavaScript.');
  }
  const rows = await db('whilo_library_assets', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      organization_id: member.organization_id, created_by: user.id, name, asset_type: type,
      description, source_url: sourceUrl, definition, status: 'draft', version: 1
    })
  });
  if (!Array.isArray(rows) || !rows[0]) fail(503, 'The library asset could not be saved.');
  await audit(member.organization_id, user.id, 'library.asset_created', 'whilo_library_asset', rows[0].id, 'success', { asset_type: type });
  return rows[0];
}
async function createRoutine(user, member, body) {
  const title = text(body.title, 100);
  const description = String(body.description || '').trim().slice(0, 4000);
  const targetKind = String(body.targetKind || 'library_asset');
  const runtimeMode = String(body.runtimeMode || 'browser');
  const approvalPolicy = String(body.approvalPolicy || 'always');
  if (title.length < 3 || description.length < 1) fail(400, 'Routine title and purpose are required.');
  if (!TARGET_KINDS.has(targetKind) || !RUNTIME_MODES.has(runtimeMode) || !APPROVAL_POLICIES.has(approvalPolicy)) fail(400, 'Routine target, runtime or approval policy is invalid.');
  const schedule = validateSchedule(body);
  let assetId = null;
  let selectedAsset = null;
  let targetUrl = safeHttpsUrl(body.targetUrl);
  if (targetKind === 'library_asset' || targetKind === 'dashboard' || targetKind === 'web_app') {
    if (body.assetId) {
      assetId = ensureUuid(body.assetId, 'assetId');
      const assets = await db('whilo_library_assets?id=eq.' + encodeURIComponent(assetId) + '&organization_id=eq.' + encodeURIComponent(member.organization_id) + '&select=id,asset_type,source_url,status&limit=1');
      selectedAsset = Array.isArray(assets) ? assets[0] : null;
      if (!selectedAsset || selectedAsset.status === 'archived') fail(404, 'The selected library asset is unavailable in this workspace.');
      if (!targetUrl && selectedAsset.source_url) targetUrl = safeHttpsUrl(selectedAsset.source_url);
    } else {
      fail(400, 'Select a library asset before saving a library, dashboard or web-app routine.');
    }
    if (targetKind === 'dashboard' && selectedAsset.asset_type !== 'dashboard') fail(400, 'Choose a dashboard asset for this target type.');
    if (targetKind === 'web_app' && selectedAsset.asset_type !== 'web_app') fail(400, 'Choose a web-app asset for this target type.');
  }
  if ((targetKind === 'website' || targetKind === 'api') && !targetUrl) fail(400, 'Website and API routines require an HTTPS target URL.');
  if (targetUrl) targetUrl = await resolvePublicHttpsTarget(targetUrl);
  if (targetKind === 'computer' && runtimeMode !== 'desktop' && runtimeMode !== 'hybrid') fail(400, 'Choose Desktop or Hybrid runtime for computer routines.');
  const suppliedSteps = Array.isArray(body.steps) && body.steps.length ? body.steps : [
    { label: 'Inspect the configured target and gather evidence', kind: 'inspect' },
    { label: 'Prepare a structured summary and verification checklist', kind: 'summarize' }
  ];
  const steps = normalizedSteps(suppliedSteps);
  const criteria = boundedList(body.acceptanceCriteria || ['Outcome is recorded', 'Evidence and exceptions are included'], 8, 500, 'Acceptance criteria');
  const rows = await db('whilo_routines', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      organization_id: member.organization_id, created_by: user.id, title, description, target_kind: targetKind,
      asset_id: assetId, target_url: targetUrl, runtime_mode: runtimeMode, schedule_kind: schedule.kind,
      schedule_time: schedule.time, schedule_days: schedule.days, timezone: schedule.timezone,
      steps, acceptance_criteria: criteria, approval_policy: approvalPolicy, enabled: body.enabled === true
    })
  });
  if (!Array.isArray(rows) || !rows[0]) fail(503, 'The routine could not be saved.');
  await audit(member.organization_id, user.id, 'routine.created', 'whilo_routine', rows[0].id, 'success', {
    target_kind: targetKind, runtime_mode: runtimeMode, schedule_kind: schedule.kind
  });
  return rows[0];
}
async function runRoutine(user, member, body) {
  const routineId = ensureUuid(body.routineId, 'routineId');
  const suppliedKey = text(body.idempotencyKey || '', 100);
  const idempotencyKey = suppliedKey || crypto.randomUUID();
  if (!/^[A-Za-z0-9:_-]{8,100}$/.test(idempotencyKey)) fail(400, 'The idempotency key must be 8–100 letters, numbers, colons, underscores or hyphens.');

  // Authorize the target routine before looking up a prior run; idempotency is not an access-control bypass.
  const routines = await db('whilo_routines?id=eq.' + encodeURIComponent(routineId) +
    '&organization_id=eq.' + encodeURIComponent(member.organization_id) + '&select=*&limit=1');
  const routine = Array.isArray(routines) ? routines[0] : null;
  if (!routine) fail(404, 'Routine not found in this workspace.');
  const canRun = routine.created_by === user.id || ['owner','admin'].includes(member.role);
  if (!canRun) fail(403, 'Only the routine creator or a workspace administrator can run it.');

  const prior = await db('whilo_routine_runs?organization_id=eq.' + encodeURIComponent(member.organization_id) +
    '&idempotency_key=eq.' + encodeURIComponent(idempotencyKey) +
    '&select=id,routine_id,requested_by,mission_id,status,result&limit=1');
  if (Array.isArray(prior) && prior[0]) {
    if (prior[0].routine_id !== routineId) fail(409, 'This idempotency key was already used for another routine.');
    if (prior[0].requested_by !== user.id && !['owner','admin'].includes(member.role)) fail(403, 'You cannot inspect another member’s routine run.');
    return { run: prior[0], duplicate: true };
  }
  const requiresComputer = routine.target_kind === 'computer' || ['desktop','hybrid'].includes(routine.runtime_mode);
  if (requiresComputer) {
    const devices = await db('bridge_devices?organization_id=eq.' + encodeURIComponent(member.organization_id) +
      '&owner_id=eq.' + encodeURIComponent(user.id) + '&status=eq.active&revoked_at=is.null&select=scopes,last_seen_at&limit=20');
    const now = Date.now();
    const capable = (Array.isArray(devices) ? devices : []).some(function (device) {
      const lastSeen = Date.parse(device.last_seen_at || '');
      const scopes = Array.isArray(device.scopes) ? device.scopes : [];
      return Number.isFinite(lastSeen) && now - lastSeen <= 5 * 60 * 1000
        && scopes.includes('computer:read') && scopes.includes('computer:control');
    });
    if (!capable) fail(409, 'Computer routines require a paired device with explicit computer:read and computer:control scopes and a heartbeat from the last five minutes. Pairing/heartbeat alone is not remote-control authorization.');
  }

  const recentSince = new Date(Date.now() - 60 * 1000).toISOString();
  const recentRuns = await db('whilo_routine_runs?organization_id=eq.' + encodeURIComponent(member.organization_id) +
    '&requested_by=eq.' + encodeURIComponent(user.id) + '&created_at=gte.' + encodeURIComponent(recentSince) + '&select=id&limit=10');
  if (Array.isArray(recentRuns) && recentRuns.length >= 5) fail(429, 'Routine launch limit reached: up to five manual runs per minute. Review existing runs before retrying.');

  if (routine.target_url) await resolvePublicHttpsTarget(routine.target_url);
  const assetRows = routine.asset_id
    ? await db('whilo_library_assets?id=eq.' + encodeURIComponent(routine.asset_id) + '&organization_id=eq.' + encodeURIComponent(member.organization_id) + '&select=id,name,asset_type,source_url,status&limit=1')
    : [];
  const asset = Array.isArray(assetRows) ? assetRows[0] : null;
  if (routine.asset_id && (!asset || asset.status === 'archived')) fail(409, 'The library asset was archived or removed; update the routine before launching it.');
  const inserted = await db('whilo_routine_runs', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      organization_id: member.organization_id, routine_id: routine.id, requested_by: user.id,
      trigger_source: 'manual', status: 'requested', idempotency_key: idempotencyKey,
      result: { target_kind: routine.target_kind, asset_id: routine.asset_id, target_url: routine.target_url, execution_status: 'not_started' }
    })
  });
  const run = Array.isArray(inserted) ? inserted[0] : null;
  if (!run) {
    const retry = await db('whilo_routine_runs?organization_id=eq.' + encodeURIComponent(member.organization_id) +
      '&idempotency_key=eq.' + encodeURIComponent(idempotencyKey) + '&select=id,routine_id,requested_by,mission_id,status,result&limit=1');
    if (Array.isArray(retry) && retry[0]) {
      if (retry[0].routine_id !== routineId) fail(409, 'This idempotency key was already used for another routine.');
      if (retry[0].requested_by !== user.id && !['owner','admin'].includes(member.role)) fail(403, 'You cannot inspect another member’s routine run.');
      return { run: retry[0], duplicate: true };
    }
    fail(503, 'The routine run could not be recorded.');
  }

  try {
    const rawSteps = Array.isArray(routine.steps) && routine.steps.length ? routine.steps : [
      { label: 'Inspect the target and prepare a verifiable report', kind: 'inspect' }
    ];
    const tasks = rawSteps.slice(0, 16).map((step, index) => ({
      id: 'routine-step-' + (index + 1),
      title: text(step.label, 300) || 'Inspect the configured target',
      role: ['review','verify'].includes(step.kind) ? 'QA Verifier' : 'Workflow Planner',
      dependsOn: [],
      toolScopes: ['read','draft'],
      maxAttempts: 2
    }));
    const goal = [
      'Routine: ' + routine.title,
      routine.description,
      'Target kind: ' + routine.target_kind,
      asset ? 'Workspace library asset: ' + asset.name + ' (' + asset.asset_type + ', ID ' + asset.id + ')' : '',
      routine.target_url ? 'HTTPS target: ' + routine.target_url : '',
      routine.runtime_mode === 'desktop' || routine.runtime_mode === 'hybrid'
        ? 'Computer access request: use only a paired, authorized computer bridge. If no bridge is configured, stop safely and report it.'
        : '',
      'Prepare the plan and evidence. Do not send external messages, change records, or perform other external writes without explicit approval.'
    ].filter(Boolean).join('\n').slice(0, 4000);
    const criteria = Array.isArray(routine.acceptance_criteria) ? routine.acceptance_criteria : ['Outcome is recorded','Evidence and exceptions are included'];
    const missionRows = await db('rpc/create_mission_bundle', {
      method: 'POST',
      body: JSON.stringify({
        p_organization_id: member.organization_id, p_user_id: user.id,
        p_mission: {
          goal, department: 'Operations',
          risk: routine.target_kind === 'computer' ? 'high' : ['website','api','web_app'].includes(routine.target_kind) ? 'medium' : 'low',
          budget: 0, budgetCurrency: 'BRL', acceptanceCriteria: criteria
        },
        p_tasks: tasks,
        p_idempotency_key: 'routine-run-' + run.id
      })
    });
    const missionId = extractMissionId(missionRows);
    if (!missionId) throw new Error('Routine plan was not persisted.');
    const updated = await db('whilo_routine_runs?id=eq.' + encodeURIComponent(run.id) +
      '&organization_id=eq.' + encodeURIComponent(member.organization_id), {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          mission_id: missionId, status: 'awaiting_approval',
          result: { target_kind: routine.target_kind, asset_id: routine.asset_id, asset_name: asset && asset.name || null,
            target_url: routine.target_url, execution_status: 'not_started', mission_state: 'awaiting_approval' }
        })
      });
    await db('whilo_routines?id=eq.' + encodeURIComponent(routine.id) +
      '&organization_id=eq.' + encodeURIComponent(member.organization_id), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ last_run_at: new Date().toISOString() })
      });
    await audit(member.organization_id, user.id, 'routine.run_requested', 'whilo_routine_run', run.id, 'success', { mission_id: missionId, execution_status: 'not_started' });
    return {
      run: Array.isArray(updated) && updated[0] ? updated[0] : { ...run, mission_id: missionId, status: 'awaiting_approval' },
      missionId, duplicate: false,
      detail: 'Routine prepared a mission that is awaiting approval. The browser/computer action has not started.'
    };
  } catch (error) {
    await db('whilo_routine_runs?id=eq.' + encodeURIComponent(run.id) +
      '&organization_id=eq.' + encodeURIComponent(member.organization_id), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'failed', error_code: 'mission_creation_failed', finished_at: new Date().toISOString(), result: { execution_status: 'not_started' } })
      }).catch(() => {});
    throw error;
  }
}
async function handle(req, res) {
  const user = await authenticate(req);
  const member = await organizationFor(user);
  if (req.method === 'GET') return send(res, 200, await getWorkspace(user, member));
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  const body = await readJson(req, MAX_BODY_BYTES);
  const action = String(body.action || '');
  if (action === 'create_asset') {
    const asset = await createAsset(user, member, body);
    return send(res, 201, { ok: true, asset });
  }
  if (action === 'archive_asset') {
    const assetId = ensureUuid(body.assetId, 'assetId');
    const rows = await db('whilo_library_assets?id=eq.' + encodeURIComponent(assetId) +
      '&organization_id=eq.' + encodeURIComponent(member.organization_id) +
      '&created_by=eq.' + encodeURIComponent(user.id) + '&select=id,name,status&limit=1');
    if (!Array.isArray(rows) || !rows[0]) fail(404, 'Library asset not found or you are not its creator.');
    const routines = await db('whilo_routines?asset_id=eq.' + encodeURIComponent(assetId) +
      '&organization_id=eq.' + encodeURIComponent(member.organization_id) + '&select=id&limit=1');
    if (Array.isArray(routines) && routines.length) fail(409, 'This asset is referenced by a routine. Change or archive that routine before archiving the asset.');
    await db('whilo_library_assets?id=eq.' + encodeURIComponent(assetId) + '&organization_id=eq.' + encodeURIComponent(member.organization_id), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'archived' })
    });
    return send(res, 200, { ok: true });
  }
  if (action === 'create_routine') {
    const routine = await createRoutine(user, member, body);
    return send(res, 201, { ok: true, routine });
  }
  if (action === 'toggle_routine') {
    const id = ensureUuid(body.routineId, 'routineId');
    const enabled = body.enabled === true;
    const rows = await db('whilo_routines?id=eq.' + encodeURIComponent(id) +
      '&organization_id=eq.' + encodeURIComponent(member.organization_id) +
      '&select=id,created_by,enabled,schedule_kind,title&limit=1');
    const current = Array.isArray(rows) ? rows[0] : null;
    if (!current) fail(404, 'Routine not found.');
    if (current.created_by !== user.id && !['owner','admin'].includes(member.role)) fail(403, 'Only the creator or a workspace administrator can change a routine.');
    const updated = await db('whilo_routines?id=eq.' + encodeURIComponent(id) + '&organization_id=eq.' + encodeURIComponent(member.organization_id), {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ enabled })
    });
    await audit(member.organization_id, user.id, enabled ? 'routine.enabled' : 'routine.disabled', 'whilo_routine', id, 'success');
    return send(res, 200, { ok: true, routine: Array.isArray(updated) ? updated[0] : null });
  }
  if (action === 'run_routine') {
    const result = await runRoutine(user, member, body);
    return send(res, result.duplicate ? 200 : 201, result);
  }
  if (action === 'save_onboarding') {
    const step = Number(body.currentStep);
    if (!Number.isInteger(step) || step < 0 || step > 5) fail(400, 'Onboarding step must be between 0 and 5.');
    const preferences = jsonObject(body.preferences || {}, 5000);
    const completed = body.completed === true;
    const result = await db('whilo_onboarding_state?on_conflict=organization_id,user_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        organization_id: member.organization_id, user_id: user.id, current_step: step,
        completed_at: completed ? new Date().toISOString() : null, preferences
      })
    });
    return send(res, 200, { ok: true, onboarding: Array.isArray(result) ? result[0] : result });
  }
  return send(res, 400, { error: 'Unsupported routines action.' });
}
module.exports = async function routinesHandler(req, res) {
  try { return await handle(req, res); }
  catch (error) { return safeError(res, error); }
};
