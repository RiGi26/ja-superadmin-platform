import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import * as crypto from 'node:crypto'
import ts from 'typescript'
import * as zod from 'zod'

const source = readFileSync(new URL('./e1-stock-integration.ts', import.meta.url), 'utf8')
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`
const subject = id(1), session = id(2), company = id(3), reservedId = id(4)
const request = { commandId: id(5), companyName: 'Synthetic E1', product: 'stock' }
const selection = { commandId: id(6), companyId: company, reservationId: reservedId, product: 'stock' }
const copy = value => JSON.parse(JSON.stringify(value))
const loaded = { exports: {} }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText, { module: loaded, exports: loaded.exports, Buffer, require(name) {
  if (name === 'server-only') return {}
  if (name === 'zod') return zod
  if (name === 'node:crypto') return crypto
  if (name === '@/lib/core-company') return { CORE_COMPANY_RUNTIME_ENABLED: false }
  throw new Error(name)
} })

// Explicitly a transactional memory fake, not SQL/Supabase evidence. Commit only
// after callback succeeds; shared mutex models the required DB transaction fence.
function harness(options = {}) {
  let state = { owners: [], reservations: [], origins: [], events: [], replay: {}, ...options.state }
  let queue = Promise.resolve(), authCount = 0
  const actor = () => {
    authCount++
    const now = Date.now()
    return { subject, sessionId: session, verifiedAt: now - 1, validUntil: now + 20_000,
      customer: true, sessionCurrent: !(options.revokeAfter && authCount >= options.revokeAfter), ...options.actor }
  }
  const boundary = { currentActor: async () => actor(), async atomic(run) {
    const previous = queue
    let release
    queue = new Promise(resolve => { release = resolve })
    await previous
    const next = copy(state)
    try {
      const result = await run({
        currentActor: async () => actor(),
        creationOrigin: async c => next.origins.find(row => row.companyId === c),
        pendingClaims: async () => options.pendingClaim ?? false,
        replay: async (s, key) => next.replay[`${s}:${key}`] ?? null,
        checkoutCommand: async reservationId => next.events.find(event => event.action === 'e1.stock.checkout' &&
          event.reservation.reservationId === reservationId)?.commandId ?? null,
        owners: async s => next.owners.filter(row => row.subject === s),
        reservations: async c => next.reservations.filter(row => row.companyId === c),
        bootstrap: async (input, a, digest) => {
          assert.equal(next.owners.length, 0)
          next.owners.push({ subject: a.subject, companyId: company, membershipId: id(9),
            role: 'owner', status: 'active', companyStatus: 'active' })
          const value = { companyId: company, reservationId: reservedId, coreTenantId: id(10),
            coreSubject: a.subject, product: 'stock', status: 'reserved',
            stockTenantId: null, stockSubject: null, profileId: null, ...options.reservation }
          next.reservations.push(value)
          next.origins.push({ source: 'core.e1.resource.v1', subject: a.subject,
            commandId: input.commandId, digest, companyId: company, membershipId: id(9),
            reservationId: reservedId, coreTenantId: id(10), product: 'stock', ...options.origin })
          return value
        },
        assertIsolation: async () => { if (options.isolationFailure) throw new Error('ISOLATION_UNAVAILABLE') },
        verifyStock: async value => ({ ...value, stockTenantId: id(11), stockSubject: id(12),
          profileId: id(13), role: 'admin', active: true, currentAuth: true, mappingUnique: true,
          entitlementActive: true, verifiedAt: Date.now() - 1, validUntil: Date.now() + 20_000,
          evidenceRef: id(14), ...options.stockProof }),
        bind: async (value, p) => {
          const bound = { ...value, status: 'provisioned', stockTenantId: p.stockTenantId,
            stockSubject: p.stockSubject, profileId: p.profileId }
          next.reservations = [bound]
          return bound
        },
        appendAudit: async event => {
          if (options.auditFailure) throw new Error('AUDIT_UNAVAILABLE')
          next.events.push(copy(event))
          if (options.revokeDuringAudit) options.actor = { sessionCurrent: false }
          return { eventId: id(20 + next.events.length), eventHash: 'a'.repeat(64), companyId: event.companyId }
        },
        remember: async (s, key, value) => { next.replay[`${s}:${key}`] = copy(value) },
      })
      state = next
      return result
    } finally { release() }
  } }
  return { service: loaded.exports.createE1StockService(boundary), state: () => copy(state),
    change(fn) { fn(state) } }
}
async function admitted(options = {}) {
  const h = harness(options)
  await h.service.admit(request)
  return h
}
test('runtime remains disabled; no production adapter/route activation', () => {
  assert.equal(loaded.exports.E1_STOCK_RUNTIME_ENABLED, false)
  assert.throws(() => loaded.exports.getE1StockRuntimeService(), /RUNTIME_DISABLED/)
  assert.match(readFileSync(new URL('./core-company.ts', import.meta.url), 'utf8'), /CORE_COMPANY_RUNTIME_ENABLED = false as const/)
})
test('synthetic E1: Company + Owner + Stock reservation + audit, no local profile prerequisite', async () => {
  const h = await admitted()
  const state = h.state()
  assert.equal(state.owners.length, 1); assert.equal(state.owners[0].role, 'owner')
  assert.equal(state.reservations[0].status, 'reserved')
  assert.equal(state.reservations[0].profileId, null)
  assert.equal(state.events.length, 1); assert.equal(state.events[0].action, 'e1.stock.admit')
})
test('same command concurrent delivery converges; changed payload or new command cannot duplicate Company', async () => {
  const h = harness()
  const results = await Promise.all(Array.from({ length: 8 }, () => h.service.admit(request)))
  assert.equal(new Set(results.map(r => r.reservation.companyId)).size, 1)
  assert.equal(h.state().events.length, 1)
  await assert.rejects(h.service.admit({ ...request, companyName: 'Different' }))
  await assert.rejects(h.service.admit({ ...request, commandId: id(30) }))
  assert.equal(h.state().owners.length, 1)
})
test('different command concurrent admission allows exactly one', async () => {
  const h = harness()
  const results = await Promise.allSettled([h.service.admit(request), h.service.admit({ ...request, commandId: id(31) })])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(h.state().events.length, 1)
})
for (const [label, origin] of [
  ['legacy import', { source: 'legacy' }], ['wrong product', { product: 'lms' }],
  ['other subject', { subject: id(40) }], ['wrong command', { commandId: id(41) }],
  ['wrong digest', { digest: '0'.repeat(64) }], ['wrong membership', { membershipId: id(42) }],
  ['wrong reservation', { reservationId: id(43) }], ['wrong Core tenant', { coreTenantId: id(44) }],
]) test(`${label} cannot borrow E1; no partial grant`, async () => {
  const h = harness({ origin })
  await assert.rejects(h.service.admit(request))
  assert.deepEqual(h.state().owners, []); assert.deepEqual(h.state().events, [])
})
test('unrelated legacy history grants nothing and does not disqualify a fresh resource graph', async () => {
  const h = await admitted({ state: { unrelatedLegacyHistory: ['pending', 'revoked', 'imported'] } })
  assert.equal(h.state().owners.length, 1)
  assert.equal(h.state().origins[0].source, 'core.e1.resource.v1')
  assert.deepEqual(h.state().unrelatedLegacyHistory, ['pending', 'revoked', 'imported'])
})

test('pending canonical ownership claim denies E1 without creating resources', async () => {
  const h = harness({ pendingClaim: true })
  await assert.rejects(h.service.admit(request))
  assert.deepEqual(h.state().owners, []); assert.deepEqual(h.state().origins, [])
})
test('client fields, claimed E1, operators and wrong product denied before trusted boundary', async () => {
  for (const patch of [{ subject }, { classification: 'E1' }, { operators: [id(40), id(41)] }, { product: 'lms' }]) {
    const h = harness()
    await assert.rejects(h.service.admit({ ...request, ...patch }))
    assert.equal(h.state().events.length, 0)
  }
})
test('audit failure rolls back Company, Owner, reservation and replay record', async () => {
  const h = harness({ auditFailure: true })
  const before = h.state()
  await assert.rejects(h.service.admit(request), /AUDIT_UNAVAILABLE/)
  assert.deepEqual(h.state(), before)
})
test('audit failure during binding or checkout preserves reservation and prior audit', async () => {
  for (const action of ['confirmProvisioning', 'authorizeFirstCheckout']) {
    const options = {}
    const h = await admitted(options)
    const before = h.state()
    options.auditFailure = true
    await assert.rejects(h.service[action](selection), /AUDIT_UNAVAILABLE/)
    assert.deepEqual(h.state(), before)
  }
})
test('revoked session after lock and unavailable database isolation abort admission', async () => {
  for (const options of [{ revokeAfter: 2 }, { revokeAfter: 4 }, { isolationFailure: true }]) {
    const h = harness(options)
    await assert.rejects(h.service.admit(request)); assert.equal(h.state().owners.length, 0)
  }
})
test('checkout modeled idempotently before Stock membership; no payment operation', async () => {
  const h = await admitted()
  const first = await h.service.authorizeFirstCheckout(selection)
  const second = await h.service.authorizeFirstCheckout(selection)
  assert.equal(first.modeledOnly, true); assert.deepEqual(copy(first), copy(second))
  assert.equal(h.state().events.filter(e => e.action === 'e1.stock.checkout').length, 1)
  assert.equal(h.state().reservations[0].stockSubject, null)
  await assert.rejects(h.service.authorizeFirstCheckout({ ...selection, commandId: id(77) }))
})
for (const patch of [{ companyId: id(40) }, { reservationId: id(41) }, { product: 'lms' }]) {
  test(`checkout rejects cross-tenant/wrong-product ${JSON.stringify(patch)}`, async () => {
    const h = await admitted()
    await assert.rejects(h.service.authorizeFirstCheckout({ ...selection, ...patch }))
    assert.equal(h.state().events.length, 1)
  })
}
for (const change of [s => { s.owners[0].status = 'revoked' }, s => { s.owners[0].role = 'admin' },
  s => { s.owners[0].companyStatus = 'inactive' }, s => { s.owners.push(copy(s.owners[0])) },
  s => { s.reservations.push(copy(s.reservations[0])) }, s => { s.reservations[0].status = 'revoked' }]) {
  test(`current authorization rejects ${change.toString()}`, async () => {
    const h = await admitted()
    await h.service.authorizeFirstCheckout(selection)
    h.change(change)
    await assert.rejects(h.service.authorizeFirstCheckout(selection))
    await assert.rejects(h.service.admit(request))
  })
}
test('post-provision binding requires fresh exact canonical Stock proof; retry audits once', async () => {
  const h = await admitted()
  const command = { ...selection, commandId: id(50) }
  const bound = await h.service.confirmProvisioning(command)
  assert.equal(bound.reservation.status, 'provisioned')
  await h.service.confirmProvisioning(command)
  assert.equal(h.state().events.filter(e => e.action === 'e1.stock.bind').length, 1)
  await assert.rejects(h.service.confirmProvisioning({ ...command, commandId: id(51) }))
  assert.equal(h.state().events.filter(e => e.action === 'e1.stock.bind').length, 1)
  await assert.rejects(h.service.authorizeFirstCheckout(selection))
})

test('provisioned admission replay revalidates canonical Stock revocation', async () => {
  const options = {}
  const h = await admitted(options)
  await h.service.confirmProvisioning(selection)
  options.stockProof = { active: false }
  await assert.rejects(h.service.admit(request))
  assert.equal(h.state().events.length, 2)
})

test('revocation during audit aborts the complete synthetic transaction', async () => {
  const h = harness({ revokeDuringAudit: true })
  const before = h.state()
  await assert.rejects(h.service.admit(request))
  assert.deepEqual(h.state(), before)
})
for (const stockProof of [{ active: false }, { currentAuth: false }, { mappingUnique: false },
  { entitlementActive: false }, { product: 'lms' }, { companyId: id(40) },
  { coreTenantId: id(40) }, { coreSubject: id(40) }, { reservationId: id(40) }, { validUntil: 1 }]) {
  test(`Stock binding denial ${JSON.stringify(stockProof)}`, async () => {
    const h = await admitted({ stockProof })
    await assert.rejects(h.service.confirmProvisioning(selection))
    assert.equal(h.state().reservations[0].status, 'reserved'); assert.equal(h.state().events.length, 1)
  })
}
