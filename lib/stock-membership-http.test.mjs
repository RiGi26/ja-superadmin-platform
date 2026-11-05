import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, dependencies) {
  const sandboxModule = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: sandboxModule, exports: sandboxModule.exports, Buffer, AbortSignal, TextDecoder, URL,
    JSON, Promise, Uint8Array, Number, Error, RegExp, Response, setTimeout, process: { env: {} },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), 'Unexpected offline dependency: ' + name)
      return dependencies[name]
    },
  })
  return sandboxModule.exports
}

const active = { ACTIVE_CORE_ORIGIN: 'https://hub.webzoka.com' }
const calls = []
let enabled = false
let preparationEnabled = false
let invitationEnabled = false
let result = { status: 'blocked' }
const api = load('./stock-membership-http.ts', {
  'server-only': {}, 'next/server': { NextResponse: { json(body, options) {
    return { body, status: options.status, headers: options.headers }
  } } },
  '@/lib/stock-active-protocol': active,
  '@/lib/stock-membership-authorize': { async authorizeStockMembershipRequest(input, token) {
    calls.push({ input, token }); return result
  } },
  '@/lib/stock-operator-protocol': { get STOCK_OPERATOR_INVITATION_ENABLED() { return invitationEnabled } },
  '@/lib/stock-operator-confirm': { async confirmStockOperatorActivation(input,token,coreToken) {calls.push({input,token,coreToken});return result} },
  '@/lib/stock-operator-claim': {
    async claimStockOperatorInvitation(input,token,coreToken) { calls.push({input,token,coreToken}); return result },
    async commitStockOperatorInvitation(input,token,coreToken) { calls.push({input,token,coreToken}); return result },
  },
  '@/lib/stock-membership-select': { async selectStockMembershipSession(input, token, coreToken) {
    calls.push({input,token,coreToken}); return result
  } },
  '@/lib/stock-membership-prepare': { async prepareStockMembershipOwner(input, token, coreToken) {
    calls.push({input,token,coreToken}); return result
  }, async confirmStockMembershipOwner(input,token,coreToken){calls.push({input,token,coreToken});return result} },
  '@/lib/stock-membership-protocol': { get STOCK_MEMBERSHIP_RUNTIME_ENABLED() { return enabled },
    get STOCK_MEMBERSHIP_PREPARATION_ENABLED() { return preparationEnabled } },
})

const valid = { version: 2, companyId: '82000000-0000-4000-8000-000000000001',
  instanceId: '82000000-0000-4000-8000-000000000002', stockTenantId: '82000000-0000-4000-8000-000000000003',
  profileId: '82000000-0000-4000-8000-000000000004', membershipId: '82000000-0000-4000-8000-000000000005',
  membershipRevision: 2, selectionRevision: 3, role: 'staff',
  stockSubject: '82000000-0000-4000-8000-000000000006', stockSessionId: '82000000-0000-4000-8000-000000000007',
  method: 'GET', path: '/orders', nonce: '82000000-0000-4000-8000-000000000008' }

function request({ url = active.ACTIVE_CORE_ORIGIN + '/api/stock/membership/authorize', method = 'POST',
  headers = {}, body = JSON.stringify(valid) } = {}) {
  const bytes = new TextEncoder().encode(body ?? '')
  const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } })
  const normalized = new Map(Object.entries({ authorization: 'Bearer eyJhbGci.eyJzdWI.eyJzaWQ',
    'content-type': 'application/json', 'content-length': String(bytes.byteLength), ...headers })
    .map(([key, value]) => [key.toLowerCase(), value]))
  return { url, method, body: body === null ? null : stream, headers: { get: key => normalized.get(key.toLowerCase()) ?? null,
    has: key => normalized.has(key.toLowerCase()) } }
}

test('closed v2 receiver returns not found before parsing or identity/network effects', async () => {
  enabled = false; calls.length = 0
  const response = await api.handleStockMembershipCoreRequest(request({ body: '{' }))
  assert.equal(response.status, 404); assert.deepEqual(calls, [])
  assert.match(response.headers['Cache-Control'], /no-store/)
})

test('inactive preparation has an independent gate and requires dual native transport', async () => {
  enabled=true;preparationEnabled=false;calls.length=0
  const base={url:active.ACTIVE_CORE_ORIGIN+'/api/stock/membership/prepare',
    headers:{'x-webzoka-core-provider':'core.native.token'}}
  assert.equal((await api.handleStockMembershipCoreRequest(request(base),'prepare')).status,404)
  assert.deepEqual(calls,[])
  enabled=false;preparationEnabled=true
  for(const options of [{headers:{}},{headers:{...base.headers,cookie:''}},
    {headers:{...base.headers,origin:active.ACTIVE_CORE_ORIGIN}}, {body:'{'},
    {url:active.ACTIVE_CORE_ORIGIN+'/api/stock/membership/select'}]) {
    assert.equal((await api.handleStockMembershipCoreRequest(request({...base,...options}),'prepare')).status,403)
  }
  assert.deepEqual(calls,[])
  result={status:'prepared',receipt:{accessGranted:false}}
  const response=await api.handleStockMembershipCoreRequest(request(base),'prepare')
  assert.equal(response.status,200);assert.deepEqual(response.body,result)
  assert.equal(calls.length,1);assert.equal(calls[0].coreToken,'core.native.token')
  assert.match(response.headers.Vary,/X-Webzoka-Core-Provider/)
  result={status:'unconfirmed'}
  assert.equal((await api.handleStockMembershipCoreRequest(request(base),'prepare')).status,503)
  preparationEnabled=false
})

