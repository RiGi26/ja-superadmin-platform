// Local mock tests only. No server, database, credentials or payment requests.
// Run in the repository: node --test lib/hub-token-isolation.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repository = process.env.HUB_TOKEN_BASE_REPOSITORY || root
const baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'
const originalSources = new Map()
const compiledSources = new Map()
const original = (file) => {
  if (!originalSources.has(file)) originalSources.set(file, execFileSync('git', ['-C', repository, 'show', `${baseline}:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n'))
  return originalSources.get(file)
}
const userId = '11111111-1111-4111-8111-111111111111'
const tenantId = '22222222-2222-4222-8222-222222222222'
const otherTenantId = '33333333-3333-4333-8333-333333333333'
const token = 'MOCK_BILLING_CAPABILITY'
const success = (data) => ({ data, error: null })
const plain = (value) => JSON.parse(JSON.stringify(value))
const owner = { user_id: userId, tenant_id: tenantId, role: 'owner', is_active: true }
const tenant = { id: tenantId, owner_user_id: userId, name: 'Isolated UAT Business', slug: 'isolated-uat', platform: 'stock', status: 'active', plan_tier: 'starter', trial_ends_at: null }
const plan = { id: '44444444-4444-4444-8444-444444444444', platform: 'stock', tier: 'starter', tier_display_name: 'Starter', price_monthly: '100000', price_yearly: '1000000', features: ['Orders', 42], is_active: true }
const subscription = { id: 'subscription', tenant_id: tenantId, status: 'active', current_period_start: '2026-10-01', current_period_end: '2026-11-01', trial_ends_at: null, plan }

class Redirect extends Error {
  constructor(url) { super(`redirect:${url}`); this.url = url }
}

function harness(options = {}) {
  const calls = []
  const modules = new Map()
  const claims = { sub: userId, email: 'owner@example.test', user_role: 'owner', tenant_id: otherTenantId, ...options.claims }
  const env = options.preview ? { NODE_ENV: 'development', HUB_PREVIEW_MODE: 'true' } : { NODE_ENV: 'production', VERCEL_ENV: 'production' }
  const adminResults = {
    tenants: success({ ...tenant, ...options.tenant }),
    tenant_subscriptions: success({ ...subscription, ...options.subscription }),
    subscription_invoices: success([{ id: 'invoice', midtrans_order_id: 'order', amount: '100000', status: 'paid', period: 'monthly', paid_at: '2026-10-01', created_at: '2026-10-01' }]),
    ...options.adminResults,
  }
  const query = (client, table) => {
    const call = { method: 'query', client, table, operations: [] }
    calls.push(call)
    const builder = {}
    for (const method of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle']) {
      builder[method] = (...args) => { call.operations.push({ method, args }); return builder }
    }
    builder.then = (resolveResult, reject) => {
      const isOwnerCheck = table === 'tenant_members' && call.operations.some((op) => op.method === 'select' && op.args[0].includes('is_active'))
      if (isOwnerCheck && options.throwMembership) return Promise.reject(new Error('Membership unavailable')).then(resolveResult, reject)
      let result
      if (client === 'admin') result = table === 'tenant_members'
        ? options.inventoryResult ?? success([{ ...owner, role: options.selectionResult?.data?.role ?? 'owner', tenant: { ...tenant, ...options.tenant } }])
        : adminResults[table]
      else if (table === 'tenant_members') result = isOwnerCheck
        ? options.ownerResult ?? success({ ...owner })
        : options.selectionResult ?? success({ tenant_id: tenantId, role: 'owner' })
      else if (table === 'subscription_plans') {
        const single = call.operations.some((op) => op.method === 'maybeSingle')
        if (single && options.afterPlanRead) options.afterPlanRead(options, adminResults)
        result = single ? options.planResult ?? success(plan) : success([plan])
      }
      else throw new Error(`Unexpected query ${client}/${table}`)
      // Deliberately return unfiltered rows to exercise defensive identity checks.
      return Promise.resolve(result).then(resolveResult, reject)
    }
    return builder
  }
  const session = {
    from: (table) => query('session', table),
    auth: {
      getClaims: async () => {
        calls.push({ method: 'getClaims' })
        if (options.throwClaims) throw new Error('Claims unavailable')
        return options.claimsResult ?? success({ claims })
      },
      getUser: async () => {
        calls.push({ method: 'getUser' })
        if (options.throwAuth) throw new Error('Auth unavailable')
        return options.authResult ?? success({ user: { id: userId, is_anonymous: false, email_confirmed_at: '2026-10-01T00:00:00Z' } })
      },
    },
  }
  const jsxRuntime = require('react/jsx-runtime')
  const icon = (props) => React.createElement('svg', props)
  function load(file, override) {
    if (!override && modules.has(file)) return modules.get(file)
    const filePath = join(root, file)
    const source = override ?? (existsSync(filePath) ? readFileSync(filePath, 'utf8') : original(file))
    if (!compiledSources.has(source)) compiledSources.set(source, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
    const compiled = compiledSources.get(source)
    const testModule = { exports: {} }
    vm.runInNewContext(compiled, {
      module: testModule, exports: testModule.exports, process: { env }, URL,
      require: (name) => {
        if (name === 'server-only') return {}
        if (name === 'react') return { ...React, cache: (fn) => fn }
        if (name === 'react/jsx-runtime') return jsxRuntime
        if (name === 'next/navigation') return { redirect: (url) => { calls.push({ method: 'redirect', url }); throw new Redirect(url) } }
        if (name === 'next/image') return function MockImage(props) {
          const imageProps = { ...props }
          delete imageProps.priority
          delete imageProps.unoptimized
          return React.createElement('img', imageProps)
        }
        if (name === 'next/link') return function MockLink(props) { return React.createElement('a', props) }
        if (name === 'lucide-react') return new Proxy({}, { get: () => icon })
        if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => String(key) })
        if (name === 'zod') return require('zod')
        if (name === '@/lib/supabase/server') return { createClient: async () => session }
        if (name === '@/lib/supabase/admin') return { createAdminClient: () => { calls.push({ method: 'createAdminClient' }); return { from: (table) => query('admin', table) } } }
        if (name === '@/lib/billing-link') return { signBillingToken: (id) => {
          calls.push({ method: 'signBillingToken', id })
          if (options.throwSigner) throw new Error('Signer unavailable')
          return token
        } }
        if (name === '@/lib/customer-onboarding') return { getOnboardingStatus: () => { throw new Error('Unexpected onboarding access') } }
        if (name === '@/lib/hub-app-url') return { hubAppUrl: () => 'https://example.invalid' }
        if (name === '@/lib/hub-return-path') return { safeHubReturnPath: () => null }
        if (name === '@/lib/billing') return { selfServiceChange: async (input) => {
          calls.push({ method: 'selfServiceChange', input: plain(input) })
          if (options.throwCheckout) throw new Error('Provider unavailable')
          return options.checkoutResult ?? { ok: true, kind: 'checkout', redirectUrl: 'https://payments.example.test/checkout', invoiceId: 'unit-invoice', amount: 100000, reused: false, changeType: 'renew' }
        } }
        if (name === '@/lib/core-company') return { CORE_COMPANY_RUNTIME_ENABLED: options.forcedRuntime ?? false }
        if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`)
        if (name.startsWith('.')) {
          const relative = join(dirname(file), name).replaceAll('\\', '/')
          return load(relative + (relative.endsWith('HubShell') ? '.tsx' : '.ts'))
        }
        throw new Error(`Unexpected import ${name}`)
      },
    }, { filename: file })
    if (!override) modules.set(file, testModule.exports)
    return testModule.exports
  }
  return {
    calls, options, adminResults,
    snapshot: async (baselineSource) => plain(await load('lib/hub-data.ts', baselineSource).getHubSnapshot()),
    authorize: (...inputs) => load('lib/hub-billing.ts').getHubBillingOwnerTenant(inputs.length ? inputs[0] : tenantId),
    authorizeFirst: (input) => load('lib/hub-billing.ts').getHubFirstPurchaseOwnerTenant(input),
    purchase: async (entries = [['tenant_id', tenantId], ['plan_id', plan.id], ['period', 'monthly']]) => {
      const form = new FormData()
      for (const [key, value] of entries) form.append(key, value)
      return load('app/hub/actions.ts').submitHubFirstPurchase(form)
    },
    submit: async (values = [tenantId]) => {
      const form = new FormData()
      for (const value of values) form.append('tenant_id', value)
      return load('app/hub/actions.ts').openHubSubscriptionManagement(form)
    },
    render: async (view, query = {}) => {
      const element = await load('app/hub/page.tsx').default({ searchParams: Promise.resolve({ view, ...query }) })
      return renderToStaticMarkup(element)
    },
  }
}

