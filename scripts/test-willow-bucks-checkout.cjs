'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'web/whilo-swas/server/routes/credits.js'), 'utf8');

assert.doesNotMatch(source, /integration_identifier\s*:/, 'Stripe Checkout must not receive an unsupported integration_identifier parameter');
assert.match(source, /idempotencyKey:\s*'whilo-wb-checkout-'\s*\+\s*member\.organization_id\s*\+\s*'-'\s*\+\s*user\.id\s*\+\s*'-'\s*\+\s*pack\.id\s*\+\s*'-'\s*\+\s*requestId/, 'Checkout retries must reuse the same idempotency key and deterministic parameters');
assert.match(source, /p_provider_event_id:\s*event\.id/, 'Credit issuance must be deduplicated by the signed Stripe event');
assert.match(source, /session\.payment_status\s*!==\s*'paid'/, 'Credits must not be issued for unpaid checkout sessions');
assert.match(source, /Number\(session\.amount_total\)!==pack\.amountMinor/, 'Paid amount must match the server-defined pack');
assert.match(source, /expectedCredits!==pack\.credits/, 'Credit amount must match the server-defined pack');
console.log('Willow Bucks Checkout regression tests passed.');

const refundMigration = fs.readFileSync(path.join(root, 'supabase/migrations/202610240005_willow_bucks_refunds_and_debt.sql'), 'utf8');
assert.ok(source.includes('charge.refunded'), 'Verified charge refunds must trigger a credit reversal');
assert.ok(source.includes('charge.dispute.created'), 'Opening a dispute must conservatively reverse credit value');
assert.ok(source.includes('charge.dispute.closed'), 'A won dispute must restore eligible credits or clear its outstanding recovery debt');
assert.ok(source.includes('rpc/reverse_whilo_credit_purchase'), 'Webhook reversals must use the atomic server-only RPC');
assert.ok(source.includes('Stripe should retry this webhook'), 'Out-of-order refund events must be retried rather than silently dropped');
assert.ok(refundMigration.includes('recovery_debt_wb bigint not null default 0'), 'Spent credits cannot create a spendable negative wallet; they create recovery debt');
assert.ok(refundMigration.includes('whilo_credit_reversal_events'), 'Stripe event IDs must be durably deduplicated');
assert.ok(refundMigration.includes('recovery_debt_repaid_wb'), 'Future top-ups must first repay recovery debt');
console.log('Willow Bucks refund/dispute recovery regression tests passed.');
