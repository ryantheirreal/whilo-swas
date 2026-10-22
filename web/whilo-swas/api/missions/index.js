'use strict';
const crypto = require('node:crypto');
const { send, authenticate, organizationFor, db, readJson, audit, safeError } = require('../_lib/platform');

const ROLES = new Set([
  'Browser Researcher', 'Computer Operator', 'Data Analyst', 'CRM Operator',
  'Writer', 'Coder', 'Workflow Planner', 'QA Verifier'
]);
const SCOPES = new Set(['read', 'draft', 'external_send', 'computer_control', 'crm_write', 'sms_send']);

function validatePlan(input) {
  const goal = String(input.goal || '').trim();
  if (!goal || goal.length > 4000) throw Object.assign(new Error('Mission goal must be between 1 and 4000 characters'), { statusCode: 400 });
  const department = String(input.department || 'Operations').trim();
  if (!department || department.length > 120) throw Object.assign(new Error('Department is invalid'), { statusCode: 400 });
  const criteria = Array.isArray(input.acceptanceCriteria)
    ? input.acceptanceCriteria.map(v => typeof v === 'string' ? v.trim() : '').filter(Boolean).slice(0, 12)
    : [];
  if (!criteria.length || criteria.some(v => v.length > 500)) throw Object.assign(new Error('Provide 1–12 acceptance criteria, each no longer than 500 characters'), { statusCode: 400 });
  const risk = ['low', 'medium', 'high', 'critical'].includes(input.risk) ? input.risk : 'medium';
  const budget = Number(input.budget == null ? 0 : input.budget);
  if (!Number.isFinite(budget) || budget < 0 || budget > 1000000) throw Object.assign(new Error('Mission budget must be between 0 and 1000000'), { statusCode: 400 });

  const rawTasks = Array.isArray(input.steps) ? input.steps : [];
  if (rawTasks.length > 32) throw Object.assign(new Error('A mission may contain at most 32 Bot tasks'), { statusCode: 400 });
  const ids = new Set();
  const tasks = rawTasks.map((task, index) => {
    const id = String(task.id || 'task-' + (index + 1));
    const title = String(task.title || '').trim();
    const role = ROLES.has(task.role) ? task.role : 'Workflow Planner';
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(id) || ids.has(id)) throw Object.assign(new Error('Task identifiers must be unique and use letters, numbers, hyphens or underscores'), { statusCode: 400 });
    if (!title || title.length > 300) throw Object.assign(new Error('Each Bot task needs a title of at most 300 characters'), { statusCode: 400 });
    ids.add(id);
    return {
      id, title, role,
      dependsOn: Array.isArray(task.dependsOn) ? [...new Set(task.dependsOn.filter(v => typeof v === 'string').map(v => v.trim()))] : [],
      toolScopes: Array.isArray(task.toolScopes) ? [...new Set(task.toolScopes.filter(v => SCOPES.has(v)))] : ['read', 'draft'],
      maxAttempts: Number.isInteger(task.maxAttempts) ? Math.max(1, Math.min(4, task.maxAttempts)) : 2
    };
  });
  const byId = new Map(tasks.map(task => [task.id, task]));
  for (const task of tasks) for (const dep of task.dependsOn) {
    if (!byId.has(dep) || dep === task.id) throw Object.assign(new Error('Task dependency is unknown or self-referential: ' + dep), { statusCode: 400 });
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw Object.assign(new Error('Task dependencies contain a cycle at ' + id), { statusCode: 400 });
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of byId.get(id).dependsOn) visit(dep);
    visiting.delete(id); visited.add(id);
  }
  for (const task of tasks) visit(task.id);
  return {
    goal, department, risk, budget,
    budgetCurrency: /^[A-Z]{3}$/.test(String(input.budgetCurrency || 'USD')) ? String(input.budgetCurrency || 'USD') : 'USD',
    acceptanceCriteria: criteria, tasks
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    if (req.method === 'GET') {
      const rows = await db('missions?organization_id=eq.' + encodeURIComponent(member.organization_id) +
        '&select=id,goal,department,state,risk,budget,budget_currency,acceptance_criteria,created_at,updated_at,delivered_at&order=created_at.desc&limit=100');
      return send(res, 200, { missions: Array.isArray(rows) ? rows : [] });
    }

    const body = await readJson(req, 65536);
    const plan = validatePlan(body);
    const suppliedKey = String(req.headers['idempotency-key'] || body.idempotencyKey || '').trim();
    const idempotencyKey = suppliedKey ? suppliedKey : crypto.randomUUID();
    if (idempotencyKey.length > 100 || /[\r\n]/.test(idempotencyKey)) {
      return send(res, 400, { error: 'Idempotency-Key must be 1–100 characters without line breaks' });
    }
    const created = await db('rpc/create_mission_bundle', {
      method: 'POST',
      body: JSON.stringify({
        p_organization_id: member.organization_id,
        p_user_id: user.id,
        p_mission: {
          goal: plan.goal, department: plan.department, risk: plan.risk,
          budget: plan.budget, budgetCurrency: plan.budgetCurrency,
          acceptanceCriteria: plan.acceptanceCriteria
        },
        p_tasks: plan.tasks,
        p_idempotency_key: idempotencyKey
      })
    });
    const missionId = typeof created === 'string' ? created : (created && created.id) || (Array.isArray(created) && created[0]);
    if (!missionId) throw new Error('Mission was not persisted');
    await audit(member.organization_id, user.id, 'mission.created', 'mission', String(missionId), 'success', {
      task_count: plan.tasks.length, risk: plan.risk, idempotency_key: idempotencyKey
    });
    return send(res, 201, {
      missionId: String(missionId),
      state: 'awaiting_approval',
      idempotencyKey,
      taskCount: plan.tasks.length,
      nextAction: 'Approve the plan explicitly before it can enter the durable queue.',
      executionStatus: 'not_started'
    });
  } catch (error) {
    return safeError(res, error);
  }
};
