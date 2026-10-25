// Offline source/mocked-unit checks only. No application, Auth, DB or HTTP runtime.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import * as crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'
import * as zod from 'zod'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'
const subject = '11111111-1111-4111-8111-111111111111'
const oldTenant = '22222222-2222-4222-8222-222222222222'
const source = (path) => readFileSync(join(root, path), 'utf8')
const originals = new Map()
const original = (path) => {
  if (!originals.has(path)) originals.set(path, execFileSync('git', ['show', `${baseline}:${path}`], { cwd: root, encoding: 'utf8' }))
  return originals.get(path)
}
const plain = (value) => JSON.parse(JSON.stringify(value))

function evaluate(text, require, env = {}, fileName = 'module.ts') {
  const loadedModule = { exports: {} }
  const forbidden = () => { throw new Error('Network access is forbidden in offline tests') }
  const compiled = ts.transpileModule(text, {
    fileName,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(compiled, {
    module: loadedModule, exports: loadedModule.exports, require, Buffer, URL, fetch: forbidden,
    process: { env: { NODE_ENV: 'test', ...env } },
  })
  return loadedModule.exports
}

function isolationHarness(forcedRuntime) {
  const effects = []
  const modules = new Map()
  const forbidden = (name) => { effects.push(name); throw new Error(`Forbidden effect: ${name}`) }
  const load = (path) => {
    if (modules.has(path)) return modules.get(path)
    const api = evaluate(source(path), (name) => {
      if (name === 'server-only') return {}
      if (name === 'zod') return zod
      if (name === 'node:crypto' || name === 'crypto') return crypto
      if (name === '@/lib/supabase/server') return { createClient: () => forbidden('createClient') }
      if (name === '@/lib/superadmin') return { isSuperadminEmail: () => forbidden('operator lookup') }
      if (name === '@/lib/e1-workspace') return load('lib/e1-workspace.ts')
      if (name === '@/lib/core-company') {
        const core = load('lib/core-company.ts')
        return forcedRuntime === undefined ? core : { ...core, CORE_COMPANY_RUNTIME_ENABLED: forcedRuntime }
      }
      return forbidden(`import:${name}`)
    }, { CORE_COMPANY_RUNTIME_ENABLED: 'true', E1_ENABLED: 'true', HUB_PREVIEW_MODE: 'true' })
    modules.set(path, api)
    return api
  }
  return { api: load('lib/blank-company-isolation.ts'), core: load('lib/core-company.ts'), effects }
}

function assertDenied(result) {
  assert.equal(result.context, 'blank_company')
  assert.equal(result.status, 'blocked')
  assert.equal(result.authorityReady, false)
  assert.equal(result.legacyOperationsPermitted, false)
  assert.equal(result.company, null)
  assert.equal(Object.isFrozen(result), true)
}

const contexts = [
  ['missing', undefined], ['null', null], ['empty', {}], ['legacy tenant', { context: 'legacy_tenant', tenantId: oldTenant }],
  ['blank selector', { context: 'blank_company', companyId: oldTenant }],
  ['JWT claims', { sub: subject, user_role: 'owner', tenant_id: oldTenant, app_metadata: { role: 'superadmin' } }],
  ['profile', { users: { tenant_id: oldTenant }, tenant_members: [{ user_id: subject, tenant_id: oldTenant, role: 'owner' }] }],
  ['completed onboarding', { status: 'ready', owner_user_id: subject, core_tenant_id: oldTenant, portal_tenant_id: oldTenant }],
  ['provisioning receipt', { success: true, email_verified: true, core_user_id: subject, core_tenant_id: oldTenant }],
  ['aliases and equal UUID', { companyId: oldTenant, userId: oldTenant, tenantId: oldTenant, email: 'old@example.invalid', slug: 'old', name: 'Old' }],
  ['forged authority', { context: 'blank_company', trusted: true, authorityReady: true, enabled: true, role: 'owner', proof: 'approved' }],
  ['conflicting', { companyId: oldTenant, memberships: [{ status: 'revoked' }, { status: 'active' }], dispute: true }],
  ['stale result', { context: 'blank_company', status: 'allowed', capturedAt: '2020-01-01', owner: subject }],
  ['request transport', { headers: { 'x-company-id': oldTenant }, query: { company: oldTenant }, verified: true }],
]

for (const [label, context] of contexts) {
  test(`${label}: canonical context never falls back to legacy authority or Hub data`, () => {
    const h = isolationHarness()
    assertDenied(h.api.resolveBlankCompanyContext(context))
    const result = h.api.getBlankCompanyHubSnapshot(context)
    assertDenied(result)
    assert.equal(result.tenant, null)
    assert.equal(result.subscription, null)
    assert.deepEqual(plain(result.invoices), [])
    assert.equal(result.manageSubscriptionUrl, null)
    assert.equal(Object.isFrozen(result.invoices), true)
    assert.deepEqual(h.effects, [])
  })
}

for (const operation of ['finalizeCoreOnboarding', 'finalize_customer_onboarding', 'restore_owner',
  'provisionStockOnboarding', 'completeStockOnboarding', 'retry', 'queue', 'tenant_provision',
  'syncTenantPortal', 'billing', 'signBillingToken', 'verifyBillingToken', undefined, { approved: true }]) {
  test(`legacy operation ${JSON.stringify(operation)} is refused without dispatch`, () => {
    const h = isolationHarness()
    let dispatched = 0
    const context = { trusted: true, tenantId: oldTenant, execute: () => { dispatched++ } }
    assertDenied(h.api.requestBlankCompanyLegacyOperation(operation, context))
    assert.equal(dispatched, 0)
    assert.deepEqual(h.effects, [])
  })
}

test('even a valid tenant-only HMAC is not canonical Company authority', async () => {
  const billing = evaluate(source('lib/billing-link.ts'), (name) => {
    assert.equal(name, 'crypto')
    return crypto
  }, { BILLING_LINK_SECRET: 'offline-synthetic-test-secret-not-a-real-credential' })
  const token = billing.signBillingToken(oldTenant)
  const verified = billing.verifyBillingToken(token)
  assert.equal(verified.ok, true)
  assert.equal(verified.tenantId, oldTenant)
  const h = isolationHarness()
  assertDenied(h.api.resolveBlankCompanyContext({ token, verified }))
  assert.equal(h.api.getBlankCompanyHubSnapshot({ token, verified }).manageSubscriptionUrl, null)
  assertDenied(h.api.requestBlankCompanyLegacyOperation('billing', { token, verified }))
  assert.deepEqual(h.effects, [])
  const routed = legacyHubHarness(source('lib/hub-data.ts'))
  assertDenied(await routed.route().api.dispatchHubRoute({ token, verified }))
  assert.deepEqual(routed.calls, [])
})

test('runtime remains literally disabled; environment flags cannot enable the candidate', async () => {
  const h = isolationHarness()
  assert.equal(h.core.CORE_COMPANY_RUNTIME_ENABLED, false)
  assert.equal((await h.core.getCoreCompanyCandidate({ operation: 'read' })).code, 'core_company_runtime_disabled')
  assert.equal(h.api.resolveBlankCompanyContext({ enabled: true }).code, 'core_company_runtime_disabled')
  assert.deepEqual(h.effects, [])
})

test('changing the runtime flag alone still cannot manufacture canonical authority', () => {
  const h = isolationHarness(true)
  const result = h.api.getBlankCompanyHubSnapshot({ trusted: true, authorityReady: true })
  assertDenied(result)
  assert.equal(result.code, 'blank_company_authority_unavailable')
  assert.deepEqual(h.effects, [])
})

test('repeated, mutated, ambiguous and accessor-bearing inputs cannot promote context', () => {
  const h = isolationHarness()
  const context = { context: 'blank_company', idempotencyKey: 'first-key' }
  const first = h.api.getBlankCompanyHubSnapshot(context)
  Object.assign(context, { trusted: true, authorityReady: true, tenantId: oldTenant, role: 'owner', idempotencyKey: 'another-key' })
  assert.deepEqual(plain(h.api.getBlankCompanyHubSnapshot(context)), plain(first))
  assert.throws(() => { first.authorityReady = true }, TypeError)
  assert.throws(() => { first.invoices.push({ id: 'old-invoice' }) }, {
    name: 'TypeError', message: /not extensible/,
  })
  assert.deepEqual(plain(first.invoices), [])
  assert.equal(first.authorityReady, false)
  const unreadable = new Proxy({}, { get() { throw new Error('Untrusted context must not be inspected') } })
  assertDenied(h.api.getBlankCompanyHubSnapshot(unreadable))
  assertDenied(h.api.requestBlankCompanyLegacyOperation(unreadable, unreadable))
  assert.deepEqual(h.effects, [])
})

function legacyHubHarness(text, options = {}) {
  const calls = []
  const plan = { id: 'old-plan', platform: 'stock', tier: 'starter', tier_display_name: 'Starter',
    price_monthly: '10000', price_yearly: 100000, features: ['orders', 42] }
  const data = {
    tenant_members: { error: null, data: options.noMembership ? null : { tenant_id: oldTenant, role: 'member' } },
    tenants: { error: null, data: { id: oldTenant, name: 'Legacy', slug: 'legacy', platform: 'stock', status: 'active', plan_tier: 'starter', trial_ends_at: null } },
    tenant_subscriptions: { error: null, data: { id: 'old-subscription', status: 'active', current_period_start: null,
      current_period_end: null, trial_ends_at: null, plan: [plan] } },
    subscription_invoices: { error: options.invoiceError ? { message: 'synthetic denial' } : null,
      data: [{ id: 'old-invoice', midtrans_order_id: 'old-order', amount: '10000', status: 'paid', period: 'monthly', paid_at: null, created_at: '2026-01-01' }] },
    subscription_plans: { error: null, data: [plan] },
  }
  const query = (kind, table) => {
    assert.ok(Object.hasOwn(data, table), `Unexpected table ${table}`)
    const entry = [kind, table]
    calls.push(entry)
    const chain = {}
    for (const method of ['select', 'eq', 'limit', 'order']) chain[method] = (...args) => { entry.push([method, ...args]); return chain }
    chain.maybeSingle = async () => data[table]
    chain.then = (resolve, reject) => Promise.resolve(data[table]).then(resolve, reject)
    return chain
  }
  const claims = options.noAuth ? {} : { sub: subject, email: 'legacy@example.invalid', user_role: options.superadmin ? 'superadmin' : 'member', tenant_id: oldTenant }
  const api = evaluate(text, (name) => {
    if (name === 'server-only') return {}
    if (name === 'react') return { cache: (fn) => fn }
    if (name === 'next/navigation') return { redirect: (path) => { throw new Error(`redirect:${path}`) } }
    if (name === '@/lib/supabase/server') return { createClient: async () => {
      calls.push('createClient')
      return { auth: { getClaims: async () => { calls.push('getClaims'); return { data: { claims } } } }, from: (table) => query('user', table) }
    } }
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => {
      calls.push('createAdminClient')
      return { from: (table) => query('admin', table) }
    } }
    if (name === '@/lib/billing-link') return { signBillingToken: (tenantId) => { calls.push(['signBillingToken', tenantId]); return `legacy-token:${tenantId}` } }
    throw new Error(`Unexpected legacy dependency ${name}`)
  }, { HUB_PREVIEW_MODE: options.preview ? 'true' : 'false' })
  let routing
  const route = () => {
    if (routing) return routing
    const isolation = isolationHarness(options.forcedRuntime)
    routing = { api: evaluate(source('lib/hub-context-routing.ts'), (name) => {
      if (name === 'server-only') return {}
      if (name === '@/lib/core-company') return {
        CORE_COMPANY_RUNTIME_ENABLED: options.forcedRuntime ?? isolation.core.CORE_COMPANY_RUNTIME_ENABLED,
      }
      if (name === '@/lib/blank-company-isolation') return isolation.api
      if (name === '@/lib/hub-data') return api
      throw new Error(`Unexpected routing dependency ${name}`)
    }), effects: isolation.effects }
    return routing
  }
  const page = (pinned = false) => evaluate(pinned ? original('app/hub/page.tsx') : source('app/hub/page.tsx'), (name) => {
    if (name === 'react/jsx-runtime') return jsxRuntime
    if (name === '@/lib/hub-context-routing') return route().api
    if (name === '@/lib/hub-data') return { ...api, getHubSystemsInventory: async () => ({ systems: [], accessReady: false }) }
    if (name === '@/lib/hub-billing') return { getHubBillingOwnerTenant: async () => null, getHubFirstPurchaseOwnerTenant: async () => null }
    if (name === 'next/navigation') return { redirect: (path) => { throw new Error(`redirect:${path}`) } }
    if (name === './_components/HubShell') return { HubShell: () => null }
    throw new Error(`Unexpected page dependency ${name}`)
  }, {}, 'page.tsx').default
  return { api, calls, route, page }
}

for (const [label, context] of [...contexts, ['revoked', { status: 'revoked', owner: subject }],
  ['raw token', 'old.tenant-token'], ['array', []], ['number', 1], ['boolean', true]]) {
  test(`routing ${label}: explicit context cannot reach legacy reads or side effects`, async () => {
    const h = legacyHubHarness(source('lib/hub-data.ts'))
    const routing = h.route()
    const result = await routing.api.dispatchHubRoute(context)
    assertDenied(result)
    assert.equal(result.tenant, null)
    assert.equal(result.subscription, null)
    assert.deepEqual(plain(result.invoices), [])
    assert.equal(result.manageSubscriptionUrl, null)
    assert.deepEqual(h.calls, [])
    assert.deepEqual(routing.effects, [])
  })
}

for (const operation of ['finalizeCoreOnboarding', 'finalize_customer_onboarding', 'restore_owner',
  'provisionStockOnboarding', 'completeStockOnboarding', 'retry', 'queue', 'tenant_provision',
  'syncTenantPortal', 'billing', 'signBillingToken', 'verifyBillingToken']) {
  test(`routing cannot dispatch ${operation} from a blank or forged context`, async () => {
    const h = legacyHubHarness(source('lib/hub-data.ts'))
    let dispatched = 0
    const result = await h.route().api.dispatchHubRoute({ context: 'blank_company', operation,
      tenantId: oldTenant, trusted: true, execute: () => { dispatched++ } })
    assertDenied(result)
    assert.equal(dispatched, 0)
    assert.deepEqual(h.calls, [])
    assert.deepEqual(h.route().effects, [])
  })
}

test('routing rejects replay, context mutation and accessor traps without persistent promotion', async () => {
  const h = legacyHubHarness(source('lib/hub-data.ts'))
  const context = { context: 'blank_company', idempotencyKey: 'same-key' }
  const first = await h.route().api.dispatchHubRoute(context)
  Object.assign(context, { context: 'legacy_tenant', authorityReady: true, role: 'owner', idempotencyKey: 'other-key' })
  const results = await Promise.all([context, context, undefined, new Proxy({}, {
    get() { throw new Error('Caller context must not be read') },
  })].map((value) => h.route().api.dispatchHubRoute(value)))
  for (const result of results) assert.deepEqual(plain(result), plain(first))
  assert.deepEqual(h.calls, [])
  assert.deepEqual(h.route().effects, [])
})

test('routing refuses missing canonical authority even if the runtime flag is forced on', async () => {
  const h = legacyHubHarness(source('lib/hub-data.ts'), { forcedRuntime: true })
  const result = await h.route().api.dispatchHubRoute()
  assertDenied(result)
  assert.equal(result.code, 'blank_company_authority_unavailable')
  assert.deepEqual(h.calls, [])
  assert.deepEqual(h.route().effects, [])
})

test('actual Hub page redirects before legacy access when canonical authority is unavailable', async () => {
  const h = legacyHubHarness(source('lib/hub-data.ts'), { forcedRuntime: true })
  await assert.rejects(h.page()({ searchParams: Promise.resolve({ view: 'billing' }) }), /redirect:\/unauthorized/)
  assert.deepEqual(h.calls, [])
  assert.deepEqual(h.route().effects, [])
})

for (const [label, options] of [
  ['authorized membership', {}], ['legacy operator fallback', { noMembership: true, superadmin: true }],
  ['unauthenticated redirect', { noAuth: true }], ['missing membership redirect', { noMembership: true }],
  ['invoice denial', { invoiceError: true }], ['existing preview', { preview: true }],
]) {
  test(`legacy Hub behavior matches pinned main: ${label}`, async () => {
    const before = legacyHubHarness(original('lib/hub-data.ts'), options)
    const after = legacyHubHarness(source('lib/hub-data.ts'), options)
    const observe = async (h) => {
      try { return { result: plain(await h.api.getHubSnapshot()), calls: plain(h.calls) } }
      catch (error) { return { error: error.message, calls: plain(h.calls) } }
    }
    const expected = await observe(before)
    const actual = await observe(after)
    if (expected.result) expected.result.manageSubscriptionUrl = null
    expected.calls = expected.calls.filter((call) => !Array.isArray(call) || call[0] !== 'signBillingToken')
    assert.deepEqual(actual, expected)
    if (label === 'authorized membership') {
      assert.equal(expected.result.tenant.id, oldTenant)
      assert.equal(expected.result.subscription.id, 'old-subscription')
      assert.equal(expected.result.invoices[0].id, 'old-invoice')
      assert.equal(actual.result.manageSubscriptionUrl, null)
    }
  })
  test(`actual Hub routing/page preserves pinned legacy behavior: ${label}`, async () => {
    for (const query of [{}, { view: 'home' }, { view: 'systems' }, { view: 'billing' },
      { view: 'support' }, { view: 'store' }, { view: 'unknown' },
      { view: 'billing', companyId: oldTenant, role: 'owner', canonical: true, enabled: true }]) {
      const before = legacyHubHarness(original('lib/hub-data.ts'), options)
      const after = legacyHubHarness(source('lib/hub-data.ts'), options)
      const observe = async (h, pinned) => {
        try {
          const element = await h.page(pinned)({ searchParams: Promise.resolve(query) })
          const props = plain(element.props)
          delete props.inventory
          delete props.canManageSubscription
          delete props.firstPurchaseTenant
          delete props.purchaseFailed
          props.snapshot.manageSubscriptionUrl = null
          return { result: props, calls: plain(h.calls.filter((call) => !Array.isArray(call) || call[0] !== 'signBillingToken')) }
        } catch (error) { return { error: error.message, calls: plain(h.calls) } }
      }
      assert.deepEqual(await observe(after, false), await observe(before, true))
    }
  })
}

test('onboarding, provisioning, receivers and sync source remains byte-identical to main', () => {
  for (const path of ['lib/customer-onboarding.ts', 'lib/billing-link.ts',
    'lib/stock-sync.ts', 'lib/lms-sync.ts', 'app/api/tenants/provision/route.ts',
    'app/api/billing/checkout-self/route.ts', 'app/api/billing/cancel-schedule/route.ts',
    'supabase/migrations/core_db/019_customer_onboarding.sql', 'package.json', 'package-lock.json']) {
    assert.equal(source(path).replaceAll('\r\n', '\n'), original(path).replaceAll('\r\n', '\n'), path)
  }
})
