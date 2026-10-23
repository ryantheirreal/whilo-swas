'use strict';

const crypto = require('node:crypto');
const Stripe = require('stripe');
const { send, authenticate, organizationFor, db, readJson, safeError, audit, appUrl } = require('../../api/_lib/platform');

const CODE_RE = /^[A-Z0-9-]{4,24}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RANKS = [
  { id:'Seed', referrals:0, sales:0, reward:'20% direct subscription commission + 5% partner override' },
  { id:'Bronze', referrals:3, sales:50000, reward:'Bronze status and public profile badge' },
  { id:'Silver', referrals:10, sales:200000, reward:'Silver status and monthly partner clinic' },
  { id:'Gold', referrals:25, sales:750000, reward:'Gold status and launch-campaign access' },
  { id:'Platinum', referrals:50, sales:2500000, reward:'Platinum status and co-marketing eligibility' },
  { id:'Diamond', referrals:100, sales:10000000, reward:'Diamond status and priority partner reviews' },
  { id:'Apex', referrals:250, sales:50000000, reward:'Apex status and strategic campaign eligibility' },
  { id:'Sovereign', referrals:1000, sales:200000000, reward:'Sovereign status and partner advisory eligibility' }
];

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}
function cleanText(value,max) {
  return String(value == null ? '' : value).replace(/\s+/g,' ').trim().slice(0,max);
}
function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!/^sk_(test|live)_/.test(key)) {
    const error = new Error('Stripe Connect is not configured for affiliate payouts yet.');
    error.statusCode = 503;
    error.missingEnv = ['STRIPE_SECRET_KEY'];
    throw error;
  }
  return new Stripe(key);
}
async function stripeOperation(name, body, idempotencyKey) {
  const stripe = stripeClient();
  const opts = idempotencyKey ? { idempotencyKey } : undefined;
  try {
    if (name === 'account.create') return await stripe.accounts.create(body,opts);
    if (name === 'account.link') return await stripe.accountLinks.create(body,opts);
    if (name === 'transfer.create') return await stripe.transfers.create(body,opts);
    const error = new Error('Unsupported Stripe operation.');
    error.statusCode = 501;
    throw error;
  } catch (error) {
    if (error.statusCode === 501 || error.missingEnv) throw error;
    const wrapped = new Error('Stripe could not complete the affiliate request. Check Connect country/capability configuration.');
    wrapped.statusCode = Number(error.statusCode) >= 500 ? 502 : 400;
    throw wrapped;
  }
}
function publicBase() { return String(appUrl()).replace(/\/+$/,''); }
async function profile(userId) {
  const rows = await db('affiliate_profiles?user_id=eq.' + encodeURIComponent(userId) + '&select=*&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
function inFilter(values) { return 'in.(' + values.map(String).join(',') + ')'; }
function total(rows,field) { return (Array.isArray(rows) ? rows : []).reduce((sum,row)=>sum+Number(row[field]||0),0); }
function nextRank(current) {
  const i = RANKS.findIndex(r=>r.id===current);
  return RANKS[Math.min(RANKS.length-1,Math.max(0,i)+1)] || RANKS[RANKS.length-1];
}
async function getDashboard(user) {
  const current = await profile(user.id);
  if (!current) {
    const referral = await db('affiliate_referrals?referred_user_id=eq.'+encodeURIComponent(user.id)+'&select=affiliate_user_id,referral_code,status&limit=1');
    return { enrolled:false, referralAttribution:Array.isArray(referral)?referral[0]||null:null, ranks:RANKS };
  }
  await db('rpc/refresh_whilo_affiliate_tier',{method:'POST',body:JSON.stringify({p_user_id:user.id})});
  const now = new Date().toISOString();
  await db('affiliate_commissions?affiliate_user_id=eq.'+encodeURIComponent(user.id)+'&status=eq.pending&available_at=lte.'+encodeURIComponent(now),{
    method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'available'})
  });
  const refreshed = await profile(user.id) || current;
  const [referrals,commissions,payouts,subAffiliates] = await Promise.all([
    db('affiliate_referrals?affiliate_user_id=eq.'+encodeURIComponent(user.id)+'&select=referred_user_id,status,created_at,first_paid_at,first_paid_source&order=created_at.desc&limit=100'),
    db('affiliate_commissions?affiliate_user_id=eq.'+encodeURIComponent(user.id)+'&select=id,direct_affiliate_user_id,referred_user_id,source_type,source_id,source_amount_minor,currency,rate_bps,commission_minor,status,available_at,paid_at,payout_id,created_at&order=created_at.desc&limit=100'),
    db('affiliate_payouts?affiliate_user_id=eq.'+encodeURIComponent(user.id)+'&select=id,amount_minor,currency,status,requested_at,processed_at,failure_code&order=requested_at.desc&limit=25'),
    db('affiliate_profiles?parent_affiliate_user_id=eq.'+encodeURIComponent(user.id)+'&status=eq.active&select=user_id&limit=1000')
  ]);
  const referralRows = Array.isArray(referrals)?referrals:[];
  const commissionRows = Array.isArray(commissions)?commissions:[];
  const payoutRows = Array.isArray(payouts)?payouts:[];
  const subAffiliateRows = Array.isArray(subAffiliates)?subAffiliates:[];
  const referredIds=[...new Set(referralRows.map(r=>r.referred_user_id).filter(Boolean))];
  const parentIds=[refreshed.parent_affiliate_user_id].filter(Boolean);
  const [humanNames,parentNames] = await Promise.all([
    referredIds.length?db('profiles?id='+inFilter(referredIds)+'&select=id,display_name'):[],
    parentIds.length?db('profiles?id='+inFilter(parentIds)+'&select=id,display_name'):[]
  ]);
  const nameMap=new Map((Array.isArray(humanNames)?humanNames:[]).map(r=>[r.id,r.display_name||'Whilo member']));
  const parentMap=new Map((Array.isArray(parentNames)?parentNames:[]).map(r=>[r.id,r.display_name||'Whilo Partner']));
  const directRevenue=commissionRows.filter(r=>r.affiliate_user_id===user.id && r.direct_affiliate_user_id===user.id && r.status!=='reversed');
  const directSales=total(directRevenue,'source_amount_minor');
  const paidReferrals=referralRows.filter(r=>r.status==='qualified' && r.first_paid_at).length;
  const next=nextRank(refreshed.tier);
  const pending=commissionRows.filter(r=>r.status==='pending');
  const available=commissionRows.filter(r=>r.status==='available'&&!r.payout_id);
  const paid=commissionRows.filter(r=>r.status==='paid');
  const inPayout=payoutRows.filter(r=>['requested','processing'].includes(r.status));
  return {
    enrolled:true,
    profile:{
      userId:refreshed.user_id,code:refreshed.affiliate_code,displayName:refreshed.display_name,
      parentAffiliateUserId:refreshed.parent_affiliate_user_id,
      parentName:parentMap.get(refreshed.parent_affiliate_user_id)||null,
      tier:refreshed.tier,status:refreshed.status,termsAcceptedAt:refreshed.terms_accepted_at,
      payout:{connected:Boolean(refreshed.stripe_account_id),detailsSubmitted:Boolean(refreshed.stripe_details_submitted),transfersEnabled:Boolean(refreshed.stripe_transfers_enabled),payoutsEnabled:Boolean(refreshed.stripe_payouts_enabled)}
    },
    stats:{
      totalReferrals:referralRows.length,paidReferrals,directSalesMinor:directSales,
      totalEarnedMinor:total(commissionRows.filter(r=>r.status!=='reversed'),'commission_minor'),
      pendingMinor:total(pending,'commission_minor'),availableMinor:total(available,'commission_minor'),
      paidMinor:total(paid,'commission_minor'),inPayoutMinor:total(inPayout,'amount_minor'),
      activeSubAffiliates:subAffiliateRows.length
    },
    nextRank:next,
    ranks:RANKS,
    referralLink:publicBase()+'/?ref='+encodeURIComponent(refreshed.affiliate_code),
    referrals:referralRows.map(r=>({
      userId:r.referred_user_id,displayName:nameMap.get(r.referred_user_id)||'Whilo member',
      status:r.status,joinedAt:r.created_at,firstPaidAt:r.first_paid_at
    })),
    commissions:commissionRows.map(r=>({
      id:r.id,sourceType:r.source_type,sourceAmountMinor:Number(r.source_amount_minor),
      rateBps:r.rate_bps,commissionMinor:Number(r.commission_minor),currency:r.currency,
      status:r.status,availableAt:r.available_at,createdAt:r.created_at
    })),
    payouts:payoutRows.map(r=>({
      id:r.id,amountMinor:Number(r.amount_minor),currency:r.currency,status:r.status,
      requestedAt:r.requested_at,processedAt:r.processed_at,failureCode:r.failure_code
    }))
  };
}
async function handle(req,res) {
  if(req.method!=='POST') {
    res.setHeader('Allow','POST');
    return send(res,405,{error:'Method not allowed'});
  }
  const body=await readJson(req,20000);
  const action=String(body.action||'');
  const user=await authenticate(req);
  const member=await organizationFor(user);
  if(!member || !member.organization_id) fail(403,'A valid Whilo workspace is required.');
  if(action==='dashboard') return send(res,200,await getDashboard(user));

  if(action==='claim-referral') {
    const code=String(body.referralCode||'').trim().toUpperCase();
    if(!CODE_RE.test(code)) return send(res,200,{attributed:false,reason:'invalid_code'});
    const rows=await db('rpc/claim_whilo_affiliate_referral',{
      method:'POST',body:JSON.stringify({p_referred_user_id:user.id,p_affiliate_code:code,p_source:'link'})
    });
    const value=Array.isArray(rows)?rows[0]:rows;
    const attributed=value===true || value==='true' || (value && value.claim_whilo_affiliate_referral===true);
    if(attributed) await audit(member.organization_id,user.id,'affiliate.referral_attributed','affiliate_referral',user.id,'success',{code});
    return send(res,200,{attributed});
  }

  if(action==='enroll') {
    if(body.acceptedTerms!==true) fail(400,'Accept the Whilo Partner terms before enrolling.');
    const existing=await profile(user.id);
    if(existing) return send(res,200,{ok:true,profile:existing,detail:'Your Whilo Partner profile already exists.'});
    const displayName=cleanText(body.displayName || (user.user_metadata&&user.user_metadata.full_name) || String(user.email||'').split('@')[0] || 'Whilo Partner',80);
    const rows=await db('rpc/register_whilo_affiliate',{
      method:'POST',body:JSON.stringify({p_user_id:user.id,p_display_name:displayName||'Whilo Partner'})
    });
    const created=Array.isArray(rows)?rows[0]:rows;
    if(!created || !created.affiliate_code) fail(503,'The affiliate profile could not be provisioned.');
    await audit(member.organization_id,user.id,'affiliate.enrolled','affiliate_profile',user.id,'success',{tier:created.tier});
    return send(res,201,{ok:true,profile:created,detail:'You are enrolled in Whilo Partners. Commission is earned only on eligible paid sales.'});
  }

  if(action==='start-payout-onboarding') {
    const affiliate=await profile(user.id);
    if(!affiliate || affiliate.status!=='active') fail(403,'Enroll in Whilo Partners before connecting payouts.');
    let accountId=affiliate.stripe_account_id;
    if(!accountId) {
      const account=await stripeOperation('account.create',{
        type:'express',country:'BR',email:user.email,
        business_type:'individual',
        capabilities:{transfers:{requested:true}},
        metadata:{whilo_affiliate_user_id:user.id,whilo_affiliate_code:affiliate.affiliate_code}
      },'whilo-affiliate-account-'+user.id);
      accountId=account.id;
      await db('affiliate_profiles?user_id=eq.'+encodeURIComponent(user.id),{
        method:'PATCH',headers:{Prefer:'return=minimal'},
        body:JSON.stringify({stripe_account_id:accountId})
      });
    }
    const link=await stripeOperation('account.link',{
      account:accountId,type:'account_onboarding',
      refresh_url:publicBase()+'/?affiliate_onboarding=refresh',
      return_url:publicBase()+'/?affiliate_onboarding=returned'
    },'whilo-affiliate-link-'+user.id+'-'+Math.floor(Date.now()/60000));
    if(!link.url || !/^https:\/\/connect\.stripe\.com\//.test(link.url)) fail(502,'Stripe did not return a valid account onboarding URL.');
    return send(res,200,{ok:true,onboardingUrl:link.url,detail:'Complete the identity and payout checks in Stripe. Payout requests remain subject to Whilo review.'});
  }

  if(action==='request-payout') {
    const affiliate=await profile(user.id);
    if(!affiliate || affiliate.status!=='active') fail(403,'Active Whilo Partner status is required.');
    if(!affiliate.stripe_account_id || !affiliate.stripe_details_submitted || !affiliate.stripe_transfers_enabled || !affiliate.stripe_payouts_enabled) {
      fail(409,'Finish Stripe identity and payout onboarding before requesting a transfer.');
    }
    await db('affiliate_commissions?affiliate_user_id=eq.'+encodeURIComponent(user.id)+'&status=eq.pending&available_at=lte.'+encodeURIComponent(new Date().toISOString()),{
      method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'available'})
    });
    const rows=await db('rpc/request_whilo_affiliate_payout',{method:'POST',body:JSON.stringify({p_user_id:user.id})});
    const payout=Array.isArray(rows)?rows[0]:rows;
    if(!payout || !payout.payout_id) fail(503,'A payout request could not be recorded.');
    await audit(member.organization_id,user.id,'affiliate.payout_requested','affiliate_payout',payout.payout_id,'success',{amount_minor:Number(payout.amount_minor)});
    return send(res,201,{ok:true,payout,detail:'Payout request recorded. Funds are not sent until the Whilo payout reviewer approves it.'});
  }

  const admins=String(process.env.WHILO_AFFILIATE_PAYOUT_ADMIN_USER_IDS||process.env.WHILO_MARKETPLACE_ADMIN_USER_IDS||'')
    .split(',').map(x=>x.trim()).filter(Boolean);
  if(action==='payout-queue') {
    if(!admins.includes(user.id)) fail(403,'This account is not authorized to review affiliate payouts.');
    const rows=await db('affiliate_payouts?status=in.(requested,failed)&select=id,affiliate_user_id,amount_minor,currency,status,requested_at,failure_code&order=requested_at.asc&limit=100');
    const payouts=Array.isArray(rows)?rows:[];
    const ids=[...new Set(payouts.map(p=>p.affiliate_user_id).filter(Boolean))];
    const profiles=ids.length?await db('affiliate_profiles?user_id='+inFilter(ids)+'&select=user_id,affiliate_code,display_name,stripe_account_id,stripe_transfers_enabled,stripe_payouts_enabled,stripe_details_submitted'):[]; 
    const pmap=new Map((Array.isArray(profiles)?profiles:[]).map(p=>[p.user_id,p]));
    return send(res,200,{payouts:payouts.map(p=>Object.assign({},p,{affiliate:pmap.get(p.affiliate_user_id)||null}))});
  }

  if(action==='process-payout') {
    if(!admins.includes(user.id)) fail(403,'This account is not authorized to execute affiliate payouts.');
    const payoutId=String(body.payoutId||'');
    if(!UUID_RE.test(payoutId)) fail(400,'A valid payout ID is required.');
    const rows=await db('affiliate_payouts?id=eq.'+encodeURIComponent(payoutId)+'&status=in.(requested,failed)&select=*&limit=1');
    const payout=Array.isArray(rows)?rows[0]:null;
    if(!payout) fail(404,'An eligible payout request was not found.');
    const afRows=await db('affiliate_profiles?user_id=eq.'+encodeURIComponent(payout.affiliate_user_id)+'&select=user_id,stripe_account_id,stripe_details_submitted,stripe_transfers_enabled,stripe_payouts_enabled,status&limit=1');
    const af=Array.isArray(afRows)?afRows[0]:null;
    if(!af || af.status!=='active' || !af.stripe_account_id || !af.stripe_details_submitted || !af.stripe_transfers_enabled || !af.stripe_payouts_enabled) {
      fail(409,'Affiliate Connect account is not fully enabled for transfers and payouts.');
    }
    const [itemRows,openAdjustments] = await Promise.all([
      db('affiliate_payout_items?payout_id=eq.'+encodeURIComponent(payout.id)+'&select=commission_id,amount_minor'),
      db('affiliate_adjustments?affiliate_user_id=eq.'+encodeURIComponent(payout.affiliate_user_id)+'&status=eq.open&select=id,amount_minor,payout_id')
    ]);
    const items = Array.isArray(itemRows) ? itemRows : [];
    const commissionIds = [...new Set(items.map(item=>item.commission_id).filter(Boolean))];
    const commissionRows = commissionIds.length
      ? await db('affiliate_commissions?id=in.('+commissionIds.join(',')+')&select=id,status,payout_id,commission_minor')
      : [];
    const commissionMap = new Map((Array.isArray(commissionRows)?commissionRows:[]).map(row=>[row.id,row]));
    const itemGross = items.reduce((sum,item)=>sum+Number(item.amount_minor||0),0);
    const adjustmentRows = Array.isArray(openAdjustments)?openAdjustments:[];
    const attachedDebt = adjustmentRows.filter(row=>row.payout_id===payout.id).reduce((sum,row)=>sum+Number(row.amount_minor||0),0);
    const newDebt = adjustmentRows.filter(row=>!row.payout_id).reduce((sum,row)=>sum+Number(row.amount_minor||0),0);
    const expectedNet = itemGross - attachedDebt - newDebt;
    const ledgerChanged = !items.length || items.some(item=>{
      const row=commissionMap.get(item.commission_id);
      return !row || row.status!=='available' || row.payout_id!==payout.id;
    }) || expectedNet !== Number(payout.amount_minor);
    if (ledgerChanged) {
      await db('affiliate_payouts?id=eq.'+encodeURIComponent(payout.id),{
        method:'PATCH',headers:{Prefer:'return=minimal'},
        body:JSON.stringify({status:'cancelled',failure_code:'ledger_changed_request_new'})
      });
      await db('affiliate_payout_items?payout_id=eq.'+encodeURIComponent(payout.id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
      await db('affiliate_commissions?payout_id=eq.'+encodeURIComponent(payout.id)+'&status=eq.available',{
        method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({payout_id:null})
      });
      await db('affiliate_adjustments?payout_id=eq.'+encodeURIComponent(payout.id)+'&status=eq.open',{
        method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({payout_id:null})
      });
      fail(409,'The commission ledger changed after this payout was requested. The request was cancelled safely; ask the partner to refresh the balance and request a new payout.');
    }
    const claimed=await db('affiliate_payouts?id=eq.'+encodeURIComponent(payoutId)+'&status=in.(requested,failed)',{
      method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'processing',failure_code:null})
    });
    if(!Array.isArray(claimed)||!claimed[0]) fail(409,'Payout could not be claimed for processing.');
    let transfer;
    try {
      transfer=await stripeOperation('transfer.create',{
        amount:Number(payout.amount_minor),currency:'brl',destination:af.stripe_account_id,
        metadata:{whilo_affiliate_payout_id:payout.id,whilo_affiliate_user_id:payout.affiliate_user_id},
        transfer_group:'whilo_affiliate_'+payout.id
      },payout.idempotency_key);
    } catch(error) {
      await db('affiliate_payouts?id=eq.'+encodeURIComponent(payout.id),{
        method:'PATCH',headers:{Prefer:'return=minimal'},
        body:JSON.stringify({status:'failed',failure_code:'stripe_transfer_failed'})
      }).catch(()=>{});
      throw error;
    }
    await db('affiliate_payouts?id=eq.'+encodeURIComponent(payout.id),{
      method:'PATCH',headers:{Prefer:'return=minimal'},
      body:JSON.stringify({status:'paid',stripe_transfer_id:transfer.id,processed_at:new Date().toISOString(),failure_code:null})
    });
    await db('affiliate_commissions?payout_id=eq.'+encodeURIComponent(payout.id),{
      method:'PATCH',headers:{Prefer:'return=minimal'},
      body:JSON.stringify({status:'paid',paid_at:new Date().toISOString()})
    });
    await db('affiliate_adjustments?payout_id=eq.'+encodeURIComponent(payout.id)+'&status=eq.open',{
      method:'PATCH',headers:{Prefer:'return=minimal'},
      body:JSON.stringify({status:'applied',applied_at:new Date().toISOString()})
    });
    await audit(member.organization_id,user.id,'affiliate.payout_paid','affiliate_payout',payout.id,'success',{transferId:transfer.id,amount_minor:Number(payout.amount_minor)});
    return send(res,200,{ok:true,payoutId:payout.id,transferId:transfer.id,status:'paid'});
  }

  return send(res,400,{error:'Unsupported affiliate action.'});
}

module.exports=async function affiliatesHandler(req,res) {
  try { return await handle(req,res); }
  catch(error) { return safeError(res,error); }
};