const signed = (mock) => mock.calls.filter((call) => call.method === 'signBillingToken')
async function denied(options, values) {
  const mock = harness(options)
  await assert.rejects(mock.submit(values), (error) => error instanceof Redirect && error.url === '/unauthorized')
  assert.equal(signed(mock).length, 0)
}

for (const view of ['home', 'systems', 'support', 'billing', undefined, 'unknown']) {
  test(`${view ?? 'default'} render: active Owner gets no token or capability URL`, async () => {
    const mock = harness()
    const html = await mock.render(view)
    assert.equal(signed(mock).length, 0)
    assert.ok(!html.includes(token))
    assert.ok(!html.includes('/billing/langganan?token='))
    assert.equal((await mock.snapshot()).manageSubscriptionUrl, null)
    if (view !== 'billing') assert.ok(!mock.calls.some((call) => call.client === 'session' && call.table === 'tenant_members' && call.operations.some((op) => op.method === 'eq' && op.args[0] === 'role')), 'read-only views must not enter the Billing authority path')
    else assert.match(html, /name="tenant_id"/)
  })
}

test('prefetch/navigation through Billing GET never signs; explicit form submission signs once', async () => {
  const mock = harness()
  for (const view of ['home', 'billing', 'systems', 'billing', 'support']) await mock.render(view)
  assert.equal(signed(mock).length, 0)
  const oldAuthReads = mock.calls.filter((call) => call.method === 'getUser').length
  await assert.rejects(mock.submit(), (error) => error.url === `/billing/langganan?token=${token}`)
  assert.deepEqual(signed(mock), [{ method: 'signBillingToken', id: tenantId }])
  assert.equal(mock.calls.filter((call) => call.method === 'getUser').length, oldAuthReads + 1, 'submission must reverify Auth')
})

