// Offline wire-contract checks only. No database, native Auth or access grant.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, dependencies = {}) {
  const sandboxModule = { exports: {} }
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module: sandboxModule, exports: sandboxModule.exports, Date, Object, Number, Set,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), 'Unexpected offline import: ' + name)
      return dependencies[name]
    },
  })
  return sandboxModule.exports
}
const active = load('./stock-active-protocol.ts')
const protocol = load('./stock-membership-protocol.ts', { './stock-active-protocol': active })
const id = n => '81000000-0000-4000-8000-' + String(n).padStart(12, '0')
const now = 1793682000000
const selection = {
  companyId: id(1), instanceId: id(2), stockTenantId: id(3), profileId: id(4),
  membershipId: id(5), membershipRevision: 2, selectionRevision: 3, role: 'staff',
}
const request = {
  ...selection, version: 2, stockSubject: id(6), stockSessionId: id(7),
  method: 'GET', path: '/orders', nonce: id(8),
}
const decision = {
  ...request, coreSubject: id(9), coreSessionId: id(10), coreTenantId: id(11),
  bindingId: id(12), bindingRevision: 4, companyRevision: 5,
  ownerMembershipId: id(13), ownerMembershipRevision: 6,
  issuedAt: now, expiresAt: now + 5000,
}
const plain = value => JSON.parse(JSON.stringify(value))

test('workspace choice carries selectors and idempotency only, never identity or payment authority', () => {
  const choice = { companyId: id(1), instanceId: id(2), commandId: id(14) }
  assert.deepEqual(plain(protocol.parseStockWorkspaceChoice(choice)), choice)
  assert.equal(Object.isFrozen(protocol.parseStockWorkspaceChoice(choice)), true)
  for (const field of ['profileId', 'stockTenantId', 'coreSubject', 'stockSubject', 'role', 'isOwner', 'plan', 'price', 'period', 'proof', '__proto__']) {
    assert.throws(() => protocol.parseStockWorkspaceChoice(Object.fromEntries([...Object.entries(choice), [field, true]])), field)
  }
  for (const field of Object.keys(choice)) {
    const missing = { ...choice }; delete missing[field]
    assert.throws(() => protocol.parseStockWorkspaceChoice(missing), field)
    assert.throws(() => protocol.parseStockWorkspaceChoice({ ...choice, [field]: [choice[field]] }), field)
  }
})

test('member request snapshots an exact selected workspace, profile, membership revision and native session', () => {
  const input = { ...request }
  const parsed = protocol.parseStockMembershipRequest(input)
  assert.deepEqual(plain(parsed), request)
  input.profileId = id(99); input.role = 'admin'
  assert.equal(parsed.profileId, id(4)); assert.equal(parsed.role, 'staff')
  assert.equal(Object.isFrozen(parsed), true)
})

test('matching online decision snapshots all authority and keeps financial fields absent', () => {
  const input = { ...decision }
  const parsed = protocol.parseStockMembershipDecision(input, request, now)
  assert.deepEqual(plain(parsed), decision)
  assert.equal(Object.isFrozen(parsed), true)
  input.coreTenantId = id(99); input.ownerMembershipRevision = 99
  assert.equal(parsed.coreTenantId, id(11)); assert.equal(parsed.ownerMembershipRevision, 6)
  for (const field of ['canBill', 'isOwner', 'plan', 'price', 'amount', 'entitlements', 'token']) assert.ok(!(field in parsed))
})

for (const field of ['companyId', 'instanceId', 'stockTenantId', 'profileId', 'membershipId', 'stockSubject', 'stockSessionId', 'nonce']) {
  test('another workspace, profile, identity or nonce cannot reuse a decision: ' + field, () => {
    assert.throws(() => protocol.parseStockMembershipDecision({ ...decision, [field]: id(99) }, request, now))
    assert.throws(() => protocol.parseStockMembershipDecision(decision, { ...request, [field]: id(99) }, now))
  })
}
for (const [field, value] of [
  ['membershipRevision', 1], ['selectionRevision', 2], ['role', 'admin'],
  ['method', 'POST'], ['path', '/rpc/post_order'], ['version', 1],
]) test('changed selection, role or operation requires its own online decision: ' + field, () => {
  assert.throws(() => protocol.parseStockMembershipDecision({ ...decision, [field]: value }, request, now))
})

