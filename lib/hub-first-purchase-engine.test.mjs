// Offline unit tests: database writes and payment requests are in-memory spies.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { loadPricingPolicy, loadPricingServer } from './pricing-unit-harness.mjs'

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
  let liveInvoiceReads = 0
  const selectedPlan = { id: planId, name: 'Unit plan', platform: 'stock', tier: 'enterprise', is_active: true, price_monthly: 100000, price_yearly: 1000000, ...options.plan }
  const catalog = options.catalog ?? [selectedPlan]
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
      if (write) result = table === 'subscription_invoices' && write.method === 'insert' && options.invoiceConflict
        ? { data: null, error: { code: '23505' } }
        : table === 'subscription_invoices' && write.method === 'update' && write.args[0].snap_token && options.saveError
        ? { data: null, error: { code: 'UNAVAILABLE' } }
        : success({ id: table === 'tenant_subscriptions' ? 'unit-subscription' : 'unit-invoice' })
      else if (table === 'subscription_plans') {
        const single = call.operations.some((op) => op.method === 'maybeSingle' || op.method === 'single')
        const id = call.operations.find((op) => op.method === 'eq' && op.args[0] === 'id')?.args[1]
        result = options.catalogError ? { data: null, error: { message: 'Unavailable' } } : success(single ? catalog.find((plan) => plan.id === id) ?? null : catalog)
      }
      else if (table === 'tenants') result = success({ id: tenantId, name: 'Unit Business', platform: options.tenantPlatform ?? selectedPlan.platform, status: 'active' })
      else if (table === 'tenant_subscriptions') result = options.subscriptions?.[subscriptionReads++] ?? success(null)
      else if (table === 'subscription_invoices') result = call.operations.some((op) => op.method === 'gt') ? success([]) : success(options.liveInvoices?.[liveInvoiceReads++] ?? null)
      else throw new Error(`Unexpected table ${table}`)
      return Promise.resolve(result).then(resolve, reject)
    }
    return builder
  }
  const testModule = { exports: {} }
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, {
    module: testModule, exports: testModule.exports, Buffer, AbortSignal, Date: UnitDate, console: { error: () => {} },
    fetch: async (url, request) => {
      calls.push({ method: 'paymentFetch', url, body: JSON.parse(request.body), ...(options.sandboxUat ? { headers: request.headers } : {}) })
      if (options.fetchError) throw new Error('Lost provider response')
      return { ok: true, json: async () => ({ token: 'UNIT_SNAP_TOKEN', redirect_url: 'https://payments.example.test/checkout' }) }
    },
    require: (name) => {
      if (name === 'next/server') return { after: () => { throw new Error('No cross-portal work expected') } }
      if (name === 'date-fns') return { addMonths: () => { throw new Error('Unexpected activation') }, addYears: () => { throw new Error('Unexpected activation') } }
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => ({ from }) }
      if (name === '@/lib/midtrans') return {
        getPlatformMidtrans: async () => { calls.push({ method: 'paymentConfig' }); return { mode: 'sandbox', serverKey: 'SYNTHETIC_UNIT_KEY', snapApiUrl: 'https://provider.example.invalid' } },
        getMidtransMode: async () => options.currentMode ?? 'sandbox',
        normalizeOrderMode: mode => mode ?? 'sandbox',
        midtransConfigForMode: mode => { calls.push({ method: 'paymentConfig', mode }); return { mode, serverKey: 'SYNTHETIC_UNIT_KEY', snapApiUrl: 'https://sandbox.example.invalid' } },
      }
      if (name === '@/lib/billing-sandbox-uat') return {
        prepareSandboxCheckoutPlan: async plan => ({ plan: options.sandboxUat ? { ...plan, is_active: true, is_for_sale: true } : plan, sandboxUat: Boolean(options.sandboxUat) }),
        sandboxNotificationHeaders: enabled => enabled ? { 'X-Override-Notification': 'https://hub.webzoka.com/api/billing/webhook' } : {},
      }
      if (name === '@/lib/lms-sync') return { syncTenantPortal: () => { throw new Error('No portal request authorized') } }
      if (name === '@/lib/billing-email') return { sendSubscriptionPaidEmail: () => { throw new Error('No email expected') } }
      if (name === '@/lib/platform-settings') return { getPromoCampaign: async () => ({ enabled: Boolean(options.promo), tier: 'enterprise', discountPct: 50, months: 3, code: 'UNIT_PROMO' }), isCampaignActive: (campaign) => campaign.enabled }
      if (name === '@/lib/hub-app-url') return { hubAppUrl: () => 'https://hub.example.invalid' }
      if (name === '@/lib/plan-catalog') return loadPricingPolicy()
      // This legacy fixture keeps the new Company runtime source fuse closed.
      if (name === '@/lib/stock-billing-authority') return { stockBillingOperationError: async () => null }
      if (name === '@/lib/plan-catalog-server') return loadPricingServer(() => ({ from }), options.enabled, async () => Boolean(options.sandboxUat))
      throw new Error(`Unexpected billing dependency ${name}`)
    },
  }, { filename: 'lib/billing.ts' })
  return { calls,
    run: (args) => testModule.exports.selfServiceChange({ tenantId, planId: selectedPlan.id, period: 'monthly', ...args }),
    checkout: (args) => testModule.exports.createSubscriptionCheckout({ tenantId, planId: selectedPlan.id, period: 'monthly', ...args }),
  }
}

