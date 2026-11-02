import assert from 'node:assert/strict'
import test from 'node:test'
import { loadStockModule, stockPolicyFixture } from './stock-self-payment-unit-harness.mjs'

const normalize = loadStockModule('hub-e1-rewrite-query.ts').hubE1RewriteQuery
const plan = '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'
function checkout(host = 'hub.webzoka.com') {
  const calls = []
  const api = loadStockModule('../app/hub/checkout/stock/page.tsx', {
    'next/headers': { headers: async () => new Headers({ host }) },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT:' + path) } },
    '@/lib/hub-e1-rewrite-query': { hubE1RewriteQuery: normalize },
    '@/lib/supabase/server': { createClient: async () => { calls.push('auth'); return { auth: { getUser: async () => ({ data: { user: { email_confirmed_at: '2026-11-02', is_anonymous: false } } }) } } } },
    '@/lib/stock-self-payment': {
      readStockPurchaseOffers: async () => ({ salesEnabled: false, plans: [{ id: plan }] }),
      readStockBillingAccount: async () => ({ status: 'unavailable', workspaces: [] }),
      readStockPurchaseIntent: async () => null,
    },
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
