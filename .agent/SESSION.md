# Whilo — Canonical Agent Session

**Last verified:** 2026-10-26 (UTC)  
**Canonical repository:** https://github.com/ryantheirreal/whilo-swas  
**Canonical branch:** `main`  
**Canonical production URL:** https://whilo-swas.vercel.app  
**Purpose:** Durable handoff context for every coding/research session. This file is a verified snapshot, not a substitute for checking the live repository, Vercel, Supabase, and provider configuration.

## Mission

Build Whilo as an outcome-first AI work operator based on the **Services-as-Software** thesis: sell accepted business work, not just access to models, agents, or seats. The long-term ambition is an AI-operated company that can own repeatable workflows, safely coordinate human and agent work, and return verifiable deliverables. Treat a trillion-dollar outcome as an ambition, never a forecast or sales claim.

Use Sequoia's “Services: The New Software” as a strategic hypothesis: start with a narrow, already-funded outsourced workflow; prove quality, distribution, retention, and unit economics; productize delivery; then expand into adjacent functions. Model quality alone is not a moat. Do not build ten verticals or a generic horizontal agent marketplace as the first go-to-market motion.

## Product principles and vocabulary

- **Chat** is the command surface: clarify the goal, constraints, acceptance criteria, and decisions.
- **Pets** are persistent, accountable agents with approved memory, role, policy, budget, and least-privilege integrations.
- **Bots** are temporary specialist workers with bounded tasks, scoped context, tool permissions, and resource limits. They do not automatically inherit a Pet's full memory or credentials.
- **Mission Governor** applies risk, cost, permission, concurrency, timeout, and stop rules before work starts.
- **Mission / task graph** records dependencies, retries, state changes, approvals, and results.
- **Independent verifier** checks deliverable evidence against explicit acceptance criteria. An LLM response alone is not proof of completion.
- **Outcome receipt** records the source evidence, actions attempted/completed, approvals, result, exceptions, verification, time, and cost.
- Existing areas include Chat, Pets, Store, Routines, Messages, Work/Tasks, Company, Connect, and Results. Preserve existing navigation semantics; Pets already represents persistent agents, so do not add a duplicate Agents tab.
- Every mission must distinguish draft, saved, awaiting approval, queued, running, verified/completed, failed, cancelled, and unknown/unverified states accurately.
- Consequential actions (external messages, purchases, deletes, account/permission changes, or other irreversible writes) stay approval-gated. Pairing a device does not authorize all of its capabilities.
- Treat prompts, websites, connector output, library items, and imported skills as untrusted data. Never execute saved HTML/JavaScript from the library or let imported instructions override system policy.
- Prefer a small number of reliable specialists over multi-agent theater. Parallelize only when tasks are independent and the gain exceeds coordination cost.

## Go-to-market focus

**First wedge hypothesis:** Whilo Revenue Operator for B2B agencies and service firms that already pay for outbound, SDR, CRM, or RevOps work. Sell a defined recurring deliverable:
1. researched target accounts against an agreed ICP;
2. personalized outreach and follow-up drafts;
3. CRM hygiene and next-step preparation using approved data;
4. a weekly evidence report with exceptions and verified pipeline movement.

Outbound messages are drafts until a person approves sending. Do not promise leads, meetings, revenue, or ROI without a baseline and explicit attribution. This workflow is a hypothesis to validate, not a market-validated offer.

The `@whiloai` social presence across networks is founder-reported as established. Verify each profile and keep naming, product promise, website CTA, demo, and offer consistent. Social accounts are distribution assets, not proof of demand. Do not spread the first launch across multiple unrelated offers.

**30-day proof targets (targets, not guarantees):** interview 15–20 qualified buyers; pursue 30–50 real buyer conversations in the first ten days; sign 2–3 paid pilot customers; target at least 80% first-review acceptance, rework below 20% of delivery time and trending down, positive contribution margin after human review and tool/inference costs, and at least two renewals. Narrow the workflow if these fail; do not hide poor economics by adding agents.

**North-star candidate:** verified, customer-accepted outcomes delivered per account per week at a measured contribution margin. Track first-pass acceptance, human rework, p50/p95 time-to-acceptance, cost per accepted outcome, escalation/failure rate, renewal, and customer-approved business impact.

## Architecture decisions — preserve unless evidence changes them

