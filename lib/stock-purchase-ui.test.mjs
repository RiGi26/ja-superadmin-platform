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
const actions = { createCheckoutStockWorkspace() {}, prepareStockWorkspace() {}, prepareStockMembership() {}, submitStockPayment() {}, refreshStockInvoiceAction() {} }
const nativeTarget = { ACTIVE_STOCK_ORIGIN: 'https://webzoka-stock-platform.vercel.app' }
const { StockCheckoutView } = loadHubUi('app/hub/checkout/stock/StockCheckoutView.tsx', {
  './actions': actions, '@/lib/stock-active-protocol': nativeTarget,
})
const { StockStoreFront } = loadHubUi('app/hub/_components/StockStoreFront.tsx')
const { StockBillingPanel } = loadHubUi('app/hub/_components/StockBillingPanel.tsx')
const render = (View, props) => renderToStaticMarkup(createElement(View, props))
const checkoutProps = { plan: plans[0], salesEnabled: true, accessReady: true, workspaces: [own], selected: own, result: null }

// Hosted UAT reproduced stale account content across the canonical redirect;
// full requests rendered billing correctly. This contract is not browser UAT.
const clientNavigationMock = { __esModule: true, default: props => createElement('a', { ...props, 'data-client-navigation': 'true' }) }
function accountSectionAnchors(html) {
  return Array.from(html.matchAll(/<a\b[^>]*href="\/hub\/account\?view=(?:systems|billing|support)"[^>]*>/g), match => match[0])
}

test('native account section links request fresh pages across canonical routing', () => {
  const { AccountHub } = loadHubUi('app/hub/_components/AccountHub.tsx', {
    'next/link': clientNavigationMock, '../account/actions': { logoutHubAccount() {} },
  })
  const html = render(AccountHub, { view: 'home', account: {
    name: 'Verified Owner', email: 'owner@example.test', accessReady: true,
    workspace: { status: 'ready', companyId: own.companyId, companyName: own.companyName, role: 'owner', stockStatus: 'quarantined' },
  }, billing: { status: 'ready', workspaces: [own] } })
  const links = accountSectionAnchors(html)
  for (const view of ['systems', 'billing', 'support']) assert.ok(links.some(link => link.includes(`view=${view}`)))
  assert.ok(links.length >= 9, 'covers sidebar, mobile drawer, workspace controls and quick links')
  assert.ok(links.every(link => !link.includes('data-client-navigation')), 'account sections must not reuse a stale client route')
})

