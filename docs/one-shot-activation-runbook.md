# Whilo production activation runbook

Updated: 24 October 2026.

## Verified current state

- Canonical production URL: https://whilo-swas.vercel.app
- Vercel project: `whilo-swas`, linked to `ryantheirreal/whilo-swas`.
- Supabase project: `whilo-prod` (`pnmewiqemeoqwannyjuz`), region `sa-east-1`, status `ACTIVE_HEALTHY`.
- The Supabase migration history reports 29 applied migrations, including workspace isolation, marketplace, affiliates, Willow Bucks, routine scheduling, usage metering, server-only Data API grants and bounded library-asset context. Do not replay these migrations on this database.
- Security advisor: the exposed SECURITY DEFINER view and public trigger-function execution findings were corrected. Remaining `rls_enabled_no_policy` items are INFO-level on server-only tables whose browser-role grants are revoked; verify grants and RLS together, not the warning count alone.
- Performance advisor currently includes unused-index INFO notices. Do not drop indexes based only on low-traffic/no-usage telemetry; re-evaluate after representative production traffic.
- Vercel currently has `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WHILO_PUBLIC_URL`, `SLACK_REDIRECT_URI`, `WHILO_CONNECTOR_ENCRYPTION_KEY`, `WHILO_OAUTH_STATE_SECRET` and the explicit kill switch `WHILO_AFFILIATE_PAYOUTS_ENABLED=false`.
- **Blocking configuration gaps:** `SUPABASE_SERVICE_ROLE_KEY` is not present in the Vercel project; neither are the Stripe API key and webhook secrets, subscription Price IDs, Slack app client credentials or allowlisted reviewer/admin Auth UUIDs. The server API layer uses `SUPABASE_SERVICE_ROLE_KEY` for protected database operations, so a green static build alone does not make those live product flows functional.
- Affiliate transfers are intentionally disabled. Do not enable them until sandbox transfer, idempotency, ledger reconciliation, refund/dispute and recovery tests pass.
- Routines can deterministically analyze a sanitized, saved dashboard/library snapshot as read-only evidence. That is **not** live-site browsing or desktop execution. Browser/desktop/API actions require an actual authorized worker/integration and approval-gated execution path.

## Supabase and authentication

1. Keep the selected database as the dedicated `whilo-prod` project. The live migration history currently contains 29 applied migrations, including the routine/library context, ChatGPT identity linking and atomic affiliate payout claim additions. Compare the live list to the repository before any future schema change; never replay these migrations.
2. In Supabase Auth, confirm Site URL is `https://whilo-swas.vercel.app`; allow the sign-in, recovery and invitation return URLs actually used by the UI. Verify password-reset email delivery with a production SMTP provider before public onboarding.
3. Retrieve the project's current service-role secret from Supabase's project API keys and add it to Vercel as a **sensitive server-only** variable named `SUPABASE_SERVICE_ROLE_KEY`. Do not paste it into chat, source code, client-side JavaScript or logs. Use it only for server routes; the public anon/publishable key is not a replacement.
4. Confirm `/api/health` reports configuration booleans without exposing values. Test sign-up/sign-in, email confirmation, recovery, session restoration and `POST /api/account/bootstrap` with a dedicated staging account before opening public registration.
5. Re-run Supabase security and performance advisors after database changes. Investigate new ERROR/WARN security findings; do not blanket-grant browser roles to financial or tenant data to silence INFO notices.

## Vercel environment variables

Keep all secrets server-side. The two internally generated application secrets are already stored as sensitive Vercel variables:
- `WHILO_CONNECTOR_ENCRYPTION_KEY`: base64 of exactly 32 random bytes; do not rotate it after storing encrypted connector payloads without a planned re-encryption migration.
- `WHILO_OAUTH_STATE_SECRET`: high-entropy HMAC secret; rotating it invalidates in-flight OAuth state.

Still required before their respective features can work:
- `SUPABASE_SERVICE_ROLE_KEY` (required by server APIs; blocking).
- `STRIPE_SECRET_KEY`: start with a dedicated Stripe sandbox key; prefer a restricted `rk_test_...` key with only the necessary permissions over a broad secret key.
- `STRIPE_WEBHOOK_SECRET` for `POST /api/marketplace/webhook`.
- `STRIPE_CREDITS_WEBHOOK_SECRET` for `POST /api/credits/webhook`.
- `STRIPE_PRICE_WHILO_PLUS_MONTHLY`, `STRIPE_PRICE_WHILO_PLUS_ANNUAL`, `STRIPE_PRICE_WHILO_PREMIUM_MONTHLY`, `STRIPE_PRICE_WHILO_PREMIUM_ANNUAL`, `STRIPE_PRICE_WHILO_SUPER_MONTHLY`, `STRIPE_PRICE_WHILO_SUPER_ANNUAL`, `STRIPE_PRICE_WHILO_ULTRA_MONTHLY`, `STRIPE_PRICE_WHILO_ULTRA_ANNUAL`.
- `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` for Slack OAuth; `SLACK_REDIRECT_URI` must exactly match `https://whilo-swas.vercel.app/api/connectors/slack/callback`.
- `WHILO_MARKETPLACE_ADMIN_USER_IDS` and `WHILO_AFFILIATE_PAYOUT_ADMIN_USER_IDS`, each a comma-separated list of authorized Supabase Auth UUIDs, never email addresses.

