// Offline protocol/real-SDK verification. This is not a live binding or DB/RLS acceptance test.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const request = { stockSubject: id(1), stockSessionId: id(2), method: 'GET', path: '/orders', nonce: id(3) }
const now = Date.now()
const decision = { ...request, version: 1, companyId: id(4), instanceId: id(5), bindingId: id(6),
  coreSubject: id(7), coreSessionId: id(8), coreTenantId: id(9), stockTenantId: id(10),
  companyRevision: 3, bindingRevision: 2, issuedAt: now, expiresAt: now + 5000 }

function load(file, dependencies = {}, env = {}, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const sandboxModule = { exports: {} }
  vm.runInNewContext(compiled, { module: sandboxModule, exports: sandboxModule.exports,
    Date, Set, Object, Number, URL, Buffer, AbortSignal, Request, Response, TextDecoder,
    crypto: webcrypto, process: { env }, ...globals,
    require(name) {
      if (name === '@/lib/stock-purchase-policy' && !Object.hasOwn(dependencies, name)) return { STOCK_PAID_BILLING_RUNTIME_ENABLED: false }
      if (name === '@/lib/stock-paid-session' && !Object.hasOwn(dependencies, name)) return { paidStockSessionAuthority: async () => ({ kind: 'legacy' }) }
      assert.ok(Object.hasOwn(dependencies, name), 'Unexpected import: ' + name); return dependencies[name]
    },
  })
  return sandboxModule.exports
}
const protocol = load('./stock-active-protocol.ts')

function enrollmentHarness(options = {}) {
  const calls = []
  const core = { customer: true, subject: id(7), session: id(8), until: new Date(Date.now() + 20000).toISOString() }
  const stock = { stockSubject: id(1), stockSessionId: id(2), coreSubject: options.wrongSubject ? id(99) : id(7), until: Date.now() + 20000 }
  const authority = { bindingId: id(6), bindingRevision: 0, companyId: id(4), companyRevision: 0,
    coreSessionId: id(8), coreSubject: id(7), coreTenantId: id(9), instanceId: id(5), stockTenantId: id(10) }
  const client = { auth: { getClaims: async () => ({ data: { claims: { sub: id(7), session_id: id(8),
    client_id: protocol.ACTIVE_STOCK_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 300 } }, error: null }) } }
  const api = load('./stock-active-enroll.ts', {
    'server-only': {}, '@/lib/stock-active-protocol': protocol,
    '@/lib/stock-active-release': { ACTIVE_STOCK_RUNTIME_ENABLED: options.enabled !== false },
    '@/lib/stock-purchase-policy': { STOCK_PAID_BILLING_RUNTIME_ENABLED: options.paid === true },
    '@/lib/stock-paid-session': { paidStockSessionAuthority: async () => options.paid
      ? { kind: options.paidDenied ? 'denied' : 'paid', data: authority } : { kind: 'legacy' } },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/core-registry-native': { verifyNativeCoreProvider: async () => core },
    '@/lib/stock-active-identity': { verifyStockIdentityForCoreBridge: async () => stock },
    '@/lib/supabase/admin': { createAdminClient() {
      calls.push('admin')
      return { rpc(name, args) {
        calls.push({ name, args: JSON.parse(JSON.stringify(args)) })
        return { async abortSignal() {
          if (options.transport) throw new Error('synthetic lost response')
          return { data: authority, error: null }
        } }
      } }
    } },
  }, { NEXT_PUBLIC_SUPABASE_URL: protocol.ACTIVE_CORE_REALM })
  return { calls, run: input => api.enrollActiveStockSession(input, 'stock.native.signature', 'core.native.signature') }
}

test('native enrollment delegates selector-free resource resolution to authoritative SQL', async () => {
  const h = enrollmentHarness()
  const result = await h.run({ nonce: id(3) })
  assert.equal(result.status, 'enrolled')
  assert.equal(result.decision.companyId, id(4))
  assert.equal(h.calls[1].name, 'core_stock_active_enroll_session')
  assert.equal(h.calls[1].args.p_company, null)
  assert.equal(h.calls[1].args.p_instance, null)
})

test('native enrollment rejects a caller-supplied identity or mismatched native pair before admin use', async () => {
  const h = enrollmentHarness()
  assert.equal((await h.run({ nonce: id(3), coreSubject: id(7) })).status, 'denied')
  assert.deepEqual(h.calls, [])
  const mismatch = enrollmentHarness({ wrongSubject: true })
  assert.equal((await mismatch.run({ nonce: id(3) })).status, 'denied')
  assert.deepEqual(mismatch.calls, [])
})

test('a lost native enrollment response is unconfirmed, never reported as rolled back', async () => {
  assert.equal((await enrollmentHarness({ transport: true }).run({ nonce: id(3) })).status, 'unconfirmed')
})

