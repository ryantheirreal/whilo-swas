# Whilo Marketplace & plans — implementation brief

Updated: 22 October 2026.

## Current truth

The current app has a general Store entry point and a Pet/Bot concept, but it is not yet a live multi-seller marketplace. No production Supabase project is connected in this repository state, no marketplace migration has been applied to a live database, no Stripe Connect account is linked, and there are no verified purchases or payouts. The marketplace UI must label sample assets as previews until the server returns actual published listings. The Pet-install RPC creates a workspace Pet record; Bots, Skills, Playbooks and Templates are saved as declarative installed assets, and task-runtime invocation remains a separate launch gate.

This implementation plan adds the product surface, tenant-aware persistence schema, authenticated listing/order APIs, server-side Stripe Connect onboarding and checkout plumbing, plus signed-webhook verification. It still depends on configuration, database migrations, provider account verification, and end-to-end tests before real users can buy or receive payouts.

## Marketplace promise

**Discover, install and sell agents that finish a measurable job.** Avoid becoming a gallery of prompts. Each listing should tell buyers:
- What outcome it delivers, which systems it touches, supported tools and input/output format.
- Which model/runtime it expects, estimated usage cost, version and changelog.
- Permissions requested, whether actions are read-only, draft-only or write-capable, and which steps require approval.
- Tested examples, failure boundaries, seller identity, license and an evidence-based rating.
- Price and currency. Do not show a rating until backed by verified purchases and reviews.

### Product taxonomy

- **Pet:** persistent outcome owner, with user-approved memory, policy, skills and scorecard.
- **Bot:** task-scoped specialist with restricted capabilities; expires when its assigned task finishes.
- **Skill / Playbook:** portable declarative workflow or instruction set.
- **Template:** reusable configuration for an agent, workflow or business process.

A marketplace item must be a versioned, declarative manifest. Do not download and run creator-submitted JavaScript, shell, Python, browser extensions or opaque binaries inside the main Whilo process. Imported agents inherit the purchaser's policy, tenant boundaries, tool allowlist, execution budget and approvals; seller manifest text cannot override system safety rules or gain secrets. Treat prompt injection in seller metadata as untrusted input.

## Commission mechanics

Target: **20% platform commission on every completed paid sale**. Initial recommendation:
- Platform fee = floor(order amount in minor currency units × 0.20).
- Seller proceeds = order amount − platform fee.
- PSP processing fee is initially paid from the platform's 20% share. It is not deducted silently from advertised seller proceeds.
- Taxes, refunds, disputes, chargebacks and currency/conversion fees must be handled explicitly in the terms and ledger before public launch.

The 20% is gross platform commission, **not 20% profit**. Stripe's standard Brazil domestic-card price is listed at 3.99% + R$0.39 per successful transaction (verify official pricing and negotiated rates at launch): https://stripe.com/br/pricing

Illustrative math for a R$100 sale paid on a domestic card:
- Buyer pays: R$100.00 (before any correctly applicable tax treatment).
- Whilo commission at 20%: R$20.00.
- Seller proceeds before seller-side taxes/refunds: R$80.00.
- Illustrative processor cost: R$4.38 (3.99% + R$0.39).
- Whilo remaining commission contribution: R$15.62 before infrastructure, support, refunds, disputes and tax.

At R$100,000 GMV/month with 1,000 R$100 purchases: gross platform commission R$20,000; the same illustrative payment cost would be R$4,380; commission after processor costs would be R$15,620 before other costs and taxes. This is scenario math, not revenue guidance or a guarantee.

For the first marketplace release, keep seller onboarding and payments within Brazil/BRL and expand to other regions only after configuring the appropriate platform entity, currency and cross-border Connect flow. Stripe country support and cross-border transfer rules are regional; do not assume one Connect setup can automatically pay every country. See https://stripe.com/br/global and https://docs.stripe.com/connect/separate-charges-and-transfers.

The platform should not create seller payouts from a browser callback. Trust signed Stripe webhooks, validate the Connect account is enabled, process every webhook event idempotently, and use the order/entitlement ledger as the source of truth. Test refunds and disputes before launch.

## Suggested Whilo plans, anchored to the X reference

These are **recommended launch price tests in BRL**, not a claim that billing is currently enabled. The X reference shows Plus renewing at R$40.90/month (annual R$409) and Premium renewing at R$169.90/month (annual R$1,699). Whilo sells deeper work outcomes, so preserve a similar entry point, then scale by budgeted execution and collaboration.

