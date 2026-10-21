# Whilo agentic runtime and Linux desktop plan

Updated: 2026-10-19

## Product distinction: Pets are persistent, Bots are task-scoped

**Pets** are the durable, user-facing agents. Each Pet has an identity, purpose, persistent memory with user consent, approved skills, allowed integrations, a budget, operating policy and an accountable owner. Pets appear in the existing **Pets** area and can be discovered or configured through **Store**. A Pet is not simply a mascot or an LLM persona; it should own a domain and be evaluated on outcomes.

**Bots** are temporary specialist workers that a Pet can create for a mission. Examples include Browser Researcher, Computer Operator, Data Analyst, CRM Operator, Writer, Coder and QA Verifier. A Bot gets one constrained assignment, task-specific context, time/tool/token limits and a structured output contract. It does not inherit the Pet's full memory or credentials; credentials are resolved through a server-side, least-privilege capability. The Pet remains the accountable orchestrator, resolves disagreements and decides whether to ask the user.

The hierarchy is:

1. **User goal** — a desired business outcome, acceptance conditions and constraints.
2. **Mission Governor** — classifies risk, estimates cost, applies permissions and sets concurrency, time and spend limits.
3. **Pet lead** — owns the outcome, decomposes work and creates a dependency graph.
4. **Specialist Bots** — perform independent, bounded tasks in parallel where safe.
5. **Tools and Computer Runtime** — read or change business systems through explicit capabilities.
6. **Independent verifier** — tests the evidence against the acceptance conditions; does not blindly trust the workers.
7. **Approval and delivery** — consequential actions wait for a person; completed work includes sources, changes, exceptions and a receipt.

A multi-agent task is not more intelligent merely because it has more workers. Spawn a Bot only when parallelism or specialization improves expected quality enough to justify coordination cost. Use one Pet and one verifier for simple work; scale the graph for genuinely separable tasks.

## Implemented in the shared core

The shared `@whilo/agent-core` package now includes:
- mission state transitions and explicit approval gates;
- task dependency validation, including cycle rejection;
- ready-task selection that respects dependencies and a concurrency cap;
- executor-driven parallel waves through an injected provider callback;
- task attempt tracking, explicit failures and a bounded retry policy;
- evidence-required task completion and outcome verification helpers.

This is a reusable orchestration core, not a hosted agent by itself. The browser UI currently uses it to create and display plans, and to collect manual review notes. No production LLM adapter, browser/computer tool adapter, durable job worker or tenant-scoped database is wired to the UI yet. The next integration step is to run this core from an authenticated server-side job worker and inject adapters for one model provider and one real tool provider; the browser must never hold provider secrets.

## The runtime state machine

Every mission should have durable states:

`draft → planned → awaiting_approval → queued → running → verifying → awaiting_review → delivered`

Alternate terminal or recovery states are `blocked`, `failed`, `cancelled` and `needs_input`. Every transition records a timestamp, actor, reason and trace ID. Refreshes or deployments must not erase a job's status. Retried operations require idempotency keys. A timed-out computer action is treated as **unknown outcome** until a new screenshot/state check confirms what happened.

Each task includes:
- intent, scope and acceptance checks;
- owner Pet, specialist Bots and dependency graph;
- allowed tools and integration scopes;
- budget, deadline, retry policy and stop conditions;
- source evidence and structured result;
- verifier checks, human approval and final receipt.

The quality loop is **Observe → Plan → Act → Verify → Reflect → Recover**. Reflection may revise the plan, but it cannot silently widen permissions or spend limits. On repeated failure, stop and escalate instead of spinning in an agent loop.

## Real Computer Runtime — required behavior

A browser UI is not a virtual computer. A working cloud computer needs a live, isolated Linux session with:
- a lifecycle API to provision, wake, inspect health, reset and stop the session;
- a desktop/browser process, screen capture and input bridge;
- a tool interface for screenshots, viewport size, click, move, drag, type, keypress, scroll, open URL and scoped shell execution;
- a stable session identifier, owner/tenant boundary and persistent workspace policy;
- a streaming viewer for the person and a reconnect-safe event channel;
- allowlisted network egress, secret isolation, resource/time limits and audit records;
- a kill switch, visible “Take control” mode and recovery screenshots after uncertain actions.

