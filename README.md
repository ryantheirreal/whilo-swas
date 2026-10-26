# Whilo — Services-as-Software monorepo

Whilo is an outcome-first AI work operator: a user defines a goal and acceptance criteria; a persistent **Pet** owns the mission; temporary specialist **Bots** perform bounded tasks; the runtime enforces budgets and permissions; an independent verifier checks evidence before delivery.

## Repository layout

- `AGENTS.md` — mandatory coding-agent workflow, safety rules, and continuity requirements.
- `.agent/SESSION.md` — canonical session context, verified repository/deployment snapshot, blockers, and next actions; update at each meaningful handoff.

- `web/whilo-swas/` — browser app and Vercel build boundary, including the first server-side APIs.
- `web/whilo-swas/api/` — cloud public config, authenticated mission endpoints, connector APIs, Slack OAuth, QR bridge pairing and human messaging APIs.
- `web/whilo-swas/whilo-cloud-auth.js` — browser Supabase sign-in, session refresh and logout; passwords are never stored by Whilo.
- `supabase/migrations/` — tenant isolation, Pets, durable mission queue, approvals, encrypted integrations, audit trail, human messaging, invitations, marketplace fees/entitlements and transactional installs.
- `scripts/bootstrap-owner.mjs` — secure Supabase Auth owner/workspace provisioning; reads a temporary strong password from the environment and never logs it.
- `scripts/check-platform.mjs` — static API, migration and secret-hygiene checks.
- `desktop/whilo-swas-desktop/` — separate Electron client and packaging workflow for macOS, Windows and Linux.
- `shared/whilo-agent-core/` — shared mission state machine, approval policy, DAG validation, dependency-aware scheduler, parallel execution waves, retry limits and evidence gates.
- `docs/whilo-services-as-software-strategy.md` — Sequoia's Services-as-Software thesis applied to Whilo.
- `docs/30-day-proof-of-market.md` — commercial sprint and measurable proof targets.
- `docs/agentic-runtime-and-linux-desktop.md` — Pets/Bots and computer-runtime architecture.
- `docs/connectors-and-identity.md` — setup instructions, OAuth/token security and actual limitations.
- `docs/human-messages-product-architecture.md` — Telegram/Matrix/Zulip research and Messages architecture.
- `docs/database-platform-evaluation-2026-10-22.md` — decision matrix across 27 database platforms.
- `docs/marketplace-and-pricing-strategy.md` — plan pricing, creator economy and 20% commission strategy.

## Product model

**Chat** is the command surface. **Pets** are persistent agents with a role, user-approved memory and policy. **Bots** are task-scoped specialists spawned for bounded work. **Marketplace** distributes vetted Pets, Bots, Skills, Playbooks and Templates. **Rotinas** schedules repeatable work. **Work, Company, Connect and Results** provide the operating layer.

## New platform foundations

- **Tenant-scoped Supabase schema:** organizations/members, Pets, missions, tasks, approval records, queue jobs, event timeline, connector metadata and audit events, plus explicit service-role grants in migration 005.
- **Cloud identity:** Work and Connect now include sign-in using Supabase Auth; the browser only receives the public anon key and a session, while the service-role key stays server-side.
- **Mission API:** validates DAGs and constraints before persisting plans. Explicit approval is required before a job enters the durable queue; API responses say whether work is still waiting for a worker.
- **Slack OAuth:** authenticated installation start, expiring one-time state, server-side token exchange, encrypted-at-rest bot token and disconnect flow.
- **SMS via Twilio:** server-side credential validation and encrypted storage. Setup does not send messages.
- **Human Messages:** DMs, groups, supergroups, public channels, people search, message history, edits/deletes, reactions, threads, read receipts, and invitation links. The Supabase schema is applied, but live use still needs `SUPABASE_SERVICE_ROLE_KEY` in Vercel and authenticated end-to-end verification.
- **Mac Bridge pairing foundation:** short-lived QR, atomic single-use claim, hashed device credential and heartbeat. **This is not an iMessage transport yet.**
- **Owner provisioning:** uses Supabase Auth to hash/verify passwords. It refuses the weak password shared in chat and does not reset an existing account.

## Production activation gate — partially configured, not end-to-end ready

