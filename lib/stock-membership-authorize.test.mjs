// Exercises the v2 adapter with explicit offline native/SQL observations.
// It is not proof of installed RPCs, native Auth, concurrency or RLS.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const realRequire = createRequire(import.meta.url)

function load(file, dependencies = {}, env = {}, globals = {}) {
  const sandboxModule = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: sandboxModule, exports: sandboxModule.exports, Date, Object, Number, Set, AbortSignal,
    process: { env }, require(name) {
      assert.ok(Object.hasOwn(dependencies, name), 'Unexpected offline dependency: ' + name)
      return dependencies[name]
    }, ...globals,
  })
  return sandboxModule.exports
}
const active = load('./stock-active-protocol.ts')
const protocol = load('./stock-membership-protocol.ts', { './stock-active-protocol': active })
const id = n => '82000000-0000-4000-8000-' + String(n).padStart(12, '0')
const request = { version: 2, companyId: id(1), instanceId: id(2), stockTenantId: id(3),
  profileId: id(4), membershipId: id(5), membershipRevision: 2, selectionRevision: 3,
  role: 'staff', stockSubject: id(6), stockSessionId: id(7), method: 'GET', path: '/orders', nonce: id(8) }
const authority = { companyId: id(1), instanceId: id(2), stockTenantId: id(3),
  profileId: id(4), membershipId: id(5), membershipRevision: 2, selectionRevision: 3, role: 'staff',
  coreSubject: id(9), coreSessionId: id(10), coreTenantId: id(11),
  bindingId: id(12), bindingRevision: 2, companyRevision: 2,
  ownerMembershipId: id(13), ownerMembershipRevision: 2 }

