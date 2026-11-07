import assert from 'node:assert/strict'
import test from 'node:test'
import { loadStockModule, stockPolicyFixture } from './stock-self-payment-unit-harness.mjs'

const normalize = loadStockModule('hub-e1-rewrite-query.ts').hubE1RewriteQuery
const plan = '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'
const creation = '87000000-0000-4000-8000-000000000010'
function checkout(host = 'hub.webzoka.com', options = {}) {
  const calls = []
  const api = loadStockModule('../app/hub/checkout/stock/page.tsx', {
    '@/lib/stock-workspace-create': { STOCK_CHECKOUT_WORKSPACE_CREATION_ENABLED: options.creationEnabled === true },
    'next/headers': { headers: async () => new Headers({ host }) },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT:' + path) } },
    '@/lib/hub-e1-rewrite-query': { hubE1RewriteQuery: normalize },
    '@/lib/supabase/server': { createClient: async () => { calls.push('auth'); return { auth: { getUser: async () => ({ data: { user: options.signedOut ? null : { email_confirmed_at: '2026-11-02', is_anonymous: false } } }) } } } },
    '@/lib/stock-self-payment': {
      readStockPurchaseOffers: options.readOffers ?? (async () => ({ salesEnabled: false, plans: [{ id: plan }] })),
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

test('checkout opens only the selected Company and plan eligible for sandbox', async () => {
  const company = '87000000-0000-4000-8000-000000000012'
  const pro = '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'
  const options = {
    account: { status: 'ready', workspaces: [{ companyId: company, stockTenantId: company }] },
    readOffers: async (selectedCompany, selectedPlan) => {
      const allowed = selectedCompany === company && selectedPlan === pro
      return { salesEnabled: allowed, sandbox: allowed, plans: [{ id: plan }, { id: pro }] }
    },
  }
  const selected = await checkout('hub.webzoka.com', options).page({ searchParams: Promise.resolve({ plan: pro, company }) })
  assert.equal(selected.props.plan.id, pro)
  assert.equal(selected.props.salesEnabled, true)
  assert.equal(selected.props.sandbox, true)
  const wrongPlan = await checkout('hub.webzoka.com', options).page({ searchParams: Promise.resolve({ plan, company }) })
  assert.equal(wrongPlan.props.salesEnabled, false)
  const foreign = await checkout('hub.webzoka.com', options).page({ searchParams: Promise.resolve({ plan: pro, company: creation }) })
  assert.equal(foreign.props.selected, null)
  assert.equal(foreign.props.salesEnabled, false)
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
    ['hub.webzoka.com', { creation, company: creation, plan }],
    ['hub.webzoka.com', { creation, result: 'confirmed' }],
    ['hub.webzoka.com', { creation: [creation, creation], plan }],
  ]) {
    const c = checkout(host)
    await assert.rejects(c.page({ searchParams: Promise.resolve(query) }), /REDIRECT:\/hub\/store/)
    assert.deepEqual(c.calls, [])
  }
})


test('fresh and existing Owners can open workspace creation without opening sales', async () => {
  const company = '87000000-0000-4000-8000-000000000011'
  for (const workspaces of [[], [{ companyId: company, stockTenantId: company }]]) {
    const options = { creationEnabled: true, account: { status: 'ready', workspaces } }
    const view = await checkout('hub.webzoka.com', options).page({ searchParams: Promise.resolve({ plan }) })
    assert.equal(view.props.salesEnabled, false)
    assert.equal(view.props.workspaceCreation.commandId, null)
    assert.match(view.props.workspaceCreation.href, /&creation=[0-9a-f-]{36}$/)
    const form = await checkout('hub.webzoka.com', options).page({ searchParams: Promise.resolve({ plan, creation }) })
    assert.equal(form.props.selected, null)
    assert.equal(form.props.workspaceCreation.commandId, creation)
    assert.equal(form.props.membershipPreparation, null)
  }
})

test('creation selector survives verification and closed or unavailable creation stays inaccessible', async () => {
  const continuation = stockPolicyFixture.stockWorkspaceCreationPath(plan, creation)
  const signedOut = checkout('hub.webzoka.com', { signedOut: true })
  await assert.rejects(signedOut.page({ searchParams: Promise.resolve({ plan, creation }) }),
    error => error.message === 'REDIRECT:/hub/login?next=' + encodeURIComponent(continuation))
  const selected = '87000000-0000-4000-8000-000000000011'
  await assert.rejects(signedOut.page({ searchParams: Promise.resolve({ company: selected }) }),
    error => error.message === 'REDIRECT:/hub/login?next=' + encodeURIComponent(stockPolicyFixture.stockCheckoutPath(null, selected)))
  const closed = checkout()
  await assert.rejects(closed.page({ searchParams: Promise.resolve({ plan, creation }) }), /result=closed$/)
  const unavailable = await checkout('hub.webzoka.com', { creationEnabled: true })
    .page({ searchParams: Promise.resolve({ plan, creation }) })
  assert.equal(unavailable.props.workspaceCreation, null)
})

test('membership workspaces stay unready when preparation is disabled', async () => {
  const company = '87000000-0000-4000-8000-000000000011'
  const c = checkout('hub.webzoka.com', { account: { status: 'ready', workspaces: [{ companyId: company,
    stockTenantId: company, accessProtocol: 'membership', hasPaidContract: false }] } })
  const view = await c.page({ searchParams: Promise.resolve({ plan, company }) })
  assert.equal(view.props.preparationRequired, true)
  assert.equal(view.props.membershipPreparation, null)
  assert.equal(view.props.membershipPreparationEnabled, false)
})
