// Offline behavioral tests of the actual Core sync adapters. No real requests.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import { loadPricingPolicy } from './pricing-unit-harness.mjs'

const policy = loadPricingPolicy()
const tenantId = '22222222-2222-4222-8222-222222222222'
const secret = 'SYNTHETIC_OFFLINE_TEST_SECRET'
const rows = policy.APPROVED_OFFERS.map((offer) => ({ id: offer.id, platform: offer.platform,
  tier: offer.tier, tier_display_name: offer.name, price_monthly: offer.price, price_yearly: null,
  is_active: true, offer_version: policy.BASIC_PRO_VERSION, public_tier: offer.publicTier,
  allowed_periods: ['monthly'], entitlement_contract: JSON.parse(JSON.stringify(offer.contract)) }))

function adapter(platform, plan, options = {}) {
  const requests = []
  const tenant = { id: tenantId, slug: 'offline-company', platform, plan_tier: 'enterprise', status: 'active', ...options.tenant }
  const sub = options.sub === undefined ? { plan_id: plan?.id, status: 'active', current_period_end: '2026-12-01' } : options.sub
  const db = { from(table) {
    const ops = []
    const query = {}
    for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle']) query[method] = (...args) => { ops.push([method, ...args]); return query }
    query.then = (resolve, reject) => {
      const data = table === 'tenants' ? tenant : table === 'tenant_subscriptions' ? sub
        : ops.some(([method]) => method === 'maybeSingle') ? plan : options.candidates ?? []
      return Promise.resolve({ data, error: options.errorTable === table ? { message: 'Denied' } : null }).then(resolve, reject)
    }
    return query
  } }
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(`./${platform}-sync.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, { module: mod, exports: mod.exports, AbortSignal,
    process: { env: { BILLING_SYNC_SECRET: secret, STOCK_URL: 'https://offline.invalid', LMS_URL: 'https://offline.invalid' } },
    console: { error() {} }, fetch: async (url, request) => { requests.push({ url, ...request }); return { ok: true } },
    require(name) {
      if (name === 'crypto') return crypto
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => db }
      if (name === '@/lib/plan-catalog') return policy
      if (name === '@/lib/stock-paid-activation') return { deliverStockPaidActivation: async () => 'closed' }
      if (name === '@/lib/billing-sandbox-uat') return { sandboxSyncReplayProbeAllowed: () => false }
      if (/^@\/lib\/.+-sync$/.test(name)) return new Proxy({}, { get: () => () => { throw new Error('Unexpected partner dispatch') } })
      throw new Error(`Unexpected import ${name}`)
    },
  })
  return { requests, run: () => mod.exports[platform === 'stock' ? 'syncStockTenant' : 'syncLmsTenant'](tenantId, 'offline_test') }
}

for (const plan of rows) {
  test(`${plan.platform} ${plan.public_tier}: exact signed contract, finite capacity, status and expiry`, async () => {
    for (const status of ['active', 'suspended', 'cancelled']) {
      const mock = adapter(plan.platform, plan, { sub: { plan_id: plan.id, status, current_period_end: '2026-12-01' } })
      await mock.run()
      assert.equal(mock.requests.length, 1)
      const request = mock.requests[0], body = JSON.parse(request.body)
      assert.equal(request.url, 'https://offline.invalid/api/billing/sync')
      assert.equal(body.plan_id, plan.id)
      assert.equal(body.offer_version, policy.BASIC_PRO_VERSION)
      assert.equal(body.plan_tier, plan.entitlement_contract.portal_tier)
      assert.equal(body.max_active_users, plan.entitlement_contract.max_active_users)
      assert.deepEqual(body.entitlements, plan.entitlement_contract.features)
      assert.equal(body.public_tier, plan.public_tier)
      assert.equal(body.linked_tenant_id, tenantId)
      assert.equal(body.status, status)
      assert.equal(body.expires_at, '2026-12-01')
      const headers = request.headers
      assert.equal(headers['x-ja-signature'], crypto.createHmac('sha256', secret)
        .update(`${headers['x-ja-timestamp']}\n${headers['x-ja-nonce']}\n${request.body}`).digest('hex'))
    }
  })
}

for (const platform of ['lms', 'stock']) {
  const plan = rows.find((row) => row.platform === platform)
  for (const [label, altered, options] of [
    ['missing exact plan', null, { sub: { plan_id: plan.id } }],
    ['foreign platform', { ...plan, platform: 'clinic' }, {}],
    ['mismatched ID', { ...plan, id: 'unknown' }, { sub: { plan_id: plan.id } }],
    ['malformed contract', { ...plan, entitlement_contract: {} }, {}],
    ['unknown version', { ...plan, offer_version: 'unapproved' }, {}],
    ['wrong tenant', plan, { tenant: { id: 'foreign' } }],
    ...['tenants', 'tenant_subscriptions', 'subscription_plans'].map((errorTable) => [`${errorTable} read error`, plan, { errorTable }]),
  ]) test(`${platform} rejects ${label} without sending any entitlement`, async () => {
    const mock = adapter(platform, altered, options)
    await mock.run()
    assert.equal(mock.requests.length, 0)
  })

  test(`${platform} legacy contract retains legacy payload and tier mapping`, async () => {
    const mock = adapter(platform, { id: 'legacy', platform, tier: 'enterprise', max_users: 8 })
    await mock.run()
    const body = JSON.parse(mock.requests[0].body)
    assert.equal(body.plan_tier, 'pro')
    assert.equal(body.max_active_users, platform === 'stock' ? 8 : null)
    for (const field of ['offer_version', 'plan_id', 'public_tier', 'plan_display_name', 'entitlements']) assert.equal(field in body, false)
  })
}

test('Stock without plan ID requires one strict legacy contract; row age cannot select a plan', async () => {
  const legacy = { id: 'legacy', platform: 'stock', tier: 'enterprise', is_active: true, max_users: 8 }
  for (const candidates of [[], [legacy, { ...legacy, id: 'duplicate' }], rows.filter((row) => row.platform === 'stock')]) {
    const mock = adapter('stock', null, { sub: null, candidates })
    await mock.run()
    assert.equal(mock.requests.length, 0)
  }
  const mock = adapter('stock', null, { sub: null, candidates: [...rows, legacy] })
  await mock.run()
  assert.equal(mock.requests.length, 1)
  assert.equal(JSON.parse(mock.requests[0].body).max_active_users, 8)
  assert.equal('offer_version' in JSON.parse(mock.requests[0].body), false)
})
