(function () {
  'use strict';
  if (window.__whiloEnterpriseNavLoaded) return;
  window.__whiloEnterpriseNavLoaded = true;

  const STORAGE_KEY = 'whilo-enterprise-work-v1';
  const PETS = ['Whilo', 'Fynn', 'Nori', 'Capuccino', 'Ollie', 'Pico'];
  const BOT_ROLES = ['Browser Researcher', 'Computer Operator', 'Data Analyst', 'CRM Operator', 'Writer', 'Coder', 'QA Verifier', 'Workflow Planner'];
  function plannedBots(department) {
    const map = {
      'Revenue': ['Browser Researcher', 'CRM Operator', 'QA Verifier'],
      'Marketing': ['Browser Researcher', 'Writer', 'Data Analyst', 'QA Verifier'],
      'Customer support': ['Browser Researcher', 'Writer', 'QA Verifier'],
      'Operations': ['Workflow Planner', 'Data Analyst', 'QA Verifier'],
      'Finance operations': ['Data Analyst', 'Workflow Planner', 'QA Verifier'],
      'People & recruiting': ['Browser Researcher', 'Data Analyst', 'QA Verifier'],
      'IT & systems': ['Computer Operator', 'Workflow Planner', 'QA Verifier'],
      'Procurement': ['Browser Researcher', 'Data Analyst', 'QA Verifier']
    };
    return map[department] || ['Workflow Planner', 'QA Verifier'];
  }
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
    { id: 'slack', name: 'Slack', detail: 'Workspace OAuth; message sends stay approval-gated', icon: '◌', action: 'connect-slack', button: 'Connect Slack' },
    { id: 'twilio', name: 'SMS via Twilio', detail: 'Verify tenant-owned API credentials; no message is sent during setup', icon: '✉', action: 'connect-twilio', button: 'Configure SMS' },
    { id: 'imessage-bridge', name: 'iMessage via Mac Bridge', detail: 'One-time QR device pairing; native message transport is a separate release gate', icon: '⌘', action: 'pair-imessage', button: 'Pair Mac (QR)' },
    { id: 'github', name: 'GitHub', detail: 'Repositories, issues and pull requests', icon: '⌘', action: 'connect-setup', button: 'Plan setup' },
    { id: 'gmail', name: 'Gmail & Calendar', detail: 'Research, drafts and calendar preparation', icon: '✉', action: 'connect-setup', button: 'Plan setup' },
    { id: 'microsoft', name: 'Microsoft 365', detail: 'Outlook, calendar and approved files', icon: '▤', action: 'connect-setup', button: 'Plan setup' },
    { id: 'notion', name: 'Notion', detail: 'Search and draft workspace pages', icon: '▤', action: 'connect-setup', button: 'Plan setup' },
    { id: 'linear', name: 'Linear', detail: 'Issues, projects and status updates', icon: '◉', action: 'connect-setup', button: 'Plan setup' },
    { id: 'hubspot', name: 'HubSpot', detail: 'Contacts, companies and CRM preparation', icon: '↗', action: 'connect-setup', button: 'Plan setup' },
    { id: 'salesforce', name: 'Salesforce', detail: 'CRM records with least-privilege scopes', icon: '↗', action: 'connect-setup', button: 'Plan setup' }
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
  let connectorCache = null;
  let connectorLoading = false;
  let connectorFeedback = '';
  let connectorBusy = false;
  let showTwilioForm = false;
  let bridgePairing = null;
  let bridgePollTimer = null;
  let cloudMissionsCache = null;
  let cloudMissionsLoading = false;
  let cloudMissionsFeedback = '';
  let cloudMissionBusy = false;
  let cloudAuthSession = null;
  let cloudAuthConfigured = false;
  let cloudAuthChecked = false;
  let cloudAuthLoading = false;
  let cloudAuthBusy = false;
  let cloudAuthFeedback = '';

  let messagesInbox = [];
  let messagesDiscover = [];
  let messagesPeople = [];
  let messagesRows = [];
  let messagesSelectedId = '';
  let messagesScope = 'inbox';
  let messagesSearch = '';
  let messagesLoading = false;
  let messagesBusy = false;
  let messagesTimelineLoading = false;
  let messagesFeedback = '';
  let messagesCreateOpen = false;
  let messagesPeopleQuery = '';
  let messagesPeopleLoading = false;
  let messagesThreadRootId = '';
  let messagesReplyToId = '';
  let messageComposerDraft = '';
  let messagePollTimer = null;

  async function whiloAccessToken() {
    try {
      const cloudAuth = window.WhiloCloudAuth;
      if (cloudAuth && typeof cloudAuth.getAccessToken === 'function') {
        const cloudToken = await cloudAuth.getAccessToken();
        if (typeof cloudToken === 'string' && cloudToken) return cloudToken;
      }
      const auth = window.whiloAuth;
      if (auth && typeof auth.getAccessToken === 'function') {
        const found = await auth.getAccessToken();
        if (typeof found === 'string' && found) return found;
        if (found && typeof found.access_token === 'string') return found.access_token;
      }
      if (auth && auth.auth && typeof auth.auth.getSession === 'function') {
        const result = await auth.auth.getSession();
        const session = result && result.data && result.data.session;
        if (session && session.access_token) return session.access_token;
      }
      if (window.supabase && window.supabase.auth && typeof window.supabase.auth.getSession === 'function') {
        const result = await window.supabase.auth.getSession();
        const session = result && result.data && result.data.session;
        if (session && session.access_token) return session.access_token;
      }
      // Support the standard Supabase browser session key only; no other local storage values are read.
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !/^sb-[a-z0-9-]+-auth-token$/i.test(key)) continue;
        try {
          const value = JSON.parse(localStorage.getItem(key) || '{}');
          if (value && typeof value.access_token === 'string') return value.access_token;
          if (value && value.currentSession && typeof value.currentSession.access_token === 'string') return value.currentSession.access_token;
        } catch (_) {}
      }
    } catch (_) {}
    return '';
  }

  async function whiloApi(path, options) {
    const token = await whiloAccessToken();
    if (!token) throw new Error('Sign in to Whilo with the configured workspace account before connecting systems.');
    const config = options || {};
    const headers = Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/json' }, config.headers || {});
    if (config.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await fetch(path, Object.assign({}, config, { headers, cache: 'no-store' }));
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data && data.error ? data.error : 'Whilo connector API is not ready. Check server configuration.');
    return data;
  }

  async function loadCloudAuth() {
    if (cloudAuthLoading || cloudAuthChecked) return;
    cloudAuthLoading = true;
    try {
      if (!window.WhiloCloudAuth) throw new Error('Cloud authentication script is not loaded. Refresh Whilo and retry.');
      await window.WhiloCloudAuth.publicConfig();
      cloudAuthConfigured = true;
      try {
        cloudAuthSession = await window.WhiloCloudAuth.getSession();
        cloudAuthFeedback = '';
      } catch (sessionError) {
        cloudAuthSession = null;
        cloudAuthFeedback = sessionError && sessionError.message ? sessionError.message : 'The saved cloud session expired. Sign in again.';
      }
    } catch (error) {
      cloudAuthConfigured = false;
      cloudAuthSession = null;
      cloudAuthFeedback = error && error.message ? error.message : 'Cloud identity is not configured.';
    } finally {
      cloudAuthLoading = false;
      cloudAuthChecked = true;
      if (active === 'work' || active === 'connect' || active === 'messages') render();
    }
  }

  function cloudAuthCard() {
    if (!cloudAuthChecked && !cloudAuthLoading) loadCloudAuth();
    if (cloudAuthLoading) return '<div class="notice">Checking cloud identity configuration…</div>';
    if (cloudAuthSession) {
      return '<div class="card" style="margin:12px 0"><div class="row"><div><div class="sectionlabel">Cloud identity</div><strong>' + esc(cloudAuthSession.email || 'Whilo workspace member') + '</strong><div class="mini">Authenticated session · server-side workspace access is checked on every request.</div></div><button class="btn secondary" data-act="cloud-signout"' + (cloudAuthBusy ? ' disabled' : '') + '>Sign out</button></div>' +
        (cloudAuthFeedback ? '<p class="muted">' + esc(cloudAuthFeedback) + '</p>' : '') + '</div>';
    }
    const unavailable = !cloudAuthConfigured;
    return '<div class="card" style="margin:12px 0"><div class="sectionlabel">Cloud identity</div><h3>Sign in to sync your workspace</h3>' +
      '<p class="muted">Use the account provisioned in Supabase Auth. Your password is sent only to Supabase over HTTPS for verification; Whilo does not store the password. The session token is kept in this browser and may be signed out below.</p>' +
      (cloudAuthFeedback ? '<div class="notice">' + esc(cloudAuthFeedback) + '</div>' : '') +
      '<form id="cloud-signin-form"><div class="fieldgroup"><label class="label" for="whilo-cloud-email">Workspace email</label><input id="whilo-cloud-email" class="field" name="email" type="email" autocomplete="username" required maxlength="320" placeholder="you@company.com"' + (unavailable || cloudAuthBusy ? ' disabled' : '') + '></div>' +
      '<div class="fieldgroup"><label class="label" for="whilo-cloud-password">Password</label><input id="whilo-cloud-password" class="field" name="password" type="password" autocomplete="current-password" required maxlength="256"' + (unavailable || cloudAuthBusy ? ' disabled' : '') + '></div>' +
      '<button class="btn" type="submit"' + (unavailable || cloudAuthBusy ? ' disabled' : '') + '>' + (cloudAuthBusy ? 'Signing in…' : 'Sign in to cloud') + '</button></form>' +
      (unavailable ? '<p class="mini">Cloud sign-in remains disabled until SUPABASE_URL and SUPABASE_ANON_KEY are configured in Vercel.</p>' : '') + '</div>';
  }

  async function loadConnectors() {
    if (connectorLoading) return;
    connectorLoading = true;
    try {
      connectorCache = await whiloApi('/api/connectors', { method: 'GET' });
      connectorFeedback = '';
    } catch (error) {
      connectorFeedback = error && error.message ? error.message : 'Connector status could not be verified.';
    } finally {
      connectorLoading = false;
      if (active === 'connect') render();
    }
  }

  async function loadCloudMissions() {
    if (cloudMissionsLoading) return;
    cloudMissionsLoading = true;
    try {
      const data = await whiloApi('/api/missions', { method: 'GET' });
      cloudMissionsCache = Array.isArray(data.missions) ? data.missions : [];
      cloudMissionsFeedback = '';
    } catch (error) {
      cloudMissionsFeedback = error && error.message ? error.message : 'Cloud mission status could not be loaded.';
    } finally {
      cloudMissionsLoading = false;
      if (active === 'work') render();
    }
  }

  async function persistLocalTask(id) {
    const task = state.tasks.find(function (item) { return item.id === id; });
    if (!task) throw new Error('Local task was not found.');
    if (task.serverMissionId) throw new Error('This task is already linked to a cloud mission.');
    const mission = ensureMission(task);
    if (!mission) throw new Error('The mission plan could not be prepared.');
    const data = await whiloApi('/api/missions', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'local-task-' + task.id },
      body: JSON.stringify({
        goal: task.title,
        department: task.department,
        risk: task.priority === 'Critical' ? 'critical' : task.priority === 'High' ? 'high' : 'medium',
        budget: 0,
        budgetCurrency: 'USD',
        acceptanceCriteria: Array.isArray(mission.acceptanceCriteria) && mission.acceptanceCriteria.length
          ? mission.acceptanceCriteria
          : ['The requested outcome is documented', 'Evidence is included', 'Exceptions are disclosed'],
        steps: Array.isArray(mission.tasks) ? mission.tasks.map(function (step) {
          return {
            id: step.id, title: step.title, role: step.role,
            dependsOn: step.dependsOn || [], toolScopes: step.toolScopes || ['read', 'draft'], maxAttempts: 2
          };
        }) : []
      })
    });
    task.serverMissionId = data.missionId;
    task.serverMissionState = data.state;
    task.serverMissionExecutionStatus = data.executionStatus || 'not_started';
    save();
    cloudMissionsCache = null;
    cloudMissionsFeedback = 'Mission saved to the server. No agent has started.';
    await loadCloudMissions();
    if (active === 'work') render();
    return data;
  }

  async function decideCloudMission(id, decision) {
    const data = await whiloApi('/api/missions/approve', {
      method: 'POST',
      body: JSON.stringify({
        missionId: id,
        decision: decision,
        reason: decision === 'approved'
          ? 'Approved by the workspace owner. Queueing is not proof of execution.'
          : 'Rejected by the workspace owner.'
      })
    });
    cloudMissionsFeedback = data.message || (decision === 'approved'
      ? 'Approval recorded. Waiting for a configured worker; no execution is claimed.'
      : 'Mission rejected; no job was queued.');
    cloudMissionsCache = null;
    await loadCloudMissions();
    return data;
  }

  function cloudMissionCard(mission) {
    const stateName = String(mission.state || 'unknown');
    let action = '';
    if (stateName === 'awaiting_approval') {
      action = '<div class="actions"><button class="btn" data-act="approve-cloud-mission" data-id="' + esc(mission.id) + '"' + (cloudMissionBusy ? ' disabled' : '') + '>Approve & queue</button><button class="btn secondary" data-act="reject-cloud-mission" data-id="' + esc(mission.id) + '"' + (cloudMissionBusy ? ' disabled' : '') + '>Reject</button></div>';
    } else if (stateName === 'queued') {
      action = '<div class="mini">Approval is recorded. Execution is not complete; this job is waiting for a real worker.</div>';
    } else if (stateName === 'running') {
      action = '<div class="mini">A worker reports this as running. Verify provider evidence before accepting its output.</div>';
    } else if (stateName === 'delivered') {
      action = '<div class="mini">Delivered state recorded; inspect the evidence and acceptance receipt before using the result externally.</div>';
    }
    return '<article class="card" style="margin-top:10px"><div class="row"><h3 style="margin:0">' + esc(mission.goal) + '</h3><span class="pill">' + esc(stateName.replace(/_/g, ' ')) + '</span></div>' +
      '<p class="muted">' + esc(mission.department || 'Operations') + ' · ' + esc(mission.risk || 'medium') + ' risk · created ' + esc(mission.created_at || 'date unavailable') + '</p>' +
      '<div class="mini">Cloud mission ID: ' + esc(mission.id) + '</div>' + action + '</article>';
  }

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
    if (!parent.querySelector('[data-whilo-message-tab]')) {
      const portugueseMessages = /pt/i.test(document.documentElement.lang || '') || norm(found.chat.innerText || found.chat.textContent).includes('convers');
      const messageButton = found.chat.cloneNode(false);
      messageButton.removeAttribute('id'); messageButton.removeAttribute('href'); messageButton.removeAttribute('aria-current');
      messageButton.removeAttribute('aria-pressed'); messageButton.removeAttribute('data-state');
      messageButton.setAttribute('type', 'button');
      messageButton.setAttribute('data-whilo-message-tab', 'messages');
      messageButton.setAttribute('aria-label', portugueseMessages ? 'Mensagens' : 'Messages');
      messageButton.title = portugueseMessages ? 'Mensagens' : 'Messages';
      messageButton.innerHTML = '<span aria-hidden="true" style="margin-right:6px;opacity:.8">✉</span><span>' + (portugueseMessages ? 'Mensagens' : 'Messages') + '</span>';
      messageButton.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); openPanel('messages'); });
      found.chat.insertAdjacentElement('afterend', messageButton);
    }
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
  const css = ':host{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e9edf5}*{box-sizing:border-box}.veil{position:fixed;inset:0;z-index:2147483000;background:rgba(5,8,14,.78);backdrop-filter:blur(12px);display:none;padding:clamp(8px,2.5vw,26px)}.veil.open{display:flex}.panel{width:min(1420px,100%);height:min(900px,100%);margin:auto;background:#0d111a;border:1px solid #242d3d;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 30px 100px rgba(0,0,0,.55)}.top{display:flex;align-items:center;gap:18px;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #242d3d;background:#101622}.brand{display:flex;align-items:center;gap:12px;min-width:0}.mark{width:38px;height:38px;border-radius:12px;background:linear-gradient(140deg,#9be7d4,#8ea6ff);color:#0c1722;display:grid;place-items:center;font-weight:900}.eyebrow{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8d9ab0}.title{font-size:20px;font-weight:750;letter-spacing:-.03em;margin-top:2px}.sub{font-size:12px;color:#91a0b6;margin-top:3px}.close{border:1px solid #323e53;background:#182132;color:#e9edf5;width:38px;height:38px;border-radius:12px;font-size:22px;cursor:pointer}.tabs{display:flex;gap:6px;padding:12px 22px;border-bottom:1px solid #242d3d;overflow:auto}.tab{border:1px solid transparent;background:transparent;color:#94a1b6;padding:10px 14px;border-radius:10px;font-size:13px;white-space:nowrap;cursor:pointer}.tab.active{background:#1c293a;color:#d9f8f0;border-color:#355b61}.body{overflow:auto;padding:clamp(16px,3vw,32px);flex:1}.hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.h2{font-size:26px;font-weight:750;letter-spacing:-.04em;margin:0 0 8px}.muted{color:#9ba9bf;font-size:13px;line-height:1.65;max-width:720px}.btn{background:#b8f1e0;color:#0b191b;border:0;font-weight:700;padding:10px 14px;border-radius:10px;cursor:pointer;font-size:12px}.btn.secondary{background:#1a2535;color:#dce5f3;border:1px solid #344157}.btn.danger{background:#3a2229;color:#ffc0c7;border:1px solid #65424b}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{border:1px solid #293449;background:#121a27;border-radius:15px;padding:17px;min-width:0}.card h3{margin:0 0 7px;font-size:14px;letter-spacing:-.01em}.card p{margin:0;color:#9ba9bf;font-size:12px;line-height:1.6}.card .actions{display:flex;gap:8px;margin-top:15px;flex-wrap:wrap}.statrow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.stat{padding:17px;border:1px solid #293449;border-radius:14px;background:#121a27}.stat .n{font-size:27px;font-weight:800;letter-spacing:-.04em}.stat .l{font-size:11px;color:#96a4ba;margin-top:4px}.form{display:grid;grid-template-columns:2fr 1fr 1fr .9fr .9fr auto;gap:9px;margin-bottom:18px;padding:14px;background:#101724;border:1px solid #293449;border-radius:14px}.field{width:100%;background:#0b1019;color:#e9edf5;border:1px solid #313e53;border-radius:9px;padding:10px 11px;font:inherit;font-size:12px;min-width:0}.label{display:block;font-size:11px;color:#a9b5c8;margin:0 0 6px}.task{display:grid;grid-template-columns:minmax(0,1.8fr) .85fr .8fr .7fr auto;gap:12px;align-items:center;padding:14px;border-bottom:1px solid #242d3d;font-size:12px}.task:first-child{border-top:1px solid #242d3d}.mission-plan{margin-top:10px;border:1px solid #2a364a;border-radius:9px;padding:8px 10px;color:#c7d4e6;font-size:11px}.mission-plan summary{cursor:pointer;font-weight:650}.mission-plan ol{padding-left:18px;margin:10px 0}.mission-plan li{margin:8px 0;line-height:1.5}.mission-plan .mini{margin-top:3px}.taskname{font-weight:650;color:#e9edf5}.pill{display:inline-flex;width:max-content;padding:5px 8px;border-radius:999px;background:#253041;color:#cbd5e5;font-size:10px}.pill.done{background:#16372f;color:#a7f0d8}.pill.active{background:#2b294b;color:#c9c2ff}.pill.review{background:#49351c;color:#ffd9a0}.empty{padding:36px 20px;text-align:center;color:#8f9db3;border:1px dashed #364257;border-radius:14px;font-size:13px}.notice{padding:12px 14px;border-radius:12px;background:#192332;border:1px solid #344157;color:#aab8cd;font-size:11px;line-height:1.6;margin-bottom:18px}.sectionlabel{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#8293aa;margin:22px 0 10px}.mini{font-size:10px;color:#8594aa;line-height:1.5}.twocol{display:grid;grid-template-columns:1.3fr .7fr;gap:14px}.row{display:flex;justify-content:space-between;gap:10px;align-items:center}.footer{padding:10px 22px;border-top:1px solid #242d3d;color:#7f8ca1;font-size:10px;display:flex;justify-content:space-between;gap:12px}.fieldgroup{margin:12px 0}.currency{font-size:13px;color:#becce0}@media(max-width:760px){.grid{grid-template-columns:1fr}.statrow{grid-template-columns:repeat(2,minmax(0,1fr))}.form{grid-template-columns:1fr 1fr}.form .wide{grid-column:1/-1}.task{grid-template-columns:1fr auto}.task .mobilehide{display:none}.twocol{grid-template-columns:1fr}.top{padding:14px}.tabs{padding:10px}.hero{display:block}.hero .btn{margin-top:14px}.body{padding:14px}.title{font-size:18px}.footer{padding:9px 14px}}';
  const messageCss = `
.messages-hero .actions{display:flex;gap:8px;flex-wrap:wrap}
.messages-shell{height:min(68vh,690px);min-height:450px;display:grid;grid-template-columns:320px minmax(0,1fr);border:1px solid #2a3549;border-radius:16px;overflow:hidden;background:#0b111b}
.messages-sidebar{min-width:0;min-height:0;display:flex;flex-direction:column;background:#0e1520;border-right:1px solid #293449}
.messages-sidebar-head{padding:14px;border-bottom:1px solid #253044;display:grid;gap:12px}
.messages-scope{display:grid;grid-template-columns:1fr 1fr;gap:5px;background:#090e16;padding:4px;border:1px solid #263247;border-radius:10px}
.messages-scope button{background:transparent;border:0;color:#8998af;border-radius:7px;padding:8px;cursor:pointer;font-size:11px}
.messages-scope button.active{background:#1d2b3b;color:#d3f8ee;box-shadow:0 0 0 1px #344e62 inset}
.message-conversation-list{overflow:auto;min-height:0;flex:1;padding:7px}
.message-conversation{width:100%;display:flex;align-items:center;gap:10px;text-align:left;background:transparent;border:1px solid transparent;border-radius:11px;padding:10px 8px;margin:1px 0;color:#e5edf7;cursor:pointer;min-width:0}
.message-conversation:hover{background:#162131}
.message-conversation.selected{background:#1a2a3b;border-color:#31495c}
.message-avatar{display:inline-flex;flex:0 0 42px;width:42px;height:42px;border-radius:14px;align-items:center;justify-content:center;background:linear-gradient(145deg,#b6f0df,#92a7ff);color:#10212b;font-weight:800;font-size:12px;letter-spacing:-.02em}
.message-avatar.direct{border-radius:50%}
.message-avatar.channel{background:linear-gradient(145deg,#f0c5a4,#d994b3);color:#2b1b23}
.message-avatar.supergroup{background:linear-gradient(145deg,#a9cbf4,#b8a4f2);color:#202039}
.message-avatar.tiny{flex-basis:28px;width:28px;height:28px;border-radius:10px;font-size:9px}
.message-conversation-copy{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.message-conversation-title{font-size:12px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.message-conversation-preview{font-size:10px;color:#91a0b7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.message-conversation-type{font-size:9px;color:#73839c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.message-conversation-trailing{display:flex;flex-direction:column;gap:5px;align-items:flex-end;align-self:stretch;justify-content:flex-start}
.message-time{font-size:9px;color:#75859d;white-space:nowrap}
.message-pill{font-size:9px;border-radius:999px;padding:4px 6px;background:#1c3b35;color:#9ee5d4}
.message-join-label{font-size:10px;color:#a8dfd4;white-space:nowrap}
.messages-chat{display:flex;flex-direction:column;min-width:0;min-height:0;background:radial-gradient(ellipse at top right,rgba(58,94,116,.13),transparent 42%),#0c131e}
.messages-chat-head{padding:12px 16px;border-bottom:1px solid #293449;background:#101927;min-width:0}
.messages-chat-head strong{font-size:13px;max-width:28vw;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.messages-chat-head .mini{margin-top:4px}
.messages-chat-head .actions{display:flex;gap:6px;flex-wrap:wrap}
.messages-chat-head .btn{padding:8px 10px}
.messages-scroll{overflow:auto;min-height:0;flex:1;padding:20px clamp(12px,2.5vw,28px);display:flex;flex-direction:column;gap:11px;scroll-behavior:smooth}
.message-line{display:flex;align-items:flex-end;gap:8px;max-width:100%}
.message-line.mine{justify-content:flex-end}
.message-bubble{max-width:min(84%,720px);min-width:95px;background:#172332;border:1px solid #27364b;border-radius:14px 14px 14px 5px;padding:10px 12px;overflow-wrap:anywhere;box-shadow:0 5px 18px rgba(0,0,0,.08)}
.message-line.mine .message-bubble{background:#18352f;border-color:#2d6258;border-radius:14px 14px 5px 14px}
.message-sender{font-size:10px;font-weight:800;color:#a8e9d9;margin-bottom:5px}
.message-line.mine .message-sender{color:#b5e8dc}
.message-content{font-size:12px;line-height:1.65;color:#e8eef6;white-space:pre-wrap;overflow-wrap:anywhere}
.message-meta{font-size:9px;color:#788ba4;text-align:right;margin-top:5px}
.message-reply-indicator{font-size:10px;color:#9edccb;border-left:2px solid #76c8b7;padding-left:7px;margin:4px 0}
.message-actions{display:flex;gap:10px;flex-wrap:wrap;opacity:.85;margin-top:7px}
.message-action{background:transparent;border:0;padding:0;color:#95a9be;cursor:pointer;font-size:9px}
.message-action:hover{color:#c4fff0}
.message-reactions{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
.message-reaction{background:#101b27;color:#b9c9dd;border:1px solid #33465c;border-radius:999px;padding:4px 7px;font-size:10px;cursor:pointer}
.message-reaction.mine{border-color:#62ad9e;background:#183a35}
.message-quick-reactions{display:flex;gap:4px;margin-top:6px;opacity:0;transition:opacity .12s}
.message-line:hover .message-quick-reactions,.message-line:focus-within .message-quick-reactions{opacity:1}
.message-quick-reactions button{padding:3px 5px;border-radius:7px;border:1px solid #2d3a4d;background:#0f1925;cursor:pointer;font-size:11px}
.message-compose-wrap{border-top:1px solid #293449;padding:12px 14px;background:#101724}
.message-compose{display:flex;gap:9px;align-items:flex-end}
.message-compose textarea{min-height:42px;max-height:140px;resize:vertical;background:#0a111b;color:#e9f0fa;border:1px solid #344258;border-radius:12px;padding:12px;width:100%;font:inherit;font-size:12px;line-height:1.5;outline:none}
.message-compose textarea:focus,.messages-sidebar .field:focus{border-color:#6eb6a9;box-shadow:0 0 0 2px rgba(110,182,169,.12)}
.message-compose .btn{min-height:42px;white-space:nowrap}
.message-compose-foot{display:flex;justify-content:space-between;gap:8px;color:#7788a0;font-size:9px;margin-top:7px}
.message-reply-bar{display:flex;align-items:center;justify-content:space-between;background:#162c2a;border:1px solid #2d5c53;border-radius:8px;padding:7px 10px;margin-bottom:8px;color:#a8e5d8;font-size:10px}
.message-reply-bar button{background:transparent;color:#bdece3;border:0;cursor:pointer}
.message-thread-banner{font-size:10px;color:#a2e6d8;padding:8px 16px;background:#132723;border-bottom:1px solid #284a43}
.message-empty{margin:auto;max-width:300px;text-align:center;padding:24px 12px;color:#96a6bd;font-size:11px;line-height:1.7}
.message-empty strong{display:block;color:#dce8f4;font-size:13px;margin:12px 0 6px}
.message-empty p{margin:0 0 15px}
.message-empty-mark{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;margin:0 auto;background:#1b2b3b;color:#b6f0df;font-size:22px;border:1px solid #37505f}
.message-create-panel{border:1px solid #2d3c52;background:#101a28;border-radius:16px;padding:16px;margin-bottom:14px}
.message-create-panel h3{margin:0;font-size:15px}
.message-create-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;margin-top:12px}
.message-create-form .fieldgroup{margin:0}
.message-create-form .fieldgroup:nth-child(3),.message-create-form .fieldgroup:nth-child(4){grid-column:1/-1}
.message-create-form .actions{grid-column:1/-1}
.message-checkbox{display:flex;align-items:center;gap:8px;font-size:10px;color:#b2c0d4;grid-column:1/-1}
.message-checkbox input{accent-color:#9be7d4}
.message-people-search{border-top:1px solid #293449;margin-top:14px;padding-top:12px}
.message-people-search .row{align-items:center}
.message-people-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}
.message-person-result{display:flex;align-items:center;gap:9px;text-align:left;background:#0c1420;border:1px solid #2b3a4f;border-radius:10px;padding:8px;color:#e7edf6;cursor:pointer;min-width:0}
.message-person-result>span:nth-child(2){display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.message-person-result strong{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.message-security-note{display:flex;gap:8px;align-items:flex-start;color:#7c8da5;font-size:10px;line-height:1.6;margin:12px 2px}
.message-security-note span{color:#72c1aa}
.message-intro-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
.message-feature-icon{font-size:22px;color:#b5eddf;margin-bottom:12px}
@media(max-width:850px){.messages-shell{grid-template-columns:280px minmax(0,1fr)}.messages-chat-head strong{max-width:34vw}.message-bubble{max-width:92%}}
@media(max-width:650px){.messages-shell{height:min(72vh,760px);min-height:470px;grid-template-columns:minmax(0,1fr)}.messages-shell[data-selected="true"] .messages-sidebar{display:none}.messages-shell[data-selected="true"] .messages-chat{display:flex}.messages-shell[data-selected="false"] .messages-chat{display:none}.messages-shell[data-selected="false"] .messages-sidebar{display:flex}.messages-chat-head{padding:10px}.messages-chat-head .row>.row{gap:8px;min-width:0}.messages-chat-head strong{max-width:42vw}.messages-chat-head .actions{gap:4px}.messages-chat-head .btn{font-size:9px;padding:7px}.messages-scroll{padding:13px 9px}.message-create-form{grid-template-columns:1fr}.message-create-form .fieldgroup:nth-child(3),.message-create-form .fieldgroup:nth-child(4),.message-create-form .actions{grid-column:auto}.message-people-results,.message-intro-grid{grid-template-columns:1fr}.messages-hero .actions{margin-top:12px}.message-bubble{max-width:91%;padding:9px}.message-quick-reactions{opacity:1}}
`;
  const style = document.createElement('style'); style.textContent = css + messageCss; shadow.appendChild(style);
  const veil = document.createElement('div'); veil.className = 'veil'; veil.setAttribute('role','dialog'); veil.setAttribute('aria-modal','true'); veil.setAttribute('aria-label','Whilo Enterprise workspace');
  veil.innerHTML = '<section class="panel"><header class="top"><div class="brand"><div class="mark">W</div><div><div class="eyebrow">Whilo / Operations</div><div class="title">Company workspace</div><div class="sub">Turn repeatable work into measurable outcomes.</div></div></div><button class="close" data-act="close" aria-label="Close workspace">×</button></header><nav class="tabs" aria-label="Enterprise workspace"><button class="tab" data-tab="work">▤ Work</button><button class="tab" data-tab="company">▦ Company</button><button class="tab" data-tab="connect">↗ Connect</button><button class="tab" data-tab="results">◷ Results</button></nav><main class="body" id="view"></main><footer class="footer"><span>Local workspace data · stored in this browser</span><span>Outcome-first operations · approvals before consequential actions</span></footer></section>';
  shadow.appendChild(veil);
  const view = veil.querySelector('#view');
  let active = 'work';
  function money(n) { return new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n); }
  function taskCard(t) {
    const status = t.status === 'Done' ? 'done' : (t.status === 'In progress' ? 'active' : (t.status === 'Review required' ? 'review' : ''));
    const workers = t.execution === 'pet-only' ? 'Pet only · no specialist Bots planned' : 'Bots planned: ' + (Array.isArray(t.bots) ? t.bots.join(', ') : plannedBots(t.department).join(', '));
    const mission = t.mission && typeof t.mission === 'object' ? t.mission : null;
    const missionState = mission && mission.state ? mission.state : 'local plan only';
    const actionLabel = t.status === 'Queued' ? 'Approve plan · tracking only' : (t.status === 'In progress' ? 'Send to manual review' : 'Submit manual evidence');
    const steps = mission && Array.isArray(mission.tasks) ? mission.tasks : [];
    const plan = steps.length
      ? '<details class="mission-plan"><summary>Mission plan · ' + steps.length + ' specialist Bots</summary><ol>' + steps.map(function (step) {
          const deps = Array.isArray(step.dependsOn) && step.dependsOn.length ? ' · waits for ' + step.dependsOn.join(', ') : ' · no dependencies';
          return '<li><strong>' + esc(step.role) + '</strong> — ' + esc(step.title) + '<div class="mini">' + esc(step.status) + esc(deps) + '</div></li>';
        }).join('') + '</ol><p class="mini">Plan only. No Bot has run and no external system has been changed.</p></details>'
      : '<div class="mini">Pet-only plan · no specialist Bots.</div>';
    const cloudBadge = t.serverMissionId
      ? '<div class="mini">Cloud mission: ' + esc(t.serverMissionState || 'persisted') + ' · ' + esc(t.serverMissionId) + '</div>'
      : '<div class="actions"><button class="btn secondary" data-act="save-cloud-mission" data-id="' + esc(t.id) + '">Save plan to cloud</button></div>';
    return '<div class="task"><div><div class="taskname">' + esc(t.title) + '</div><div class="mini">' + esc(t.department) + ' · ' + esc(t.priority) + ' priority</div><div class="mini">Local mission state: ' + esc(missionState) + '</div>' + cloudBadge + plan + '</div><div class="mobilehide"><strong>Lead Pet:</strong> ' + esc(t.owner) + '<div class="mini">' + esc(workers) + '</div></div><div><span class="pill ' + status + '">' + esc(t.status) + '</span></div><div class="mini mobilehide">' + esc(t.created) + '</div><div class="actions">' + (t.status !== 'Done' ? '<button class="btn secondary" data-act="advance" data-id="' + esc(t.id) + '">' + esc(actionLabel) + '</button>' : '<button class="btn secondary" data-act="remove" data-id="' + esc(t.id) + '">Archive</button>') + '</div></div>';
  }
  function workPage() {
    const activeCount = state.tasks.filter(function (t) { return t.status !== 'Done'; }).length;
    const doneCount = state.tasks.filter(function (t) { return t.status === 'Done'; }).length;
    const evidenceCount = state.tasks.filter(function (t) { return t.mission && t.mission.verification && t.mission.verification.passed === true; }).length;
    let out = '<div class="hero"><div><h2 class="h2">Work queue</h2><p class="muted">Create a Pet-led mission with specialist Bots, explicit approval, a review step and required evidence. This browser-only queue records workflow intent; it does not call an autonomous runtime or execute Bots yet.</p></div><button class="btn secondary" data-act="sample">Add example job</button></div>';
    out += cloudAuthCard();
    out += '<div class="statrow"><div class="stat"><div class="n">' + state.tasks.length + '</div><div class="l">All jobs tracked</div></div><div class="stat"><div class="n">' + activeCount + '</div><div class="l">Open jobs</div></div><div class="stat"><div class="n">' + doneCount + '</div><div class="l">Manually completed</div></div><div class="stat"><div class="n">' + evidenceCount + '</div><div class="l">Jobs with evidence recorded</div></div></div>';
    out += '<form id="new-task" class="form"><input class="field wide" name="title" required maxlength="180" placeholder="Outcome to deliver (e.g. Prepare 25 qualified target accounts)" aria-label="Outcome to deliver"><select class="field" name="department" aria-label="Department">' + DEPARTMENTS.map(function (d) { return '<option>' + esc(d.name) + '</option>'; }).join('') + '</select><select class="field" name="owner" aria-label="Lead Pet">' + PETS.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join('') + '</select><select class="field" name="execution" aria-label="Agent execution pattern"><option value="pet-bots">Pet + specialist Bots</option><option value="pet-only">Pet only</option></select><select class="field" name="priority" aria-label="Priority"><option>Normal</option><option>High</option><option>Critical</option></select><button class="btn" type="submit">Create job</button></form>';
    out += '<div class="row"><div class="sectionlabel">Latest jobs</div><span class="mini">' + state.tasks.length + ' tracked in this browser</span></div>';
    out += state.tasks.length ? state.tasks.slice().reverse().map(taskCard).join('') : '<div class="empty">No work tracked yet. Create one job above or start from a department playbook.</div>';
    if (cloudMissionsCache === null && !cloudMissionsLoading && !cloudMissionsFeedback) loadCloudMissions();
    out += '<div class="row" style="margin-top:26px"><div class="sectionlabel">Cloud missions</div><button class="btn secondary" data-act="refresh-cloud-missions"' + (cloudMissionsLoading ? ' disabled' : '') + '>Refresh</button></div>';
    out += '<p class="muted">Server-persisted missions are shared with the workspace. Approval puts work in the durable queue but never implies a Bot executed.</p>';
    if (cloudMissionsFeedback) out += '<div class="notice">' + esc(cloudMissionsFeedback) + ' <button class="btn secondary" data-act="refresh-cloud-missions">Retry status</button></div>';
    else if (cloudMissionsLoading) out += '<div class="empty">Loading authenticated cloud missions…</div>';
    if (Array.isArray(cloudMissionsCache) && cloudMissionsCache.length) out += cloudMissionsCache.map(cloudMissionCard).join('');
    else if (Array.isArray(cloudMissionsCache) && !cloudMissionsCache.length) out += '<div class="empty">No cloud missions yet. Use “Save plan to cloud” on a local task to persist its plan.</div>';
    return out;
  }
  function companyPage() {
    let out = '<div class="hero"><div><h2 class="h2">Company operating model</h2><p class="muted">One shared operating layer across departments. Start with work that is repeatable, already outsourced and easy to verify; expand into higher-judgement work after quality and controls are proven.</p></div></div><div class="notice">These are playbooks and task templates, not autonomous departments yet. Creating a task adds it to this browser’s Work queue. Production execution needs connected tools, a durable backend and approval policies.</div><div class="grid">';
    out += DEPARTMENTS.map(function (d) { return '<article class="card"><div class="eyebrow">' + esc(d.id) + '</div><h3>' + esc(d.name) + '</h3><p>' + esc(d.subtitle) + '</p><div class="actions"><button class="btn secondary" data-act="playbook" data-id="' + esc(d.id) + '">Start playbook</button></div></article>'; }).join('');
    return out + '</div><div class="sectionlabel">Workforce architecture</div><div class="grid"><article class="card"><div class="eyebrow">Persistent agent</div><h3>Pets own outcomes</h3><p>A Pet keeps its role, user-approved memory, skills, policy and scorecard across jobs. It is the accountable lead that plans, delegates and handles exceptions.</p></article><article class="card"><div class="eyebrow">Ephemeral specialist</div><h3>Bots execute bounded tasks</h3><p>A Pet can spawn Browser Researcher, Computer Operator, Analyst, CRM Operator, Writer, Coder or QA Verifier Bots. Each gets a narrow task contract, scoped tools, a budget and an output schema.</p></article><article class="card"><div class="eyebrow">Quality control</div><h3>Verifier checks the receipt</h3><p>A separate verification step checks evidence and acceptance criteria. More agents are used only when specialization or safe parallelism improves the expected outcome.</p></article></div><div class="sectionlabel">Expansion principle</div><div class="card"><h3>Outcome before headcount replacement</h3><p>Each workflow needs a named owner, source systems, acceptance criteria, exception handling, an approval threshold and a measurable result before it is allowed to run unattended.</p></div>';
  }
  function connectPage() {
    if (!connectorCache && !connectorLoading && !connectorFeedback) loadConnectors();
    const apiItems = connectorCache && Array.isArray(connectorCache.integrations) ? connectorCache.integrations : [];
    const stateLabel = function (status) {
      if (status === 'connected') return 'Connected';
      if (status === 'bridge_required') return 'Pairing only';
      if (status === 'not_configured') return 'Not configured';
      if (status === 'degraded') return 'Needs attention';
      if (status === 'error') return 'Error';
      return connectorLoading ? 'Checking…' : 'Not connected';
    };
    let out = '<div class="hero"><div><h2 class="h2">Connected systems</h2><p class="muted">Connector state is loaded from the server, not guessed from a button click. External sends remain approval-gated.</p></div></div>';
    out += cloudAuthCard();
    out += '<div class="notice">' + (connectorFeedback ? esc(connectorFeedback) : (connectorLoading ? 'Checking the authenticated connector API…' : 'Only integrations returned by the server are marked connected. A successful OAuth grant is not permission to send messages automatically.')) + (connectorFeedback ? ' <button class="btn secondary" data-act="refresh-connectors">Retry status</button>' : '') + '</div>';
    out += '<div class="grid">';
    out += INTEGRATIONS.map(function (i) {
      const found = apiItems.find(function (item) { return item.id === i.id; });
      const status = found ? found.state : (i.id === 'imessage-bridge' ? 'bridge_required' : 'not_connected');
      const connected = status === 'connected';
      const label = stateLabel(status);
      const action = connected ? 'disconnect-connector' : i.action;
      const button = connected ? 'Disconnect' : i.button;
      const disabled = connectorBusy || ((i.id !== 'github' && i.id !== 'gmail' && i.id !== 'microsoft' && i.id !== 'notion' && i.id !== 'linear' && i.id !== 'hubspot' && i.id !== 'salesforce') && !connectorCache && !connectorLoading && !!connectorFeedback);
      return '<article class="card"><div class="row"><span style="font-size:22px;color:#b8f1e0">' + i.icon + '</span><span class="pill">' + esc(label) + '</span></div><h3 style="margin-top:14px">' + esc(i.name) + '</h3><p>' + esc(i.detail) + '</p>' +
        (found && found.accountName ? '<p class="muted" style="font-size:12px">Workspace: ' + esc(found.accountName) + '</p>' : '') +
        '<div class="actions"><button class="btn secondary" data-act="' + esc(action) + '" data-id="' + esc(i.id) + '"' + (disabled ? ' disabled' : '') + '>' + esc(button) + '</button></div></article>';
    }).join('');
    out += '</div>';

    if (showTwilioForm) {
      out += '<div class="card" style="margin-top:16px"><h3>Configure SMS via Twilio</h3><p class="muted">Credentials are sent to Whilo over HTTPS, validated server-side and encrypted before persistence. This setup sends no SMS. Use a Messaging Service SID; outbound sends need separate consent and approval safeguards.</p>' +
        '<form id="connect-twilio-form"><div class="fieldgroup"><label class="label" for="whilo-twilio-account">Account SID</label><input class="field" id="whilo-twilio-account" name="accountSid" autocomplete="off" required placeholder="AC…"></div>' +
        '<div class="fieldgroup"><label class="label" for="whilo-twilio-key">API Key SID</label><input class="field" id="whilo-twilio-key" name="apiKeySid" autocomplete="off" required placeholder="SK…"></div>' +
        '<div class="fieldgroup"><label class="label" for="whilo-twilio-secret">API Key Secret</label><input class="field" id="whilo-twilio-secret" name="apiKeySecret" type="password" autocomplete="new-password" required></div>' +
        '<div class="fieldgroup"><label class="label" for="whilo-twilio-service">Messaging Service SID</label><input class="field" id="whilo-twilio-service" name="messagingServiceSid" autocomplete="off" required placeholder="MG…"></div>' +
        '<div class="actions"><button class="btn" type="submit"' + (connectorBusy ? ' disabled' : '') + '>Verify and encrypt credentials</button><button class="btn secondary" type="button" data-act="cancel-twilio">Cancel</button></div></form></div>';
    }

    if (bridgePairing) {
      const safeQr = typeof bridgePairing.qrDataUrl === 'string' && /^data:image\/png;base64,/.test(bridgePairing.qrDataUrl) ? bridgePairing.qrDataUrl : '';
      out += '<div class="card" style="margin-top:16px"><h3>Mac Bridge pairing</h3><p class="muted">' + esc(bridgePairing.message || bridgePairing.caveat || 'One-time pairing token. Expires after five minutes.') + '</p>' +
        (safeQr ? '<div style="display:flex;justify-content:center;padding:14px;background:#fff;border-radius:12px;margin:12px auto;max-width:360px"><img alt="One-time Whilo Mac Bridge pairing QR code" width="320" height="320" style="max-width:100%;height:auto" src="' + safeQr + '"></div>' : '') +
        '<p class="muted">Status: ' + esc(bridgePairing.status || 'preparing') + (bridgePairing.deviceName ? ' · ' + esc(bridgePairing.deviceName) : '') + '</p>' +
        '<p class="muted" style="font-size:12px">Pairing registers the device only. It does not yet give Whilo the ability to read or send iMessages. Never scan a QR from an untrusted screen.</p>' +
        '<div class="actions"><button class="btn secondary" data-act="close-pairing">Close pairing</button></div></div>';
    }
    return out;
  }
  function messageDate(value, compact) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    return compact && sameDay
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function messageTypeLabel(type) {
    return ({ direct: 'Direct message', group: 'Group', supergroup: 'Supergroup', channel: 'Channel' })[type] || 'Conversation';
  }

  function currentConversation() {
    const all = messagesScope === 'discover' ? messagesDiscover : messagesInbox;
    return all.find(function (conversation) { return conversation.id === messagesSelectedId; }) ||
      messagesInbox.find(function (conversation) { return conversation.id === messagesSelectedId; }) ||
      messagesDiscover.find(function (conversation) { return conversation.id === messagesSelectedId; }) || null;
  }

  function filteredMessageConversations() {
    const source = messagesScope === 'discover' ? messagesDiscover : messagesInbox;
    const term = messagesSearch.trim().toLowerCase();
    if (!term) return source;
    return source.filter(function (conversation) {
      const preview = conversation.last_message && conversation.last_message.content || '';
      return [conversation.title, conversation.description, preview, messageTypeLabel(conversation.conversation_type)]
        .some(function (value) { return String(value || '').toLowerCase().includes(term); });
    });
  }

  function messageConversationListHtml() {
    const list = filteredMessageConversations();
    if (messagesLoading && !list.length) return '<div class="message-empty">Loading your conversations…</div>';
    if (messagesScope === 'inbox' && !list.length) {
      return '<div class="message-empty"><div class="message-empty-mark">✉</div><strong>No conversations yet</strong><p>Start a direct chat, gather a group, create a large community or launch a channel for announcements.</p><button class="btn" data-act="new-message-conversation">Start a conversation</button></div>';
    }
    if (messagesScope === 'discover' && !list.length) {
      return '<div class="message-empty"><div class="message-empty-mark">◎</div><strong>No public channels yet</strong><p>Public Whilo channels in your workspace will appear here.</p></div>';
    }
    return list.map(function (conversation) {
      const title = conversation.title || 'Untitled conversation';
      const last = conversation.last_message;
      const preview = last
        ? (last.sender && last.sender.display_name ? last.sender.display_name + ': ' : '') + String(last.content || 'Attachment').replace(/\s+/g, ' ')
        : (conversation.description || messageTypeLabel(conversation.conversation_type));
      const initials = title.trim().split(/\s+/).slice(0,2).map(function (part) { return part.charAt(0); }).join('').toUpperCase() || 'W';
      const isSelected = conversation.id === messagesSelectedId;
      const isMember = messagesScope === 'inbox' || conversation.is_member === true || Boolean(conversation.my_membership);
      const trailing = messagesScope === 'discover'
        ? (isMember ? '<span class="message-pill">Joined</span>' : '<span class="message-join-label">Join →</span>')
        : '<span class="message-time">' + esc(messageDate(conversation.last_message_at || conversation.created_at, true)) + '</span>';
      return '<button type="button" class="message-conversation ' + (isSelected ? 'selected' : '') + '" data-act="' + (messagesScope === 'discover' && !isMember ? 'join-message-channel' : 'open-message-conversation') + '" data-id="' + esc(conversation.id) + '">' +
        '<span class="message-avatar ' + esc(conversation.conversation_type) + '">' + esc(initials) + '</span>' +
        '<span class="message-conversation-copy"><span class="message-conversation-title">' + esc(title) + '</span><span class="message-conversation-preview">' + esc(preview) + '</span><span class="message-conversation-type">' + esc(messageTypeLabel(conversation.conversation_type)) + (conversation.member_count != null ? ' · ' + esc(conversation.member_count) + ' members' : '') + '</span></span>' +
        '<span class="message-conversation-trailing">' + trailing + '</span></button>';
    }).join('');
  }

  async function loadMessageConversations(scope, quiet) {
    if (messagesLoading) return;
    const requestedScope = scope || messagesScope;
    if (!cloudAuthSession) {
      messagesFeedback = 'Sign in to Whilo cloud to load conversations shared with real people.';
      if (!quiet && active === 'messages') render();
      return;
    }
    messagesLoading = true;
    try {
      const data = await whiloApi('/api/messages/conversations?scope=' + encodeURIComponent(requestedScope), { method: 'GET' });
      const conversations = Array.isArray(data.conversations) ? data.conversations : [];
      if (requestedScope === 'discover') messagesDiscover = conversations;
      else messagesInbox = conversations;
      messagesFeedback = '';
      const all = requestedScope === 'discover' ? messagesDiscover : messagesInbox;
      if (!messagesSelectedId && all.length && requestedScope === messagesScope) messagesSelectedId = all[0].id;
      if (messagesSelectedId && !messagesInbox.some(function (x) { return x.id === messagesSelectedId; }) &&
          !messagesDiscover.some(function (x) { return x.id === messagesSelectedId; })) messagesSelectedId = '';
    } catch (error) {
      messagesFeedback = error && error.message ? error.message : 'Conversations could not be loaded.';
    } finally {
      messagesLoading = false;
      if (!quiet && active === 'messages') render();
    }
  }

  async function loadMessageTimeline(conversationId, threadRootId, quiet) {
    if (!conversationId || !cloudAuthSession || messagesTimelineLoading) return;
    messagesTimelineLoading = true;
    const activeElement = shadow.activeElement;
    const restoreComposerFocus = !!activeElement && activeElement.id === 'message-compose-input';
    const selectionStart = restoreComposerFocus ? activeElement.selectionStart : null;
    const selectionEnd = restoreComposerFocus ? activeElement.selectionEnd : null;
    try {
      const params = new URLSearchParams({ conversationId: conversationId, limit: '60' });
      if (threadRootId) params.set('threadRootId', threadRootId);
      const data = await whiloApi('/api/messages?' + params.toString(), { method: 'GET' });
      messagesRows = Array.isArray(data.messages) ? data.messages : [];
      messagesFeedback = '';
      const latest = messagesRows.length ? messagesRows[messagesRows.length - 1] : null;
      if (latest && latest.id) {
        whiloApi('/api/messages', {
          method: 'POST',
          body: JSON.stringify({ action: 'mark_read', conversationId: conversationId, lastReadMessageId: latest.id })
        }).catch(function () {});
      }
    } catch (error) {
      messagesFeedback = error && error.message ? error.message : 'Messages could not be loaded.';
    } finally {
      messagesTimelineLoading = false;
      if (!quiet && active === 'messages') {
        render();
        if (restoreComposerFocus) {
          const input = shadow.querySelector('#message-compose-input');
          if (input) {
            input.focus();
            try { input.setSelectionRange(selectionStart, selectionEnd); } catch (_) {}
          }
        }
      } else if (quiet && active === 'messages') {
        const timeline = shadow.querySelector('#message-timeline');
        if (timeline) timeline.innerHTML = messageTimelineHtml();
      }
    }
  }

  function messageTimelineHtml() {
    const conversation = currentConversation();
    if (!conversation) {
      return '<div class="message-empty"><div class="message-empty-mark">◉</div><strong>Your human network starts here</strong><p>Create a chat, invite coworkers into a workspace, or discover a public channel. Pets and Bots can participate later with their own explicit identities.</p></div>';
    }
    if (messagesScope === 'discover' && !conversation.is_member) {
      return '<div class="message-empty"><div class="message-empty-mark">#</div><strong>' + esc(conversation.title || 'Public channel') + '</strong><p>' + esc(conversation.description || 'Public channel in this Whilo workspace.') + '</p><p>' + esc(conversation.member_count || 0) + ' members</p><button class="btn" data-act="join-message-channel" data-id="' + esc(conversation.id) + '">Join channel</button></div>';
    }
    if (messagesFeedback && !messagesRows.length) {
      return '<div class="message-empty"><div class="message-empty-mark">↻</div><strong>Could not load this conversation</strong><p>' + esc(messagesFeedback) + '</p><button class="btn secondary" data-act="refresh-message-timeline">Retry</button></div>';
    }
    if (!messagesRows.length) {
      return '<div class="message-empty"><div class="message-empty-mark">✳</div><strong>This is the beginning</strong><p>Write the first message. A conversation belongs to real workspace members, with clear membership and moderation controls.</p></div>';
    }

    const myId = cloudAuthSession && cloudAuthSession.id;
    return messagesRows.map(function (message) {
      const mine = message.sender_user_id === myId;
      const senderName = message.sender && message.sender.display_name
        ? message.sender.display_name
        : (mine ? 'You' : 'Whilo member');
      const initials = senderName.split(/\s+/).slice(0,2).map(function (part) { return part.charAt(0); }).join('').toUpperCase() || '?';
      const reactions = Array.isArray(message.reactions) ? message.reactions : [];
      const grouped = {};
      reactions.forEach(function (reaction) {
        if (!grouped[reaction.emoji]) grouped[reaction.emoji] = { count: 0, mine: false };
        grouped[reaction.emoji].count += 1;
        if (reaction.user_id === myId) grouped[reaction.emoji].mine = true;
      });
      const reactionHtml = Object.keys(grouped).map(function (emoji) {
        return '<button type="button" class="message-reaction ' + (grouped[emoji].mine ? 'mine' : '') + '" data-act="message-react" data-id="' + esc(message.id) + '" data-emoji="' + esc(emoji) + '">' + esc(emoji) + ' ' + grouped[emoji].count + '</button>';
      }).join('');
      const reply = message.reply_to_message_id ? '<div class="message-reply-indicator">↪ Reply</div>' : '';
      const edited = message.edited_at ? ' · edited' : '';
      const thread = Number(message.thread_reply_count || 0) > 0
        ? '<button class="message-action" data-act="open-message-thread" data-id="' + esc(message.id) + '">↳ ' + esc(message.thread_reply_count) + ' replies</button>'
        : '<button class="message-action" data-act="open-message-thread" data-id="' + esc(message.id) + '">↳ Thread</button>';
      const ownerActions = mine
        ? '<button class="message-action" data-act="edit-message" data-id="' + esc(message.id) + '">Edit</button><button class="message-action" data-act="delete-message" data-id="' + esc(message.id) + '">Delete</button>'
        : '';
      return '<div class="message-line ' + (mine ? 'mine' : '') + '" data-message-id="' + esc(message.id) + '">' +
        (mine ? '' : '<span class="message-avatar tiny">' + esc(initials) + '</span>') +
        '<div class="message-bubble"><div class="message-sender">' + esc(senderName) + '</div>' +
        reply + '<div class="message-content">' + esc(message.content || 'Message deleted') + '</div>' +
        '<div class="message-meta">' + esc(messageDate(message.created_at, true)) + esc(edited) + '</div>' +
        '<div class="message-actions"><button class="message-action" data-act="message-reply" data-id="' + esc(message.id) + '">Reply</button>' + thread + ownerActions + '</div>' +
        (reactionHtml ? '<div class="message-reactions">' + reactionHtml + '</div>' : '') +
        '<div class="message-quick-reactions">' + ['👍','❤️','😂','🔥'].map(function (emoji) { return '<button type="button" aria-label="React ' + esc(emoji) + '" data-act="message-react" data-id="' + esc(message.id) + '" data-emoji="' + esc(emoji) + '">' + esc(emoji) + '</button>'; }).join('') + '</div>' +
        '</div></div>';
    }).join('');
  }

  function messageCreateFormHtml() {
    if (!messagesCreateOpen) return '';
    return '<section class="message-create-panel"><div class="row"><div><div class="sectionlabel">New conversation</div><h3>Create a space for real people</h3></div><button class="btn secondary" type="button" data-act="close-message-create">Close</button></div>' +
      '<form id="message-create-conversation" class="message-create-form">' +
      '<div class="fieldgroup"><label class="label" for="message-type">Conversation type</label><select id="message-type" class="field" name="type"><option value="direct">Direct message</option><option value="group">Group</option><option value="supergroup">Supergroup · large community</option><option value="channel">Channel · broadcasts</option></select></div>' +
      '<div class="fieldgroup"><label class="label" for="message-title">Name (not needed for a direct message)</label><input id="message-title" class="field" name="title" maxlength="100" placeholder="e.g. Product launch team"></div>' +
      '<div class="fieldgroup"><label class="label" for="message-description">Description</label><input id="message-description" class="field" name="description" maxlength="1600" placeholder="Purpose, norms and what belongs here"></div>' +
      '<div class="fieldgroup"><label class="label" for="message-participants">Whilo usernames</label><input id="message-participants" class="field" name="participants" maxlength="800" placeholder="@alex, @maria" autocomplete="off"><div class="mini">Use usernames of existing members of your Whilo workspace. Direct messages require exactly one other person.</div></div>' +
      '<label class="message-checkbox"><input type="checkbox" name="isPublic" value="true"> Public channel · members of this workspace can discover and join</label>' +
      '<div class="actions"><button type="submit" class="btn"' + (messagesBusy ? ' disabled' : '') + '>Create conversation</button></div></form>' +
      '<form id="message-people-search-form" class="message-people-search"><label class="label" for="message-people-query">Find workspace people</label><div class="row"><input id="message-people-query" class="field" name="q" maxlength="50" placeholder="Search display name or username" value="' + esc(messagesPeopleQuery) + '"><button class="btn secondary" type="submit">Search</button></div>' +
      (messagesPeopleLoading ? '<div class="mini">Searching…</div>' : messagesPeople.length ? '<div class="message-people-results">' + messagesPeople.map(function (person) {
        const initials = String(person.display_name || person.username).split(/\s+/).slice(0,2).map(function (part) { return part.charAt(0); }).join('').toUpperCase();
        return '<button class="message-person-result" type="button" data-act="use-message-person" data-id="' + esc(person.username) + '"><span class="message-avatar tiny">' + esc(initials) + '</span><span><strong>' + esc(person.display_name) + '</strong><span class="mini">@' + esc(person.username) + '</span></span><span class="message-join-label">Add ↗</span></button>';
      }).join('') + '</div>' : '') +
      '</form></section>';
  }

  function messagesPage() {
    if (!cloudAuthChecked && !cloudAuthLoading) loadCloudAuth();
    if (!cloudAuthSession) {
      return '<div class="hero"><div><div class="eyebrow">WHILO / PEOPLE</div><h2 class="h2">Messages</h2><p class="muted">A real-human communication layer: private chats, groups, supergroups and broadcast channels, built for humans working alongside AI.</p></div></div>' +
        cloudAuthCard() +
        '<div class="message-intro-grid"><article class="card"><div class="message-feature-icon">↔</div><h3>Direct messages</h3><p>Private one-to-one conversations with human workspace members.</p></article><article class="card"><div class="message-feature-icon">◎</div><h3>Groups & supergroups</h3><p>Teams, communities, pinned knowledge, replies and moderation.</p></article><article class="card"><div class="message-feature-icon">▤</div><h3>Channels</h3><p>One-to-many announcements, with publishing rights separated from subscribers.</p></article></div>';
    }
    if (!messagesInbox.length && !messagesLoading && !messagesFeedback) loadMessageConversations('inbox', false);
    const conversation = currentConversation();
    const isInDiscover = messagesScope === 'discover';
    const title = conversation ? (conversation.title || 'Direct message') : 'Choose a conversation';
    const subtitle = conversation
      ? messageTypeLabel(conversation.conversation_type) + (conversation.member_count != null ? ' · ' + conversation.member_count + ' members' : '') + ' · refreshes while open'
      : 'Human conversations and communities';
    const isNotMember = isInDiscover && conversation && conversation.is_member !== true;
    const myRole = conversation && conversation.my_membership ? conversation.my_membership.member_role : '';
    const cannotPublish = conversation && conversation.conversation_type === 'channel' && myRole && !['owner','admin','moderator'].includes(myRole);
    let out = '<div class="hero messages-hero"><div><div class="eyebrow">WHILO / PEOPLE</div><h2 class="h2">Messages</h2><p class="muted">Real people first. DMs, groups, supergroups and channels share one communication layer; Pets and Bots can participate later with distinct identities and permissions.</p></div><div class="actions"><button class="btn" data-act="new-message-conversation">＋ New</button><button class="btn secondary" data-act="refresh-message-conversations">↻ Refresh</button></div></div>';
    out += cloudAuthCard();
    if (messagesFeedback) out += '<div class="notice">' + esc(messagesFeedback) + '</div>';
    out += messageCreateFormHtml();
    out += '<div class="messages-shell" data-selected="' + (conversation ? 'true' : 'false') + '"><aside class="messages-sidebar">' +
      '<div class="messages-sidebar-head"><div class="row"><strong>' + (isInDiscover ? 'Discover' : 'Inbox') + '</strong><span class="mini">' + (isInDiscover ? messagesDiscover.length + ' channels' : messagesInbox.length + ' chats') + '</span></div>' +
      '<div class="messages-scope"><button class="' + (!isInDiscover ? 'active' : '') + '" data-act="message-scope" data-id="inbox">Inbox</button><button class="' + (isInDiscover ? 'active' : '') + '" data-act="message-scope" data-id="discover">Discover</button></div>' +
      '<input class="field" id="message-conversation-search" data-role="message-search" placeholder="Search chats and channels" value="' + esc(messagesSearch) + '" autocomplete="off"></div>' +
      '<div id="message-conversation-list" class="message-conversation-list">' + messageConversationListHtml() + '</div></aside>' +
      '<section class="messages-chat"><header class="messages-chat-head"><div class="row"><div class="row"><span class="message-avatar">' + esc(conversation ? (title.trim().split(/\s+/).slice(0,2).map(function (part) { return part.charAt(0); }).join('').toUpperCase() || 'W') : 'W') + '</span><div><strong>' + esc(title) + '</strong><div class="mini">' + esc(subtitle) + '</div></div></div>' +
      '<div class="actions"><button class="btn secondary" data-act="refresh-message-timeline"' + (!conversation || messagesBusy || isNotMember ? ' disabled' : '') + '>Refresh</button>' +
      (messagesThreadRootId ? '<button class="btn secondary" data-act="close-message-thread">Close thread</button>' : '') + '</div></div></header>' +
      (messagesThreadRootId ? '<div class="message-thread-banner">↳ Thread view · replies stay attached to the original message</div>' : '') +
      '<div class="messages-scroll" id="message-timeline">' + (isNotMember ? messageTimelineHtml() : messageTimelineHtml()) + '</div>' +
      ((isNotMember || cannotPublish) ? (cannotPublish ? '<div class="message-compose-wrap"><div class="notice">You are subscribed to this channel. Only owners and moderators can publish; replies and reactions remain available.</div></div>' : '') : '<div class="message-compose-wrap">' +
        (messagesReplyToId ? '<div class="message-reply-bar"><span>Replying to a message</span><button data-act="clear-message-reply" type="button">×</button></div>' : '') +
        '<form id="message-compose" class="message-compose"><textarea id="message-compose-input" name="content" maxlength="12000" rows="1" required placeholder="' + (conversation && conversation.conversation_type === 'channel' ? 'Write a channel announcement…' : 'Message people… (Enter to send, Shift+Enter for newline)') + '">' + esc(messageComposerDraft) + '</textarea><button type="submit" class="btn" ' + (!conversation || messagesBusy ? 'disabled' : '') + '>Send ↗</button></form><div class="message-compose-foot"><span>Human messages · moderation and channel permissions apply</span><span>' + messageComposerDraft.length + '/12000</span></div></div>') +
      '</section></div>' +
      '<div class="message-security-note"><span>●</span> Messages are workspace-scoped. Real-time delivery, media uploads and invitations activate after the backend is configured; do not use this preview for confidential content yet.</div>';
    return out;
  }

  async function searchMessagePeople(query) {
    if (!cloudAuthSession) return;
    messagesPeopleQuery = String(query || '').trim().slice(0,50);
    messagesPeopleLoading = true;
    render();
    try {
      const params = new URLSearchParams();
      if (messagesPeopleQuery) params.set('q', messagesPeopleQuery);
      const data = await whiloApi('/api/messages/people?' + params.toString(), { method: 'GET' });
      messagesPeople = Array.isArray(data.people) ? data.people : [];
      messagesFeedback = '';
    } catch (error) {
      messagesFeedback = error && error.message ? error.message : 'Workspace people could not be searched.';
    } finally {
      messagesPeopleLoading = false;
      if (active === 'messages') render();
    }
  }

  async function startMessageConversation(id) {
    messagesSelectedId = id;
    messagesScope = messagesInbox.some(function (row) { return row.id === id; }) ? 'inbox' : messagesScope;
    messagesThreadRootId = '';
    messagesReplyToId = '';
    messageComposerDraft = '';
    messagesRows = [];
    if (messagePollTimer) { window.clearInterval(messagePollTimer); messagePollTimer = null; }
    await loadMessageTimeline(id, '', false);
    if (messagePollTimer) window.clearInterval(messagePollTimer);
    messagePollTimer = window.setInterval(function () {
      if (active === 'messages' && veil.classList.contains('open') && messagesSelectedId && !messagesThreadRootId) {
        loadMessageTimeline(messagesSelectedId, '', true);
        loadMessageConversations('inbox', true);
      }
    }, 10000);
  }

  async function sendHumanMessage(form) {
    const conversation = currentConversation();
    if (!conversation) throw new Error('Choose a conversation first.');
    const content = String(form.elements.content.value || '').trim();
    if (!content) return;
    const payload = {
      conversationId: conversation.id,
      content,
      threadRootId: messagesThreadRootId || null,
      replyToMessageId: messagesReplyToId || (messagesThreadRootId || null)
    };
    messagesBusy = true;
    messagesFeedback = '';
    const draft = messageComposerDraft;
    messageComposerDraft = '';
    render();
    try {
      await whiloApi('/api/messages', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'msg-' + (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)) },
        body: JSON.stringify(payload)
      });
      messagesReplyToId = '';
      await loadMessageTimeline(conversation.id, messagesThreadRootId, true);
      await loadMessageConversations('inbox', true);
    } catch (error) {
      messageComposerDraft = draft;
      messagesFeedback = error && error.message ? error.message : 'Message could not be sent.';
    } finally {
      messagesBusy = false;
      if (active === 'messages') render();
      const input = shadow.querySelector('#message-compose-input');
      if (input) input.focus();
    }
  }

  function resultsPage() {
    const done = state.tasks.filter(function (t) { return t.status === 'Done'; }).length;
    const evidenceCount = state.tasks.filter(function (t) { return t.mission && t.mission.verification && t.mission.verification.passed === true; }).length;
    const hours = evidenceCount * state.hoursPerTask;
    const value = hours * state.hourlyCost;
    return '<div class="hero"><div><h2 class="h2">Outcomes & ROI</h2><p class="muted">Only tasks with evidence notes contribute to this estimate. The notes are manually supplied by the user, not independently verified by an autonomous agent or linked to a source system.</p></div></div><div class="statrow"><div class="stat"><div class="n">' + evidenceCount + '</div><div class="l">Jobs with evidence recorded</div></div><div class="stat"><div class="n">' + hours.toFixed(1) + 'h</div><div class="l">Estimated hours recovered</div></div><div class="stat"><div class="n">' + money(value) + '</div><div class="l">Estimated labor value</div></div><div class="stat"><div class="n">' + (state.tasks.length ? Math.round(done / state.tasks.length * 100) : 0) + '%</div><div class="l">Manual completion rate</div></div></div><div class="twocol"><div class="card"><h3>Calculation assumptions</h3><p>Adjust these assumptions to fit the workflow. Record actual cycle time and cost before using the numbers in customer reporting.</p><form id="assumptions"><div class="fieldgroup"><label class="label" for="hours">Hours saved per completed job</label><input id="hours" class="field" type="number" name="hours" min="0" max="1000" step=".25" value="' + state.hoursPerTask + '"></div><div class="fieldgroup"><label class="label" for="cost">Labor cost per hour (USD)</label><input id="cost" class="field" type="number" name="cost" min="0" max="100000" step="1" value="' + state.hourlyCost + '"></div><button class="btn" type="submit">Update estimate</button></form></div><div class="card"><h3>What to instrument next</h3><p>Connect verified source events for jobs accepted, jobs completed, human corrections, exceptions, time-to-resolution, cost per result and attributable pipeline. Do not report ROI until the measurement source and baseline are defined.</p><div class="sectionlabel">Minimum proof</div><p>Baseline → tracked run → human QA → accepted outcome → verified cost → customer renewal.</p></div></div>';
  }
  function render() {
    shadow.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === active); });
    if (active === 'work') view.innerHTML = workPage();
    if (active === 'company') view.innerHTML = companyPage();
    if (active === 'connect') view.innerHTML = connectPage();
    if (active === 'results') view.innerHTML = resultsPage();
    if (active === 'messages') view.innerHTML = messagesPage();
  }
  function openPanel(tab) {
    active = tab || 'work';
    veil.classList.add('open');
    render();
    document.body.style.overflow = 'hidden';
  }
  function closePanel() {
    veil.classList.remove('open'); document.body.style.overflow = '';
    if (messagePollTimer) { window.clearInterval(messagePollTimer); messagePollTimer = null; }
  }
  function newMissionForTask(task) {
    const core = window.WhiloAgentCore;
    if (!core) return null;
    const roles = task.execution === 'pet-only' ? [] : (Array.isArray(task.bots) ? task.bots : plannedBots(task.department));
    const botSteps = roles.map(function (role, index) {
      const id = 'bot-' + (index + 1);
      const dependencies = role === 'QA Verifier' ? roles.filter(function (r) { return r !== 'QA Verifier'; }).map(function (_, i) { return 'bot-' + (i + 1); }) : [];
      return { id: id, role: role, title: role + ': ' + task.title, dependsOn: dependencies, toolScopes: ['read', 'draft'], outputContract: ['Structured result', 'Evidence note'] };
    });
    let mission = core.createMission({
      id: 'mission-' + task.id,
      goal: task.title,
      department: task.department,
      ownerPet: task.owner,
      risk: task.priority === 'Critical' ? 'high' : (task.priority === 'High' ? 'medium' : 'low'),
      executionMode: task.execution === 'pet-only' ? 'pet_only' : 'pet_with_bots',
      approvalRequired: true,
      acceptanceCriteria: ['Requested outcome is documented', 'Evidence for the result is recorded', 'Exceptions and limitations are disclosed'],
      steps: botSteps
    });
    mission = core.transitionMission(mission, 'planned', 'pet', 'Pet prepared a bounded mission plan.');
    mission = core.transitionMission(mission, 'awaiting_approval', 'governor', 'Waiting for user approval before execution.');
    return mission;
  }
  function addTask(title, department, owner, priority, execution) {
    const dept = department || 'Operations';
    const model = execution || 'pet-bots';
    const task = { id: String(Date.now()) + Math.random().toString(36).slice(2,7), title: title, department: dept, owner: owner || 'Whilo', priority: priority || 'Normal', execution: model, bots: model === 'pet-only' ? [] : plannedBots(dept), status: 'Queued', created: new Date().toLocaleDateString(), mission: null };
    task.mission = newMissionForTask(task);
    state.tasks.push(task);
    save();
  }
  function ensureMission(task) {
    const core = window.WhiloAgentCore;
    if (!task.mission) {
      task.mission = newMissionForTask(task);
      if (!task.mission || !core) return task.mission;
      // Migrate older browser-local tasks into the new lifecycle without claiming a worker ran.
      if (task.status === 'In progress' || task.status === 'Review required') {
        task.mission = core.approveMission(task.mission, { approved: true, approver: 'user', reason: 'Legacy local task migrated for tracking only.' });
        task.mission = core.transitionMission(task.mission, 'running', 'migration', 'Legacy local task is marked in progress; no agent was invoked.');
        if (task.status === 'Review required') {
          task.mission = core.transitionMission(task.mission, 'verifying', 'migration', 'Restored local review state.');
          task.mission = core.transitionMission(task.mission, 'awaiting_review', 'governor', 'Awaiting manual evidence.');
        }
      }
    }
    return task.mission;
  }
  function advanceTask(task) {
    const core = window.WhiloAgentCore;
    if (!task || !core) return;
    let mission = ensureMission(task);
    if (!mission) return;
    if (task.status === 'Queued') {
      if (mission.state === 'planned') mission = core.transitionMission(mission, 'awaiting_approval', 'governor', 'Waiting for human approval.');
      mission = core.approveMission(mission, { approved: true, approver: 'user', reason: 'User approved local tracking only; no worker was invoked.' });
      mission = core.transitionMission(mission, 'running', 'ui', 'Local tracking started; no autonomous runtime was called.');
      task.status = 'In progress';
    } else if (task.status === 'In progress') {
      mission = core.transitionMission(mission, 'verifying', 'user', 'User requested a manual evidence review.');
      mission = core.transitionMission(mission, 'awaiting_review', 'governor', 'Awaiting acceptance evidence.');
      task.status = 'Review required';
    } else if (task.status === 'Review required') {
      const checks = [];
      for (const criterion of mission.acceptanceCriteria) {
        const evidence = window.prompt('Add evidence for this acceptance criterion:\n\n' + criterion + '\n\nEnter a file name, source URL, result summary or other review note. Leave blank to keep the mission in review.');
        if (!evidence || !evidence.trim()) return;
        checks.push({ name: criterion, passed: true, evidence: evidence.trim() });
      }
      const verification = core.verifyOutcome({ acceptanceCriteria: mission.acceptanceCriteria, checks: checks });
      if (!verification.passed) return;
      mission = Object.assign({}, mission, { verification: verification, evidence: checks.map(function (x) { return x.evidence; }) });
      mission = core.transitionMission(mission, 'delivered', 'user', 'User attested that the local acceptance criteria and evidence notes are complete.');
      task.status = 'Done';
    }
    task.mission = mission;
    save();
  }
  shadow.addEventListener('click', function (event) {
    const tab = event.target.closest('[data-tab]');
    if (tab) { active = tab.getAttribute('data-tab'); render(); return; }
    const action = event.target.closest('[data-act]');
    if (!action) return;
    const act = action.getAttribute('data-act'), id = action.getAttribute('data-id');
    if (act === 'close') { closePanel(); return; }
    if (act === 'new-message-conversation') { messagesCreateOpen = !messagesCreateOpen; render(); return; }
    if (act === 'close-message-create') { messagesCreateOpen = false; render(); return; }
    if (act === 'message-scope') {
      messagesScope = id === 'discover' ? 'discover' : 'inbox';
      messagesSearch = ''; messagesFeedback = ''; messagesSelectedId = ''; messagesRows = [];
      loadMessageConversations(messagesScope, true).then(function () { if (active === 'messages') render(); });
      if (messagesScope === 'inbox') loadMessageConversations('inbox', true);
      render(); return;
    }
    if (act === 'refresh-message-conversations') {
      messagesFeedback = ''; loadMessageConversations(messagesScope, false); return;
    }
    if (act === 'open-message-conversation') {
      startMessageConversation(id).catch(function (error) { messagesFeedback = error.message || 'Conversation could not be opened.'; render(); }); return;
    }
    if (act === 'join-message-channel') {
      messagesBusy = true; messagesFeedback = 'Joining channel…'; render();
      whiloApi('/api/messages/conversations', { method: 'POST', body: JSON.stringify({ action: 'join', conversationId: id }) })
        .then(function () { messagesScope = 'inbox'; messagesFeedback = 'Joined the channel.'; return loadMessageConversations('inbox', true); })
        .then(function () { return startMessageConversation(id); })
        .catch(function (error) { messagesFeedback = error && error.message ? error.message : 'Could not join this channel.'; })
        .finally(function () { messagesBusy = false; if (active === 'messages') render(); });
      return;
    }
    if (act === 'refresh-message-timeline') {
      const convo = currentConversation(); if (convo) loadMessageTimeline(convo.id, messagesThreadRootId, false); return;
    }
    if (act === 'message-reply') {
      messagesReplyToId = id; render();
      const compose = shadow.querySelector('#message-compose-input'); if (compose) compose.focus(); return;
    }
    if (act === 'clear-message-reply') { messagesReplyToId = ''; render(); const compose = shadow.querySelector('#message-compose-input'); if (compose) compose.focus(); return; }
    if (act === 'open-message-thread') {
      messagesThreadRootId = id; messagesRows = [];
      loadMessageTimeline(messagesSelectedId, id, false); return;
    }
    if (act === 'close-message-thread') {
      messagesThreadRootId = ''; loadMessageTimeline(messagesSelectedId, '', false); return;
    }
    if (act === 'message-react') {
      const convo = currentConversation(); const emoji = action.getAttribute('data-emoji');
      if (!convo || !emoji) return;
      whiloApi('/api/messages/reactions', { method: 'POST', body: JSON.stringify({ conversationId: convo.id, messageId: id, emoji: emoji }) })
        .then(function () { return loadMessageTimeline(convo.id, messagesThreadRootId, false); })
        .catch(function (error) { messagesFeedback = error && error.message ? error.message : 'Reaction could not be saved.'; render(); });
      return;
    }
    if (act === 'edit-message') {
      const convo = currentConversation(); const target = messagesRows.find(function (row) { return row.id === id; });
      if (!convo || !target) return;
      const edited = window.prompt('Edit message', target.content || '');
      if (edited == null || !edited.trim() || edited.trim() === target.content) return;
      whiloApi('/api/messages', { method: 'POST', body: JSON.stringify({ action: 'edit', conversationId: convo.id, messageId: id, content: edited.trim() }) })
        .then(function () { return loadMessageTimeline(convo.id, messagesThreadRootId, false); })
        .catch(function (error) { messagesFeedback = error && error.message ? error.message : 'Message could not be edited.'; render(); });
      return;
    }
    if (act === 'delete-message') {
      const convo = currentConversation();
      if (!convo || !window.confirm('Delete this message? This removes its content from the conversation timeline.')) return;
      whiloApi('/api/messages', { method: 'POST', body: JSON.stringify({ action: 'delete', conversationId: convo.id, messageId: id }) })
        .then(function () { return loadMessageTimeline(convo.id, messagesThreadRootId, false); })
        .catch(function (error) { messagesFeedback = error && error.message ? error.message : 'Message could not be deleted.'; render(); });
      return;
    }
    if (act === 'use-message-person') {
      const field = shadow.querySelector('#message-participants');
      if (field) {
        const existing = field.value.split(',').map(function (value) { return value.trim(); }).filter(Boolean);
        if (!existing.some(function (value) { return value.replace(/^@/,'').toLowerCase() === id.toLowerCase(); })) existing.push('@' + id);
        field.value = existing.join(', ');
        const type = shadow.querySelector('#message-type');
        if (type && type.value === 'direct' && existing.length > 1) type.value = 'group';
        field.focus();
      }
      return;
    }
    if (act === 'sample') { addTask('Map one repeatable outsourced workflow and define its acceptance criteria', 'Operations', 'Whilo', 'High'); render(); return; }
    if (act === 'advance') {
      const task = state.tasks.find(function (t) { return t.id === id; });
      try { advanceTask(task); } catch (error) { window.alert(error && error.message ? error.message : 'The mission state could not be advanced.'); }
      render(); return;
    }
    if (act === 'save-cloud-mission') {
      cloudMissionBusy = true; cloudMissionsFeedback = 'Validating the plan and persisting it to the workspace…'; render();
      persistLocalTask(id).catch(function (error) {
        cloudMissionsFeedback = error && error.message ? error.message : 'The cloud mission could not be saved.';
      }).finally(function () { cloudMissionBusy = false; if (active === 'work') render(); });
      return;
    }
    if (act === 'refresh-cloud-missions') {
      cloudMissionsCache = null; cloudMissionsFeedback = ''; loadCloudMissions(); render(); return;
    }
    if (act === 'approve-cloud-mission' || act === 'reject-cloud-mission') {
      cloudMissionBusy = true; cloudMissionsFeedback = act === 'approve-cloud-mission' ? 'Recording the explicit approval…' : 'Recording the rejection…'; render();
      decideCloudMission(id, act === 'approve-cloud-mission' ? 'approved' : 'rejected')
        .catch(function (error) { cloudMissionsFeedback = error && error.message ? error.message : 'The mission decision could not be recorded.'; })
        .finally(function () { cloudMissionBusy = false; if (active === 'work') render(); });
      return;
    }
    if (act === 'remove') { state.tasks = state.tasks.filter(function (t) { return t.id !== id; }); save(); render(); return; }
    if (act === 'playbook') {
      const dept = DEPARTMENTS.find(function (d) { return d.id === id; });
      if (dept) addTask(dept.template, dept.name, 'Whilo', 'High');
      active = 'work'; render(); return;
    }
    if (act === 'cloud-signout') {
      cloudAuthBusy = true; cloudAuthFeedback = 'Signing out…'; render();
      window.WhiloCloudAuth.signOut()
        .catch(function () { /* Local session is cleared even if remote logout is unavailable. */ })
        .finally(function () {
          cloudAuthSession = null; cloudAuthConfigured = true; cloudAuthChecked = true; cloudAuthBusy = false;
          cloudAuthFeedback = 'Signed out of this browser.';
          connectorCache = null; connectorFeedback = ''; cloudMissionsCache = null; cloudMissionsFeedback = '';
          render();
        });
      return;
    }
    if (act === 'connect-setup') { addTask('Plan and verify integration setup: ' + id, 'IT & systems', 'Whilo', 'High'); active = 'work'; render(); return; }
    if (act === 'refresh-connectors') { connectorFeedback = ''; connectorCache = null; loadConnectors(); render(); return; }
    if (act === 'connect-slack') {
      connectorBusy = true; connectorFeedback = 'Preparing a short-lived Slack authorization request…'; render();
      whiloApi('/api/connectors/slack/start', { method: 'POST', body: JSON.stringify({}) })
        .then(function (data) { if (data && data.authorizeUrl && /^https:\/\/slack\.com\//.test(data.authorizeUrl)) window.location.assign(data.authorizeUrl); else throw new Error('The Slack authorization URL was not valid.'); })
        .catch(function (error) { connectorFeedback = error && error.message ? error.message : 'Slack connection could not start.'; connectorBusy = false; render(); });
      return;
    }
    if (act === 'connect-twilio') { showTwilioForm = true; render(); return; }
    if (act === 'cancel-twilio') { showTwilioForm = false; render(); return; }
    if (act === 'disconnect-connector') {
      connectorBusy = true; connectorFeedback = 'Revoking and removing the encrypted connection…'; render();
      whiloApi('/api/connectors', { method: 'POST', body: JSON.stringify({ action: 'disconnect', provider: id }) })
        .then(function (data) { connectorFeedback = data.detail || 'Connection removed.'; connectorCache = null; showTwilioForm = false; return loadConnectors(); })
        .catch(function (error) { connectorFeedback = error && error.message ? error.message : 'Disconnect failed.'; })
        .finally(function () { connectorBusy = false; render(); });
      return;
    }
    if (act === 'pair-imessage') {
      if (bridgePollTimer) { window.clearInterval(bridgePollTimer); bridgePollTimer = null; }
      bridgePairing = { status: 'creating', message: 'Creating a five-minute pairing QR…' }; connectorFeedback = ''; render();
      whiloApi('/api/bridges/pair/start', { method: 'POST', body: JSON.stringify({}) })
        .then(function (data) {
          bridgePairing = { id: data.pairingSessionId, qrDataUrl: data.qrDataUrl, deepLink: data.deepLink, expiresAt: data.expiresAt, status: 'pending', caveat: data.caveat };
          render();
          bridgePollTimer = window.setInterval(async function () {
            try {
              const status = await whiloApi('/api/bridges/pair/status?id=' + encodeURIComponent(bridgePairing.id), { method: 'GET' });
              bridgePairing.status = status.status; bridgePairing.deviceName = status.deviceName || '';
              if (status.status === 'paired' || status.status === 'expired' || status.status === 'revoked') {
                window.clearInterval(bridgePollTimer); bridgePollTimer = null;
                bridgePairing.message = status.status === 'paired'
                  ? 'Device identity paired. The native bridge and iMessage transport still require implementation.'
                  : 'This pairing request expired or was revoked. Start a new one to try again.';
              }
              render();
            } catch (error) {
              window.clearInterval(bridgePollTimer); bridgePollTimer = null;
              bridgePairing.message = error && error.message ? error.message : 'Pairing status could not be checked.';
              render();
            }
          }, 3000);
        })
        .catch(function (error) { bridgePairing = null; connectorFeedback = error && error.message ? error.message : 'QR pairing could not start.'; render(); });
      return;
    }
    if (act === 'close-pairing') { if (bridgePollTimer) window.clearInterval(bridgePollTimer); bridgePollTimer = null; bridgePairing = null; render(); return; }
  });
  shadow.addEventListener('submit', function (event) {
    event.preventDefault();
    const form = event.target;
    if (form.id === 'message-create-conversation') {
      const fd = new FormData(form);
      const type = String(fd.get('type') || 'direct');
      const handles = String(fd.get('participants') || '').split(',').map(function (value) { return value.trim(); }).filter(Boolean);
      const payload = {
        type: type,
        title: String(fd.get('title') || '').trim(),
        description: String(fd.get('description') || '').trim(),
        participants: handles,
        isPublic: fd.get('isPublic') === 'true'
      };
      messagesBusy = true; messagesFeedback = 'Creating conversation and recording membership…'; render();
      whiloApi('/api/messages/conversations', { method: 'POST', body: JSON.stringify(payload) })
        .then(function (data) {
          messagesCreateOpen = false; messagesScope = 'inbox'; messagesSearch = ''; messagesSelectedId = data.conversationId; messagesRows = [];
          messagesFeedback = 'Conversation created. You can now message its members.';
          return loadMessageConversations('inbox', true).then(function () { return startMessageConversation(data.conversationId); });
        })
        .catch(function (error) { messagesFeedback = error && error.message ? error.message : 'Conversation could not be created.'; })
        .finally(function () { messagesBusy = false; if (active === 'messages') render(); });
      return;
    }
    if (form.id === 'message-people-search-form') {
      const fd = new FormData(form);
      searchMessagePeople(fd.get('q')); return;
    }
    if (form.id === 'message-compose') {
      event.preventDefault();
      sendHumanMessage(form); return;
    }
    if (form.id === 'cloud-signin-form') {
      const fd = new FormData(form);
      const email = String(fd.get('email') || '');
      const password = String(fd.get('password') || '');
      cloudAuthBusy = true; cloudAuthFeedback = 'Signing in securely…'; render();
      window.WhiloCloudAuth.signIn(email, password)
        .then(function (user) {
          cloudAuthSession = user; cloudAuthConfigured = true; cloudAuthChecked = true;
          cloudAuthFeedback = 'Signed in as ' + (user.email || email) + '.';
          connectorCache = null; connectorFeedback = ''; cloudMissionsCache = null; cloudMissionsFeedback = '';
          return Promise.all([loadConnectors(), loadCloudMissions()]);
        })
        .catch(function (error) { cloudAuthFeedback = error && error.message ? error.message : 'Cloud sign-in failed.'; })
        .finally(function () { cloudAuthBusy = false; render(); });
      return;
    }
    if (form.id === 'connect-twilio-form') {
      const fd = new FormData(form);
      connectorBusy = true; connectorFeedback = 'Verifying credentials and storing an encrypted connection…'; render();
      const payload = {
        action: 'connect_twilio',
        accountSid: String(fd.get('accountSid') || ''),
        apiKeySid: String(fd.get('apiKeySid') || ''),
        apiKeySecret: String(fd.get('apiKeySecret') || ''),
        messagingServiceSid: String(fd.get('messagingServiceSid') || '')
      };
      whiloApi('/api/connectors', { method: 'POST', body: JSON.stringify(payload) })
        .then(function (data) { connectorFeedback = data.detail || 'Twilio credentials verified.'; connectorCache = null; showTwilioForm = false; return loadConnectors(); })
        .catch(function (error) { connectorFeedback = error && error.message ? error.message : 'Twilio credentials could not be verified.'; })
        .finally(function () { connectorBusy = false; render(); });
      return;
    }
    if (form.id === 'new-task') {
      const fd = new FormData(form);
      const title = String(fd.get('title') || '').trim();
      if (!title) return;
      addTask(title, fd.get('department'), fd.get('owner'), fd.get('priority'), fd.get('execution'));
      render();
    }
    if (form.id === 'assumptions') {
      const fd = new FormData(form);
      state.hoursPerTask = Math.max(0, Math.min(1000, Number(fd.get('hours')) || 0));
      state.hourlyCost = Math.max(0, Math.min(100000, Number(fd.get('cost')) || 0));
      save(); render();
    }
  });
  shadow.addEventListener('input', function (event) {
    const target = event.target;
    if (target && target.id === 'message-conversation-search') {
      messagesSearch = target.value || '';
      const list = shadow.querySelector('#message-conversation-list');
      if (list) list.innerHTML = messageConversationListHtml();
      return;
    }
    if (target && target.id === 'message-compose-input') {
      messageComposerDraft = target.value || '';
      const count = shadow.querySelector('.message-compose-foot span:last-child');
      if (count) count.textContent = messageComposerDraft.length + '/12000';
    }
  });
  shadow.addEventListener('keydown', function (event) {
    if (event.target && event.target.id === 'message-compose-input' && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const form = event.target.closest('form');
      if (form && !messagesBusy) sendHumanMessage(form);
    }
  });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && veil.classList.contains('open')) closePanel(); });

  function boot() {
    const oauthResult = new URLSearchParams(window.location.search).get('whilo_connect');
    if (oauthResult && /^slack_(success|error|cancelled|expired)$/.test(oauthResult)) {
      active = 'connect';
      connectorCache = null;
      connectorFeedback = oauthResult === 'slack_success'
        ? 'Slack OAuth returned successfully. Verifying the saved workspace connection…'
        : oauthResult === 'slack_cancelled' ? 'Slack authorization was cancelled.'
        : oauthResult === 'slack_expired' ? 'That Slack authorization expired. Start again.'
        : 'Slack authorization failed. Check the OAuth app settings and server logs.';
      const cleanUrl = new URL(window.location.href); cleanUrl.searchParams.delete('whilo_connect');
      window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      setTimeout(function () { openPanel('connect'); loadConnectors(); }, 0);
    }
    injectTopbar();
    // The existing React shell may replace the navigation after a route change.
    // Keep the observer, but only rescan when a top-level navigation label is likely affected.
    let scheduled = false;
    const observer = new MutationObserver(function (records) {
      const relevant = records.some(function (record) {
        const nodes = Array.from(record.addedNodes || []).concat(Array.from(record.removedNodes || []));
        return nodes.some(function (node) {
          if (!node || node.nodeType !== 1) return false;
          const element = node;
          if (element.matches && element.matches('button,a,[role="tab"],[role="button"]') && visible(element)) return true;
          return !!(element.querySelector && element.querySelector('button,a,[role="tab"],[role="button"]'));
        });
      });
      if (!relevant || scheduled) return;
      scheduled = true;
      queueMicrotask(function () { scheduled = false; injectTopbar(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();