test('H1 runtime denial stops all Hub views before inventory, billing authority or signing', async () => {
  for (const view of ['home', 'systems', 'support', 'billing']) {
    const mock = harness({ forcedRuntime: true })
    await assert.rejects(mock.render(view), (error) => error.url === '/unauthorized')
    assert.deepEqual(mock.calls, [{ method: 'redirect', url: '/unauthorized' }])
  }
})

test('a valid foreign tenant ID cannot reuse the current Owner membership', async () => {
  await denied({}, [otherTenantId])
})

test('inventory denial cannot seed Home or Systems from a billing-selected tenant', async () => {
  for (const inventoryResult of [success([]), { data: null, error: { message: 'Denied' } }]) {
    const mock = harness({ inventoryResult })
    for (const view of ['home', 'systems']) {
      const html = await mock.render(view)
      assert.ok(!html.includes(tenant.name))
      assert.ok(!html.includes(tenant.slug))
      assert.ok(html.includes('Akun Webzoka'))
    }
    assert.equal(signed(mock).length, 0)
  }
})

test('revocation between Billing render and submission denies without signing', async () => {
  const mock = harness()
  assert.match(await mock.render('billing'), /name="tenant_id"/)
  mock.options.ownerResult = success(null)
  await assert.rejects(mock.submit(), (error) => error.url === '/unauthorized')
  assert.equal(signed(mock).length, 0)
})

