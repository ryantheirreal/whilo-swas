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
  if (!/^sk_(test|live)_/.test(key)) {
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
    db('whilo_credit_wallets?organization_id=eq.'+encodeURIComponent(member.organization_id)+'&select=balance_wb,total_purchased_wb,total_spent_wb&limit=1'),
    db('whilo_credit_ledger?organization_id=eq.'+encodeURIComponent(member.organization_id)+'&select=id,kind,amount_wb,balance_after_wb,amount_paid_minor,currency,pack_id,created_at,reference&order=created_at.desc&limit=20')
  ]);
  const wallet=Array.isArray(walletRows)&&walletRows[0]?walletRows[0]:{balance_wb:0,total_purchased_wb:0,total_spent_wb:0};
  return {
    wallet:{balanceWB:Number(wallet.balance_wb||0),totalPurchasedWB:Number(wallet.total_purchased_wb||0),totalSpentWB:Number(wallet.total_spent_wb||0)},
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
  const base=baseUrl();
  const session=await stripeClient().checkout.sessions.create({
    mode:'payment',
    payment_method_types:['card'],
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
  },{idempotencyKey:'whilo-wb-checkout-'+member.organization_id+'-'+user.id+'-'+pack.id+'-'+Date.now()});
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
    return send(res,200,{received:true,credited:Boolean(value&&value.credited),duplicate:Boolean(value&&value.duplicate)});
  } catch(error) { return safeError(res,error); }
}
module.exports=async function creditsHandler(req,res) {
  try { return await handle(req,res); }
  catch(error) { return safeError(res,error); }
};
module.exports.webhook=handleWebhook;
