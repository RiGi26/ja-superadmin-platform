import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { loadPricingPolicy } from './pricing-unit-harness.mjs'

const vmModule = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./stock-purchase-policy.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: vmModule, exports: vmModule.exports, URL, URLSearchParams, require(name) {
  if (name === '@/lib/plan-catalog') return loadPricingPolicy()
  throw new Error('Unexpected policy import ' + name)
} })
const policy = vmModule.exports
const plans = loadPricingPolicy().APPROVED_OFFERS.filter(offer => offer.platform === 'stock')
const company = '4701e8a2-f5df-4f2f-9ea8-f2e3c8210001'

test('workspace-preparation candidate keeps both public catalog release gates closed', () => {
  assert.equal(policy.STOCK_PAID_BILLING_RUNTIME_ENABLED, true)
  const catalog = loadPricingPolicy()
  assert.equal(catalog.STOCK_BASIC_PRO_RELEASE_AUTHORIZED, false)
  assert.equal(catalog.BASIC_PRO_RELEASE_AUTHORIZED, false)
  assert.equal(policy.stockPurchaseAvailable(false), false)
})

test('both approved Stock plans survive canonical login continuations', () => {
  assert.equal(policy.safeStockCheckoutPath('/checkout/stock'), '/hub/checkout/stock')
  assert.equal(policy.safeStockCheckoutPath('/checkout/stock?company=' + company),
    policy.stockCheckoutPath(null, company))
  assert.equal(policy.safeStockCheckoutPath('/checkout/stock?plan=invalid&company=' + company), null)
  for (const plan of plans) {
    const path = policy.stockCheckoutPath(plan.id, company)
    assert.equal(policy.safeStockCheckoutPath(path), path)
    assert.equal(policy.safeStockCheckoutPath(path.replace('/hub/checkout', '/checkout')), path)
    const creation = policy.stockWorkspaceCreationPath(plan.id, company)
    assert.equal(policy.safeStockCheckoutPath(creation), creation)
    assert.equal(policy.safeStockCheckoutPath(creation.replace('/hub/checkout', '/checkout')), creation)
    assert.equal(policy.safeStockCheckoutPath(creation + '&result=workspace_unconfirmed'), creation)
    assert.equal(policy.safeStockCheckoutPath(path + '&result=workspace_reserved'), path)
    assert.equal(policy.safeStockCheckoutPath(creation + '&result=prepared'), null)
    assert.equal(policy.safeStockCheckoutPath(creation + '&result=workspace_unconfirmed&result=closed'), null)
  }
})

test('foreign plans, repeated selectors, external origins and financial fields are rejected', () => {
  const valid = policy.stockCheckoutPath(plans[0].id)
  for (const path of [
    `https://hub.webzoka.com${valid}`, '//attacker.test/checkout/stock',
    valid + '&plan=' + plans[1].id, valid + '&company=' + company + '&company=' + company,
    valid + '&creation=invalid', valid + '&creation=' + company + '&creation=' + company,
    valid + '&creation=' + company + '&company=' + company,
    valid + '&creation=' + company + '&company=', '/checkout/stock?creation=' + company,
    valid + '&creation=' + company + '&amount=1', valid + '&amount=1', valid + '&tenant_id=' + company, valid + '&token=grant',
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
