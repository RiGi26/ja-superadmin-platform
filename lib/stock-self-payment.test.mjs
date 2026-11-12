import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadStockModule } from './stock-self-payment-unit-harness.mjs'
import { loadPricingPolicy } from './pricing-unit-harness.mjs'

const policy = loadPricingPolicy()
const selection = loadStockModule('./stock-purchase-policy.ts', { '@/lib/plan-catalog': policy })
const plain = value => JSON.parse(JSON.stringify(value))
const id = number => `40000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const actor = { subject: id(1), session: id(2), customer: true, until: new Date(Date.now() + 25_000).toISOString() }
const offers = policy.APPROVED_OFFERS.filter(row => row.platform === 'stock')
const rows = offers.map(offer => ({ id: offer.id, platform: offer.platform, name: offer.name, tier: offer.tier,
  tier_display_name: offer.name, price_monthly: offer.price, price_yearly: null, is_active: true, is_for_sale: true,
  offer_version: policy.BASIC_PRO_VERSION, public_tier: offer.publicTier, allowed_periods: ['monthly'], entitlement_contract: plain(offer.contract) }))
const workspace = { companyId: id(3), companyName: 'Synthetic Bakery', reservationId: id(4), coreTenantId: id(5), ownerId: actor.subject,
  stockTenantId: id(6), activation: 'not_started', hasPaidContract: false, subscription: null, invoices: [] }
const invoiceId = id(7)
const paidInvoice = { id: invoiceId, planId: offers[0].id, amount: 149000,
  status: 'paid', createdAt: '2026-11-06T18:00:00Z', paidAt: '2026-11-07T01:00:00Z' }

function harness(options = {}) {
  const calls = []; let identities = 0, reads = 0
  const own = { ...plain(workspace), ...options.workspace }
  const plan = offers[options.pro ? 1 : 0]
  const redirectUrl = `https://app.sandbox.midtrans.com/snap/v4/redirection/${invoiceId}`
  const client = { rpc: async (name,args) => {
    calls.push({ kind: 'read', name, args })
    if (name === 'stock_billing_read_intent' || name === 'stock_billing_read_workspace_intent') return { data: options.intent ?? null, error: null }
    return { data: options.snapshots?.[reads++] ?? [own], error: options.readError ? { code: 'DENIED' } : null }
  } }
  const admin = {
    rpc: async (name, args) => {
      calls.push({ kind: 'write', name, args: plain(args) })
      return name === 'stock_billing_prepare_account'
        ? { data: options.prepareData ?? { tenantId: own.coreTenantId, planId: plan.id }, error: options.prepareError ?? null }
        : { data: { planId: args.p_plan, companyId: args.p_company, reservationId: args.p_company ? own.reservationId : null, commandId: id(8) }, error: null }
    },
    from(table) {
      calls.push({ kind: 'invoice', table })
      const builder = { select() { return builder }, eq() { return builder }, maybeSingle: async () => ({ error: null,
        data: { id: invoiceId, tenant_id: own.coreTenantId, plan_id: plan.id, period: 'monthly', amount: plan.price,
          status: 'awaiting_payment', midtrans_mode: 'sandbox', redirect_url: redirectUrl, ...options.storedInvoice } }) }
      return builder
    },
  }
  const pricing = { ...policy,
    saleablePlans: source => policy.saleablePlans(source, options.salesEnabled !== false),
    purchaseError: (plan, source, current, period, enabled) => policy.purchaseError(plan, source, current, period, enabled ?? options.salesEnabled !== false),
  }
  const adapter = loadStockModule('./stock-self-payment.ts', {
    '@/lib/stock-membership-protocol': { STOCK_MEMBERSHIP_PREPARATION_ENABLED: options.membershipEnabled === true },
    '@/lib/stock-membership-purchase': { stockMembershipPurchaseReady: async () => {
      calls.push({kind:'readiness'});return options.membershipReady === true
    } },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/core-registry-native': { verifyNativeCoreSession: async () => {
      calls.push({ kind: 'auth' })
      const value = options.actors?.[identities++] ?? actor
      if (value instanceof Error) throw value
      return value
    } },
    '@/lib/plan-catalog-server': { readCatalogPlans: async () => options.catalog === null ? null : options.catalog ?? rows },
    '@/lib/plan-catalog': pricing,
    '@/lib/stock-price-quotes': loadStockModule('./stock-price-quotes.ts', { '@/lib/plan-catalog': pricing }),
    '@/lib/stock-purchase-policy': { ...selection, STOCK_PAID_BILLING_RUNTIME_ENABLED: options.enabled !== false, stockPurchaseAvailable: enabled => options.enabled !== false && enabled },
    '@/lib/stock-billing-authority': { issueStockBillingAuthority: async () => options.authorityDenied ? null : { kind: 'stock_company_purchase' } },
    '@/lib/billing-sandbox-uat': { sandboxPurchaseAllowed: async row => options.sandbox === true || options.sandboxPlanId === row.id },
    '@/lib/billing': { selfServiceChange: async args => {
      calls.push({ kind: 'engine', args: plain(args) })
      if (options.engineError) throw new Error('SYNTHETIC_UNCERTAIN_RESPONSE')
      return { ok: true, kind: 'checkout', invoiceId, redirectUrl, amount: plan.price }
    } },
  })
  return { module: adapter, calls, plan, own, run: () => adapter.startStockPurchase({ plan: plan.id, company: own.companyId }) }
}

