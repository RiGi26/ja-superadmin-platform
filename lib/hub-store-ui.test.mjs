import assert from 'node:assert/strict'
import { hasStockPurchaseSuccessor } from './stock-purchase-source-successor.mjs'
import { hasPricingComposition } from './pricing-source-successor.mjs'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { loadHubUi } from './hub-ui-test-harness.mjs'
import { historicalStoreHubUiSource, storeHubUiCandidateSource, storeHubUiSourcePaths } from './hub-store-ui-source-contract.mjs'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const root = new URL('../', import.meta.url)
const baseline = 'a5b8915d758eba9b5917cf5b0a9a8380eaef919a'

test('approved presentation successors are exact, reversible and reject adjacent source mutations', () => {
  for (const file of storeHubUiSourcePaths) {
    const before = execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' }).replaceAll('\r\n', '\n')
    const after = readFileSync(new URL(file, root), 'utf8').replaceAll('\r\n', '\n')
    assert.equal(storeHubUiCandidateSource(file, before), after, file)
    assert.equal(historicalStoreHubUiSource(file, after), before, file)
    if (hasPricingComposition(file) || hasStockPurchaseSuccessor(file)) assert.throws(() => historicalStoreHubUiSource(file, after + '\n// adjacent change\n'), file)
    else assert.notEqual(historicalStoreHubUiSource(file, after + '\n// adjacent change\n'), before, file)
    assert.throws(() => storeHubUiCandidateSource(file, 'different baseline'), file)
  }
})

test('Store renders two approved monthly packages without enabling enrollment or checkout', () => {
  const { StoreFront } = loadHubUi('app/hub/_components/StoreFront.tsx')
  const html = render(StoreFront, { plans: [
    { id: 'SYNTHETIC-BASIC', tier: 'starter', name: 'Basic', priceMonthly: 149000, priceYearly: null, features: ['1 akun operator aktif', 'Stok, lot, opname, dan pemantauan kedaluwarsa'] },
    { id: 'SYNTHETIC-PRO', tier: 'pro', name: 'Pro', priceMonthly: 359000, priceYearly: null, features: ['3 akun operator aktif', 'Pemasok dan purchase order', 'Laporan keuangan dan arus kas'] },
  ] })
  assert.equal((html.match(/<article class="plan(?: featuredPlan)?\s*"/g) ?? []).length, 2)
  assert.match(html, /149\.000/); assert.match(html, /359\.000/)
  for (const text of ['Basic', 'Pro', '1 akun operator aktif', '3 akun operator aktif', 'Pemasok dan purchase order', 'Pembelian mandiri paket baru belum dibuka']) assert.ok(html.includes(text), text)
  assert.match(html, /href="https:\/\/wa\.me\//)
  assert.doesNotMatch(html, /199\.000|399\.000|899\.000|Starter|Growth|BOM|MRP|Penggajian|tanpa batas|Semua fitur Pro|onboarding\/stock\?tier=|api\/billing\/checkout/)
})

test('catalog failure never fabricates a price or a trial-enrollment target', () => {
  const { StoreFront } = loadHubUi('app/hub/_components/StoreFront.tsx')
  const html = render(StoreFront, { plans: [] })
  assert.match(html, /Harga belum tersedia/)
  assert.match(html, /Paket belum dapat dimuat/)
  assert.doesNotMatch(html, /onboarding\/stock\?tier=/)
})

test('account-only views never invent memberships, invoices or purchase authority', () => {
  const { AccountHub } = loadHubUi('app/hub/_components/AccountHub.tsx', { '../account/actions': { logoutHubAccount() {} } })
  const account = { email: 'synthetic@example.invalid', name: 'Synthetic', accessReady: false, workspace: { status: 'unavailable' } }
  for (const view of ['home', 'systems', 'billing', 'support']) {
    const html = render(AccountHub, { account, view })
    assert.doesNotMatch(html, /name="tenant_id"|name="plan_id"|Lanjutkan ke pembayaran|Peran Anda: Owner|Buat workspace gratis/)
    assert.match(html, /synthetic@example.invalid/)
    if (view === 'billing') assert.match(html, /Akses tagihan belum tersedia/)
    if (view === 'systems') assert.match(html, /Daftar sistem belum tersedia/)
  }
})
