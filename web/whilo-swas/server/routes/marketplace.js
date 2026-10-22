'use strict';

const crypto = require('node:crypto');
const { send, authenticate, organizationFor, db, readJson, safeError, audit, appUrl } = require('../../api/_lib/platform');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(['pet', 'bot', 'skill', 'playbook', 'template']);
const PLANS = new Set(['plus', 'premium', 'super', 'ultra']);
const ALLOWED_TOOLS = new Set([
  'browser.research', 'files.read', 'calendar.draft', 'crm.read',
  'workflow.draft', 'code.review', 'marketing.write', 'data.analyze'
]);

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}
function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'asset';
}
function shortText(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}
function safeManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const allowedKeys = new Set(['schemaVersion', 'persona', 'systemPrompt', 'allowedTools', 'inputSchema', 'outputSchema', 'requiresApproval']);
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowedKeys.has(key)) fail(400, 'Manifest contains an unsupported field: ' + key);
    if (key === 'schemaVersion') out.schemaVersion = shortText(value || '1', 16);
    if (key === 'persona') out.persona = shortText(value, 100);
    if (key === 'systemPrompt') out.systemPrompt = String(value || '').trim().slice(0, 6000);
    if (key === 'allowedTools') {
      if (!Array.isArray(value) || value.length > 8) fail(400, 'Choose up to eight explicit capabilities.');
      out.allowedTools = [...new Set(value.map(x => String(x)))];
      if (out.allowedTools.some(tool => !ALLOWED_TOOLS.has(tool))) fail(400, 'Manifest requests a capability that Whilo has not allowlisted.');
    }
    if (key === 'inputSchema' || key === 'outputSchema') {
      if (value && (typeof value !== 'object' || Array.isArray(value))) fail(400, key + ' must be a JSON object.');
      out[key] = value || {};
    }
    if (key === 'requiresApproval') out.requiresApproval = value !== false;
  }
  const serialized = JSON.stringify(out);
  if (Buffer.byteLength(serialized, 'utf8') > 10000) fail(400, 'Manifest is too large.');
  // Creator packages are configuration only; executable source is never accepted.
  if (/"(code|javascript|shell|python|binary|executable|eval|commandText)"\s*:/i.test(serialized)) {
    fail(400, 'Executable code and shell commands are not supported in marketplace manifests.');
  }
  return out;
}
function requireStripeKey() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    const error = new Error('Stripe Connect is not configured. The marketplace remains in preview mode.');
    error.statusCode = 503;
    error.missingEnv = ['STRIPE_SECRET_KEY'];
    throw error;
  }
  if (!/^sk_(test|live)_/.test(key)) fail(503, 'The payment provider key is not valid for this deployment.');
  return key;
}
function formEncode(value, prefix, params) {
  for (const [key, raw] of Object.entries(value || {})) {
    const name = prefix ? prefix + '[' + key + ']' : key;
    if (raw == null) continue;
    if (Array.isArray(raw)) raw.forEach((item, index) => {
      if (item != null && typeof item === 'object') formEncode(item, name + '[' + index + ']', params);
      else if (item != null) params.append(name + '[' + index + ']', String(item));
    });
    else if (typeof raw === 'object') formEncode(raw, name, params);
    else params.append(name, String(raw));
  }
}
async function stripeRequest(path, method, body, idempotencyKey) {
  const key = requireStripeKey();
  const headers = { Authorization: 'Bearer ' + key, Accept: 'application/json' };
  const opts = { method: method || 'POST', headers };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (opts.method !== 'GET') {
    const params = new URLSearchParams();
    formEncode(body || {}, '', params);
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = params.toString();
  }
  const response = await fetch('https://api.stripe.com/v1/' + path.replace(/^\/+/, ''), opts);
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    const error = new Error('Payment provider could not complete the request.');
    error.statusCode = response.status >= 500 ? 502 : 400;
    error.providerStatus = response.status;
    throw error;
  }
  return data;
}
function baseUrl() { return appUrl().replace(/\/+$/, ''); }
async function sellerFor(orgId, userId) {
  const rows = await db('marketplace_sellers?organization_id=eq.' + encodeURIComponent(orgId) +
    '&user_id=eq.' + encodeURIComponent(userId) + '&select=*&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function ownedListing(orgId, userId, listingId) {
  if (!UUID_RE.test(listingId)) fail(400, 'Valid listingId is required.');
  const seller = await sellerFor(orgId, userId);
  if (!seller) fail(404, 'Creator profile not found.');
  const rows = await db('marketplace_listings?organization_id=eq.' + encodeURIComponent(orgId) +
    '&seller_id=eq.' + encodeURIComponent(seller.id) +
    '&id=eq.' + encodeURIComponent(listingId) + '&select=*&limit=1');
  if (!Array.isArray(rows) || !rows.length) fail(404, 'Listing was not found in your creator account.');
  return { seller, listing: rows[0] };
}
async function createCheckoutOrder(user, member, listing, seller) {
  if (listing.price_minor <= 0 || listing.pricing_model !== 'one_time') fail(400, 'This listing is not a paid item.');
  if (listing.organization_id === member.organization_id) fail(400, 'You cannot purchase your own listing.');
  if (seller.status !== 'active' || !seller.stripe_account_id || !seller.stripe_charges_enabled || !seller.stripe_payouts_enabled) {
    fail(409, 'The creator has not completed payment onboarding yet.');
  }
  const fee = Math.floor(Number(listing.price_minor) * 0.20);
  const rows = await db('marketplace_orders', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      listing_id: listing.id,
      seller_id: seller.id,
      buyer_organization_id: member.organization_id,
      buyer_user_id: user.id,
      currency: 'BRL',
      price_minor: listing.price_minor,
      platform_fee_bps: 2000,
      platform_fee_minor: fee,
      seller_proceeds_minor: listing.price_minor - fee,
      state: 'pending'
    })
  });
  if (!Array.isArray(rows) || !rows[0]) fail(503, 'The order could not be recorded.');
  return rows[0];
}
async function handleMain(req, res) {
  if (req.method === 'GET') {
    const rows = await db('marketplace_listings?status=eq.published&select=id,seller_id,listing_type,title,summary,description,category,tags,version,license,pricing_model,price_minor,currency,featured,installs_count,published_at&order=featured.desc,published_at.desc&limit=100');
    const listings = Array.isArray(rows) ? rows : [];
    const sellerIds = [...new Set(listings.map(item => item.seller_id).filter(Boolean))];
    const sellers = sellerIds.length
      ? await db('marketplace_sellers?id=in.(' + sellerIds.join(',') + ')&select=id,display_name,bio,status,stripe_payouts_enabled')
      : [];
    const sellerMap = new Map((Array.isArray(sellers) ? sellers : []).map(item => [item.id, item]));
    return send(res, 200, {
      live: true,
      listings: listings.map(item => ({
        ...item,
        seller: sellerMap.get(item.seller_id) ? {
          display_name: sellerMap.get(item.seller_id).display_name,
          bio: sellerMap.get(item.seller_id).bio,
          verified_payouts: Boolean(sellerMap.get(item.seller_id).stripe_payouts_enabled)
        } : null
      }))
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  const body = await readJson(req, 24576);
  const action = String(body.action || '');
  const user = await authenticate(req);
  const member = await organizationFor(user);
  const orgId = member.organization_id;

  if (action === 'my-listings' || action === 'my-entitlements') {
    const seller = await sellerFor(orgId, user.id);
    if (action === 'my-listings') {
      if (!seller) return send(res, 200, { seller: null, listings: [] });
      const listings = await db('marketplace_listings?organization_id=eq.' + encodeURIComponent(orgId) +
        '&seller_id=eq.' + encodeURIComponent(seller.id) + '&select=id,listing_type,title,summary,category,tags,version,license,pricing_model,price_minor,currency,status,review_note,installs_count,created_at,updated_at&order=updated_at.desc&limit=100');
      return send(res, 200, { seller, listings: Array.isArray(listings) ? listings : [] });
    }
    const [rows, installationRows] = await Promise.all([
      db('marketplace_entitlements?buyer_organization_id=eq.' + encodeURIComponent(orgId) +
        '&buyer_user_id=eq.' + encodeURIComponent(user.id) + '&status=eq.active&select=id,listing_id,order_id,granted_at&order=granted_at.desc&limit=100'),
      db('marketplace_installations?organization_id=eq.' + encodeURIComponent(orgId) +
        '&buyer_user_id=eq.' + encodeURIComponent(user.id) + '&state=neq.removed&select=id,listing_id,listing_version,asset_type,pet_instance_id,state,installed_at&order=installed_at.desc&limit=100')
    ]);
    const installs = Array.isArray(installationRows) ? installationRows : [];
    const listingIds = [...new Set(installs.map(row => row.listing_id).filter(Boolean))];
    const listingRows = listingIds.length
      ? await db('marketplace_listings?id=in.(' + listingIds.join(',') + ')&select=id,title,summary,category')
      : [];
    const listingMap = new Map((Array.isArray(listingRows) ? listingRows : []).map(row => [row.id, row]));
    return send(res, 200, {
      entitlements: Array.isArray(rows) ? rows : [],
      installations: installs.map(row => Object.assign({}, row, { listing: listingMap.get(row.listing_id) || null }))
    });
  }

  if (action === 'create-listing') {
    const title = shortText(body.title, 100);
    const summary = shortText(body.summary, 240);
    const description = String(body.description || '').trim().slice(0, 12000);
    const listingType = String(body.listingType || '');
    const category = shortText(body.category || 'Productivity', 60);
    const license = shortText(body.license || 'Proprietary', 80);
    const priceMinor = Number(body.priceMinor || 0);
    if (!TYPES.has(listingType)) fail(400, 'Choose a Pet, Bot, Skill, Playbook or Template.');
    if (title.length < 3 || summary.length < 10 || category.length < 2) fail(400, 'Complete the title, summary and category.');
    if (!Number.isInteger(priceMinor) || priceMinor < 0 || priceMinor > 50000000) fail(400, 'Price must be an integer number of BRL cents.');
    if (body.acceptedListingTerms !== true) fail(400, 'Confirm the listing rights, license accuracy and creator terms.');
    const manifest = safeManifest(body.manifest || {});
    const existing = await sellerFor(orgId, user.id);
    let seller = existing;
    if (!seller) {
      const displayName = shortText(body.creatorName || (user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0], 80);
      const created = await db('marketplace_sellers', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          organization_id: orgId, user_id: user.id, display_name: displayName || 'Whilo Creator',
          bio: '', country_code: 'BR', status: 'pending'
        })
      });
      if (!Array.isArray(created) || !created[0]) fail(503, 'Creator profile could not be created.');
      seller = created[0];
    }
    const slug = slugify(body.slug || title) + '-' + crypto.randomBytes(3).toString('hex');
    const created = await db('marketplace_listings', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        organization_id: orgId, seller_id: seller.id, slug, listing_type: listingType,
        title, summary, description, category, tags: Array.isArray(body.tags) ? body.tags.map(x => shortText(x, 30)).filter(Boolean).slice(0, 10) : [],
        version: shortText(body.version || '1.0.0', 40), license,
        pricing_model: priceMinor === 0 ? 'free' : 'one_time', price_minor: priceMinor, currency: 'BRL',
        manifest, status: 'draft'
      })
    });
    if (!Array.isArray(created) || !created[0]) fail(503, 'Listing could not be saved.');
    await audit(orgId, user.id, 'marketplace.listing_created', 'marketplace_listing', created[0].id, 'success', { listing_type: listingType });
    return send(res, 201, { listing: created[0], detail: 'Draft saved. Submit it for review before it can appear in the public catalog.' });
  }

  if (action === 'submit-listing') {
    const owned = await ownedListing(orgId, user.id, String(body.listingId || ''));
    if (!['draft', 'rejected'].includes(owned.listing.status)) fail(409, 'Only drafts or rejected listings can be resubmitted.');
    const rows = await db('marketplace_listings?id=eq.' + encodeURIComponent(owned.listing.id) +
      '&organization_id=eq.' + encodeURIComponent(orgId), {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'in_review', review_note: null, reviewed_by: null, reviewed_at: null })
      });
    await audit(orgId, user.id, 'marketplace.listing_submitted', 'marketplace_listing', owned.listing.id, 'success');
    return send(res, 200, { listing: Array.isArray(rows) ? rows[0] : null, detail: 'Submitted for moderation. Publishing requires an authorized marketplace reviewer.' });
  }

  if (action === 'moderate-listing') {
    const ids = String(process.env.WHILO_MARKETPLACE_ADMIN_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!ids.includes(user.id)) fail(403, 'This account is not on the server-side marketplace moderator allowlist.');
    const listingId = String(body.listingId || '');
    if (!UUID_RE.test(listingId)) fail(400, 'Valid listingId is required.');
    const decision = String(body.decision || '');
    if (!['publish', 'reject'].includes(decision)) fail(400, 'Choose publish or reject.');
    const note = shortText(body.note || '', 500);
    const rows = await db('marketplace_listings?id=eq.' + encodeURIComponent(listingId) +
      '&status=eq.in_review&select=id,organization_id,seller_id', { method: 'GET' });
    if (!Array.isArray(rows) || !rows[0]) fail(404, 'A listing awaiting review was not found.');
    const patch = {
      status: decision === 'publish' ? 'published' : 'rejected',
      review_note: note || null, reviewed_by: user.id, reviewed_at: new Date().toISOString(),
      published_at: decision === 'publish' ? new Date().toISOString() : null
    };
    const updated = await db('marketplace_listings?id=eq.' + encodeURIComponent(listingId), {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch)
    });
    await audit(rows[0].organization_id, user.id, 'marketplace.listing_moderated', 'marketplace_listing', listingId, 'success', { decision });
    return send(res, 200, { listing: Array.isArray(updated) ? updated[0] : null });
  }

  if (action === 'install-free') {
    const listingId = String(body.listingId || '');
    if (!UUID_RE.test(listingId)) fail(400, 'Valid listingId is required.');
    const found = await db('marketplace_listings?id=eq.' + encodeURIComponent(listingId) +
      '&status=eq.published&select=id,organization_id,seller_id,pricing_model,price_minor,installs_count&limit=1');
    const listing = Array.isArray(found) ? found[0] : null;
    if (!listing) fail(404, 'Published listing not found.');
    if (listing.price_minor !== 0 || listing.pricing_model !== 'free') fail(402, 'This listing requires checkout.');
    if (listing.organization_id === orgId) fail(400, 'You cannot install your own listing as a buyer.');
    await db('marketplace_entitlements?on_conflict=listing_id,buyer_user_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ listing_id: listingId, buyer_organization_id: orgId, buyer_user_id: user.id, status: 'active' })
    });
    const installed = await db('rpc/install_marketplace_asset', {
      method: 'POST',
      body: JSON.stringify({ p_organization_id: orgId, p_buyer_user_id: user.id, p_listing_id: listingId })
    });
    const installation = Array.isArray(installed) ? installed[0] : null;
    await audit(orgId, user.id, 'marketplace.asset_installed', 'marketplace_listing', listingId, 'success', {
      access: 'free', installation_id: installation && installation.result_installation_id || null,
      asset_type: installation && installation.result_asset_type || null
    });
    return send(res, 200, {
      ok: true,
      installation,
      detail: installation && installation.result_asset_type === 'pet'
        ? 'Pet installed in your Whilo workspace. It will still follow your workspace permissions and approval policy.'
        : 'Asset added to your Whilo library. A Bot is available as a bounded asset; it does not execute until a task invokes it.'
    });
  }

  if (action === 'start-seller-onboarding') {
    if (!['owner', 'admin'].includes(member.role)) fail(403, 'Only a workspace owner or administrator can connect payouts.');
    if (body.acceptedTerms !== true) fail(400, 'Accept the creator terms before continuing.');
    let seller = await sellerFor(orgId, user.id);
    if (seller && seller.status === 'suspended') fail(403, 'This creator account is suspended.');
    if (!seller) {
      const rows = await db('marketplace_sellers', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          organization_id: orgId, user_id: user.id,
          display_name: shortText(body.displayName || (user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0], 80) || 'Whilo Creator',
          bio: shortText(body.bio || '', 1000), country_code: 'BR',
          status: 'pending', terms_accepted_at: new Date().toISOString()
        })
      });
      seller = Array.isArray(rows) ? rows[0] : null;
    } else {
      await db('marketplace_sellers?id=eq.' + encodeURIComponent(seller.id), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ terms_accepted_at: seller.terms_accepted_at || new Date().toISOString() })
      });
    }
    if (!seller) fail(503, 'Creator profile could not be saved.');
    let accountId = seller.stripe_account_id;
    if (!accountId) {
      const account = await stripeRequest('accounts', 'POST', {
        type: 'express', country: 'BR', email: user.email,
        business_type: ['individual', 'company'].includes(body.businessType) ? body.businessType : 'individual',
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { whilo_organization_id: orgId, whilo_user_id: user.id, whilo_seller_id: seller.id }
      }, 'whilo-connect-account-' + seller.id);
      accountId = account.id;
      await db('marketplace_sellers?id=eq.' + encodeURIComponent(seller.id), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ stripe_account_id: accountId, onboarding_started_at: new Date().toISOString() })
      });
    }
    const link = await stripeRequest('account_links', 'POST', {
      account: accountId, type: 'account_onboarding',
      refresh_url: baseUrl() + '/?marketplace_onboarding=refresh',
      return_url: baseUrl() + '/?marketplace_onboarding=returned'
    }, 'whilo-connect-link-' + seller.id + '-' + Math.floor(Date.now() / 60000));
    if (!link.url || !/^https:\/\/connect\.stripe\.com\//.test(link.url)) fail(502, 'The payment provider did not return a valid onboarding URL.');
    return send(res, 200, { ok: true, onboardingUrl: link.url, detail: 'Complete identity and payout checks on Stripe. This does not publish listings automatically.' });
  }

  if (action === 'checkout') {
    const listingId = String(body.listingId || '');
    if (!UUID_RE.test(listingId)) fail(400, 'Valid listingId is required.');
    const found = await db('marketplace_listings?id=eq.' + encodeURIComponent(listingId) +
      '&status=eq.published&select=id,organization_id,seller_id,title,summary,price_minor,pricing_model,currency&limit=1');
    const listing = Array.isArray(found) ? found[0] : null;
    if (!listing) fail(404, 'Published listing not found.');
    const sellerRows = await db('marketplace_sellers?id=eq.' + encodeURIComponent(listing.seller_id) + '&select=id,organization_id,status,stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled&limit=1');
    const seller = Array.isArray(sellerRows) ? sellerRows[0] : null;
    if (!seller) fail(409, 'Creator payout account is not available.');
    const order = await createCheckoutOrder(user, member, listing, seller);
    try {
      const fee = order.platform_fee_minor;
      const session = await stripeRequest('checkout/sessions', 'POST', {
        mode: 'payment',
        success_url: baseUrl() + '/?marketplace_purchase=success&session_id={CHECKOUT_SESSION_ID}',
        cancel_url: baseUrl() + '/?marketplace_purchase=cancelled',
        customer_email: user.email,
        client_reference_id: order.id,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: order.price_minor,
            product_data: { name: listing.title, description: shortText(listing.summary, 200) }
          }
        }],
        payment_intent_data: {
          application_fee_amount: fee,
          transfer_data: { destination: seller.stripe_account_id },
          metadata: { whilo_order_id: order.id, whilo_listing_id: listing.id, whilo_buyer_user_id: user.id }
        },
        metadata: { whilo_order_id: order.id, whilo_listing_id: listing.id, whilo_buyer_user_id: user.id }
      }, 'whilo-checkout-' + order.id);
      await db('marketplace_orders?id=eq.' + encodeURIComponent(order.id), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ stripe_checkout_session_id: session.id })
      });
      if (!session.url || !/^https:\/\/checkout\.stripe\.com\//.test(session.url)) fail(502, 'The payment provider did not return a valid checkout URL.');
      return send(res, 200, { ok: true, checkoutUrl: session.url, orderId: order.id, platformFeeBps: 2000 });
    } catch (error) {
      await db('marketplace_orders?id=eq.' + encodeURIComponent(order.id), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ state: 'failed', failure_reason: 'checkout_session_creation_failed' })
      }).catch(() => {});
      throw error;
    }
  }

  if (action === 'start-plan-checkout') {
    const plan = String(body.plan || '').toLowerCase();
    const interval = String(body.interval || 'monthly').toLowerCase();
    if (!PLANS.has(plan) || !['monthly', 'annual'].includes(interval)) fail(400, 'Choose a valid Whilo plan and billing interval.');
    if (!['owner', 'admin'].includes(member.role)) fail(403, 'Only a workspace owner or administrator can change billing.');
    const envName = 'STRIPE_PRICE_WHILO_' + plan.toUpperCase() + '_' + interval.toUpperCase();
    const priceId = String(process.env[envName] || '').trim();
    if (!priceId) {
      const error = new Error('Plan checkout is not configured yet. The workspace owner must create the recurring Stripe Price and add its ID to Vercel.');
      error.statusCode = 503; error.missingEnv = [envName]; throw error;
    }
    const existing = await db('whilo_subscriptions?organization_id=eq.' + encodeURIComponent(orgId) + '&select=status,stripe_subscription_id&limit=1');
    if (Array.isArray(existing) && existing[0] && ['active', 'trialing', 'past_due'].includes(existing[0].status)) {
      fail(409, 'This workspace already has a subscription. Manage or cancel the current subscription before changing plans.');
    }
    const session = await stripeRequest('checkout/sessions', 'POST', {
      mode: 'subscription',
      success_url: baseUrl() + '/?whilo_plan=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: baseUrl() + '/?whilo_plan=cancelled',
      customer_email: user.email,
      client_reference_id: orgId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { whilo_organization_id: orgId, whilo_user_id: user.id, whilo_plan_code: plan },
      subscription_data: { metadata: { whilo_organization_id: orgId, whilo_user_id: user.id, whilo_plan_code: plan } }
    }, 'whilo-plan-' + orgId + '-' + plan + '-' + interval + '-' + Math.floor(Date.now() / 300000));
    if (!session.url || !/^https:\/\/checkout\.stripe\.com\//.test(session.url)) fail(502, 'The payment provider did not return a valid checkout URL.');
    return send(res, 200, { ok: true, checkoutUrl: session.url });
  }

  return send(res, 400, { error: 'Unsupported marketplace action.' });
}

