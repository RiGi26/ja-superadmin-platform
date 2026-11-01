import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { loadHubUi } from './hub-ui-test-harness.mjs'
import { loadStockModule, stockCatalogFixture, stockPolicyFixture } from './stock-self-payment-unit-harness.mjs'

const offers = stockCatalogFixture.APPROVED_OFFERS.filter(row => row.platform === 'stock')
const plans = Array.from(offers, row => ({ id: row.id, tierDisplayName: row.name, priceMonthly: row.price, publicTier: row.publicTier, features: Array.from(row.features) }))
const id = n => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const own = { companyId: id(1), companyName: 'Usaha Contoh Nusantara', coreTenantId: id(2), reservationId: id(3), stockTenantId: id(4), ownerId: id(5), activation: 'not_started', hasPaidContract: false, subscription: null, invoices: [] }
const actions = { prepareStockWorkspace() {}, submitStockPayment() {}, refreshStockInvoiceAction() {} }
const { StockCheckoutView } = loadHubUi('app/hub/checkout/stock/StockCheckoutView.tsx', { './actions': actions })
const { StockStoreFront } = loadHubUi('app/hub/_components/StockStoreFront.tsx')
const { StockBillingPanel } = loadHubUi('app/hub/_components/StockBillingPanel.tsx')
const render = (View, props) => renderToStaticMarkup(createElement(View, props))
const checkoutProps = { plan: plans[0], salesEnabled: true, accessReady: true, workspaces: [own], selected: own, result: null }
test('Store uses the supplied approved two-plan catalog; closed offers never expose a purchase target', () => {
  for (const salesEnabled of [false, true]) {
    const html = render(StockStoreFront, { quote: { salesEnabled, plans } })
    assert.match(html, /149\.000/); assert.match(html, /359\.000/)
    assert.doesNotMatch(html, /199\.000|399\.000|899\.000|onboarding\/stock\?tier=/)
    assert.equal(html.includes('/hub/checkout/stock?plan='), salesEnabled)
    if (salesEnabled) { assert.match(html, /Pilih Basic/); assert.match(html, /Pilih Pro/) }
    assert.match(html, /Trial 14 hari terpisah/)
  }
  const missing = render(StockStoreFront, { quote: null })
  assert.doesNotMatch(missing, /149\.000|359\.000|\/checkout\/stock/)
})
test('checkout requires explicit workspace selection, prepared resources and available sales', () => {
  const payable = render(StockCheckoutView, checkoutProps)
  assert.match(payable, /Lanjutkan ke pembayaran/); assert.match(payable, /name="company" value="70000000/)
  const choice = render(StockCheckoutView, { ...checkoutProps, workspaces: [own, { ...own, companyId: id(8), companyName: 'Usaha Kedua' }], selected: null })
  assert.match(choice, /Pilih usaha/); assert.doesNotMatch(choice, /Lanjutkan ke pembayaran/)
  const closed = render(StockCheckoutView, { ...checkoutProps, salesEnabled: false })
  assert.match(closed, /disabled=""/); assert.match(closed, /belum dibuka/)
  const unprepared = render(StockCheckoutView, { ...checkoutProps, selected: { ...own, stockTenantId: null } })
  assert.match(unprepared, /Selesaikan penyambungan Stock/); assert.doesNotMatch(unprepared, /Lanjutkan ke pembayaran/)
})
test('paid-pending and active orders cannot present another payment; billing keeps invoice history', () => {
  for (const activation of ['pending', 'active']) {
    const selected = { ...own, activation, hasPaidContract: true, subscription: { planId: plans[0].id, status: 'active', expiresAt: '2099-11-01T00:00:00Z' },
      invoices: [{ id: id(9), planId: plans[0].id, amount: 149000, status: 'paid', createdAt: '2026-10-30T00:00:00Z', paidAt: '2026-10-30T00:00:00Z' }] }
    const html = render(StockCheckoutView, { ...checkoutProps, selected })
    assert.doesNotMatch(html, /Lanjutkan ke pembayaran/)
    const billing = render(StockBillingPanel, { billing: { status: 'ready', workspaces: [selected] } })
    assert.match(billing, /Riwayat tagihan/); assert.match(billing, /Lunas/); assert.match(billing, /Periksa pembayaran/)
    assert.equal(billing.includes('Buka Webzoka Stock'), activation === 'active')
    assert.doesNotMatch(billing, /Lanjutkan pembayaran|snap_token|midtrans_order_id/)
  }
})
test('Server Actions reject financial fields and duplicate selectors before calling adapters', async () => {
  const calls = []
  const api = loadStockModule('../app/hub/checkout/stock/actions.ts', {
    'next/navigation': { redirect: url => { throw Error('REDIRECT:' + url) } },
    '@/lib/stock-purchase-policy': stockPolicyFixture,
    '@/lib/stock-self-payment': { startStockPurchase: async value => { calls.push(value); return { status: 'pending' } }, rememberStockPurchase: async () => { calls.push('intent') } },
    '@/lib/stock-invoice-recovery': { refreshStockInvoice: async value => calls.push(['refresh', value]) },
  })
  for (const mutate of [form => form.set('price', '1'), form => form.set('period', 'yearly'), form => form.append('plan', plans[1].id), form => form.set('tenant_id', id(99)), form => form.set('company', 'foreign')]) {
    const form = new FormData(); form.set('plan', plans[0].id); form.set('company', own.companyId); mutate(form)
    await assert.rejects(api.submitStockPayment(form), /REDIRECT:\/hub\/store/)
  }
  assert.equal(calls.length, 0)
  const valid = new FormData(); valid.set('plan', plans[0].id); valid.set('company', own.companyId)
  await assert.rejects(api.submitStockPayment(valid), /result=pending/)
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ plan: plans[0].id, company: own.companyId }])
})

// Optional deterministic visual fixture. Forms are inert; no Auth, gateway or DB.
if (process.env.STOCK_VISUAL_DIR) {
  const dir = process.env.STOCK_VISUAL_DIR; mkdirSync(dir, { recursive: true })
  const css = readFileSync(new URL('../app/hub/checkout/stock/checkout.module.css', import.meta.url), 'utf8')
  for (const [name, props] of [['checkout', checkoutProps], ['workspace-choice', { ...checkoutProps, selected: null, workspaces: [own, { ...own, companyId: id(8), companyName: 'Usaha Kedua' }] }], ['activation-pending', { ...checkoutProps, selected: { ...own, activation: 'pending' } }]]) {
    writeFileSync(`${dir}/${name}.html`, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Stock ${name}</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}${css}</style></head><body>${render(StockCheckoutView, props)}<script>document.addEventListener('submit',event=>event.preventDefault())</script></body></html>`)
  }
}
