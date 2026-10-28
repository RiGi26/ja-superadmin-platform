import { historicalNavigationSource } from './hub-navigation-source-contract.mjs'
import { loadHubUi } from './hub-ui-test-harness.mjs'
// Local mock tests only. No application server, credentials, or database access.
// Run: node --test lib/hub-data.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { approvedHubSource } from './hub-integration-contract.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const root = join(directory, '..')
const baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'
const source = readFileSync(join(directory, 'hub-data.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const userId = '11111111-1111-4111-8111-111111111111'
const firstTenantId = '22222222-2222-4222-8222-222222222222'
const secondTenantId = '33333333-3333-4333-8333-333333333333'

function membership(tenantId = firstTenantId, platform = 'stock', overrides = {}) {
  return {
    tenant_id: tenantId, user_id: userId, role: 'owner', is_active: true,
    tenant: { id: tenantId, name: 'Customer Business', slug: 'customer-business', platform, status: 'active' },
    ...overrides,
  }
}

function harness(options = {}) {
  const calls = []
  let adminCreated = 0
  const claims = options.claims ?? { sub: userId, email: 'customer@example.com', tenant_id: secondTenantId }
  const sessionResults = {
    tenant_members: { data: { tenant_id: firstTenantId, role: 'owner' }, error: null },
    subscription_plans: { data: [], error: null },
    ...options.sessionResults,
  }
  const adminResults = {
    tenant_members: { data: options.rows ?? [membership()], error: null },
    tenants: { data: { ...membership().tenant, plan_tier: 'starter', trial_ends_at: null }, error: null },
    tenant_subscriptions: { data: null, error: null },
    subscription_invoices: { data: [], error: null },
    ...options.adminResults,
  }
  function from(client, results, table) {
    calls.push({ client, table, method: 'from', args: [] })
    const query = {}
    for (const method of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle']) {
      query[method] = (...args) => {
        calls.push({ client, table, method, args })
        return query
      }
    }
    // Deliberately return unfiltered rows: application must defend against
    // overbroad/malformed results independently of query predicates.
    query.then = (resolve, reject) => options.throwQuery && table === 'tenant_members'
      ? Promise.reject(new Error('query unavailable')).then(resolve, reject)
      : Promise.resolve(results[table]).then(resolve, reject)
    return query
  }
  const sessionDb = {
    auth: {
      getUser: async () => {
        calls.push({ method: 'getUser' })
        if (options.throwAuth) throw new Error('auth unavailable')
        return options.authResult ?? { data: { user: { id: userId } }, error: null }
      },
      getClaims: async () => ({ data: { claims }, error: null }),
    },
    from: (table) => from('session', sessionResults, table),
  }
  const testModule = { exports: {} }
  const context = {
    module: testModule, exports: testModule.exports,
    process: { env: options.preview ? { NODE_ENV: 'development', HUB_PREVIEW_MODE: 'true' } : { NODE_ENV: 'test' } },
    require: (name) => {
      if (name === 'server-only') return {}
      if (name === 'react') return { cache: (fn) => fn }
      if (name === 'next/navigation') return { redirect: (url) => { throw new Error(`redirect:${url}`) } }
      if (name === '@/lib/supabase/server') return { createClient: async () => sessionDb }
      if (name === '@/lib/supabase/admin') return {
        createAdminClient: () => {
          adminCreated += 1
          return { from: (table) => from('admin', adminResults, table) }
        },
      }
      if (name === '@/lib/billing-link') return {
        signBillingToken: (id) => {
          calls.push({ method: 'signBillingToken', args: [id] })
          return `test-token:${id}`
        },
      }
      throw new Error(`Unexpected import: ${name}`)
    },
  }
  vm.runInNewContext(compiled, context, { filename: 'hub-data.ts' })
  return { api: testModule.exports, calls, adminCreated: () => adminCreated }
}

const plain = (value) => JSON.parse(JSON.stringify(value))
async function inventory(options) {
  const mock = harness(options)
  return { mock, result: plain(await mock.api.getHubSystemsInventory()) }
}

test('authorized Core subject sees exact active customer membership', async () => {
  const { mock, result } = await inventory()
  assert.deepEqual(result, {
    accessReady: true, systems: [{ tenant: membership().tenant, role: 'owner' }],
  })
  assert.equal(mock.calls[0].method, 'getUser')
  assert.ok(mock.calls.some((call) => call.method === 'eq' && call.args[0] === 'user_id' && call.args[1] === userId))
  assert.ok(mock.calls.some((call) => call.method === 'eq' && call.args[0] === 'is_active' && call.args[1] === true))
  assert.ok(mock.calls.some((call) => call.method === 'in' && call.args[0] === 'role' && call.args[1].join(',') === 'owner,admin,member'))
  assert.ok(mock.calls.some((call) => call.method === 'select' && call.args[0].includes('tenant:tenants!inner(id, name, slug, platform, status)')))
  assert.equal(mock.calls.filter((call) => call.method === 'from').length, 1)
  assert.ok(!mock.calls.some((call) => call.method === 'signBillingToken'))
})

test('multiple memberships retain exact tenant/platform and membership role; foreign user excluded', async () => {
  const rows = [
    membership(), membership(secondTenantId, 'lms', { role: 'member' }),
    membership('foreign-tenant', 'clinic', { user_id: 'another-user' }),
  ]
  const { result } = await inventory({ rows, claims: { sub: 'wrong-claim-subject', user_role: 'superadmin' } })
  assert.deepEqual(result.systems.map((system) => [system.tenant.id, system.tenant.platform, system.role]), [
    [firstTenantId, 'stock', 'owner'], [secondTenantId, 'lms', 'member'],
  ])
})

test('inactive, revoked/deleted, and missing-active memberships are invisible', async () => {
  for (const rows of [[membership(undefined, undefined, { is_active: false })], [], [membership(undefined, undefined, { is_active: null })]]) {
    const { result } = await inventory({ rows })
    assert.deepEqual(result, { systems: [], accessReady: true })
  }
})

test('tenant mismatch, missing tenant, and ambiguous tenant join are excluded', async () => {
  for (const tenant of [{ ...membership().tenant, id: secondTenantId }, null, [membership().tenant]]) {
    const { result } = await inventory({ rows: [membership(undefined, undefined, { tenant })] })
    assert.deepEqual(result.systems, [])
  }
})

test('missing, failed, and thrown membership query fail closed even with partial data', async () => {
  for (const options of [
    { adminResults: { tenant_members: { data: null, error: null } } },
    { adminResults: { tenant_members: { data: [membership()], error: { message: 'permission denied' } } } },
    { throwQuery: true },
  ]) {
    const { result } = await inventory(options)
    assert.deepEqual(result, { systems: [], accessReady: false })
  }
})

test('missing/failed Core user verification denies claims-only access before privileged reads', async () => {
  for (const options of [
    { authResult: { data: { user: null }, error: null } },
    { authResult: { data: { user: { id: userId } }, error: { message: 'invalid session' } } },
    { throwAuth: true },
  ]) {
    const { mock, result } = await inventory(options)
    assert.deepEqual(result, { systems: [], accessReady: false })
    assert.equal(mock.adminCreated(), 0)
  }
})

test('SuperAdmin, matching email, and tenant JWT confer no customer membership', async () => {
  for (const rows of [[], [membership(undefined, undefined, { role: 'superadmin' })], [membership(undefined, undefined, { role: 'invalid-role' })]]) {
    const { result } = await inventory({ rows, claims: { sub: userId, email: 'superadmin@japanarenacorp.com', user_role: 'superadmin', tenant_id: firstTenantId } })
    assert.deepEqual(result.systems, [])
  }
  const { result } = await inventory({ rows: [membership()], claims: { sub: userId, user_role: 'superadmin' } })
  assert.equal(result.systems.length, 1) // Actual customer membership still counts.
})

test('unknown platform, malformed identity, duplicate rows do not expand inventory', async () => {
  const { result } = await inventory({ rows: [
    membership(), membership(), membership(secondTenantId, 'unvalidated-portal'),
    membership(secondTenantId, null), membership(undefined, undefined, { tenant: { ...membership().tenant, slug: '' } }),
    null,
  ] })
  assert.equal(result.systems.length, 1)
  assert.ok(!('manageSubscriptionUrl' in result))
  assert.ok(!('portalUrl' in result.systems[0]))
})

test('preview snapshot never fabricates authorized inventory', async () => {
  const { result } = await inventory({ preview: true, authResult: { data: { user: null }, error: null } })
  assert.deepEqual(result, { systems: [], accessReady: false })
})

test('snapshot keeps existing first-membership reads without signing', async () => {
  const mock = harness({ rows: [membership(), membership(secondTenantId, 'lms')] })
  const snapshot = plain(await mock.api.getHubSnapshot())
  const before = JSON.stringify(mock.calls.filter((call) => call.method === 'signBillingToken'))
  await mock.api.getHubSystemsInventory()
  assert.equal(snapshot.tenant.id, firstTenantId)
  assert.equal(snapshot.manageSubscriptionUrl, null)
  assert.equal(before, '[]')
  assert.equal(JSON.stringify(mock.calls.filter((call) => call.method === 'signBillingToken')), before)
  for (const table of ['tenants', 'tenant_subscriptions', 'subscription_invoices']) {
    assert.ok(mock.calls.some((call) => call.table === table && call.method === 'eq' && call.args[1] === firstTenantId))
  }
})

test('snapshot and shell contain only reviewed inventory and token-free deltas', () => {
  assert.equal(source.replaceAll('\r\n', '\n'), approvedHubSource('lib/hub-data.ts'))
  const shell = readFileSync(join(root, 'app/hub/_components/HubShell.tsx'), 'utf8').replaceAll('\r\n', '\n')
  assert.equal(shell, approvedHubSource('app/hub/_components/HubShell.tsx'))
  const css = readFileSync(join(root, 'app/hub/hub.module.css'), 'utf8').replaceAll('\r\n', '\n')
  assert.equal(css, approvedHubSource('app/hub/hub.module.css'))
})

test('both inventory surfaces use filtered data and contain no portal launch calls', () => {
  const shell = readFileSync(join(root, 'app/hub/_components/HubShell.tsx'), 'utf8')
  const page = readFileSync(join(root, 'app/hub/page.tsx'), 'utf8')
  assert.ok(shell.includes('inventory.systems.map'))
  assert.ok(shell.includes('<SystemInventory inventory={inventory} />'))
  assert.ok(!/portalAccessUrl|usesWebzokaSso|href=\{portalUrl\}/.test(shell))
  assert.ok(shell.includes('Akses masuk ke portal belum diverifikasi.'))
  assert.ok(page.includes("view === 'home' || view === 'systems' ? getHubSystemsInventory() : Promise.resolve(null)"))
})

function renderInventory(view, result, snapshotOverrides = {}) {
  const shell = ts.transpileModule(readFileSync(join(root, 'app/hub/_components/HubShell.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const testModule = { exports: {} }
  vm.runInNewContext(shell, {
    module: testModule, exports: testModule.exports,
    require: (name) => {
      if (name === 'react/jsx-runtime') return jsxRuntime
      if (name === 'next/link') return { default: (props) => React.createElement('a', props) }
      if (name === 'next/image') return { default: ({ src, alt, width, height }) => React.createElement('img', { src, alt, width, height }) }
      if (name === 'lucide-react') return new Proxy({}, { get: () => (props) => React.createElement('svg', props) })
      if (name === '../actions') return { logoutFromHub: () => {}, openHubSubscriptionManagement: () => {} }
      if (name === './HubNavigation') return loadHubUi('app/hub/_components/HubNavigation.tsx')
      if (name === './hub-interior.module.css') return { default: new Proxy({}, { get: (_, key) => String(key) }) }
      throw new Error(`Unexpected component import: ${name}`)
    },
  })
  // Billing has selected another tenant. It must never seed the systems list.
  const snapshot = {
    isGuest: false, isPreview: false, user: { id: userId, email: 'customer@example.com', role: 'superadmin' },
    tenant: { id: 'unauthorized-tenant', name: 'Billing Business', slug: 'billing-business', platform: 'clinic', status: 'active' },
    subscription: null, invoices: [], plans: [], invoiceAccessReady: true, manageSubscriptionUrl: null,
    ...snapshotOverrides,
  }
  return renderToStaticMarkup(React.createElement(testModule.exports.HubShell, { snapshot, inventory: result, view }))
}

test('Home and Systems markup exclude billing-selected system when inventory denies access', async () => {
  const { result } = await inventory({ rows: [] })
  for (const view of ['home', 'systems']) {
    const html = renderInventory(view, result)
    assert.ok(!html.includes('Webzoka Clinic'))
    assert.ok(!html.includes('systemDetailPanel'))
    assert.ok(html.includes('Belum ada keanggotaan sistem aktif'))
    assert.ok(!html.includes('/auth/webzoka'))
  }
})

test('Home and Systems markup show multiple authorized memberships without launch or tenant billing links', async () => {
  const { result } = await inventory({ rows: [membership(), membership(secondTenantId, 'lms', { role: 'member' })] })
  for (const view of ['home', 'systems']) {
    const html = renderInventory(view, result)
    assert.ok(html.includes('Webzoka Stock'))
    assert.ok(html.includes('Webzoka LMS'))
    assert.ok(!html.includes('Webzoka Clinic'))
    assert.equal((html.match(/class="systemDetailPanel inventoryCard"/g) ?? []).length, 2)
    assert.ok(!html.includes('/auth/webzoka'))
    assert.ok(!html.includes('/billing/langganan?token='))
    assert.ok(html.includes('Akses masuk ke portal belum diverifikasi.'))
    assert.ok(html.includes(`<${view === 'home' ? 'h3' : 'h2'}>Webzoka Stock`))
  }
})

const snapshotOnlyDetails = {
  tenant: {
    id: 'unauthorized-tenant', name: 'Billing Business', slug: 'billing-business',
    platform: 'clinic', status: 'suspended', planTier: 'Snapshot Only Tier', trialEndsAt: null,
  },
  subscription: {
    id: 'snapshot-subscription', status: 'past_due', currentPeriodStart: null,
    currentPeriodEnd: '2040-11-23T00:00:00.000Z', trialEndsAt: null,
    plan: {
      id: 'snapshot-plan', platform: 'clinic', tier: 'pro', name: 'Snapshot Only Package',
      priceMonthly: 123456, priceYearly: 1234560, features: [],
    },
  },
  manageSubscriptionUrl: '/billing/langganan?token=existing-billing-token',
}
const snapshotPeriod = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(snapshotOnlyDetails.subscription.currentPeriodEnd))

for (const [state, result] of [
  ['missing', null],
  ['unavailable', { accessReady: false, systems: [] }],
  ['unavailable with matching rows', { accessReady: false, systems: [{ tenant: { ...membership().tenant, id: 'unauthorized-tenant' }, role: 'owner' }] }],
  ['empty', { accessReady: true, systems: [] }],
  ['mismatched', { accessReady: true, systems: [{ tenant: membership().tenant, role: 'owner' }] }],
]) {
  test(`Home/Systems suppress all snapshot-only tenant context when inventory is ${state}`, () => {
    for (const view of ['home', 'systems']) {
      const html = renderInventory(view, result, snapshotOnlyDetails)
      for (const forbidden of ['Billing Business', 'billing-business', 'Snapshot Only Package', 'Snapshot Only Tier', 'Ditangguhkan', snapshotPeriod]) {
        assert.ok(!html.includes(forbidden), `${view}/${state} exposed ${forbidden}`)
      }
      assert.ok(html.includes('Akun Webzoka'))
      assert.ok(html.includes('customer@example.com'))
      assert.ok(html.includes('class="avatar">W</span>'))
      assert.ok(!html.includes('class="summaryStrip"'))
      assert.ok(!html.includes('existing-billing-token'))
      assert.ok(!html.includes('/auth/webzoka'))
      if (state === 'mismatched') {
        assert.ok(html.includes('Customer Business'))
        assert.ok(html.includes('customer-business'))
        assert.ok(html.includes('Webzoka Stock'))
        assert.equal((html.match(/class="systemDetailPanel inventoryCard"/g) ?? []).length, 1)
      }
    }
  })
}

test('exact verified snapshot tenant retains allowed Home details and Home/Systems sidebar identity', () => {
  const matching = {
    accessReady: true,
    systems: [{ tenant: { ...membership().tenant, id: 'unauthorized-tenant' }, role: 'owner' }],
  }
  for (const view of ['home', 'systems']) {
    const html = renderInventory(view, matching, snapshotOnlyDetails)
    assert.ok(html.includes('Billing Business'))
    assert.ok(html.includes('class="avatar">B</span>'))
    assert.ok(html.includes('customer-business'))
    assert.ok(!html.includes('existing-billing-token'))
    assert.ok(!html.includes('/auth/webzoka'))
    assert.ok(html.includes('Akses masuk ke portal belum diverifikasi.'))
    if (view === 'home') {
      assert.ok(html.includes('Selamat datang, Billing Business'))
      assert.ok(html.includes('Snapshot Only Package'))
      assert.ok(html.includes('Ditangguhkan'))
      assert.ok(html.includes(snapshotPeriod))
      assert.ok(html.includes('class="summaryStrip"'))
    }
  }
})

test('Billing/Support retain read-only context and ignore legacy capability URLs', () => {
  for (const view of ['billing', 'support']) {
    const html = renderInventory(view, { accessReady: false, systems: [] }, snapshotOnlyDetails)
    assert.ok(html.includes('Billing Business'))
    assert.ok(html.includes('class="avatar">B</span>'))
    if (view === 'billing') {
      assert.ok(html.includes('Snapshot Only Package'))
      assert.ok(html.includes(snapshotPeriod))
      assert.ok(!html.includes('existing-billing-token'))
      assert.ok(!html.includes('name="tenant_id"'))
    } else {
      assert.ok(html.includes('billing-business'))
      assert.ok(html.includes('Webzoka Clinic'))
    }
  }
  const current = readFileSync(join(root, 'app/hub/_components/HubShell.tsx'), 'utf8').replaceAll('\r\n', '\n')
  const original = execFileSync('git', ['-C', root, 'show', `${baseline}:app/hub/_components/HubShell.tsx`], { encoding: 'utf8' })
  const support = (text) => text.slice(text.indexOf('function SupportView('), text.indexOf('export function HubShell('))
  assert.equal(support(historicalNavigationSource('app/hub/_components/HubShell.tsx', current)), support(original))
})