test('disabled native enrollment performs no authority read or write', async () => {
  const h = enrollmentHarness({ enabled: false })
  assert.equal((await h.run({ nonce: id(3) })).status, 'blocked')
  assert.deepEqual(h.calls, [])
})

test('active Stock gate is independently closed in actual source', () => {
  assert.equal(load('./stock-active-release.ts').ACTIVE_STOCK_RUNTIME_ENABLED, false)
})
test('strict active selector contains no caller identity, role, resource or activation assertion', () => {
  const valid = { companyId: id(4), instanceId: id(5) }
  assert.deepEqual(JSON.parse(JSON.stringify(protocol.parseActiveStockSelector(valid))), valid)
  for (const extra of ['coreSubject', 'stockTenantId', 'isOwner', 'status', 'proof']) {
    assert.throws(() => protocol.parseActiveStockSelector({ ...valid, [extra]: true }))
  }
})
test('exact request and decision are immutable snapshots, not caller-mutable grants', () => {
  const input = { ...decision }
  const parsed = protocol.parseActiveStockDecision(input, request, now)
  input.stockTenantId = id(99)
  assert.equal(parsed.stockTenantId, id(10))
  assert.equal(Object.isFrozen(parsed), true)
})
for (const [field, value] of [
  ['stockSubject', id(99)], ['stockSessionId', id(99)], ['nonce', id(99)], ['method', 'DELETE'],
  ['path', '/rpc/arbitrary'], ['version', 2], ['companyRevision', -1], ['bindingRevision', 1.5],
  ['coreSubject', 'customer@example.invalid'], ['issuedAt', now + 1], ['expiresAt', now],
  ['expiresAt', now + 5001], ['companyId', ''], ['status', 'active'], ['provider_token', 'synthetic'],
]) test(`active decision rejects request/shape/time mismatch: ${field} ${String(value)}`, () => {
  assert.throws(() => protocol.parseActiveStockDecision({ ...decision, [field]: value }, request, now))
})
for (const path of ['/auth/v1/token', '//foreign.invalid', '/orders?tenant=other', '/orders/../secret',
  '/%6frders', '/rpc/', '/rpc/UPPER', '/orders#fragment']) test('active DB path rejects: ' + path, () => {
  assert.throws(() => protocol.parseActiveStockRequest({ ...request, path }))
})
test('OAuth cannot use the local password classification; malformed/unknown methods deny', () => {
  const amr = method => ({ method, timestamp: Math.floor(now / 1000) })
  assert.equal(protocol.activeStockSessionMode([amr('password')]), 'local')
  assert.equal(protocol.activeStockSessionMode([amr('password'), amr('oauth')]), 'federated')
  for (const value of [null, [], [amr('anonymous')], [amr('unknown')], [{ method: 'password' }]]) {
    assert.equal(protocol.activeStockSessionMode(value), 'denied')
  }
})