The dedicated Supabase project `whilo-prod` is documented as active in `sa-east-1`. Direct inspection on 26 October 2026 reported 33 applied migration-history entries, including the OAuth-link index and atomic routine launch reservation/scheduler-budget migrations. The repository checker also inspects 33 versioned SQL files. Reconcile migration names and reviewed SQL against the live database before applying anything; counts alone are not sufficient. Do **not** replay existing migrations. The Vercel project has `SUPABASE_URL`, the public `SUPABASE_ANON_KEY`, the canonical URL, the Slack callback URL, sensitive connector-encryption and OAuth-state secrets, and `WHILO_AFFILIATE_PAYOUTS_ENABLED=false`.

**Blocking configuration:** Vercel still has no `SUPABASE_SERVICE_ROLE_KEY`. Server routes use this key for protected database operations, so authenticated backend workflows are not yet end-to-end functional. Add the current key from Supabase Project Settings → API Keys as a sensitive, server-only Vercel environment variable. Never expose it to browser code, commit it, or paste it into chat.

Stripe is not yet configured for Whilo in a verified sandbox: the Stripe API and webhook secrets, recurring Price IDs and approved moderator/reviewer UUID allowlists are absent. Do not accept live payments or enable affiliate transfers until a dedicated sandbox passes checkout, duplicate-webhook, unpaid-session, refund/dispute and payout-recovery tests. Keep the payout kill switch false.

The saved-library routine snapshot analyzer is implemented and covered by a regression test; it only analyzes bounded saved metadata and does not browse the live site or control a computer. “Run now” for an external site/computer remains an approval-gated mission plan unless an authorized execution worker and its live acceptance tests prove the action occurred. The native iMessage bridge and production autonomous desktop worker are still not implemented. Do not represent queued jobs, QR pairing or connector metadata as completed execution.

See `docs/one-shot-activation-runbook.md` for verified infrastructure status and release gates. The Strix workflow exists but has not been run from this environment, and no Anthropic Claude Security scan is claimed as complete.

## Build and checks

From the repository root: `npm run check`.

Web: `cd web/whilo-swas && npm install && npm run check && npm run build`.

Desktop: `cd desktop/whilo-swas-desktop && npm install && npm run check`; package on the matching OS with `npm run dist:mac`, `npm run dist:win` or `npm run dist:linux`.

## Deployment

**Production URL:** https://whilo-swas.vercel.app

The Vercel project root is `web/whilo-swas`; framework Vite, build command `npm run build`, output `public`, Node 24.x. Verify the latest deployment is **READY** before treating a commit as live.

The base site bundle is still release-built rather than first-party source in this repository. Direct inspection returned 33 applied migration-history entries; still reconcile each live migration name and SQL against the repository rather than relying on counts alone. Authenticated server APIs remain blocked until `SUPABASE_SERVICE_ROLE_KEY` is configured in Vercel. Marketplace code is present but not activated for live selling until Stripe sandbox credentials, signed webhooks and end-to-end payment/refund tests pass. The Work extension's mission planning and manual evidence review are not a production server-side autonomous worker. Do not claim a browser/desktop action executed unless a configured worker returns verifiable run evidence.

The desktop project remains a secure Electron shell which opens the hosted Whilo site. Its build workflow targets macOS, Windows and Linux; no installer artifacts or platform signing should be assumed until a platform build has succeeded. It does not yet provide native computer control or a remote VM by itself.

## Strategy

Follow the Sequoia Services-as-Software approach: sell accepted work, not seats or access to bots. Test one narrow, low-regulation, measurable outsourced Revenue Operations workflow for B2B service firms. Prove accepted outputs, retention, repeatable acquisition and unit economics before expanding function by function.

A US$1B valuation in one month is an ambition, not a controllable or responsible promise. The 30-day target is investor-grade evidence: paid pilots, accepted deliverables, renewals, repeatable distribution, and measured delivery economics.


**Whilo Partners:** free enrollment, referral links, direct and one-level partner commissions, eight evidence-based tiers, 30-day holds, payout review, and refund/dispute adjustments. See `docs/whilo-partners-program.md`. Live transfers stay disabled until sandbox validation.