test('Admin and Member Home/Systems/Support remain readable and token-free', async () => {
  for (const role of ['admin', 'member']) {
    const mock = harness({ claims: { user_role: role }, selectionResult: success({ tenant_id: tenantId, role }), ownerResult: success({ ...owner, role }) })
    for (const view of ['home', 'systems', 'support']) {
      const html = await mock.render(view)
      assert.ok(html.includes('Isolated UAT Business'))
      assert.ok(!html.includes('/billing/langganan?token='))
    }
    assert.equal(signed(mock).length, 0)
    assert.ok(!mock.calls.some((call) => call.client === 'session' && call.table === 'tenant_members' && call.operations.some((op) => op.method === 'eq' && op.args[0] === 'role')))
    assert.ok(!(await mock.render('billing')).includes('name="tenant_id"'))
    await assert.rejects(mock.submit(), (error) => error.url === '/unauthorized')
    assert.equal(signed(mock).length, 0)
  }
})

test('Owner FK changed after Billing display is checked again on submission', async () => {
  const mock = harness()
  await mock.render('billing')
  mock.adminResults.tenants = success({ ...tenant, owner_user_id: 'another-user' })
  await assert.rejects(mock.submit(), (error) => error.url === '/unauthorized')
  assert.equal(signed(mock).length, 0)
})

const negatives = [
  ['revoked membership', { ownerResult: success(null) }],
  ['inactive membership', { ownerResult: success({ ...owner, is_active: false }) }],
  ['missing active flag', { ownerResult: success({ ...owner, is_active: null }) }],
  ['Admin membership', { ownerResult: success({ ...owner, role: 'admin' }) }],
  ['Member membership', { ownerResult: success({ ...owner, role: 'member' }) }],
  ['noncanonical Owner role', { ownerResult: success({ ...owner, role: 'Owner' }) }],
  ['membership user mismatch', { ownerResult: success({ ...owner, user_id: 'another-user' }) }],
  ['membership tenant mismatch', { ownerResult: success({ ...owner, tenant_id: otherTenantId }) }],
  ['ambiguous memberships with error', { ownerResult: { data: [owner, owner], error: { message: 'Multiple rows' } } }],
  ['array membership without error', { ownerResult: success([owner]) }],
  ['membership query partial error', { ownerResult: { data: owner, error: { message: 'Denied' } } }],
  ['membership query rejection', { throwMembership: true }],
  ['missing Owner FK', { tenant: { owner_user_id: null } }],
  ['different Owner FK', { tenant: { owner_user_id: 'another-user' } }],
  ['tenant result mismatch', { tenant: { id: otherTenantId } }],
  ['tenant query error', { adminResults: { tenants: { data: tenant, error: { message: 'Denied' } } } }],
  ['missing tenant', { adminResults: { tenants: success(null) } }],
  ['missing subscription', { adminResults: { tenant_subscriptions: success(null) } }],
  ['subscription query error with partial data', { adminResults: { tenant_subscriptions: { data: subscription, error: { message: 'Denied' } } } }],
  ['subscription tenant mismatch', { subscription: { tenant_id: otherTenantId } }],
  ['subscription without ID', { subscription: { id: null } }],
  ['array subscription', { adminResults: { tenant_subscriptions: success([subscription]) } }],
  ['claims error with partial data', { claimsResult: { data: { claims: { sub: userId } }, error: { message: 'Invalid claims' } } }],
  ['missing claims subject', { claims: { sub: null } }],
  ['claims rejection', { throwClaims: true }],
  ['Auth error with partial user', { authResult: { data: { user: { id: userId } }, error: { message: 'Invalid session' } } }],
  ['missing Auth user', { authResult: success({ user: null }) }],
  ['Auth subject mismatch', { authResult: success({ user: { id: 'another-user' } }) }],
  ['anonymous Auth account', { authResult: success({ user: { id: userId, is_anonymous: true } }) }],
  ['Auth rejection', { throwAuth: true }],
  ['SuperAdmin without Owner membership', { claims: { user_role: 'superadmin' }, ownerResult: success(null) }],
  ['preview direct submission', { preview: true }],
]
for (const [name, options] of negatives) {
  test(`${name}: explicit submission fails closed`, async () => { await denied(options) })
}

