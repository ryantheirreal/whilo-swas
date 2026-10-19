(function () {
  'use strict';
  if (window.__whiloEnterpriseNavLoaded) return;
  window.__whiloEnterpriseNavLoaded = true;

  const STORAGE_KEY = 'whilo-enterprise-work-v1';
  const PETS = ['Whilo', 'Fynn', 'Nori', 'Capuccino', 'Ollie', 'Pico'];
  const DEPARTMENTS = [
    { id: 'revenue', name: 'Revenue', subtitle: 'Pipeline, prospecting, CRM hygiene and follow-up', template: 'Build and update a qualified prospect list; draft personalized outreach; prepare follow-ups for human approval; update the CRM and report pipeline movement.' },
    { id: 'marketing', name: 'Marketing', subtitle: 'Research, campaigns, creative and performance reporting', template: 'Research the audience and competitors; prepare campaign briefs and creative variants; assemble a performance report with next-step recommendations.' },
    { id: 'support', name: 'Customer support', subtitle: 'Triage, resolution drafts and customer follow-through', template: 'Triage the support backlog, categorize issues, draft replies from approved knowledge and flag sensitive cases for a human.' },
    { id: 'operations', name: 'Operations', subtitle: 'SOPs, repetitive processes and cross-team coordination', template: 'Map a repetitive process, document the current SOP, identify bottlenecks and prepare an automation proposal with acceptance criteria.' },
    { id: 'finance', name: 'Finance operations', subtitle: 'Invoice workflow, reconciliation prep and reporting', template: 'Collect source records, flag missing fields and discrepancies, prepare a reconciliation checklist and draft a month-end summary for review.' },
    { id: 'people', name: 'People & recruiting', subtitle: 'Role briefs, candidate research and interview coordination', template: 'Draft a role scorecard, organize candidate information against job criteria and prepare an interview plan for human review.' },
    { id: 'it', name: 'IT & systems', subtitle: 'Access requests, incident triage and system runbooks', template: 'Organize an IT request, collect diagnostic context, draft a runbook and route any access-changing action for approval.' },
    { id: 'procurement', name: 'Procurement', subtitle: 'Supplier research, comparison and renewal tracking', template: 'Build a supplier comparison from approved sources, identify contract renewal dates and prepare a recommendation with evidence.' }
  ];
  const INTEGRATIONS = [
    { name: 'CRM', detail: 'HubSpot, Salesforce, Pipedrive', icon: '◉' },
    { name: 'Email & calendar', detail: 'Gmail, Outlook, calendar booking', icon: '✉' },
    { name: 'Messaging', detail: 'Slack, Microsoft Teams', icon: '◌' },
    { name: 'Ads & analytics', detail: 'Meta Ads, Google Ads, analytics', icon: '↗' },
    { name: 'Knowledge', detail: 'Notion, Google Drive, SharePoint', icon: '▤' },
    { name: 'Engineering', detail: 'GitHub, Linear, issue trackers', icon: '⌘' }
  ];
  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return {
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        hoursPerTask: Number.isFinite(data.hoursPerTask) && data.hoursPerTask >= 0 ? data.hoursPerTask : 0.5,
        hourlyCost: Number.isFinite(data.hourlyCost) && data.hourlyCost >= 0 ? data.hourlyCost : 35
      };
    } catch (_) { return { tasks: [], hoursPerTask: 0.5, hourlyCost: 35 }; }
  }
  let state = readState();
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function visible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < 170; }
  const vocab = {
    chat: ['chat', 'conversa', 'conversas'],
    pets: ['pets', 'bots', 'agentes'],
    store: ['store', 'loja'],
    routines: ['routines', 'rotinas', 'automations', 'automacoes']
  };
  function category(el) {
    const words = norm((el.innerText || el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || ''));
    for (const key of Object.keys(vocab)) if (vocab[key].some(function (v) { return words === v || words.startsWith(v + ' ') || words.startsWith(v + '\n'); })) return key;
    return '';
  }
  function injectTopbar() {
    const candidates = Array.from(document.querySelectorAll('button,a,[role="tab"],[role="button"]')).filter(function (el) { return visible(el) && category(el); });
    const found = {};
    candidates.forEach(function (el) { const c = category(el); if (!found[c] || el.getBoundingClientRect().top < found[c].getBoundingClientRect().top) found[c] = el; });
    if (!['chat', 'pets', 'store', 'routines'].every(function (k) { return !!found[k]; })) return false;
    let common = found.chat;
    while (common && !Object.keys(found).every(function (k) { return common.contains(found[k]); })) common = common.parentElement;
    if (!common) return false;
    let changed = true;
    while (changed) {
      changed = false;
      Array.from(common.children).forEach(function (child) {
        if (Object.keys(found).every(function (k) { return child === found[k] || child.contains(found[k]); })) { common = child; changed = true; }
      });
    }
    const sample = found.routines;
    const parent = sample.parentElement || common;
    const portuguese = /pt/i.test(document.documentElement.lang || '') || !!found.routines && norm(found.routines.innerText || found.routines.textContent).includes('rotina');
    const items = [
      { key: 'work', en: 'Work', pt: 'Trabalho', mark: '▤' },
      { key: 'company', en: 'Company', pt: 'Empresa', mark: '▦' },
      { key: 'connect', en: 'Connect', pt: 'Conexões', mark: '↗' },
      { key: 'results', en: 'Results', pt: 'Resultados', mark: '◷' }
    ];
    items.forEach(function (item) {
      if (document.querySelector('[data-whilo-enterprise-tab="' + item.key + '"]')) return;
      const b = sample.cloneNode(false);
      b.removeAttribute('id'); b.removeAttribute('href'); b.removeAttribute('aria-current');
      b.setAttribute('type', 'button');
      b.setAttribute('data-whilo-enterprise-tab', item.key);
      b.setAttribute('aria-label', portuguese ? item.pt : item.en);
      b.title = portuguese ? item.pt : item.en;
      b.innerHTML = '<span aria-hidden="true" style="margin-right:6px;opacity:.8">' + item.mark + '</span><span>' + (portuguese ? item.pt : item.en) + '</span>';
      b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); openPanel(item.key); });
      parent.appendChild(b);
    });
    return true;
  }

  const shadowHost = document.createElement('div');
  shadowHost.id = 'whilo-enterprise-root';
  shadowHost.style.cssText = 'position:relative;z-index:2147483000;';
  document.documentElement.appendChild(shadowHost);
  const shadow = shadowHost.attachShadow ? shadowHost.attachShadow({ mode: 'open' }) : shadowHost;
  const css = ':host{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e9edf5}*{box-sizing:border-box}.veil{position:fixed;inset:0;z-index:2147483000;background:rgba(5,8,14,.78);backdrop-filter:blur(12px);display:none;padding:clamp(8px,2.5vw,26px)}.veil.open{display:flex}.panel{width:min(1420px,100%);height:min(900px,100%);margin:auto;background:#0d111a;border:1px solid #242d3d;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 30px 100px rgba(0,0,0,.55)}.top{display:flex;align-items:center;gap:18px;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #242d3d;background:#101622}.brand{display:flex;align-items:center;gap:12px;min-width:0}.mark{width:38px;height:38px;border-radius:12px;background:linear-gradient(140deg,#9be7d4,#8ea6ff);color:#0c1722;display:grid;place-items:center;font-weight:900}.eyebrow{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8d9ab0}.title{font-size:20px;font-weight:750;letter-spacing:-.03em;margin-top:2px}.sub{font-size:12px;color:#91a0b6;margin-top:3px}.close{border:1px solid #323e53;background:#182132;color:#e9edf5;width:38px;height:38px;border-radius:12px;font-size:22px;cursor:pointer}.tabs{display:flex;gap:6px;padding:12px 22px;border-bottom:1px solid #242d3d;overflow:auto}.tab{border:1px solid transparent;background:transparent;color:#94a1b6;padding:10px 14px;border-radius:10px;font-size:13px;white-space:nowrap;cursor:pointer}.tab.active{background:#1c293a;color:#d9f8f0;border-color:#355b61}.body{overflow:auto;padding:clamp(16px,3vw,32px);flex:1}.hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.h2{font-size:26px;font-weight:750;letter-spacing:-.04em;margin:0 0 8px}.muted{color:#9ba9bf;font-size:13px;line-height:1.65;max-width:720px}.btn{background:#b8f1e0;color:#0b191b;border:0;font-weight:700;padding:10px 14px;border-radius:10px;cursor:pointer;font-size:12px}.btn.secondary{background:#1a2535;color:#dce5f3;border:1px solid #344157}.btn.danger{background:#3a2229;color:#ffc0c7;border:1px solid #65424b}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{border:1px solid #293449;background:#121a27;border-radius:15px;padding:17px;min-width:0}.card h3{margin:0 0 7px;font-size:14px;letter-spacing:-.01em}.card p{margin:0;color:#9ba9bf;font-size:12px;line-height:1.6}.card .actions{display:flex;gap:8px;margin-top:15px;flex-wrap:wrap}.statrow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.stat{padding:17px;border:1px solid #293449;border-radius:14px;background:#121a27}.stat .n{font-size:27px;font-weight:800;letter-spacing:-.04em}.stat .l{font-size:11px;color:#96a4ba;margin-top:4px}.form{display:grid;grid-template-columns:2fr 1fr 1fr .8fr auto;gap:9px;margin-bottom:18px;padding:14px;background:#101724;border:1px solid #293449;border-radius:14px}.field{width:100%;background:#0b1019;color:#e9edf5;border:1px solid #313e53;border-radius:9px;padding:10px 11px;font:inherit;font-size:12px;min-width:0}.label{display:block;font-size:11px;color:#a9b5c8;margin:0 0 6px}.task{display:grid;grid-template-columns:minmax(0,1.8fr) .85fr .8fr .7fr auto;gap:12px;align-items:center;padding:14px;border-bottom:1px solid #242d3d;font-size:12px}.task:first-child{border-top:1px solid #242d3d}.taskname{font-weight:650;color:#e9edf5}.pill{display:inline-flex;width:max-content;padding:5px 8px;border-radius:999px;background:#253041;color:#cbd5e5;font-size:10px}.pill.done{background:#16372f;color:#a7f0d8}.pill.active{background:#2b294b;color:#c9c2ff}.empty{padding:36px 20px;text-align:center;color:#8f9db3;border:1px dashed #364257;border-radius:14px;font-size:13px}.notice{padding:12px 14px;border-radius:12px;background:#192332;border:1px solid #344157;color:#aab8cd;font-size:11px;line-height:1.6;margin-bottom:18px}.sectionlabel{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#8293aa;margin:22px 0 10px}.mini{font-size:10px;color:#8594aa;line-height:1.5}.twocol{display:grid;grid-template-columns:1.3fr .7fr;gap:14px}.row{display:flex;justify-content:space-between;gap:10px;align-items:center}.footer{padding:10px 22px;border-top:1px solid #242d3d;color:#7f8ca1;font-size:10px;display:flex;justify-content:space-between;gap:12px}.fieldgroup{margin:12px 0}.currency{font-size:13px;color:#becce0}@media(max-width:760px){.grid{grid-template-columns:1fr}.statrow{grid-template-columns:repeat(2,minmax(0,1fr))}.form{grid-template-columns:1fr 1fr}.form .wide{grid-column:1/-1}.task{grid-template-columns:1fr auto}.task .mobilehide{display:none}.twocol{grid-template-columns:1fr}.top{padding:14px}.tabs{padding:10px}.hero{display:block}.hero .btn{margin-top:14px}.body{padding:14px}.title{font-size:18px}.footer{padding:9px 14px}}';
  const style = document.createElement('style'); style.textContent = css; shadow.appendChild(style);
  const veil = document.createElement('div'); veil.className = 'veil'; veil.setAttribute('role','dialog'); veil.setAttribute('aria-modal','true'); veil.setAttribute('aria-label','Whilo Enterprise workspace');
  veil.innerHTML = '<section class="panel"><header class="top"><div class="brand"><div class="mark">W</div><div><div class="eyebrow">Whilo / Operations</div><div class="title">Company workspace</div><div class="sub">Turn repeatable work into measurable outcomes.</div></div></div><button class="close" data-act="close" aria-label="Close workspace">×</button></header><nav class="tabs" aria-label="Enterprise workspace"><button class="tab" data-tab="work">▤ Work</button><button class="tab" data-tab="company">▦ Company</button><button class="tab" data-tab="connect">↗ Connect</button><button class="tab" data-tab="results">◷ Results</button></nav><main class="body" id="view"></main><footer class="footer"><span>Local workspace data · stored in this browser</span><span>Outcome-first operations · approvals before consequential actions</span></footer></section>';
  shadow.appendChild(veil);
  const view = veil.querySelector('#view');
  let active = 'work';
  function money(n) { return new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n); }
  function taskCard(t) {
    const status = t.status === 'Done' ? 'done' : (t.status === 'In progress' ? 'active' : '');
    return '<div class="task"><div><div class="taskname">' + esc(t.title) + '</div><div class="mini">' + esc(t.department) + ' · ' + esc(t.priority) + ' priority</div></div><div class="mobilehide">' + esc(t.owner) + '</div><div><span class="pill ' + status + '">' + esc(t.status) + '</span></div><div class="mini mobilehide">' + esc(t.created) + '</div><div class="actions">' + (t.status !== 'Done' ? '<button class="btn secondary" data-act="advance" data-id="' + esc(t.id) + '">' + (t.status === 'Queued' ? 'Start tracking' : 'Mark done') + '</button>' : '<button class="btn secondary" data-act="remove" data-id="' + esc(t.id) + '">Archive</button>') + '</div></div>';
  }
  function workPage() {
    const activeCount = state.tasks.filter(function (t) { return t.status !== 'Done'; }).length;
    const doneCount = state.tasks.filter(function (t) { return t.status === 'Done'; }).length;
    let out = '<div class="hero"><div><h2 class="h2">Work queue</h2><p class="muted">Define jobs with an owner, department and clear completion state. This queue tracks work locally; it does not trigger an agent run by itself.</p></div><button class="btn secondary" data-act="sample">Add example job</button></div>';
    out += '<div class="statrow"><div class="stat"><div class="n">' + state.tasks.length + '</div><div class="l">All jobs tracked</div></div><div class="stat"><div class="n">' + activeCount + '</div><div class="l">Open jobs</div></div><div class="stat"><div class="n">' + doneCount + '</div><div class="l">Completed jobs</div></div><div class="stat"><div class="n">' + (state.tasks.length ? Math.round(doneCount / state.tasks.length * 100) : 0) + '%</div><div class="l">Completion rate</div></div></div>';
    out += '<form id="new-task" class="form"><input class="field wide" name="title" required maxlength="180" placeholder="Outcome to deliver (e.g. Prepare 25 qualified target accounts)" aria-label="Outcome to deliver"><select class="field" name="department" aria-label="Department">' + DEPARTMENTS.map(function (d) { return '<option>' + esc(d.name) + '</option>'; }).join('') + '</select><select class="field" name="owner" aria-label="Owner">' + PETS.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join('') + '</select><select class="field" name="priority" aria-label="Priority"><option>Normal</option><option>High</option><option>Critical</option></select><button class="btn" type="submit">Create job</button></form>';
    out += '<div class="row"><div class="sectionlabel">Latest jobs</div><span class="mini">' + state.tasks.length + ' tracked in this browser</span></div>';
    out += state.tasks.length ? state.tasks.slice().reverse().map(taskCard).join('') : '<div class="empty">No work tracked yet. Create one job above or start from a department playbook.</div>';
    return out;
  }
  function companyPage() {
    let out = '<div class="hero"><div><h2 class="h2">Company operating model</h2><p class="muted">One shared operating layer across departments. Start with work that is repeatable, already outsourced and easy to verify; expand into higher-judgement work after quality and controls are proven.</p></div></div><div class="notice">These are playbooks and task templates, not autonomous departments yet. Creating a task adds it to this browser’s Work queue. Production execution needs connected tools, a durable backend and approval policies.</div><div class="grid">';
    out += DEPARTMENTS.map(function (d) { return '<article class="card"><div class="eyebrow">' + esc(d.id) + '</div><h3>' + esc(d.name) + '</h3><p>' + esc(d.subtitle) + '</p><div class="actions"><button class="btn secondary" data-act="playbook" data-id="' + esc(d.id) + '">Start playbook</button></div></article>'; }).join('');
    return out + '</div><div class="sectionlabel">Expansion principle</div><div class="card"><h3>Outcome before headcount replacement</h3><p>Each workflow needs a named owner, source systems, acceptance criteria, exception handling, an approval threshold and a measurable result before it is allowed to run unattended.</p></div>';
  }
  function connectPage() {
    let out = '<div class="hero"><div><h2 class="h2">Connected systems</h2><p class="muted">A business autopilot is only useful when it can read trusted sources and safely act in the systems where work happens.</p></div></div><div class="notice">Connection status is not verified in this interface. The buttons below create setup work items; they do not authorize OAuth access or claim an integration is connected.</div><div class="grid">';
    out += INTEGRATIONS.map(function (i) { return '<article class="card"><div class="row"><span style="font-size:22px;color:#b8f1e0">' + i.icon + '</span><span class="pill">Not connected</span></div><h3 style="margin-top:14px">' + esc(i.name) + '</h3><p>' + esc(i.detail) + '</p><div class="actions"><button class="btn secondary" data-act="connect-setup" data-id="' + esc(i.name) + '">Plan setup</button></div></article>'; }).join('');
    return out + '</div>';
  }
  function resultsPage() {
    const done = state.tasks.filter(function (t) { return t.status === 'Done'; }).length;
    const hours = done * state.hoursPerTask;
    const value = hours * state.hourlyCost;
    return '<div class="hero"><div><h2 class="h2">Outcomes & ROI</h2><p class="muted">Track only results recorded in this browser. Savings are estimates based on the assumptions below, not verified customer outcomes or booked revenue.</p></div></div><div class="statrow"><div class="stat"><div class="n">' + done + '</div><div class="l">Jobs marked complete</div></div><div class="stat"><div class="n">' + hours.toFixed(1) + 'h</div><div class="l">Estimated hours recovered</div></div><div class="stat"><div class="n">' + money(value) + '</div><div class="l">Estimated labor value</div></div><div class="stat"><div class="n">' + (state.tasks.length ? Math.round(done / state.tasks.length * 100) : 0) + '%</div><div class="l">Completion rate</div></div></div><div class="twocol"><div class="card"><h3>Calculation assumptions</h3><p>Adjust these assumptions to fit the workflow. Record actual cycle time and cost before using the numbers in customer reporting.</p><form id="assumptions"><div class="fieldgroup"><label class="label" for="hours">Hours saved per completed job</label><input id="hours" class="field" type="number" name="hours" min="0" max="1000" step=".25" value="' + state.hoursPerTask + '"></div><div class="fieldgroup"><label class="label" for="cost">Labor cost per hour (USD)</label><input id="cost" class="field" type="number" name="cost" min="0" max="100000" step="1" value="' + state.hourlyCost + '"></div><button class="btn" type="submit">Update estimate</button></form></div><div class="card"><h3>What to instrument next</h3><p>Connect verified source events for jobs accepted, jobs completed, human corrections, exceptions, time-to-resolution, cost per result and attributable pipeline. Do not report ROI until the measurement source and baseline are defined.</p><div class="sectionlabel">Minimum proof</div><p>Baseline → tracked run → human QA → accepted outcome → verified cost → customer renewal.</p></div></div>';
  }
  function render() {
    shadow.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === active); });
    if (active === 'work') view.innerHTML = workPage();
    if (active === 'company') view.innerHTML = companyPage();
    if (active === 'connect') view.innerHTML = connectPage();
    if (active === 'results') view.innerHTML = resultsPage();
  }
  function openPanel(tab) {
    active = tab || 'work';
    veil.classList.add('open');
    render();
    document.body.style.overflow = 'hidden';
  }
  function closePanel() { veil.classList.remove('open'); document.body.style.overflow = ''; }
  function addTask(title, department, owner, priority) {
    state.tasks.push({ id: String(Date.now()) + Math.random().toString(36).slice(2,7), title: title, department: department || 'Operations', owner: owner || 'Whilo', priority: priority || 'Normal', status: 'Queued', created: new Date().toLocaleDateString() });
    save();
  }
  shadow.addEventListener('click', function (event) {
    const tab = event.target.closest('[data-tab]');
    if (tab) { active = tab.getAttribute('data-tab'); render(); return; }
    const action = event.target.closest('[data-act]');
    if (!action) return;
    const act = action.getAttribute('data-act'), id = action.getAttribute('data-id');
    if (act === 'close') { closePanel(); return; }
    if (act === 'sample') { addTask('Map one repeatable outsourced workflow and define its acceptance criteria', 'Operations', 'Whilo', 'High'); render(); return; }
    if (act === 'advance') {
      const task = state.tasks.find(function (t) { return t.id === id; });
      if (task) task.status = task.status === 'Queued' ? 'In progress' : 'Done';
      save(); render(); return;
    }
    if (act === 'remove') { state.tasks = state.tasks.filter(function (t) { return t.id !== id; }); save(); render(); return; }
    if (act === 'playbook') {
      const dept = DEPARTMENTS.find(function (d) { return d.id === id; });
      if (dept) addTask(dept.template, dept.name, 'Whilo', 'High');
      active = 'work'; render(); return;
    }
    if (act === 'connect-setup') { addTask('Plan and verify integration setup: ' + id, 'IT & systems', 'Whilo', 'High'); active = 'work'; render(); return; }
  });
  shadow.addEventListener('submit', function (event) {
    event.preventDefault();
    const form = event.target;
    if (form.id === 'new-task') {
      const fd = new FormData(form);
      const title = String(fd.get('title') || '').trim();
      if (!title) return;
      addTask(title, fd.get('department'), fd.get('owner'), fd.get('priority'));
      render();
    }
    if (form.id === 'assumptions') {
      const fd = new FormData(form);
      state.hoursPerTask = Math.max(0, Math.min(1000, Number(fd.get('hours')) || 0));
      state.hourlyCost = Math.max(0, Math.min(100000, Number(fd.get('cost')) || 0));
      save(); render();
    }
  });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && veil.classList.contains('open')) closePanel(); });

  function boot() {
    injectTopbar();
    const observer = new MutationObserver(function () { injectTopbar(); });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { observer.disconnect(); injectTopbar(); }, 10000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();