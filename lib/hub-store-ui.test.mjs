import assert from 'node:assert/strict'
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
    assert.notEqual(historicalStoreHubUiSource(file, after + '\n// adjacent change\n'), before, file)
    assert.throws(() => storeHubUiCandidateSource(file, 'different baseline'), file)
  }
})

test('Store renders live supplied catalog prices, names, features and exact legacy tier targets', () => {
  const { StoreFront } = loadHubUi('app/hub/_components/StoreFront.tsx')
  const html = render(StoreFront, { plans: [{ id: 'synthetic-plan', tier: 'enterprise', name: 'Server catalog name', priceMonthly: 765432, priceYearly: 7654320, features: ['Server catalog feature'] }] })
  assert.match(html, /Server catalog name/)
  assert.match(html, /765\.432/)
  assert.match(html, /Server catalog feature/)
  assert.match(html, /href="\/hub\/onboarding\/stock\?tier=enterprise"/)
  assert.doesNotMatch(html, /199\.000|399\.000|899\.000|Paling populer/)
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