| Plan | Monthly | Annual (roughly 2 months free) | Intended buyer | Packaging principle |
|---|---:|---:|---|---|
| Free | R$0 | R$0 | Curious users | Chat, sample Pets/Bots, small monthly trial allocation, public marketplace browsing |
| Plus | **R$39.90** | **R$399** | Individual / solo operator | Core Chat/Tasks, small execution-credit allocation, a few active Pets, basic integrations; no unlimited compute |
| Premium | **R$169.90** | **R$1,699** | Power user / creator | Larger allocation, more active Pets and parallel Bot work, advanced model options, cloud history, creator analytics |
| Super | **R$399.90** | **R$3,999** | Professional / small team | Shared workspace, more seats, team roles, higher queue concurrency, recurring routines, stronger audit/export controls |
| Ultra | **R$999.90** | **R$9,999** | Heavy operator / agency | High budget and concurrency ceilings, advanced computer/runtime access when enabled, support priority and usage alerts |
| Enterprise | **From R$3,999/month; scoped quote** | Contract | Businesses buying outcomes | Tenant controls, custom integration, SLA only when operationally supported, procurement/security review and agreed acceptance criteria |

### How not to lose money on AI usage

- Do not promise unlimited AI, unlimited agents or unlimited cloud computers.
- Define a Whilo execution credit after measuring real model-token, tool, browser, computer and storage costs. Do not invent credit quantities before telemetry exists.
- Price bundles to a target contribution margin; alert at 70% of an account budget, slow or ask before exceeding included allowance, and expose add-on usage clearly.
- For the first 30 days, test Plus at R$39.90 vs reference R$40.90; test Premium at R$149.90 vs R$169.90 only if actual costs and conversion justify it. Keep R$169.90 as the safer initial Premium list price because it matches the reference regular price.
- Keep model/provider pass-through costs, third-party models and expensive computer sessions outside unlimited bundles.
- Annual discount is a price experiment, not pre-collected profit: provision support, refunds and inference costs over the full term.

### Commercial separation

Subscriptions pay for Whilo's own application access and included product usage. Marketplace transactions pay creators and Whilo takes 20% commission. Do not silently count one as the other; use separate subscription and order ledgers, clear receipts, refunds and billing status. Offer the higher-value **Services-as-Software** option separately: scoped business outcome, implementation/onboarding fee and recurring delivery—not merely more chat messages.

## Navigation recommendation: keep Chat and Tasks separate

Do **not** rename Chat to Tasks. They represent different user intents:
- **Chat / Ask Whilo:** express an intent in natural language, clarify constraints, ask for a plan.
- **Tasks / Work:** inspect mission state, steps, budget, approvals, deliverables, evidence and retry history.
- **Pets:** persistent accountable agents.
- **Bots:** task-scoped specialists and tools.
- **Marketplace:** discover, install and sell vetted Pets, Bots, Skills and Playbooks.
- **Messages:** human DMs/groups/channels; can turn a message into a mission.
- **Routines:** repeatable/scheduled workflows.
- **Connect:** external systems and permissions.
- **Results:** outcome receipts, time saved and verified business impact.

Ask Whilo can become the display name above the chat input while the navigation retains Chat for familiarity. Tasks is a better name for the mission list than Work if user testing shows the current label is too broad.

## Release gates before public sale

1. Apply migrations 001–010 in a **staging** Supabase project; 009 creates the marketplace/commerce schema and 010 adds transactional buyer-side installations.
2. Configure Stripe test-mode secret and webhook signing key; set a webhook route at /api/marketplace/webhook; use test-mode Connect accounts and verify onboarding, account.updated, checkout.completed, duplicate webhook, failure, refund and dispute flows.
3. Set platform moderator user IDs server-side. New creator listings stay in review until a moderator approves them.
4. Complete legal terms, prohibited-listing rules, IP takedown path, refund/dispute policy, privacy policy, Brazilian consumer/data/tax review and seller verification.
5. Verify seller identity and eligibility through Stripe-hosted checks; never work around age, identity or financial compliance requirements. A person who is not eligible to own a payout account needs an eligible adult/business representative following the provider's rules.
6. Execute end-to-end tests on isolated test accounts; then deploy production keys only after a documented review.

## Open-source strategy

Use open-source software where it adds real capability and its license is compatible, but do not indiscriminately paste a giant repository into Whilo:
- Stripe's official Connect samples are the reference for the payment flow and license terms: https://github.com/stripe-samples/connect-destination-charge and https://github.com/stripe-samples/checkout-single-subscription
- Medusa is worth evaluating for later commerce primitives, but wholesale adoption is unnecessary for a focused digital agent marketplace: https://github.com/medusajs/medusa
- Vendure is another modular commerce reference: https://github.com/vendure-ecommerce/vendure
- Matrix/Element and Zulip remain relevant for collaboration UX, not the marketplace database.

Record every imported dependency/reused source, its exact commit and license in a third-party notices file before reusing code. Preserve attribution and required source/license obligations. Reimplement business logic where a source's architecture or license is not compatible.