test('Company checkout reserves the durable order before gateway I/O and never retries an uncertain result', async () => {
  const h = engine({ fetchError: true })
  const result = await h.checkout({ durableCheckout: true })
  assert.equal(result.ok, false)
  assert.equal(result.status, 503)
  const paymentIndex = h.calls.findIndex(call => call.method === 'paymentFetch')
  const reservationIndex = h.calls.findIndex(call => call.operations?.some(op => op.method === 'update' && op.args[0].midtrans_order_id && !op.args[0].snap_token))
  assert.ok(reservationIndex >= 0 && reservationIndex < paymentIndex)
  assert.equal(h.calls.filter(call => call.method === 'paymentFetch').length, 1)
  assert.ok(!h.calls.some(call => call.operations?.some(op => op.method === 'update' && op.args[0].status === 'failed')))
  const pending = engine({ liveInvoices: [{ id: 'unit-invoice', redirect_url: null, midtrans_mode: 'sandbox', amount: 100000 }] })
  assert.equal((await pending.checkout({ durableCheckout: true })).status, 409)
  assert.ok(!pending.calls.some(call => ['paymentFetch', 'paymentConfig'].includes(call.method)))
})

test('Company double submission reuses an issued checkout; losing the saved link cannot create another charge', async () => {
  for (const invoiceConflict of [false, true]) {
    const live = { id: 'unit-invoice', redirect_url: 'https://sandbox.example.invalid/existing', amount: 100000, midtrans_mode: 'sandbox' }
    const h = engine({ invoiceConflict, liveInvoices: invoiceConflict ? [null, live] : [live] })
    const result = await h.checkout({ durableCheckout: true })
    assert.equal(result.ok, true); assert.equal(result.reused, true)
    assert.equal(h.calls.filter(call => call.method === 'paymentFetch').length, 0)
  }
  const lost = engine({ saveError: true })
  assert.equal((await lost.checkout({ durableCheckout: true })).status, 503)
  assert.equal(lost.calls.filter(call => call.method === 'paymentFetch').length, 1)
})

const hasMutation = (call) => call.operations?.some((op) => op.method === 'insert' || op.method === 'update')
const financialEffects = (calls) => calls.filter((call) => hasMutation(call) || call.method === 'paymentConfig' || call.method === 'paymentFetch')
for (const period of ['monthly', 'yearly']) {
  test(`guarded ${period} first purchase reuses unchanged pricing, invoice and payment behavior`, async () => {
    const actual = engine()
    const previous = engine({}, baseline)
    assert.deepEqual(plain(await actual.run({ period, firstPurchaseOnly: true })), plain(await previous.run({ period })))
    assert.deepEqual(financialEffects(actual.calls), financialEffects(previous.calls))
    assert.equal(actual.calls.filter((call) => call.method === 'paymentFetch').length, 1)
    assert.equal(actual.calls.find((call) => call.method === 'paymentFetch').body.transaction_details.gross_amount, period === 'monthly' ? 100000 : 1000000)
  })
}

