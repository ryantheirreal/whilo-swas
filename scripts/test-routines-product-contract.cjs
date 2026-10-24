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
console.log('Routines product-contract regression tests passed (3D, onboarding, @Routines, library snapshots, budget and safety boundaries).');
