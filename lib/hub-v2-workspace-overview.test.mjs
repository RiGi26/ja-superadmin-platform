import { loadHubUi } from './hub-ui-test-harness.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const subject = '00000000-0000-4000-8000-000000000101'
const company = '00000000-0000-4000-8000-000000000102'
const reservation = '00000000-0000-4000-8000-000000000103'

test('canonical owned Stock workspaces render one or several v2 businesses despite unavailable legacy E1 summary', () => {
  const { AccountHub } = loadHubUi('app/hub/_components/AccountHub.tsx', { '../account/actions': { logoutHubAccount() {} } })
  const account = { email: 'customer@example.test', name: 'Customer', accessReady: false, workspace: { status: 'unavailable' } }
  const owned = number => ({ companyId: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    companyName: `Verified Workspace ${number}`, ownerId: subject, reservationId: reservation,
    coreTenantId: company, stockTenantId: company, activation: 'not_started', hasPaidContract: false,
    subscription: null, invoices: [], accessProtocol: 'membership' })
  for (const workspaces of [[owned(1)], [owned(1), owned(2)]]) {
    const billing = { status: 'ready', workspaces }
    const html = renderToStaticMarkup(createElement(AccountHub, { account, billing, view: 'home' }))
    assert.match(html, /Peran Anda: Owner/)
    assert.match(html, /Lihat sistem saya/)
    assert.doesNotMatch(html, /Akses workspace belum dapat diperiksa|Buat workspace gratis|Buka Stock/)
    if (workspaces.length === 1) assert.match(html, /Verified Workspace 1/)
    else assert.match(html, /2 workspace usaha/)
    const systems = renderToStaticMarkup(createElement(AccountHub, { account, billing, view: 'systems' }))
    for (const workspace of workspaces) assert.ok(systems.includes(workspace.companyName))
    assert.doesNotMatch(systems, />Buka Stock</)
  }
  for (const billing of [null, { status: 'unavailable', workspaces: [] }, { status: 'ready', workspaces: [] }]) {
    const html = renderToStaticMarkup(createElement(AccountHub, { account, billing, view: 'home' }))
    assert.match(html, /Akses workspace belum dapat diperiksa/)
    assert.doesNotMatch(html, /Peran Anda: Owner|Lihat sistem saya|Buat workspace gratis/)
  }
})
