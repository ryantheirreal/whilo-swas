(function () {
  'use strict';
  if (window.__whiloMarketplaceLoaded) return;
  window.__whiloMarketplaceLoaded = true;

  const PET_SPECIALISTS = [
  {
    "id": "whilo-insurance",
    "name": "Whilo",
    "mark": "◈",
    "shortMarket": "Insurance",
    "market": "Insurance brokerage",
    "marketSize": "US$140–200B",
    "marketBasis": "Sequoia’s illustrative labor-opportunity range for insurance brokerage, not Whilo revenue or a forecast.",
    "wedge": "Commercial-lines submission and renewal operations",
    "wedgeSize": "Start with repetitive intake, completeness checks, renewals and quote comparison; broker judgment and binding remain human-approved.",
    "summary": "A focused insurance-operations Pet that prepares cleaner submissions, tracks renewal windows and compares carrier responses with traceable evidence.",
    "segments": [
      "Submission intake",
      "Renewal monitoring",
      "Quote comparison",
      "Broker follow-up"
    ],
    "guardrail": "Does not bind coverage, provide unlicensed insurance advice, accept/deny a claim or send a quote without broker approval.",
    "sources": [
      {
        "label": "Sequoia Capital · Services: The New Software (5 Mar 2026)",
        "url": "https://sequoiacap.com/article/services-the-new-software"
      }
    ],
    "workflows": [
      {
        "id": "insurance-submission",
        "title": "Prepare a submission packet",
        "goal": "Turn an approved intake into a completeness-checked packet for broker review.",
        "steps": [
          "Extract required fields from the approved intake and documents.",
          "Compare each required field against the broker’s checklist.",
          "Identify missing, expired or conflicting information.",
          "Prepare a carrier-ready draft and route it to a licensed broker."
        ],
        "proof": "Field-by-field completeness report with references to the source document.",
        "metric": "Measure time to submission, missing-field rate and resubmission count."
      },
      {
        "id": "insurance-renewal",
        "title": "Run the renewal desk",
        "goal": "Create a forward-looking renewal queue with clear owners and evidence.",
        "steps": [
          "Read the approved policy register and renewal dates.",
          "Group expirations by time horizon, account and assigned broker.",
          "Prepare client-information requests from approved templates.",
          "Escalate exceptions and leave outbound messages for approval."
        ],
        "proof": "Each renewal has a date, owner, status, outstanding items and next action.",
        "metric": "Measure on-time renewal preparation, open items and admin minutes per account."
      },
      {
        "id": "insurance-quotes",
        "title": "Compare carrier quotes",
        "goal": "Normalize supplied quote terms so a broker can evaluate differences.",
        "steps": [
          "Read the carrier quotes and policy documents provided by the broker.",
          "Align limits, deductibles, exclusions, premiums and open questions.",
          "Cite the page or source for every compared term.",
          "Create a comparison table for broker review, without choosing or binding coverage."
        ],
        "proof": "Every comparison field has a source or is marked unknown.",
        "metric": "Measure comparison turnaround and corrections made by the broker."
      }
    ],
    "marketStage": "AUTOPILOT WEDGE · STANDARDIZED, OFTEN OUTSOURCED"
  },
  {
    "id": "fynn-consulting",
    "name": "Fynn",
    "mark": "⌁",
    "shortMarket": "Consulting",
    "market": "Management consulting",
    "marketSize": "US$300–400B",
    "marketBasis": "Sequoia’s illustrative management-consulting labor-opportunity range; the article notes that much of the market is judgment-heavy.",
    "wedge": "Research, benchmarking and evidence-backed analysis",
    "wedgeSize": "Automate structured intelligence work first; keep strategic judgment with the client and accountable expert.",
    "summary": "A research-led Pet that builds decision-ready market maps, benchmarks and consulting work products with explicit assumptions and cited evidence.",
    "segments": [
      "Market research",
      "Benchmarking",
      "Data gathering",
      "Deliverable quality review"
    ],
    "guardrail": "Never invent evidence or present assumptions as facts. Strategic recommendations remain reviewable by an accountable human.",
    "sources": [
      {
        "label": "Sequoia Capital · Services: The New Software (5 Mar 2026)",
        "url": "https://sequoiacap.com/article/services-the-new-software"
      }
    ],
    "workflows": [
      {
        "id": "consulting-market-map",
        "title": "Build a market map",
        "goal": "Create a sourced map of a market, buyer segments and competitors for a defined question.",
        "steps": [
          "Confirm geography, customer type, time window and decision question.",
          "Collect source-backed facts and distinguish primary from secondary evidence.",
          "Map competitors, buyer segments and open questions.",
          "Draft conclusions with assumptions, confidence and citations for expert review."
        ],
        "proof": "A source ledger and claim-to-source map accompanies the narrative.",
        "metric": "Measure research cycle time, citation coverage and corrections after review."
      },
      {
        "id": "consulting-benchmark",
        "title": "Prepare a benchmark pack",
        "goal": "Compare like-for-like operational measures without hiding mismatched definitions.",
        "steps": [
          "Collect approved datasets and define the metric denominator.",
          "Normalize units, time periods and population differences.",
          "Flag samples too small or definitions that cannot be reconciled.",
          "Prepare a benchmark table with caveats and reviewer sign-off."
        ],
        "proof": "Each metric has a definition, period, source and caveat.",
        "metric": "Measure reproducibility, review corrections and time to decision-ready output."
      },
      {
        "id": "consulting-deliverable-qa",
        "title": "Audit a client deliverable",
        "goal": "Check a report against its brief, evidence, structure and acceptance criteria.",
        "steps": [
          "Load the approved brief, deliverable and acceptance checklist.",
          "Trace key claims to the referenced evidence.",
          "Flag unsupported statements, contradictions and missing caveats.",
          "Return an issue list with proposed fixes for the engagement owner."
        ],
        "proof": "Each finding cites a page, section or evidence item and severity rationale.",
        "metric": "Measure issues found before delivery, false positives and reviewer time."
      }
    ],
    "marketStage": "COPILOT → AUTOPILOT · INTELLIGENCE FIRST"
  },
  {
    "id": "nori-procurement",
    "name": "Nori",
    "mark": "⇄",
    "shortMarket": "Procurement",
    "market": "Supply chain & procurement",
    "marketSize": "US$200B+",
    "marketBasis": "Sequoia’s illustrative supply-chain and procurement labor-opportunity figure; the article emphasizes neglected long-tail supplier work.",
    "wedge": "Supplier discovery, RFQ comparison and long-tail procurement follow-up",
    "wedgeSize": "Start with work too small to justify manual review; quantify verified exceptions before claiming savings.",
    "summary": "An operations Pet that turns scattered supplier data and purchase requests into sourced comparisons, renewal alerts and an actionable exception queue.",
    "segments": [
      "Supplier discovery",
      "RFQ comparison",
      "Contract and renewal watch",
      "Spend-anomaly evidence"
    ],
    "guardrail": "No purchase orders, supplier commitments, contract signatures or payments without explicit human approval. Evidence is not a negotiated saving.",
    "sources": [
      {
        "label": "Sequoia Capital · Services: The New Software (5 Mar 2026)",
        "url": "https://sequoiacap.com/article/services-the-new-software"
      }
    ],
    "workflows": [
      {
        "id": "procurement-rfq",
        "title": "Compare supplier RFQs",
        "goal": "Prepare an apples-to-apples supplier comparison from supplied offers.",
        "steps": [
          "Collect approved quotes and the request specification.",
          "Normalize price, lead time, quantity, terms and missing fields.",
          "Flag non-comparable assumptions and quote expiry dates.",
          "Prepare a sourced comparison for a procurement owner to decide."
        ],
        "proof": "Each value is linked to its quote; gaps and assumptions remain visible.",
        "metric": "Measure RFQ turnaround, comparison completeness and reviewer corrections."
      },
      {
        "id": "procurement-renewals",
        "title": "Monitor supplier renewals",
        "goal": "Make overlooked contracts and renewal windows visible before a deadline.",
        "steps": [
          "Read the authorized supplier and contract register.",
          "Find renewal dates, notice periods and unassigned owners.",
          "Generate a weekly exception queue with source references.",
          "Draft reminders for owner approval; do not alter contracts."
        ],
        "proof": "Renewal date, notice window, source, owner and status for each exception.",
        "metric": "Measure renewals surfaced before deadline and manual tracking time."
      },
      {
        "id": "procurement-anomalies",
        "title": "Surface spend exceptions",
        "goal": "Find records worth investigating rather than claiming savings automatically.",
        "steps": [
          "Analyze only approved purchase and invoice exports.",
          "Group similar suppliers, line items and periods.",
          "Flag duplicates, price variance and unusual patterns with the matching records.",
          "Create a review queue with confidence notes and false-positive tracking."
        ],
        "proof": "Every alert includes supporting records and a plain-language reason.",
        "metric": "Measure useful exceptions confirmed by humans, false positives and review time."
      }
    ],
    "marketStage": "NEXT WAVE · OVERLOOKED LONG-TAIL WORK"
  },
  {
    "id": "capuccino-creative",
    "name": "Capuccino",
    "mark": "✎",
    "shortMarket": "Advertising",
    "market": "Advertising & creative operations",
    "marketStage": "WATCH · KEEP CREATIVE JUDGMENT HUMAN",
    "marketSize": "US$100B+",
    "marketBasis": "Sequoia’s published opportunity-map illustration labels advertising at US$100B+; this is a broad labor-opportunity estimate, not a standalone Whilo TAM. The article places advertising among judgment-heavy work.",
    "wedge": "Creative intelligence, campaign operations and performance learning",
    "wedgeSize": "Begin with research, structured creative production and measurement; do not pretend to replace brand strategy or taste.",
    "summary": "A communications-first Pet for turning audience research and campaign data into traceable briefs, creative variants and human-reviewed experiments.",
    "segments": [
      "Audience research",
      "Creative briefs",
      "Variant production",
      "Performance learning"
    ],
    "guardrail": "A human approves brand positioning, factual claims, regulated-category content, ad targeting, budgets and publication. Never fabricate customer proof or report an unrun experiment as a result.",
    "sources": [
      {
        "label": "Sequoia Capital · Services: The New Software (5 Mar 2026)",
        "url": "https://sequoiacap.com/article/services-the-new-software"
      }
    ],
    "workflows": [
      {
        "id": "creative-brief",
        "title": "Build a source-backed creative brief",
        "goal": "Turn an approved business objective and audience evidence into a structured brief for human creative direction.",
        "steps": [
          "Confirm the offer, audience, geography, channel and prohibited claims.",
          "Separate customer evidence from hypotheses and assumptions.",
          "Draft message angles, objections, proof requirements and creative formats.",
          "Route the brief to a responsible marketer for review before production."
        ],
        "proof": "Every factual claim is linked to supplied evidence or clearly marked as a hypothesis.",
        "metric": "Measure brief approval time, evidence coverage and changes requested by the creative lead."
      },
      {
        "id": "creative-variants",
        "title": "Prepare a controlled creative batch",
        "goal": "Create a testable set of ad variants while keeping each variant traceable to a hypothesis.",
        "steps": [
          "Use the approved brief and existing brand guidelines.",
          "Generate a small set of distinct hooks, structures and CTAs within stated constraints.",
          "Check claims, consistency, accessibility and policy requirements against a checklist.",
          "Export drafts for human approval; do not publish, spend or claim lift automatically."
        ],
        "proof": "Each variant records its hypothesis, source brief, claim checks and approval state.",
        "metric": "Measure production time, approval rate and performance only after the experiment has actually run."
      },
      {
        "id": "creative-learning",
        "title": "Turn campaign data into learning",
        "goal": "Produce an honest readout from a supplied and sufficiently labeled campaign export.",
        "steps": [
          "Verify date range, spend, attribution window and denominator definitions.",
          "Compare results only across reasonably comparable audiences and placements.",
          "Separate observed facts from likely causes; flag sample and attribution limitations.",
          "Propose the next controlled test for a marketer to approve."
        ],
        "proof": "A reproducible report with source rows, definitions, caveats and no invented lift.",
        "metric": "Measure analysis cycle time, decision usefulness and the share of conclusions later confirmed."
      }
    ]
  },
  {
    "id": "ollie-talent",
    "name": "Ollie",
    "mark": "◎",
    "shortMarket": "Talent",
    "market": "Recruitment & staffing",
    "marketSize": "US$200B+",
    "marketBasis": "Sequoia’s illustrative recruitment-and-staffing labor-opportunity figure; the article highlights standardized, high-volume roles as a narrower entry wedge.",
    "wedge": "Sourcing operations, recruiter administration and interview coordination",
    "wedgeSize": "Start with job-related, high-volume workflows; preserve human control over selection, rejection and final hiring.",
    "summary": "An analysis-led recruiting Pet that organizes sourcing evidence, keeps pipelines moving and coordinates interviews without automating consequential hiring decisions.",
    "segments": [
      "Talent market maps",
      "Sourcing research",
      "Interview scheduling",
      "Recruiting operations"
    ],
    "guardrail": "No autonomous hiring or rejection decisions, protected-trait inference or hidden candidate scoring. A qualified human reviews candidates and hiring decisions.",
    "sources": [
      {
        "label": "Sequoia Capital · Services: The New Software (5 Mar 2026)",
        "url": "https://sequoiacap.com/article/services-the-new-software"
      }
    ],
    "workflows": [
      {
        "id": "talent-market-map",
        "title": "Map a talent pool",
        "goal": "Produce a sourced market map against job-related, user-approved criteria.",
        "steps": [
          "Confirm role requirements and criteria with the hiring owner.",
          "Research permitted, job-relevant public or supplied sources.",
          "Record evidence and provenance for each potential match.",
          "Return a recruiter review queue; do not rank people by protected traits."
        ],
        "proof": "Job-related criteria and source evidence are visible for every suggested profile.",
        "metric": "Measure sourcing coverage, duplicate rate and recruiter corrections."
      },
      {
        "id": "talent-coordination",
        "title": "Coordinate the recruiting pipeline",
        "goal": "Reduce scheduling and administration while leaving selection decisions to the hiring team.",
        "steps": [
          "Read the authorized pipeline status and interviewer availability.",
          "Identify missing feedback, stale stages and scheduling constraints.",
          "Draft candidate and interviewer communications from approved templates.",
          "Route outbound communication and stage changes for human approval."
        ],
        "proof": "Every proposed action has an owner, source and approval status.",
        "metric": "Measure time in stage, scheduling cycle and administrative minutes."
      },
      {
        "id": "talent-intake",
        "title": "Structure a recruiter intake",
        "goal": "Turn a hiring brief into a consistent, auditable role scorecard.",
        "steps": [
          "Summarize role outcomes, must-have skills and constraints from the approved brief.",
          "Separate required qualifications from preferences and assumptions.",
          "Draft structured, job-related interview questions and an evaluation rubric.",
          "Ask the hiring owner to review and approve the scorecard before use."
        ],
        "proof": "A role scorecard linked to the source brief with open decisions called out.",
        "metric": "Measure intake-to-approved-scorecard time and rubric changes after review."
      }
    ],
    "marketStage": "WATCH · START WITH HIGH-VOLUME MATCHING"
  },
  {
    "id": "pico-itops",
    "name": "Pico",
    "mark": "⌘",
    "shortMarket": "IT services",
    "market": "IT managed services",
    "marketSize": "US$100B+",
    "marketBasis": "Sequoia’s illustrative IT-managed-services labor-opportunity estimate; the article calls out repeatable work such as monitoring, patching and user provisioning.",
    "wedge": "Service-desk triage, access-request preparation and monitoring summaries",
    "wedgeSize": "Start read-only, with evidence-backed triage and approval-ready work before any production-changing automation.",
    "summary": "An engineering-first Pet that turns service-desk and monitoring noise into well-scoped tickets, least-privilege request packets and verifiable next steps.",
    "segments": [
      "Service desk",
      "Access request packs",
      "Monitoring triage",
      "Patch-status reporting"
    ],
    "guardrail": "Read-only by default. No permission grants, production changes, patching, deletion or credential access without an authorized approval and verified execution adapter.",
    "sources": [
      {
        "label": "Sequoia Capital · Services: The New Software (5 Mar 2026)",
        "url": "https://sequoiacap.com/article/services-the-new-software"
      }
    ],
    "workflows": [
      {
        "id": "it-ticket-triage",
        "title": "Triage the service desk",
        "goal": "Convert ticket volume into an owner-assigned queue with evidence and urgency rationale.",
        "steps": [
          "Read approved tickets and service-level rules.",
          "Cluster duplicates and classify issues using the documented taxonomy.",
          "Suggest priority and owner with a reason and source ticket.",
          "Draft replies or escalations; a human approves customer-facing actions."
        ],
        "proof": "Every classification includes a reason, ticket reference and unresolved uncertainty.",
        "metric": "Measure time to first triage, reassignment rate and reviewer corrections."
      },
      {
        "id": "it-access-pack",
        "title": "Prepare an access request",
        "goal": "Assemble the minimum required evidence for a human-approved access change.",
        "steps": [
          "Read the authorized request and identity context.",
          "Check required approvals and least-privilege policy fields.",
          "List missing manager, system-owner or expiry details.",
          "Prepare a change ticket for an authorized operator; do not grant access."
        ],
        "proof": "A complete approval checklist with an auditable requested scope.",
        "metric": "Measure request completion time, missing approvals and rework."
      },
      {
        "id": "it-monitoring",
        "title": "Summarize monitoring alerts",
        "goal": "Reduce noise in a supplied alert export without making unverified changes.",
        "steps": [
          "Group alerts by affected service, signature and time window.",
          "Attach relevant runbook references and known incidents.",
          "Separate confirmed evidence from possible correlations.",
          "Prepare an ordered triage queue for the on-call engineer."
        ],
        "proof": "Source alert IDs, runbook links, timestamps and explicit uncertainty.",
        "metric": "Measure alert grouping precision, triage time and reopened incidents."
      }
    ],
    "marketStage": "AUTOPILOT WEDGE · REPEATABLE SERVICE OPERATIONS"
  }
];

  const DEMO = [
    {id:'sample-research-bot',listing_type:'bot',title:'Research Brief Bot',summary:'Turn a research question into a sourced brief with an evidence checklist.',category:'Research',price_minor:0,currency:'BRL',version:'1.0.0',seller:{display_name:'Whilo Studio'},demo:true},
    {id:'sample-growth-playbook',listing_type:'playbook',title:'B2B Growth Sprint',summary:'ICP, offer, creative, CRM hygiene and a weekly performance review.',category:'Marketing',price_minor:4900,currency:'BRL',version:'1.0.0',seller:{display_name:'Whilo Studio'},demo:true},
    {id:'sample-data-skill',listing_type:'skill',title:'Revenue Data Analyst',summary:'Turn supplied business data into a decision-ready report.',category:'Analytics',price_minor:0,currency:'BRL',version:'1.0.0',seller:{display_name:'Whilo Studio'},demo:true},
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
  const usd = function (amount) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(amount)||0); };
  const quantity = function (amount) { return new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(Number(amount)||0); };
  const esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  const norm = function (v) { return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); };
  const portuguese = /pt/i.test(document.documentElement.lang || '');
  let live = false, loading = false, saving = false, listings = [];
  let page = 'discover', filter = 'all', query = '', billingInterval = 'monthly', feedback = '';
  let marketFilter = 'all', selectedPetId = '', selectedWorkflowId = '';
  let pilotCases = 300, pilotMinutes = 12, pilotHourly = 35, pilotReduction = 40, pilotMonthlyCost = 500;
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
  style.textContent += "\n:host{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#f5f5f5}\n.veil{background:#080808;padding:0;backdrop-filter:none;align-items:stretch;justify-content:stretch}\n.veil.open{display:flex}\n.panel{width:100%;max-width:none;height:100dvh;max-height:none;background:#090909;border:0;border-radius:0;box-shadow:none}\n.head{padding:16px 24px;background:#0b0b0b;border-color:#252525}\n.mark{background:#f5f5f5;color:#090909;border-radius:10px}\n.eyebrow{color:#a3a3a3}\nh1,.hero h2,.section-title{color:#f5f5f5}\n.sub,.hero p{color:#a3a3a3}\n.close{background:#151515;border-color:#333;color:#f5f5f5;border-radius:999px;cursor:pointer}\n.nav{background:#0b0b0b;border-color:#252525;padding:10px 24px}\n.nav button,.filter{color:#a3a3a3;border-radius:999px}\n.nav button.active,.filter.active{background:#f5f5f5;border-color:#f5f5f5;color:#090909}\n.content{background:#090909;padding:clamp(18px,2.2vw,32px)}\n.pill{background:#171717;border-color:#323232;color:#d4d4d4}\n.pill.preview,.pill.live{background:#171717;border-color:#414141;color:#e5e5e5}\n.field,input,select,textarea{background:#111;border-color:#333;color:#f5f5f5}\n.field:focus,input:focus,select:focus,textarea:focus{border-color:#a3a3a3;box-shadow:0 0 0 3px rgba(255,255,255,.08)}\n.btn{border-color:#f5f5f5;background:#f5f5f5;color:#090909}\n.btn.secondary{border-color:#383838;background:#191919;color:#eee}\n.btn.ghost{border-color:#383838;background:transparent;color:#d4d4d4}\n.card,.plan,.stat{background:#111;border-color:#292929;box-shadow:none}\n.asset,.asset.bot,.asset.skill{background:#e8e8e8;color:#111}\n.card h3,.price,.plan h3,.stat strong{color:#f5f5f5}\n.card p,.meta,.plan-desc,.plan li,.stat span,.hint{color:#a3a3a3}\n.card-foot,.list-row{border-color:#2a2a2a}\n.notice,.notice.info,.notice.success{background:#191919;border-color:#383838;color:#ddd}\n.empty{border-color:#373737;color:#a3a3a3}\n.empty strong{color:#f5f5f5}\n.plan.popular{border-color:#d4d4d4;box-shadow:0 0 0 1px rgba(255,255,255,.06) inset}\n.plan-tag{color:#e5e5e5}\n.statrow,.form,.footer{background:#0b0b0b;border-color:#252525}\n.footer{color:#777}\n@media(max-width:680px){.veil{padding:0}.panel{height:100dvh;border-radius:0}.head{padding:13px 14px}.nav{padding:8px 10px}.content{padding:16px 12px}}\n";
  style.textContent += "\n.market-section{margin:18px 0 30px}\n.market-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin:4px 0 14px;flex-wrap:wrap}\n.market-heading h2{font-size:clamp(22px,2.4vw,30px);letter-spacing:-.05em;line-height:1.1;margin:7px 0}\n.market-heading p{font-size:12px;line-height:1.65;max-width:680px;margin:0;color:#a3a3a3}\n.market-proof{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}\n.market-chip{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:39px;padding:8px 11px;border:1px solid #303030;background:#111;color:#d4d4d4;border-radius:999px;font:inherit;font-size:11px;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}\n.market-chip small{font-size:10px;color:#8f8f8f}\n.market-chip.active{background:#f5f5f5;border-color:#f5f5f5;color:#090909}\n.market-chip.active small{color:#444}\n.market-chip:hover,.market-card:hover{border-color:#777;transform:translateY(-1px)}\n.market-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}\n.market-card{display:flex;flex-direction:column;gap:12px;min-width:0;padding:16px;border:1px solid #292929;border-radius:17px;background:linear-gradient(145deg,#141414,#0e0e0e);transition:transform .15s,border-color .15s;box-shadow:none}\n.market-card.selected{border-color:#d4d4d4;box-shadow:inset 0 0 0 1px #ffffff0a}\n.market-card-top{display:flex;align-items:flex-start;gap:11px}\n.market-avatar{flex:0 0 43px;width:43px;height:43px;border-radius:13px;display:grid;place-items:center;background:#ededed;color:#111;font-size:18px;font-weight:900}\n.market-card-top .eyebrow{font-size:9px;letter-spacing:.12em}\n.market-card h3{font-size:17px;letter-spacing:-.035em;margin:4px 0}\n.market-card .market-summary{font-size:11px;line-height:1.65;color:#aaa;margin:0}\n.market-value{padding:12px 13px;border:1px solid #2b2b2b;border-radius:12px;background:#0b0b0b}\n.market-value strong{font-size:22px;display:block;letter-spacing:-.05em;color:#f5f5f5}\n.market-value span{display:block;font-size:10px;color:#a3a3a3;line-height:1.45;margin-top:4px}\n.market-wedge{font-size:11px;line-height:1.55;color:#ddd}\n.market-wedge strong{color:#fafafa}\n.market-card .market-tags{display:flex;gap:5px;flex-wrap:wrap}\n.market-card .market-tags .pill{font-size:9px}\n.market-card .card-foot{margin-top:auto}\n.source-link{color:#d4d4d4;text-decoration:underline;text-decoration-color:#555;text-underline-offset:3px;font-size:10px}\n.source-link:hover{color:#fff;text-decoration-color:#fff}\n.pet-detail{margin-top:16px;display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.78fr);gap:18px;padding:clamp(16px,2vw,24px);border:1px solid #333;border-radius:18px;background:#0d0d0d}\n.pet-detail h3{font-size:22px;letter-spacing:-.04em;margin:8px 0}\n.pet-detail p{font-size:12px;color:#aaa;line-height:1.65}\n.pet-detail .detail-side{border-left:1px solid #292929;padding-left:18px}\n.segment-list{display:flex;flex-wrap:wrap;gap:6px;margin:11px 0}\n.segment-list span{border:1px solid #313131;background:#161616;color:#ddd;border-radius:999px;padding:6px 9px;font-size:10px}\n.workflow-list{display:grid;gap:7px;margin:12px 0}\n.workflow-option{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;padding:12px;border-radius:12px;border:1px solid #2d2d2d;background:#111;color:#ddd;cursor:pointer;font:inherit}\n.workflow-option.active{border-color:#e5e5e5;background:#1a1a1a}\n.workflow-option .workflow-index{flex:0 0 26px;width:26px;height:26px;border:1px solid #444;border-radius:8px;display:grid;place-items:center;font-size:10px}\n.workflow-option strong{display:block;font-size:11px;color:#f5f5f5}\n.workflow-option small{display:block;font-size:10px;color:#a3a3a3;line-height:1.5;margin-top:4px}\n.workflow-preview{padding:14px;border:1px solid #303030;border-radius:14px;background:#121212;margin-top:12px}\n.workflow-preview h4{font-size:14px;margin:3px 0 8px;letter-spacing:-.02em}\n.workflow-preview ol{padding-left:20px;margin:11px 0;display:grid;gap:8px}\n.workflow-preview li{font-size:11px;color:#d4d4d4;line-height:1.55;padding-left:2px}\n.workflow-preview .proof{padding:10px;border-left:2px solid #e5e5e5;background:#191919;font-size:11px;color:#ddd;line-height:1.6}\n.workflow-preview .metric{font-size:10px;color:#a3a3a3;line-height:1.6;margin:10px 0 0}\n.market-guardrail{padding:11px 12px;background:#181818;border:1px solid #383838;border-radius:12px;font-size:10px;color:#ddd;line-height:1.6}\n.market-source-note{font-size:10px;line-height:1.6;color:#858585;margin:12px 0 0}\n.market-empty{grid-column:1/-1;padding:24px;border:1px dashed #3a3a3a;border-radius:14px;text-align:center;color:#aaa;font-size:12px}\n@media(max-width:1000px){.market-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pet-detail{grid-template-columns:1fr}.pet-detail .detail-side{border-left:0;border-top:1px solid #292929;padding:16px 0 0}}\n@media(max-width:680px){.market-grid{grid-template-columns:1fr}.market-heading{display:block}.market-chip{flex:0 0 auto}.market-proof{flex-wrap:nowrap;overflow-x:auto;padding:2px 0 8px}.pet-detail{padding:14px}.market-card{padding:14px}}\n";
  style.textContent += "\n.pilot-calculator{margin-top:15px;padding:14px;border:1px solid #363636;border-radius:15px;background:#0b0b0b}\n.pilot-calculator h4{font-size:14px;letter-spacing:-.02em;margin:4px 0 5px}\n.pilot-calculator .pilot-intro{color:#a3a3a3;font-size:10px;line-height:1.6;margin:0 0 12px}\n.pilot-inputs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}\n.pilot-inputs label{display:grid;gap:5px;font-size:10px;color:#bcbcbc}\n.pilot-inputs input{width:100%;min-width:0;padding:9px 10px;font-size:12px;border-radius:9px}\n.pilot-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}\n.pilot-result{padding:11px;border:1px solid #292929;border-radius:11px;background:#131313}\n.pilot-result span{display:block;font-size:9px;line-height:1.5;color:#9d9d9d}\n.pilot-result strong{display:block;font-size:18px;color:#f5f5f5;letter-spacing:-.04em;margin-top:4px}\n.pilot-disclaimer{margin-top:11px;font-size:10px;line-height:1.6;color:#888}\n@media(max-width:500px){.pilot-inputs{grid-template-columns:1fr 1fr}.pilot-results{grid-template-columns:1fr 1fr}.pilot-result strong{font-size:16px}}\n";
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
  function visiblePetSpecialists() {
    if (filter !== 'all' && filter !== 'pet') return [];
    return PET_SPECIALISTS.filter(function(pet) {
      const stage = norm(pet.marketStage || '');
      const matchesMarket = marketFilter === 'all' ||
        marketFilter === pet.id ||
        (marketFilter === 'autopilot' && stage.includes('autopilot wedge')) ||
        (marketFilter === 'next-wave' && stage.includes('next wave')) ||
        (marketFilter === 'judgment-heavy' && (stage.includes('copilot') || stage.includes('watch')));
      const searchable = [pet.name,pet.market,pet.shortMarket,pet.marketStage,pet.summary,pet.marketSize,pet.wedge,pet.wedgeSize].concat(pet.segments).join(' ');
      return matchesMarket && (!query || norm(searchable).includes(norm(query)));
    });
  }
  function specialistCard(pet) {
    const selected = selectedPetId === pet.id;
    return '<article class="market-card'+(selected?' selected':'')+'" data-pet-card="'+esc(pet.id)+'">' +
      '<div class="market-card-top"><div class="market-avatar" aria-hidden="true">'+esc(pet.mark)+'</div><div style="min-width:0;flex:1"><div class="eyebrow">WHILO PET · '+esc(pet.market.toUpperCase())+'</div><h3>'+esc(pet.name)+'</h3><div class="meta">Industry specialist · Previewable workflow</div></div></div>' +
      '<p class="market-summary">'+esc(pet.summary)+'</p>' +
      '<div class="market-value"><strong>'+esc(pet.marketSize)+'</strong><span>'+esc(pet.marketBasis)+'</span></div>' +
      '<div class="market-tags"><span class="pill">'+esc(pet.marketStage)+'</span></div>' +
      '<div class="market-wedge"><strong>Initial wedge:</strong> '+esc(pet.wedge)+'</div>' +
      '<div class="market-tags">'+pet.segments.slice(0,3).map(function(segment){return '<span class="pill">'+esc(segment)+'</span>';}).join('')+'</div>' +
      '<div class="card-foot"><span class="meta">3 workflow blueprints</span><button class="btn'+(selected?'':' secondary')+'" type="button" data-action="pet-explore" data-id="'+esc(pet.id)+'" aria-label="Explore '+esc(pet.name)+' specialty">'+(selected?'Selected':'Explore Pet')+' ↗</button></div>' +
      '</article>';
  }
  function pilotEstimate() {
    const baselineHours = pilotCases * pilotMinutes / 60;
    const hoursFreed = baselineHours * pilotReduction / 100;
    const capacityValue = hoursFreed * pilotHourly;
    return {
      baselineHours: baselineHours,
      hoursFreed: hoursFreed,
      capacityValue: capacityValue,
      netCapacityValue: capacityValue - pilotMonthlyCost,
      valueMultiple: pilotMonthlyCost > 0 ? capacityValue / pilotMonthlyCost : null
    };
  }
  function pilotCalculatorMarkup() {
    const estimate = pilotEstimate();
    const field = function(id,label,value,min,max,step,suffix) {
      return '<label>'+label+(suffix?' · '+suffix:'')+'<input type="number" inputmode="decimal" id="'+id+'" data-pilot-input="'+id+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+esc(value)+'" aria-label="'+label+'"></label>';
    };
    return '<section class="pilot-calculator" aria-label="Illustrative pilot capacity estimator"><div class="eyebrow">PILOT DESIGN / HYPOTHETICAL</div><h4>Estimate the workflow’s capacity value</h4><p class="pilot-intro">Change the assumptions to size a pilot. These are example inputs, not measured results or a savings guarantee.</p><div class="pilot-inputs">'+
      field('pilot-cases','Cases each month',pilotCases,1,100000,1,'cases')+
      field('pilot-minutes','Current minutes per case',pilotMinutes,1,600,1,'minutes')+
      field('pilot-hourly','Loaded labor cost',pilotHourly,0,1000,1,'US$/hour')+
      field('pilot-reduction','Expected time reduction',pilotReduction,0,90,5,'%')+
      field('pilot-monthly-cost','Estimated service cost',pilotMonthlyCost,0,1000000,50,'US$/month')+
      '</div><div class="pilot-results" aria-live="polite"><div class="pilot-result"><span>Hours potentially freed / month</span><strong id="pilot-hours-freed">'+quantity(estimate.hoursFreed)+'</strong></div><div class="pilot-result"><span>Labor capacity value · not cash savings</span><strong id="pilot-capacity-value">'+usd(estimate.capacityValue)+'</strong></div><div class="pilot-result"><span>Capacity value minus modeled cost</span><strong id="pilot-net-capacity">'+usd(estimate.netCapacityValue)+'</strong></div><div class="pilot-result"><span>Capacity value / service cost</span><strong id="pilot-value-multiple">'+(estimate.valueMultiple===null?'Not set':quantity(estimate.valueMultiple)+'×')+'</strong></div></div><p class="pilot-disclaimer">The estimate assumes the entered share of time is genuinely released and redeployed. Validate actual case time, quality, exceptions, review effort, tool cost and customer acceptance in a controlled pilot before treating any figure as savings.</p></section>';
  }
  function updatePilotEstimate() {
    const bounds = {
      'pilot-cases': [1,100000],
      'pilot-minutes': [1,600],
      'pilot-hourly': [0,1000],
      'pilot-reduction': [0,90],
      'pilot-monthly-cost': [0,1000000]
    };
    const values = {
      'pilot-cases': pilotCases,
      'pilot-minutes': pilotMinutes,
      'pilot-hourly': pilotHourly,
      'pilot-reduction': pilotReduction,
      'pilot-monthly-cost': pilotMonthlyCost
    };
    Object.keys(bounds).forEach(function(id) {
      const input = content.querySelector('#'+id);
      if (!input || String(input.value).trim()==='') return;
      const n = Number(input.value);
      const range = bounds[id];
      if (!Number.isFinite(n)) { input.value = String(values[id]); return; }
      values[id] = Math.max(range[0],Math.min(range[1],n));
      input.value = String(values[id]);
    });
    pilotCases = values['pilot-cases'];
    pilotMinutes = values['pilot-minutes'];
    pilotHourly = values['pilot-hourly'];
    pilotReduction = values['pilot-reduction'];
    pilotMonthlyCost = values['pilot-monthly-cost'];
    const estimate = pilotEstimate();
    const put = function(id,value) { const node=content.querySelector('#'+id); if(node)node.textContent=value; };
    put('pilot-hours-freed',quantity(estimate.hoursFreed));
    put('pilot-capacity-value',usd(estimate.capacityValue));
    put('pilot-net-capacity',usd(estimate.netCapacityValue));
    put('pilot-value-multiple',estimate.valueMultiple===null?'Not set':quantity(estimate.valueMultiple)+'×');
  }

  function petDetailPanel() {
    const pet = PET_SPECIALISTS.find(function(row){return row.id===selectedPetId;});
    if (!pet) return '';
    const workflow = pet.workflows.find(function(row){return row.id===selectedWorkflowId;}) || null;
    let out = '<section class="pet-detail" aria-label="'+esc(pet.name)+' specialist details"><div><div class="eyebrow">SPECIALIST PROFILE / '+esc(pet.market.toUpperCase())+'</div><h3>'+esc(pet.name)+' · '+esc(pet.market)+'</h3><p>'+esc(pet.summary)+'</p><div class="section-title">Segments this Pet serves</div><div class="segment-list">'+pet.segments.map(function(segment){return '<span>'+esc(segment)+'</span>';}).join('')+'</div><div class="section-title">Choose a workflow to preview</div><div class="workflow-list">'+pet.workflows.map(function(item,index){return '<button class="workflow-option'+(workflow&&workflow.id===item.id?' active':'')+'" type="button" data-action="pet-workflow" data-id="'+esc(pet.id)+'" data-workflow="'+esc(item.id)+'" aria-pressed="'+(workflow&&workflow.id===item.id?'true':'false')+'"><span class="workflow-index">'+String(index+1).padStart(2,'0')+'</span><span><strong>'+esc(item.title)+'</strong><small>'+esc(item.goal)+'</small></span></button>';}).join('')+'</div>';
    if(workflow) {
      out += '<div class="workflow-preview"><div class="eyebrow">WORKFLOW BLUEPRINT · DRAFT ONLY</div><h4>'+esc(workflow.title)+'</h4><p>'+esc(workflow.goal)+'</p><ol>'+workflow.steps.map(function(step){return '<li>'+esc(step)+'</li>';}).join('')+'</ol><div class="proof"><strong>Evidence requirement:</strong> '+esc(workflow.proof)+'</div><div class="metric"><strong>What to measure:</strong> '+esc(workflow.metric)+'</div>'+pilotCalculatorMarkup()+'<div class="toolbar"><button type="button" class="btn" data-action="pet-chat" data-id="'+esc(pet.id)+'" data-workflow="'+esc(workflow.id)+'">Draft this in Whilo Chat ↗</button></div><div class="hint">This creates a prompt draft in Chat. It does not run the workflow or modify external systems.</div></div>';
    } else {
      out += '<div class="notice info">Select one of the workflows to inspect its steps, evidence requirements, and pilot metrics.</div>';
    }
    out += '</div><aside class="detail-side"><div class="row"><div><div class="eyebrow">MARKET OPPORTUNITY</div><div class="price">'+esc(pet.marketSize)+'</div></div><button type="button" class="btn ghost" data-action="pet-close" aria-label="Close Pet details">×</button></div><p>'+esc(pet.marketBasis)+'</p><div class="section-title">First service wedge</div><p><strong>'+esc(pet.wedge)+'</strong></p><div class="notice info">'+esc(pet.wedgeSize)+'</div><div class="section-title">Operating boundary</div><div class="market-guardrail">'+esc(pet.guardrail)+'</div><div class="section-title">Sources</div>'+pet.sources.map(function(source){return '<p><a class="source-link" href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.label)+' ↗</a></p>';}).join('')+'<p><button type="button" class="btn secondary" data-action="pet-close">Back to markets</button></p></aside></section>';
    return out;
  }
  function marketSection() {
    const rows = visiblePetSpecialists();
    let out = '<section class="market-section" aria-label="Industry specialist Pets"><div class="market-heading"><div><div class="eyebrow">WHILO INDUSTRY PETS · SIX VERTICALS</div><h2>One Pet. One market. One measurable workflow.</h2><p>Explore focused specialists for large service economies. Each profile pairs an industry opportunity with a narrower starting workflow, source evidence, human approval boundaries and a measurable pilot.</p><div class="market-proof"><span class="pill">Outcome-led</span><span class="pill">Evidence before claims</span><span class="pill">Human approval for consequential actions</span></div></div></div>' +
      '<div class="market-proof" role="group" aria-label="Filter by Sequoia opportunity stage">'+
      '<button type="button" class="market-chip'+(marketFilter==='all'?' active':'')+'" data-market="all" aria-pressed="'+(marketFilter==='all'?'true':'false')+'"><span>All markets</span><small>6 Pets</small></button>'+
      '<button type="button" class="market-chip'+(marketFilter==='autopilot'?' active':'')+'" data-market="autopilot" aria-pressed="'+(marketFilter==='autopilot'?'true':'false')+'"><span>Autopilot wedge</span><small>2 markets</small></button>'+
      '<button type="button" class="market-chip'+(marketFilter==='next-wave'?' active':'')+'" data-market="next-wave" aria-pressed="'+(marketFilter==='next-wave'?'true':'false')+'"><span>Next wave</span><small>1 market</small></button>'+
      '<button type="button" class="market-chip'+(marketFilter==='judgment-heavy'?' active':'')+'" data-market="judgment-heavy" aria-pressed="'+(marketFilter==='judgment-heavy'?'true':'false')+'"><span>Judgment-heavy</span><small>3 markets</small></button>'+
      PET_SPECIALISTS.map(function(pet){return '<button type="button" class="market-chip'+(marketFilter===pet.id?' active':'')+'" data-market="'+esc(pet.id)+'" aria-pressed="'+(marketFilter===pet.id?'true':'false')+'"><span>'+esc(pet.shortMarket)+'</span><small>'+esc(pet.marketSize)+'</small></button>';}).join('')+
      '</div><div class="market-grid pet-grid">'+(rows.length?rows.map(specialistCard).join(''):'<div class="market-empty">No specialist matches this search. Try a market name, workflow or segment.</div>')+'</div>'+petDetailPanel()+
      '<p class="market-source-note">Market sizes are broad, illustrative opportunity-map estimates—not Whilo revenue forecasts or the amount this product can capture. Sequoia explicitly recommends starting with an outsourced, intelligence-heavy wedge where a buyer already pays for the work, then expanding toward judgment-heavy work only as evidence, distribution and controls improve. The advertising figure is shown in the published opportunity-map illustration and is described here as a broad labor opportunity. Validate a narrower segment, buyer and paid pilot before investing.</p></section>';
    return out;
  }
  function discoverPage() {
    const rows = visibleListings();
    let out = '<div class="hero"><div><div class="eyebrow">THE AGENT ECONOMY</div><h2>Buy outcomes. Sell expertise.</h2><p>Discover industry-specialist Pets and versioned Bots, Skills and Playbooks. Each profile should declare its workflow, evidence, limits and approval requirements before work begins.</p><div class="pills"><span class="pill">Pets own vertical outcomes</span><span class="pill">Bots do bounded tasks</span><span class="pill">20% transparent commission</span></div></div><button class="btn secondary" data-action="refresh"'+(loading?' disabled':'')+'>↻ Refresh</button></div>'+notice();
    out += '<div class="toolbar"><input class="field search" id="market-search" type="search" maxlength="100" value="'+esc(query)+'" placeholder="Search a Pet, market, workflow or asset…"><div style="display:flex;gap:5px;flex-wrap:wrap">'+[['all','All'],['pet','Pets'],['bot','Bots'],['skill','Skills'],['playbook','Playbooks'],['template','Templates']].map(function(x){return '<button class="filter '+(filter===x[0]?'active':'')+'" data-filter="'+x[0]+'" aria-pressed="'+(filter===x[0]?'true':'false')+'">'+x[1]+'</button>';}).join('')+'</div></div>';
    if(filter==='all'||filter==='pet') out += marketSection();
    if(filter!=='pet' || (live && rows.length)) {
      out += '<div class="section-title">'+(filter==='all'?'Marketplace listings':filter==='bot'?'Specialist Bots':filter==='skill'?'Reusable Skills':filter==='playbook'?'Playbooks':filter==='template'?'Templates':'Published Pet listings')+'</div>';
      if(!live) out += '<div class="notice">Preview mode: these example assets are illustrative, not real seller listings. Live purchases and installations require the configured backend, verified account and payment flow.</div>';
      if(rows.length) out += '<div class="grid listing-grid">'+rows.map(card).join('')+'</div>';
      else if(filter!=='all' && !(filter==='pet' && !live)) out += '<div class="empty"><strong>No published listings match.</strong><p>Try another search or filter. Creator assets appear only after moderation.</p></div>';
    }
    out += '<div class="section-title">A serious agent marketplace needs three things</div><div class="grid"><article class="card"><div class="eyebrow">01 / TRUST</div><h3>Capability manifest</h3><p>Buyers see proposed tools, approval requirements, version, license and cost boundaries before installing.</p></article><article class="card"><div class="eyebrow">02 / QUALITY</div><h3>Verified outcomes</h3><p>Ratings should follow confirmed purchases and auditable results—not vanity stars or unverified claims.</p></article><article class="card"><div class="eyebrow">03 / CREATOR REVENUE</div><h3>20% platform take</h3><p>Creator proceeds are 80% of item price before their own taxes. Processor costs come from Whilo’s fee in v1.</p></article></div>';
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
  function legalWorkflowPrompt(workflow) {
    const shared = [
      'You are helping a Brazilian law firm or in-house legal team use Whilo as a LegalOps drafting assistant, not as a substitute for a licensed lawyer.',
      'Source reference: https://github.com/ctresb/leis . Its README describes legislation converted to Markdown from official sources, structured metadata and source links. It explicitly warns that conversions/OCR can contain errors, coverage is incomplete, and the repository does not replace the Diário Oficial. The repository is listed as a source reference only in this MVP: do not claim Whilo has queried or indexed it live.',
      'Use Brazilian Portuguese unless the user asks otherwise. Ask for the jurisdiction (federal/state/municipal and UF/city where relevant), the as-of date, factual context and intended recipient before making a source-sensitive conclusion.',
      'Never invent a law, article number, quotation, legal status, court precedent, citation, deadline or source URL. Separate supplied/verifiable source text from general model knowledge. Mark missing sources and uncertain currency explicitly, and request the official publication or link where needed.',
      'Every contract or legal memo is a draft for review by a qualified Brazilian lawyer. Show assumptions, missing facts, risks, alternative wording, negotiation points and a checklist for human review. Never sign, send, file, submit, threaten, contact a counterparty or claim the output is enforceable. Do not present this as an individualized final legal opinion to an unrepresented consumer.',
      'First ask the minimum intake questions needed for the selected workflow. Prepare an unsent draft only. No external data writes, signatures or messages.'
    ].join('\n');
    const workflows = {
      contract: [
        'WORKFLOW: CONTRACT DRAFTING DESK.',
        'Goal: prepare a structured first draft with editable placeholders and a clause-by-clause review checklist.',
        'Intake: contract type and business objective; identities and roles of parties; country/state/municipality; scope and deliverables; price, currency and payment dates; term and renewal; acceptance criteria; confidentiality and IP ownership; data/LGPD needs; warranties; liability cap and exclusions; termination; dispute resolution; required annexes; and any client template/policies.',
        'Output: (1) intake summary and assumptions; (2) contract draft in Brazilian Portuguese with [BRACKETED PLACEHOLDERS] for missing facts; (3) risk register for each material clause with rationale; (4) negotiation alternatives; (5) checklist for lawyer review; (6) source ledger only for legal propositions actually supported by supplied or verified sources.',
        'Do not assume a clause is valid, enforceable or suitable merely because a model or repository suggests it.'
      ].join('\n'),
      review: [
        'WORKFLOW: CONTRACT REVIEW / REDLINE PREPARATION.',
        'Ask the user to attach or paste the agreement and describe which party they represent, the business objective, jurisdiction and risk tolerance.',
        'Output a table: clause or exact excerpt; issue; severity (preliminary only); practical impact; missing context; suggested alternative wording; negotiation priority; and citation/source if a legal proposition needs one.',
        'Flag inconsistent definitions, one-sided termination, uncapped liability, indemnity, IP ownership, confidentiality, personal-data processing, payment/acceptance, renewal, exclusivity, non-compete, warranties, governing law and dispute resolution where present. Do not infer a clause exists if it was not supplied.',
        'Return suggested redline language separately from the original. No unilateral changes or sending to a counterparty.'
      ].join('\n'),
      research: [
        'WORKFLOW: LEGAL RESEARCH MEMO WITH SOURCE LEDGER.',
        'Ask the legal question, relevant facts, jurisdiction/UF/municipality, the as-of date, intended use and available official-source links.',
        'Build a question tree and identify which primary sources must be verified. Use exact quotations only when source text is available. For each proposition, require instrument/title, article or section, version/status if verifiable, issuing authority, official source URL, access/as-of date and how it supports the proposition.',
        'If you cannot retrieve or inspect a primary source in this session, say so and leave the citation unverified; never imply that the leis repository was queried live. Distinguish statutory text from interpretation, assumption and issue requiring lawyer judgment.',
        'Output: short answer with confidence limits; facts assumed; source ledger; application to supplied facts; arguments/counterarguments; missing research; and a lawyer verification checklist.'
      ].join('\n')
    };
    return shared + '\n\n' + (workflows[workflow] || workflows.contract);
  }

  function pluginsPage() {
    const plugins = [
      {id:'leis-legalops',title:'Leis Legal Desk',kind:'Legal research & contract drafting',description:'A Brazilian LegalOps assistant for law firms and in-house teams: contract first drafts, clause-by-clause review, source-led legal research and structured risk registers. Lawyer-led; drafts only.',url:'https://github.com/ctresb/leis',tag:'Brazilian law · MIT repository',featured:true},
      {title:'Anthropic Skills',kind:'Skills library',description:'Reusable task instructions and workflow patterns. Review permissions and scope before importing anything.',url:'https://github.com/anthropics/skills',tag:'Official skills repo'},
      {title:'Vercel Agent Skills',kind:'Developer workflows',description:'Reusable developer workflows. Review permissions before importing any instructions.',url:'https://github.com/vercel-labs/agent-skills',tag:'Developer tooling'},
      {title:'Superpowers',kind:'Engineering playbooks',description:'Structured software-engineering workflows for planning, implementation and verification.',url:'https://github.com/obra/superpowers',tag:'Open-source workflow'},
      {title:'OpenMausBot',kind:'Agent runtime research',description:'Study per-turn capabilities, approval gates, verified run states, device boundaries and secure computer-control patterns. Port concepts only after license and threat-model review.',url:'https://github.com/milind-soni/OpenMausBot',tag:'Architecture reference'},
      {title:'Composio integrations',kind:'Connected tools',description:'Explore app integrations. Whilo should request least-privilege scopes and require approval for consequential writes.',url:'https://github.com/ComposioHQ',tag:'Integration ecosystem'},
      {title:'GitHub Skills',kind:'Repository-native automation',description:'Reviewed repository workflows for issues, pull requests, code review and release hygiene.',url:'https://github.com/skills',tag:'GitHub ecosystem'}
    ];
    let out='<div class="hero"><div><div class="eyebrow">WHILO / PLUGIN EXPLORER</div><h2>Plugins that extend your workspace.</h2><p>Discover source-backed workflows and integration ecosystems. Whilo shows the source and trust boundary before you connect or import anything.</p></div><button class="btn secondary" data-action="plugins-refresh">↻ Refresh</button></div>';
    out+='<div class="notice info"><b>Safe-by-default:</b> external repositories are reference material, not executable code by default. Review provenance, coverage, license, requested permissions and network access. Never put provider secrets into a skill or public repository.</div>';
    out+='<div class="grid">'+plugins.map(function(p){
      const legal= p.id==='leis-legalops';
      const cardStyle=legal?' style="border-color:#545b68;background:linear-gradient(145deg,rgba(255,255,255,.045),transparent 80%)"':'';
      const actions=legal
        ? '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn secondary" data-action="plugins-save" data-title="'+esc(p.title)+'" data-url="'+esc(p.url)+'" data-description="'+esc(p.description)+'">Save source</button><button class="btn" data-action="plugins-legal-draft" data-workflow="contract">Draft contract</button><button class="btn secondary" data-action="plugins-legal-draft" data-workflow="review">Review agreement</button><button class="btn secondary" data-action="plugins-legal-draft" data-workflow="research">Research law</button></div>'
        : '<button class="btn" data-action="plugins-save" data-title="'+esc(p.title)+'" data-url="'+esc(p.url)+'" data-description="'+esc(p.description)+'">Save reference</button>';
      return '<article class="card"'+cardStyle+'><div class="card-head"><div class="asset skill">'+(legal?'§':'⌘')+'</div><div style="min-width:0;flex:1"><div class="eyebrow">'+esc(p.kind)+'</div><h3>'+esc(p.title)+'</h3><div class="meta">'+esc(p.tag)+'</div></div></div><p>'+esc(p.description)+'</p>'+
        (legal?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 12px"><span class="pill">Contract drafts</span><span class="pill">Clause risk review</span><span class="pill">Source ledger</span></div><p style="font-size:11px;color:#a7b7ca;line-height:1.65"><b>Commercial hypothesis:</b> founding pilot at R$497/month per office. Price is for validation only; checkout and legal-source indexing are not enabled. This repository is a source reference in this MVP, not a live searchable law database.</p>':'')+
        '<div class="card-foot"><span class="pill">'+(legal?'Human lawyer review required':'External source')+'</span><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><a class="btn secondary" href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">Review ↗</a>'+actions+'</div></div></article>';
    }).join('')+'</div>';
    out+='<div class="section-title">Connect a tool inside Whilo</div><div class="card"><h3>Connectors & API credentials</h3><p>Open Whilo Connect to configure supported providers. Credentials stay server-mediated, encrypted at rest and scoped to the minimum permissions required.</p><div class="card-foot"><span class="pill">Owner-authorized</span><button class="btn" data-action="plugins-connect">Open Connect guidance</button></div></div>';
    out+='<div class="section-title">LegalOps operating boundary</div><div class="card"><h3>Draft, verify, approve</h3><ol style="margin:0;padding-left:20px;color:#a7b7ca;font-size:11px;line-height:1.8"><li>Confirm the client’s role, facts, jurisdiction and applicable date.</li><li>Verify the exact text and status in the official publication before citing it as current.</li><li>Trace every legal proposition to an identified source; mark gaps and OCR uncertainty.</li><li>Produce contracts and memos as editable drafts with assumptions, risk notes and a lawyer checklist.</li><li>A qualified lawyer reviews before signature, advice, negotiation, filing or sending.</li></ol></div>';
    out+='<div class="section-title">Plugin import checklist</div><div class="card"><ol style="margin:0;padding-left:20px;color:#a7b7ca;font-size:11px;line-height:1.8"><li>Inspect the maintainer, recent commits, open issues and license.</li><li>Read full instructions before granting tools or credentials.</li><li>Start in read-only mode with a bounded test target.</li><li>Require approval for external writes, purchases, deletes and account changes.</li><li>Keep a version, source URL, permissions manifest and rollback path.</li></ol></div>';
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
    if(event.target && event.target.hasAttribute('data-pilot-input')){
      updatePilotEstimate();
      return;
    }
    if(event.target && event.target.id==='market-search'){
      query=event.target.value;
      const grid=content.querySelector('.listing-grid');
      if(grid){
        const rows=visibleListings();
        grid.innerHTML=rows.length?rows.map(card).join(''):'<div class="empty"><strong>No matches.</strong><p>Try another keyword.</p></div>';
      }
      const specialistGrid=content.querySelector('.pet-grid');
      if(specialistGrid){
        const pets=visiblePetSpecialists();
        specialistGrid.innerHTML=pets.length?pets.map(specialistCard).join(''):'<div class="market-empty">No specialist matches this search. Try a market name, workflow or segment.</div>';
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
    const action=b.getAttribute('data-action'), id=b.getAttribute('data-id')||b.getAttribute('data-plan')||'', decision=action==='plugins-save'?{title:b.getAttribute('data-title')||'',url:b.getAttribute('data-url')||'',description:b.getAttribute('data-description')||''}:(b.getAttribute('data-decision')||'');
    if(action==='close'){close();return;}
    if(action==='toggle-auth'){authMode=authMode==='signin'?'signup':'signin';render();return;}
    if(action==='pet-close'){selectedPetId='';selectedWorkflowId='';render();return;}
    if(action==='pet-explore'){
      selectedPetId=id;
      selectedWorkflowId='';
      const detail=content.querySelector('.pet-detail');
      render();
      const next=content.querySelector('.pet-detail');
      if(next)next.scrollIntoView({behavior:'smooth',block:'nearest'});
      return;
    }
    if(action==='pet-workflow'){
      selectedPetId=id;
      selectedWorkflowId=b.getAttribute('data-workflow')||'';
      render();
      return;
    }
    if(action==='plugins-legal-draft'){
      const workflow=b.getAttribute('data-workflow')||'contract';
      if(!['contract','review','research'].includes(workflow)){feedback='Choose a valid Legal Desk workflow.';render();return;}
      const prompt=legalWorkflowPrompt(workflow);
      close();
      window.dispatchEvent(new CustomEvent('whilo:marketplace:plan-legal',{detail:{prompt:prompt,workflow:workflow,product:'Leis Legal Desk',sourceUrl:'https://github.com/ctresb/leis'}}));
      return;
    }
    if(action==='pet-chat'){
      const pet=PET_SPECIALISTS.find(function(row){return row.id===id;});
      const wfId=b.getAttribute('data-workflow')||'';
      const workflow=pet&&pet.workflows.find(function(row){return row.id===wfId;});
      if(!pet||!workflow){feedback='Choose a valid Pet workflow first.';render();return;}
      const prompt='Help me plan a bounded pilot owned by Pet '+pet.name+' for '+pet.market+'. Workflow: '+workflow.title+'. Objective: '+workflow.goal+' Steps to plan: '+workflow.steps.join(' | ')+'. Required evidence: '+workflow.proof+' Pilot measures: '+workflow.metric+' Operating boundary: '+pet.guardrail+' First propose scope, required approved inputs, roles, acceptance criteria, cost ceiling, failure handling and human approvals. Separate verified facts from assumptions. Do not claim execution, contact third parties or change external systems. Ask for missing details before any action. Draft only; do not execute.';
      close();
      window.dispatchEvent(new CustomEvent('whilo:marketplace:plan-pet',{detail:{prompt:prompt,petId:pet.id,petName:pet.name,market:pet.market,workflow:workflow.title}}));
      return;
    }
    const marketButton=event.target.closest('[data-market]');
    if(marketButton){
      marketFilter=marketButton.getAttribute('data-market')||'all';
      selectedPetId='';
      selectedWorkflowId='';
      render();
      return;
    }
    if(['refresh','preview','install','buy','reload-creator','reload-library','reload-review','asset-details','submit-listing','connect-payouts','choose-plan','moderate-listing','plugins-save','plugins-refresh','plugins-connect'].includes(action)){runAction(action,id,decision);}
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
      const r=el.getBoundingClientRect();
      if(r.width<1||r.height<1||r.top>170)return false;
      const label=norm(el.innerText||el.textContent||'');
      const words=norm((el.innerText||el.textContent||'')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||''));
      return /(^|\s)(store|loja|marketplace)(\s|$)/.test(label) || /(^|\s)(store|loja|marketplace)(\s|$)/.test(words);
    }).sort(function(a,b){return a.getBoundingClientRect().top-b.getBoundingClientRect().top;})[0]||null;
  }
  function labelMarketplace(button){
    const labels=Array.from(button.querySelectorAll('span,div,p')).filter(function(el){
      return /^(store|loja)$/i.test(norm(el.textContent||'')) && !Array.from(el.children).some(function(child){return norm(child.textContent||'')===norm(el.textContent||'');});
    });
    if(labels.length){labels[labels.length-1].textContent='Marketplace';return;}
    try{
      const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode())){
        if(/^(store|loja)$/i.test(norm(node.nodeValue||''))){node.nodeValue='Marketplace';return;}
      }
    }catch(_){}
  }
  function injectTab(){
    const button=storeTab();
    if(!button)return false;
    if(button.hasAttribute('data-whilo-marketplace-tab'))return true;
    button.setAttribute('data-whilo-marketplace-tab','true');
    button.setAttribute('aria-label','Marketplace');
    button.setAttribute('title','Marketplace');
    labelMarketplace(button);
    button.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      open();
    },true);
    return true;
  }
  injectTab();
  if(window.MutationObserver){
    let scheduled=false;
    const observer=new MutationObserver(function(records){
      if(!records.some(function(record){return record.type==='childList'&&(record.addedNodes.length||record.removedNodes.length);})||scheduled)return;
      scheduled=true;
      queueMicrotask(function(){scheduled=false;injectTab();});
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
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
