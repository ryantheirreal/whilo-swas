'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');

process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.WHILO_CONNECTOR_ENCRYPTION_KEY = Buffer.alloc(32, 23).toString('base64');
process.env.BROWSERBASE_API_KEY = '';
process.env.BROWSERBASE_PROJECT_ID = 'test-browserbase-project';

const userId = '90f810b3-9f8c-4113-97ae-120e4e18912f';
const orgId = '44a6b54e-53f6-43d8-bb59-43f3b281f0ce';
let role = 'owner';
let rateLimited = false;
let browserbaseCalls = 0;
let browserCloseCalls = 0;
let routeHandler = null;
const auditActions = [];
const outbound = [];

function response(status, data) {
  const raw = typeof data === 'string' ? data : JSON.stringify(data);
  return {
    status, ok:status >= 200 && status < 300,
    async json() { return JSON.parse(raw); },
    async text() { return raw; }
  };
}

const snapshot = {
  title:'QA Sample',
  languagePresent:true,
  descriptionPresent:false,
  h1Count:0,
  mainLandmarkCount:0,
  linkCount:3,
  buttonCount:2,
  unnamedButtonCount:1,
  formControlCount:1,
  unlabeledControlCount:1,
  imageCount:1,
  imagesMissingAlt:1,
  formCount:1,
  duplicateIdCount:0,
  horizontalOverflow:false,
  viewport:{width:1280,height:800}
};

const pageListeners = {};
const page = {
  on(name, callback) { (pageListeners[name] ||= []).push(callback); },
  async goto(url) {
    assert.equal(url,'https://example.com/pricing?campaign=public');
    assert.equal(typeof routeHandler,'function','same-origin request policy must be configured before navigation');
    let sameAction='';
    await routeHandler({
      request() { return { url:()=>url }; },
      async continue() { sameAction='continue'; },
      async abort() { sameAction='abort'; }
    });
    assert.equal(sameAction,'continue','the selected HTTPS origin is allowed');
    let thirdPartyAction='';
    await routeHandler({
      request() { return { url:()=>'https://tracker.other.test/pixel' }; },
      async continue() { thirdPartyAction='continue'; },
      async abort() { thirdPartyAction='abort'; }
    });
    assert.equal(thirdPartyAction,'abort','off-origin traffic must be blocked');
    const responseInfo={url:()=>url,status:()=>200};
    for (const fn of pageListeners.response||[]) fn(responseInfo);
    return {status:()=>200};
  },
  async waitForLoadState() {},
  async evaluate() { return snapshot; },
  async screenshot(options) {
    assert.equal(options.type,'jpeg');
    return Buffer.from('fake-jpeg-data');
  },
  url() { return 'https://example.com/pricing?campaign=public'; }
};
const context = {
  async route(pattern, handler) {
    assert.equal(pattern,'**/*');
    routeHandler=handler;
  },
  pages() { return [page]; },
  setDefaultNavigationTimeout(ms) { assert.equal(ms,15000); },
  setDefaultTimeout(ms) { assert.equal(ms,4000); }
};
const browser = {
  contexts() { return [context]; },
  async close() { browserCloseCalls += 1; }
};
const chromium = {
  async connectOverCDP(connectUrl, options) {
    assert.equal(connectUrl,'wss://browserbase.invalid/session-test');
    assert.equal(options.timeout,15000);
    return browser;
  }
};
const originalLoad=Module._load;
Module._load=function(request,parent,isMain) {
  if (request === 'playwright-core') return { chromium };
  if (request === '../security/public-target' && parent && /server[\\/]routes[\\/]computer\.js$/.test(parent.filename)) {
    return {
      async resolvePublicHttpsTarget(value) {
        const url = new URL(String(value || ''));
        if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) {
          const error = new Error('Use a valid public HTTPS target URL.');
          error.statusCode = 400;
          error.publicCode = 'invalid_target';
          throw error;
        }
        if (url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
          const error = new Error('Private targets are blocked.');
          error.statusCode = 400;
          throw error;
        }
        return url.toString();
      }
    };
  }
  return originalLoad.apply(this,arguments);
};

