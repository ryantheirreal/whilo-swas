'use strict';
const { send, authenticate, organizationFor, db, readJson, decryptPayload, audit, safeError } = require('../../api/_lib/platform');

const cache = new Map();
const TTL = 60_000;
function fail(statusCode, code, message) { const e = new Error(message); e.statusCode = statusCode; e.publicCode = code; throw e; }
function providerName(value) {
  if (['gemini-api','openai-api','anthropic-api','openrouter-api'].includes(value)) return value;
  fail(400, 'unsupported_provider', 'Choose Gemini, OpenAI, Anthropic or OpenRouter Developer API.');
}
async function connection(org, provider) {
  const rows = await db('integration_connections?organization_id=eq.' + encodeURIComponent(org) + '&provider=eq.' + provider + '&status=eq.connected&select=id,encrypted_payload,encryption_iv,encryption_tag&limit=1');
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) fail(409, 'provider_not_connected', 'Connect this provider in Whilo Connect first. Google or ChatGPT identity sign-in does not include API usage.');
  const secret = decryptPayload(row);
  const kind = ({'gemini-api':'gemini_api_key','openai-api':'openai_api_key','anthropic-api':'anthropic_api_key','openrouter-api':'openrouter_api_key'})[provider];
  if (!secret || secret.kind !== kind || typeof secret.apiKey !== 'string') fail(503, 'invalid_provider_connection', 'The stored API connection is invalid. Disconnect and reconnect it.');
  return { row, key: secret.apiKey };
}
async function requestJson(url, options, provider, timeoutMs) {
  let response;
  try { response = await fetch(url, Object.assign({ cache: 'no-store', signal: AbortSignal.timeout(timeoutMs || 20_000) }, options)); }
  catch (_) { fail(502, 'provider_unreachable', provider + ' could not be reached. Try again.'); }
  let data = {};
  try { data = await response.json(); } catch (_) { fail(502, 'provider_bad_response', provider + ' returned an unreadable response.'); }
  if (!response.ok) {
    const providerErrorText = String(data && data.error && (data.error.message || data.error.status) || data && data.message || '').toLowerCase();
    if (response.status === 429 || /quota|rate.?limit|resource_exhausted|billing limit/.test(providerErrorText)) fail(429, 'provider_quota_or_rate_limit', provider + ' is rate-limited or its API quota/billing limit was reached. Check its official usage and billing console.');
    if (response.status === 401 || response.status === 403) fail(424, 'provider_key_rejected', provider + ' rejected this key or the key lacks API/billing permission. Reconnect it or check provider access.');
    fail(502, 'provider_request_failed', provider + ' could not complete this request. Check the selected model and API access.');
  }
  return data;
}
async function models(org, provider) {
  const key = org + ':' + provider;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.list;
  const stored = await connection(org, provider);
  let data;
  if (provider === 'gemini-api') {
    data = await requestJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', { headers: { 'x-goog-api-key': stored.key, Accept: 'application/json' } }, 'Gemini');
  } else if (provider === 'openai-api') {
    data = await requestJson('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + stored.key, Accept: 'application/json' } }, 'OpenAI');
  } else if (provider === 'anthropic-api') {
    data = await requestJson('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': stored.key, 'anthropic-version': '2023-06-01', Accept: 'application/json' } }, 'Anthropic');
  } else {
    data = await requestJson('https://openrouter.ai/api/v1/models?output_modalities=text', { headers: { Authorization: 'Bearer ' + stored.key, Accept: 'application/json', 'HTTP-Referer': 'https://whilo-swas.vercel.app', 'X-Title': 'Whilo' } }, 'OpenRouter');
  }
  let list;
  if (provider === 'gemini-api') {
    list = (Array.isArray(data.models) ? data.models : []).filter(m => m && /^models\/[A-Za-z0-9._-]{1,100}$/.test(m.name || '') && Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent')).map(m => ({ id:m.name, name:String(m.displayName || m.name).slice(0,100), inputTokens:Number(m.inputTokenLimit)||null, outputTokens:Number(m.outputTokenLimit)||null }));
  } else if (provider === 'anthropic-api') {
    list = (Array.isArray(data.data) ? data.data : []).filter(m => m && /^[A-Za-z0-9._:-]{1,150}$/.test(m.id || '')).map(m => ({ id:m.id, name:String(m.display_name || m.id).slice(0,120), inputTokens:Number(m.max_input_tokens)||null, outputTokens:Number(m.max_output_tokens)||null }));
  } else if (provider === 'openrouter-api') {
    list = (Array.isArray(data.data) ? data.data : []).filter(m => m && /^[A-Za-z0-9._:/-]{1,200}$/.test(m.id || '') && (!m.architecture || !Array.isArray(m.architecture.output_modalities) || m.architecture.output_modalities.includes('text'))).map(m => ({ id:m.id, name:String(m.name || m.id).slice(0,140), inputTokens:Number(m.context_length)||null, outputTokens:Number(m.top_provider && m.top_provider.max_completion_tokens)||null }));
  } else {
    list = (Array.isArray(data.data) ? data.data : []).filter(m => m && /^[A-Za-z0-9._:-]{1,150}$/.test(m.id || '')).map(m => ({ id:m.id, name:m.id }));
  }
  const bounded = list.slice(0, 200);
  cache.set(key, { list:bounded, exp:Date.now()+TTL });
  return bounded;
}
function openAIText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  const out=[];
  for (const item of Array.isArray(data.output) ? data.output : []) for (const part of item && Array.isArray(item.content) ? item.content : []) if (part && part.type === 'output_text' && typeof part.text === 'string') out.push(part.text);
  return out.join('\n');
}
async function generate(stored, provider, model, prompt, system, maxTokens) {
  if (provider === 'openai-api') {
    const input=[];
    if (system) input.push({role:'system',content:system});
    input.push({role:'user',content:prompt});
    const data=await requestJson('https://api.openai.com/v1/responses', {
      method:'POST', headers:{Authorization:'Bearer '+stored.key,'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({model,input,max_output_tokens:maxTokens,store:false})
    },'OpenAI',60_000);
    const u=data.usage||{};
    return {text:openAIText(data),usage:{inputTokens:Number(u.input_tokens)||0,outputTokens:Number(u.output_tokens)||0,totalTokens:Number(u.total_tokens)||0},finishReason:data.status||null};
  }
  if (provider === 'anthropic-api') {
    const body = { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] };
    if (system) body.system = system;
    const data = await requestJson('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'x-api-key':stored.key,'anthropic-version':'2023-06-01','Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify(body)
    },'Anthropic',60_000);
    const text=(Array.isArray(data.content)?data.content:[]).filter(part=>part&&part.type==='text'&&typeof part.text==='string').map(part=>part.text).join('\n');
    const u=data.usage||{};
    const inputTokens=Number(u.input_tokens)||0, outputTokens=Number(u.output_tokens)||0;
    return {text,usage:{inputTokens,outputTokens,totalTokens:inputTokens+outputTokens},finishReason:data.stop_reason||null};
  }
  if (provider === 'openrouter-api') {
    if (!/^[A-Za-z0-9._:/-]{1,200}$/.test(model)) fail(400,'invalid_model','That OpenRouter model identifier is invalid.');
    const messages=[];
    if (system) messages.push({role:'system',content:system});
    messages.push({role:'user',content:prompt});
    const data=await requestJson('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST',
      headers:{Authorization:'Bearer '+stored.key,'Content-Type':'application/json',Accept:'application/json','HTTP-Referer':'https://whilo-swas.vercel.app','X-Title':'Whilo'},
      body:JSON.stringify({model,messages,max_tokens:maxTokens,stream:false})
    },'OpenRouter',60_000);
    const choice=(Array.isArray(data.choices)?data.choices:[])[0]||{};
    const content=choice.message&&choice.message.content;
    const text=typeof content==='string'?content:(Array.isArray(content)?content.filter(part=>part&&part.type==='text'&&typeof part.text==='string').map(part=>part.text).join('\n'):'');
    const u=data.usage||{};
    return {text,usage:{inputTokens:Number(u.prompt_tokens)||0,outputTokens:Number(u.completion_tokens)||0,totalTokens:Number(u.total_tokens)||(Number(u.prompt_tokens)||0)+(Number(u.completion_tokens)||0)},finishReason:choice.finish_reason||null};
  }
  const modelId = model.slice('models/'.length);
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(modelId)) fail(400,'invalid_model','That Gemini model identifier is invalid.');
  const contents=[{role:'user',parts:[{text:prompt}]}];
  const body={contents,generationConfig:{maxOutputTokens:maxTokens,temperature:0.2}};
  if(system) body.systemInstruction={parts:[{text:system}]};
  const data=await requestJson('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(modelId)+':generateContent',{
    method:'POST',headers:{'x-goog-api-key':stored.key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)
  },'Gemini',60_000);
  const candidate=(Array.isArray(data.candidates)?data.candidates:[])[0]||{};
  const text=(candidate.content&&Array.isArray(candidate.content.parts)?candidate.content.parts:[]).map(p=>p&&typeof p.text==='string'?p.text:'').filter(Boolean).join('\n');
  const u=data.usageMetadata||{};
  return {text,usage:{inputTokens:Number(u.promptTokenCount)||0,outputTokens:Number(u.candidatesTokenCount)||0,totalTokens:Number(u.totalTokenCount)||0},finishReason:candidate.finishReason||null};
}
module.exports=async function(req,res){
  if(req.method!=='GET'&&req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(res,405,{error:'Method not allowed'});}
  try{
    const user=await authenticate(req);
    const member=await organizationFor(user);
    if(req.method==='GET'){
      const provider=providerName(new URL(req.url,'https://whilo.invalid').searchParams.get('provider'));
      const list=await models(member.organization_id,provider);
      return send(res,200,{provider,billingMode:'provider_direct',authMode:'bring_your_own_api_key',models:list,usageNote:'Provider usage and API quotas are billed by the connected API account; identity login does not grant consumer-plan inference.'});
    }
    const body=await readJson(req,32000);
    const provider=providerName(body.provider);
    const model=String(body.model||'').trim().slice(0,160);
    const prompt=String(body.prompt||'');
    const system=String(body.system||'').trim().slice(0,4000);
    const maxTokens=Number.isFinite(Number(body.maxOutputTokens))?Math.max(1,Math.min(2048,Math.floor(Number(body.maxOutputTokens)))):1024;
    if(!prompt.trim()||prompt.length>15000) return send(res,400,{error:'Enter a prompt up to 15,000 characters.',code:'invalid_prompt'});
    if(!model) return send(res,400,{error:'Choose a model from the live provider model list.',code:'model_required'});
    const list=await models(member.organization_id,provider);
    if(!list.some(m=>m.id===model)) return send(res,400,{error:'That model is not available for this connected API key. Refresh the model list.',code:'model_not_available'});
    const stored=await connection(member.organization_id,provider);
    const result=await generate(stored,provider,model,prompt,system,maxTokens);
    await audit(member.organization_id,user.id,'model.request_completed','model_provider',provider,'success',{provider,model,input_tokens:result.usage.inputTokens,output_tokens:result.usage.outputTokens,billing_mode:'provider_direct'});
    return send(res,200,{ok:true,provider,model,text:result.text,usage:result.usage,finishReason:result.finishReason,billingMode:'provider_direct'});
  }catch(error){
    if(error&&error.statusCode) return send(res,error.statusCode,{error:error.statusCode>=500&&!error.publicCode?'The model request could not be completed safely.':error.message,code:error.publicCode||'model_gateway_error'});
    return safeError(res,error);
  }
};
