// Exercises the v2 adapter with explicit offline native/SQL observations.
// It is not proof of installed RPCs, native Auth, concurrency or RLS.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, dependencies = {}, env = {}) {
  const sandboxModule = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: sandboxModule, exports: sandboxModule.exports, Date, Object, Number, Set, AbortSignal,
    process: { env }, require(name) {
      assert.ok(Object.hasOwn(dependencies, name), 'Unexpected offline dependency: ' + name)
      return dependencies[name]
    },
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
function harness(options = {}) {
  const calls = []
  const actor = { coreSubject: id(9), stockSubject: id(6), stockSessionId: id(7), until: Date.now() + 20000, ...options.actor }
  const api = load('./stock-membership-authorize.ts', {
    'server-only': {}, '@/lib/stock-active-protocol': active,
    '@/lib/stock-membership-protocol': { ...protocol, STOCK_MEMBERSHIP_RUNTIME_ENABLED: options.enabled ?? true },
    '@/lib/stock-active-identity': { async verifyStockIdentityForCoreBridge(token) {
      calls.push('identity')
      assert.equal(token, 'synthetic.native.stock')
      if (options.identityFails) throw Error('identity unavailable')
      if (options.mutateInput) options.mutateInput()
      return actor
    } },
    '@/lib/supabase/admin': { createAdminClient() {
      calls.push('admin')
      return { rpc(name, args) {
        calls.push({ name, args: JSON.parse(JSON.stringify(args)) })
        return { async abortSignal() {
          if (options.transportFails) throw Error('unavailable')
          assert.equal(name, 'core_stock_membership_authorize_request')
          if (options.expireDuringRead) actor.until = Date.now() - 1
          const data = Object.hasOwn(options, 'authorityData') ? options.authorityData : { ...authority, ...options.authority }
          return { data, error: options.authorityError ?? null }
        } }
      } }
    } },
  }, { NEXT_PUBLIC_SUPABASE_URL: options.realm ?? active.ACTIVE_CORE_REALM })
  return { calls, run: input => api.authorizeStockMembershipRequest(input ?? request, 'synthetic.native.stock') }
}

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