async function readRaw(req, maxBytes) {
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > maxBytes) fail(413, 'Webhook payload is too large.');
    return req.body;
  }
  if (typeof req.body === 'string') {
    const value = Buffer.from(req.body, 'utf8');
    if (value.length > maxBytes) fail(413, 'Webhook payload is too large.');
    return value;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const part = Buffer.from(chunk);
    size += part.length;
    if (size > maxBytes) fail(413, 'Webhook payload is too large.');
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}
function verifyStripeSignature(raw, signature, secret) {
  const pieces = String(signature || '').split(',').map(x => x.split('='));
  const time = (pieces.find(x => x[0] === 't') || [])[1];
  const v1 = pieces.filter(x => x[0] === 'v1').map(x => x[1]);
  const timestamp = Number(time);
  if (!Number.isFinite(timestamp) || !v1.length || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const signed = String(time) + '.' + raw.toString('utf8');
  const expected = crypto.createHmac('sha256', secret).update(signed).digest();
  return v1.some(hex => {
    if (!/^[a-f0-9]{64}$/i.test(hex)) return false;
    const supplied = Buffer.from(hex, 'hex');
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  });
}
async function syncSubscription(subscriptionId, forcedStatus) {
  if (!subscriptionId) return;
  const subscription = await stripeRequest('subscriptions/' + encodeURIComponent(subscriptionId), 'GET');
  const meta = subscription.metadata || {};
  const orgId = String(meta.whilo_organization_id || '');
  const userId = String(meta.whilo_user_id || '');
  const plan = String(meta.whilo_plan_code || '').toLowerCase();
  if (!UUID_RE.test(orgId) || !UUID_RE.test(userId) || !PLANS.has(plan)) return;
  const price = subscription.items && subscription.items.data && subscription.items.data[0] && subscription.items.data[0].price;
  const currentStatus = forcedStatus || ({
    active: 'active', trialing: 'trialing', past_due: 'past_due', paused: 'paused',
    canceled: 'cancelled', incomplete: 'incomplete', unpaid: 'unpaid'
  })[subscription.status] || 'incomplete';
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
  await db('whilo_subscriptions?on_conflict=organization_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      organization_id: orgId, user_id: userId, plan_code: plan,
      stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer && subscription.customer.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price && price.id || null,
      status: currentStatus, current_period_end: periodEnd,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
    })
  });
}
async function processWebhookEvent(event) {
  const obj = event.data && event.data.object || {};
  if (event.type === 'account.updated') {
    const rows = await db('marketplace_sellers?stripe_account_id=eq.' + encodeURIComponent(obj.id || '') + '&select=id');
    const seller = Array.isArray(rows) ? rows[0] : null;
    if (seller) {
      const enabled = Boolean(obj.charges_enabled && obj.payouts_enabled && obj.details_submitted);
      await db('marketplace_sellers?id=eq.' + encodeURIComponent(seller.id), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          stripe_charges_enabled: Boolean(obj.charges_enabled),
          stripe_payouts_enabled: Boolean(obj.payouts_enabled),
          stripe_details_submitted: Boolean(obj.details_submitted),
          status: enabled ? 'active' : 'pending',
          onboarding_completed_at: enabled ? new Date().toISOString() : null
        })
      });
    }
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    if (obj.mode === 'payment' && obj.payment_status === 'paid' || event.type === 'checkout.session.async_payment_succeeded') {
      const orderId = String((obj.metadata || {}).whilo_order_id || '');
      if (UUID_RE.test(orderId)) {
        const orders = await db('marketplace_orders?id=eq.' + encodeURIComponent(orderId) + '&select=id,listing_id,buyer_organization_id,buyer_user_id,state&limit=1');
        const order = Array.isArray(orders) ? orders[0] : null;
        if (order && order.state !== 'refunded' && order.state !== 'disputed') {
          await db('marketplace_orders?id=eq.' + encodeURIComponent(order.id), {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              state: 'paid', stripe_checkout_session_id: obj.id || null,
              stripe_payment_intent_id: typeof obj.payment_intent === 'string' ? obj.payment_intent : null,
              paid_at: new Date().toISOString(), failure_reason: null
            })
          });
          await db('marketplace_entitlements?on_conflict=listing_id,buyer_user_id', {
            method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({
              listing_id: order.listing_id, order_id: order.id,
              buyer_organization_id: order.buyer_organization_id,
              buyer_user_id: order.buyer_user_id, status: 'active'
            })
          });
          await db('rpc/install_marketplace_asset', {
            method: 'POST',
            body: JSON.stringify({
              p_organization_id: order.buyer_organization_id,
              p_buyer_user_id: order.buyer_user_id,
              p_listing_id: order.listing_id
            })
          });
        }
      }
    }
    if (obj.mode === 'subscription' && obj.subscription) await syncSubscription(String(obj.subscription));
  }
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const subscriptionId = obj.id || '';
    if (subscriptionId) await syncSubscription(subscriptionId);
  }
  if (event.type === 'customer.subscription.deleted') {
    const subId = String(obj.id || '');
    if (subId) {
      const rows = await db('whilo_subscriptions?stripe_subscription_id=eq.' + encodeURIComponent(subId) + '&select=id');
      if (Array.isArray(rows) && rows[0]) {
        await db('whilo_subscriptions?id=eq.' + encodeURIComponent(rows[0].id), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'cancelled', cancel_at_period_end: false })
        });
      }
    }
  }
  if (event.type === 'invoice.payment_failed') {
    const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription && obj.subscription.id;
    if (subId) {
      const rows = await db('whilo_subscriptions?stripe_subscription_id=eq.' + encodeURIComponent(subId) + '&select=id');
      if (Array.isArray(rows) && rows[0]) {
        await db('whilo_subscriptions?id=eq.' + encodeURIComponent(rows[0].id), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'past_due' })
        });
      }
    }
  }
  if (event.type === 'checkout.session.async_payment_failed') {
    const orderId = String((obj.metadata || {}).whilo_order_id || '');
    if (UUID_RE.test(orderId)) await db('marketplace_orders?id=eq.' + encodeURIComponent(orderId), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ state: 'failed', failure_reason: 'asynchronous_payment_failed' })
    });
  }
  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    const paymentIntent = typeof obj.payment_intent === 'string' ? obj.payment_intent : '';
    if (paymentIntent) {
      const rows = await db('marketplace_orders?stripe_payment_intent_id=eq.' + encodeURIComponent(paymentIntent) + '&select=id,listing_id,buyer_user_id');
      for (const order of Array.isArray(rows) ? rows : []) {
        const state = event.type === 'charge.refunded' ? 'refunded' : 'disputed';
        await db('marketplace_orders?id=eq.' + encodeURIComponent(order.id), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ state, refunded_at: state === 'refunded' ? new Date().toISOString() : null, disputed_at: state === 'disputed' ? new Date().toISOString() : null })
        });
        if (state === 'refunded') await db('marketplace_entitlements?listing_id=eq.' + encodeURIComponent(order.listing_id) + '&buyer_user_id=eq.' + encodeURIComponent(order.buyer_user_id), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'revoked', revoked_at: new Date().toISOString() })
        });
      }
    }
  }
}
async function handleWebhook(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    if (!secret) {
      const error = new Error('Stripe webhook is not configured.');
      error.statusCode = 503; error.missingEnv = ['STRIPE_WEBHOOK_SECRET']; throw error;
    }
    const raw = await readRaw(req, 1024 * 1024);
    const signature = req.headers['stripe-signature'];
    if (!verifyStripeSignature(raw, signature, secret)) return send(res, 400, { error: 'Invalid payment webhook signature.' });
    let event;
    try { event = JSON.parse(raw.toString('utf8')); } catch (_) { return send(res, 400, { error: 'Invalid webhook JSON.' }); }
    if (!event.id || !event.type) return send(res, 400, { error: 'Invalid payment webhook event.' });
    const inserted = await db('marketplace_webhook_events?on_conflict=stripe_event_id', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ stripe_event_id: event.id, event_type: event.type, processed_at: null })
    });
    if (!Array.isArray(inserted) || !inserted.length) {
      const prior = await db('marketplace_webhook_events?stripe_event_id=eq.' + encodeURIComponent(event.id) + '&select=processed_at&limit=1');
      if (Array.isArray(prior) && prior[0] && prior[0].processed_at) return send(res, 200, { received: true, duplicate: true });
    }
    await processWebhookEvent(event);
    await db('marketplace_webhook_events?stripe_event_id=eq.' + encodeURIComponent(event.id), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ processed_at: new Date().toISOString() })
    });
    return send(res, 200, { received: true });
  } catch (error) {
    return safeError(res, error);
  }
}
module.exports = async function marketplaceHandler(req, res) {
  try {
    return await handleMain(req, res);
  } catch (error) {
    return safeError(res, error);
  }
};
module.exports.webhook = handleWebhook;