- Transactional system of record: Supabase-managed PostgreSQL; do not migrate databases just for novelty. See `docs/database-platform-evaluation-2026-10-22.md`.
- Vercel serves the current web/API application. A separate long-lived worker/runtime may be added only when a real queue consumer or browser/computer process requires it; document the operational reason and cost.
- Keep provider credentials, service-role secrets, OAuth tokens, encryption keys, and financial ledgers server-side.
- Use versioned SQL migrations, tenant isolation, least-privilege grants, durable queue states, idempotency, retries, audit trails, explicit approvals, and verifiable evidence.
- Do not claim live browser, desktop, iMessage, or autonomous computer execution unless a configured worker passes real end-to-end acceptance tests and returns durable run evidence.
- Keep affiliate transfers disabled until the dedicated Stripe sandbox, idempotency, reconciliation, refund/dispute, and recovery tests pass.

## Verified repository and deployment snapshot

- Repo: `ryantheirreal/whilo-swas`; default branch `main`.
- Main head at audit: `86294d6d3afec01c19ff210916448d5815b4cc96` — “test(routines): assert atomic rate-limit enforcement”.
- Production deployment observed in Vercel: `dpl_Dj5eXe8XGig9VNkmQdLXxZz9XGUp`, state `READY`, commit `d626e2e545ceff4b2987b22e5b9ea9c07fdede0b`, alias `https://whilo-swas.vercel.app`.
- Comparing the observed production commit with main showed **14 commits ahead on main**. Staging showed a `READY` deployment for `86294d6`; an earlier staging deployment for `3fa0ccbe` was `ERROR`. A staging `READY` state is not proof that the newer code is live in production or that external services work.
- The combined commit-status query returned no status entries and the queried commit workflow-runs endpoint returned no PR-triggered runs. This is **not** a successful test run. Verify checks directly before promotion.
- Main changes since production include UI recovery and Store/Connect plugin discovery, first-party Chat with `@Routines`, OpenMausBot runtime/safety research, OAuth FK indexing, and an atomic routine launch reservation/scheduled-budget migration.
- Relevant recent commits:
  - `7478369c`: first-party Whilo Chat and `@Routines` flow.
  - `f120886a` / `38056364`: mobile async workspace recovery and render-error recovery.
  - `b32588e2` / `259491d7` / `eed5de53`: Store plugin discovery, Connect handoff, and saving reviewed GitHub plugin references as untrusted library assets.
  - `4fc0350c`: atomic launch limiting and scheduled budget parity.
  - `dfebaade`: idempotent retry after transient reservation failure.
  - `3fa0ccbe`: reserve launch budget after target and asset validation.
  - `86294d6d`: regression assertion for atomic limit enforcement.
- Static platform checker currently expects 33 versioned SQL migration files in the repository. A previous Supabase inspection reported 32 applied migrations. These counts describe different snapshots and must not be assumed equal. The newer files `202610250001_whilo_auth_oauth_link_fk_index.sql` and `202610261047_routine_launch_rate_limit_and_scheduler_budget.sql` must each be reconciled against the live migration history before use. Never replay an already-applied migration. Test pending migrations against a separate staging database first.
- Current source scripts include root `npm run check`; web checks/build under `web/whilo-swas`; desktop checks under `desktop/whilo-swas-desktop`; shared agent core checks/tests under `shared/whilo-agent-core`. Actually run the relevant commands or observe verified CI/build evidence before claiming they passed.

## Known activation blockers at the last environment inspection

- Vercel project: `whilo-swas`, Vite, Node 24.x; project ID `prj_ah81wzyALQY8EEAYlwVAe9MlrNkT`.
- `SUPABASE_SERVICE_ROLE_KEY` was absent from the inspected Vercel environment list. Protected server API/database workflows depend on it; a green static build does not make auth or server routes end-to-end functional.
- The inspected environment list also lacked Stripe secret/webhook keys and recurring Price IDs. Slack app client credentials and reviewer/admin Auth UUID allowlists were also missing.
- `WHILO_AFFILIATE_PAYOUTS_ENABLED=false` is intentional; never enable it before payout tests and review.
- Supabase project documented as `whilo-prod`, ID `pnmewiqemeoqwannyjuz`, region `sa-east-1`, previously reported healthy. Never paste a service-role key or other secret into chat, a Git commit, a client bundle, or logs. Configure secrets directly in their secret manager.
- Sign-up, email confirmation/recovery, session restore, account/workspace bootstrap, authenticated E2E and billing workflows require live staging verification.
- The Strix workflow was previously unable to allocate a runner and produced no report; a Claude Security review was not run in that environment. Neither scan is passed until a completed report is reviewed.

