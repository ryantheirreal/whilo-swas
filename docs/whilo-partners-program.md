# Whilo Partners — affiliate program specification

Updated: 22 October 2026.

## Product principle

Whilo Partners is a sales-based referral program, not a paid recruitment or multi-level recruitment scheme. Joining is free. No one earns money because another person signs up as an affiliate; commissions arise only from eligible, collected Whilo product sales. There is exactly one override level and no deeper-generation commission.

The program is designed to grow through genuine customer outcomes. A partner should be able to explain the product, share a tracked link, view attributed customers and payments, understand hold/reversal rules, and request eligible payouts without seeing another user's email or private workspace data.

## Commercial rules

### Subscriptions

- Direct affiliate: 20% of eligible subscription amount collected, net of invoice-level taxes, discounts and failed/refunded payments, for up to the first 12 months from that referred customer's first paid Whilo transaction.
- One-level partner override: 5% of the same eligible subscription collection to the direct affiliate's own sponsor, only if that sponsor separately enrolled in Whilo Partners and remains active.
- Maximum allocation: 25% of the eligible collected subscription amount. There is no third-level override.
- Amounts in non-BRL currencies are not credited in this initial release. Add currencies only after local pricing, tax, payout, FX and provider-fee rules have been reviewed.

### Marketplace orders

- Direct affiliate: 5% of an eligible completed paid item order.
- One-level override: 2% of that eligible order amount to the direct affiliate's sponsor.
- Both are funded out of Whilo's 20% marketplace platform commission, leaving 13% of the item GMV to Whilo before payment processing, support, tax, refunds and infrastructure. Seller proceeds remain 80% before seller taxes and applicable adjustments.
- Affiliate commissions are recorded only from verified server-side Stripe webhook events, never browser checkout return parameters.

### Hold and payout rules