test('first purchase preserves existing campaign pricing and payment metadata', async () => {
  const actual = engine({ promo: true })
  const previous = engine({ promo: true }, baseline)
  assert.deepEqual(plain(await actual.run({ firstPurchaseOnly: true })), plain(await previous.run({})))
  assert.deepEqual(financialEffects(actual.calls), financialEffects(previous.calls))
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
  assert.deepEqual(financialEffects(actual.calls), financialEffects(previous.calls))
})

const policy = loadPricingPolicy()
const approvedRows = policy.APPROVED_OFFERS.map((offer) => ({ id: offer.id, name: offer.name,
  platform: offer.platform, tier: offer.tier, tier_display_name: offer.name,
  price_monthly: offer.price, price_yearly: null, is_active: true, is_for_sale: true,
  offer_version: policy.BASIC_PRO_VERSION, public_tier: offer.publicTier,
  allowed_periods: ['monthly'], entitlement_contract: plain(offer.contract) }))

for (const plan of approvedRows) {
  test(`${plan.platform} ${plan.public_tier}: actual billing engine invoices exact approved monthly amount without legacy promo`, async () => {
    const mock = engine({ plan, catalog: approvedRows, enabled: true, promo: true })
    const result = plain(await mock.run({ firstPurchaseOnly: true }))
    assert.equal(result.ok, true)
    assert.equal(result.amount, plan.price_monthly)
    const invoice = mock.calls.find((call) => call.table === 'subscription_invoices' && hasMutation(call))
    assert.equal(invoice.operations.find((op) => op.method === 'insert').args[0].plan_id, plan.id)
    assert.equal(invoice.operations.find((op) => op.method === 'insert').args[0].promo_code, null)
    assert.equal(mock.calls.find((call) => call.method === 'paymentFetch').body.transaction_details.gross_amount, plan.price_monthly)
  })
}