global.fetch=async function(url,options) {
  const parsed=new URL(String(url));
  const method=String(options && options.method || 'GET').toUpperCase();
  outbound.push({url:parsed.toString(),method,headers:options&&options.headers||{},body:options&&options.body||''});
  if(parsed.hostname==='test-project.supabase.co' && parsed.pathname==='/auth/v1/user') {
    return response(200,{id:userId,email:'owner@example.com',user_metadata:{},app_metadata:{}});
  }
  if(parsed.hostname==='test-project.supabase.co' && parsed.pathname==='/rest/v1/organization_members') {
    return response(200,[{organization_id:orgId,role}]);
  }
  if(parsed.hostname==='test-project.supabase.co' && parsed.pathname==='/rest/v1/rpc/reserve_computer_qa_launch' && method==='POST') {
    const reservation=JSON.parse(options.body);
    assert.equal(reservation.p_organization_id,orgId);
    assert.equal(reservation.p_actor_id,userId);
    assert.equal(reservation.p_target_host,'example.com');
    return response(200,[{allowed:!rateLimited,used:rateLimited?3:1}]);
  }
  if(parsed.hostname==='test-project.supabase.co' && parsed.pathname==='/rest/v1/audit_events') {
    if(method==='POST') {
      const record=JSON.parse(options.body);
      auditActions.push(record.action);
      return response(201,[]);
    }
    return response(200,[]);
  }
  if(parsed.hostname==='api.browserbase.com' && parsed.pathname==='/v1/sessions' && method==='POST') {
    browserbaseCalls += 1;
    assert.equal(options.headers['X-BB-API-Key'],'test-browserbase-key');
    const body=JSON.parse(options.body);
    assert.equal(body.projectId,'test-browserbase-project');
    assert.equal(body.timeout,60);
    assert.equal(body.keepAlive,false);
    assert.equal(body.browserSettings.recordSession,false);
    assert.deepEqual(body.browserSettings.allowedDomains,['example.com']);
    assert.equal(body.userMetadata.purpose,undefined);
    return response(201,{id:'session-test',status:'RUNNING',connectUrl:'wss://browserbase.invalid/session-test'});
  }
  throw new Error('Unexpected outbound request: '+method+' '+parsed.toString());
};

function makeResponse() {
  return {statusCode:0,headers:{},body:'',setHeader(k,v){this.headers[k]=v;},end(v){this.body=String(v||'');}};
}
async function invoke(handler,method,url,body) {
  const res=makeResponse();
  const req={method,url,headers:{authorization:'Bearer test-session'},body};
  await handler(req,res);
  return {status:res.statusCode,data:JSON.parse(res.body)};
}

async function main() {
  const handler=require('../web/whilo-swas/server/routes/computer');

  const noKey=await invoke(handler,'POST','/api/computer',{url:'https://example.com/pricing?campaign=public'});
  assert.equal(noKey.status,503);
  assert.equal(noKey.data.code,'computer_runtime_not_configured');
  assert.equal(browserbaseCalls,0,'no browser session should be created without provider credentials');

  process.env.BROWSERBASE_API_KEY='test-browserbase-key';
  const badProtocol=await invoke(handler,'POST','/api/computer',{url:'http://example.com'});
  assert.equal(badProtocol.status,400,'non-HTTPS targets must fail closed');
  assert.equal(browserbaseCalls,0);

  const memberRole=role;
  role='member';
  const deniedRole=await invoke(handler,'POST','/api/computer',{url:'https://example.com/pricing'});
  assert.equal(deniedRole.status,403,'non-admin workspace members cannot consume remote browser budget');
  assert.equal(browserbaseCalls,0);
  role=memberRole;

  const result=await invoke(handler,'POST','/api/computer',{url:'https://example.com/pricing?campaign=public'});
  assert.equal(result.status,200);
  assert.equal(result.data.ok,true);
  assert.equal(result.data.runtime,'browserbase');
  assert.equal(result.data.mode,'read_only_website_qa');
  assert.equal(result.data.status,200);
  assert.equal(result.data.title,'QA Sample');
  assert.ok(result.data.findings.some(item=>item.code==='missing_h1'));
  assert.ok(result.data.findings.some(item=>item.code==='third_party_requests_blocked'));
  assert.equal(result.data.summary.blockedOriginCount,1);
  assert.match(result.data.screenshotDataUrl,/^data:image\/jpeg;base64,/);
  assert.equal(browserCloseCalls,1);
  assert.ok(!JSON.stringify(result.data).includes('test-browserbase-key'));
  assert.ok(!JSON.stringify(result.data).includes('wss://browserbase.invalid'));
  assert.ok(auditActions.includes('computer.website_qa_started'));
  assert.ok(auditActions.includes('computer.website_qa_completed'));
  assert.ok(outbound.some(request => request.url.includes('/rpc/reserve_computer_qa_launch')), 'launch rate limit is reserved atomically in Supabase');

  rateLimited=true;
  const limited=await invoke(handler,'POST','/api/computer',{url:'https://example.com/pricing'});
  assert.equal(limited.status,429);
  assert.equal(limited.data.code,'computer_run_rate_limited');
  assert.equal(browserbaseCalls,1,'rate limiting must block before creating a new browser session');

  const actualTargetModule=require('../web/whilo-swas/server/security/public-target');
  assert.equal(actualTargetModule.validateHttpsTarget(''),null,'empty optional target remains empty');
  assert.throws(()=>actualTargetModule.validateHttpsTarget('http://example.com'),/HTTPS/,'HTTP targets are rejected');
  assert.throws(()=>actualTargetModule.validateHttpsTarget('https://127.0.0.1'),/IP-literal/,'IP-literal targets are rejected');
  console.log('Computer runtime tests passed (credential gate, HTTPS-only target, role gate, origin block, screenshot, audit and rate limit).');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
