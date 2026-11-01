import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { loadPricingPolicy } from './pricing-unit-harness.mjs'

const module = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./stock-purchase-policy.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports, URL, URLSearchParams, require(name) {
  if (name === '@/lib/plan-catalog') return loadPricingPolicy()
  throw new Error('Unexpected policy import ' + name)
} })
const policy = module.exports
const plans = loadPricingPolicy().APPROVED_OFFERS.filter(offer => offer.platform === 'stock')
const company = '4701e8a2-f5df-4f2f-9ea8-f2e3c8210001'

test('deployment leaves paid membership activation closed', () => {
  assert.equal(policy.STOCK_PAID_BILLING_RUNTIME_ENABLED, false)
})

test('both approved Stock plans survive canonical login continuations', () => {
  assert.equal(policy.safeStockCheckoutPath('/checkout/stock'), '/hub/checkout/stock')
  for (const plan of plans) {
    const path = policy.stockCheckoutPath(plan.id, company)
    assert.equal(policy.safeStockCheckoutPath(path), path)
    assert.equal(policy.safeStockCheckoutPath(path.replace('/hub/checkout', '/checkout')), path)
  }
})

test('foreign plans, repeated selectors, external origins and financial fields are rejected', () => {
  const valid = policy.stockCheckoutPath(plans[0].id)
  for (const path of [
    `https://hub.webzoka.com${valid}`, '//attacker.test/checkout/stock',
    valid + '&plan=' + plans[1].id, valid + '&company=' + company + '&company=' + company,
    valid + '&amount=1', valid + '&tenant_id=' + company, valid + '&token=grant',
    valid + '&next=https://attacker.test', valid + '#payment', valid + '&company=invalid',
    valid.replace(plans[0].id, '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a1001'),
    '/checkout/stock?plan=' + encodeURIComponent(plans[0].id + '\\evil'),
  ]) assert.equal(policy.safeStockCheckoutPath(path), null, path)
})

test('payment redirects stay on the invoice mode specific Midtrans host', () => {
  assert.equal(policy.safeStockPaymentRedirect('https://app.sandbox.midtrans.com/snap/v4/redirection/example', 'sandbox'),
    'https://app.sandbox.midtrans.com/snap/v4/redirection/example')
  assert.equal(policy.safeStockPaymentRedirect('https://app.midtrans.com/snap/v4/redirection/example', 'production'),
    'https://app.midtrans.com/snap/v4/redirection/example')
  for (const url of ['https://app.midtrans.com/snap/v4/x', 'https://app.sandbox.midtrans.com.attacker.test/snap/x',
    'https://user:pass@app.sandbox.midtrans.com/snap/x', 'https://app.sandbox.midtrans.com:444/snap/x',
    'http://app.sandbox.midtrans.com/snap/x', 'https://app.sandbox.midtrans.com/other']) {
    assert.equal(policy.safeStockPaymentRedirect(url, 'sandbox'), null, url)
  }
})
