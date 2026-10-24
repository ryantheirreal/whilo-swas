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
