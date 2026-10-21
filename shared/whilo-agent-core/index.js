(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhiloAgentCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MISSION_STATES = Object.freeze([
    "draft", "planned", "awaiting_approval", "queued", "running", "verifying",
    "awaiting_review", "delivered", "needs_input", "blocked", "failed", "cancelled"
  ]);
  const TERMINAL = new Set(["delivered", "cancelled"]);
  const TRANSITIONS = Object.freeze({
    draft: ["planned", "cancelled"],
    planned: ["awaiting_approval", "queued", "blocked", "cancelled"],
    awaiting_approval: ["queued", "blocked", "cancelled"],
    queued: ["running", "blocked", "cancelled"],
    running: ["verifying", "needs_input", "blocked", "failed", "cancelled"],
    verifying: ["awaiting_review", "delivered", "needs_input", "blocked", "failed"],
    awaiting_review: ["delivered", "queued", "blocked", "cancelled"],
    needs_input: ["planned", "queued", "cancelled"],
    blocked: ["planned", "cancelled"],
    failed: ["planned", "cancelled"],
    delivered: [],
    cancelled: []
  });

  const PETS = Object.freeze(["Whilo", "Fynn", "Nori", "Capuccino", "Ollie", "Pico"]);
  const SPECIALIST_ROLES = Object.freeze([
    "Browser Researcher", "Computer Operator", "Data Analyst", "CRM Operator",
    "Writer", "Coder", "Workflow Planner", "QA Verifier"
  ]);

  const ACTION_POLICY = Object.freeze({
    read: { risk: "low", approval: "never", defaultScopes: ["read"] },
    internal_draft: { risk: "low", approval: "never", defaultScopes: ["draft"] },
    external_draft: { risk: "medium", approval: "never", defaultScopes: ["draft"] },
    external_send: { risk: "high", approval: "always", defaultScopes: ["external_send"] },
    purchase: { risk: "critical", approval: "always", defaultScopes: ["purchase"] },
    financial_commitment: { risk: "critical", approval: "always", defaultScopes: ["finance_commit"] },
    destructive_change: { risk: "critical", approval: "always", defaultScopes: ["delete", "admin"] },
    permission_change: { risk: "critical", approval: "always", defaultScopes: ["admin"] },
    computer_control: { risk: "high", approval: "per_policy", defaultScopes: ["computer_control"] }
  });

  function assertString(value, name, maxLength) {
    if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
      throw new TypeError(name + " must be a non-empty string of at most " + maxLength + " characters");
    }
    return value.trim();
  }

  function cleanList(value, defaultValue) {
    const list = Array.isArray(value) ? value : defaultValue || [];
    return [...new Set(list.filter(x => typeof x === "string" && x.trim()).map(x => x.trim()))];
  }

  function createMission(input) {
    if (!input || typeof input !== "object") throw new TypeError("Mission input is required");
    const goal = assertString(input.goal, "goal", 2000);
    const ownerPet = PETS.includes(input.ownerPet) ? input.ownerPet : "Whilo";
    const department = typeof input.department === "string" ? input.department.trim().slice(0, 120) : "Operations";
    const acceptanceCriteria = cleanList(input.acceptanceCriteria, [
      "The requested deliverable is present",
      "Claims are supported by evidence",
      "Exceptions and limitations are disclosed"
    ]);
    if (acceptanceCriteria.length === 0) throw new TypeError("At least one acceptance criterion is required");
    const specialistTasks = Array.isArray(input.steps) ? input.steps : [];
    const seenIds = new Set();
    const tasks = specialistTasks.map((step, index) => {
      const role = SPECIALIST_ROLES.includes(step.role) ? step.role : "Workflow Planner";
      const title = assertString(step.title || (role + " task " + (index + 1)), "step.title", 300);
      const id = String(step.id || ("task-" + (index + 1)));
      if (seenIds.has(id)) throw new TypeError("Task identifiers must be unique");
      seenIds.add(id);
      return {
        id,
        title,
        role,
        status: "queued",
        dependsOn: cleanList(step.dependsOn, []),
        inputContract: cleanList(step.inputContract, []),
        outputContract: cleanList(step.outputContract, ["Structured result with source evidence"]),
        toolScopes: cleanList(step.toolScopes, ["read", "draft"]),
        acceptanceCriteria: cleanList(step.acceptanceCriteria, ["Output matches the task contract", "Evidence is included"]),
        attempt: 0,
        result: null,
        error: null
      };
    });
    for (const task of tasks) {
      for (const dep of task.dependsOn) {
        if (!seenIds.has(dep)) throw new TypeError("Unknown dependency '" + dep + "' for " + task.id);
        if (dep === task.id) throw new TypeError("A task cannot depend on itself");
      }
    }
    const taskById = new Map(tasks.map(task => [task.id, task]));
    const visiting = new Set();
    const visited = new Set();
    function visitTask(id) {
      if (visiting.has(id)) throw new TypeError("Task dependencies contain a cycle at '" + id + "'.");
      if (visited.has(id)) return;
      visiting.add(id);
      for (const dependency of taskById.get(id).dependsOn) visitTask(dependency);
      visiting.delete(id);
      visited.add(id);
    }
    for (const task of tasks) visitTask(task.id);
    const now = new Date().toISOString();
    return {
      id: String(input.id || "mission-" + Date.now().toString(36)),
      goal,
      department,
      ownerPet,
      state: "draft",
      risk: ["low", "medium", "high", "critical"].includes(input.risk) ? input.risk : "medium",
      executionMode: input.executionMode === "pet_only" ? "pet_only" : "pet_with_bots",
      acceptanceCriteria,
      budget: Number.isFinite(input.budget) && input.budget >= 0 ? input.budget : 0,
      budgetCurrency: typeof input.budgetCurrency === "string" ? input.budgetCurrency : "USD",
      approvalRequired: input.approvalRequired !== false,
      tasks,
      evidence: [],
      approvals: [],
      events: [{ state: "draft", at: now, reason: "Mission created" }],
      createdAt: now,
      updatedAt: now,
      deliveredAt: null
    };
  }

  function getReadyTasks(mission, maxParallelism) {
    if (!mission || mission.state !== "running") return [];
    const limit = Number.isInteger(maxParallelism) ? Math.max(1, Math.min(32, maxParallelism)) : 3;
    const tasks = Array.isArray(mission.tasks) ? mission.tasks : [];
    const running = tasks.filter(task => task.status === "running").length;
    const slots = Math.max(0, limit - running);
    if (!slots) return [];
    return tasks.filter(task =>
      task.status === "queued" &&
      task.dependsOn.every(id => tasks.some(candidate => candidate.id === id && candidate.status === "completed"))
    ).slice(0, slots).map(task => Object.assign({}, task));
  }

  function startTask(mission, taskId, actor, maxParallelism) {
    if (!mission || mission.state !== "running") throw new Error("The mission must be running before a Bot task can start.");
    const task = (mission.tasks || []).find(candidate => candidate.id === taskId);
    if (!task) throw new Error("Unknown task: " + taskId);
    if (task.status !== "queued") throw new Error("Only queued tasks can be started.");
    if (!task.dependsOn.every(id => mission.tasks.some(candidate => candidate.id === id && candidate.status === "completed"))) {
      throw new Error("Task dependencies are not complete.");
    }
    const limit = Number.isInteger(maxParallelism) ? Math.max(1, Math.min(32, maxParallelism)) : 3;
    if (mission.tasks.filter(candidate => candidate.status === "running").length >= limit) {
      throw new Error("Mission parallelism limit reached.");
    }
    const at = new Date().toISOString();
    const tasks = mission.tasks.map(candidate => candidate.id === taskId
      ? Object.assign({}, candidate, { status: "running", attempt: candidate.attempt + 1, startedAt: at, error: null })
      : candidate);
    return Object.assign({}, mission, {
      tasks,
      updatedAt: at,
      events: (mission.events || []).concat([{ type: "task_started", taskId, actor: typeof actor === "string" ? actor.slice(0,160) : "runtime", at }])
    });
  }

  function completeTask(mission, taskId, result, actor) {
    if (!mission || mission.state !== "running") throw new Error("The mission must be running before a task can complete.");
    const task = (mission.tasks || []).find(candidate => candidate.id === taskId);
    if (!task || task.status !== "running") throw new Error("Only a running task can be completed.");
    const input = result && typeof result === "object" ? result : {};
    const output = assertString(input.output, "result.output", 20000);
    const evidence = cleanList(input.evidence, []);
    if (!evidence.length) throw new Error("A Bot result needs at least one evidence item before it can be accepted.");
    const at = new Date().toISOString();
    const tasks = mission.tasks.map(candidate => candidate.id === taskId
      ? Object.assign({}, candidate, { status: "completed", completedAt: at, result: { output, evidence, artifactUri: typeof input.artifactUri === "string" ? input.artifactUri.slice(0,2000) : null }, error: null })
      : candidate);
    return Object.assign({}, mission, {
      tasks,
      evidence: cleanList([...(mission.evidence || []), ...evidence], []),
      updatedAt: at,
      events: (mission.events || []).concat([{ type: "task_completed", taskId, actor: typeof actor === "string" ? actor.slice(0,160) : "runtime", at, evidenceCount: evidence.length }])
    });
  }

  function failTask(mission, taskId, error, actor) {
    if (!mission || mission.state !== "running") throw new Error("The mission must be running before a task can fail.");
    const task = (mission.tasks || []).find(candidate => candidate.id === taskId);
    if (!task || task.status !== "running") throw new Error("Only a running task can fail.");
    const at = new Date().toISOString();
    const message = typeof error === "string" ? error.slice(0,1000) : "Task failed without a diagnostic.";
    const tasks = mission.tasks.map(candidate => candidate.id === taskId
      ? Object.assign({}, candidate, { status: "failed", error: message, failedAt: at })
      : candidate);
    return Object.assign({}, mission, {
      tasks,
      updatedAt: at,
      events: (mission.events || []).concat([{ type: "task_failed", taskId, actor: typeof actor === "string" ? actor.slice(0,160) : "runtime", at, error: message }])
    });
  }

  function retryTask(mission, taskId, maxAttempts) {
    if (!mission || mission.state !== "running") throw new Error("The mission must be running before a task can be retried.");
    const task = (mission.tasks || []).find(candidate => candidate.id === taskId);
    const cap = Number.isInteger(maxAttempts) ? Math.max(1, Math.min(10, maxAttempts)) : 2;
    if (!task || task.status !== "failed") throw new Error("Only failed tasks can be retried.");
    if (task.attempt >= cap) throw new Error("Task retry limit reached; escalate instead of looping.");
    const at = new Date().toISOString();
    const tasks = mission.tasks.map(candidate => candidate.id === taskId
      ? Object.assign({}, candidate, { status: "queued", error: null, failedAt: null })
      : candidate);
    return Object.assign({}, mission, {
      tasks,
      updatedAt: at,
      events: (mission.events || []).concat([{ type: "task_requeued", taskId, at, attempt: task.attempt + 1 }])
    });
  }

  function transitionMission(mission, nextState, actor, reason) {
    if (!mission || !MISSION_STATES.includes(mission.state)) throw new TypeError("Invalid mission");
    if (!MISSION_STATES.includes(nextState)) throw new TypeError("Invalid target state");
    if (TERMINAL.has(mission.state)) throw new Error("Terminal missions cannot transition");
    if (nextState === "queued" && mission.approvalRequired && !(Array.isArray(mission.approvals) && mission.approvals.some(a => a && a.scope === "execute_mission" && a.approved === true))) {
      throw new Error("Mission approval is required before queueing execution.");
    }
    if (nextState === "delivered" && !(mission.verification && mission.verification.passed === true)) {
      throw new Error("A mission cannot be delivered until outcome verification passes with evidence.");
    }
    if (!TRANSITIONS[mission.state].includes(nextState)) {
      throw new Error("Invalid mission transition: " + mission.state + " -> " + nextState);
    }
    const at = new Date().toISOString();
    const next = Object.assign({}, mission, {
      state: nextState,
      updatedAt: at,
      deliveredAt: nextState === "delivered" ? at : mission.deliveredAt,
      events: (Array.isArray(mission.events) ? mission.events : []).concat([{
        state: nextState,
        at,
        actor: typeof actor === "string" ? actor.slice(0, 160) : "system",
        reason: typeof reason === "string" ? reason.slice(0, 1000) : ""
      }])
    });
    return next;
  }


  function approveMission(mission, decision) {
    if (!mission || mission.state !== "awaiting_approval") throw new Error("Mission is not awaiting approval.");
    const input = decision && typeof decision === "object" ? decision : {};
    const approval = {
      scope: "execute_mission",
      approved: input.approved === true,
      approver: typeof input.approver === "string" ? input.approver.slice(0, 160) : "user",
      reason: typeof input.reason === "string" ? input.reason.slice(0, 1000) : "",
      at: new Date().toISOString()
    };
    const next = Object.assign({}, mission, { approvals: (Array.isArray(mission.approvals) ? mission.approvals : []).concat([approval]) });
    if (approval.approved !== true) {
      return transitionMission(next, "blocked", approval.approver, approval.reason || "Mission was not approved.");
    }
    return transitionMission(next, "queued", approval.approver, approval.reason || "Mission execution approved.");
  }

  function evaluateAction(input) {
    const action = input && typeof input.action === "string" ? input.action : "";
    const policy = ACTION_POLICY[action];
    if (!policy) return { allowed: false, requiresApproval: true, risk: "critical", reason: "Unknown actions fail closed." };
    const scopes = cleanList(input.scopes, []);
    const budgetRemaining = Number.isFinite(input.budgetRemaining) ? input.budgetRemaining : 0;
    const estimatedCost = Number.isFinite(input.estimatedCost) && input.estimatedCost >= 0 ? input.estimatedCost : Infinity;
    const missing = policy.defaultScopes.filter(scope => !scopes.includes(scope));
    if (missing.length) {
      return { allowed: false, requiresApproval: true, risk: policy.risk, reason: "Missing required capability scopes: " + missing.join(", ") };
    }
    if (estimatedCost > budgetRemaining) {
      return { allowed: false, requiresApproval: true, risk: policy.risk, reason: "Action exceeds the remaining mission budget." };
    }
    const explicitApproval = input.approved === true;
    const approvalRequired = policy.approval === "always"
      || policy.approval === "before_send"
      || (policy.approval === "per_policy" && input.policyAllowsComputerControl !== true);
    if (approvalRequired && !explicitApproval) {
      return { allowed: false, requiresApproval: true, risk: policy.risk, reason: "Human approval is required before this action." };
    }
    if (action === "computer_control" && input.policyAllowsComputerControl !== true) {
      return { allowed: false, requiresApproval: true, risk: policy.risk, reason: "Computer control is not enabled by the current policy." };
    }
    return { allowed: true, requiresApproval: false, risk: policy.risk, reason: "Policy checks passed for the declared scopes and budget." };
  }

  function verifyOutcome(input) {
    const criteria = cleanList(input && input.acceptanceCriteria, []);
    const checks = Array.isArray(input && input.checks) ? input.checks : [];
    if (!criteria.length) return { passed: false, reason: "No acceptance criteria were defined.", passedCount: 0, total: 0 };
    const byName = new Map(checks.filter(c => c && typeof c.name === "string").map(c => [c.name, c]));
    const results = criteria.map(name => {
      const check = byName.get(name);
      const evidence = check && typeof check.evidence === "string" ? check.evidence.trim() : "";
      const passed = !!(check && check.passed === true && evidence);
      return { criterion: name, passed, evidence: evidence || null };
    });
    return {
      passed: results.every(r => r.passed),
      passedCount: results.filter(r => r.passed).length,
      total: results.length,
      results,
      reason: results.every(r => r.passed)
        ? "Every acceptance criterion passed with evidence."
        : "Delivery is blocked until every acceptance criterion passes with evidence."
    };
  }

  function createReceipt(mission, verification) {
    if (!mission || typeof mission !== "object") throw new TypeError("Mission is required");
    const checks = verification || { passed: false, reason: "No verification was supplied." };
    return {
      missionId: mission.id,
      goal: mission.goal,
      ownerPet: mission.ownerPet,
      finalState: mission.state,
      createdAt: mission.createdAt,
      deliveredAt: mission.deliveredAt,
      taskCount: Array.isArray(mission.tasks) ? mission.tasks.length : 0,
      evidence: cleanList(mission.evidence, []),
      verification: {
        passed: checks.passed === true,
        passedCount: checks.passedCount || 0,
        total: checks.total || 0,
        reason: checks.reason || "Verification status not established"
      },
      eventCount: Array.isArray(mission.events) ? mission.events.length : 0
    };
  }

  return Object.freeze({
    MISSION_STATES, TERMINAL, TRANSITIONS, PETS, SPECIALIST_ROLES,
    createMission, transitionMission, approveMission, evaluateAction, verifyOutcome, createReceipt,
    getReadyTasks, startTask, completeTask, failTask, retryTask
  });
});
