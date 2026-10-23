# Whilo one-shot activation runbook

Updated: 22 October 2026.

## Verified current state

- Production frontend: https://whilo-swas.vercel.app
- Vercel project: `whilo-swas`, production deploy configured from `ryantheirreal/whilo-swas`.
- Current Vercel environment variables found: `WHILO_PUBLIC_URL` and `SLACK_REDIRECT_URI` only. There is no `SUPABASE_URL` or `SUPABASE_ANON_KEY`, so the public-config endpoint intentionally disables cloud authentication.
- The only Supabase project visible to the connected account is `toutch`, and its status is `INACTIVE`. It is not safe to reuse this project for Whilo without explicit confirmation.
- Stripe connector exposes one account in live mode. Do not create Whilo products/prices, connect accounts, or accept payments on that live account until the account owner confirms the account and has tested a separate sandbox.

## Required infrastructure decision

Create a dedicated Supabase project named `whilo-prod` under the user's chosen organization and preferred region. The only organization currently visible to the connector is `dumainbrazil@gmail.com's Org` (`mdcibpxtwdjyvlabskge`). A project cost quote returned USD $0/month for project creation at the time checked; this is not a guarantee that usage, paid plan upgrades, backups, egress or add-ons will remain free. Confirm the organization before creating it.

## Supabase configuration

1. Set Project Site URL to `https://whilo-swas.vercel.app`.
2. Add Redirect URLs for `https://whilo-swas.vercel.app/`, `https://whilo-swas.vercel.app/?whilo_recovery=1` and the invitation return path. Add the recovery URL explicitly because password reset uses that query parameter.
3. Apply migrations `202610210001` through `202610220010` in ascending order. The first live application should be preceded by reviewing the target project and confirming no untracked production schema exists.
4. Enable email/password Auth and confirm email flow. Configure a production SMTP provider before public onboarding so confirmations and recovery messages are reliable.
5. Generate or retrieve the project's URL, publishable/anon key and service-role key. The service-role key must stay in Vercel server-side environment variables only.

## Vercel environment variables

Set these server-side in Vercel Project Settings, not in Git:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHILO_CONNECTOR_ENCRYPTION_KEY` (base64 encoding of exactly 32 random bytes)
- `WHILO_OAUTH_STATE_SECRET` (unique high-entropy secret)
- `STRIPE_SECRET_KEY` (test/sandbox key first)
- `STRIPE_WEBHOOK_SECRET` (signing secret for `/api/marketplace/webhook`)
- `WHILO_MARKETPLACE_ADMIN_USER_IDS` (comma-separated authenticated user UUIDs allowed to moderate listings)
- `STRIPE_PRICE_WHILO_PLUS_MONTHLY`, `STRIPE_PRICE_WHILO_PLUS_ANNUAL`
- `STRIPE_PRICE_WHILO_PREMIUM_MONTHLY`, `STRIPE_PRICE_WHILO_PREMIUM_ANNUAL`
- `STRIPE_PRICE_WHILO_SUPER_MONTHLY`, `STRIPE_PRICE_WHILO_SUPER_ANNUAL`
- `STRIPE_PRICE_WHILO_ULTRA_MONTHLY`, `STRIPE_PRICE_WHILO_ULTRA_ANNUAL`

The eight Price IDs must be created in the selected Stripe sandbox and correspond to the Whilo plan table. Do not use live-mode price IDs for test keys or vice versa.

## Owner sign-in and workspace initialization

1. Open the app and select **Account** in Whilo navigation.
2. Sign up using the intended owner email, confirm the email from the Supabase Auth message, then return and sign in.
3. The signed-in session invokes `POST /api/account/bootstrap`. The server reads the authenticated session email and calls `ensure_owner_workspace`; it does not accept a caller-supplied target email. The migration seeds the user's workspace and default Pets.
4. Verify the API reports `ok: true` and the default Pets before treating the workspace as initialized.
5. If the owner account already exists and the password is unknown, use the password-reset flow. Do not overwrite an existing password via a new-user bootstrap script.

## Stripe sandbox launch checks

- Create a dedicated sandbox in the Stripe Dashboard and choose that sandbox for the connected Stripe tooling. The available connector currently shows only a live account, so do not perform writes against it yet.
- Create one-time marketplace Products/prices and recurring subscription Prices in the sandbox; configure Connect onboarding as available for the selected platform and region.
- Configure `POST /api/marketplace/webhook` and test duplicate events, successful/failed/asynchronous checkout, subscription activation/renewal/payment failure/cancellation, seller onboarding, refunds and disputes.
- Publish no listing before review; paid entitlements are granted only from verified Stripe webhooks; creator uploads are declarative manifests and must not be executed as untrusted code.
- Keep subscription revenue and marketplace commission separate. The default commission snapshot is 20% platform / 80% creator before applicable taxes and refund adjustments.

## Release criteria

Do not announce full activation until all are true: account sign-in and reset tested with the intended email; workspace bootstrap returns an organization and Pets; migration list shows versions 001–012; database security/performance advisors have been reviewed; Stripe test checkout and webhook scenarios pass; then run the production checklist and only then provision live Stripe credentials.


## Whilo Partners

- Set `WHILO_AFFILIATE_PAYOUT_ADMIN_USER_IDS` to the approved reviewer Auth user UUID(s); do not use an email address here.
- Keep `WHILO_AFFILIATE_PAYOUTS_ENABLED=false` while testing. Review `docs/whilo-partners-program.md` for the 20% direct subscription commission + 5% single-upline override, marketplace 5% + 2% commissions, 30-day hold, R$100 minimum, refund adjustments and launch requirements.
- Affiliate payouts must not be enabled on live Stripe until account onboarding, ledger reconciliation, duplicate/retry, refund/dispute and recovery checks pass in the dedicated sandbox.