test('suspended subscription-less fixture cannot mint on any view or direct submission', async () => {
  const mock = harness({ tenant: { status: 'suspended', platform: 'jastip' }, adminResults: { tenant_subscriptions: success(null), subscription_invoices: success([]) } })
  for (const view of ['home', 'systems', 'support', 'billing']) {
    const html = await mock.render(view)
    assert.ok(!html.includes('/billing/langganan?token='))
    assert.ok(!html.includes('name="tenant_id"'))
  }
  await assert.rejects(mock.submit(), (error) => error.url === '/unauthorized')
  assert.equal(signed(mock).length, 0)
})

test('legitimate suspended subscriber retains explicit Owner-authorized recovery', async () => {
  const mock = harness({ tenant: { status: 'suspended' }, subscription: { status: 'past_due' } })
  assert.match(await mock.render('billing'), /name="tenant_id"/)
  assert.equal(signed(mock).length, 0)
  await assert.rejects(mock.submit(), (error) => error.url === `/billing/langganan?token=${token}`)
  assert.equal(signed(mock).length, 1)
})

test('actual Owner remains authorized despite stale Admin/Member/SuperAdmin JWT role or tenant', async () => {
  for (const user_role of ['admin', 'member', 'superadmin']) {
    const mock = harness({ claims: { user_role, tenant_id: otherTenantId } })
    await assert.rejects(mock.submit(), (error) => error.url === `/billing/langganan?token=${token}`)
    assert.equal(signed(mock).length, 1)
  }
})

test('malformed, missing, duplicate and file-valued tenant fields never sign', async () => {
  for (const values of [[], [''], ['not-a-uuid'], [tenantId, otherTenantId], [new Blob(['tenant'])]]) await denied({}, values)
  const mock = harness()
  for (const value of [null, undefined, {}, [tenantId], 123]) assert.equal(await mock.authorize(value), null)
  assert.equal(signed(mock).length, 0)
  assert.ok(!mock.calls.some((call) => call.method === 'getUser'))
})

test('signer failure redirects safely without exposing a capability', async () => {
  const mock = harness({ throwSigner: true })
  await assert.rejects(mock.submit(), (error) => error.url === '/unauthorized')
  assert.equal(signed(mock).length, 1)
  assert.ok(!mock.calls.some((call) => call.method === 'redirect' && call.url.includes('?token=')))
})

test('fresh Owner query uses exact user/tenant/role/active predicates and rejects ambiguity', async () => {
  const mock = harness()
  assert.equal(await mock.authorize(), tenantId)
  const membership = mock.calls.find((call) => call.table === 'tenant_members')
  for (const [column, value] of [['user_id', userId], ['tenant_id', tenantId], ['role', 'owner'], ['is_active', true]]) {
    assert.ok(membership.operations.some((op) => op.method === 'eq' && op.args[0] === column && op.args[1] === value))
  }
  assert.ok(!membership.operations.some((op) => op.method === 'limit'))
  assert.ok(membership.operations.some((op) => op.method === 'maybeSingle'))
  assert.ok(mock.calls.findIndex((call) => call.method === 'getUser') < mock.calls.indexOf(membership))
  assert.ok(mock.calls.indexOf(membership) < mock.calls.findIndex((call) => call.method === 'createAdminClient'))
  assert.equal(signed(mock).length, 0)
})

