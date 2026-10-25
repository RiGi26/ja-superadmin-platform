// Offline SDK behavior only. Gate overrides are synthetic; no managed runtime.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import * as crypto from 'node:crypto'
import * as zod from 'zod'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const origin = 'https://hxhusfkrlafxdnyasmsu.supabase.co'
const stockOrigin = 'https://oyyfcmlquqfrdoffkgsd.supabase.co'
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`
const request = { commandId: id(1), companyId: id(2), reservationId: id(3) }
const value = { companyId: id(2), reservationId: id(3), coreTenantId: id(4), coreSubject: id(5),
  stockTenantId: id(6), stockSubject: id(7), profileId: id(8), auditEventId: id(9),
  product: 'stock', status: 'quarantined', isActive: false }
const tuple = { stockTenantId: id(6), stockSubject: id(7), profileId: id(8), auditEventId: id(9), status: 'quarantined' }
const copy = value => JSON.parse(JSON.stringify(value))
function load(path, mocks, env = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { module: mod, exports: mod.exports, process: { env }, Buffer, Response, Request, TextDecoder, require(name) {
    if (name === 'server-only') return {}
    if (name === 'zod') return zod
    if (name === 'node:crypto') return crypto
    if (name === '@/lib/e1-realm') return load('lib/e1-realm.ts', {})
    if (name in mocks) return mocks[name]
    throw new Error(`Unexpected dependency ${name}`)
  } })
  return mod.exports
}
const realBinding = load('lib/registry-mutation-binding.ts', {})
const native = load('lib/core-registry-native.ts', {
  '@/lib/core-company': { CORE_DEV_ORIGIN: origin, CORE_COMPANY_RUNTIME_ENABLED: false },
  '@/lib/e1-stock-integration': { E1_STOCK_RUNTIME_ENABLED: false },
  '@/lib/registry-mutation-binding': realBinding,
  '@/lib/superadmin': { isSuperadminEmail: email => email === 'operator@example.test' },
  '@/lib/supabase/server': {}, '@/lib/supabase/admin': {},
})
function harness(options = {}) {
  const calls = []
  let written = false, coreAuth = 0, stockAuth = 0, coreReads = 0, coreClaimsReads = 0
  const account = subject => ({ id: subject, email: 'customer@example.test', is_anonymous: false,
    email_confirmed_at: '2026-01-01T00:00:00Z' })
  const claims = (subject, realm) => ({ sub: subject, session_id: id(10), iss: `${realm}/auth/v1`,
    aud: 'authenticated', role: 'authenticated', iat: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 600 })
  const core = { auth: {
    getSession: async () => {
      calls.push('core.getSession')
      if (options.native) throw new Error('COOKIE_PATH_FORBIDDEN')
      return { error: null, data: { session: { access_token: 'core-token' } } }
    },
    getUser: async token => {
      assert.equal(token, 'core-token'); coreAuth++; calls.push('core.getUser')
      return { error: options.coreRevokeAt <= coreAuth ? { status: 401 } : null,
        data: { user: account(value.coreSubject) } }
    },
    getClaims: async token => { assert.equal(token, 'core-token'); coreClaimsReads++; return { error: null,
      data: { claims: { ...claims(value.coreSubject, origin), client_id: id(85), ...options.coreClaims,
        ...(options.clientChangeAt <= coreClaimsReads ? { client_id: id(99) } : {}) } } } },
  }, rpc: async (name, args) => {
    calls.push(name); coreReads++; assert.equal(name, 'core_registry_e1_stock_context')
    assert.deepEqual(copy(args), { p_company: request.companyId, p_reservation: request.reservationId })
    return { error: null, data: { companyId: id(2), reservationId: id(3), coreTenantId: id(4), coreSubject: id(5),
      product: 'stock', status: 'reserved', stockTenantId: null, stockSubject: null, profileId: null,
      companyName: 'Synthetic Company', stockOrigin, stockBinding: written ? tuple : null,
      ...options.context, ...(options.changeRealm && coreReads > 1 ? { stockOrigin: 'https://uvwxyzabcdefghijklmn.supabase.co' } : {}),
      ...(options.missingReciprocal && written ? { stockBinding: null } : {}) } }
  } }
  const stock = { auth: {
    getUser: async token => {
      assert.equal(token, 'stock-token'); stockAuth++; calls.push('stock.getUser')
      const linked = { provider: 'custom:webzoka', identity_data: { sub: value.coreSubject } }
      return { error: options.stockRevokeAt <= stockAuth ? { status: 401 } : null,
        data: { user: { ...account(value.stockSubject), identities: [linked], ...options.stockAccount,
          ...(options.unlinkAt <= stockAuth ? { identities: [] } : {}),
          ...(options.relinkAt <= stockAuth ? { identities: [{ ...linked, identity_data: { sub: id(99) } }] } : {}),
        } } }
    },
    getClaims: async token => { assert.equal(token, 'stock-token'); return { error: null,
      data: { claims: { ...claims(value.stockSubject, stockOrigin), ...options.stockClaims } } } },
  }, rpc: async (name, args) => {
    calls.push(name); assert.equal(name, 'stock_e1_resource_context')
    assert.deepEqual(copy(args), { p_company: request.companyId, p_reservation: request.reservationId })
    return { error: null, data: { ...value, ...options.stockValue } }
  } }
  const api = load('lib/e1-stock-binding.ts', {
    '@/lib/core-company': { CORE_DEV_ORIGIN: origin, CORE_COMPANY_RUNTIME_ENABLED: options.enabled ?? true },
    '@/lib/e1-stock-integration': { E1_STOCK_RUNTIME_ENABLED: options.e1Enabled ?? true },
    '@/lib/registry-mutation-binding': options.realBinding ? realBinding : { e1StockMutationBinding: () => ({ status: 'synthetic-unit-only' }) },
    '@/lib/core-registry-native': native,
    '@/lib/supabase/server': { createClient: async () => { calls.push('createCore'); return core } },
    'next/headers': { headers: async () => new Map([['x-webzoka-stock-authorization', options.authorization ?? 'Bearer stock-token']]) },
    '@supabase/supabase-js': { createClient: (url, key, config) => {
      calls.push(url === origin ? 'createCoreBearer' : 'createStock')
      assert.ok(url === origin || url === stockOrigin); assert.equal(key, 'synthetic-public-key')
      assert.equal(config.global.headers.Authorization, url === origin ? 'Bearer core-token' : 'Bearer stock-token')
      assert.deepEqual(copy(config.auth), { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false })
      return url === origin ? core : stock
    } },
    '@/lib/supabase/admin': { createAdminClient: () => { calls.push('createWriter'); return { rpc: async (name, args) => {
      calls.push([name, copy(args)]); written = true
      return { error: options.writeError ?? null, data: { binding: { ...value, stockOrigin, ...options.response },
        receipt: { companyId: id(2), eventId: id(11), eventHash: 'a'.repeat(64), revision: 1 } } }
    } } } },
  }, { NEXT_PUBLIC_SUPABASE_URL: options.origin ?? origin, STOCK_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-key',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-key', STOCK_SSO_CLIENT_ID: options.missingClient ? undefined : id(85) })
  return { calls, api, run: (input = request, credentials = { coreToken: 'core-token', stockToken: 'stock-token' }) => options.native
    ? api.bindNativeE1StockQuarantine(input, credentials) : api.bindCurrentE1StockQuarantine(input),
    writes: () => calls.filter(call => Array.isArray(call)) }
}

test('real gates and wrong Core project stop before constructing any client', async () => {
  for (const options of [{ enabled: false }, { e1Enabled: false }, { realBinding: true }, { origin: stockOrigin }]) {
    const h = harness(options)
    assert.equal((await h.run()).status, 'blocked'); assert.deepEqual(h.calls, [])
  }
})
test('identity, credentials, issuer and local target fields cannot enter selector', async () => {
  const h = harness()
  for (const field of ['stockSubject', 'stockTenantId', 'profileId', 'stockOrigin', 'token', 'proof', 'client']) {
    assert.equal((await h.run({ ...request, [field]: id(99) })).status, 'denied')
  }
  assert.deepEqual(h.calls, [])
})
test('reciprocal adapter derives exact immutable tuple and session IDs; no access granted', async () => {
  const h = harness(), result = await h.run()
  assert.equal(result.status, 'quarantined'); assert.equal(result.binding.isActive, false)
  const [[name, args]] = h.writes()
  assert.equal(name, 'core_registry_e1_stock_bind_stage'); assert.equal(args.p_command, request.commandId)
  assert.equal(args.p_actor, value.coreSubject); assert.equal(args.p_stock_subject, value.stockSubject)
  assert.equal(args.p_stock_tenant, value.stockTenantId); assert.equal(args.p_stock_audit_event, value.auditEventId)
  assert.equal(h.calls.filter(call => call === 'core.getUser').length, 3)
  assert.equal(h.calls.filter(call => call === 'stock.getUser').length, 3)
})
for (const options of [
  { context: { coreSubject: id(99) } }, { context: { stockOrigin: 'https://mcvekinhgcqygfddyifs.supabase.co' } },
  { context: { stockOrigin: 'https://hxhusfkrlafxdnyasmsu.supabase.co' } },
  { context: { stockBinding: { ...tuple, stockSubject: id(99) } } }, { stockValue: { profileId: id(99), isActive: true } },
  { stockValue: { coreTenantId: id(99) } }, { stockValue: { stockSubject: id(99) } },
  { coreClaims: { user_role: 'superadmin' } }, { stockClaims: { iss: `${origin}/auth/v1` } },
  { stockClaims: { sub: id(99) } }, { stockClaims: { exp: 1 } }, { stockAccount: { is_anonymous: true } },
  { stockAccount: { identities: [] } },
  { stockAccount: { identities: [{ provider: 'email', identity_data: { sub: value.coreSubject } }] } },
  { stockAccount: { identities: [{ provider: 'custom:webzoka', identity_data: { sub: id(99) } }] } },
  { stockAccount: { identities: [{ provider: 'custom:webzoka', identity_data: {} }] } },
  { stockAccount: { identities: Array(2).fill({ provider: 'custom:webzoka', identity_data: { sub: value.coreSubject } }) } },
  { stockAccount: { banned_until: '2999-01-01T00:00:00Z' } }, { authorization: 'Bearer fake, extra' },
  { coreRevokeAt: 2 }, { stockRevokeAt: 2 }, { unlinkAt: 2 }, { relinkAt: 2 }, { changeRealm: true },
]) test(`pre-bind mismatch or revocation writes nothing ${JSON.stringify(options)}`, async () => {
  const h = harness(options); assert.equal((await h.run()).status, 'denied')
  assert.deepEqual(h.writes(), []); assert.equal(h.calls.includes('createWriter'), false)
})
for (const options of [{ coreRevokeAt: 3 }, { stockRevokeAt: 3 }, { unlinkAt: 3 }, { relinkAt: 3 },
  { response: { stockTenantId: id(99) } },
  { response: { isActive: true } }, { missingReciprocal: true }, { writeError: { message: 'response lost' } }]) {
  test(`uncertain writes retain SAME command/reservation without retry ${JSON.stringify(options)}`, async () => {
    const h = harness(options), result = await h.run()
    assert.equal(result.status, 'unconfirmed'); assert.equal(result.commandId, request.commandId)
    assert.equal(result.reservationId, request.reservationId); assert.equal(h.writes().length, 1)
  })
}
test('database error rejects one atomic RPC and never retries automatically', async () => {
  const h = harness({ writeError: { code: '23505' } })
  assert.equal((await h.run()).status, 'denied'); assert.equal(h.writes().length, 1)
})
test('source proposal pins realm, keeps reciprocal origin immutable, audits atomically and grants no activation', () => {
  const sql = read('docs/security/E1_RESOURCE_ISOLATION.PROPOSED.sql')
  assert.match(sql, /stock_origin text NOT NULL CHECK/)
  assert.match(sql, /VALUES \(true, false, NULL\)/)
  assert.match(sql, /CREATE TRIGGER e1_binding_immutable BEFORE UPDATE OR DELETE OR TRUNCATE/)
  assert.match(sql, /E1_BIND_REPLAY_CONFLICT/)
  assert.match(sql, /append_event\(o\.company_id, p_actor, p_session, p_command, 'e1.stock.stage'/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.core_registry_e1_stock_bind_stage[^;]+TO service_role/)
  assert.match(sql, /RAISE EXCEPTION 'LOCAL_PROPOSAL_ONLY/)
  assert.match(sql, /ROLLBACK;\s*$/)
})

test('native provider path reuses reciprocal checks without consulting Core cookies', async () => {
  const h = harness({ native: true }), result = await h.run()
  assert.equal(result.status, 'quarantined'); assert.equal(result.binding.isActive, false)
  assert.equal(h.calls.includes('core.getSession'), false); assert.equal(h.calls.includes('createCore'), false)
  assert.equal(h.calls.filter(call => call === 'core.getUser').length, 3)
  assert.equal(h.writes().length, 1)
})
for (const options of [{ enabled: false }, { e1Enabled: false }, { realBinding: true }, { origin: stockOrigin }]) {
  test(`native path real gates refuse before clients ${JSON.stringify(options)}`, async () => {
    const h = harness({ native: true, ...options })
    assert.equal((await h.run()).status, 'blocked'); assert.deepEqual(h.calls, [])
  })
}
for (const options of [{ missingClient: true }, { coreClaims: { client_id: id(99) } },
  { coreClaims: { client_id: undefined } }, { coreClaims: { iss: `${stockOrigin}/auth/v1` } },
  { coreClaims: { exp: 1 } }, { coreClaims: { user_role: 'superadmin' } }, { coreRevokeAt: 2 },
  { stockRevokeAt: 2 }, { unlinkAt: 2 }, { relinkAt: 2 }, { changeRealm: true }, { context: { coreSubject: id(99) } }, { clientChangeAt: 2 }]) {
  test(`native credentials/client/realm/Owner checks deny before writer ${JSON.stringify(options)}`, async () => {
    const h = harness({ native: true, ...options })
    assert.equal((await h.run()).status, 'denied'); assert.deepEqual(h.writes(), [])
    assert.equal(h.calls.includes('createWriter'), false); assert.equal(h.calls.includes('core.getSession'), false)
  })
}
test('native token injection/missing credentials never falls back to cookies', async () => {
  for (const credentials of [undefined, null]) {
    const h = harness({ native: true })
    assert.equal((await h.api.bindNativeE1StockQuarantine(request, credentials)).status, 'denied'); assert.deepEqual(h.calls, [])
  }
  for (const credentials of [{ coreToken: '', stockToken: 'stock-token' }, { coreToken: 'core-token', stockToken: 'bad,token' },
    { coreToken: 'bad\r\nheader', stockToken: 'stock-token' }, { coreToken: 'x'.repeat(8193), stockToken: 'stock-token' }]) {
    const h = harness({ native: true })
    assert.equal((await h.run(request, credentials)).status, 'denied'); assert.deepEqual(h.calls, [])
  }
})
for (const options of [{ coreRevokeAt: 3 }, { unlinkAt: 3 }, { clientChangeAt: 3 }, { writeError: { message: 'Lost response core-token stock-token' } }]) {
  test(`native post-write uncertainty retains selectors without token exposure ${JSON.stringify(options)}`, async () => {
    const h = harness({ native: true, ...options })
    assert.deepEqual(copy(await h.run()), { status: 'unconfirmed', ...request }); assert.equal(h.writes().length, 1)
  })
}

function routeHarness(options = {}) {
  const h = harness({ native: true, ...options })
  const route = load('app/api/auth/e1/stock/quarantine/route.ts', { '@/lib/e1-stock-binding': h.api })
  return { ...h, post: (body = request, headers = {}, raw) => route.POST(new Request('https://core-dev-preview.vercel.app/api/auth/e1/stock/quarantine', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer core-token',
      'x-webzoka-stock-authorization': 'Bearer stock-token', ...headers }, body: raw ?? JSON.stringify(body),
  })) }
}
test('dormant route refuses without reading headers/body or creating clients', async () => {
  for (const options of [{ enabled: false }, { e1Enabled: false }, { realBinding: true }, { origin: stockOrigin }]) {
    const h = routeHarness(options)
    const route = load('app/api/auth/e1/stock/quarantine/route.ts', { '@/lib/e1-stock-binding': h.api })
    const response = await route.POST({ get headers() { throw new Error('MUST_NOT_READ') } })
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { status: 'blocked' }); assert.deepEqual(h.calls, [])
  }
})
test('route validates bearer-only credentials and bounded strict JSON before client construction', async () => {
  for (const [body, headers, raw] of [
    [request, { authorization: '', cookie: 'valid-looking-core-cookie' }],
    [request, { authorization: 'Bearer core-token,second' }], [request, { 'x-webzoka-stock-authorization': '' }],
    [request, { 'content-type': 'text/plain' }], [{ ...request, token: 'injected' }],
    [{ ...request, stockOrigin }], [{ ...request, commandId: 'bad' }], [request, {}, '{'], [request, {}, ' '.repeat(2049)],
    [request, { authorization: `Bearer ${'x'.repeat(8193)}` }],
  ]) {
    const h = routeHarness(), response = await h.post(body, headers, raw)
    assert.ok([400, 403].includes(response.status)); assert.deepEqual(h.calls, [])
    assert.deepEqual(await response.json(), { status: 'denied' })
  }
})
test('route composes actual native binder and emits only inactive receipt fields with no-store', async () => {
  const h = routeHarness(), response = await h.post()
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.has('access-control-allow-origin'), false)
  assert.deepEqual(await response.json(), { status: 'quarantined', ...request, stockTenantId: id(6), profileId: id(8), auditEventId: id(9), isActive: false })
  assert.equal(h.calls.includes('core.getSession'), false); assert.equal(h.writes().length, 1)
})
test('route denies foreign client and returns uncertain SAME command after write without private errors', async () => {
  const denied = routeHarness({ coreClaims: { client_id: id(99) } })
  assert.equal((await denied.post()).status, 403); assert.deepEqual(denied.writes(), [])
  const lost = routeHarness({ writeError: { message: 'secret core-token stock-token' } }), response = await lost.post()
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), { status: 'unconfirmed', ...request })
  assert.equal(lost.writes().length, 1)
})
