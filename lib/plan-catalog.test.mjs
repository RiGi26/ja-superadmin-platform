import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = readFileSync(new URL('./plan-catalog.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod = { exports: {} }
vm.runInNewContext(compiled, { exports: mod.exports, module: mod, process: { env: {} } })
const { APPROVED_OFFERS, BASIC_PRO_VERSION, basicProEnabled, saleablePlans, purchaseError, approvedOffer, checkoutPlans } = mod.exports
const rows = APPROVED_OFFERS.map((offer) => ({ id: offer.id, platform: offer.platform, tier: offer.tier,
  tier_display_name: offer.name, price_monthly: offer.price, price_yearly: null, is_active: true,
  offer_version: BASIC_PRO_VERSION, public_tier: offer.publicTier, is_for_sale: true,
  allowed_periods: ['monthly'], entitlement_contract: { ...offer.contract, features: [...offer.contract.features] } }))
const legacy = { id: 'legacy-stock-enterprise', platform: 'stock', tier: 'enterprise', is_active: true, price_monthly: 899000, price_yearly: 8990000 }

test('release stays closed after local integration until coordinated release authority', () => {
  for (const value of [undefined, '', '1', 'TRUE', 'false']) assert.equal(basicProEnabled(value), false)
  assert.equal(basicProEnabled('true'), false)
  assert.equal(saleablePlans(rows, false).length, 0)
})
test('only four approved monthly offers; exactly two per platform', () => {
  assert.equal(saleablePlans([...rows, legacy], true).length, 4)
  assert.deepEqual(Array.from(rows, (row) => row.price_monthly), [119000, 299000, 149000, 359000])
  for (const platform of ['lms', 'stock']) assert.equal(saleablePlans(rows, true).filter((p) => p.platform === platform).length, 2)
})
test('partial, duplicated, changed-price, or changed-feature offers fail closed', () => {
  for (const replacement of [null, { ...rows[3], price_monthly: 1 }, { ...rows[3], entitlement_contract: { ...rows[3].entitlement_contract, features: ['orders', 'catalog', 'stock', 'suppliers', 'production'] } }]) {
    const candidate = replacement ? [...rows.slice(0, 3), replacement] : rows.slice(0, 3)
    assert.equal(saleablePlans(candidate, true).filter((p) => p.platform === 'stock').length, 0)
  }
  assert.equal(saleablePlans([...rows, rows[3]], true).filter((p) => p.platform === 'stock').length, 0)
})
test('annual checkout is rejected; legacy annual renewal remains available', () => {
  assert.notEqual(purchaseError(rows[2], rows, null, 'yearly', true), null)
  assert.equal(purchaseError(legacy, [...rows, legacy], legacy.id, 'yearly', true), null)
  assert.equal(purchaseError(rows[2], rows, null, 'monthly', true), null)
})
test('legacy rights are preserved without silently allowing new legacy purchases or cross-version changes', () => {
  const before = JSON.stringify(legacy)
  assert.notEqual(purchaseError(legacy, [...rows, legacy], null, 'monthly', true), null)
  assert.notEqual(purchaseError(rows[3], [...rows, legacy], legacy.id, 'monthly', true), null)
  assert.equal(purchaseError(legacy, [...rows, legacy], legacy.id, 'monthly', false), null)
  assert.equal(JSON.stringify(legacy), before)
})
test('disabling new sales still allows an owned, valid new monthly contract to renew', () => {
  assert.equal(purchaseError(rows[2], rows, rows[2].id, 'monthly', false), null)
  assert.notEqual(purchaseError(rows[2], rows, null, 'monthly', false), null)
})
test('Stock Basic includes stock without production or unlimited seats; LMS storage is bounded', () => {
  const basic = approvedOffer(rows[2])
  assert.ok(basic.contract.features.includes('stock'))
  assert.equal(basic.contract.features.includes('production'), false)
  assert.equal(basic.contract.max_active_users, 1)
  assert.equal(approvedOffer(rows[3]).contract.max_active_users, 3)
  assert.equal(approvedOffer(rows[0]).contract.storage_bytes, 209715200)
  assert.equal(approvedOffer(rows[1]).contract.storage_bytes, 1073741824)
  assert.equal(approvedOffer(rows[1]).contract.features.includes('wa_notif'), false)
})
test('out-of-scope portals and pre-release legacy catalogs are unchanged', () => {
  const clinic = { ...legacy, id: 'clinic', platform: 'clinic' }
  assert.equal(saleablePlans([legacy, clinic], false).length, 2)
  assert.deepEqual(Array.from(saleablePlans([...rows, clinic], true), (p) => p.id).slice(-1), ['clinic'])
})
test('unknown current contracts and malformed activation fields never authorize purchase', () => {
  assert.notEqual(purchaseError(rows[2], rows, 'foreign-contract', 'monthly', true), null)
  assert.equal(saleablePlans(rows.map((row) => ({ ...row, is_active: undefined })), true).length, 0)
  assert.notEqual(purchaseError({ ...rows[2], is_active: undefined }, rows, null, 'monthly', true), null)
})
test('checkout choices preserve legacy renewal and do not propose a cross-version downgrade', () => {
  assert.deepEqual(Array.from(checkoutPlans([...rows, legacy], legacy.id, true), (p) => p.id), [legacy.id])
  assert.equal(checkoutPlans(rows.filter((row) => row.platform === 'stock'), rows[2].id, true).length, 2)
  assert.equal(checkoutPlans(rows, 'unknown-current-contract', true).length, 0)
})

test('Stock-only release preserves the inactive LMS offers and legacy LMS annual catalog', () => {
  const candidate = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source.replace('STOCK_BASIC_PRO_RELEASE_AUTHORIZED = false', 'STOCK_BASIC_PRO_RELEASE_AUTHORIZED = true'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module: candidate, exports: candidate.exports, process: { env: { STOCK_BASIC_PRO_PRICING_ENABLED: 'true', BASIC_PRO_PRICING_ENABLED: 'true' } } })
  const lmsLegacy = { ...legacy, id: 'legacy-lms', platform: 'lms' }
  const catalog = [...rows.map(row => row.platform === 'lms' ? { ...row, is_active: false, is_for_sale: false } : row), lmsLegacy, legacy]
  assert.equal(candidate.exports.basicProEnabled(undefined, 'stock'), true)
  assert.equal(candidate.exports.basicProEnabled(undefined, 'lms'), false)
  const available = candidate.exports.saleablePlans(catalog)
  assert.deepEqual(Array.from(available.filter(row => row.platform === 'lms'), row => row.id), ['legacy-lms'])
  assert.deepEqual(Array.from(available.filter(row => row.platform === 'stock'), row => row.id), Array.from(rows.filter(row => row.platform === 'stock'), row => row.id))
  assert.equal(candidate.exports.purchaseError(lmsLegacy, catalog, lmsLegacy.id, 'yearly'), null)
})