**Current implementation status from the repository README:** the published web bundle describes `whilo-runtime.js` as a browser-local emulator for `/api/*` and `/api/events`, and explicitly says there is no backend yet and data is device-local. That is useful for UI development, but it does not prove a remote Linux computer exists or that an agent can control one from the web app. A real computer action must not be shown as successful until the server-side provider has returned evidence.

### Integration plan

1. Define a `ComputerProvider` interface behind the server, rather than coupling the UI to one vendor: `createSession`, `getStatus`, `screenshot`, `act`, `execScoped`, `streamEvents`, `suspend`, `resume`, `destroy`.
2. Implement one provider first; keep credentials server-side and never place them in JavaScript or localStorage.
3. Bind one session to one tenant and one task by default. Reuse a persistent session only when the user has opted into its storage and retention policy.
4. Apply schema validation to every tool call. Do not interpolate unvalidated coordinates or commands into a shell; use an argument array and fixed command allowlist for control operations.
5. After each interaction, confirm the observed state. After timeouts, capture a new screenshot before repeating non-idempotent actions.
6. Test the workflow end-to-end: provision → health check → screenshot → open a harmless page → interact → verify → persist artifact → stop/wake → verify state.
7. Only then expose “Computer ready” or “Agent is working on the computer” as a positive UI state.

A production serverless web deployment alone is not the long-running VM. It can host the UI and control API, but computer sessions must be managed by a persistent service/provider and isolated runtime.

## Linux desktop product

The Linux desktop release should reuse the same agent core, mission state machine, computer provider contract and permissions as web. Do not create a second, divergent agent brain.

The fastest path is a **Whilo-branded Electron desktop client** based on the existing Node-capable desktop shell in the upstream foundation. This is preferable to wrapping the static page in a new shell because the desktop needs a trusted main process, local storage, platform APIs and a controlled bridge to the agent runtime.

Desktop rollout gates:
1. Rebrand app/window/menu/package metadata and icons to Whilo.
2. Bundle the desktop shell and local API/runtime; keep secrets in the OS-appropriate credential store.
3. Build and test Ubuntu 24.04 x86_64 `.deb` and AppImage artifacts, with checksums and signed release metadata.
4. Keep local screen preview separate from permission to control input. Never start capture or control merely because the app opens.
5. Gate Linux local-control features by session type. Validate Xorg input separately; where Wayland portal/input safety is not proven, stay view-only and fail closed.
6. Test clean install, upgrade, uninstall, fresh account, sign-in, routine execution, computer reconnect, suspend/resume, and crash recovery.
7. Publish a supported-platform matrix and release notes; do not market an untested ARM64 build as supported.

## Business alignment: build the operating service

The near-term commercial offer should be a bounded, paid service that already has a budget line—start by testing one revenue-operations workflow for B2B service companies. Whilo can own prospect research, CRM hygiene, campaign preparation and follow-up drafts; external sends, purchases, access changes and financial/legal commitments remain gated until quality and permissions are proven.

Only expand into support, finance, recruiting, IT and procurement after the first workflow demonstrates paid retention, accepted work, measurable customer value and positive contribution margin. An enterprise feature is not complete until it has a real connector, audit log, permission model, retry path, error state and acceptance test.

## Go/no-go metrics

- first-review acceptance rate and human rework rate;
- p50/p95 time to an accepted deliverable;
- cost per accepted outcome and gross margin after human review;
- percent of actions backed by inspectable source evidence;
- exception and failed-recovery rates;
- repeat usage, renewal and expansion;
- customer-verified outcomes with explicit attribution rules.

The north star should be **verified, customer-accepted outcomes per account per week at target margin**, not bot count, agent calls, token usage or demo complexity.
