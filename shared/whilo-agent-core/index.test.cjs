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
  assert.throws(() => core.createMission({goal:"Test",steps:[{id:"a",dependsOn:["missing"]}]}), /Unknown dependency/);
  assert.throws(() => core.createMission({goal:"Test",steps:[{id:"same"},{id:"same"}]}), /unique/);
});

test("a mission cannot skip approval before it enters the execution queue", () => {
  const mission = core.createMission({ goal:"Test" });
  const planned = core.transitionMission(mission, "planned", "pet", "Plan ready");
  assert.throws(() => core.transitionMission(planned, "queued", "runtime", "skip approval"), /approval is required/);
  const waiting = core.transitionMission(planned, "awaiting_approval", "governor", "Awaiting owner");
  const queued = core.approveMission(waiting, {approved:true, approver:"owner", reason:"Approved scope and spend"});
  assert.equal(queued.state, "queued");
  assert.equal(queued.approvals[0].scope, "execute_mission");
  const running = core.transitionMission(queued, "running", "runtime", "Worker claimed mission");
  assert.equal(running.state, "running");
});

test("high-impact actions fail closed without scoped capability and explicit approval", () => {
  const missing = core.evaluateAction({action:"external_send",scopes:["read"],budgetRemaining:10,estimatedCost:1});
  assert.equal(missing.allowed,false);
  assert.match(missing.reason,/Missing required capability/);
  const noApproval = core.evaluateAction({action:"external_send",scopes:["external_send"],budgetRemaining:10,estimatedCost:1});
  assert.equal(noApproval.allowed,false);
  const approved = core.evaluateAction({action:"external_send",scopes:["external_send"],approved:true,budgetRemaining:10,estimatedCost:1});
  assert.equal(approved.allowed,true);
});

test("internal draft creation is allowed only with draft capability and not mistaken for send", () => {
  assert.equal(core.evaluateAction({action:"external_draft",scopes:["draft"],budgetRemaining:2,estimatedCost:1}).allowed,true);
  assert.equal(core.evaluateAction({action:"external_draft",scopes:[],budgetRemaining:2,estimatedCost:1}).allowed,false);
});

test("delivery requires every named acceptance criterion and evidence", () => {
  const criteria = ["Data is correct","Sources are attached"];
  const mission = core.createMission({goal:"Verify report",acceptanceCriteria:criteria});
  const partial = core.verifyOutcome({acceptanceCriteria:criteria,checks:[{name:criteria[0],passed:true,evidence:"Report hash 123"}]});
  assert.equal(partial.passed,false);
  assert.equal(partial.passedCount,1);
  assert.throws(() => core.transitionMission(Object.assign({},mission,{state:"awaiting_review"}),"delivered","user","unchecked"),/verification passes/);
  const complete = core.verifyOutcome({acceptanceCriteria:criteria,checks:[
    {name:criteria[0],passed:true,evidence:"Report hash 123"},
    {name:criteria[1],passed:true,evidence:"Source manifest"}
  ]});
  assert.equal(complete.passed,true);
});

test("rejects dependency cycles before a mission can be scheduled", () => {
  assert.throws(() => core.createMission({
    goal: "Cyclic plan",
    steps: [
      { id: "a", title: "A", dependsOn: ["b"] },
      { id: "b", title: "B", dependsOn: ["a"] }
    ]
  }), /contain a cycle/);
});

test("scheduler only releases dependency-ready tasks within the parallelism limit", () => {
  let mission = core.createMission({
    id: "scheduler",
    goal: "Run a bounded workflow",
    steps: [
      { id: "research", role: "Browser Researcher", title: "Research" },
      { id: "analysis", role: "Data Analyst", title: "Analyze", dependsOn: ["research"] },
      { id: "verify", role: "QA Verifier", title: "Verify", dependsOn: ["analysis"] }
    ]
  });
  mission = core.transitionMission(mission, "planned", "pet", "Plan created");
  mission = core.transitionMission(mission, "awaiting_approval", "governor", "Approval needed");
  mission = core.approveMission(mission, { approved: true, approver: "owner" });
  mission = core.transitionMission(mission, "running", "runtime", "Runtime started");
  assert.deepEqual(core.getReadyTasks(mission, 2).map(t => t.id), ["research"]);
  mission = core.startTask(mission, "research", "runtime", 2);
  assert.deepEqual(core.getReadyTasks(mission, 2).map(t => t.id), []);
  assert.throws(() => core.startTask(mission, "analysis", "runtime", 2), /dependencies are not complete/);
  mission = core.completeTask(mission, "research", { output: "Two accounts match the ICP", evidence: ["https://example.com/accounts"] }, "browser-bot");
  assert.deepEqual(core.getReadyTasks(mission, 2).map(t => t.id), ["analysis"]);
  assert.equal(mission.tasks[0].status, "completed");
  assert.equal(mission.evidence[0], "https://example.com/accounts");
});

test("task completion requires inspectable evidence and retry limits stop loops", () => {
  let mission = core.createMission({ goal: "Recover a failed task", steps: [{ id: "work", title: "Work" }] });
  mission = core.transitionMission(mission, "planned", "pet", "Plan created");
  mission = core.transitionMission(mission, "awaiting_approval", "governor", "Approval needed");
  mission = core.approveMission(mission, { approved: true });
  mission = core.transitionMission(mission, "running", "runtime", "Started");
  mission = core.startTask(mission, "work", "bot");
  assert.throws(() => core.completeTask(mission, "work", { output: "Finished", evidence: [] }, "bot"), /at least one evidence/);
  mission = core.failTask(mission, "work", "Provider timeout", "bot");
  mission = core.retryTask(mission, "work", 2);
  mission = core.startTask(mission, "work", "bot");
  mission = core.failTask(mission, "work", "Provider timeout again", "bot");
  assert.throws(() => core.retryTask(mission, "work", 2), /retry limit/);
});
