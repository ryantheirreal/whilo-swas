(function () {
  'use strict';
  if (window.__whiloLegalDeskLoaded) return;
  window.__whiloLegalDeskLoaded = true;

  const SOURCE_REPO = 'https://github.com/ctresb/leis';
  const API_ROOT = 'https://api.github.com/repos/ctresb/leis/contents/';
  const RAW_ROOT = 'https://raw.githubusercontent.com/ctresb/leis/main/';
  const state = {
    pane: 'corpus',
    workflow: 'contract',
    path: 'federal/leis-ordinarias/2025',
    query: '',
    items: [],
    loading: false,
    error: '',
    selectedPath: '',
    selectedSha: '',
    sourceText: '',
    sourceMeta: null,
    documentTitle: 'Minuta contratual',
    documentText: '',
    provider: '',
    model: '',
    timeline: [],
    signatureDrawn: false
  };

  const host = document.createElement('div');
  host.id = 'whilo-legal-desk-root';
  const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  const style = document.createElement('style');
  style.textContent = [
    ':host{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#eef3f9}*{box-sizing:border-box}',
    '.veil{position:fixed;inset:0;z-index:2147483646;background:rgba(3,6,11,.84);backdrop-filter:blur(14px);display:none;align-items:center;justify-content:center;padding:18px}',
    '.veil.open{display:flex}.panel{width:min(1380px,100%);height:min(92vh,960px);background:#0a0d12;border:1px solid #293342;border-radius:20px;box-shadow:0 30px 100px #000a;display:flex;flex-direction:column;overflow:hidden}',
    '.head{display:flex;align-items:center;gap:13px;padding:16px 19px;border-bottom:1px solid #252e3a}.brandmark{width:38px;height:38px;display:grid;place-items:center;border:1px solid #394657;border-radius:12px;color:#d8e5f6;font-weight:800}.head h1{font-size:17px;margin:0}.eyebrow{font-size:9px;letter-spacing:.14em;color:#91a5bb;font-weight:800;text-transform:uppercase}.sub{font-size:11px;color:#8291a3;margin-top:4px}.grow{flex:1}.close{border:1px solid #394657;background:#141b25;color:#dce5ef;border-radius:10px;width:34px;height:34px;font-size:21px;cursor:pointer}',
    '.nav{display:flex;gap:6px;padding:10px 17px;border-bottom:1px solid #252e3a;overflow:auto}.nav button,.btn{border:1px solid #344154;background:#121923;color:#dbe6f2;border-radius:9px;padding:9px 12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}.nav button.active,.btn.primary{background:#e8eef6;border-color:#e8eef6;color:#101820}.btn:disabled{opacity:.45;cursor:not-allowed}.body{flex:1;min-height:0;overflow:auto;padding:18px}.panehead{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;margin-bottom:15px}.panehead h2{font-size:19px;margin:0 0 5px}.muted{font-size:11px;line-height:1.6;color:#94a4b7;margin:0}.notice{padding:11px 13px;border:1px solid #394657;border-radius:11px;background:#111823;color:#b8c7d7;font-size:11px;line-height:1.6;margin:10px 0}.notice.warn{border-color:#6d5737;background:#1c180f;color:#e9d6b4}.notice.good{border-color:#345844;background:#0e1c15;color:#c2e2ce}',
    '.row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.field{background:#0b111a;color:#e6eef7;border:1px solid #354356;border-radius:9px;padding:10px 11px;font:inherit;font-size:12px;min-width:0}.path{flex:1;min-width:260px}.query{width:min(320px,100%)}.layout{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr);gap:12px;margin-top:13px}.card{border:1px solid #2b3543;border-radius:14px;background:#0e141d;padding:13px;min-width:0}.list{display:grid;gap:6px;max-height:52vh;overflow:auto}.entry{width:100%;display:flex;gap:9px;align-items:center;text-align:left;padding:9px 10px;border:1px solid #293442;border-radius:9px;background:#0b1119;color:#d9e5f2;cursor:pointer;font-size:11px}.entry:hover{border-color:#7489a1}.entry .name{flex:1;overflow-wrap:anywhere}.tag{border:1px solid #364457;border-radius:999px;padding:3px 6px;font-size:9px;color:#a8bad0}.source{white-space:pre-wrap;overflow-wrap:anywhere;max-height:50vh;overflow:auto;background:#070b10;border:1px solid #273342;border-radius:10px;padding:13px;font-size:11px;line-height:1.6;color:#c9d6e4}.docgrid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(250px,.8fr);gap:13px}.doc{min-height:420px;width:100%;resize:vertical;background:#080d13;color:#edf3f8;border:1px solid #354254;border-radius:12px;padding:14px;font:12px/1.7 ui-monospace,SFMono-Regular,monospace}.filetypes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}.filetype{display:flex;gap:9px;align-items:center;padding:11px;border:1px solid #2c3746;border-radius:12px;background:#0d141d;min-width:0}.filetype svg,.filetype img{width:34px;height:40px;flex:0 0 auto}.filetype b{font-size:11px;display:block}.filetype small{font-size:9px;color:#8fa0b4}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.signature{width:100%;height:190px;display:block;background:#f9fbfd;border:1px solid #5f6f81;border-radius:12px;touch-action:none;cursor:crosshair}.timeline{display:grid;gap:8px;max-width:900px}.event{display:grid;grid-template-columns:38px minmax(0,1fr);gap:11px;padding:12px;border:1px solid #2b3543;border-radius:12px;background:#0e141d}.eventicon{width:34px;height:38px;display:grid;place-items:center}.eventicon svg,.eventicon img{max-width:32px;max-height:36px}.event h3{font-size:11px;margin:0 0 4px}.event p{font-size:10px;line-height:1.5;color:#9bacc0;margin:0}.event time{font-size:9px;color:#6f8197}.docplaceholder{padding:20px;border:1px dashed #465366;border-radius:12px;color:#aab8c8;font-size:11px;line-height:1.6}.signature-meta{font-size:10px;color:#9eacbd;margin-top:7px}',
    '@media(max-width:760px){.veil{padding:0}.panel{width:100%;height:100%;border-radius:0}.body{padding:13px}.layout,.docgrid{grid-template-columns:1fr}.list{max-height:35vh}.panehead{display:block}.filetypes{grid-template-columns:1fr 1fr}}',
    '@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}'
  ].join('');
  root.appendChild(style);

  const veil = document.createElement('div');
  veil.className = 'veil';
  veil.innerHTML = '<section class="panel" role="dialog" aria-modal="true" aria-label="Whilo Legal Desk"><header class="head"><div class="brandmark">§</div><div><div class="eyebrow">WHILO / LEGAL DESK</div><h1>Legal workspace</h1><div class="sub">Sources · drafts · review trail · export</div></div><div class="grow"></div><button class="close" data-action="close" aria-label="Close">×</button></header><nav class="nav"><button data-pane="corpus">Law corpus</button><button data-pane="document">Document output</button><button data-pane="signature">Signature preview</button><button data-pane="timeline">Agent timeline</button></nav><main class="body" id="body"></main></section>';
  root.appendChild(veil);
  document.body.appendChild(host);
  const body = veil.querySelector('#body');

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }
  function addEvent(kind, title, detail) {
    state.timeline.unshift({ kind: kind, title: title, detail: detail || '', at: new Date().toISOString() });
    state.timeline = state.timeline.slice(0, 80);
    if (state.pane === 'timeline' && veil.classList.contains('open')) render();
  }
  function icon(kind) {
    if (kind === 'pdf') return '<svg viewBox="0 0 64 72" aria-hidden="true"><path fill="#e4544c" d="M10 0h34l20 20v42a10 10 0 0 1-10 10H10A10 10 0 0 1 0 62V10A10 10 0 0 1 10 0z"/><path fill="#b9362d" d="M44 0v14a6 6 0 0 0 6 6h14z"/><text x="32" y="48" font-size="15" font-weight="800" text-anchor="middle" fill="white">PDF</text></svg>';
    if (kind === 'docs') return '<svg viewBox="0 0 64 72" aria-hidden="true"><path fill="#1682e8" d="M10 0h34l20 20v42a10 10 0 0 1-10 10H10A10 10 0 0 1 0 62V10A10 10 0 0 1 10 0z"/><path fill="#2b60c7" d="M44 0v14a6 6 0 0 0 6 6h14z"/><path d="M14 34h36M14 44h36M14 54h23" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>';
    if (kind === 'code') return '<img src="https://www.svgrepo.com/show/528183/code-square.svg" alt="Code SVG" loading="lazy">';
    if (kind === 'folder') return '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#d9b76b" d="M3 7a3 3 0 0 1 3-3h8l3 4h9a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/></svg>';
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#91a9c7" d="M7 2h12l7 7v20H7z"/><path fill="#536d8c" d="M19 2v7h7z"/><path stroke="#fff" stroke-width="1.8" d="M11 15h11M11 20h11M11 25h7"/></svg>';
  }
  function fmtDate(value) {
    try { return new Date(value).toLocaleString(); } catch (_) { return value || ''; }
  }
  function validateRepoPath(path) {
    const value = String(path || '').replace(/^\/+|\/+$/g, '');
    if (!value) return '';
    if (value.length > 220 || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Path inválido.');
    if (!/^[A-Za-z0-9À-ÿ_.() -]+(?:\/[A-Za-z0-9À-ÿ_.() -]+)*$/.test(value)) throw new Error('Use apenas caminhos de pasta do repositório, sem URL ou parâmetros.');
    const root = value.split('/')[0].toLowerCase();
    if (!['federal','estaduais','municipais','reguladores','jurisprudencia','tratados','scripts'].includes(root)) throw new Error('A navegação é limitada às pastas públicas conhecidas do acervo.');
    return value;
  }
  function apiPath(path) {
    return API_ROOT + (path ? path.split('/').map(encodeURIComponent).join('/') : '') + '?ref=main';
  }
  async function browse(path) {
    state.loading = true; state.error = ''; state.path = path;
    state.items = []; state.selectedPath = ''; state.sourceText = ''; state.sourceMeta = null;
    render();
    addEvent('source', 'Consulta à pasta iniciada', path || 'Raiz do repositório');
    try {
      const response = await fetch(apiPath(path), { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 403 || response.status === 429) throw new Error('Limite público da API do GitHub atingido. Aguarde a janela de rate limit ou consulte o repositório diretamente.');
        if (response.status === 404) throw new Error('Pasta não encontrada nesta revisão. Volte à raiz e navegue pelas pastas disponíveis.');
        throw new Error('O GitHub não retornou o catálogo (HTTP ' + response.status + ').');
      }
      if (!Array.isArray(data)) throw new Error('O caminho selecionado não é uma pasta do repositório.');
      state.items = data.filter(item => item && (item.type === 'dir' || (item.type === 'file' && /\.md$/i.test(item.name || '')))).slice(0, 500);
      addEvent('source', 'Pasta carregada', state.items.length + ' entradas Markdown/pastas · ' + (path || 'raiz') + ' · ref main');
    } catch (error) {
      state.error = error && error.message ? error.message : 'Falha ao consultar o acervo.';
      addEvent('warning', 'Consulta de acervo falhou', state.error);
    } finally {
      state.loading = false;
      render();
    }
  }
  async function openSource(path) {
    const safePath = validateRepoPath(path);
    if (!safePath || !safePath.toLowerCase().endsWith('.md')) throw new Error('Selecione um arquivo Markdown do acervo.');
    state.selectedPath = safePath;
    state.sourceText = 'Carregando fonte…';
    state.sourceMeta = null;
    render();
    try {
      const url = RAW_ROOT + safePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(url, { headers: { Accept: 'text/plain' }, cache: 'no-store' });
      if (!response.ok) throw new Error('Arquivo indisponível na revisão main (HTTP ' + response.status + ').');
      const text = await response.text();
      state.sourceText = text.slice(0, 180000);
      const item = state.items.find(entry => entry.path === safePath);
      state.sourceMeta = { path: safePath, sha: item && item.sha ? item.sha : 'not-returned', url: SOURCE_REPO + '/blob/main/' + safePath, rawUrl: url };
      addEvent('source', 'Fonte aberta', safePath + ' · SHA ' + state.sourceMeta.sha);
      render();
    } catch (error) {
      state.sourceText = error && error.message ? error.message : 'Não foi possível carregar a fonte.';
      state.sourceMeta = null;
      render();
    }
  }
  function corpusPage() {
    const query = state.query.trim().toLowerCase();
    const filtered = state.items.filter(item => !query || item.name.toLowerCase().includes(query));
    return '<div class="panehead"><div><h2>Legislation corpus explorer</h2><p class="muted">Navegue pelas pastas públicas de leis federais, estaduais, municipais, reguladores, jurisprudência e tratados. Pesquisa por nome dentro da pasta atual; não é uma busca integral de texto.</p></div><span class="tag">public GitHub snapshot · main</span></div>' +
      '<div class="notice warn"><b>Limite de cobertura:</b> o repositório declara lacunas e possíveis erros de conversão/OCR. A lista e o texto são uma fonte de pesquisa, não prova de vigência. Antes de citar ou usar uma norma, confira a publicação e a versão na fonte oficial. O acervo não substitui o Diário Oficial.</div>' +
      '<div class="row"><input id="corpus-path" class="field path" maxlength="220" value="' + esc(state.path) + '" placeholder="Ex.: federal/leis-ordinarias/2025"><button class="btn primary" data-action="browse">Browse folder</button><button class="btn" data-action="corpus-root">Root</button></div>' +
      '<div class="row" style="margin-top:9px"><input id="corpus-query" class="field query" value="' + esc(state.query) + '" placeholder="Filter current folder by filename"><span class="muted">' + filtered.length + ' / ' + state.items.length + ' entries</span><a class="muted" href="' + SOURCE_REPO + '/blob/main/COBERTURA.md" target="_blank" rel="noopener noreferrer">Coverage report ↗</a><a class="muted" href="' + SOURCE_REPO + '/blob/main/PROGRESSO.md" target="_blank" rel="noopener noreferrer">Progress report ↗</a></div>' +
      (state.error ? '<div class="notice warn">' + esc(state.error) + '</div>' : '') +
      '<div class="layout"><section class="card"><div class="eyebrow">FOLDER CONTENTS</div><div class="list" style="margin-top:9px">' +
      (state.loading ? '<div class="muted">Loading repository directory…</div>' : filtered.map(item => '<button class="entry" data-action="' + (item.type === 'dir' ? 'open-folder' : 'open-source') + '" data-path="' + esc(item.path) + '">' + icon(item.type === 'dir' ? 'folder' : 'file') + '<span class="name">' + esc(item.name) + '</span><span class="tag">' + (item.type === 'dir' ? 'folder' : 'Markdown') + '</span></button>').join('') || '<div class="muted">No Markdown files or folders in this view. Try Root or another directory.</div>') +
      '</div></section><section class="card"><div class="eyebrow">SOURCE PREVIEW</div><div style="font-size:11px;color:#d6e2ee;margin:8px 0">' + esc(state.selectedPath || 'Select a Markdown source') + '</div>' +
      (state.sourceMeta ? '<div class="muted">Repository path: ' + esc(state.sourceMeta.path) + '<br>Git object SHA: ' + esc(state.sourceMeta.sha) + '<br><a href="' + esc(state.sourceMeta.url) + '" target="_blank" rel="noopener noreferrer" style="color:#9fc6ef">Open source on GitHub ↗</a></div>' : '') +
      '<pre class="source" style="margin-top:10px">' + esc(state.sourceText || 'The original file will appear here. Whilo does not certify the legal status or current wording.') + '</pre>' +
      (state.sourceMeta ? '<div class="actions"><button class="btn" data-action="copy-source-citation">Copy provenance</button><button class="btn" data-action="send-source-to-chat">Prepare research in Chat</button></div>' : '') +
      '</section></div>';
  }
  function documentPage() {
    const text = state.documentText || '';
    return '<div class="panehead"><div><h2>Agent output / contract draft</h2><p class="muted">Edit the generated text, check the missing facts and export a reviewable draft. The original provider response remains an AI-generated draft, not an executed contract.</p></div><span class="tag">' + (text ? 'draft received' : 'awaiting output') + '</span></div>' +
      '<div class="filetypes"><div class="filetype">' + icon('pdf') + '<div><b>PDF</b><small>Print / save as PDF</small></div></div><div class="filetype">' + icon('docs') + '<div><b>Docs / Word</b><small>Editable .doc HTML package</small></div></div><div class="filetype">' + icon('code') + '<div><b>Source / Markdown</b><small>Export text with provenance</small></div></div></div>' +
      '<div class="docgrid"><section><label class="muted" for="legal-title">Document title</label><input id="legal-title" class="field" style="width:100%;margin:6px 0 10px" maxlength="140" value="' + esc(state.documentTitle) + '">' +
      '<label class="muted" for="legal-document">Editable draft</label><textarea id="legal-document" class="doc" maxlength="50000" placeholder="Generate a contract draft in Whilo Chat or paste an approved draft here.">' + esc(text) + '</textarea>' +
      '<div class="actions"><button class="btn primary" data-action="export-pdf"' + (!text.trim() ? ' disabled' : '') + '>Export PDF</button><button class="btn" data-action="export-doc"' + (!text.trim() ? ' disabled' : '') + '>Export Word (.doc)</button><button class="btn" data-action="export-md"' + (!text.trim() ? ' disabled' : '') + '>Export Markdown</button></div></section>' +
      '<aside class="card"><div class="eyebrow">REVIEW & RELEASE CHECKLIST</div><div class="notice warn">DRAFT ONLY — no one has signed, approved or sent this document.</div><ul class="muted" style="padding-left:17px;line-height:1.9"><li>Confirm legal names, authority and capacity of all parties.</li><li>Verify jurisdiction, dates, numbers, annexes and commercial terms.</li><li>Check each legal citation against the official source and current text.</li><li>Have a qualified lawyer review risks, redlines and enforceability.</li><li>Use an authorized e-signature provider separately for identity, consent, audit trail and final execution.</li></ul><div class="notice">Signature state: <b>Pending outside Whilo</b>. The sketch pad below is a visual interaction demo only and does not attach a signature to this contract.</div><button class="btn" data-pane="signature">Open signature preview</button></aside></div>';
  }
  function signaturePage() {
    return '<div class="panehead"><div><h2>Signature pen preview</h2><p class="muted">Pointer / mouse / touchscreen drawing surface for UI testing.</p></div><span class="tag">non-binding demo</span></div>' +
      '<div class="notice warn"><b>Not a signing service.</b> The drawing is not identity verification, signer consent, a certificate, an audit trail or a legally valid electronic signature. Whilo does not store, attach or export this mark. Do not use this pad to execute a real contract.</div>' +
      '<section class="card"><div class="eyebrow">DRAWING SURFACE</div><canvas id="signature-pad" class="signature" width="1200" height="360" aria-label="Demonstration drawing surface"></canvas><div class="actions"><button class="btn" data-action="clear-signature">Clear pad</button><span class="signature-meta">' + (state.signatureDrawn ? 'Stroke detected · preview only · not attached to the document' : 'Use mouse, pen or touchscreen to draw a sample stroke') + '</span></div></section>' +
      '<div class="notice">Production path: use a reputable e-signature provider with signer identity, explicit consent, signer access control, tamper-evident document hash, timestamps, audit trail, certificate evidence where applicable, webhook verification and revocation/dispute handling. This interface deliberately stops before those steps.</div>';
  }
  function timelinePage() {
    return '<div class="panehead"><div><h2>Agent timeline / runtime receipts</h2><p class="muted">Lifecycle events emitted by the current request flow and legal workspace actions. This is not token-by-token streaming or a durable server audit log.</p></div><span class="tag">' + state.timeline.length + ' events</span></div>' +
      '<div class="notice">Current model gateway returns a completed response in one HTTP result. Timeline entries show confirmed lifecycle milestones only; streaming chunks, durable job execution and cross-session persistence are not enabled in this Legal Desk iteration.</div>' +
      '<div class="timeline">' + (state.timeline.map(item => '<article class="event"><div class="eventicon">' + icon(item.kind) + '</div><div><h3>' + esc(item.title) + '</h3><p>' + esc(item.detail) + '</p><time>' + esc(fmtDate(item.at)) + '</time></div></article>').join('') || '<div class="docplaceholder">No timeline events yet. Start a Legal Desk workflow from Plugins or open a law source.</div>') + '</div>';
  }
  function render() {
    veil.querySelectorAll('[data-pane]').forEach(button => button.classList.toggle('active', button.getAttribute('data-pane') === state.pane));
    if (state.pane === 'corpus') body.innerHTML = corpusPage();
    else if (state.pane === 'document') body.innerHTML = documentPage();
    else if (state.pane === 'signature') { body.innerHTML = signaturePage(); bindSignaturePad(); }
    else body.innerHTML = timelinePage();
  }
  function open(pane) {
    if (pane && ['corpus','document','signature','timeline'].includes(pane)) state.pane = pane;
    veil.classList.add('open');
    document.body.style.overflow = 'hidden';
    render();
    if (state.pane === 'corpus' && !state.items.length && !state.loading) browse(state.path);
  }
  function close() {
    veil.classList.remove('open');
    document.body.style.overflow = '';
  }
  function bindSignaturePad() {
    const canvas = body.querySelector('#signature-pad');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    let drawing = false;
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#183e70';
    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return { x:(event.clientX - rect.left) * (canvas.width / rect.width), y:(event.clientY - rect.top) * (canvas.height / rect.height) };
    }
    canvas.addEventListener('pointerdown', function(event) {
      drawing = true; canvas.setPointerCapture(event.pointerId);
      const p = point(event); context.beginPath(); context.moveTo(p.x,p.y);
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', function(event) {
      if (!drawing) return;
      const p = point(event); context.lineTo(p.x,p.y); context.stroke(); state.signatureDrawn = true;
      event.preventDefault();
    });
    function finish() {
      if (!drawing) return;
      drawing = false;
      addEvent('warning','Assinatura demonstrativa desenhada','O rabisco ficou apenas no canvas desta sessão; não foi anexado, validado nem armazenado.');
      const label = body.querySelector('.signature-meta');
      if (label) label.textContent = 'Stroke detected · preview only · not attached to the document';
    }
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('lostpointercapture', finish);
  }
  function currentDraft() {
    const editor = body.querySelector('#legal-document');
    if (editor) state.documentText = editor.value.slice(0,50000);
    const title = body.querySelector('#legal-title');
    if (title) state.documentTitle = title.value.trim().slice(0,140) || 'Minuta contratual';
    return state.documentText;
  }
  function buildHtmlDocument() {
    const title = esc(state.documentTitle || 'Minuta contratual');
    const text = esc(state.documentText);
    const paragraphs = text.split(/\n{2,}/).map(block => '<p>' + block.replace(/\n/g,'<br>') + '</p>').join('');
    const pending = '<p style="margin-top:38px;border-top:1px solid #999;padding-top:14px"><b>ASSINATURA PENDENTE</b><br>Assinatura e validação devem ocorrer por processo externo autorizado.</p>';
    return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>' + title + '</title><style>body{font:12pt/1.65 Georgia,serif;color:#111;max-width:800px;margin:50px auto;padding:0 36px}h1{font:700 20pt Arial,sans-serif;border-bottom:1px solid #aaa;padding-bottom:14px}p{white-space:normal;margin:0 0 12px}.status{font:9pt Arial;color:#7a4c16;margin:16px 0}footer{margin-top:30px;font:9pt Arial;color:#555}</style><h1>' + title + '</h1><div class="status">RASCUNHO PARA REVISÃO PROFISSIONAL — NÃO ASSINADO</div>' + paragraphs + pending + '<footer>Gerado no Whilo Legal Desk. Verifique fontes oficiais e obtenha revisão jurídica antes de qualquer uso.</footer></html>';
  }
  function download(filename, mime, data) {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function exportPdf() {
    currentDraft();
    const preview = window.open('', '_blank');
    if (!preview) throw new Error('Permita o pop-up do navegador para abrir a impressão do PDF.');
    preview.document.open(); preview.document.write(buildHtmlDocument()); preview.document.close();
    preview.focus();
    window.setTimeout(() => preview.print(), 350);
    addEvent('pdf','PDF preparado para impressão','A gravação do PDF acontece no diálogo de impressão do navegador; a saída permanece não assinada.');
  }
  function exportDoc() {
    currentDraft();
    download((state.documentTitle || 'minuta').replace(/[^A-Za-z0-9À-ÿ_-]+/g,'-') + '.doc', 'application/msword;charset=utf-8', buildHtmlDocument());
    addEvent('docs','Word-compatible document exported','HTML document exported with .doc extension; it is not a native Office Open XML .docx file.');
  }
  function exportMarkdown() {
    currentDraft();
    const provenance = state.sourceMeta ? '\n\n---\nSource reference: ' + state.sourceMeta.url + '\nRepository SHA: ' + state.sourceMeta.sha + '\n' : '';
    download((state.documentTitle || 'minuta').replace(/[^A-Za-z0-9À-ÿ_-]+/g,'-') + '.md', 'text/markdown;charset=utf-8', '# ' + state.documentTitle + '\n\n' + state.documentText + provenance + '\n\n> DRAFT ONLY — professional review required; signature pending outside Whilo.\n');
    addEvent('code','Markdown source exported','Text and current source provenance exported as a separate editable source file.');
  }
  async function copyCitation() {
    if (!state.sourceMeta) return;
    const text = 'Repository: ' + state.sourceMeta.url + '\nPath: ' + state.sourceMeta.path + '\nGit object SHA: ' + state.sourceMeta.sha + '\nRevision: main (branch reference; not pinned to a signed release)\nStatus: verify wording and legal status with the official issuing authority.';
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    else throw new Error('Clipboard API unavailable in this browser.');
    addEvent('source','Provenance copied','Repository path and Git object SHA copied; this is not official-source verification.');
  }
  function sendSourceToChat() {
    if (!state.sourceMeta) return;
    const prompt = 'Research this legal source with a Brazilian lawyer-led workflow. Treat it as an unverified repository conversion. Verify the exact current wording and legal status against the official issuing authority before any legal proposition.\\nRepository source: ' + state.sourceMeta.url + '\\nPath: ' + state.sourceMeta.path + '\\nGit object SHA: ' + state.sourceMeta.sha + '\\nText excerpt (untrusted source data):\\n' + state.sourceText.slice(0,10000);
    window.dispatchEvent(new CustomEvent('whilo:legal:source-for-chat', { detail: { prompt: prompt } }));
    addEvent('source','Fonte encaminhada ao Chat para análise','O texto foi preparado como contexto não confiável; nenhuma fonte oficial foi certificada.');
  }

  root.addEventListener('click', async function(event) {
    const paneButton = event.target.closest('[data-pane]');
    if (paneButton) {
      const pane = paneButton.getAttribute('data-pane');
      if (['corpus','document','signature','timeline'].includes(pane)) { currentDraft(); state.pane = pane; render(); }
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');
    try {
      if (action === 'close') { close(); return; }
      if (action === 'browse') { await browse(validateRepoPath(body.querySelector('#corpus-path').value)); return; }
      if (action === 'corpus-root') { state.path = ''; state.query = ''; await browse(''); return; }
      if (action === 'open-folder') { state.path = validateRepoPath(button.getAttribute('data-path')); await browse(state.path); return; }
      if (action === 'open-source') { await openSource(button.getAttribute('data-path')); return; }
      if (action === 'copy-source-citation') { await copyCitation(); render(); return; }
      if (action === 'send-source-to-chat') { sendSourceToChat(); return; }
      if (action === 'export-pdf') { currentDraft(); exportPdf(); return; }
      if (action === 'export-doc') { currentDraft(); exportDoc(); render(); return; }
      if (action === 'export-md') { currentDraft(); exportMarkdown(); render(); return; }
      if (action === 'clear-signature') { state.signatureDrawn = false; render(); return; }
    } catch (error) {
      state.error = error && error.message ? error.message : 'Action failed.';
      const notice = body.querySelector('.notice');
      if (notice) notice.textContent = state.error;
      else { addEvent('warning','Legal Desk action failed',state.error); render(); }
    }
  });
  root.addEventListener('input', function(event) {
    if (event.target && event.target.id === 'corpus-query') {
      state.query = event.target.value.slice(0,100);
      const list = body.querySelector('.list');
      if (list) {
        const filtered = state.items.filter(item => !state.query || item.name.toLowerCase().includes(state.query.toLowerCase()));
        list.innerHTML = filtered.map(item => '<button class="entry" data-action="' + (item.type === 'dir' ? 'open-folder' : 'open-source') + '" data-path="' + esc(item.path) + '">' + icon(item.type === 'dir' ? 'folder' : 'file') + '<span class="name">' + esc(item.name) + '</span><span class="tag">' + (item.type === 'dir' ? 'folder' : 'Markdown') + '</span></button>').join('') || '<div class="muted">No filename matches in this folder.</div>';
      }
      return;
    }
    if (event.target && event.target.id === 'legal-document') state.documentText = event.target.value.slice(0,50000);
    if (event.target && event.target.id === 'legal-title') state.documentTitle = event.target.value.slice(0,140);
  });

  window.addEventListener('whilo:legal:open', function(event) {
    const detail = event && event.detail ? event.detail : {};
    open(detail.pane || 'corpus');
  });
  window.addEventListener('whilo:marketplace:plan-legal', function(event) {
    const detail = event && event.detail ? event.detail : {};
    state.workflow = ['contract','review','research'].includes(detail.workflow) ? detail.workflow : 'contract';
    addEvent('docs','Fluxo jurídico selecionado',state.workflow + ' · prompt enviado para o Chat como rascunho não enviado.');
  });
  window.addEventListener('whilo:legal:agent-stage', function(event) {
    const detail = event && event.detail ? event.detail : {};
    addEvent('code',String(detail.title || 'Etapa do agente'),String(detail.detail || detail.stage || ''));
  });
  window.addEventListener('whilo:legal:artifact-ready', function(event) {
    const detail = event && event.detail ? event.detail : {};
    const workflow = ['contract','review','research'].includes(detail.workflow) ? detail.workflow : 'contract';
    state.workflow = workflow;
    state.documentTitle = workflow === 'contract' ? 'Minuta contratual' : workflow === 'review' ? 'Revisão de contrato' : 'Memorando de pesquisa jurídica';
    state.documentText = String(detail.text || '').slice(0,50000);
    state.provider = String(detail.provider || 'Provider não identificado').slice(0,100);
    state.model = String(detail.model || '').slice(0,100);
    state.pane = 'document';
    addEvent('docs','Output jurídico recebido',state.documentTitle + ' · ' + state.provider + (state.model ? ' · ' + state.model : '') + ' · resposta completa, ainda não revisada');
    open('document');
  });
  window.addEventListener('whilo:legal:source-for-chat', function(event) {
    const detail = event && event.detail ? event.detail : {};
    const prompt = String(detail.prompt || '').slice(0,14000);
    if (!prompt) return;
    window.dispatchEvent(new CustomEvent('whilo:legal:launch-research', { detail: { prompt: prompt } }));
  });
  window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && veil.classList.contains('open')) close();
  });
  addEvent('docs','Legal Desk inicializado','Área de documentos, exploração de repositório público e preview de assinatura demonstrativa prontos nesta sessão.');
})();