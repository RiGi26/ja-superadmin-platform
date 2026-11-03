import assert from 'node:assert/strict'
import test from 'node:test'
import { loadStockModule, stockPolicyFixture } from './stock-self-payment-unit-harness.mjs'

const normalize = loadStockModule('hub-e1-rewrite-query.ts').hubE1RewriteQuery
const plan = '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'
function checkout(host = 'hub.webzoka.com', options = {}) {
  const calls = []
  const api = loadStockModule('../app/hub/checkout/stock/page.tsx', {
    'next/headers': { headers: async () => new Headers({ host }) },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT:' + path) } },
    '@/lib/hub-e1-rewrite-query': { hubE1RewriteQuery: normalize },
    '@/lib/supabase/server': { createClient: async () => { calls.push('auth'); return { auth: { getUser: async () => ({ data: { user: { email_confirmed_at: '2026-11-02', is_anonymous: false } } }) } } } },
    '@/lib/stock-self-payment': {
      readStockPurchaseOffers: async () => ({ salesEnabled: false, plans: [{ id: plan }] }),
      readStockBillingAccount: async () => options.account ?? { status: 'unavailable', workspaces: [] },
      readStockPurchaseIntent: async () => options.intent ?? null,
    },
    '@/lib/stock-membership-protocol': { STOCK_MEMBERSHIP_PREPARATION_ENABLED: options.enabled === true },
    '@/lib/stock-membership-purchase': { stockMembershipPurchaseReady: async (_client, company) => {
      calls.push(company);return options.ready === true
    } },
    '@/lib/stock-purchase-policy': stockPolicyFixture,
    './StockCheckoutView': { StockCheckoutView() {} },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  })
  return { page: api.default, calls }
}

test('verified canonical checkout retains package when framework rewrite adds exact host', async () => {
  const c = checkout()
  const view = await c.page({ searchParams: Promise.resolve({ plan, host: 'hub.webzoka.com' }) })
  assert.equal(view.props.plan.id, plan)
  assert.equal(view.props.salesEnabled, false)
  assert.deepEqual(c.calls, ['auth'])
})

test('only verified reciprocal readiness removes workspace confirmation; result selectors cannot fake it',async()=>{
  const company='87000000-0000-4000-8000-000000000001',reservation='87000000-0000-4000-8000-000000000002',
    command='87000000-0000-4000-8000-000000000003'
  const workspace={companyId:company,reservationId:reservation,stockTenantId:'87000000-0000-4000-8000-000000000004',hasPaidContract:false}
  const options={enabled:true,account:{status:'ready',workspaces:[workspace]},
    intent:{planId:plan,companyId:company,reservationId:reservation,commandId:command}}
  const c=checkout('hub.webzoka.com',options)
  const view=await c.page({searchParams:Promise.resolve({plan,company,result:'prepared'})})
  assert.equal(view.props.preparationRequired,true)
  assert.equal(view.props.membershipPreparation.commandId,command)
  const confirmed=await checkout('hub.webzoka.com',{...options,ready:true}).page({searchParams:Promise.resolve({plan,company})})
  assert.equal(confirmed.props.preparationRequired,false);assert.equal(confirmed.props.membershipPreparation,null)
  const foreign=await checkout('hub.webzoka.com',{...options,intent:{...options.intent,companyId:reservation}})
    .page({searchParams:Promise.resolve({plan,company})})
  assert.equal(foreign.props.membershipPreparation,null)
})

test('normalization preserves denial of foreign, repeated and financial selectors before Auth', async () => {
  for (const [host, query] of [
    ['foreign.invalid', { plan, host: 'hub.webzoka.com' }],
    ['hub.webzoka.com', { plan, host: 'foreign.invalid' }],
    ['hub.webzoka.com', { plan, host: ['hub.webzoka.com', 'hub.webzoka.com'] }],
    ['hub.webzoka.com', { plan, host: 'hub.webzoka.com', amount: '1' }],
    ['hub.webzoka.com', { plan, host: 'hub.webzoka.com', period: 'annual' }],
    ['hub.webzoka.com', { plan: [plan, plan], host: 'hub.webzoka.com' }],
  ]) {
    const c = checkout(host)
    await assert.rejects(c.page({ searchParams: Promise.resolve(query) }), /REDIRECT:\/hub\/store/)
    assert.deepEqual(c.calls, [])
  }
})
