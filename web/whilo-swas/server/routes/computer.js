'use strict';

const {
  send, authenticate, organizationFor, db, readJson, audit, safeError
} = require('../../api/_lib/platform');
const { resolvePublicHttpsTarget } = require('../security/public-target');

function fail(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicCode = code;
  throw error;
}
function clippedPath(value) {
  try {
    const url = new URL(value);
    return String(url.pathname || '/').slice(0, 160);
  } catch (_) {
    return '/';
  }
}
function boundedText(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
async function browserbaseCreateSession(apiKey, projectId, orgId, userId, hostname) {
  const body = {
    browserSettings: {
      viewport: { width: 1280, height: 800 },
      blockAds: true,
      recordSession: false,
      logSession: false,
      allowedDomains: [hostname]
    },
    timeout: 60,
    keepAlive: false,
    userMetadata: {
      product: 'whilo-read-only-website-qa',
      organizationId: orgId,
      actorId: userId
    }
  };
  if (projectId) body.projectId = projectId;
  let response;
  try {
    response = await fetch('https://api.browserbase.com/v1/sessions', {
      method: 'POST',
      headers: {
        'X-BB-API-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
  } catch (_) {
    fail(502, 'browser_provider_unreachable', 'The remote browser provider could not be reached. No website was inspected.');
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      fail(503, 'browser_provider_credentials_rejected', 'Browserbase rejected its configured credentials. Check BROWSERBASE_API_KEY and the project settings.');
    }
    if (response.status === 429) {
      fail(429, 'browser_provider_rate_limited', 'The remote browser provider is rate-limited. Try again later.');
    }
    fail(502, 'browser_session_create_failed', 'The remote browser session could not be created. No website was inspected.');
  }
  let data;
  try { data = await response.json(); } catch (_) {
    fail(502, 'browser_provider_bad_response', 'The remote browser provider returned an unreadable session response.');
  }
  if (!data || typeof data.id !== 'string' || typeof data.connectUrl !== 'string') {
    fail(502, 'browser_session_incomplete', 'The remote browser provider did not return a usable session.');
  }
  return { id: data.id, connectUrl: data.connectUrl };
}
async function inspectWithBrowser(session, targetUrl, targetOrigin, chromium) {
  let browser;
  let context;
  let page;
  const consoleErrors = [];
  const pageErrors = [];
  const failedSameOriginRequests = [];
  const httpErrors = [];
  const blockedOrigins = new Set();
  const startedAt = Date.now();
  try {
    try {
      browser = await chromium.connectOverCDP(session.connectUrl, { timeout: 15000 });
    } catch (_) {
      fail(502, 'browser_session_connect_failed', 'Whilo could not connect to the isolated browser. Try again.');
    }
    const contexts = browser.contexts();
    context = contexts[0] || await browser.newContext({ viewport: { width: 1280, height: 800 } });
    context.setDefaultNavigationTimeout(15000);
    context.setDefaultTimeout(4000);

    await context.route('**/*', async function(route) {
      const rawUrl = route.request().url();
      if (/^(about:|data:|blob:)/i.test(rawUrl)) {
        try { await route.continue(); } catch (_) {}
        return;
      }
      let parsed;
      try { parsed = new URL(rawUrl); } catch (_) {
        try { await route.abort(); } catch (_) {}
        return;
      }
      if (parsed.protocol === 'https:' && parsed.origin === targetOrigin) {
        try { await route.continue(); } catch (_) {}
        return;
      }
      blockedOrigins.add(parsed.origin || parsed.protocol);
      try { await route.abort('blockedbyclient'); } catch (_) {}
    });

    page = context.pages()[0] || await context.newPage();
    page.on('console', function(message) {
      if (message && message.type && message.type() === 'error' && consoleErrors.length < 12) {
        consoleErrors.push('console_error');
      }
    });
    page.on('pageerror', function() {
      if (pageErrors.length < 12) pageErrors.push('page_error');
    });
    page.on('requestfailed', function(request) {
      try {
        const url = new URL(request.url());
        if (url.origin === targetOrigin && failedSameOriginRequests.length < 12) {
          failedSameOriginRequests.push({ path: clippedPath(request.url()), reason: 'request_failed' });
        }
      } catch (_) {}
    });
    page.on('response', function(response) {
      try {
        const url = new URL(response.url());
        if (url.origin === targetOrigin && response.status() >= 400 && httpErrors.length < 12) {
          httpErrors.push({ path: clippedPath(response.url()), status: response.status() });
        }
      } catch (_) {}
    });

    let navigationResponse = null;
    let navigationError = '';
    try {
      navigationResponse = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (error) {
      navigationError = error && error.name === 'TimeoutError' ? 'navigation_timeout' : 'navigation_failed';
    }
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(function() {});

    let snapshot;
    try {
      snapshot = await page.evaluate(function() {
        const visible = function(element) {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const images = Array.from(document.images).filter(visible);
        const buttons = Array.from(document.querySelectorAll('button,[role="button"]')).filter(visible);
        const controls = Array.from(document.querySelectorAll('input:not([type="hidden"]),select,textarea,[contenteditable="true"]')).filter(visible);
        const named = function(element) {
          if (element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.title) return true;
          if (element.labels && element.labels.length) return true;
          if (element.closest('label')) return true;
          const text = String(element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
          return text.length > 0;
        };
        const ids = Array.from(document.querySelectorAll('[id]')).map(function(element) { return element.id; });
        const duplicateIdCount = ids.filter(function(id,index) { return ids.indexOf(id) !== index; }).length;
        const doc = document.documentElement;
        const body = document.body;
        return {
          title: String(document.title || '').slice(0,160),
          languagePresent: !!String(doc.lang || '').trim(),
          descriptionPresent: !!document.querySelector('meta[name="description"]')?.content?.trim(),
          h1Count: document.querySelectorAll('h1').length,
          mainLandmarkCount: document.querySelectorAll('main,[role="main"]').length,
          linkCount: Array.from(document.querySelectorAll('a[href]')).filter(visible).length,
          buttonCount: buttons.length,
          unnamedButtonCount: buttons.filter(function(element) { return !named(element); }).length,
          formControlCount: controls.length,
          unlabeledControlCount: controls.filter(function(element) { return !named(element); }).length,
          imageCount: images.length,
          imagesMissingAlt: images.filter(function(image) {
            return !image.hasAttribute('alt') || (!String(image.getAttribute('alt') || '').trim() && !image.getAttribute('role')?.toLowerCase().includes('presentation'));
          }).length,
          formCount: document.forms.length,
          duplicateIdCount: duplicateIdCount,
          horizontalOverflow: !!(body && doc && Math.max(body.scrollWidth,doc.scrollWidth) > window.innerWidth + 2),
          viewport: { width: window.innerWidth, height: window.innerHeight }
        };
      });
    } catch (_) {
      snapshot = {
        title: '', languagePresent: false, descriptionPresent: false, h1Count: 0,
        mainLandmarkCount: 0, linkCount: 0, buttonCount: 0, unnamedButtonCount: 0,
        formControlCount: 0, unlabeledControlCount: 0, imageCount: 0,
        imagesMissingAlt: 0, formCount: 0, duplicateIdCount: 0, horizontalOverflow: false,
        viewport: { width: 1280, height: 800 }
      };
    }

    const findings = [];
    const status = navigationResponse && typeof navigationResponse.status === 'function' ? navigationResponse.status() : null;
    const add = function(severity, code, detail) {
      findings.push({ severity: severity, code: code, detail: detail });
    };
    if (status !== null && status >= 400) add('high','http_error','The page returned HTTP ' + status + '.');
    if (navigationError === 'navigation_timeout') add('high','navigation_timeout','The page did not finish its initial navigation within 15 seconds.');
    else if (navigationError) add('high','navigation_failed','The browser could not complete the initial navigation.');
    if (!snapshot.title) add('medium','missing_document_title','The document title is empty.');
    if (snapshot.h1Count === 0) add('medium','missing_h1','No H1 heading was found.');
    if (snapshot.mainLandmarkCount === 0) add('low','missing_main_landmark','No main landmark was found.');
    if (snapshot.unlabeledControlCount > 0) add('medium','unlabeled_controls',snapshot.unlabeledControlCount + ' visible form control(s) may lack an accessible label.');
    if (snapshot.unnamedButtonCount > 0) add('medium','unnamed_buttons',snapshot.unnamedButtonCount + ' visible button(s) may lack an accessible name.');
    if (snapshot.imagesMissingAlt > 0) add('medium','images_missing_alt',snapshot.imagesMissingAlt + ' visible image(s) may lack alternative text.');
    if (snapshot.duplicateIdCount > 0) add('medium','duplicate_ids',snapshot.duplicateIdCount + ' duplicate HTML id(s) were found.');
    if (snapshot.horizontalOverflow) add('low','horizontal_overflow','The document is wider than the viewport at this screen size.');
    if (consoleErrors.length) add('medium','console_errors',consoleErrors.length + ' browser console error(s) were detected; message contents were not captured.');
    if (pageErrors.length) add('medium','uncaught_page_errors',pageErrors.length + ' uncaught JavaScript page error(s) were detected.');
    if (httpErrors.length) add('medium','same_origin_http_errors',httpErrors.length + ' same-origin request(s) returned HTTP 4xx/5xx.');
    if (failedSameOriginRequests.length) add('low','same_origin_request_failures',failedSameOriginRequests.length + ' same-origin request(s) failed to load.');
    if (blockedOrigins.size) add('info','third_party_requests_blocked',blockedOrigins.size + ' third-party or non-HTTPS origin(s) were blocked by the read-only inspection policy.');

    let screenshotDataUrl = null;
    try {
      const image = await page.screenshot({ type: 'jpeg', quality: 40, fullPage: false, timeout: 5000 });
      if (image && image.length > 0 && image.length <= 450000) {
        screenshotDataUrl = 'data:image/jpeg;base64,' + image.toString('base64');
      }
    } catch (_) {}

    return {
      status: status,
      title: snapshot.title,
      finalPath: clippedPath(typeof page.url === 'function' ? page.url() : targetUrl),
      durationMs: Math.min(60000, Date.now() - startedAt),
      findings: findings.slice(0,20),
      summary: {
        ...snapshot,
        consoleErrorCount: consoleErrors.length,
        pageErrorCount: pageErrors.length,
        sameOriginHttpErrorCount: httpErrors.length,
        sameOriginFailedRequestCount: failedSameOriginRequests.length,
        blockedOriginCount: blockedOrigins.size,
        blockedOrigins: Array.from(blockedOrigins).slice(0,6)
      },
      screenshotDataUrl: screenshotDataUrl
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

module.exports = async function computerRoute(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  let organizationId = '';
  let actorId = '';
  let targetHost = '';
  let sessionId = '';
  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    organizationId = member.organization_id;
    actorId = user.id;
    if (!['owner','admin'].includes(member.role)) {
      fail(403,'computer_role_required','Only a workspace owner or admin can start a paid remote browser inspection.');
    }
    const apiKey = String(process.env.BROWSERBASE_API_KEY || '').trim();
    const projectId = String(process.env.BROWSERBASE_PROJECT_ID || '').trim();
    if (!apiKey) {
      fail(503,'computer_runtime_not_configured','The remote browser runtime is not configured. Add BROWSERBASE_API_KEY to the server-side Vercel environment and redeploy.');
    }
    const body = await readJson(req, 8192);
    const rawTarget = String(body && body.url || '').trim();
    if (!rawTarget) fail(400,'computer_url_required','Enter a public HTTPS URL to inspect.');
    const target = await resolvePublicHttpsTarget(rawTarget);
    if (!target) fail(400,'computer_url_required','Enter a public HTTPS URL to inspect.');
    const parsedTarget = new URL(target);
    targetHost = parsedTarget.hostname.toLowerCase();
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recent = await db(
      'audit_events?organization_id=eq.' + encodeURIComponent(organizationId) +
      '&actor_id=eq.' + encodeURIComponent(actorId) +
      '&action=eq.computer.website_qa_started' +
      '&created_at=gte.' + encodeURIComponent(cutoff) +
      '&select=id&limit=3'
    );
    if (Array.isArray(recent) && recent.length >= 3) {
      fail(429,'computer_run_rate_limited','Limit reached: at most 3 remote browser inspections per workspace member in 10 minutes.');
    }
    await audit(organizationId,actorId,'computer.website_qa_started','browser_runtime',targetHost,'success',{
      hostname:targetHost, runtime:'browserbase', mode:'read_only', purpose:'website_qa'
    });

    let chromium;
    try {
      ({ chromium } = require('playwright-core'));
    } catch (_) {
      fail(503, 'browser_runtime_dependency_missing', 'The remote browser runtime dependency is missing from this deployment. Redeploy the latest Whilo build.');
    }
    const session = await browserbaseCreateSession(apiKey,projectId,organizationId,actorId,targetHost);
    sessionId = session.id;
    const result = await inspectWithBrowser(session,target,parsedTarget.origin,chromium);
    await audit(organizationId,actorId,'computer.website_qa_completed','browserbase_session',sessionId,'success',{
      hostname:targetHost, http_status:result.status, findings:result.findings.length,
      runtime:'browserbase', mode:'read_only', duration_ms:result.durationMs
    });
    return send(res,200,{
      ok:true, runtime:'browserbase', mode:'read_only_website_qa',
      sessionId:sessionId, inspectedAt:new Date().toISOString(),
      title:result.title, status:result.status, finalPath:result.finalPath,
      durationMs:result.durationMs, findings:result.findings, summary:result.summary,
      screenshotDataUrl:result.screenshotDataUrl,
      note:'Read-only inspection only. No forms were submitted and no external writes were attempted. Non-HTTPS and off-origin requests were blocked.'
    });
  } catch(error) {
    if (organizationId && actorId) {
      try {
        await audit(organizationId,actorId,'computer.website_qa_failed','browser_runtime',sessionId || targetHost || null,'error',{
          code:String(error && error.publicCode || 'computer_runtime_failed').slice(0,80),
          runtime:'browserbase', mode:'read_only'
        });
      } catch (_) {}
    }
    if(error && error.statusCode) return send(res,error.statusCode,{
      error:error.message,code:error.publicCode || 'computer_runtime_error'
    });
    return safeError(res,error);
  }
};