function invoiceDownload(h) {
  return loadStockModule('../app/hub/stock/invoices/[companyId]/[invoiceId]/route.ts', {
    '@/lib/stock-self-payment': h.module,
    '@/lib/stock-invoice-display': loadStockModule('./stock-invoice-display.ts', {
      '@/lib/plan-catalog': policy,
    }),
  }).GET
}

test('Stock invoice download matches the owned billing record without writes or shared caching', async () => {
  const h = harness({ workspace: { invoices: [paidInvoice] } })
  const get = invoiceDownload(h)
  const response = await get(new Request('https://hub.example'), {
    params: Promise.resolve({ companyId: workspace.companyId, invoiceId }),
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8')
  assert.equal(response.headers.get('content-disposition'), `attachment; filename="webzoka-stock-${invoiceId}.txt"`)
  const text = await response.text()
  for (const value of [workspace.companyName, invoiceId, offers[0].name, '149.000', 'Lunas', 'Tanggal bayar']) {
    assert.ok(text.includes(value), value)
  }
  assert.deepEqual(h.calls.map(call => call.kind), ['auth', 'read', 'auth'])
})

test('Stock invoice download denies foreign, anonymous, revoked and malformed requests without revealing records', async () => {
  const current = { workspace: { invoices: [paidInvoice] } }
  for (const [options, company, invoice] of [
    [current, id(99), invoiceId],
    [current, workspace.companyId, id(99)],
    [{ ...current, actors: [new Error('SIGNED_OUT')] }, workspace.companyId, invoiceId],
    [{ ...current, actors: [actor, { ...actor, session: id(99) }] }, workspace.companyId, invoiceId],
    [{ workspace: { invoices: [paidInvoice], ownerId: id(99) } }, workspace.companyId, invoiceId],
    [current, 'invalid', invoiceId],
    [current, workspace.companyId, 'invalid'],
  ]) {
    const h = harness(options)
    const response = await invoiceDownload(h)(new Request('https://hub.example'), {
      params: Promise.resolve({ companyId: company, invoiceId: invoice }),
    })
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('content-disposition'), null)
    assert.equal(await response.text(), '')
    assert.ok(h.calls.every(call => ['auth', 'read'].includes(call.kind)))
    if (company === 'invalid' || invoice === 'invalid') assert.equal(h.calls.length, 0)
  }
})

for (const pro of [false, true]) test(`Company ${pro ? 'Pro' : 'Basic'} checkout derives tenant and monthly contract server-side`, async () => {
  const h = harness({ pro })
  const result = await h.run()
  assert.equal(result.status, 'checkout')
  assert.equal(h.calls.filter(call => call.kind === 'engine').length, 1)
  assert.deepEqual(h.calls.find(call => call.kind === 'engine').args, { tenantId: workspace.coreTenantId, planId: h.plan.id, period: 'monthly', durableCheckout: true, stockAuthority: { kind: 'stock_company_purchase' } })
  const prepared = h.calls.find(call => call.name === 'stock_billing_prepare_account')
  assert.equal(prepared.args.p_actor, actor.subject)
  assert.equal(prepared.args.p_session, actor.session)
  assert.equal(prepared.args.p_reservation, workspace.reservationId)
})

test('closed source gate performs no Auth, SQL, or payment operations', async () => {
  const h = harness({ enabled: false })
  assert.equal((await h.run()).status, 'closed')
  assert.equal(await h.module.rememberStockPurchase(h.plan.id), null)
  assert.equal(h.calls.length, 0)
})
test('new purchase needs reciprocal readiness before every financial mutation',async()=>{
  const h=harness({membershipEnabled:true})
  assert.equal((await h.run()).status,'preparation_required')
  assert.ok(!h.calls.some(call=>call.kind==='write'||call.kind==='engine'))
  assert.equal((await harness({membershipEnabled:true,membershipReady:true}).run()).status,'checkout')
})

test('membership workspace cannot start an invoice while reciprocal preparation is closed', async () => {
  const h = harness({ workspace: { accessProtocol: 'membership' }, membershipReady: true })
  assert.equal((await h.run()).status, 'preparation_required')
  assert.ok(!h.calls.some(call => ['readiness', 'write', 'engine'].includes(call.kind)))
})

for (const [name, options] of [
  ['non-customer', { actors: [{ ...actor, customer: false }] }],
  ['revoked native session', { actors: [new Error('AUTH_REVOKED')] }],
  ['foreign Owner', { workspace: { ownerId: id(99) } }],
  ['missing Stock resource', { workspace: { stockTenantId: null } }],
  ['failed own-row read', { readError: true }],
  ['closed new sales', { salesEnabled: false }],
  ['repriced catalog', { catalog: rows.map(row => ({ ...row, price_monthly: row.price_monthly + 1 })) }],
  ['missing catalog', { catalog: null }],
  ['conflicting prepared mapping', { prepareData: { tenantId: id(99), planId: offers[0].id } }],
  ['session changes before preparation', { actors: [actor, { ...actor, session: id(99) }] }],
  ['ownership disappears before payment', { snapshots: [[workspace], []] }],
  ['Company billing authority is denied', { authorityDenied: true }],
]) test(`${name} prevents gateway invocation`, async () => {
  const h = harness(options)
  assert.notEqual((await h.run()).status, 'checkout')
  assert.equal(h.calls.filter(call => call.kind === 'engine').length, 0)
})

test('paid activation pending and already-active subscriptions never create another charge', async () => {
  for (const activation of ['pending', 'active']) {
    const h = harness({ workspace: { activation, hasPaidContract: true, subscription: { planId: offers[0].id, status: 'active', expiresAt: new Date(Date.now() + 60_000).toISOString() },
      invoices: [{ id: invoiceId, planId: offers[0].id, amount: 149000, status: 'paid', createdAt: new Date().toISOString(), paidAt: new Date().toISOString() }] } })
    assert.equal((await h.run()).status, 'paid')
    assert.equal(h.calls.filter(call => call.kind === 'write' || call.kind === 'engine').length, 0)
  }
})

test('an existing approved monthly contract can renew after expiry with new sales closed', async () => {
  const h = harness({ salesEnabled: false, workspace: { activation: 'suspended', hasPaidContract: true,
    subscription: { planId: offers[0].id, status: 'past_due', expiresAt: new Date(Date.now() - 1000).toISOString() } } })
  assert.equal((await h.run()).status, 'checkout')
})
test('an unpaid draft subscription cannot bypass closed new sales', async () => {
  const h = harness({ salesEnabled: false, workspace: { subscription: { planId: offers[0].id, status: 'unpaid', expiresAt: null } } })
  assert.equal((await h.run()).status, 'closed')
  assert.equal(h.calls.filter(call => call.kind === 'engine' || call.kind === 'write').length, 0)
})

test('uncertain checkout response is not retried by the Company adapter', async () => {
  const h = harness({ engineError: true })
  assert.equal((await h.run()).status, 'unavailable')
  assert.equal(h.calls.filter(call => call.kind === 'engine').length, 1)
})

test('stored invoice identity, amount, period, and provider mode control the redirect', async () => {
  for (const storedInvoice of [{ plan_id: offers[1].id }, { amount: 1 }, { period: 'yearly' }, { midtrans_mode: 'production' }, { status: 'paid' }]) {
    const h = harness({ storedInvoice })
    assert.equal((await h.run()).status, 'unavailable')
  }
})

test('package intent belongs to the current subject and rejects foreign workspace selectors', async () => {
  const h = harness()
  const remembered = await h.module.rememberStockPurchase(h.plan.id, h.own.companyId)
  assert.equal(remembered.planId, h.plan.id)
  const write = h.calls.find(call => call.name === 'stock_billing_remember_intent')
  assert.equal(write.args.p_actor, actor.subject)
  assert.equal(await h.module.rememberStockPurchase(h.plan.id, id(99)), null)
})

test('explicit workspace intent read cannot silently use another last-selected workspace', async () => {
  const value={planId:offers[0].id,companyId:workspace.companyId,reservationId:workspace.reservationId,commandId:id(8)}
  const h=harness({intent:value})
  assert.equal((await h.module.readStockPurchaseIntent(workspace.companyId)).commandId,value.commandId)
  const read=h.calls.find(call=>call.name==='stock_billing_read_workspace_intent')
  assert.equal(read.args.p_company,workspace.companyId)
  assert.equal(h.calls.some(call=>call.name==='stock_billing_read_intent'),false)
  const foreign=harness({intent:{...value,companyId:id(99)}})
  assert.equal(await foreign.module.readStockPurchaseIntent(workspace.companyId),null)
  const before=h.calls.length
  assert.equal(await h.module.readStockPurchaseIntent('invalid'),null)
  assert.equal(h.calls.slice(before).some(call=>call.kind==='read'),false)
})

test('an exact sandbox Company can use inactive offers without changing public catalog rows', async () => {
  const inactive = rows.map(row => ({ ...row, is_active: false, is_for_sale: false }))
  const before = JSON.stringify(inactive)
  const allowed = harness({ catalog: inactive, salesEnabled: false, sandbox: true })
  assert.equal((await allowed.run()).status, 'checkout')
  assert.equal(JSON.stringify(inactive), before)
  assert.equal((await harness({ catalog: inactive, salesEnabled: false }).run()).status, 'closed')
})

test('sandbox checkout availability is private to the verified selected Company; public quotes remain closed', async () => {
  const h = harness({ salesEnabled: false, sandbox: true })
  assert.equal((await h.module.readStockPurchaseOffers()).salesEnabled, false)
  const own = await h.module.readStockPurchaseOffers(h.own.companyId)
  assert.equal(own.salesEnabled, true); assert.equal(own.sandbox, true)
  assert.equal((await h.module.readStockPurchaseOffers(id(99))).salesEnabled, false)
  const ordinary = harness({ salesEnabled: false })
  assert.equal((await ordinary.module.readStockPurchaseOffers(ordinary.own.companyId)).salesEnabled, false)
})

test('a plan-bound sandbox Company can quote and buy only its selected approved plan', async () => {
  const h = harness({ pro: true, salesEnabled: false, sandboxPlanId: offers[1].id })
  assert.equal((await h.module.readStockPurchaseOffers()).salesEnabled, false)
  const selected = await h.module.readStockPurchaseOffers(h.own.companyId, offers[1].id)
  assert.equal(selected.salesEnabled, true)
  assert.equal(selected.sandbox, true)
  assert.equal((await h.module.readStockPurchaseOffers(h.own.companyId, offers[0].id)).salesEnabled, false)
  assert.equal((await h.module.readStockPurchaseOffers(h.own.companyId, id(99))).salesEnabled, false)
  assert.equal((await h.module.readStockPurchaseOffers(id(99), offers[1].id)).salesEnabled, false)
  assert.equal((await h.module.startStockPurchase({ company: h.own.companyId, plan: offers[0].id })).status, 'closed')
  assert.ok(!h.calls.some(call => call.kind === 'engine' || call.kind === 'write'))
  assert.equal((await h.run()).status, 'checkout')
  assert.equal(h.calls.filter(call => call.kind === 'engine').length, 1)
})
