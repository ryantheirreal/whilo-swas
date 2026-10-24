'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'web/whilo-swas/whilo-enterprise.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'web/whilo-swas/server/routes/routines.js'), 'utf8');
const analysis = fs.readFileSync(path.join(root, 'web/whilo-swas/server/security/library-routine-analysis.js'), 'utf8');
const wallet = fs.readFileSync(path.join(root, 'web/whilo-swas/whilo-enterprise.js'), 'utf8');

assert.ok(ui.includes('function routineScene(reducedMotion)'), 'Routines keeps its interactive 3D scene and reduced-motion path');
assert.ok(ui.includes('function openRoutineInChat(promptText)'), 'Routines keeps the Chat hand-off');
assert.ok(ui.includes("const prompt='@Routines '+String(promptText||"), 'Chat hand-off prefixes the context with @Routines');
assert.ok(ui.includes('data-act="routine-chat"'), 'Routine cards expose a create/improve-in-chat action');
assert.ok(ui.includes('data-act="routine-target-shortcut"'), '3D scene nodes link library, browser and computer routine targets');
assert.ok(ui.includes('INTERACTIVE ONBOARDING · '), 'The four-stage interactive onboarding remains visible');
assert.ok(ui.includes('Progress reflects real setup and review events—not time spent, streak pressure or artificial urgency.'), 'Gamification remains based on completed milestones, not compulsive time/streak pressure');
assert.ok(ui.includes('Scripts and embedded HTML are not executed.'), 'Saved library assets are not treated as executable user code');
assert.ok(ui.includes('data-act="routine-analyze-library"'), 'A saved dashboard/app can be analyzed as a bounded library snapshot');
assert.ok(ui.includes('Credit recovery in progress'), 'Wallet explains when credits are temporarily withheld to recover a refund/dispute debt');
assert.ok(api.includes('async function runAssetAnalysis'), 'Server has the bounded saved-snapshot analysis path');
assert.ok(api.includes('async function runRoutine'), 'Server has the durable run/mission path');
assert.ok(api.includes('resolvePublicHttpsTarget'), 'Routine target save/run uses DNS-aware public-address validation');
assert.ok(api.includes('max_cost_wb'), 'Routine records enforce a server-side maximum per-run budget');
assert.ok(api.includes('not_started'), 'Enqueued missions are not falsely marked as executed');
assert.ok(analysis.includes('executionMode'), 'Library analysis returns a typed, explicit execution mode');
assert.ok(ui.includes('function whiloChatPage()'), 'Whilo has a first-party Chat surface rather than only a host-chat prefill');
assert.ok(ui.includes('data-tab="chat"'), 'Chat is a first-class Whilo workspace tab');
assert.ok(ui.includes("whiloApi('/api/model-gateway'"), 'Chat responses use the authenticated BYOK model gateway');
assert.ok(ui.includes("if(/^@Routines\\b/i.test(message))whiloChatMode='routines'"), '@Routines switches the composer into the structured routine builder');
assert.ok(ui.includes("action:'create_routine'"), 'A reviewed @Routines draft is saved through the authenticated routine API');
assert.ok(ui.includes("approvalPolicy:'always',enabled:false"), 'Chat-created routines are always approval-gated and initially paused');
assert.ok(ui.includes('DRAFT · NOT SAVED OR EXECUTED'), 'Model-proposed automation is clearly labelled as a draft before save');
assert.ok(ui.includes("targetUrl:['website','api'].includes(kind)?String(whiloChatTargetUrl||'').trim()||null:null,"), 'Target URLs cannot leak from a previous context into a library routine');
console.log('Routines product-contract regression tests passed (3D onboarding, first-party Chat, @Routines save flow, library snapshots, budget and safety boundaries).');