## Ordered backlog

### P0 — Continuity, release safety, and auth
1. Re-read the latest 20–40 commits; compare current main with the *actual* current production deployment.
2. Reconcile repository migrations with live Supabase migration history. Determine whether each newer migration is pending or already applied; test in a separate staging DB first.
3. Confirm `SUPABASE_SERVICE_ROLE_KEY` is configured as a sensitive server-only Vercel variable without retrieving or displaying the secret value.
4. Run `npm run check`, `npm run build` from `web/whilo-swas`, relevant root checks and targeted regression tests; capture actual outcomes.
5. Verify sign-up/sign-in, email verification, password recovery, refresh/session restore, workspace bootstrap, logout, and key authenticated APIs on staging.
6. Check deployment identity, current commit, route health, mobile recovery, and UI smoke tests. Promote only after gates pass.
7. Reconcile and document security findings. Do not claim Strix/Claude Security passed without completed reports.

### P1 — Real, evidence-backed execution
1. Audit mission/task state transitions, durable queue, approval records, idempotency, retry/timeout/recovery and audit evidence.
2. Keep Routines honest: scheduled/manual runs create missions; only a real worker plus persisted evidence can mark a result completed.
3. Implement/configure a real isolated computer/browser runtime only with owner/tenant binding, capability scopes, egress controls, DNS/SSRF validation, process cleanup, resource budgets, kill switch, human takeover and reconnect-safe logs.
4. Add integration-level tests for tenant isolation, duplicate delivery, restart/recovery, cancellation, stale receipts, SSRF and consequential-action approvals.
5. Make the shipped web UI's editable source and build reproducible; avoid relying on opaque release-built bundles as the only source of truth.

### P2 — Prove distribution and unit economics
1. Launch one paid Revenue Operator pilot offer, with a clear ICP, deliverables, acceptance contract, exclusions, response time, and human approvals.
2. Measure cost per accepted result, quality, rework, time saved, exceptions, margin, renewals and verified client outcomes.
3. Use `@whiloai` profiles for consistent distribution, demos, case studies with permission, and qualified buyer conversations. Do not confuse views/followers with paid demand.
4. Productize only repeated, accepted workflows; expand into adjacent functions after renewal and positive delivery economics.

## Session protocol

Before work:
1. Read this file and root `AGENTS.md`.
2. Read the relevant current code, tests, and documentation — at minimum `README.md`, `docs/whilo-services-as-software-strategy.md`, `docs/30-day-proof-of-market.md`, `docs/one-shot-activation-runbook.md`, `docs/SECURITY_REVIEW_RUNBOOK.md`, and the task-specific runtime/connector/marketplace docs.
3. Inspect current GitHub main head, recent commits, actual Vercel production and staging deployment metadata, and the live migration state before making release assumptions.
4. Make the smallest useful, verifiable change. Preserve existing architecture and user data; do not rewrite migrations or change secrets speculatively.
5. Add/update regression tests with code changes. Run them when a runtime is available; otherwise state clearly that they were not run.
6. Update this file at the end with the new commit SHA, file changes, test results, deployment state, blockers, and next action. Keep dated historical notes when useful; do not silently rewrite failed checks as passes.

## Session log — 2026-10-26

- Read the README and the main strategy, 30-day proof-of-market, activation, security, database decision, runtime, connector identity, marketplace/pricing, Partners, human Messages, and OpenMausBot research documentation.
- Audited the recent commit history and compared main with the observed production commit: 14 commits ahead.
- Reviewed the current routine launch-reservation flow, migration, platform static check, and product-contract regression test.
- Found a user-facing rate-limit message that said “across the workspace” even though the RPC limits by organization **and user**, sharing the quota across routine runs and saved-library analysis. Correct the wording and lock the intended quota semantics with regression checks.
- Found stale release-runbook references to the production commit and a hardcoded migration count. Refresh the runbook from the current Vercel evidence and replace the hardcoded migration count with explicit version-by-version reconciliation.
