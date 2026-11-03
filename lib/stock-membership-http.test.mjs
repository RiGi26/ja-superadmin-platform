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
    JSON, Promise, Uint8Array, Number, Error, RegExp, setTimeout, process: { env: {} },
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
let result = { status: 'blocked' }
const api = load('./stock-membership-http.ts', {
  'server-only': {}, 'next/server': { NextResponse: { json(body, options) {
    return { body, status: options.status, headers: options.headers }
  } } },
  '@/lib/stock-active-protocol': active,
  '@/lib/stock-membership-authorize': { async authorizeStockMembershipRequest(input, token) {
    calls.push({ input, token }); return result
  } },
  '@/lib/stock-membership-protocol': { get STOCK_MEMBERSHIP_RUNTIME_ENABLED() { return enabled } },
})

const valid = { version: 2, companyId: '82000000-0000-4000-8000-000000000001',
  instanceId: '82000000-0000-4000-8000-000000000002', stockTenantId: '82000000-0000-4000-8000-000000000003',
  profileId: '82000000-0000-4000-8000-000000000004', membershipId: '82000000-0000-4000-8000-000000000005',
  membershipRevision: 2, selectionRevision: 3, role: 'staff',
  stockSubject: '82000000-0000-4000-8000-000000000006', stockSessionId: '82000000-0000-4000-8000-000000000007',
  method: 'GET', path: '/orders', nonce: '82000000-0000-4000-8000-000000000008' }

function request({ url = active.ACTIVE_CORE_ORIGIN + '/api/stock/membership/authorize', method = 'POST',
  headers = {}, body = JSON.stringify(valid) } = {}) {
  const bytes = new TextEncoder().encode(body)
  const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } })
  const normalized = new Map(Object.entries({ authorization: 'Bearer eyJhbGci.eyJzdWI.eyJzaWQ',
    'content-type': 'application/json', 'content-length': String(bytes.byteLength), ...headers })
    .map(([key, value]) => [key.toLowerCase(), value]))
  return { url, method, body: stream, headers: { get: key => normalized.get(key.toLowerCase()) ?? null,
    has: key => normalized.has(key.toLowerCase()) } }
}

test('closed v2 receiver returns not found before parsing or identity/network effects', async () => {
  enabled = false; calls.length = 0
  const response = await api.handleStockMembershipCoreRequest(request({ body: '{' }))
  assert.equal(response.status, 404); assert.deepEqual(calls, [])
  assert.match(response.headers['Cache-Control'], /no-store/)
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