test('read-only DTO, invoices, plan normalization and tenant selection match main except removed capability', async () => {
  const baselineSource = original('lib/hub-data.ts')
  for (const options of [
    {},
    { selectionResult: success({ tenant_id: tenantId, role: 'admin' }) },
    { selectionResult: success({ tenant_id: tenantId, role: 'member' }) },
    { adminResults: { subscription_invoices: success([]) } },
    { adminResults: { subscription_invoices: { data: null, error: { message: 'Not ready' } } } },
    { adminResults: { tenant_subscriptions: success(null) } },
    { claims: { user_role: 'superadmin', tenant_id: tenantId }, selectionResult: success(null) },
    { preview: true },
  ]) {
    const current = harness(options)
    const previous = harness(options)
    const { manageSubscriptionUrl: currentUrl, ...actual } = await current.snapshot()
    const expected = await previous.snapshot(baselineSource)
    delete expected.manageSubscriptionUrl
    assert.deepEqual(actual, expected)
    assert.equal(currentUrl, null)
    assert.equal(signed(current).length, 0)
    assert.deepEqual(plain(current.calls.filter((call) => call.method === 'query')), plain(previous.calls.filter((call) => call.method === 'query')))
  }
})

test('read-only unauthenticated, missing membership and failed tenant gates remain intact', async () => {
  for (const [options, url] of [
    [{ claims: { sub: null } }, '/hub/login'],
    [{ selectionResult: success(null) }, '/unauthorized'],
    [{ adminResults: { tenants: { data: tenant, error: { message: 'Denied' } } } }, '/unauthorized'],
  ]) {
    const mock = harness(options)
    await assert.rejects(mock.render('home'), (error) => error.url === url)
    assert.equal(signed(mock).length, 0)
  }
})

test('read-only entry point has no signer dependency; UI never consumes legacy capability URLs', () => {
  const snapshotSource = readFileSync(join(root, 'lib/hub-data.ts'), 'utf8')
  const shellSource = readFileSync(join(root, 'app/hub/_components/HubShell.tsx'), 'utf8')
  const actionsSource = readFileSync(join(root, 'app/hub/actions.ts'), 'utf8')
  assert.doesNotMatch(snapshotSource, /signBillingToken|@\/lib\/billing-link/)
  assert.doesNotMatch(shellSource, /manageSubscriptionUrl/)
  assert.match(shellSource, /<form action=\{openHubSubscriptionManagement\}/)
  assert.match(actionsSource, /^'use server'/)
  for (const protectedExport of ['loginToHub', 'logoutFromHub', 'requestHubPasswordReset', 'updateHubPassword']) {
    assert.ok(original('app/hub/actions.ts').includes(`function ${protectedExport}`))
    assert.ok(actionsSource.includes(`function ${protectedExport}`))
  }
})

const withoutSubscription = { adminResults: { tenant_subscriptions: success(null) } }
const financialCalls = (mock) => mock.calls.filter((call) => call.method === 'selfServiceChange')

test('active legacy Owner sees first-purchase form only on Billing; all GETs remain inert', async () => {
  const mock = harness(withoutSubscription)
  for (const view of ['home', 'systems', 'support', 'billing']) {
    const html = await mock.render(view)
    assert.equal(html.includes('id="first-purchase-plan"'), view === 'billing')
    assert.ok(!html.includes(token))
  }
  assert.equal(financialCalls(mock).length, 0)
  assert.equal(signed(mock).length, 0)
  const html = await mock.render('billing')
  assert.match(html, /name="plan_id"/)
  assert.match(html, /name="period"/)
  assert.match(html, /Lanjutkan ke pembayaran/)
})

