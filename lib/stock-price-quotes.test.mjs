import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { loadPricingPolicy } from './pricing-unit-harness.mjs'

const policy = loadPricingPolicy()
const fixture = { exports: {} }
const source = readFileSync(new URL('./stock-price-quotes.ts', import.meta.url), 'utf8')
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { module: fixture, exports: fixture.exports, require: name => { assert.equal(name, '@/lib/plan-catalog'); return policy } })
const { stockPriceQuotes } = fixture.exports
const rows = policy.APPROVED_OFFERS.filter(offer => offer.platform === 'stock').map(offer => ({
  id: offer.id, platform: 'stock', tier: offer.tier, public_tier: offer.publicTier, tier_display_name: offer.name,
  offer_version: policy.BASIC_PRO_VERSION, price_monthly: offer.price, price_yearly: null,
  allowed_periods: ['monthly'], entitlement_contract: offer.contract, is_active: false, is_for_sale: false,
}))

test('approved inactive Stock offers can be quoted without enabling checkout', () => {
  const before = JSON.stringify(rows)
  const quote = stockPriceQuotes(rows)
  assert.deepEqual(Array.from(quote.plans, plan => plan.priceMonthly), [149000, 359000])
  assert.equal(quote.salesEnabled, false)
  assert.equal(policy.basicProEnabled('true'), false)
  assert.equal(JSON.stringify(rows), before)
})

test('quote rejects missing, duplicate, repriced, annual or expanded contracts', () => {
  for (const candidate of [[], rows.slice(1), [...rows, rows[0]],
    [{ ...rows[0], price_monthly: 1 }, rows[1]],
    [{ ...rows[0], price_yearly: 1490000 }, rows[1]],
    [{ ...rows[0], entitlement_contract: { ...rows[0].entitlement_contract, max_active_users: 999 } }, rows[1]],
  ]) assert.equal(stockPriceQuotes(candidate), null)
})

test('Stock quote preserves the approved plan identity and monthly contract', () => {
  const quote = stockPriceQuotes([...rows].reverse())
  assert.deepEqual(Array.from(quote.plans, plan => plan.id), Array.from(rows, row => row.id))
  assert.deepEqual(Array.from(quote.plans, plan => plan.tierDisplayName), ['Basic', 'Pro'])
  assert.ok(quote.plans.every(plan => plan.priceYearly === null && plan.periods.join(',') === 'monthly'))
})