- Commission ledger rows start as \`pending\`, with a 30-day hold for refund/chargeback risk.
- When the hold expires, the authenticated dashboard moves the eligible row to \`available\`; the SQL ledger is authoritative.
- Minimum payout request: R$100 available after applying any outstanding refund/dispute adjustments.
- Stripe Connect identity, transfers and payout capability must all be active before a request can be created.
- A payout is a request, not a promise of payment. An authorized reviewer must approve it. The server reconciles the associated commission items, open refund adjustments, idempotency key and Connect state before creating a transfer.
- The transfer feature is disabled unless \`WHILO_AFFILIATE_PAYOUTS_ENABLED=true\`. Keep it false until a dedicated Stripe sandbox has passed onboarding, transfer, duplicate/retry, refund, dispute and recovery tests.
- Stripe idempotency keys and transfer-group lookup avoid duplicate transfers when the provider succeeds but a later database write fails.
- A full refund or dispute reverses unpaid commissions; if a commission was already paid, a negative adjustment is netted against a future payout. Any partial-refund proration policy should be specified and tested before supporting partial refunds as a distinct commission event.

## Rank path

Tiers are earned from two verified signals: distinct referred customers with a confirmed first payment, and eligible direct sales volume. Affiliate/sub-affiliate recruitment count alone does not qualify a rank. Tier benefits are access/status milestones, not hidden financial promises.

| Tier | Qualified paying customers | Direct attributed sales | Illustrative recognition |
|---|---:|---:|---|
| Seed | 0 | R$0 | Starter status, link and dashboard |
| Bronze | 3 | R$500 | Bronze badge and first milestone |
| Silver | 10 | R$2,000 | Partner learning clinic eligibility |
| Gold | 25 | R$7,500 | Campaign and content opportunities |
| Platinum | 50 | R$25,000 | Co-marketing review eligibility |
| Diamond | 100 | R$100,000 | Priority partner review |
| Apex | 250 | R$500,000 | Strategic campaign eligibility |
| Sovereign | 1,000 | R$2,000,000 | Partner advisory eligibility |

The SQL tier function determines the current tier. The interface displays a progress path and milestone quests; it does not fabricate XP or payouts. Recognition benefits above should be treated as eligibility invitations until each has an operational owner and fulfillment policy.

## Attribution

- Referral URLs use \`https://whilo-swas.vercel.app/?ref=CODE\`.
- The browser saves a valid referral code locally, then claims it through an authenticated endpoint after sign-in and workspace bootstrap.
- The database records a referred account once. A user cannot refer themselves, and an existing attribution cannot be silently overwritten with a second code.
- An enrolled affiliate's parent is based on the referral that brought that affiliate into the program. Payout override is limited to the direct sponsor.
- Affiliate codes are not bearer tokens for accessing accounts or private customer data.
- Public customer data in partner dashboards is minimized to a display name/status; private emails, messages and workspaces are not exposed.

## Abuse prevention and conduct

Prohibited: self-referral; creating or controlling multiple accounts to earn commissions; fake or incentivized accounts; misleading earnings guarantees; spam; cookie stuffing; brand/search ads that impersonate Whilo; unauthorized use of Whilo's or a customer's IP; deceptive discounts; tax or identity misrepresentation; attempts to manipulate rank or payout state.

Require clear affiliate disclosure near links and endorsements. Whilo may freeze attribution/payouts, reverse unearned commission, or suspend a partner while investigating documented abuse. Provide an appeal process before permanent removal and retain an audit trail.

This specification does not replace legal review. Before public launch, review Brazilian consumer, advertising, privacy, tax, payment-provider, and affiliate-disclosure obligations with qualified counsel.

## Technical model

Migration 011 adds affiliate profiles, one-time attribution, commission ledger and payout requests. Migration 012 adds refund/dispute adjustments, corrections to first-paid qualification, and net payout reconciliation. The API is routed through the existing shared Vercel function to stay within the current function-count limit.

- \`affiliate_profiles\`: unique code, one direct sponsor, state and tier.
- \`affiliate_referrals\`: first attribution per user, first paid timestamp and qualification state.
- \`affiliate_commissions\`: immutable commercial snapshot keyed by source + recipient; status updates do not change its rate or amount.
- \`affiliate_adjustments\`: immutable debits for already-paid commission reversal; nets against future payout.
- \`affiliate_payouts\` / \`affiliate_payout_items\`: idempotent requests with explicit links to included commissions.
- \`record_whilo_affiliate_commission\`: direct and one-level commission calculation.
- \`reverse_whilo_affiliate_source\`: reversal for refunds/disputes.
- \`request_whilo_affiliate_payout\`: locks the affiliate profile and selects available commissions atomically.

All writes use the authenticated server route and service-role database access. Service-role and Stripe keys remain server-only. Do not grant browser roles direct ledger mutation privileges.

## Launch checklist

1. Connect the intended Whilo Supabase project and apply migrations 001–012 in order; verify all 12 appear in the migration history.
2. Configure \`SUPABASE_SERVICE_ROLE_KEY\`, \`STRIPE_SECRET_KEY\`, \`STRIPE_WEBHOOK_SECRET\`, \`WHILO_AFFILIATE_PAYOUT_ADMIN_USER_IDS\`, and Stripe plan price IDs in Vercel.
3. Configure \`WHILO_AFFILIATE_PAYOUTS_ENABLED=false\` during setup. Use Stripe test keys and test Connect accounts.
4. Set the review allowlist to the authenticated owner/reviewer UUID. Enroll test affiliates with a direct sponsor and a second-generation customer; verify no third-level override.
5. Test subscription invoices, marketplace orders, duplicate events, self-referral rejection, attribution immutability, hold expiry, minimum payout, a refund before payout, a refund after payout, payout cancellation on ledger drift, and a retried transfer.
6. Review database security/performance advisors and webhook logs. Only enable live transfers after compliance and finance owners approve the runbook.
