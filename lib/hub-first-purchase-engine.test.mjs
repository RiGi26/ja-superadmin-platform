// Offline unit tests: database writes and payment requests are in-memory spies.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const current = readFileSync(join(root, 'lib/billing.ts'), 'utf8')
const baseline = execFileSync('git', ['-C', root, 'show', '8a9ae5e7d61b706c3bd87f5516d759560876bad5:lib/billing.ts'], { encoding: 'utf8' })
const tenantId = '22222222-2222-4222-8222-222222222222'
const planId = '44444444-4444-4444-8444-444444444444'
const success = (data) => ({ data, error: null })
const plain = (value) => JSON.parse(JSON.stringify(value))
class UnitDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-21T00:00:00Z'])) }
  static now() { return Date.parse('2026-10-21T00:00:00Z') }
}

function engine(options = {}, source = current) {
  const calls = []
  let subscriptionReads = 0
  const selectedPlan = { id: planId, name: 'Unit plan', platform: 'stock', tier: 'enterprise', is_active: true, price_monthly: 100000, price_yearly: 1000000 }
  function from(table) {
    const call = { table, operations: [] }
    calls.push(call)
    const builder = {}
    for (const method of ['select', 'eq', 'gt', 'in', 'order', 'limit', 'maybeSingle', 'single', 'insert', 'update']) {
      builder[method] = (...args) => { call.operations.push({ method, args: plain(args) }); return builder }
    }
    builder.then = (resolve, reject) => {
      const write = call.operations.find((op) => op.method === 'insert' || op.method === 'update')
      let result
      if (write) result = success({ id: table === 'tenant_subscriptions' ? 'unit-subscription' : 'unit-invoice' })
      else if (table === 'subscription_plans') result = success(selectedPlan)
      else if (table === 'tenants') result = success({ id: tenantId, name: 'Unit Business', status: 'active' })
      else if (table === 'tenant_subscriptions') result = options.subscriptions?.[subscriptionReads++] ?? success(null)
      else if (table === 'subscription_invoices') result = call.operations.some((op) => op.method === 'gt') ? success([]) : success(null)
      else throw new Error(`Unexpected table ${table}`)
      return Promise.resolve(result).then(resolve, reject)
    }
    return builder
  }
  const testModule = { exports: {} }
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, {
    module: testModule, exports: testModule.exports, Buffer, Date: UnitDate, console: { error: () => {} },
    fetch: async (url, request) => {
      calls.push({ method: 'paymentFetch', url, body: JSON.parse(request.body) })
      return { ok: true, json: async () => ({ token: 'UNIT_SNAP_TOKEN', redirect_url: 'https://payments.example.test/checkout' }) }
    },
    require: (name) => {
      if (name === 'next/server') return { after: () => { throw new Error('No cross-portal work expected') } }
      if (name === 'date-fns') return { addMonths: () => { throw new Error('Unexpected activation') }, addYears: () => { throw new Error('Unexpected activation') } }
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => ({ from }) }
      if (name === '@/lib/midtrans') return { getPlatformMidtrans: async () => { calls.push({ method: 'paymentConfig' }); return { mode: 'sandbox', serverKey: 'SYNTHETIC_UNIT_KEY', snapApiUrl: 'https://provider.example.invalid' } } }
      if (name === '@/lib/lms-sync') return { syncTenantPortal: () => { throw new Error('No portal request authorized') } }
      if (name === '@/lib/billing-email') return { sendSubscriptionPaidEmail: () => { throw new Error('No email expected') } }
      if (name === '@/lib/platform-settings') return { getPromoCampaign: async () => ({ enabled: Boolean(options.promo), tier: 'enterprise', discountPct: 50, months: 3, code: 'UNIT_PROMO' }), isCampaignActive: (campaign) => campaign.enabled }
      if (name === '@/lib/hub-app-url') return { hubAppUrl: () => 'https://hub.example.invalid' }
      throw new Error(`Unexpected billing dependency ${name}`)
    },
  }, { filename: 'lib/billing.ts' })
  return { calls, run: (args) => testModule.exports.selfServiceChange({ tenantId, planId, period: 'monthly', ...args }) }
}

const hasMutation = (call) => call.operations?.some((op) => op.method === 'insert' || op.method === 'update')
for (const period of ['monthly', 'yearly']) {
  test(`guarded ${period} first purchase reuses unchanged pricing, invoice and payment behavior`, async () => {
    const actual = engine()
    const previous = engine({}, baseline)
    assert.deepEqual(plain(await actual.run({ period, firstPurchaseOnly: true })), plain(await previous.run({ period })))
    assert.deepEqual(actual.calls, previous.calls)
    assert.equal(actual.calls.filter((call) => call.method === 'paymentFetch').length, 1)
    assert.equal(actual.calls.find((call) => call.method === 'paymentFetch').body.transaction_details.gross_amount, period === 'monthly' ? 100000 : 1000000)
  })
}

test('first purchase preserves existing campaign pricing and payment metadata', async () => {
  const actual = engine({ promo: true })
  const previous = engine({ promo: true }, baseline)
  assert.deepEqual(plain(await actual.run({ firstPurchaseOnly: true })), plain(await previous.run({})))
  assert.deepEqual(actual.calls, previous.calls)
  assert.equal(actual.calls.find((call) => call.method === 'paymentFetch').body.transaction_details.gross_amount, 50000)
})

const existing = { id: 'existing-subscription', tenant_id: tenantId, status: 'active', plan_id: planId, current_period_start: '2026-10-01', current_period_end: '2026-11-01' }
for (const [name, subscriptions] of [
  ['existing subscription', [success(existing)]],
  ['query error', [{ data: null, error: { message: 'Denied' } }]],
  ['ambiguous subscriptions', [success([existing, existing])]],
  ['missing data field', [{ error: null }]],
  ['subscription appears at final engine read', [success(null), success(existing)]],
  ['final engine read fails', [success(null), { data: null, error: { message: 'Denied' } }]],
]) {
  test(`${name} prevents guarded first purchase before writes or provider calls`, async () => {
    const mock = engine({ subscriptions })
    const result = plain(await mock.run({ firstPurchaseOnly: true }))
    assert.equal(result.ok, false)
    assert.equal(result.status, 409)
    assert.ok(!mock.calls.some(hasMutation))
    assert.ok(!mock.calls.some((call) => call.method === 'paymentConfig' || call.method === 'paymentFetch'))
  })
}

test('legacy renewal callers without the new guard retain baseline behavior', async () => {
  const options = { subscriptions: [success({ ...existing, status: 'expired' }), success({ id: existing.id })] }
  const actual = engine(options)
  const previous = engine(options, baseline)
  assert.deepEqual(plain(await actual.run({})), plain(await previous.run({})))
  assert.deepEqual(actual.calls, previous.calls)
})
