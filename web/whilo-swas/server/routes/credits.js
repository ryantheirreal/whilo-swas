'use strict';

const Stripe = require('stripe');
const { send, authenticate, organizationFor, db, readJson, safeError, appUrl } = require('../../api/_lib/platform');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PACKS = Object.freeze({
  starter: { id:'starter', name:'Starter', amountMinor:990, credits:990, label:'R$ 9,90' },
  builder: { id:'builder', name:'Builder', amountMinor:2990, credits:2990, label:'R$ 29,90' },
  studio: { id:'studio', name:'Studio', amountMinor:9990, credits:9990, label:'R$ 99,90' },
  scale: { id:'scale', name:'Scale', amountMinor:24990, credits:24990, label:'R$ 249,90' }
});
function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}
function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!/^(?:sk|rk)_(test|live)_/.test(key)) {
    const error = new Error('Stripe Checkout is not configured for Willow Bucks top-ups.');
    error.statusCode = 503; error.missingEnv = ['STRIPE_SECRET_KEY']; throw error;
  }
  return new Stripe(key);
}
function baseUrl() {
  const value = String(appUrl()).replace(/\/+$/,'');
  return value;
}
async function rawBody(req, maxBytes) {
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > maxBytes) fail(413, 'Webhook payload is too large.');
    return req.body;
  }
  if (typeof req.body === 'string') {
    const value = Buffer.from(req.body,'utf8');
    if (value.length > maxBytes) fail(413, 'Webhook payload is too large.');
    return value;
  }
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    const part=Buffer.from(chunk); size+=part.length;
    if (size>maxBytes) fail(413,'Webhook payload is too large.');
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}
async function walletSnapshot(user, member) {
  await db('whilo_credit_wallets?on_conflict=organization_id', {
    method:'POST', headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},
    body:JSON.stringify({organization_id:member.organization_id})
  });
  const [walletRows,ledgerRows]=await Promise.all([
    db('whilo_credit_wallets?organization_id=eq.'+encodeURIComponent(member.organization_id)+'&select=balance_wb,total_purchased_wb,total_spent_wb,recovery_debt_wb&limit=1'),
    db('whilo_credit_ledger?organization_id=eq.'+encodeURIComponent(member.organization_id)+'&select=id,kind,amount_wb,balance_after_wb,amount_paid_minor,currency,pack_id,created_at,reference&order=created_at.desc&limit=20')
  ]);
  const wallet=Array.isArray(walletRows)&&walletRows[0]?walletRows[0]:{balance_wb:0,total_purchased_wb:0,total_spent_wb:0};
  return {
    wallet:{balanceWB:Number(wallet.balance_wb||0),totalPurchasedWB:Number(wallet.total_purchased_wb||0),totalSpentWB:Number(wallet.total_spent_wb||0),recoveryDebtWB:Number(wallet.recovery_debt_wb||0)},
    ledger:(Array.isArray(ledgerRows)?ledgerRows:[]).map(row=>({
      id:row.id,kind:row.kind,amountWB:Number(row.amount_wb),balanceAfterWB:Number(row.balance_after_wb),
      amountPaidMinor:Number(row.amount_paid_minor||0),currency:row.currency,packId:row.pack_id,createdAt:row.created_at
    })),
    packs:Object.values(PACKS).map(pack=>({id:pack.id,name:pack.name,amountMinor:pack.amountMinor,creditsWB:pack.credits,label:pack.label,currency:'BRL'})),
    policy:{
      currencyLike:false,transferable:false,redeemable:false,nominalValueBRLCentsPerWB:1,
      costCapPercent:40,contributionBeforeOtherCostsPercent:60,profitTargetBeforeVariableTaxAndOtherUnmeasuredCostsPercent:25,
      disclosure:'Willow Bucks are non-transferable Whilo usage credits, not cash, crypto, or a bank balance. Credit purchase price is fixed by Whilo. Usage costs must be metered server-side; actual margin depends on provider usage, payment fees, taxes and infrastructure.'
    }
  };
}
async function createCheckout(user, member, body) {
  const pack=PACKS[String(body.packId||'')];
  if(!pack) fail(400,'Choose one of the published Willow Bucks credit packs.');
  const requestId=String(body.requestId||'').trim();
  if(!/^[A-Za-z0-9:_-]{8,100}$/.test(requestId)) {
    fail(400,'A valid checkout request ID is required so retries can be idempotent.');
  }
  const base=baseUrl();
  const session=await stripeClient().checkout.sessions.create({
    mode:'payment',
    line_items:[{
      price_data:{
        currency:'brl',
        unit_amount:pack.amountMinor,
        product_data:{
          name:'Whilo Willow Bucks — '+pack.name,
          description:pack.credits+' WB for Whilo usage. Non-transferable; not cash or cryptocurrency.'
        }
      },quantity:1
    }],
    client_reference_id:user.id,
    metadata:{
      whilo_credit_pack_id:pack.id,
      whilo_credit_amount:String(pack.credits),
      whilo_organization_id:member.organization_id,
      whilo_user_id:user.id
    },
    success_url:base+'/?credits=success&session_id={CHECKOUT_SESSION_ID}',
    cancel_url:base+'/?credits=cancelled'
  },{idempotencyKey:'whilo-wb-checkout-'+member.organization_id+'-'+user.id+'-'+pack.id+'-'+requestId});
  if(!session.url || !/^https:\/\/checkout\.stripe\.com\//.test(session.url)) fail(502,'Stripe Checkout did not return a valid URL.');
  return {checkoutUrl:session.url,sessionId:session.id,pack:{id:pack.id,name:pack.name,amountMinor:pack.amountMinor,creditsWB:pack.credits}};
}
async function handle(req,res) {
  if(req.method==='GET') {
    const user=await authenticate(req);
    const member=await organizationFor(user);
    return send(res,200,await walletSnapshot(user,member));
  }
  if(req.method!=='POST') { res.setHeader('Allow','GET, POST'); return send(res,405,{error:'Method not allowed'}); }
  const body=await readJson(req,12000);
  const user=await authenticate(req);
  const member=await organizationFor(user);
  const action=String(body.action||'');
  if(action==='create-checkout') return send(res,201,await createCheckout(user,member,body));
  return send(res,400,{error:'Unsupported Willow Bucks action.'});
}
async function findCreditCheckoutForCharge(charge) {
  const paymentIntent = charge && charge.payment_intent;
  const paymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent && paymentIntent.id;
  if (!paymentIntentId) return null;

  const stripe = stripeClient();
  const listed = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 10 });
  const session = (listed.data || []).find(item => {
    const meta = item && item.metadata || {};
    return item && item.id && meta.whilo_credit_pack_id && meta.whilo_organization_id && meta.whilo_user_id;
  });
  if (!session) return null;

  const meta = session.metadata || {};
  const organizationId = String(meta.whilo_organization_id || '');
  const userId = String(meta.whilo_user_id || '');
  const pack = PACKS[String(meta.whilo_credit_pack_id || '')];
  const creditAmount = Number(meta.whilo_credit_amount);
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(userId) || !pack ||
      creditAmount !== pack.credits || session.client_reference_id !== userId ||
      session.mode !== 'payment' || String(session.currency || '').toLowerCase() !== 'brl' ||
      Number(session.amount_total) !== pack.amountMinor) {
    fail(400, 'Stripe charge does not match a published Willow Bucks Checkout session.');
  }

  const purchaseRows = await db('whilo_credit_ledger?provider_session_id=eq.' + encodeURIComponent(session.id) +
    '&organization_id=eq.' + encodeURIComponent(organizationId) +
    '&user_id=eq.' + encodeURIComponent(userId) +
    '&kind=eq.topup&select=provider_session_id,pack_id,amount_wb,amount_paid_minor&limit=1');
  const purchase = Array.isArray(purchaseRows) ? purchaseRows[0] : null;
  if (!purchase) {
    // Stripe retries a non-2xx webhook; do not silently drop an out-of-order refund.
    fail(503, 'The verified credit purchase ledger is not committed yet; Stripe should retry this webhook.');
  }
  if (purchase.pack_id !== pack.id || Number(purchase.amount_wb) !== pack.credits ||
      Number(purchase.amount_paid_minor) !== pack.amountMinor) {
    fail(409, 'Credit purchase ledger does not match the verified Stripe session.');
  }
  return { session, organizationId, userId, pack };
}

