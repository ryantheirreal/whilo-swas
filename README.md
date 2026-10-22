# Whilo — Services-as-Software monorepo

Whilo is an outcome-first AI work operator: a user defines a goal and acceptance criteria; a persistent **Pet** owns the mission; temporary specialist **Bots** perform bounded tasks; the runtime enforces budgets and permissions; an independent verifier checks evidence before delivery.

## Repository layout

- `web/whilo-swas/` — browser app and Vercel build boundary, including the first server-side APIs.
- `web/whilo-swas/api/` — cloud public config, authenticated mission endpoints, connector APIs, Slack OAuth, QR bridge pairing and human messaging APIs.
- `web/whilo-swas/whilo-cloud-auth.js` — browser Supabase sign-in, session refresh and logout; passwords are never stored by Whilo.
- `supabase/migrations/` — tenant isolation, Pets, durable mission queue, approvals, encrypted integrations, audit trail, human messaging and invitations.
- `scripts/bootstrap-owner.mjs` — secure Supabase Auth owner/workspace provisioning; reads a temporary strong password from the environment and never logs it.
- `scripts/check-platform.mjs` — static API, migration and secret-hygiene checks.
- `desktop/whilo-swas-desktop/` — separate Electron client and packaging workflow for macOS, Windows and Linux.
- `shared/whilo-agent-core/` — shared mission state machine, approval policy, DAG validation, dependency-aware scheduler, parallel execution waves, retry limits and evidence gates.
- `docs/whilo-services-as-software-strategy.md` — Sequoia's Services-as-Software thesis applied to Whilo.
- `docs/30-day-proof-of-market.md` — commercial sprint and measurable proof targets.
- `docs/agentic-runtime-and-linux-desktop.md` — Pets/Bots and computer-runtime architecture.
- `docs/connectors-and-identity.md` — setup instructions, OAuth/token security and actual limitations.

## Product model

**Chat** is the command surface. **Pets** are persistent agents with a role, user-approved memory and policy. **Bots** are task-scoped specialists spawned for bounded work. **Store** distributes Pets and playbooks. **Rotinas** schedules repeatable work. **Work, Company, Connect and Results** provide the operating layer.

## New platform foundations

- **Tenant-scoped Supabase schema:** organizations/members, Pets, missions, tasks, approval records, queue jobs, event timeline, connector metadata and audit events, plus explicit service-role grants in migration 005.
- **Cloud identity:** Work and Connect now include sign-in using Supabase Auth; the browser only receives the public anon key and a session, while the service-role key stays server-side.
- **Mission API:** validates DAGs and constraints before persisting plans. Explicit approval is required before a job enters the durable queue; API responses say whether work is still waiting for a worker.
- **Slack OAuth:** authenticated installation start, expiring one-time state, server-side token exchange, encrypted-at-rest bot token and disconnect flow.
- **SMS via Twilio:** server-side credential validation and encrypted storage. Setup does not send messages.
- **Human Messages:** DMs, groups, supergroups, public channels, people search, message history, edits/deletes, reactions, threads, read receipts, and invitation links. API code is ready for configuration; Supabase is not connected yet.
- **Mac Bridge pairing foundation:** short-lived QR, atomic single-use claim, hashed device credential and heartbeat. **This is not an iMessage transport yet.**
- **Owner provisioning:** uses Supabase Auth to hash/verify passwords. It refuses the weak password shared in chat and does not reset an existing account.

## Configuration gate — not yet active

The code is committed, but Vercel's current environment-variable inventory is empty. Before cloud operations can run, the workspace owner must connect/configure a Supabase project, apply all eight migrations in ascending order, configure the missing encrypted Vercel environment variables, provision the owner account using a strong temporary password, and register the Slack app. Follow `docs/connectors-and-identity.md`.

No production owner account was created, no migration has been applied to a live database, and no Slack or Twilio account was connected in this session. The actual autonomous worker and native iMessage bridge also remain unimplemented. Do not represent plans, queued jobs, a QR pair or connector metadata as completed execution without evidence from the provider.

## Build and checks

From the repository root: `npm run check`.

Web: `cd web/whilo-swas && npm install && npm run check && npm run build`.

Desktop: `cd desktop/whilo-swas-desktop && npm install && npm run check`; package on the matching OS with `npm run dist:mac`, `npm run dist:win` or `npm run dist:linux`.

## Deployment

**Production URL:** https://whilo-swas.vercel.app

The Vercel project root is `web/whilo-swas`; framework Vite, build command `npm run build`, output `public`, Node 24.x. Verify the latest deployment is **READY** before treating a commit as live.

The base site bundle is still release-built rather than first-party source in this repository. The current Work extension's mission planning and manual evidence review are not a production server-side autonomous worker. Data in that extension remains browser-local until the authenticated APIs and database are configured and the UI is migrated end-to-end.

The desktop project remains a secure Electron shell which opens the hosted Whilo site. Its build workflow targets macOS, Windows and Linux; no installer artifacts or platform signing should be assumed until a platform build has succeeded. It does not yet provide native computer control or a remote VM by itself.

## Strategy

Follow the Sequoia Services-as-Software approach: sell accepted work, not seats or access to bots. Test one narrow, low-regulation, measurable outsourced Revenue Operations workflow for B2B service firms. Prove accepted outputs, retention, repeatable acquisition and unit economics before expanding function by function.

A US$1B valuation in one month is an ambition, not a controllable or responsible promise. The 30-day target is investor-grade evidence: paid pilots, accepted deliverables, renewals, repeatable distribution, and measured delivery economics.
