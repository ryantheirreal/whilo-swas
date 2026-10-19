"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("./index.cjs");

test("creates a Pet-led mission with specialist Bots as bounded tasks", () => {
  const mission = core.createMission({
    id: "m-1",
    goal: "Prepare a qualified account list",
    ownerPet: "Whilo",
    department: "Revenue",
    acceptanceCriteria: ["List contains target-fit accounts", "Source evidence is included"],
    steps: [
      { id: "research", role: "Browser Researcher", title: "Research accounts" },
      { id: "verify", role: "QA Verifier", title: "Verify fit and sources", dependsOn: ["research"] }
    ]
  });
  assert.equal(mission.ownerPet, "Whilo");
  assert.equal(mission.tasks[0].role, "Browser Researcher");
  assert.equal(mission.tasks[1].dependsOn[0], "research");
  assert.equal(mission.state, "draft");
});

test("rejects missing dependencies and duplicate IDs", () => {
  assert.throws(() => core.createMission({
    goal: "Test",
    steps: [{ id: "a", dependsOn: ["missing"] }]
  }), /Unknown dependency/);
  assert.throws(() => core.createMission({
    goal: "Test",
    steps: [{ id: "same" }, { id: "same" }]
  }), /unique/);
});

test("mission state machine rejects skipped execution stages", () => {
  const mission = core.createMission({ goal: "Test" });
  assert.throws(() => core.transitionMission(mission, "delivered", "user", "skip"), /Invalid mission transition/);
  const planned = core.transitionMission(mission, "planned", "pet", "Plan ready");
  const queued = core.transitionMission(planned, "queued", "user", "Approved plan");
  const running = core.transitionMission(queued, "running", "runtime", "Worker claimed mission");
  assert.equal(running.state, "running");
});

test("high-impact actions fail closed without scoped capability and explicit approval", () => {
  const missing = core.evaluateAction({ action: "external_send", scopes: ["read"], budgetRemaining: 10, estimatedCost: 1 });
  assert.equal(missing.allowed, false);
  assert.match(missing.reason, /Missing required capability/);
  const noApproval = core.evaluateAction({ action: "external_send", scopes: ["external_send"], budgetRemaining: 10, estimatedCost: 1 });
  assert.equal(noApproval.allowed, false);
  const approved = core.evaluateAction({ action: "external_send", scopes: ["external_send"], approved: true, budgetRemaining: 10, estimatedCost: 1 });
  assert.equal(approved.allowed, true);
});

test("verification requires every named criterion and evidence", () => {
  const acceptanceCriteria = ["Data is correct", "Sources are attached"];
  const partial = core.verifyOutcome({
    acceptanceCriteria,
    checks: [{ name: "Data is correct", passed: true, evidence: "Report hash 123" }]
  });
  assert.equal(partial.passed, false);
  assert.equal(partial.passedCount, 1);
  const complete = core.verifyOutcome({
    acceptanceCriteria,
    checks: [
      { name: "Data is correct", passed: true, evidence: "Report hash 123" },
      { name: "Sources are attached", passed: true, evidence: "Source manifest" }
    ]
  });
  assert.equal(complete.passed, true);
});