async function handleCreditReversalEvent(event) {
  const object = event.data && event.data.object || {};
  const isDispute = event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed';
  let charge = object;

  if (isDispute) {
    const chargeRef = object.charge;
    const chargeId = typeof chargeRef === 'string' ? chargeRef : chargeRef && chargeRef.id;
    if (!chargeId) return sendReversalIgnored();
    charge = await stripeClient().charges.retrieve(chargeId);
  }
  const purchase = await findCreditCheckoutForCharge(charge);
  if (!purchase) return sendReversalIgnored();

  let reason = 'refund';
  let refundTotalMinor = Number(charge.amount_refunded || 0);
  if (event.type === 'charge.dispute.created') {
    reason = 'dispute_opened';
    refundTotalMinor = purchase.pack.amountMinor;
  } else if (event.type === 'charge.dispute.closed') {
    if (String(object.status || '').toLowerCase() === 'won') {
      reason = 'dispute_won';
      // Re-evaluate the actual refunded total from the current Charge object.
      refundTotalMinor = Number(charge.amount_refunded || 0);
    } else if (String(object.status || '').toLowerCase() === 'lost') {
      reason = 'dispute_opened';
      refundTotalMinor = purchase.pack.amountMinor;
    } else {
      return sendReversalIgnored();
    }
  }

  if (!Number.isSafeInteger(refundTotalMinor) || refundTotalMinor < 0) {
    fail(400, 'Stripe returned an invalid cumulative refund amount.');
  }
  const reversal = await db('rpc/reverse_whilo_credit_purchase', {
    method: 'POST',
    body: JSON.stringify({
      p_organization_id: purchase.organizationId,
      p_user_id: purchase.userId,
      p_provider_event_id: String(event.id),
      p_provider_session_id: String(purchase.session.id),
      p_refund_total_minor: refundTotalMinor,
      p_reason: reason,
      p_metadata: {
        stripe_event_type: String(event.type),
        stripe_charge_id: String(charge.id || ''),
        stripe_payment_intent_id: String(typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent && charge.payment_intent.id || ''),
        currency: String(charge.currency || 'brl').toLowerCase(),
        amount_refunded_minor: refundTotalMinor
      }
    })
  });
  const value = Array.isArray(reversal) ? reversal[0] : reversal;
  return sendWebhookReceipt({
    received: true,
    reversed: Boolean(value && value.reversed),
    duplicate: Boolean(value && value.duplicate),
    deltaWB: Number(value && value.delta_wb || 0),
    reason
  });
}

