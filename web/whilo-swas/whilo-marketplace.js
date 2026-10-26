(function () {
  'use strict';
  if (window.__whiloMarketplaceLoaded) return;
  window.__whiloMarketplaceLoaded = true;

  const DEMO = [
    {id:'sample-pipeline-scout',listing_type:'pet',title:'Pipeline Scout Pet',summary:'Research prospects, enrich a list and prepare a reviewed outreach queue.',category:'Revenue',price_minor:12900,currency:'BRL',version:'1.0.0',seller:{display_name:'Whilo Studio'},demo:true},
    {id:'sample-research-bot',listing_type:'bot',title:'Research Brief Bot',summary:'Turn a research question into a sourced brief with an evidence checklist.',category:'Research',price_minor:0,currency:'BRL',version:'1.0.0',seller:{display_name:'Whilo Studio'},demo:true},
    {id:'sample-growth-playbook',listing_type:'playbook',title:'B2B Growth Sprint',summary:'ICP, offer, creative, CRM hygiene and a weekly performance review.',category:'Marketing',price_minor:4900,currency:'BRL',version:'1.0.0',seller:{display_name:'Whilo Studio'},demo:true},
    {id:'sample-data-skill',listing_type:'skill',title:'Revenue Data Analyst',summary:'Turn supplied business data into a decision-ready report.',category:'Analytics',price_minor:0,currency:'BRL',version:'1.0.0',seller:{display_name:'Whilo Studio'},demo:true},
    {id:'sample-ops-pet',listing_type:'pet',title:'Operations Companion',summary:'Own recurring SOP reviews, flag exceptions and prepare changes for approval.',category:'Operations',price_minor:19900,currency:'BRL',version:'1.0.0',seller:{display_name:'Whilo Studio'},demo:true},
    {id:'sample-qa-bot',listing_type:'bot',title:'QA Verifier Bot',summary:'Check deliverables against acceptance criteria and return a verification receipt.',category:'Engineering',price_minor:2900,currency:'BRL',version:'1.0.0',seller:{display_name:'Whilo Studio'},demo:true}
  ];
  const PLANS = [
    {id:'free',name:'Free',monthly:0,annual:0,tag:'Explore',desc:'Learn the Whilo workflow before committing.',features:['Chat and task workspace','Public marketplace browsing','Small trial allowance','Sample Pets and Bots']},
    {id:'plus',name:'Plus',monthly:39.9,annual:399,tag:'Start here',desc:'For an individual operator.',features:['Core Chat and Tasks','Bounded monthly execution budget','A few active Pets','Basic integrations']},
    {id:'premium',name:'Premium',monthly:169.9,annual:1699,tag:'Most popular',desc:'For power users and creators.',features:['Larger execution budget','More active Pets and parallel Bots','Advanced model options','Cloud history and creator analytics']},
    {id:'super',name:'Super',monthly:399.9,annual:3999,tag:'Teams',desc:'For small teams delivering repeatable work.',features:['Shared workspace and roles','Higher concurrency ceilings','Recurring routines','Audit and export controls']},
    {id:'ultra',name:'Ultra',monthly:999.9,annual:9999,tag:'High throughput',desc:'For agencies and heavy operators.',features:['Higher budgets and concurrency','Advanced runtime access when enabled','Usage alerts and priority support','Multiple client workflows']}
  ];
  const TYPES = {pet:'Pet',bot:'Bot',skill:'Skill',playbook:'Playbook',template:'Template'};
  const ICONS = {pet:'◉',bot:'✳',skill:'⌘',playbook:'▤',template:'▧'};
  const money = function (cents) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(cents)||0)/100); };
  const esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  const norm = function (v) { return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); };
  const portuguese = /pt/i.test(document.documentElement.lang || '');
  let live = false, loading = false, saving = false, listings = [];
  let page = 'discover', filter = 'all', query = '', billingInterval = 'monthly', feedback = '';
  let creator = {session:false,dashboard:null}, library = {session:false,installations:[],error:''}, moderation = {items:[],error:''}, authMode = 'signin';

  const host = document.createElement('div');
  host.id = 'whilo-marketplace-root';
  const root = host.attachShadow ? host.attachShadow({mode:'open'}) : host;
  const style = document.createElement('style');
  style.textContent =
    ':host{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#eaf1fb}*{box-sizing:border-box}' +
    '.veil{position:fixed;inset:0;z-index:2147483647;background:#04080ecc;backdrop-filter:blur(12px);display:none;align-items:center;justify-content:center;padding:20px}' +
    '.veil.open{display:flex}.panel{width:min(1240px,100%);height:min(920px,96dvh);background:#0a1019;border:1px solid #28384d;border-radius:22px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 100px #000a}' +
    '.head{display:flex;align-items:center;gap:13px;padding:17px 22px;border-bottom:1px solid #233146;background:linear-gradient(125deg,#101d2d,#0a1019)}' +
    '.mark{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(140deg,#bdf0e1,#a9b9ff);color:#10212b;font-weight:900;font-size:20px}.brand{flex:1;min-width:0}.eyebrow{font-size:10px;font-weight:850;letter-spacing:.16em;text-transform:uppercase;color:#8fa5c2}h1{font-size:22px;letter-spacing:-.04em;margin:5px 0}.sub{font-size:11px;color:#92a6be}.close{width:38px;height:38px;border:1px solid #35445a;border-radius:12px;background:#172230;color:#d9e5f4;font-size:22px}' +
    '.nav{display:flex;gap:6px;padding:9px 18px;border-bottom:1px solid #233146;overflow-x:auto}.nav button,.filter{border:1px solid transparent;background:transparent;color:#90a2bb;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;white-space:nowrap}.nav button.active,.filter.active{background:#1a2b3e;border-color:#30475e;color:#d8f5ec}.content{padding:20px 22px;overflow:auto;min-height:0;flex:1}.hero{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:3px 0 17px}.hero h2{font-size:27px;letter-spacing:-.045em;margin:6px 0 8px;line-height:1.12}.hero p{font-size:12px;line-height:1.6;color:#96a8bf;max-width:690px;margin:0}.pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}.pill{font-size:10px;background:#172536;border:1px solid #2b3d52;color:#bdcadd;padding:5px 8px;border-radius:999px}.pill.preview{background:#352817;border-color:#594529;color:#f0d19b}.pill.live{background:#13382e;border-color:#245c4c;color:#b6f0d9}' +
    '.toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:13px 0}.field,input,select,textarea{font:inherit;width:100%;min-width:0;color:#e6eef8;background:#0b1420;border:1px solid #2b3b50;border-radius:10px;padding:11px 12px;outline:none}.field:focus,input:focus,select:focus,textarea:focus{border-color:#8bdcc8;box-shadow:0 0 0 3px #8bdcc81a}.search{flex:1;min-width:190px}.btn{border:1px solid #a5e7d5;background:#b5eddd;color:#0a1b20;border-radius:10px;padding:10px 13px;font-size:11px;font-weight:850;cursor:pointer}.btn.secondary{border-color:#34465c;background:#162231;color:#d2deec}.btn.ghost{border-color:#2b3d51;background:transparent;color:#b7c6d9}.btn:disabled{opacity:.48;cursor:not-allowed}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{display:flex;flex-direction:column;gap:10px;min-width:0;background:linear-gradient(150deg,#111d2b,#0c1520);border:1px solid #28394e;border-radius:15px;padding:15px}.card-head{display:flex;gap:10px;align-items:flex-start}.asset{flex:0 0 40px;width:40px;height:40px;border-radius:13px;background:linear-gradient(140deg,#c2f0e3,#acbaff);color:#14232c;display:grid;place-items:center;font-size:18px;font-weight:900}.asset.bot{background:linear-gradient(140deg,#f0c6a7,#e8abc0);color:#2a1a24}.asset.skill{background:linear-gradient(140deg,#cdc5ff,#a8b3f4);color:#20203a}.card h3{font-size:14px;margin:0;line-height:1.35}.meta{font-size:10px;color:#8ea3bc;margin-top:5px}.card p{color:#a7b7ca;font-size:11px;line-height:1.6;margin:0;min-height:50px}.card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #28384a;padding-top:11px;margin-top:auto}.price{font-size:17px;font-weight:900;letter-spacing:-.04em}.price small{font-size:9px;color:#91a4bb;font-weight:600;letter-spacing:0}.notice{font-size:11px;line-height:1.55;padding:11px 13px;border:1px solid #57462c;background:#282014;color:#f1d8a6;border-radius:12px;margin:12px 0}.notice.info{border-color:#2c415a;background:#112031;color:#c1d5e9}.notice.success{border-color:#2c5a4a;background:#112a22;color:#b9efd9}.empty{padding:30px 15px;border:1px dashed #37475d;border-radius:15px;text-align:center;color:#9aacc2}.empty strong{display:block;color:#e0e9f4;margin-bottom:7px}.empty p{font-size:11px;line-height:1.6;max-width:500px;margin:auto}' +
    '.section-title{font-size:12px;font-weight:850;color:#dae7f6;margin:22px 0 10px}.split{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(270px,.65fr);gap:14px;align-items:start}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.fieldgroup{display:flex;flex-direction:column;gap:6px;margin:0}.fieldgroup.full{grid-column:1/-1}label{font-size:10px;font-weight:800;color:#b0c0d4}.hint{font-size:10px;line-height:1.5;color:#8398b2}textarea{resize:vertical;min-height:75px}.checkrow{display:flex;gap:8px;align-items:flex-start;line-height:1.5;font-size:10px;color:#b1bfd1}.checkrow input{width:15px;flex:0 0 15px;margin:2px 0}.capabilities{display:grid;grid-template-columns:1fr 1fr;gap:7px}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}.stat{background:#111d2a;border:1px solid #2b3b50;padding:13px;border-radius:12px}.stat strong{font-size:20px;display:block}.stat span{font-size:10px;color:#8fa4bd}.list-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #233247}.list-main{flex:1;min-width:0}.list-main strong{display:block;font-size:12px}.list-main span{display:block;font-size:10px;color:#91a4bc;margin-top:4px}.plans{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;align-items:stretch}.plan{display:flex;flex-direction:column;gap:10px;min-width:0;padding:13px;border:1px solid #2d3d51;background:#101a28;border-radius:15px}.plan.popular{border-color:#8bdcc8;box-shadow:0 0 0 1px #8bdcc820 inset}.plan-tag{font-size:9px;letter-spacing:.1em;color:#a9e8d8;text-transform:uppercase;font-weight:900}.plan h3{margin:0;font-size:15px}.plan-desc{font-size:10px;line-height:1.45;color:#93a6be;min-height:42px}.plan-price{font-size:21px;font-weight:900;letter-spacing:-.05em}.plan-price span{font-size:9px;color:#9fb0c4;letter-spacing:0;font-weight:600}.plan ul{padding-left:14px;margin:0;display:grid;gap:7px;flex:1}.plan li{font-size:10px;color:#aabbd0;line-height:1.4}.plan .btn{width:100%}.footer{display:flex;justify-content:space-between;gap:10px;padding:11px 20px;background:#0b121d;border-top:1px solid #233146;color:#778ba3;font-size:9px}' +
    '@media(max-width:1000px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.plans{grid-template-columns:repeat(3,minmax(0,1fr))}.split{grid-template-columns:1fr}}@media(max-width:680px){.veil{padding:0}.panel{height:100dvh;width:100%;border:0;border-radius:0}.head{padding:14px}.content{padding:15px 12px}.nav{padding:8px 10px}.hero{display:block}.hero h2{font-size:24px}.grid{grid-template-columns:1fr}.plans{grid-template-columns:1fr 1fr}.form-grid{grid-template-columns:1fr}.fieldgroup.full{grid-column:auto}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.footer span:last-child{display:none}}@media(max-width:420px){.plans{grid-template-columns:1fr}}';
  root.appendChild(style);
  const veil = document.createElement('div');
  veil.className = 'veil';
  veil.setAttribute('role','dialog');
  veil.setAttribute('aria-modal','true');
  veil.setAttribute('aria-label','Whilo Marketplace');
  veil.innerHTML = '<section class="panel"><header class="head"><div class="mark">W</div><div class="brand"><div class="eyebrow">WHILO / CREATOR ECONOMY</div><h1>Marketplace</h1><div class="sub">Discover agents. Package expertise. Earn from every verified sale.</div></div><button class="close" data-action="close" aria-label="Close">×</button></header><nav class="nav" aria-label="Marketplace"><button class="active" data-page="discover">Discover</button><button data-page="plugins">Plugins</button><button data-page="library">My Library</button><button data-page="creator">Creator Studio</button><button data-page="review">Review Queue</button><button data-page="plans">Plans</button></nav><main class="content" id="content"></main><footer class="footer"><span>20% platform commission on completed paid sales</span><span>Preview assets are not real listings.</span></footer></section>';
  root.appendChild(veil);
  document.documentElement.appendChild(host);
  const content = veil.querySelector('#content');

  function notify(text, kind) { feedback = text || ''; render(); if (kind && feedback) { const n=content.querySelector('.notice'); if(n)n.classList.add(kind); } }
  function notice() {
    if (!feedback) return '';
    const good = /saved|submitted|connected|created|added|completed|refreshed/i.test(feedback);
    return '<div class="notice ' + (good?'success':'info') + '" role="status">' + esc(feedback) + '</div>';
  }
  function visibleListings() {
    const source = live ? listings : DEMO;
    return source.filter(function (item) {
      return (filter==='all' || item.listing_type===filter) &&
        (!query || norm([item.title,item.summary,item.category,(item.tags||[]).join(' ')].join(' ')).includes(norm(query)));
    });
  }
  function card(item) {
    const preview = !live || item.demo;
    const type = TYPES[item.listing_type] || 'Listing';
    const price = Number(item.price_minor||0) === 0 ? 'Free' : money(item.price_minor);
    const act = preview ? 'preview' : (Number(item.price_minor||0) === 0 ? 'install' : 'buy');
    const btn = preview ? 'Preview only' : (act==='install'?'Install':'Buy');
    return '<article class="card"><div class="card-head"><div class="asset ' + esc(item.listing_type) + '">' + esc(ICONS[item.listing_type]||'◇') + '</div><div style="min-width:0;flex:1"><div class="eyebrow">' + esc(type) + ' · ' + esc(item.category||'General') + '</div><h3 style="margin-top:5px">' + esc(item.title) + '</h3><div class="meta">' + esc(item.seller&&item.seller.display_name||'Whilo creator') + ' · v' + esc(item.version||'1.0.0') + '</div></div></div><p>' + esc(item.summary) + '</p><div class="pills"><span class="pill ' + (preview?'preview':'live') + '">' + (preview?'Sample preview':'Published') + '</span><span class="pill">' + esc(item.license||'Proprietary') + '</span></div><div class="card-foot"><div class="price">' + esc(price) + (Number(item.price_minor||0)>0?'<small> · one-time</small>':'') + '</div><button class="btn ' + (preview?'secondary':'') + '" data-action="' + act + '" data-id="' + esc(item.id) + '"' + (saving?' disabled':'') + '>' + btn + '</button></div></article>';
  }
  function discoverPage() {
    const rows=visibleListings();
    let out='<div class="hero"><div><div class="eyebrow">THE AGENT ECONOMY</div><h2>Buy outcomes. Sell expertise.</h2><p>Vetted, versioned Pets, task-scoped Bots, Skills and Playbooks. Each asset declares its capabilities and runs under buyer workspace policies.</p><div class="pills"><span class="pill">Pets own outcomes</span><span class="pill">Bots do bounded work</span><span class="pill">20% transparent commission</span></div></div><button class="btn secondary" data-action="refresh"' + (loading?' disabled':'') + '>↻ Refresh</button></div>'+notice();
    out+='<div class="toolbar"><input class="field search" id="market-search" type="search" maxlength="100" value="'+esc(query)+'" placeholder="Search agents, skills and playbooks…"><div style="display:flex;gap:5px;flex-wrap:wrap">'+[['all','All'],['pet','Pets'],['bot','Bots'],['skill','Skills'],['playbook','Playbooks'],['template','Templates']].map(function(x){return '<button class="filter '+(filter===x[0]?'active':'')+'" data-filter="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div></div>';
    if(!live) out+='<div class="notice">Preview mode: sample assets show the intended product direction, not real seller listings. Purchases and installations stay disabled until Supabase and Stripe are configured.</div>';
    if(rows.length) out+='<div class="grid listing-grid">'+rows.map(card).join('')+'</div>';
    else out+='<div class="empty"><strong>No published listings match.</strong><p>Try another search or filter. Creator assets appear only after moderation.</p></div>';
    out+='<div class="section-title">A real agent marketplace, not a prompt dump</div><div class="grid"><article class="card"><div class="eyebrow">01 / TRUST</div><h3>Capability manifest</h3><p>Buyers see proposed tools, approval requirements, version, license and cost boundaries before installing.</p></article><article class="card"><div class="eyebrow">02 / QUALITY</div><h3>Verified outcomes</h3><p>Ratings should follow confirmed purchases and auditable results—not vanity stars or unverified claims.</p></article><article class="card"><div class="eyebrow">03 / CREATOR REVENUE</div><h3>20% platform take</h3><p>Creator proceeds are 80% of item price before their own taxes. Processor costs come from Whilo’s fee in v1.</p></article></div>';
    return out;
  }
  function authCard() {
    return '<form class="card" id="market-auth"><div class="eyebrow">CLOUD IDENTITY</div><h3>'+(authMode==='signup'?'Create your Whilo account':'Sign in to Whilo')+'</h3><p>Creator listings and purchases require a real authenticated Whilo workspace. Passwords go to Supabase Auth; Whilo does not store them.</p><div class="form-grid"><div class="fieldgroup"><label>Email</label><input name="email" type="email" autocomplete="username" maxlength="320" required></div><div class="fieldgroup"><label>Password</label><input name="password" type="password" autocomplete="'+(authMode==='signup'?'new-password':'current-password')+'" minlength="'+(authMode==='signup'?'14':'1')+'" maxlength="256" required></div></div><div class="toolbar"><button class="btn" type="submit">'+(authMode==='signup'?'Create account':'Sign in')+'</button><button class="btn ghost" type="button" data-action="toggle-auth">'+(authMode==='signup'?'I have an account':'Create account')+'</button></div><div class="hint">Supabase configuration and email settings are required. No demo session is created.</div></form>';
  }
  function creatorPage() {
    let out='<div class="hero"><div><div class="eyebrow">CREATOR STUDIO</div><h2>Turn your know-how into a product.</h2><p>Publish versioned Pet/Bot configurations and playbooks. New listings stay in draft or review until an authorized moderator approves them.</p></div></div>'+notice();
    if(!creator.session) {
      out+=authCard();
      out+='<div class="split"><article class="card"><div class="eyebrow">PAYOUTS</div><h3>Creator onboarding</h3><p>Connect payouts through Stripe’s hosted identity flow. Brazil/BRL is the first-release scope; other regions need their own reviewed setup.</p><label class="checkrow"><input type="checkbox" id="market-terms">I am eligible and authorized to use this seller account, and I accept the creator terms.</label><button class="btn" style="margin-top:10px" data-action="connect-payouts">Connect Stripe payouts</button><div class="hint">No bypass of identity, age or financial compliance checks.</div></article><article class="card"><div class="eyebrow">PUBLISHING PIPELINE</div><h3>Draft → review → published</h3><p>Declare capabilities and deliver repeatable evidence. Uploaded scripts or binaries are not executed as marketplace assets.</p></article></div>';
      return out;
    }
    const dashboard=creator.dashboard||{seller:null,listings:[]}, seller=dashboard.seller, owned=Array.isArray(dashboard.listings)?dashboard.listings:[];
    out+='<div class="stats"><div class="stat"><strong>'+owned.length+'</strong><span>Your listings</span></div><div class="stat"><strong>'+esc(seller?seller.status:'Draft')+'</strong><span>Creator status</span></div><div class="stat"><strong>20%</strong><span>Whilo platform commission</span></div></div>';
    out+='<div class="split"><section class="card"><div class="eyebrow">NEW LISTING</div><h3>Package a reusable capability</h3><form id="market-create"><div class="form-grid"><div class="fieldgroup"><label>Listing title</label><input name="title" minlength="3" maxlength="100" required placeholder="Pipeline Scout Pet"></div><div class="fieldgroup"><label>Asset type</label><select name="listingType"><option value="pet">Pet — persistent owner</option><option value="bot">Bot — task specialist</option><option value="skill">Skill</option><option value="playbook">Playbook</option><option value="template">Template</option></select></div><div class="fieldgroup full"><label>Short description</label><input name="summary" minlength="10" maxlength="240" required placeholder="What measurable job does this complete?"></div><div class="fieldgroup"><label>Category</label><select name="category"><option>Revenue</option><option>Marketing</option><option>Research</option><option>Analytics</option><option>Operations</option><option>Engineering</option><option>Productivity</option></select></div><div class="fieldgroup"><label>One-time price (BRL)</label><input name="price" type="number" min="0" max="500000" step="0.01" value="0" required></div><div class="fieldgroup"><label>Version</label><input name="version" maxlength="40" value="1.0.0"></div><div class="fieldgroup"><label>License</label><select name="license"><option>Proprietary</option><option>MIT</option><option>Apache-2.0</option><option>GPL-3.0</option><option>CC-BY-4.0</option></select></div><div class="fieldgroup full"><label>Description and boundaries</label><textarea name="description" maxlength="12000" placeholder="Inputs, exclusions, acceptance criteria and expected output"></textarea></div><div class="fieldgroup full"><label>Instructions (declarative text only)</label><textarea name="systemPrompt" maxlength="6000" placeholder="These instructions cannot override Whilo policy or permissions"></textarea></div><div class="fieldgroup full"><label>Requested capabilities (allowlisted only)</label><div class="capabilities"><label class="checkrow"><input type="checkbox" name="capabilities" value="browser.research">Browser research</label><label class="checkrow"><input type="checkbox" name="capabilities" value="files.read">Read files</label><label class="checkrow"><input type="checkbox" name="capabilities" value="calendar.draft">Draft calendar</label><label class="checkrow"><input type="checkbox" name="capabilities" value="crm.read">Read CRM</label><label class="checkrow"><input type="checkbox" name="capabilities" value="workflow.draft">Draft workflows</label><label class="checkrow"><input type="checkbox" name="capabilities" value="code.review">Review code</label><label class="checkrow"><input type="checkbox" name="capabilities" value="marketing.write">Draft marketing</label><label class="checkrow"><input type="checkbox" name="capabilities" value="data.analyze">Analyze data</label></div><div class="hint">A listing does not grant system access. Whilo enforces permissions separately.</div></div><div class="fieldgroup full"><label class="checkrow"><input type="checkbox" name="reviewTerms" required>I own or am authorized to distribute this material and agree to moderation before publication.</label></div></div><div class="toolbar"><button class="btn" type="submit" '+(saving?'disabled':'')+'>Save draft</button><button class="btn secondary" type="button" data-action="reload-creator">Refresh</button></div></form></section><aside class="card"><div class="eyebrow">SELLER ACCOUNT</div><h3>'+(seller?esc(seller.status):'Not connected')+'</h3><p>Stripe verifies identity, business details and payouts. New listings require Whilo review.</p><label class="checkrow"><input id="market-terms" type="checkbox">I am legally eligible and authorized to connect this payout account and accept creator terms.</label><button class="btn" style="margin-top:10px" data-action="connect-payouts">Connect / resume Stripe onboarding</button><div class="notice info">On a completed paid sale, seller proceeds are 80% of the item price before seller taxes. The platform keeps 20% gross commission; processing costs reduce that commission.</div></aside></div>';
    out+='<div class="section-title">Your listings</div>';
    out+=owned.length?owned.map(function(item){return '<div class="list-row"><div class="asset">'+esc(ICONS[item.listing_type]||'◇')+'</div><div class="list-main"><strong>'+esc(item.title)+'</strong><span>'+esc(TYPES[item.listing_type]||item.listing_type)+' · '+esc(item.status)+' · '+(item.price_minor?money(item.price_minor):'Free')+(item.review_note?' · '+esc(item.review_note):'')+'</span></div>'+(['draft','rejected'].includes(item.status)?'<button class="btn secondary" data-action="submit-listing" data-id="'+esc(item.id)+'">Submit for review</button>':'')+'</div>';}).join(''):'<div class="empty"><strong>No listings yet.</strong><p>Save a draft above. It will appear in public search only after review and publication.</p></div>';
    return out;
  }
  function libraryPage() {
    let out='<div class="hero"><div><div class="eyebrow">YOUR INSTALLED ASSETS</div><h2>My Library</h2><p>Purchased and free assets are tied to your workspace. Pets are created as Pet records; Bots, Skills and Playbooks are saved as declarative installs. Connecting those manifests to the mission runtime is a separate release, so they do not execute yet.</p></div><button class="btn secondary" data-action="reload-library">Refresh</button></div>'+notice();
    if(!library.session) return out+authCard();
    if(library.error) return out+'<div class="notice info">'+esc(library.error)+'</div>';
    const items=Array.isArray(library.installations)?library.installations:[];
    if(!items.length) return out+'<div class="empty"><strong>Your library is empty.</strong><p>Install a free asset or buy a published listing. Paid access appears only after the payment webhook confirms it.</p></div>';
    out+='<div class="grid">'+items.map(function(item){
      const listing=item.listing||{};
      return '<article class="card"><div class="card-head"><div class="asset">'+esc(ICONS[item.asset_type]||'◇')+'</div><div><div class="eyebrow">'+esc(TYPES[item.asset_type]||item.asset_type)+'</div><h3>'+esc(listing.title||'Marketplace asset')+'</h3><div class="meta">Version '+esc(item.listing_version||'1.0.0')+'</div></div></div><p>'+esc(listing.summary||'Installed marketplace configuration.')+'</p><div class="pills"><span class="pill live">'+esc(item.state||'active')+'</span><span class="pill">Installed '+esc(item.installed_at?new Date(item.installed_at).toLocaleDateString('pt-BR'):'recently')+'</span></div><div class="card-foot"><div class="meta">'+(item.pet_instance_id?'Pet linked to workspace':'Manifest saved; mission-runtime connection not enabled yet')+'</div><button class="btn secondary" data-action="asset-details" data-id="'+esc(item.id)+'">Details</button></div></article>';
    }).join('')+'</div>';
    return out;
  }
  function reviewPage() {
    let out='<div class="hero"><div><div class="eyebrow">QUALITY CONTROL</div><h2>Marketplace review queue</h2><p>Only server-allowlisted reviewers can publish listings. Review the job outcome, requested capabilities and seller identity before approval.</p></div><button class="btn secondary" data-action="reload-review">Refresh</button></div>'+notice();
    if(moderation.error) return out+'<div class="notice info">'+esc(moderation.error)+'</div><div class="hint">To authorize a reviewer, set WHILO_MARKETPLACE_ADMIN_USER_IDS to the reviewer user UUID in Vercel. This is enforced by the API, not by this UI.</div>';
    const items=Array.isArray(moderation.items)?moderation.items:[];
    if(!items.length) return out+'<div class="empty"><strong>No listings waiting for review.</strong><p>New submissions enter this queue and stay unpublished until an authorized moderator decides.</p></div>';
    out+='<div class="grid">'+items.map(function(item){
      return '<article class="card"><div class="eyebrow">'+esc(TYPES[item.listing_type]||item.listing_type)+' · '+esc(item.category||'General')+'</div><h3>'+esc(item.title)+'</h3><p>'+esc(item.summary)+'</p><div class="pills"><span class="pill">'+esc(item.seller&&item.seller.display_name||'Creator')+'</span><span class="pill">'+esc(item.seller&&item.seller.status||'unknown seller state')+'</span><span class="pill">'+(Number(item.price_minor||0)?money(item.price_minor):'Free')+'</span></div><div class="hint">v'+esc(item.version||'1.0.0')+' · '+esc(item.license||'Proprietary')+' · Submitted '+esc(item.created_at?new Date(item.created_at).toLocaleDateString('pt-BR'):'recently')+'</div><div class="toolbar"><button class="btn" data-action="moderate-listing" data-decision="publish" data-id="'+esc(item.id)+'">Approve & publish</button><button class="btn secondary" data-action="moderate-listing" data-decision="reject" data-id="'+esc(item.id)+'">Reject with feedback</button></div></article>';
    }).join('')+'</div>';
    return out;
  }
  function plansPage() {
    let out='<div class="hero"><div><div class="eyebrow">ONE SUBSCRIPTION. YOUR WORKSPACE.</div><h2>Scale your outcomes, not just your prompts.</h2><p>Proposed Whilo launch prices anchored to the reference you shared. Usage budgets stay bounded until cost telemetry supports accurate allowances.</p><div class="pills"><span class="pill">No unlimited-compute promises</span><span class="pill">Subscription and creator commerce are separate</span></div></div></div>'+notice();
    out+='<div class="toolbar"><button class="filter '+(billingInterval==='monthly'?'active':'')+'" data-interval="monthly">Monthly</button><button class="filter '+(billingInterval==='annual'?'active':'')+'" data-interval="annual">Annual · about 2 months free</button></div>';
    out+='<div class="plans">'+PLANS.map(function(plan){
      const amount=billingInterval==='annual'?plan.annual:plan.monthly;
      const price=amount===0?'Free':money(Math.round(amount*100));
      return '<article class="plan '+(plan.id==='premium'?'popular':'')+'"><div class="plan-tag">'+esc(plan.tag)+'</div><h3>'+esc(plan.name)+'</h3><div class="plan-desc">'+esc(plan.desc)+'</div><div class="plan-price">'+esc(price)+(amount===0?'':'<span> / '+(billingInterval==='annual'?'year':'month')+'</span>')+'</div><ul>'+plan.features.map(function(item){return '<li>'+esc(item)+'</li>';}).join('')+'</ul><button class="btn '+(plan.id==='premium'?'':'secondary')+'" data-action="choose-plan" data-plan="'+esc(plan.id)+'" '+(plan.id==='free'||saving?'disabled':'')+'>'+(plan.id==='free'?'Included':'Choose '+esc(plan.name))+'</button></article>';
    }).join('')+'</div>';
    out+='<div class="notice info">Billing is not active until Stripe recurring Price IDs, webhook settings and migration 009 are configured and tested. A plan button reports missing setup rather than pretending to create a subscription.</div>';
    out+='<div class="section-title">Usage has to stay profitable</div><div class="grid"><article class="card"><h3>Execution credits</h3><p>Set included allocations after measuring real model, tool, browser, computer and retry costs. Alert at 70%; ask or pause before overage.</p></article><article class="card"><h3>Concurrency</h3><p>Higher tiers may unlock more active Pets, parallel Bots, team seats and scheduled routines as those systems become operational.</p></article><article class="card"><h3>Creator income stays separate</h3><p>Subscriptions fund Whilo access and usage. Marketplace sales pay creators and record Whilo’s 20% fee in a separate ledger.</p></article></div>';
    return out;
  }
  function pluginsPage() {
    const plugins = [
      {title:'Anthropic Skills',kind:'Skills library',description:'Reusable task instructions and workflow patterns. Review permissions and scope before importing anything.',url:'https://github.com/anthropics/skills',tag:'Official skills repo'},
      {title:'Vercel Agent Skills',kind:'Developer workflows',description:'Skills for agentic development and deployment workflows. Keep build/deploy permissions scoped to the task.',url:'https://github.com/vercel-labs/agent-skills',tag:'Developer tooling'},
      {title:'Superpowers',kind:'Engineering playbooks',description:'Structured software-engineering workflows for planning, implementation and verification.',url:'https://github.com/obra/superpowers',tag:'Open-source workflow'},
      {title:'OpenMausBot',kind:'Agent runtime research',description:'Study its per-turn capabilities, approval gates, run-state verification, device boundaries and secure computer-control patterns. Do not copy source wholesale; port concepts with license and threat-model review.',url:'https://github.com/milind-soni/OpenMausBot',tag:'Architecture reference'},
      {title:'Composio integrations',kind:'Connected tools',description:'Explore third-party app integrations. Whilo should request least-privilege scopes and require approval for consequential writes.',url:'https://github.com/ComposioHQ',tag:'Integration ecosystem'},
      {title:'GitHub Skills',kind:'Repository-native automation',description:'Use reviewed repository workflows to improve issues, pull requests, code review and release hygiene.',url:'https://github.com/skills',tag:'GitHub ecosystem'}
    ];
    let out='<div class="hero"><div><div class="eyebrow">WHILO / PLUGIN EXPLORER</div><h2>Plugins that extend your workspace.</h2><p>Discover GitHub skills, automation playbooks and integration ecosystems. Whilo shows the source and trust boundary before you connect or import anything.</p></div><button class="btn secondary" data-action="plugins-refresh">↻ Refresh</button></div>';
    out+='<div class="notice info"><b>Safe-by-default:</b> external skills are untrusted instructions, not executable code by default. Review the repository, license, requested permissions and network access before importing. Never paste provider secrets into a skill or public repository.</div>';
    out+='<div class="grid">'+plugins.map(function(p){return '<article class="card"><div class="card-head"><div class="asset skill">⌘</div><div style="min-width:0;flex:1"><div class="eyebrow">'+esc(p.kind)+'</div><h3>'+esc(p.title)+'</h3><div class="meta">'+esc(p.tag)+'</div></div></div><p>'+esc(p.description)+'</p><div class="card-foot"><span class="pill">External source</span><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><a class="btn secondary" href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">Review ↗</a><button class="btn" data-action="plugins-save" data-title="'+esc(p.title)+'" data-url="'+esc(p.url)+'" data-description="'+esc(p.description)+'">Save reference</button></div></div></article>';}).join('')+'</div>';
    out+='<div class="section-title">Connect a tool inside Whilo</div><div class="card"><h3>Connectors & API credentials</h3><p>Open Whilo Connect to configure supported providers. Each connector should be server-mediated, encrypted at rest and scoped to the minimum permissions required.</p><div class="card-foot"><span class="pill">Owner-authorized</span><button class="btn" data-action="plugins-connect">Open Connect guidance</button></div></div>';
    out+='<div class="section-title">Import checklist</div><div class="card"><ol style="margin:0;padding-left:20px;color:#a7b7ca;font-size:11px;line-height:1.8"><li>Inspect the maintainer, recent commits, open security issues and license.</li><li>Read the full skill instructions before granting tools or credentials.</li><li>Start in read-only mode with a bounded test target.</li><li>Require human approval for external writes, purchases, deletes and account changes.</li><li>Keep a version, source URL, permissions manifest and rollback path for every installed plugin.</li></ol></div>';
    return out;
  }
  function render() {
    veil.querySelectorAll('[data-page]').forEach(function(button){button.classList.toggle('active',button.getAttribute('data-page')===page);});
    content.innerHTML=page==='plugins'?pluginsPage():(page==='creator'?creatorPage():(page==='plans'?plansPage():(page==='library'?libraryPage():(page==='review'?reviewPage():discoverPage()))));
  }
  async function getToken() {
    if(!window.WhiloCloudAuth) throw new Error('Whilo cloud authentication is not loaded. Refresh the app and verify setup.');
    const value=await window.WhiloCloudAuth.getAccessToken();
    if(!value) throw new Error('Sign in to your Whilo cloud workspace before continuing.');
    return value;
  }
  async function api(action,payload) {
    const access=await getToken();
    const response=await fetch('/api/marketplace',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(Object.assign({action:action},payload||{}))});
    const data=await response.json().catch(function(){return {};});
    if(!response.ok) throw new Error(data.error||'Marketplace request could not be completed.');
    return data;
  }
  async function loadCatalog() {
    if(loading)return;
    loading=true;
    try{
      const response=await fetch('/api/marketplace',{method:'GET',cache:'no-store',headers:{Accept:'application/json'}});
      const data=await response.json().catch(function(){return {};});
      if(!response.ok||data.live!==true||!Array.isArray(data.listings))throw new Error('Preview only');
      live=true; listings=data.listings;
    }catch(_){live=false;listings=DEMO;}
    finally{loading=false;if(veil.classList.contains('open')&&page==='discover')render();}
  }
  async function loadCreator() {
    let authenticated=false;
    try{
      await getToken(); authenticated=true;
      const data=await api('my-listings');
      creator={session:true,dashboard:data};
    }catch(error){
      creator=authenticated?{session:true,dashboard:{seller:null,listings:[]}}:{session:false,dashboard:null};
      if(authenticated)feedback=error.message;
    }
  }
  async function loadReviewQueue() {
    try { const data=await api('moderation-queue'); moderation={items:Array.isArray(data.items)?data.items:[],error:''}; }
    catch(error) { moderation={items:[],error:error&&error.message?error.message:'Review queue could not load.'}; }
  }
  async function loadLibrary() {
    let authenticated=false;
    try{
      await getToken(); authenticated=true;
      const data=await api('my-entitlements');
      library={session:true,installations:Array.isArray(data.installations)?data.installations:[],error:''};
    }catch(error){
      library=authenticated?{session:true,installations:[],error:error.message}:{session:false,installations:[],error:''};
    }
  }
  async function open() {
    veil.classList.add('open');
    document.body.style.overflow='hidden';
    render();
    if(page==='discover')loadCatalog();
    if(page==='creator')loadCreator().then(render);
    if(page==='library')loadLibrary().then(render);if(page==='review')loadReviewQueue().then(render);
    veil.querySelector('[data-action="close"]').focus();
  }
  function close(){veil.classList.remove('open');document.body.style.overflow='';}
  async function runAction(action,id,decision) {
    if(saving)return;
    saving=true;feedback='';render();
    try{
      if(action==='plugins-save'){
        const title=String(decision&&decision.title||'').slice(0,100);
        const sourceUrl=String(decision&&decision.url||'');
        const description=String(decision&&decision.description||'').slice(0,1200);
        if(!title||!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(sourceUrl))throw new Error('Choose a valid public GitHub repository reference.');
        const token=await getToken();
        const response=await fetch('/api/routines',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({action:'create_asset',name:title+' · GitHub reference',assetType:'template',description:description+' This is a reference only; review and approve instructions before use.',sourceUrl:sourceUrl,definition:{kind:'github_plugin_reference',sourceUrl:sourceUrl,trustState:'unreviewed',executionAllowed:false,reviewChecklist:['Verify maintainer and recent changes','Review license and security policy','Inspect requested permissions','Run read-only tests before enabling actions'],permissions:[],notes:'Reference only. Whilo does not execute third-party code from this saved record.'}})});
        const data=await response.json().catch(function(){return {};});
        if(!response.ok)throw new Error(data.error||'Could not save this GitHub reference to the Whilo Library.');
        feedback='Saved to your Whilo Library as an unreviewed reference. No code was installed or executed.';
        page='plugins';
      }
      if(action==='plugins-refresh'){feedback='Plugin sources are external GitHub repositories. Review their current state before installing; this catalog does not execute third-party code.';page='plugins';saving=false;render();return;}
    if(action==='plugins-connect'){feedback='Opening Whilo Connect…';page='plugins';saving=false;render();veil.classList.remove('open');document.body.style.overflow='';window.dispatchEvent(new CustomEvent('whilo:marketplace:open-connect'));return;}
    if(action==='refresh'){await loadCatalog();feedback=live?'Catalog refreshed from the live server.':'Supabase is not configured; sample listings remain in preview mode.';}
      else if(action==='preview'){feedback='This is a visual sample only. It cannot be installed or purchased.';}
      else if(action==='install'){const result=await api('install-free',{listingId:id});feedback=result.detail||'Installed.';await loadCatalog();await loadLibrary();}
      else if(action==='buy'){const result=await api('checkout',{listingId:id});if(result.checkoutUrl&&/^https:\/\/checkout\.stripe\.com\//.test(result.checkoutUrl)){window.location.assign(result.checkoutUrl);return;}throw new Error('A valid checkout URL was not returned.');}
      else if(action==='reload-creator'){await loadCreator();feedback='Creator dashboard refreshed.';}
      else if(action==='reload-library'){await loadLibrary();feedback='Library refreshed.';}
      else if(action==='reload-review'){await loadReviewQueue();feedback='Review queue refreshed.';}
      else if(action==='moderate-listing'){const result=await api('moderate-listing',{listingId:id,decision:decision,note:decision==='reject'?'Please revise the listing rights, description and declared capabilities before resubmitting.':''});feedback=result.listing&&result.listing.status==='published'?'Listing approved and published.':'Listing decision saved.';await loadReviewQueue();await loadCatalog();}
      else if(action==='asset-details'){const item=(library.installations||[]).find(function(row){return row.id===id;});feedback=item?(item.pet_instance_id?'Installed Pet ID: '+item.pet_instance_id:'Asset installation ID: '+item.id):'Installation not found.';}
      else if(action==='submit-listing'){const result=await api('submit-listing',{listingId:id});feedback=result.detail||'Submitted for review.';await loadCreator();}
      else if(action==='connect-payouts'){
        const terms=content.querySelector('#market-terms');
        if(!terms||!terms.checked)throw new Error('Confirm legal eligibility and creator terms first.');
        const result=await api('start-seller-onboarding',{acceptedTerms:true});
        if(result.onboardingUrl&&/^https:\/\/connect\.stripe\.com\//.test(result.onboardingUrl)){window.location.assign(result.onboardingUrl);return;}
        throw new Error('A valid onboarding URL was not returned.');
      }else if(action==='choose-plan'){
        if(id==='free')return;
        const result=await api('start-plan-checkout',{plan:id,interval:billingInterval});
        if(result.checkoutUrl&&/^https:\/\/checkout\.stripe\.com\//.test(result.checkoutUrl)){window.location.assign(result.checkoutUrl);return;}
        throw new Error('A valid subscription checkout URL was not returned.');
      }
    }catch(error){feedback=error&&error.message?error.message:'The action failed.';}
    finally{saving=false;render();if(page==='creator'&&creator.session)loadCreator().then(render);}
  }
  content.addEventListener('input',function(event){
    if(event.target && event.target.id==='market-search'){
      query=event.target.value;
      const grid=content.querySelector('.listing-grid');
      if(grid){
        const rows=visibleListings();
        grid.innerHTML=rows.length?rows.map(card).join(''):'<div class="empty"><strong>No matches.</strong><p>Try another keyword.</p></div>';
      }
    }
  });
  veil.addEventListener('click',function(event){
    if(event.target===veil){close();return;}
    const pageBtn=event.target.closest('[data-page]');
    if(pageBtn){page=pageBtn.getAttribute('data-page');feedback='';render();if(page==='discover')loadCatalog();if(page==='creator')loadCreator().then(render);if(page==='library')loadLibrary().then(render);if(page==='review')loadReviewQueue().then(render);return;}
    const f=event.target.closest('[data-filter]');
    if(f){filter=f.getAttribute('data-filter');render();return;}
    const iv=event.target.closest('[data-interval]');
    if(iv){billingInterval=iv.getAttribute('data-interval');render();return;}
    const b=event.target.closest('[data-action]');
    if(!b)return;
    const action=b.getAttribute('data-action'), id=b.getAttribute('data-id')||b.getAttribute('data-plan')||'', decision=b.getAttribute('data-decision')||'';
    if(action==='close'){close();return;}
    if(action==='toggle-auth'){authMode=authMode==='signin'?'signup':'signin';render();return;}
    if(['refresh','preview','install','buy','reload-creator','reload-library','reload-review','asset-details','submit-listing','connect-payouts','choose-plan','moderate-listing'].includes(action)){runAction(action,id,decision);}
  });
  veil.addEventListener('submit',async function(event){
    event.preventDefault();
    const form=event.target;
    if(form.id==='market-auth'){
      const fd=new FormData(form), email=String(fd.get('email')||'').trim(), password=String(fd.get('password')||'');
      if(!window.WhiloCloudAuth){feedback='Whilo cloud auth is unavailable. Check Supabase configuration.';render();return;}
      saving=true;feedback='Authenticating with Supabase…';render();
      try{
        const result=authMode==='signup'?await window.WhiloCloudAuth.signUp(email,password):await window.WhiloCloudAuth.signIn(email,password);
        if(result&&result.confirmationRequired){authMode='signin';creator={session:false,dashboard:null};feedback='Account created. Confirm the email through Supabase and then sign in.';}
        else{creator={session:true,dashboard:await api('my-listings')};if(page==='library')await loadLibrary();feedback='Signed in. Workspace loaded.';}
      }catch(error){feedback=error&&error.message?error.message:'Authentication failed.';}
      finally{saving=false;render();}
      return;
    }
    if(form.id==='market-create'){
      const fd=new FormData(form), amount=Number(fd.get('price')||0);
      if(!fd.get('reviewTerms')){feedback='Confirm ownership/rights to distribute this asset.';render();return;}
      if(!Number.isFinite(amount)||amount<0||amount>500000){feedback='Enter a valid price from R$0 to R$500,000.';render();return;}
      saving=true;feedback='Validating and saving listing draft…';render();
      try{
        const result=await api('create-listing',{
          acceptedListingTerms:true,
          title:String(fd.get('title')||'').trim(),
          listingType:String(fd.get('listingType')||'bot'),
          summary:String(fd.get('summary')||'').trim(),
          description:String(fd.get('description')||'').trim(),
          category:String(fd.get('category')||'Productivity'),
          version:String(fd.get('version')||'1.0.0').trim(),
          license:String(fd.get('license')||'Proprietary'),
          priceMinor:Math.round(amount*100),
          manifest:{schemaVersion:'1',persona:String(fd.get('title')||'').trim(),systemPrompt:String(fd.get('systemPrompt')||'').trim(),allowedTools:fd.getAll('capabilities').map(String),requiresApproval:true}
        });
        feedback=result.detail||'Draft saved.';
        creator={session:true,dashboard:await api('my-listings')};
      }catch(error){feedback=error&&error.message?error.message:'Listing could not be saved.';}
      finally{saving=false;render();}
    }
  });
  function storeTab(){
    return Array.from(document.querySelectorAll('button,a,[role="tab"],[role="button"]')).filter(function(el){
      const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.top>170)return false;
      const words=norm((el.innerText||el.textContent||'')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||''));
      return words==='store'||words==='loja'||words.startsWith('store\n')||words.startsWith('loja\n');
    }).sort(function(a,b){return a.getBoundingClientRect().top-b.getBoundingClientRect().top;})[0]||null;
  }
  function injectTab(){
    const store=storeTab();
    if(!store)return false;
    if(document.querySelector('[data-whilo-marketplace-tab]'))return true;
    const button=store.cloneNode(false);
    button.removeAttribute('id');button.removeAttribute('href');button.removeAttribute('aria-current');button.removeAttribute('aria-pressed');button.removeAttribute('data-state');
    button.setAttribute('type','button');button.setAttribute('data-whilo-marketplace-tab','true');button.setAttribute('aria-label','Marketplace');button.title='Marketplace';
    button.innerHTML='<span aria-hidden="true" style="margin-right:6px;opacity:.8">◇</span><span>Marketplace</span>';
    button.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();open();});
    store.insertAdjacentElement('afterend',button);
    return true;
  }
  injectTab();
  if(!document.querySelector('[data-whilo-marketplace-tab]')&&window.MutationObserver){
    const observer=new MutationObserver(function(){if(injectTab())observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.setTimeout(function(){observer.disconnect();},20000);
  }
  const params=new URLSearchParams(window.location.search);
  if(params.has('marketplace_purchase')){
    feedback=params.get('marketplace_purchase')==='success'?'Payment return received. Access is granted only after the signed payment webhook confirms the order.':'Checkout was cancelled. No completed purchase is recorded.';
    window.history.replaceState({},document.title,window.location.pathname);
  }
  if(params.has('whilo_plan')){
    feedback=params.get('whilo_plan')==='success'?'Subscription return received. The workspace plan updates only after Stripe confirms subscription state through its signed webhook.':'Plan checkout was cancelled.';
    window.history.replaceState({},document.title,window.location.pathname);
  }
})();
