# Whilo — Services-as-Software monorepo

Whilo is an outcome-first AI work operator: a user defines a goal and acceptance criteria; a persistent **Pet** leads a mission; temporary specialist **Bots** perform bounded work; a Governor enforces budget and permissions; a review requires evidence before delivery.

## Repository layout

- `web/whilo-swas/` — browser app and Vercel build boundary.
- `desktop/whilo-swas-desktop/` — Electron client for macOS, Windows and Linux.
- `shared/whilo-agent-core/` — shared mission state machine, approval policy and evidence verification.
- `docs/whilo-services-as-software-strategy.md` — Sequoia thesis applied to Whilo.
- `docs/30-day-proof-of-market.md` — commercial execution sprint.
- `docs/agentic-runtime-and-linux-desktop.md` — Pets/Bots and computer-runtime architecture.
- `deploy/` — legacy build boundary retained for the existing Vercel project.

## Product model

**Chat** is the command surface. **Pets** are persistent agents with a role, approved memory and policy. **Bots** are scoped specialists spawned for a bounded task. **Store** distributes Pets and playbooks. **Rotinas** schedules repeatable work. **Work, Company, Connect and Results** are operating surfaces and must never claim a task ran, a connector is active or a computer was provisioned without runtime evidence.

## Build and checks

From the repository root: `npm run check`.

Web: `cd web/whilo-swas && npm run build`.

Desktop: `cd desktop/whilo-swas-desktop && npm install && npm run check`; build an installer on its target OS with `npm run dist:mac`, `npm run dist:win` or `npm run dist:linux`.

## Current capability boundary

The web build retrieves a pinned site bundle from a GitHub Release archive, verifies SHA-256 and injects the editable enterprise UI plus shared mission core. The base auth/runtime is still release-built rather than first-party source code in this repository.

The existing `whilo-runtime.js` emulates `/api/*` and `/api/events` in the browser. It is not proof of a remote Linux VM. The Work page models Pet-led missions, bounded Bots, approvals and manual evidence review in the browser, but does **not** invoke a server-side autonomous worker yet. Data remains browser-local; multi-device identity, active OAuth connectors, durable job queue, real cloud-computer provider and audit backend remain to be built and tested.

The desktop project is currently a secure Electron shell which opens the hosted Whilo site. It does not yet provide native computer control or a remote VM by itself. macOS signing/notarization and Windows code signing are not configured.

The Vercel connection used for this task denied deployment creation for the existing project and denied creation of a new project. Until a deployment is successfully built and tested, changes committed here must not be represented as already live on `https://whilo-swas.vercel.app`.

## Strategy

Sell completed work, not seats or access to bots. The initial hypothesis is a narrow, low-regulation, measurable outsourced Revenue Operations workflow for B2B service firms. Prove accepted outputs, customer retention and unit economics before expanding function by function.