function sendReversalIgnored() {
  return sendWebhookReceipt({ received: true, ignored: true });
}
function sendWebhookReceipt(body) {
  // The caller returns this object to the webhook handler; keep response emission in one place.
  return body;
}

async function handleWebhook(req,res) {
  if(req.method!=='POST') { res.setHeader('Allow','POST'); return send(res,405,{error:'Method not allowed'}); }
  try {
    const secret=String(process.env.STRIPE_CREDITS_WEBHOOK_SECRET||process.env.STRIPE_WEBHOOK_SECRET||'').trim();
    if(!secret) { const e=new Error('Stripe webhook is not configured.');e.statusCode=503;e.missingEnv=['STRIPE_WEBHOOK_SECRET'];throw e; }
    const raw=await rawBody(req,1024*1024);
    let event;
    try { event=stripeClient().webhooks.constructEvent(raw,req.headers['stripe-signature'],secret); }
    catch(_) { return send(res,400,{error:'Invalid payment webhook signature or payload.'}); }
    if(!event || !event.id || !event.type) return send(res,400,{error:'Invalid Stripe webhook event.'});

    if (['charge.refunded','charge.dispute.created','charge.dispute.closed'].includes(event.type)) {
      const receipt = await handleCreditReversalEvent(event);
      return send(res,200,receipt);
    }

    if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) {
      return send(res,200,{received:true,ignored:true});
    }
    const session=event.data&&event.data.object||{};
    if(session.mode!=='payment'||session.payment_status!=='paid') {
      return send(res,200,{received:true,ignored:true});
    }
    const meta=session.metadata||{};
    const orgId=String(meta.whilo_organization_id||'');
    const userId=String(meta.whilo_user_id||'');
    const pack=PACKS[String(meta.whilo_credit_pack_id||'')];
    const expectedCredits=Number(meta.whilo_credit_amount);
    if(!UUID_RE.test(orgId)||!UUID_RE.test(userId)||!pack||expectedCredits!==pack.credits||
      session.client_reference_id!==userId||String(session.currency||'').toLowerCase()!=='brl'||
      Number(session.amount_total)!==pack.amountMinor||!session.id) {
      return send(res,400,{error:'Checkout session does not match a published Willow Bucks pack.'});
    }
    const result=await db('rpc/apply_whilo_credit_purchase',{
      method:'POST',
      body:JSON.stringify({
        p_organization_id:orgId,p_user_id:userId,p_provider_event_id:event.id,
        p_provider_session_id:session.id,p_pack_id:pack.id,p_credit_amount:pack.credits,
        p_paid_amount_minor:pack.amountMinor,p_currency:'brl',
        p_metadata:{stripe_event_type:event.type,payment_status:session.payment_status||'paid'}
      })
    });
    const value=Array.isArray(result)?result[0]:result;
    return send(res,200,{received:true,credited:Boolean(value&&value.credited),duplicate:Boolean(value&&value.duplicate),
      recoveryDebtRepaidWB:Number(value&&value.recovery_debt_repaid_wb||0)});
  } catch(error) { return safeError(res,error); }
}
module.exports=async function creditsHandler(req,res) {
  try { return await handle(req,res); }
  catch(error) { return safeError(res,error); }
};
module.exports.webhook=handleWebhook;