function head(options = {}) {
  return request({ method: 'HEAD', body: null, ...options, headers: {
    'x-webzoka-stock-request': Buffer.from(JSON.stringify(valid)).toString('base64url'), ...options.headers,
  } })
}
test('closed database transport denies before parsing or authority lookup', async () => {
  enabled=false; calls.length=0
  const response=await api.handleStockMembershipCoreHead(head({headers:{'x-webzoka-stock-request':'!'}}))
  assert.equal(response.status,404); assert.equal(await response.text(),''); assert.deepEqual(calls,[])
})
test('database transport returns only bounded decision header and never a body', async () => {
  enabled=true; calls.length=0
  const decision={...valid,bindingId:'82000000-0000-4000-8000-000000000009'}
  result={status:'authorized',decision}
  const response=await api.handleStockMembershipCoreHead(head())
  assert.equal(response.status,200); assert.equal(await response.text(),'')
  assert.deepEqual(JSON.parse(Buffer.from(response.headers.get('x-webzoka-stock-decision'),'base64url').toString()),decision)
  assert.match(response.headers.get('vary'),/X-Webzoka-Stock-Request/)
  assert.match(response.headers.get('cache-control'),/no-store/)
  assert.equal(calls.length,1); assert.deepEqual(calls[0].input,valid)
})
test('database transport rejects malformed encoding, body, origin, cookies and target before adapter', async () => {
  enabled=true; calls.length=0
  for (const options of [
    {method:'POST'}, {body:'{}'}, {headers:{'content-length':'1'}},
    {headers:{cookie:''}}, {headers:{origin:'https://hub.webzoka.com'}},
    {url:active.ACTIVE_CORE_ORIGIN+'/api/stock/active/authorize'},
    {url:active.ACTIVE_CORE_ORIGIN+'/api/stock/membership/authorize?plan=pro'},
    {url:'https://foreign.example/api/stock/membership/authorize'},
    {headers:{authorization:'Bearer invalid'}},
    ...['','!','e30=', 'A'.repeat(2732),Buffer.from('{').toString('base64url'),
      Buffer.from([0xff]).toString('base64url')].map(value=>({headers:{'x-webzoka-stock-request':value}})),
  ]) {
    const response=await api.handleStockMembershipCoreHead(head(options))
    assert.equal(response.status,403); assert.equal(response.headers.get('x-webzoka-stock-decision'),null)
  }
  assert.deepEqual(calls,[])
})
test('database transport strips denied, blocked and oversized decisions', async () => {
  enabled=true
  for (const [next,status] of [[{status:'denied'},403],[{status:'blocked'},503],
    [{status:'authorized',decision:{data:'x'.repeat(3073)}},403]]) {
    result=next
    const response=await api.handleStockMembershipCoreHead(head())
    assert.equal(response.status,status); assert.equal(response.headers.get('x-webzoka-stock-decision'),null)
  }
})

test('receiver rejects browser, cookie, wrong method/path/origin and malformed credentials before adapter', async () => {
  enabled = true; calls.length = 0
  for (const options of [
    { method: 'GET' }, { url: active.ACTIVE_CORE_ORIGIN + '/api/stock/active/authorize' },
    { url: 'https://foreign.example/api/stock/membership/authorize' },
    { url: active.ACTIVE_CORE_ORIGIN + '/api/stock/membership/authorize?x=1' },
    { headers: { cookie: 'session=ignored' } }, { headers: { origin: 'https://evil.example' } },
    { headers: { authorization: 'Bearer invalid' } }, { headers: { 'content-type': 'text/plain' } },
    { headers: { 'content-length': '2049' } }, { body: '{' },
  ]) assert.equal((await api.handleStockMembershipCoreRequest(request(options))).status, 403)
  assert.deepEqual(calls, [])
})

test('valid native transport reaches the current authority adapter without leaking credentials', async () => {
  enabled = true; calls.length = 0
  const decision = { version: 2, ...valid, bindingId: '82000000-0000-4000-8000-000000000009' }
  result = { status: 'authorized', decision }
  const response = await api.handleStockMembershipCoreRequest(request())
  assert.equal(response.status, 200); assert.deepEqual(response.body, decision)
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].input, valid)
  assert.equal(calls[0].token, 'eyJhbGci.eyJzdWI.eyJzaWQ')
  assert.match(response.headers.Vary, /Authorization/)
})

