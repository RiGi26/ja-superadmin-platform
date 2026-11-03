import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadStockModule } from './stock-self-payment-unit-harness.mjs'
import { loadPricingPolicy } from './pricing-unit-harness.mjs'

const catalog = loadPricingPolicy()
const policy = loadStockModule('./stock-purchase-policy.ts', { '@/lib/plan-catalog': catalog })
const id = n => `70000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const plan = catalog.APPROVED_OFFERS.find(row => row.platform === 'stock').id
function harness(options = {}) {
  const calls = []
  let reads = 0, ownerReads = 0
  const actor = { subject: id(1), session: id(2), until: new Date(Date.now()+25_000).toISOString(), customer: true }
  const module = loadStockModule('./stock-billing-authority.ts', {
    '@/lib/stock-membership-protocol': { STOCK_MEMBERSHIP_PREPARATION_ENABLED: options.membershipEnabled === true },
    '@/lib/stock-membership-purchase': { stockMembershipPurchaseReady: async () => {
      calls.push('readiness');return options.membershipReady === true
    } },
    '@/lib/stock-purchase-policy': { ...policy, STOCK_PAID_BILLING_RUNTIME_ENABLED: options.enabled !== false },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async () => {
      calls.push('managed-read');return { data: options.managed ?? true, error: options.error ?? null }
    }, from: table => {
      calls.push(['contract-read', table])
      const builder = { select() { return this }, eq() { return this }, limit() { return this }, async maybeSingle() {
        return { error: options.contractError ?? null, data: options.paidContract ? (table === 'tenant_subscriptions' ? { plan_id: plan } : { id: id(20) }) : null }
      } }
      return builder
    } }) },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => {
      ownerReads++
      return { data: [{ companyId:id(3),coreTenantId:id(4),ownerId:options.foreign||(options.revokedOwner&&ownerReads>1)?id(99):actor.subject,stockTenantId:id(5),hasPaidContract:options.paidContract===true }],error:null }
    } }) },
    '@/lib/core-registry-native': { verifyNativeCoreSession: async () => {
      calls.push('auth');reads++
      if(options.revoked && reads>2) throw new Error('SESSION_REVOKED')
      return actor
    } },
  })
  return { module,calls,issue:()=>module.issueStockBillingAuthority({companyId:id(3),tenantId:id(4),planId:plan}) }
}

test('only an opaque current Owner proof authorizes a managed monthly purchase',async()=>{
  const h=harness(),authority=await h.issue()
  assert.ok(authority)
  assert.equal(await h.module.stockBillingOperationError(id(4),plan,'monthly',authority),null)
  for(const [tenant,selected,period,proof] of [
    [id(4),plan,'monthly',undefined], [id(4),plan,'monthly',JSON.parse(JSON.stringify(authority))],
    [id(99),plan,'monthly',authority], [id(4),plan,'yearly',authority],
    [id(4),'5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002','monthly',authority],
  ]) assert.equal((await h.module.stockBillingOperationError(tenant,selected,period,proof)).status,403)
})
test('new Company financial authority requires reciprocal preparation while paid renewals remain eligible',async()=>{
  const partial=harness({membershipEnabled:true})
  assert.equal(await partial.issue(),null);assert.ok(partial.calls.includes('readiness'))
  assert.ok(await harness({membershipEnabled:true,membershipReady:true}).issue())
  const paid=harness({membershipEnabled:true,paidContract:true})
  assert.ok(await paid.issue());assert.ok(!paid.calls.includes('readiness'))
})
test('foreign Owner and a revoked native session cannot issue or reuse authority',async()=>{
  assert.equal(await harness({foreign:true}).issue(),null)
  const h=harness({revoked:true}),authority=await h.issue()
  assert.equal((await h.module.stockBillingOperationError(id(4),plan,'monthly',authority)).status,403)
})

test('revoking Company ownership invalidates an issued proof even while its native session remains live', async () => {
  const h = harness({ revokedOwner: true }), authority = await h.issue()
  assert.ok(authority)
  assert.equal((await h.module.stockBillingOperationError(id(4), plan, 'monthly', authority)).status, 403)
})
test('legacy contracts remain unchanged and an unavailable Company classifier fails closed',async()=>{
  const legacy=harness({managed:false})
  assert.equal(await legacy.module.stockBillingOperationError(id(4),id(90),'yearly'),null)
  assert.equal(legacy.calls.includes('auth'),false)
  assert.equal((await harness({error:{code:'UNAVAILABLE'}}).module.stockBillingOperationError(id(4),plan,'monthly')).status,503)
  const closed=harness({enabled:false})
  assert.equal(await closed.module.stockBillingOperationError(id(4),plan,'yearly'),null)
  assert.equal(closed.calls.length,0)
})

test('legacy tokens cannot start new Stock Company offers; exact paid historical contracts can still renew', async () => {
  const empty = harness({ managed: false })
  assert.equal((await empty.module.stockBillingOperationError(id(4), plan, 'monthly')).status, 403)
  const paid = harness({ managed: false, paidContract: true })
  assert.equal(await paid.module.stockBillingOperationError(id(4), plan, 'monthly'), null)
  assert.equal((await paid.module.stockBillingOperationError(id(4), plan, 'yearly')).status, 403)
  assert.equal((await harness({ managed: false, contractError: { code: 'UNAVAILABLE' } }).module.stockBillingOperationError(id(4), plan, 'monthly')).status, 503)
  assert.ok(!paid.calls.includes('auth'))
})
test('all shared financial entrypoints reject a legacy token or JSON lookalike before financial reads',async()=>{
  const h=harness()
  const engine=loadStockModule('./billing.ts',{
    'next/server':{},'date-fns':{},'@/lib/midtrans':{},'@/lib/lms-sync':{},'@/lib/billing-email':{},
    '@/lib/platform-settings':{},'@/lib/hub-app-url':{},'@/lib/plan-catalog':catalog,
    '@/lib/plan-catalog-server':{},'@/lib/billing-sandbox-uat':{},
    '@/lib/stock-billing-authority':h.module,
    '@/lib/supabase/admin':{createAdminClient:()=>{throw new Error('Financial read or write must not be reached')}},
  })
  const args={tenantId:id(4),planId:plan,period:'monthly',stockAuthority:{kind:'stock_company_purchase'}}
  assert.equal((await engine.selfServiceChange(args)).status,403)
  assert.equal((await engine.createSubscriptionCheckout(args)).status,403)
  assert.equal((await engine.cancelScheduledChange(id(4))).ok,false)
})
