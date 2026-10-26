# Whilo identity, integrations and connector security

Updated: 24 October 2026

## Owner account and database

The requested owner identity is `ryantheirreal@gmail.com`. Whilo uses **Supabase Auth** to own password hashing, password verification, sessions and recovery. The application schema must never store the raw password in a profile row or SQL migration.

The password shared in chat is short and should be replaced before production use. The bootstrap script deliberately rejects passwords shorter than 14 characters or without mixed character classes. It reads the chosen value only from a temporary environment variable, never logs it, and refuses to reset an existing account. Supabase Auth receives the credential over TLS and stores its own password hash.

Prerequisites / verified current state (26 October 2026):
1. The dedicated Supabase project is `whilo-prod` (`pnmewiqemeoqwannyjuz`), active in `sa-east-1`; a direct inspection on 26 October 2026 returned 33 applied migration-history entries, including `whilo_auth_oauth_link_fk_index` and `routine_launch_rate_limit_and_scheduler_budget`. **Do not replay them** on this database; reconcile each migration name and reviewed SQL with the repository before any schema change. Future schema changes must be new versioned migrations and verified against a separate staging project where possible.
2. Vercel already has `SUPABASE_URL`, the public `SUPABASE_ANON_KEY`, `WHILO_PUBLIC_URL`, `SLACK_REDIRECT_URI`, sensitive `WHILO_CONNECTOR_ENCRYPTION_KEY` / `WHILO_OAUTH_STATE_SECRET`, and `WHILO_AFFILIATE_PAYOUTS_ENABLED=false`.
3. **Blocking:** `SUPABASE_SERVICE_ROLE_KEY` is missing from Vercel. Add the current service-role key from Supabase Project Settings → API Keys as a sensitive, server-only variable for the required environments. Do not send it in chat, put it in Git or expose it in browser code. The backend's protected database routes cannot work end-to-end until this is configured.
4. Owner account creation, email confirmation/recovery and workspace bootstrap still need authenticated end-to-end verification. Use a strong temporary password from a secret manager or hidden terminal prompt for `node scripts/bootstrap-owner.mjs`; never share or log it. Verify the account/workspace and remove the temporary password from the process environment.
5. The browser receives only the public anon/publishable key and a Supabase session, never the service-role key. Keep financial data, connector tokens, HMAC/encryption keys and all provider secrets server-side.

The project and database migrations exist, but a green static build is not proof that the auth/workspace runtime is active. The owner account, production SMTP/recovery, actual Slack OAuth, Stripe sandbox and autonomous worker still require explicit end-to-end acceptance tests.

## Cloud sign-in

- Public configuration endpoint: `GET /api/public-config`. It returns only `SUPABASE_URL` and the public anon/publishable key; the service-role key is never exposed.
- Sign-in: Supabase Auth password grant over HTTPS; sessions refresh through the Supabase Auth API and logout clears the local session.
- Authenticated server APIs independently validate the access token with Supabase Auth and resolve organization membership server-side. A browser-supplied organization ID is never trusted.

## Slack OAuth setup