test('blocked or denied adapter responses never disclose diagnostics or a decision', async () => {
  enabled = true
  for (const [next, status] of [[{ status: 'blocked' }, 503], [{ status: 'denied' }, 403]]) {
    result = next
    const response = await api.handleStockMembershipCoreRequest(request())
    assert.equal(response.status, status); assert.equal(JSON.stringify(response.body), '{"status":"denied"}')
  }
})

test('selection endpoint requires both explicit native credentials and exact target', async () => {
  enabled=true;calls.length=0
  const base={url:active.ACTIVE_CORE_ORIGIN+'/api/stock/membership/select',
    body:JSON.stringify({companyId:valid.companyId,instanceId:valid.instanceId,
      commandId:valid.nonce,expectedRevision:0})}
  for(const headers of [{},{'x-webzoka-core-provider':'invalid'},
    {'x-webzoka-core-provider':'core.native.token',cookie:'session=x'},
    {'x-webzoka-core-provider':'core.native.token',origin:active.ACTIVE_CORE_ORIGIN}]){
    assert.equal((await api.handleStockMembershipCoreRequest(request({...base,headers}),'select')).status,403)
  }
  assert.deepEqual(calls,[])
  result={status:'selected',decision:valid}
  const response=await api.handleStockMembershipCoreRequest(request({...base,
    headers:{'x-webzoka-core-provider':'core.native.token'}}),'select')
  assert.equal(response.status,200);assert.equal(response.body.status,'selected')
  assert.equal(calls.length,1);assert.equal(calls[0].coreToken,'core.native.token')
  assert.match(response.headers.Vary,/X-Webzoka-Core-Provider/)
})
test('selection transport preserves unconfirmed state and remains closed before effects', async () => {
  enabled=true;calls.length=0
  const selected=request({url:active.ACTIVE_CORE_ORIGIN+'/api/stock/membership/select',
    headers:{'x-webzoka-core-provider':'core.native.token'}})
  result={status:'unconfirmed'}
  const response=await api.handleStockMembershipCoreRequest(selected,'select')
  assert.equal(response.status,503);assert.equal(response.body.status,'unconfirmed')
  enabled=false;calls.length=0
  assert.equal((await api.handleStockMembershipCoreRequest(request({body:'{'}),'select')).status,404)
  assert.deepEqual(calls,[])
})

test('operator claim receiver requires both native credentials and rejects browser transport', async () => {
  enabled=true;invitationEnabled=false;calls.length=0
  const base={url:active.ACTIVE_CORE_ORIGIN+'/api/stock/membership/claim',
    headers:{'x-webzoka-core-provider':'core.native.token'}}
  assert.equal((await api.handleStockMembershipCoreRequest(request(base),'claim')).status,404)
  assert.deepEqual(calls,[])
  invitationEnabled=true
  for(const variant of [{headers:{}},{headers:{...base.headers,origin:active.ACTIVE_CORE_ORIGIN}},
    {headers:{...base.headers,cookie:''}},{url:base.url+'?secret=bad'},{body:'{'}]) {
    assert.equal((await api.handleStockMembershipCoreRequest(request({...base,...variant}),'claim')).status,403)
  }
  assert.deepEqual(calls,[])
  const input={inviteId:valid.nonce,proof:'a'.repeat(64)}
  result={status:'claimed',accessGranted:false}
  const accepted=await api.handleStockMembershipCoreRequest(request({...base,body:JSON.stringify(input)}),'claim')
  assert.equal(accepted.status,200)
  assert.equal(accepted.body.accessGranted,false)
  assert.equal(calls.length,1)
  assert.deepEqual(calls[0].input,input)
  invitationEnabled=false
})


test('activation confirmation uses only the pinned dual-native transport and remains available when new invitations close',async()=>{
  enabled=false;invitationEnabled=false;calls.length=0
  const input={inviteId:valid.companyId}
  const base={url:active.ACTIVE_CORE_ORIGIN+'/api/stock/membership/operator-confirm',
    headers:{'x-webzoka-core-provider':'core.native.token'},body:JSON.stringify(input)}
  assert.equal((await api.handleStockMembershipCoreRequest(request(base),'operator-confirm')).status,404)
  assert.deepEqual(calls,[])
  enabled=true
  for(const variant of [{headers:{}},{headers:{...base.headers,cookie:''}},
    {headers:{...base.headers,origin:active.ACTIVE_CORE_ORIGIN}},
    {url:'https://foreign.test/api/stock/membership/operator-confirm'},
    {url:base.url+'?inviteId=foreign'},{body:'{'}]) {
    assert.equal((await api.handleStockMembershipCoreRequest(request({...base,...variant}),'operator-confirm')).status,403)
  }
  assert.deepEqual(calls,[])
  for(const status of ['confirmed','not_active']) {
    result={status}
    assert.equal((await api.handleStockMembershipCoreRequest(request(base),'operator-confirm')).status,200)
    assert.deepEqual(calls.at(-1),{input,token:'eyJhbGci.eyJzdWI.eyJzaWQ',coreToken:'core.native.token'})
  }
})