for (const period of ['monthly', 'yearly']) {
  test(`fresh legacy Owner can explicitly start ${period} first purchase without a billing token`, async () => {
    const mock = harness(withoutSubscription)
    await mock.render('billing')
    const authBefore = mock.calls.filter((call) => call.method === 'getUser').length
    await assert.rejects(mock.purchase([['tenant_id', tenantId], ['plan_id', plan.id], ['period', period]]), (error) => error.url === 'https://payments.example.test/checkout')
    assert.deepEqual(financialCalls(mock), [{ method: 'selfServiceChange', input: { tenantId, planId: plan.id, period, firstPurchaseOnly: true } }])
    assert.equal(mock.calls.filter((call) => call.method === 'getUser').length, authBefore + 2)
    assert.equal(signed(mock).length, 0)
  })
}

test('first purchase accepts genuine server-action metadata but never its authority claims', async () => {
  const mock = harness(withoutSubscription)
  await assert.rejects(mock.purchase([['tenant_id', tenantId], ['plan_id', plan.id], ['period', 'monthly'], ['$ACTION_ID_unit', 'ignored']]), (error) => error.url === 'https://payments.example.test/checkout')
  assert.equal(financialCalls(mock).length, 1)
})

const firstPurchaseDenials = [
  ['revoked membership', { ownerResult: success(null) }],
  ['inactive membership', { ownerResult: success({ ...owner, is_active: false }) }],
  ['Admin membership', { ownerResult: success({ ...owner, role: 'admin' }) }],
  ['Member membership', { ownerResult: success({ ...owner, role: 'member' }) }],
  ['foreign tenant membership', { ownerResult: success({ ...owner, tenant_id: otherTenantId }) }],
  ['foreign subject membership', { ownerResult: success({ ...owner, user_id: 'another-user' }) }],
  ['incorrect tenant Owner FK', { tenant: { owner_user_id: 'another-user' } }],
  ['ownerless tenant', { tenant: { owner_user_id: null } }],
  ['suspended fixture', { tenant: { status: 'suspended', platform: 'jastip' } }],
  ['cancelled tenant', { tenant: { status: 'cancelled' } }],
  ['past-due tenant without subscription', { tenant: { status: 'past_due' } }],
  ['unknown platform', { tenant: { platform: 'unverified-platform' } }],
  ['ambiguous Owner rows', { ownerResult: success([owner, owner]) }],
  ['ambiguous tenant result', { adminResults: { tenants: success([tenant]) } }],
  ['membership read error', { ownerResult: { data: owner, error: { message: 'Denied' } } }],
  ['membership read rejection', { throwMembership: true }],
  ['tenant read error', { adminResults: { tenants: { data: tenant, error: { message: 'Denied' } } } }],
  ['subscription read error', { adminResults: { tenant_subscriptions: { data: null, error: { message: 'Denied' } } } }],
  ['missing subscription response', { adminResults: { tenant_subscriptions: { error: null } } }],
  ['existing active subscription', { adminResults: { tenant_subscriptions: success(subscription) } }],
  ['ambiguous subscription rows', { adminResults: { tenant_subscriptions: success([subscription, subscription]) } }],
  ['foreign subscription', { adminResults: { tenant_subscriptions: success({ ...subscription, tenant_id: otherTenantId }) } }],
  ['missing Auth user', { authResult: success({ user: null }) }],
  ['anonymous Auth user', { authResult: success({ user: { id: userId, is_anonymous: true } }) }],
  ['unconfirmed Auth user', { authResult: success({ user: { id: userId, is_anonymous: false } }) }],
  ['claims/Auth subject disagreement', { authResult: success({ user: { id: otherTenantId } }) }],
  ['claims verification error', { claimsResult: { data: { claims: { sub: userId } }, error: { message: 'Denied' } } }],
  ['Auth verification rejection', { throwAuth: true }],
  ['inactive plan', { planResult: success({ ...plan, is_active: false }) }],
  ['foreign platform plan', { planResult: success({ ...plan, platform: 'clinic' }) }],
  ['incorrect plan ID', { planResult: success({ ...plan, id: otherTenantId }) }],
  ['ambiguous plan result', { planResult: success([plan]) }],
  ['plan read error', { planResult: { data: plan, error: { message: 'Denied' } } }],
  ['Registry runtime activation', { forcedRuntime: true }],
  ['preview', { preview: true }],
]
for (const [name, options] of firstPurchaseDenials) {
  test(`first purchase denies ${name} before financial code`, async () => {
    const mock = harness({ ...withoutSubscription, ...options, adminResults: { ...withoutSubscription.adminResults, ...options.adminResults } })
    await assert.rejects(mock.purchase(), (error) => error.url === '/unauthorized')
    assert.equal(financialCalls(mock).length, 0)
    assert.equal(signed(mock).length, 0)
  })
}