The Slack integration is implemented as an OAuth 2.0 workspace installation:
- Start: `POST /api/connectors/slack/start` with the authenticated Whilo Supabase access token.
- Callback: `GET /api/connectors/slack/callback`.
- Exact Slack Redirect URL: `https://whilo-swas.vercel.app/api/connectors/slack/callback`.
- Minimal initial bot scopes: `chat:write`, `channels:read`. Add scopes only with a clear product need, disclose them, and re-authorize.
- Server configuration: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`, `WHILO_OAUTH_STATE_SECRET`, `WHILO_CONNECTOR_ENCRYPTION_KEY`, `WHILO_PUBLIC_URL`.

OAuth state is random, hashed in the database, expires in ten minutes, and is consumed once. Workspace tokens are encrypted with AES-256-GCM using a separate 32-byte key; only non-secret connection metadata is shown to authenticated clients. External messages must still use the mission approval policy; successful OAuth does not imply permission to send automatically.

## SMS via Twilio

The connection endpoint accepts Account SID, API Key SID, API Key Secret and a Messaging Service SID over HTTPS, validates the key against Twilio, and persists the credentials only as AES-256-GCM ciphertext. Credentials are not saved to localStorage by the supplied connection form. Connecting the provider does not send an SMS. A production send route must additionally implement recipient consent, opt-out handling, country/policy checks, idempotency, rate/budget limits, delivery webhooks and explicit approval.

## iMessage and QR pairing

Apple's public Messages framework documents iMessage apps/extensions, not a general-purpose server API for reading and sending normal iMessages. See [Apple's Messages framework](https://developer.apple.com/documentation/messages) and [Apple's iMessage developer overview](https://developer.apple.com/imessage/). Whilo therefore uses a user-owned macOS bridge concept rather than pretending there is an official cloud API.

The pairing foundation issues a 5-minute one-time QR payload, allows a device to claim it atomically, stores only a hash of the bridge credential, and supports an authenticated heartbeat. It **does not yet read or send iMessages**: that requires a separately built and user-consented native macOS bridge, permissions, message transport, event relay, UI automation reliability, and platform tests. The desktop shell alone is not that bridge. Until those pieces exist, the UI must say "pairing foundation" rather than "iMessage connected."

## Tenant isolation and controls

- Browser sessions are validated through Supabase Auth; all REST calls for secrets use the server-only service-role key.
- The organization ID is resolved server-side from the authenticated membership; the browser cannot select another tenant.
- OAuth states expire and are single-use; provider tokens are encrypted at rest.
- Audit events record connector connect/disconnect and bridge pairing without recording credentials or message content.
- SMS sends, outbound Slack messages, purchases, destructive changes and account permission changes must stay approval-gated.
- Revoking a Whilo connection removes the local encrypted secret. Twilio API keys must also be revoked in Twilio Console when no longer needed.

## Environment variables

Copy names from `web/whilo-swas/.env.example` into Vercel's encrypted Environment Variables UI. Generate independent random values for `WHILO_CONNECTOR_ENCRYPTION_KEY` and `WHILO_OAUTH_STATE_SECRET`. Never commit real values, use a public `NEXT_PUBLIC_*` prefix for secrets, log token responses, or paste service-role keys into client scripts.

## Current boundary — verified 26 October 2026

Implemented in code and database: the dedicated `whilo-prod` Supabase project, 26 applied migrations, owner provisioning script, authenticated server API, Slack OAuth start/callback, encrypted integration storage, Twilio credential verification flow, QR pairing token issuance/claiming and bridge heartbeat identity. The membership table, base integration table, safe-view browser grants and secret columns were checked after the security migrations; browser roles cannot select `organization_members` or encrypted integration secrets, and the RLS helper functions are in the `private` schema.

Still blocking or unverified:
- `SUPABASE_SERVICE_ROLE_KEY` is missing from Vercel, so protected backend routes are not yet working end-to-end. Add it as a sensitive server-only variable from Supabase Project Settings → API Keys.
- Owner account creation, SMTP/recovery flows and real authenticated workspace bootstrap need staging end-to-end tests.
- Slack app client credentials, a real OAuth installation, Twilio account credentials and live connector sends are not configured/verified.
- The native macOS bridge, iMessage transport and autonomous desktop/browser worker are not implemented as a working production runtime.
- Stripe credentials and verified sandbox purchases/refunds are not configured; Marketplace and affiliate payout flows remain behind launch gates.

Never market a pairing token, saved integration metadata, queued mission or static build as a live authenticated integration or completed execution without test evidence.


## Marketplace and subscriptions

The first marketplace release is scoped to published declarative Pets, Bots, Skills, Playbooks and Templates priced in BRL. Creator uploads are configuration manifests only; never execute a seller-provided script or binary inside the main application. Listings stay in draft/review until an allowlisted moderator publishes them.

- Creator payout onboarding: Stripe Connect Express, with identity and payout eligibility verified through Stripe's hosted flow.
- Paid checkout: authenticated API creates a pending order with immutable price/20% fee/80% seller-proceeds snapshot. Only a verified Stripe webhook grants a paid entitlement.
- Webhook: `POST /api/marketplace/webhook` with the exact `Stripe-Signature`; test duplicate events, async failures, refunds and disputes before launch.
- Plan checkout: create recurring Stripe Prices and set the matching `STRIPE_PRICE_WHILO_<PLAN>_<INTERVAL>` IDs as server-side Vercel environment variables.
- Required server env keys: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `WHILO_MARKETPLACE_ADMIN_USER_IDS`, plus all eight recurring Price IDs. Keep them out of Git and browser code.
- The current proposed launch test prices are Free, Plus R$39.90/month, Premium R$169.90/month, Super R$399.90/month and Ultra R$999.90/month; annual prices are R$399, R$1,699, R$3,999 and R$9,999. These are pricing hypotheses, not active subscriptions.

These tables and API/UI code are present, and the dedicated Supabase database has 26 applied migrations. This does **not** activate live marketplace selling: Vercel still lacks the server-only service-role key and Stripe sandbox/API/webhook secrets, Price IDs and end-to-end acceptance tests. Before launch, verify Stripe test-mode onboarding/checkout/webhooks, plus production terms, refunds/tax and seller-verification policies.


## Whilo Partners and affiliate commissions

Migrations 011 and 012 add affiliate enrollment, first-touch referral attribution, one-level sponsor override, commission ledger, ranks, refund/dispute adjustments and a payout review queue. Configure `WHILO_AFFILIATE_PAYOUT_ADMIN_USER_IDS` with approved Auth UUID(s), and keep `WHILO_AFFILIATE_PAYOUTS_ENABLED=false` until Stripe sandbox testing and financial/compliance review are complete. Read `docs/whilo-partners-program.md` for all rates and rules.