test('native SDK requests inherit the caller budget and cannot reset an aborted deadline', async () => {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = { ...await webcrypto.subtle.exportKey('jwk', pair.publicKey), kid: 'offline-budget-stock', alg: 'ES256', use: 'sig' }
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const seconds = Math.floor(Date.now() / 1000)
  const body = { iss: active.ACTIVE_STOCK_REALM + '/auth/v1', aud: 'authenticated',
    sub: id(1), session_id: id(2), role: 'authenticated', is_anonymous: false,
    iat: seconds - 2, exp: seconds + 120, amr: [{ method: 'oauth', timestamp: seconds - 2 }] }
  const signing = encode({ alg: 'ES256', kid: jwk.kid, typ: 'JWT' }) + '.' + encode(body)
  const signature = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, Buffer.from(signing))
  const nativeToken = signing + '.' + Buffer.from(signature).toString('base64url')
  const user = { id: id(1), email: 'synthetic@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z',
    is_anonymous: false, identities: [{ provider: 'custom:webzoka', user_id: id(1), identity_data: { sub: id(7) } }] }
  const signals = [], calls = [], controller = new AbortController()
  const fetch = async (input, init) => {
    const url = String(input)
    calls.push(url); signals.push(init.signal)
    assert.ok(url.startsWith(active.ACTIVE_STOCK_REALM + '/auth/v1/'))
    if (url.endsWith('/.well-known/jwks.json')) return Response.json({ keys: [jwk] })
    if (url.endsWith('/user')) return Response.json(user)
    throw new Error('Unexpected offline Auth request')
  }
  const api = load('./stock-active-identity.ts', { 'server-only': {},
    '@supabase/supabase-js': realRequire('@supabase/supabase-js'), '@/lib/stock-active-protocol': active,
  }, { STOCK_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' }, { fetch })
  await api.verifyStockIdentityForCoreBridge(nativeToken, { signal: controller.signal })
  assert.ok(signals.length > 0)
  assert.ok(signals.every(signal => signal instanceof AbortSignal && !signal.aborted))
  controller.abort()
  assert.ok(signals.every(signal => signal.aborted))
  const count = calls.length
  await assert.rejects(api.verifyStockIdentityForCoreBridge(nativeToken, { signal: controller.signal }), /IDENTITY_DENIED/)
  assert.equal(calls.length, count)
})

function harness(options = {}) {
  const calls = [], diagnostics = [], signals = []
  const started = Date.now()
  let elapsed = 0
  let diagnosticElapsedMs = 0
  const actor = { coreSubject: id(9), stockSubject: id(6), stockSessionId: id(7), until: Date.now() + 20000, ...options.actor }
  const api = load('./stock-membership-authorize.ts', {
    'server-only': {}, '@/lib/stock-active-protocol': active,
    '@/lib/stock-membership-preparation-diagnostics': load('./stock-membership-preparation-diagnostics.ts', { 'server-only': {} }, {}, {
      Date: { now: () => diagnosticElapsedMs },
      console: { info(...args) {
        if (options.logSinkThrows) throw Error('Unavailable log sink')
        diagnostics.push(args)
      } },
    }),
    '@/lib/stock-membership-protocol': { ...protocol, STOCK_MEMBERSHIP_RUNTIME_ENABLED: options.enabled ?? true },
    '@/lib/stock-active-identity': { async verifyStockIdentityForCoreBridge(token, identityOptions) {
      calls.push('identity')
      signals.push(identityOptions.signal)
      elapsed += options.identityClockMs ?? 0
      diagnosticElapsedMs += options.identityElapsedMs ?? 0
      assert.equal(token, 'synthetic.native.stock')
      if (options.identityFails) throw Error('identity unavailable')
      if (options.mutateInput) options.mutateInput()
      return actor
    } },
    '@/lib/supabase/admin': { createAdminClient() {
      calls.push('admin')
      return { rpc(name, args) {
        calls.push({ name, args: JSON.parse(JSON.stringify(args)) })
        return { async abortSignal(signal) {
          signals.push(signal)
          elapsed += options.authorityClockMs ?? 0
          diagnosticElapsedMs += options.authorityElapsedMs ?? 0
          if (options.transportFails) throw Error('unavailable')
          assert.equal(name, 'core_stock_membership_authorize_request')
          if (options.expireDuringRead) actor.until = started + elapsed - 1
          const data = Object.hasOwn(options, 'authorityData') ? options.authorityData : { ...authority, ...options.authority }
          return { data, error: options.authorityError ?? null }
        } }
      } }
    } },
  }, { NEXT_PUBLIC_SUPABASE_URL: options.realm ?? active.ACTIVE_CORE_REALM }, {
    Date: class extends Date { static now() { return started + elapsed } },
  })
  return { calls, diagnostics, signals, run: input => api.authorizeStockMembershipRequest(input ?? request, 'synthetic.native.stock') }
}

test('native identity and authority share one deadline signal', async () => {
  const h = harness()
  assert.equal((await h.run()).status, 'authorized')
  assert.equal(h.signals.length, 2); assert.ok(h.signals[0] instanceof AbortSignal)
  assert.equal(h.signals[0], h.signals[1])
})

test('late identity stops before authority; individually valid stage times cannot exceed the shared budget', async () => {
  const identity = harness({ identityClockMs: 2500 })
  assert.equal((await identity.run()).status, 'denied')
  assert.deepEqual(identity.calls, ['identity'])
  const combined = harness({ identityClockMs: 1600, authorityClockMs: 1000 })
  assert.equal((await combined.run()).status, 'denied')
  const within = harness({ identityClockMs: 1200, authorityClockMs: 1000 })
  assert.equal((await within.run()).status, 'authorized')
})

test('authorization diagnostics distinguish identity, authority and decision failures without private fields', async () => {
  for (const [options, stage, status, code] of [
    [{ identityFails: true }, 'native_identity', 'denied', 'OTHER'],
    [{ authorityError: { code: '57014', message: 'private database message' } }, 'membership_authority', 'denied', '57014'],
    [{ authority: { role: 'admin' } }, 'decision_parse', 'denied', 'OTHER'],
    [{}, 'decision_parse', 'authorized', 'NONE'],
  ]) {
    const h = harness(options)
    assert.equal((await h.run()).status, status)
    assert.equal(h.diagnostics.length, 1)
    const [event, trace] = h.diagnostics[0]
    assert.equal(event, 'STOCK_PREPARATION_DIAGNOSTIC')
    assert.equal(trace.operation, 'core_authorize')
    assert.equal(trace.stage, stage)
    assert.equal(trace.status, status)
    assert.equal(trace.errorCode, code)
    assert.ok(trace.checkpoints.length <= 4)
    assert.ok(trace.checkpoints.every(point => Number.isFinite(point.elapsedMs) && point.elapsedMs >= 0))
    const serialized = JSON.stringify(h.diagnostics)
    for (const secret of ['synthetic.native.stock', 'private database message', ...Object.values(request).filter(value => typeof value === 'string')]) {
      assert.ok(!serialized.includes(secret), secret)
    }
  }
})

test('a failed authorization log sink preserves every allow and denial result', async () => {
  for (const options of [{}, { identityFails: true }, { authorityData: null }]) {
    const h = harness({ ...options, logSinkThrows: true })
    assert.equal((await h.run()).status, Object.keys(options).length === 0 ? 'authorized' : 'denied')
  }
})

test('authorization checkpoints measure each completed dependency and the final outcome', async () => {
  const h = harness({ identityElapsedMs: 125, authorityElapsedMs: 875 })
  assert.equal((await h.run()).status, 'authorized')
  const trace = JSON.parse(JSON.stringify(h.diagnostics[0][1]))
  assert.deepEqual(trace.checkpoints, [
    { stage: 'native_identity', elapsedMs: 0 },
    { stage: 'membership_authority', elapsedMs: 125 },
    { stage: 'decision_parse', elapsedMs: 1000 },
  ])
  assert.equal(trace.elapsedMs, 1000)
})

test('disabled gate blocks before all identity, database or network effects', async () => {
  const h = harness({ enabled: false })
  assert.equal((await h.run()).status, 'blocked'); assert.deepEqual(h.calls, [])
  const foreign = harness({ realm: 'https://foreign.invalid' })
  assert.equal((await foreign.run()).status, 'blocked'); assert.deepEqual(foreign.calls, [])
})
test('malformed request denies before native identity and financial authority lookup', async () => {
  for (const change of [{ canBill: true }, { companyId: [id(1)] }, { role: 'owner' }, { version: 1 }, { period: 'yearly' }]) {
    const h = harness()
    assert.equal((await h.run({ ...request, ...change })).status, 'denied'); assert.deepEqual(h.calls, [])
  }
})
test('verified native subject, session and deadline must match before any service use', async () => {
  for (const actor of [{ stockSubject: id(99) }, { stockSessionId: id(99) }, { until: Date.now() - 1 }]) {
    const h = harness({ actor })
    assert.equal((await h.run()).status, 'denied'); assert.deepEqual(h.calls, ['identity'])
  }
  assert.equal((await harness({ identityFails: true }).run()).status, 'denied')
})
test('unknown, absent, denied or unavailable current authority fails without another RPC', async () => {
  for (const options of [{ authorityData: false }, { authorityData: null }, { authorityData: 'true' }, { authorityData: {} },
    { authorityError: { message: 'unavailable' } }, { transportFails: true }]) {
    const h = harness(options)
    assert.equal((await h.run()).status, 'denied')
    assert.deepEqual(h.calls.filter(call => typeof call === 'object').map(call => call.name), ['core_stock_membership_authorize_request'])
  }
})
test('current SQL authority correlates every selected membership and preserves staff role', async () => {
  const h = harness()
  const result = await h.run()
  assert.equal(result.status, 'authorized')
  assert.equal(result.decision.role, 'staff')
  assert.equal(result.decision.profileId, request.profileId)
  assert.equal(result.decision.selectionRevision, request.selectionRevision)
  assert.equal(result.decision.coreSubject, authority.coreSubject)
  assert.equal(Object.isFrozen(result.decision), true)
  assert.ok(result.decision.expiresAt - result.decision.issuedAt <= 5000)
  const [sql, ...extra] = h.calls.filter(call => typeof call === 'object')
  assert.equal(sql.name, 'core_stock_membership_authorize_request')
  assert.deepEqual(extra, [])
  assert.equal(sql.args.p_profile, request.profileId)
  assert.equal(sql.args.p_membership_revision, request.membershipRevision)
  assert.equal(sql.args.p_selection_revision, request.selectionRevision)
  assert.equal(sql.args.p_core_subject, authority.coreSubject)
  for (const forbidden of ['role', 'plan', 'amount', 'tenant_id', 'p_core_session']) assert.ok(!(forbidden in sql.args))
  assert.ok(!JSON.stringify(result).includes('synthetic.native.stock'))
})
for (const [field, value] of [
  ['companyId', id(99)], ['instanceId', id(99)], ['stockTenantId', id(99)],
  ['profileId', id(99)], ['membershipId', id(99)], ['membershipRevision', 1],
  ['selectionRevision', 2],
  ['role', 'admin'], ['coreSubject', id(99)], ['ownerMembershipRevision', 0],
  ['coreSessionId', null], ['canBill', true], ['version', 2],
]) test('SQL mismatch cannot be echoed into authority: ' + field, async () => {
  const h = harness({ authority: { [field]: value } })
  assert.equal((await h.run()).status, 'denied')
})
test('expiry after SQL, lost response and denied authority never issue an authorization', async () => {
  for (const options of [{ expireDuringRead: true }, { authorityError: { message: 'revoked' } }]) {
    assert.equal((await harness(options).run()).status, 'denied')
  }
})
test('caller mutation while native verification waits cannot switch the selected workspace', async () => {
  const input = { ...request }
  const h = harness({ mutateInput() { input.companyId = id(99); input.profileId = id(99); input.role = 'admin' } })
  const result = await h.run(input)
  assert.equal(result.status, 'authorized')
  assert.equal(result.decision.companyId, request.companyId)
  assert.equal(result.decision.profileId, request.profileId)
  assert.equal(result.decision.role, 'staff')
})