const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const jwk = { ...await webcrypto.subtle.exportKey('jwk', pair.publicKey), kid: 'offline-active-stock', alg: 'ES256', use: 'sig' }
const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url')
async function token(overrides = {}) {
  const seconds = Math.floor(Date.now() / 1000)
  const body = { iss: protocol.ACTIVE_STOCK_REALM + '/auth/v1', aud: 'authenticated',
    sub: id(1), session_id: id(2), role: 'authenticated', is_anonymous: false,
    iat: seconds - 2, exp: seconds + 120, amr: [{ method: 'oauth', timestamp: seconds - 2 }], ...overrides }
  const signing = encode({ alg: 'ES256', kid: jwk.kid, typ: 'JWT' }) + '.' + encode(body)
  const signature = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, Buffer.from(signing))
  return signing + '.' + Buffer.from(signature).toString('base64url')
}
function identityHarness(changes = {}) {
  const calls = []
  const user = { id: id(1), email: 'synthetic@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z',
    is_anonymous: false, identities: [{ provider: 'custom:webzoka', user_id: id(1), identity_data: { sub: id(7) } }], ...changes }
  const fetch = async input => {
    const url = String(input)
    calls.push(url)
    assert.ok(url.startsWith(protocol.ACTIVE_STOCK_REALM + '/auth/v1/'))
    if (url.endsWith('/.well-known/jwks.json')) return Response.json({ keys: [jwk] })
    if (url.endsWith('/user')) return Response.json(user)
    throw new Error('Unexpected offline Auth request')
  }
  const api = load('./stock-active-identity.ts', { 'server-only': {}, '@supabase/supabase-js': require('@supabase/supabase-js'),
    '@/lib/stock-active-protocol': protocol }, { STOCK_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' }, { fetch })
  return { api, calls }
}
test('real Auth SDK verifies an ES256 native Stock identity; observation carries no bearer', async () => {
  const h = identityHarness()
  const actor = await h.api.verifyStockIdentityForCoreBridge(await token())
  assert.equal(actor.stockSubject, id(1))
  assert.equal(actor.stockSessionId, id(2))
  assert.equal(actor.coreSubject, id(7))
  assert.deepEqual(Object.keys(actor).sort(), ['coreSubject', 'stockSessionId', 'stockSubject', 'until'])
})
for (const claims of [{ iss: 'https://foreign.invalid/auth/v1' }, { aud: 'foreign' }, { client_id: id(88) },
  { session_id: 'missing' }, { sub: id(99) }, { amr: [{ method: 'password', timestamp: 1 }] }]) {
  test('real SDK identity boundary rejects foreign or incompatible claims: ' + JSON.stringify(claims), async () => {
    await assert.rejects(identityHarness().api.verifyStockIdentityForCoreBridge(await token(claims)))
  })
}
test('real SDK identity boundary rejects a tampered ES256 signature', async () => {
  const signed = await token()
  const parts = signed.split('.')
  parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1)
  await assert.rejects(identityHarness().api.verifyStockIdentityForCoreBridge(parts.join('.')))
})
test('unverified or ambiguous native identity cannot be supplied through user metadata', async () => {
  await assert.rejects(identityHarness({ identities: [], user_metadata: { core_user_id: id(7) } })
    .api.verifyStockIdentityForCoreBridge(await token()))
  await assert.rejects(identityHarness({ email_confirmed_at: null }).api.verifyStockIdentityForCoreBridge(await token()))
})

function authorizationHarness({ enabled = true, paid = false, paidDenied = false, actorChange = {}, rowChange = {}, rpcError = null, envChange = {} } = {}) {
  const calls = []
  const actor = { stockSubject: id(1), stockSessionId: id(2), coreSubject: id(7), until: Date.now() + 20_000, ...actorChange }
  const row = Object.fromEntries(['bindingId', 'bindingRevision', 'companyId', 'companyRevision',
    'coreSessionId', 'coreSubject', 'coreTenantId', 'instanceId', 'stockTenantId'].map(name => [name, decision[name]]))
  Object.assign(row, rowChange)
  const api = load('./stock-active-authorize.ts', {
    'server-only': {}, '@/lib/stock-active-protocol': protocol,
    '@/lib/stock-active-release': { ACTIVE_STOCK_RUNTIME_ENABLED: enabled },
    '@/lib/stock-purchase-policy': { STOCK_PAID_BILLING_RUNTIME_ENABLED: paid },
    '@/lib/stock-paid-session': { paidStockSessionAuthority: async () => paid
      ? { kind: paidDenied ? 'denied' : 'paid', data: row } : { kind: 'legacy' } },
    '@/lib/stock-active-identity': { verifyStockIdentityForCoreBridge: async () => { calls.push('identity'); return actor } },
    '@/lib/supabase/admin': { createAdminClient() { calls.push('admin'); return {
      rpc(name, args) { calls.push({ name, args }); return { abortSignal: async () => ({ data: row, error: rpcError }) } },
    } } },
  }, { NEXT_PUBLIC_SUPABASE_URL: protocol.ACTIVE_CORE_REALM, ...envChange })
  return { api, calls }
}

test('paid enrollment uses its independent gate and never dispatches a legacy enrollment', async () => {
  const h = enrollmentHarness({ enabled: false, paid: true })
  assert.equal((await h.run({ nonce: id(3) })).status, 'enrolled')
  assert.deepEqual(h.calls, [])
  const denied = enrollmentHarness({ enabled: true, paid: true, paidDenied: true })
  assert.equal((await denied.run({ nonce: id(3) })).status, 'denied')
  assert.deepEqual(denied.calls, [])
})
test('paid online decisions retain exact protocol checks without fallback after denial', async () => {
  const h = authorizationHarness({ enabled: false, paid: true })
  assert.equal((await h.api.authorizeActiveStockRequest(request, 'synthetic.stock.token')).status, 'authorized')
  assert.deepEqual(h.calls, ['identity'])
  for (const options of [{ paidDenied: true }, { rowChange: { coreSubject: id(99) } }, { rowChange: { arbitrary: true } }]) {
    const denied = authorizationHarness({ enabled: true, paid: true, ...options })
    assert.equal((await denied.api.authorizeActiveStockRequest(request, 'synthetic.stock.token')).status, 'denied')
    assert.deepEqual(denied.calls, ['identity'])
  }
})
test('active authorizer stays blocked before identity/admin construction when the gate or realm is wrong', async () => {
  for (const options of [{ enabled: false }, { envChange: { NEXT_PUBLIC_SUPABASE_URL: 'https://foreign.invalid' } }]) {
    const h = authorizationHarness(options)
    assert.equal((await h.api.authorizeActiveStockRequest(request, 'synthetic.stock.token')).status, 'blocked')
    assert.deepEqual(h.calls, [])
  }
})
test('authorizer pins the native Stock subject/session before its service-only binding read', async () => {
  const h = authorizationHarness()
  const result = await h.api.authorizeActiveStockRequest(request, 'synthetic.stock.token')
  assert.equal(result.status, 'authorized')
  assert.equal(result.decision.nonce, request.nonce)
  assert.equal(h.calls[2].name, 'core_stock_active_authorize_request')
  assert.equal(h.calls[2].args.p_core_subject, id(7))
  assert.ok(!JSON.stringify(result).includes('synthetic.stock.token'))
})
for (const actorChange of [{ stockSubject: id(99) }, { stockSessionId: id(99) }, { until: 1 }]) {
  test('stale or mismatched native actor cannot construct the privileged reader: ' + JSON.stringify(actorChange), async () => {
    const h = authorizationHarness({ actorChange })
    assert.equal((await h.api.authorizeActiveStockRequest(request, 'synthetic.stock.token')).status, 'denied')
    assert.deepEqual(h.calls, ['identity'])
  })
}
for (const options of [{ rpcError: { code: '42501' } }, { rowChange: { coreSubject: id(99) } },
  { rowChange: { callerApproved: true } }, { rowChange: { bindingRevision: -1 } }]) {
  test('unknown or denied binding read cannot become active authority: ' + JSON.stringify(options), async () => {
    const h = authorizationHarness(options)
    assert.equal((await h.api.authorizeActiveStockRequest(request, 'synthetic.stock.token')).status, 'denied')
  })
}

const { NextRequest, NextResponse } = require('next/server')
function httpHarness(enabled = true) {
  const calls = []
  const api = load('./stock-active-http.ts', {
    'server-only': {}, 'next/server': { NextResponse }, '@/lib/stock-active-protocol': protocol,
    '@/lib/stock-active-release': { ACTIVE_STOCK_RUNTIME_ENABLED: enabled },
    '@/lib/stock-active-authorize': { authorizeActiveStockRequest: async (input, token) => {
      calls.push({ input, token }); return { status: 'authorized', decision: { ...decision, ...input } }
    } },
    '@/lib/stock-active-enroll': { enrollActiveStockSession: async () => { calls.push('enroll'); return { status: 'unconfirmed' } } },
  })
  return { api, calls }
}
function head(headers = {}, suffix = '') {
  return new NextRequest(protocol.ACTIVE_CORE_ORIGIN + '/api/stock/active/authorize' + suffix,
    { method: 'HEAD', headers: { Authorization: 'Bearer synthetic.stock.token',
      'X-Webzoka-Stock-Request': encode(request), ...headers } })
}
test('database HEAD authorization returns bounded private metadata without a body or credential reflection', async () => {
  const h = httpHarness()
  const result = await h.api.handleActiveStockCoreHead(head())
  assert.equal(result.status, 200)
  assert.equal(await result.text(), '')
  assert.match(result.headers.get('cache-control'), /no-store/)
  assert.equal(JSON.parse(Buffer.from(result.headers.get('x-webzoka-stock-decision'), 'base64url')).nonce, request.nonce)
  assert.ok(![...result.headers.values()].some(value => value.includes('synthetic.stock.token')))
  assert.equal(h.calls.length, 1)
})
for (const headers of [{ Cookie: 'session=synthetic' }, { Origin: protocol.ACTIVE_STOCK_ORIGIN },
  { 'X-Webzoka-Core-Provider': 'synthetic.core.token' }, { Authorization: 'Bearer wrong' },
  { 'X-Webzoka-Stock-Request': 'malformed' }, { 'X-Webzoka-Stock-Request': 'a'.repeat(2049) }]) {
  test('database HEAD endpoint rejects ambient credentials or malformed metadata: ' + Object.keys(headers)[0], async () => {
    const h = httpHarness()
    assert.equal((await h.api.handleActiveStockCoreHead(head(headers))).status, 403)
    assert.deepEqual(h.calls, [])
  })
}
test('disabled HEAD authorization and query selectors cannot reach a Core reader', async () => {
  const off = httpHarness(false)
  assert.equal((await off.api.handleActiveStockCoreHead(head())).status, 404)
  assert.deepEqual(off.calls, [])
  const h = httpHarness()
  assert.equal((await h.api.handleActiveStockCoreHead(head({}, '?next=foreign'))).status, 403)
  assert.deepEqual(h.calls, [])
})