const approved = approvedRows[2]
test('legacy annual upgrade retains the original engine behavior', async () => {
  const oldPlan = { id: 'SYNTHETIC-LEGACY-BASIC', platform: 'stock', tier: 'starter', is_active: true, price_monthly: 100000, price_yearly: 1200000 }
  const plan = { id: planId, platform: 'stock', tier: 'enterprise', is_active: true, price_monthly: 200000, price_yearly: 2400000 }
  const sub = { ...existing, plan_id: oldPlan.id, current_period_start: '2026-10-01T00:00:00Z', current_period_end: '2027-10-01T00:00:00Z' }
  const options = { plan, catalog: [oldPlan, plan], subscriptions: [success(sub), success(sub)] }
  const actual = engine(options), previous = engine(options, baseline)
  assert.deepEqual(plain(await actual.run({})), plain(await previous.run({})))
  assert.deepEqual(financialEffects(actual.calls), financialEffects(previous.calls))
})
test('prepaid monthly Basic upgrade never infers annual pricing from a long paid span', async () => {
  const basic = approvedRows.find(plan => plan.platform === 'stock' && plan.public_tier === 'basic')
  const pro = approvedRows.find(plan => plan.platform === 'stock' && plan.public_tier === 'pro')
  const sub = { ...existing, plan_id: basic.id, current_period_start: '2026-10-01T00:00:00Z', current_period_end: '2026-12-01T00:00:00Z' }
  const h = engine({ plan: pro, catalog: approvedRows, sandboxUat: true, subscriptions: [success(sub), success(sub)] })
  const result = await h.run({})
  assert.equal(result.ok, true)
  assert.equal(result.kind, 'checkout')
  assert.equal(result.changeType, 'upgrade')
  const expected = Math.round((359000 - 149000) * (Date.parse(sub.current_period_end) - UnitDate.now()) / (Date.parse(sub.current_period_end) - Date.parse(sub.current_period_start)))
  assert.equal(result.amount, expected)
  assert.ok(result.amount > 0)
  const invoice = h.calls.find(call => call.table === 'subscription_invoices' && call.operations?.some(op => op.method === 'insert'))
  assert.equal(invoice.operations.find(op => op.method === 'insert').args[0].period, 'monthly')
  assert.ok(!h.calls.some(call => call.table === 'tenants' && call.operations?.some(op => op.method === 'update')))
})
for (const [label, options, args] of [
  ['annual period', { enabled: true }, { period: 'yearly' }],
  ['closed sales', {}, {}],
  ['foreign tenant platform', { enabled: true, tenantPlatform: 'lms' }, {}],
  ['malformed entitlement', { enabled: true, plan: { ...approved, entitlement_contract: {} }, catalog: [{ ...approved, entitlement_contract: {} }, approvedRows[3]] }, {}],
  ['repriced offer', { enabled: true, plan: { ...approved, price_monthly: 1 }, catalog: [{ ...approved, price_monthly: 1 }, approvedRows[3]] }, {}],
  ['catalog read error', { enabled: true, catalogError: true }, {}],
  ['unknown owned contract', { enabled: true, subscriptions: [success({ ...existing, plan_id: 'unknown' })] }, {}],
  ['legacy conversion', { enabled: true, catalog: [...approvedRows, { id: planId, platform: 'stock', tier: 'enterprise', is_active: true, price_monthly: 100000, price_yearly: 1000000 }], subscriptions: [success(existing)] }, {}],
]) {
  for (const entry of ['run', 'checkout']) test(`${entry} rejects ${label} before financial writes or provider access`, async () => {
    const mock = engine({ plan: approved, catalog: approvedRows, ...options })
    assert.equal((await mock[entry](args)).ok, false)
    assert.deepEqual(financialEffects(mock.calls), [])
  })
}

test('owned Basic/Pro monthly renewal survives closed new sales', async () => {
  const owned = { ...existing, plan_id: approved.id, status: 'expired' }
  const mock = engine({ plan: approved, catalog: approvedRows,
    subscriptions: [success(owned), success(owned)] })
  const result = await mock.run({})
  assert.equal(result.ok, true)
  assert.equal(result.amount, 149000)
})

test('the contained Sandbox engine invoices an inactive approved offer without opening general sales', async () => {
  const rows = approvedRows.filter(plan => plan.platform === 'stock').map(plan => ({ ...plan, is_active: false, is_for_sale: false }))
  const before = JSON.stringify(rows)
  const mock = engine({ plan: rows[0], catalog: rows, sandboxUat: true, currentMode: 'production' })
  const result = await mock.run({ firstPurchaseOnly: true })
  assert.equal(result.ok, true)
  assert.equal(result.amount, 149000)
  assert.equal(JSON.stringify(rows), before)
  assert.equal(policy.basicProEnabled('true'), false)
  assert.equal(mock.calls.find(call => call.method === 'paymentConfig').mode, 'sandbox')
  assert.equal(mock.calls.find(call => call.method === 'paymentFetch').headers['X-Override-Notification'], 'https://hub.webzoka.com/api/billing/webhook')
})

for (const race of [false, true]) {
  test(`invoice reuse preserves the issued amount and refuses cross-environment links${race ? ' after an insert race' : ''}`, async () => {
    const live = { id: 'issued-invoice', redirect_url: 'https://sandbox.example.invalid/existing', amount: 75000, midtrans_mode: 'sandbox' }
    const options = { invoiceConflict: race, liveInvoices: race ? [null, live] : [live] }
    const result = await engine(options).checkout({})
    assert.equal(result.ok, true)
    assert.equal(result.amount, 75000)
    assert.equal(result.reused, true)
    const wrong = await engine({ ...options, liveInvoices: race ? [null, { ...live, midtrans_mode: 'production' }] : [{ ...live, midtrans_mode: 'production' }] }).checkout({})
    assert.equal(wrong.ok, false)
    assert.equal(wrong.status, 409)
  })
}