test('checkout and paid-pending billing links request fresh authorized account views', () => {
  const { StockCheckoutView: Checkout } = loadHubUi('app/hub/checkout/stock/StockCheckoutView.tsx', {
    'next/link': clientNavigationMock, './actions': actions,
    '@/lib/stock-active-protocol': nativeTarget,
  })
  for (const activation of ['not_started', 'pending', 'active']) {
    const html = render(Checkout, { ...checkoutProps, selected: { ...own, activation } })
    const links = accountSectionAnchors(html)
    assert.equal(links.length, activation === 'not_started' ? 1 : 2)
    assert.ok(links.every(link => !link.includes('data-client-navigation')), activation)
    if (activation !== 'not_started') assert.doesNotMatch(html, /Lanjutkan ke pembayaran/)
  }
})
test('Store uses the supplied approved two-plan catalog; closed offers never expose a purchase target', () => {
  for (const salesEnabled of [false, true]) {
    const html = render(StockStoreFront, { quote: { salesEnabled, plans } })
    assert.match(html, /149\.000/); assert.match(html, /359\.000/)
    assert.doesNotMatch(html, /199\.000|399\.000|899\.000|onboarding\/stock\?tier=/)
    assert.equal(html.includes('/hub/checkout/stock?plan='), salesEnabled)
    assert.match(html, /Pilih Basic/); assert.match(html, /Pilih Pro/)
    const disabledChoices = [...html.matchAll(/<button\b[^>]*disabled=""[^>]*aria-describedby="([^"]+)"[^>]*>Pilih (Basic|Pro)<\/button>/g)]
    assert.equal(disabledChoices.length, salesEnabled ? 0 : 2)
    for (const [, descriptionId] of disabledChoices) assert.ok(html.includes(`id="${descriptionId}">Langganan mandiri belum dibuka.</p>`))
    for (const name of ['Basic', 'Pro']) assert.ok(html.includes(`Konsultasi paket ${name}`))
    assert.match(html, /Trial 14 hari terpisah/)
  }
  const missing = render(StockStoreFront, { quote: null })
  assert.doesNotMatch(missing, /149\.000|359\.000|\/checkout\/stock/)
  assert.doesNotMatch(missing, /<button\b[^>]*>Pilih (Basic|Pro)/)
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
test('reciprocal preparation presents native connection before any payment control',()=>{
  const waiting=render(StockCheckoutView,{...checkoutProps,preparationRequired:true})
  assert.match(waiting,/Verifikasi workspace Stock/);assert.doesNotMatch(waiting,/Lanjutkan ke pembayaran/)
  const ready=render(StockCheckoutView,{...checkoutProps,preparationRequired:true,
    membershipPreparation:{companyId:own.companyId,instanceId:own.reservationId,commandId:id(22)}})
  assert.match(ready,/https:\/\/webzoka-stock-platform.vercel.app\/api\/auth\/stock-membership\/start/)
  assert.match(ready,/method="post"/);assert.match(ready,/Konfirmasi koneksi Stock/)
  assert.doesNotMatch(ready,/Lanjutkan ke pembayaran|provider_token|access_token|name="amount"/)
})
test('paid-pending and active orders cannot present another payment; billing keeps invoice history', () => {
  for (const activation of ['pending', 'active']) {
    const selected = { ...own, activation, hasPaidContract: true, subscription: { planId: plans[0].id, status: 'active', expiresAt: '2099-11-01T00:00:00Z' },
      invoices: [{ id: id(9), planId: plans[0].id, amount: 149000, status: 'paid', createdAt: '2026-10-30T00:00:00Z', paidAt: '2026-10-30T00:00:00Z' }] }
    const html = render(StockCheckoutView, { ...checkoutProps, selected })
    assert.doesNotMatch(html, /Lanjutkan ke pembayaran/)
    const billing = render(StockBillingPanel, { billing: { status: 'ready', workspaces: [selected] } })
    assert.match(billing, /Riwayat tagihan/); assert.match(billing, /Lunas/); assert.match(billing, /Periksa pembayaran/)
    assert.match(billing, /<summary>Lihat rincian tagihan<\/summary>/)
    assert.ok(billing.includes(`href="/hub/stock/invoices/${selected.companyId}/${id(9)}"`))
    assert.match(billing, /<dt>Tanggal bayar<\/dt><dd>30 Okt 2026<\/dd>/)
    assert.equal(billing.includes('Buka Webzoka Stock'), activation === 'active')
    assert.doesNotMatch(billing, /Lanjutkan pembayaran|snap_token|midtrans_order_id/)
  }
})
test('active membership workspaces use only the v2 native selection form when enabled', () => {
  const selected = { ...own, activation: 'active', accessProtocol: 'membership' }
  const billing = { status: 'ready', workspaces: [selected] }
  assert.doesNotMatch(render(StockBillingPanel, { billing }), /api\/auth\/|Buka Webzoka Stock/)
  const { StockBillingPanel: EnabledBillingPanel } = loadHubUi('app/hub/_components/StockBillingPanel.tsx', {
    '@/lib/stock-membership-protocol': { STOCK_MEMBERSHIP_RUNTIME_ENABLED: true },
  })
  const html = render(EnabledBillingPanel, { billing })
  assert.match(html, /api\/auth\/stock-membership\/selection\/start/)
  assert.match(html, new RegExp(`name="companyId" value="${own.companyId}"`))
  assert.match(html, new RegExp(`name="reservationId" value="${own.reservationId}"`))
  assert.doesNotMatch(html, /api\/auth\/e1\/start/)
})

test('Owner can manage a suspended workspace team when new invitations are closed', () => {
  const { StockBillingPanel: EnabledBillingPanel } = loadHubUi('app/hub/_components/StockBillingPanel.tsx', {
    '@/lib/stock-membership-protocol': { STOCK_MEMBERSHIP_RUNTIME_ENABLED: true },
    '@/lib/stock-member-protocol': { STOCK_MEMBER_LIFECYCLE_ENABLED: true },
  })
  const workspace = { ...own, activation: 'suspended', accessProtocol: 'membership' }
  const billing = { status: 'ready', workspaces: [workspace] }
  assert.match(render(EnabledBillingPanel, { billing }), new RegExp(`/hub/stock/team\\?company=${own.companyId}`))
  assert.doesNotMatch(render(StockBillingPanel, { billing }), /Kelola tim Stock/)
})

test('Server Actions reject financial fields and duplicate selectors before calling adapters', async () => {
  const calls = []
  const api = loadStockModule('../app/hub/checkout/stock/actions.ts', {
    'next/navigation': { redirect: url => { throw Error('REDIRECT:' + url) } },
    '@/lib/stock-purchase-policy': stockPolicyFixture,
    '@/lib/stock-self-payment': { startStockPurchase: async value => { calls.push(value); return { status: 'pending' } }, rememberStockPurchase: async () => { calls.push('intent') } },
    '@/lib/stock-workspace-create': { STOCK_CHECKOUT_WORKSPACE_CREATION_ENABLED: false },
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

test('checkout renders workspace creation separately from payment and includes an explicit accessible name field', () => {
  const creation = { href: stockPolicyFixture.stockWorkspaceCreationPath(plans[0].id, id(11)), commandId: null }
  const picker = render(StockCheckoutView, { ...checkoutProps, salesEnabled: false, workspaceCreation: creation })
  assert.match(picker, /Buat workspace baru/)
  assert.match(picker, /creation=70000000-0000-4000-8000-000000000011/)
  const form = render(StockCheckoutView, { ...checkoutProps, selected: null, result: 'workspace_unconfirmed',
    workspaceCreation: { ...creation, commandId: id(11) } })
  assert.match(form, /for="workspace-name"/)
  assert.match(form, /name="creation" value="70000000-0000-4000-8000-000000000011"/)
  assert.match(form, /Kirim ulang nama usaha yang sama/)
  assert.doesNotMatch(form, /Lanjutkan ke pembayaran|name="company"/)
})

test('creation action preserves idempotency and trusts only the reserved Company and instance', async () => {
  const plan = plans[1].id, command = id(11), calls = []
  let outcome = { status: 'unconfirmed' }, exact = true
  const api = loadStockModule('../app/hub/checkout/stock/actions.ts', {
    'next/navigation': { redirect: url => { throw Error('REDIRECT:' + url) } },
    '@/lib/stock-purchase-policy': stockPolicyFixture,
    '@/lib/stock-workspace-create': { STOCK_CHECKOUT_WORKSPACE_CREATION_ENABLED: true,
      createStockWorkspace: async input => { calls.push(input); return outcome } },
    '@/lib/stock-self-payment': {
      startStockPurchase: async () => assert.fail('Workspace creation must never start a payment'),
      rememberStockPurchase: async (offer, company) => {
        calls.push([offer, company])
        return { companyId: company, reservationId: exact ? own.reservationId : id(99) }
      },
    },
    '@/lib/stock-invoice-recovery': {},
  })
  function form() {
    const data = new FormData()
    data.set('plan', plan); data.set('creation', command); data.set('companyName', 'Usaha Kedua')
    return data
  }
  for (const invalid of [data => data.set('company', own.companyId), data => data.append('creation', command),
    data => data.set('amount', '1'), data => data.set('period', 'yearly')]) {
    const data = form(); invalid(data)
    await assert.rejects(api.createCheckoutStockWorkspace(data), /\/hub\/store/)
  }
  assert.equal(calls.length, 0)
  await assert.rejects(api.createCheckoutStockWorkspace(form()),
    error => error.message === 'REDIRECT:' + stockPolicyFixture.stockWorkspaceCreationPath(plan, command) + '&result=workspace_unconfirmed')
  outcome = { status: 'reserved', workspace: { companyId: own.companyId, instanceId: own.reservationId } }
  const target = stockPolicyFixture.stockCheckoutPath(plan, own.companyId)
  await assert.rejects(api.createCheckoutStockWorkspace(form()), error => error.message === 'REDIRECT:' + target)
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { commandId: command, companyName: 'Usaha Kedua' }, { commandId: command, companyName: 'Usaha Kedua' }, [plan, own.companyId],
  ])
  exact = false
  await assert.rejects(api.createCheckoutStockWorkspace(form()), error => error.message === 'REDIRECT:' + target + '&result=workspace_reserved')
})

// Optional deterministic visual fixture. Forms are inert; no Auth, gateway or DB.
if (process.env.STOCK_VISUAL_DIR) {
  const dir = process.env.STOCK_VISUAL_DIR; mkdirSync(dir, { recursive: true })
  const css = readFileSync(new URL('../app/hub/checkout/stock/checkout.module.css', import.meta.url), 'utf8')
  for (const [name, props] of [['checkout', checkoutProps], ['workspace-choice', { ...checkoutProps, selected: null, workspaces: [own, { ...own, companyId: id(8), companyName: 'Usaha Kedua' }] }], ['activation-pending', { ...checkoutProps, selected: { ...own, activation: 'pending' } }]]) {
    writeFileSync(`${dir}/${name}.html`, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Stock ${name}</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}${css}</style></head><body>${render(StockCheckoutView, props)}<script>document.addEventListener('submit',event=>event.preventDefault())</script></body></html>`)
  }
}
