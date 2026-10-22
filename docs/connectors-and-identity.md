# Whilo identity, integrations and connector security

Updated: 21 October 2026

## Owner account and database

The requested owner identity is `ryantheirreal@gmail.com`. Whilo uses **Supabase Auth** to own password hashing, password verification, sessions and recovery. The application schema must never store the raw password in a profile row or SQL migration.

The password shared in chat is short and should be replaced before production use. The bootstrap script deliberately rejects passwords shorter than 14 characters or without mixed character classes. It reads the chosen value only from a temporary environment variable, never logs it, and refuses to reset an existing account. Supabase Auth receives the credential over TLS and stores its own password hash.

Prerequisites:
1. Create/select the intended Supabase project and set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
2. Apply all five files under `supabase/migrations/` in ascending filename order (001 through 005), including the mission transaction, owner/Pet bootstrap and explicit server-role grants.
3. Set the temporary owner password in a local secret manager or hidden terminal prompt, then run `node scripts/bootstrap-owner.mjs`.
4. The Whilo extension now provides a cloud sign-in card in **Work** and **Connect**, using `whilo-cloud-auth.js` and `/api/public-config`. Sign in with the owner account created by Supabase Auth. The script stores only a Supabase session/refresh token in this browser, never the password. Do not expose the service-role key to browser code.
5. Verify the owner row and workspace membership through Supabase, then remove the temporary password from the process environment.

The intended Vercel project had no Supabase credentials when this was implemented. The public canonical URL and Slack callback URL have been configured, but `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, encryption key and OAuth state secret still need secure configuration. The owner account has **not** been created and no live production database has been mutated.

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

## Current boundary

Implemented in code: database migrations, Supabase owner provisioning script, authenticated connector API, Slack OAuth start/callback, encrypted integration storage, Twilio credential verification, QR pairing token issuance/claiming, and bridge heartbeat identity.

Not yet activated: the actual Supabase/Vercel secrets, running migrations in a live database, owner account provisioning, Slack app credentials, tested OAuth against a real workspace, Twilio account credentials, a native macOS bridge, iMessage message transport, and autonomous worker execution. Never market these as live until verified end-to-end.