for (const field of ['membershipRevision', 'selectionRevision']) for (const value of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1, '2', null]) {
  test('member request rejects invalid positive revision: ' + field + ' ' + String(value), () => {
    assert.throws(() => protocol.parseStockMembershipRequest({ ...request, [field]: value }))
  })
}
for (const [field, value] of [
  ['ownerMembershipId', 'owner@example.invalid'], ['ownerMembershipRevision', 0],
  ['ownerMembershipRevision', 1.5], ['ownerMembershipRevision', Number.MAX_SAFE_INTEGER + 1],
  ['bindingRevision', -1], ['companyRevision', -1], ['coreSessionId', null],
  ['issuedAt', now + 1], ['expiresAt', now], ['expiresAt', now + 5001], ['expiresAt', Infinity],
  ['version', '2'], ['role', 'owner'], ['canBill', true],
]) test('malformed or financial authority cannot enter the operational decision: ' + field + ' ' + String(value), () => {
  assert.throws(() => protocol.parseStockMembershipDecision({ ...decision, [field]: value }, request, now))
})

test('decision expires at its boundary and does not become a cached lease', () => {
  assert.equal(protocol.parseStockMembershipDecision(decision, request, now + 4999).expiresAt, now + 5000)
  assert.throws(() => protocol.parseStockMembershipDecision(decision, request, now + 5000))
  for (const clock of [0, NaN, Infinity, now + 0.5]) assert.throws(() => protocol.parseStockMembershipDecision(decision, request, clock))
})

for (const path of ['/auth/v1/token', '/storage/v1/object', '//foreign.invalid', '/orders?tenant=foreign',
  '/orders/../secrets', '/%6frders', '/rpc/', '/orders#fragment']) {
  test('member decisions retain the existing protected database path grammar: ' + path, () => {
    assert.throws(() => protocol.parseStockMembershipRequest({ ...request, path }))
  })
}
test('unknown fields, array selectors and missing required fields deny at each wire boundary', () => {
  for (const parse of [protocol.parseStockMembershipRequest, input => protocol.parseStockMembershipDecision(input, request, now)]) {
    const valid = parse === protocol.parseStockMembershipRequest ? request : decision
    for (const field of Object.keys(valid)) {
      const missing = { ...valid }; delete missing[field]
      assert.throws(() => parse(missing), field)
    }
    for (const input of [null, [], { ...valid, provider_token: 'synthetic' }, { ...valid, companyId: [id(1)] }]) assert.throws(() => parse(input))
  }
})

test('v1 and v2 decisions cannot be substituted even for the same native subject', () => {
  const v1Request = { stockSubject: request.stockSubject, stockSessionId: request.stockSessionId,
    method: request.method, path: request.path, nonce: request.nonce }
  const v1 = { ...v1Request, version: 1, companyId: id(1), instanceId: id(2), stockTenantId: id(3),
    coreSubject: id(9), coreSessionId: id(10), coreTenantId: id(11), bindingId: id(12),
    bindingRevision: 4, companyRevision: 5, issuedAt: now, expiresAt: now + 5000 }
  assert.throws(() => protocol.parseStockMembershipDecision(v1, request, now))
  assert.throws(() => active.parseActiveStockDecision(decision, v1Request, now))
})

test('retained membership history never falls through when disabled, denied or unavailable', () => {
  assert.equal(protocol.STOCK_MEMBERSHIP_RUNTIME_ENABLED, false)
  assert.equal(protocol.stockMembershipRoute(true), 'denied')
  assert.equal(protocol.stockMembershipRoute(false), 'legacy')
  assert.equal(protocol.stockMembershipRoute(true, true), 'membership')
  assert.equal(protocol.stockMembershipRoute(false, true), 'legacy')
  for (const value of [null, undefined, {}, [], 'false', 0, { active: false }, { revoked: true }]) {
    assert.equal(protocol.stockMembershipRoute(value), 'denied')
    assert.equal(protocol.stockMembershipRoute(value, true), 'denied')
  }
})