test('first purchase rechecks revocation, Owner and subscription changes after display or plan lookup', async () => {
  for (const change of [
    (options) => { options.ownerResult = success(null) },
    (_, results) => { results.tenants = success({ ...tenant, owner_user_id: 'new-owner' }) },
    (_, results) => { results.tenant_subscriptions = success(subscription) },
  ]) {
    const mock = harness({ ...withoutSubscription, afterPlanRead: change })
    await mock.render('billing')
    await assert.rejects(mock.purchase(), (error) => error.url === '/unauthorized')
    assert.equal(financialCalls(mock).length, 0)
  }
})

test('missing, foreign, ambiguous and unverified Company/billing targets never fall back to legacy authority', async () => {
  const valid = [['tenant_id', tenantId], ['plan_id', plan.id], ['period', 'monthly']]
  for (const entries of [
    [], valid.slice(1), [...valid, ['tenant_id', tenantId]], [...valid, ['plan_id', plan.id]],
    [['tenant_id', otherTenantId], ...valid.slice(1)],
    ...['company_id', 'companyId', 'mapping', 'context', 'token', 'owner_user_id', 'amount'].map((key) => [...valid, [key, key === 'context' ? 'company' : otherTenantId]]),
    [...valid.slice(0, 2), ['period', 'weekly']], [['tenant_id', tenantId], ['plan_id', new Blob(['plan'])], ['period', 'monthly']],
  ]) {
    const mock = harness(withoutSubscription)
    await assert.rejects(mock.purchase(entries), (error) => error.url === '/unauthorized')
    assert.equal(financialCalls(mock).length, 0)
    assert.equal(signed(mock).length, 0)
  }
  const mock = harness(withoutSubscription)
  for (const input of [{ companyId: tenantId }, { companyId: tenantId, tenantId }, { tenantId, verified: true }, null, undefined, [tenantId]]) {
    assert.equal(await mock.authorizeFirst(input), null)
  }
})

test('first-purchase failures never mint, automatically retry, expose raw errors or redirect to unsafe schemes', async () => {
  for (const options of [
    { throwCheckout: true }, { checkoutResult: { ok: false, status: 409, error: 'PRIVATE_PROVIDER_ERROR' } },
    { checkoutResult: { ok: true, kind: 'applied', tier: 'pro' } },
    ...['javascript:alert(1)', 'http://payments.example.test', 'https://user:pass@payments.example.test', 'not-a-url'].map((redirectUrl) => ({ checkoutResult: { ok: true, kind: 'checkout', redirectUrl } })),
  ]) {
    const mock = harness({ ...withoutSubscription, ...options })
    await assert.rejects(mock.purchase(), (error) => error.url === '/hub?view=billing&purchase=failed')
    assert.equal(financialCalls(mock).length, 1)
    assert.equal(signed(mock).length, 0)
  }
  const html = await harness(withoutSubscription).render('billing', { purchase: 'failed' })
  assert.match(html, /role="alert"/)
  assert.ok(!html.includes('PRIVATE_PROVIDER_ERROR'))
})
