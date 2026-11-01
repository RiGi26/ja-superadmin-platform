import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import { loadPricingPolicy } from './pricing-unit-harness.mjs'
const policy = loadPricingPolicy()
function evaluate(file, require) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module: mod, exports: mod.exports, AbortSignal, require })
  return mod.exports
}
const quotes = evaluate('./stock-price-quotes.ts', name => { assert.equal(name, '@/lib/plan-catalog'); return policy })
const rows = policy.APPROVED_OFFERS.filter(p => p.platform === 'stock').map(p => ({ id: p.id, platform: p.platform, tier: p.tier, public_tier: p.publicTier,
  tier_display_name: p.name, price_monthly: p.price, price_yearly: null, offer_version: policy.BASIC_PRO_VERSION, allowed_periods: ['monthly'], entitlement_contract: p.contract, is_active: false, is_for_sale: false }))
function loader(data = rows, error = null, throws = false) {
  const calls = []
  const q = { select(value) { calls.push(['select', value]); return q }, eq(...args) { calls.push(['eq', ...args]); return q },
    abortSignal(signal) { assert.ok(signal instanceof AbortSignal); if (throws) throw Error('synthetic outage'); return Promise.resolve({ data, error }) } }
  const m = evaluate('./stock-store-catalog.ts', name => {
    if (name === 'server-only') return {}
    if (name === '@/lib/plan-catalog') return policy
    if (name === '@/lib/stock-price-quotes') return quotes
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => ({ from(table) { calls.push(['from', table]); return q } }) }
    throw Error(name)
  })
  return { ...m, calls }
}
test('Store reads the same authoritative inactive Basic/Pro quotes without enabling sales', async () => {
  const h = loader(), before = JSON.stringify(rows), result = await h.getStockStoreCatalog()
  assert.deepEqual(Array.from(result, p => [p.name, p.priceMonthly, p.priceYearly]), [['Basic',149000,null],['Pro',359000,null]])
  assert.equal(JSON.stringify(rows), before); assert.equal(policy.basicProEnabled('true'), false)
  assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'platform' && c[2] === 'stock'))
  assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'offer_version' && c[2] === policy.BASIC_PRO_VERSION))
})
for (const [name, data, error, throws] of [
  ['database error',rows,{ message:'unavailable' },false], ['timeout',rows,null,true], ['missing plan',rows.slice(1),null,false],
  ['repriced plan',[{...rows[0],price_monthly:199000},rows[1]],null,false], ['annual contract',[{...rows[0],price_yearly:1490000},rows[1]],null,false],
  ['legacy catalog',[{...rows[0],offer_version:null},{...rows[1],offer_version:null}],null,false], ['duplicate plan',[...rows,rows[0]],null,false],
]) test('Store has no legacy price fallback on '+name, async () => { assert.equal((await loader(data,error,throws).getStockStoreCatalog()).length,0) })
test('Store route uses the Company-aware purchase adapter without the legacy onboarding catalog', () => {
  const source=readFileSync(new URL('../app/hub/(public)/store/page.tsx',import.meta.url),'utf8')
  assert.match(source,/readStockPurchaseOffers/); assert.doesNotMatch(source,/getPublicStockPlans|readSaleablePlans/)
})