`WHILO_AFFILIATE_PAYOUTS_ENABLED=false` is intentionally configured across Vercel environments. Leave it false until the sandbox acceptance tests and financial/legal review are complete. Do not add real credentials to `.env.example`.

## Willow Bucks and Stripe test plan

- Willow Bucks packs are prepaid, non-transferable usage credits, not cash or cryptocurrency. The nominal credit model is 1 WB = R$0.01; the internal provider-cost guard targets no more than 40% of nominal credit value, leaving 60% contribution **before** payment processing, taxes, infrastructure, support, refunds and fraud costs. This is a guardrail, not a promise of net profit.
- Stripe Checkout now uses dynamic payment methods and caller-scoped idempotency keys. Fulfillment must happen only after a verified webhook reports an actually paid session; never fulfill from the success URL.
- In the Stripe sandbox, test each pack's amount/credit metadata, duplicate webhook delivery, mismatched amount/currency, failed or unpaid sessions, and retrying the same checkout request ID. Verify each paid session credits the ledger exactly once.
- For Marketplace, test checkout, entitlement grant, duplicate webhooks, refund/dispute reversals, creator proceeds, fees and seller Connect onboarding. Do not create test objects in a live account.
- Never enable affiliate transfers by setting the kill switch to true before the dedicated payout tests prove duplicate safety and recovery behavior.

## Routines and saved library assets

- `Analyze saved snapshot` supports read-only analysis for saved dashboards and web apps in the user's workspace. It emits bounded evidence and metric comparisons, performs no external network/browser/desktop action and bills 0 WB.
- “Run now” creates an approval-gated mission; it does not itself prove a browser or desktop action executed.
- For live website or local-computer automation, configure the corresponding trusted worker, user/device binding, scopes, heartbeat, execution-time SSRF checks, human approval and durable run evidence. Never convert a queued mission to “succeeded” solely because it was created.
- Validate the new saved-snapshot analyzer with `npm run check` and `npm run build`; the build must execute the analyzer regression tests.

## Security assessment

- The repository contains a manual Strix code-only workflow at `.github/workflows/strix-assessment.yml`. It requires the repository owner's explicit workflow-dispatch authorization and an `ANTHROPIC_API_KEY` Actions secret, and caps model spend at USD 10 per run. Keep its scope restricted to repository code unless a separately authorized scope is documented.
- **Do not claim Strix or Anthropic's security review has passed until a run is executed and its report is independently triaged.** The current environment has no direct workflow-dispatch action and no configured Anthropic Actions secret was verified here.
- Track every finding with severity, affected asset, reproducible evidence, fix, regression test and residual risk. Keep the report private because it can contain exploit details.
- See `docs/SECURITY_REVIEW_RUNBOOK.md` for the current security gates and response process.

## Release criteria

Do not announce full production activation until all of the following are verified:
1. The latest main commit builds and is the canonical `whilo-swas.vercel.app` deployment.
2. `SUPABASE_SERVICE_ROLE_KEY` is configured server-side and /api/health reports the necessary booleans without exposing values.
3. Sign-in, recovery, tenant bootstrap and essential authenticated API flows pass end-to-end tests in staging.
4. All 29 current migrations are accounted for; database security advisors have no unresolved ERRORs/WARNs and remaining INFOs have documented rationale.
5. Routine snapshot unit tests, SSRF tests, syntax/static checks and build pass; live browser/desktop claims are limited to a tested worker.
6. Stripe sandbox checkout and webhooks pass duplicate, unpaid, mismatch, refund, dispute and failure-recovery tests.
7. Strix and Anthropic security scans are actually run and their findings are triaged.
8. Affiliate payouts remain disabled until their separate sandbox and reconciliation acceptance suite passes.

## Whilo Partners

- Set `WHILO_AFFILIATE_PAYOUT_ADMIN_USER_IDS` to approved reviewer Auth UUID(s), not email addresses.
- See `docs/whilo-partners-program.md` for 20% direct subscription commission + 5% one-level override, marketplace 5% + 2% partner commissions, 30-day hold, R$100 minimum and refund adjustments.
- Keep money transfers disabled until Connect onboarding, ledger reconciliation, duplicate/retry, refund/dispute and recovery checks pass in the dedicated sandbox.
