'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
const encKey = Buffer.alloc(32, 17);
process.env.WHILO_CONNECTOR_ENCRYPTION_KEY = encKey.toString('base64');

const userId = '90f810b3-9f8c-4113-97ae-120e4e18912f';
const orgId = '44a6b54e-53f6-43d8-bb59-43f3b281f0ce';
const apiKeys = { 'openai-api':'sk-test-provider-key-1234567890', 'gemini-api':'AIza-test-provider-key-1234567890' };
let throttleNextOpenAI = false;
const requests = [];

function response(status, data) {
  const raw = typeof data === 'string' ? data : JSON.stringify(data);
  return { status, ok: status >= 200 && status < 300, async json(){ return JSON.parse(raw); }, async text(){ return raw; } };
}
function encrypted(provider) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify({ kind:provider === 'gemini-api'?'gemini_api_key':'openai_api_key', apiKey:apiKeys[provider] })),cipher.final()]);
  return { id:'key-row', encrypted_payload:payload.toString('base64'), encryption_iv:iv.toString('base64'), encryption_tag:cipher.getAuthTag().toString('base64') };
}
global.fetch = async function(url, options) {
  const parsed = new URL(String(url));
  const method = String(options && options.method || 'GET').toUpperCase();
  requests.push({url:parsed.toString(),method,headers:options&&options.headers||{},body:options&&options.body||''});
  if (parsed.hostname === 'test-project.supabase.co' && parsed.pathname === '/auth/v1/user') {
    return response(200,{id:userId,email:'owner@example.com',user_metadata:{},app_metadata:{}});
  }
  if (parsed.hostname === 'test-project.supabase.co' && parsed.pathname === '/rest/v1/organization_members') {
    return response(200,[{organization_id:orgId,role:'owner'}]);
  }
  if (parsed.hostname === 'test-project.supabase.co' && parsed.pathname === '/rest/v1/integration_connections') {
    const q = parsed.searchParams.get('provider') || '';
    const provider = q.replace(/^eq\./,'');
    return response(200,apiKeys[provider] ? [encrypted(provider)] : []);
  }
  if (parsed.hostname === 'test-project.supabase.co' && parsed.pathname === '/rest/v1/audit_events') return response(201,[]);
  if (parsed.hostname === 'api.openai.com' && parsed.pathname === '/v1/models' && method === 'GET') {
    assert.equal(options.headers.Authorization,'Bearer '+apiKeys['openai-api']);
    return response(200,{data:[{id:'gpt-test-model'}]});
  }
  if (parsed.hostname === 'generativelanguage.googleapis.com' && parsed.pathname === '/v1beta/models' && method === 'GET') {
    assert.equal(options.headers['x-goog-api-key'],apiKeys['gemini-api']);
    return response(200,{models:[{name:'models/gemini-test-model',displayName:'Gemini Test',supportedGenerationMethods:['generateContent'],inputTokenLimit:8192,outputTokenLimit:1024}]});
  }
  if (parsed.hostname === 'api.openai.com' && parsed.pathname === '/v1/responses' && method === 'POST') {
    assert.equal(options.headers.Authorization,'Bearer '+apiKeys['openai-api']);
    const body=JSON.parse(options.body);
    assert.equal(body.store,false);
    assert.ok(body.max_output_tokens <= 2048);
    if (throttleNextOpenAI) { throttleNextOpenAI=false; return response(429,{error:{message:'Rate limit exceeded'}}); }
    return response(200,{status:'completed',output_text:'OpenAI test response',usage:{input_tokens:14,output_tokens:6,total_tokens:20}});
  }
  if (parsed.hostname === 'generativelanguage.googleapis.com' && /:generateContent$/.test(parsed.pathname) && method === 'POST') {
    assert.equal(options.headers['x-goog-api-key'],apiKeys['gemini-api']);
    assert.ok(parsed.pathname.includes('/models/gemini-test-model:generateContent'));
    return response(200,{candidates:[{finishReason:'STOP',content:{parts:[{text:'Gemini test response'}]}}],usageMetadata:{promptTokenCount:8,candidatesTokenCount:5,totalTokenCount:13}});
  }
  throw new Error('Unexpected outbound request in test: '+method+' '+parsed.toString());
};

function makeRes() {
  return { statusCode:0, headers:{}, body:'', setHeader(k,v){this.headers[k]=v;}, end(v){this.body=String(v||'');} };
}
async function invoke(handler, method, url, body) {
  const res=makeRes();
  const req={method,url,headers:{authorization:'Bearer test-session'},body};
  await handler(req,res);
  return {status:res.statusCode,data:JSON.parse(res.body)};
}
async function main() {
  const handler=require('../web/whilo-swas/server/routes/model-gateway');
  const openModels=await invoke(handler,'GET','/api/model-gateway?provider=openai-api');
  assert.equal(openModels.status,200);
  assert.equal(openModels.data.models[0].id,'gpt-test-model');
  assert.equal(openModels.data.billingMode,'provider_direct');

  const openRun=await invoke(handler,'POST','/api/model-gateway',{provider:'openai-api',model:'gpt-test-model',prompt:'Summarize this text',maxOutputTokens:5000});
  assert.equal(openRun.status,200);
  assert.equal(openRun.data.text,'OpenAI test response');
  assert.equal(openRun.data.usage.totalTokens,20);
  assert.ok(!JSON.stringify(openRun.data).includes(apiKeys['openai-api']));

  const geminiModels=await invoke(handler,'GET','/api/model-gateway?provider=gemini-api');
  assert.equal(geminiModels.status,200);
  assert.equal(geminiModels.data.models[0].id,'models/gemini-test-model');
  const geminiRun=await invoke(handler,'POST','/api/model-gateway',{provider:'gemini-api',model:'models/gemini-test-model',prompt:'Summarize this text'});
  assert.equal(geminiRun.status,200);
  assert.equal(geminiRun.data.text,'Gemini test response');
  assert.ok(!JSON.stringify(geminiRun.data).includes(apiKeys['gemini-api']));

  throttleNextOpenAI=true;
  const rateLimited=await invoke(handler,'POST','/api/model-gateway',{provider:'openai-api',model:'gpt-test-model',prompt:'Try again'});
  assert.equal(rateLimited.status,429);
  assert.equal(rateLimited.data.code,'provider_quota_or_rate_limit');

  const unknown=await invoke(handler,'GET','/api/model-gateway?provider=antigravity');
  assert.equal(unknown.status,400);
  const invalidModel=await invoke(handler,'POST','/api/model-gateway',{provider:'gemini-api',model:'models/not-in-live-catalog',prompt:'no'});
  assert.equal(invalidModel.status,400);
  assert.ok(requests.every(r=>!r.url.includes(apiKeys['openai-api'])&&!r.url.includes(apiKeys['gemini-api'])));
  console.log('BYOK model gateway tests passed (OpenAI API, Gemini API, live catalog, no-store, quota errors and key redaction).');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
