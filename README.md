# Whilo — Services-as-Software monorepo

Whilo is an outcome-first AI work operator: a user defines a goal and acceptance criteria; a persistent **Pet** owns the mission; temporary specialist **Bots** perform bounded tasks; the runtime enforces budgets and permissions; a verifier checks evidence before delivery.

## Repository layout

- `web/whilo-swas/` — browser app and Vercel build boundary.
- `desktop/whilo-swas-desktop/` — separate Electron client and packaging workflow for macOS, Windows and Linux.
- `shared/whilo-agent-core/` — shared mission state machine, approval policy, DAG validation, dependency-aware scheduler, parallel execution waves, retry limits and evidence gates.
- `docs/whilo-services-as-software-strategy.md` — Sequoia's Services-as-Software thesis applied to Whilo.
- `docs/30-day-proof-of-market.md` — commercial sprint and measurable proof targets.
- `docs/agentic-runtime-and-linux-desktop.md` — Pets/Bots and computer-runtime architecture.

## Product model

**Chat** is the command surface. **Pets** are persistent agents with a role, user-approved memory and policy. **Bots** are task-scoped specialists spawned for bounded work. **Store** distributes Pets and playbooks. **Rotinas** schedules repeatable work. **Work, Company, Connect and Results** provide the operating layer; they must never claim a task ran, a connector is active or a computer was provisioned without runtime evidence.

## Build and checks

From the repository root: `npm run check`.

Web: `cd web/whilo-swas && npm run build`.

Desktop: `cd desktop/whilo-swas-desktop && npm install && npm run check`; package on the matching OS with `npm run dist:mac`, `npm run dist:win` or `npm run dist:linux`.

## Deployment

**Production URL:** https://whilo-swas.vercel.app  
**Latest confirmed Vercel deployment:** `dpl_4RVV9sT5HmLoeUYsCAHjaSjRs8Lz` — READY, commit `5c407e716a0cdc142468c31b17a330bb765da527`. The Vercel project root is `web/whilo-swas`; the latest build log confirms the pinned site bundle and shared mission core were packaged successfully.

The base site bundle is still release-built rather than first-party source in this repository. The current Web UI models mission planning and manual evidence review, but **does not yet invoke a production server-side autonomous worker**. Data in the Work extension remains browser-local; multi-device identity, active OAuth connectors, durable job queue, real cloud-computer provider and server-side audit storage remain to be built and tested.

The desktop project is currently a secure Electron shell which opens the hosted Whilo site. Its build workflow targets macOS, Windows and Linux; no installer artifacts or platform signing should be assumed until a platform build has actually succeeded. It does not yet provide native computer control or a remote VM by itself.

## Strategy

Follow the Sequoia Services-as-Software approach: sell accepted work, not seats or access to bots. Test one narrow, low-regulation, measurable outsourced Revenue Operations workflow for B2B service firms. Prove accepted outputs, retention, customer acquisition and unit economics before expanding function by function.

A US$1B valuation in one month is an ambition, not a controllable or responsible promise. The 30-day target is investor-grade evidence: paid pilots, accepted deliverables, renewals, repeatable distribution, and measured delivery economics.
