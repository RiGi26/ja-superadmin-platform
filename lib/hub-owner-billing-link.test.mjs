// Local static mock tests only: no server, credentials, database, or payment calls.
// Run: node --test lib/hub-owner-billing-link.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'
const inventoryBaseline = '377a89aca0e3869454b544365705b1d868a57c5c'
const source = readFileSync(join(root, 'lib/hub-data.ts'), 'utf8')
const baselineSource = execFileSync('git', ['-C', root, 'show', `${baseline}:lib/hub-data.ts`], { encoding: 'utf8' })
const userId = '11111111-1111-4111-8111-111111111111'
const tenantId = '22222222-2222-4222-8222-222222222222'
const otherTenantId = '33333333-3333-4333-8333-333333333333'
const owner = { user_id: userId, tenant_id: tenantId, role: 'owner', is_active: true }
const tenant = { id: tenantId, owner_user_id: userId, name: 'Test Business', slug: 'test-business', platform: 'stock', status: 'active', plan_tier: 'starter', trial_ends_at: null }
const plan = { id: 'plan', platform: 'stock', tier: 'starter', tier_display_name: 'Starter', price_monthly: '100000', price_yearly: '1000000', features: ['Orders', 42] }
const success = (data) => ({ data, error: null })
const plain = (value) => JSON.parse(JSON.stringify(value))

function harness(options = {}, code = source) {
  const calls = []
  let membershipReads = 0
  const claims = { sub: userId, email: 'owner@example.test', user_role: 'owner', tenant_id: otherTenantId, ...options.claims }
  const sessionResults = {
    subscription_plans: success([plan]),
  }
  const adminResults = {
    tenants: success({ ...tenant, ...options.tenant }),
    tenant_subscriptions: success({ id: 'subscription', status: 'active', current_period_start: '2026-10-01', current_period_end: '2026-11-01', trial_ends_at: null, plan }),
    subscription_invoices: success([{ id: 'invoice', midtrans_order_id: 'order', amount: '100000', status: 'paid', period: 'monthly', paid_at: '2026-10-01', created_at: '2026-10-01' }]),
    ...options.adminResults,
  }

  function from(client, table) {
    const billingRead = client === 'session' && table === 'tenant_members' && ++membershipReads > 1
    const call = { method: 'query', client, table, billingRead, operations: [] }
    calls.push(call)
    const query = {}
    for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle']) {
      query[method] = (...args) => {
        call.operations.push({ method, args })
        return query
      }
    }
    query.then = (resolve, reject) => {
      if (billingRead && options.throwMembership) return Promise.reject(new Error('Membership unavailable')).then(resolve, reject)
      const result = client === 'admin' ? adminResults[table]
        : table === 'tenant_members' ? (billingRead ? options.ownerResult ?? success({ ...owner }) : options.selectionResult ?? success({ tenant_id: tenantId, role: 'owner' }))
          : sessionResults[table]
      // Return unfiltered fixture data so application identity checks are tested too.
      return Promise.resolve(result).then(resolve, reject)
    }
    return query
  }

  const sessionDb = {
    from: (table) => from('session', table),
    auth: {
      getClaims: async () => options.claimsResult ?? success({ claims }),
      getUser: async () => {
        calls.push({ method: 'getUser' })
        if (options.throwAuth) throw new Error('Auth unavailable')
        return options.authResult ?? success({ user: { id: userId } })
      },
    },
  }
  const testModule = { exports: {} }
  const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports,
    process: { env: options.preview ? { NODE_ENV: 'development', HUB_PREVIEW_MODE: 'true' } : { NODE_ENV: 'test' } },
    require: (name) => {
      if (name === 'server-only') return {}
      if (name === 'react') return { cache: (fn) => fn }
      if (name === 'next/navigation') return { redirect: (url) => { throw new Error(`redirect:${url}`) } }
      if (name === '@/lib/supabase/server') return { createClient: async () => sessionDb }
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => ({ from: (table) => from('admin', table) }) }
      if (name === '@/lib/billing-link') return { signBillingToken: (id) => {
        calls.push({ method: 'signBillingToken', id })
        if (options.throwSigner) throw new Error('Signer unavailable')
        return 'MOCK_OWNER_TOKEN'
      } }
      throw new Error(`Unexpected import: ${name}`)
    },
  }, { filename: 'hub-data.ts' })
  return { calls, snapshot: async () => plain(await testModule.exports.getHubSnapshot()) }
}

async function denied(options) {
  const mock = harness(options)
  const snapshot = await mock.snapshot()
  assert.equal(snapshot.manageSubscriptionUrl, null)
  assert.equal(mock.calls.filter((call) => call.method === 'signBillingToken').length, 0)
  assert.ok(!JSON.stringify(snapshot).includes('MOCK_OWNER_TOKEN'))
  return snapshot
}

test('active matching Owner receives one link for selected tenant, despite different JWT tenant', async () => {
  const mock = harness()
  const snapshot = await mock.snapshot()
  assert.equal(snapshot.tenant.id, tenantId)
  assert.equal(snapshot.manageSubscriptionUrl, '/billing/langganan?token=MOCK_OWNER_TOKEN')
  assert.deepEqual(mock.calls.filter((call) => call.method === 'signBillingToken'), [{ method: 'signBillingToken', id: tenantId }])
  const billingRead = mock.calls.find((call) => call.billingRead)
  assert.ok(billingRead, 'Billing needs an exact current membership read')
  for (const [column, value] of [['user_id', userId], ['tenant_id', tenantId], ['is_active', true]]) {
    assert.ok(billingRead.operations.some((op) => op.method === 'eq' && op.args[0] === column && op.args[1] === value))
  }
  assert.ok(billingRead.operations.some((op) => op.method === 'select' && ['user_id', 'tenant_id', 'role', 'is_active'].every((column) => op.args[0].includes(column))))
  assert.ok(billingRead.operations.some((op) => op.method === 'maybeSingle'))
  assert.ok(!billingRead.operations.some((op) => op.method === 'limit'), 'Do not hide ambiguous memberships')
  assert.ok(mock.calls.find((call) => call.table === 'tenants').operations.some((op) => op.method === 'select' && op.args[0].includes('owner_user_id')))
  assert.ok(mock.calls.findIndex((call) => call.method === 'getUser') < mock.calls.indexOf(billingRead))
  assert.ok(mock.calls.indexOf(billingRead) < mock.calls.findIndex((call) => call.method === 'signBillingToken'))
})

for (const role of ['admin', 'member', 'staff', 'viewer', 'Owner', null]) {
  test(`selected membership role ${role} cannot issue a link despite Owner JWT`, async () => {
    await denied({ selectionResult: success({ tenant_id: tenantId, role }) })
  })
}

const negativeCases = [
  ['inactive membership', { ownerResult: success({ ...owner, is_active: false }) }],
  ['membership without active flag', { ownerResult: success({ ...owner, is_active: null }) }],
  ['revoked/missing exact membership', { ownerResult: success(null) }],
  ['missing membership response', { ownerResult: { error: null } }],
  ['membership changed to Admin', { ownerResult: success({ ...owner, role: 'admin' }) }],
  ['membership changed to Member', { ownerResult: success({ ...owner, role: 'member' }) }],
  ['membership query error with partial Owner data', { ownerResult: { data: owner, error: { message: 'Denied' } } }],
  ['membership query rejection', { throwMembership: true }],
  ['ambiguous duplicate membership result', { ownerResult: { data: [owner, owner], error: { message: 'Multiple rows' } } }],
  ['array membership without error', { ownerResult: success([owner]) }],
  ['Owner of another tenant', { ownerResult: success({ ...owner, tenant_id: otherTenantId }) }],
  ['membership of another Auth user', { ownerResult: success({ ...owner, user_id: 'another-user' }) }],
  ['missing membership user', { ownerResult: success({ ...owner, user_id: null }) }],
  ['ownerless tenant', { tenant: { owner_user_id: null } }],
  ['mismatched tenant Owner FK', { tenant: { owner_user_id: 'another-user' } }],
  ['selected tenant identity mismatch', { tenant: { id: otherTenantId } }],
  ['initial selection query error with partial Owner data', { selectionResult: { data: { tenant_id: tenantId, role: 'owner' }, error: { message: 'Denied' } } }],
  ['claims verification error with partial claims', { claimsResult: { data: { claims: { sub: userId } }, error: { message: 'Invalid claims' } } }],
  ['current Auth verification error with partial user', { authResult: { data: { user: { id: userId } }, error: { message: 'Invalid session' } } }],
  ['current Auth user missing', { authResult: success({ user: null }) }],
  ['current Auth response missing', { authResult: { error: null } }],
  ['current Auth subject mismatch', { authResult: success({ user: { id: 'another-user', email: 'owner@example.test' } }) }],
  ['current Auth verification rejection', { throwAuth: true }],
  ['SuperAdmin fallback without actual membership', { claims: { user_role: 'superadmin', tenant_id: tenantId }, selectionResult: success(null) }],
  ['SuperAdmin fallback after membership query error', { claims: { user_role: 'superadmin', tenant_id: tenantId }, selectionResult: { data: null, error: { message: 'Denied' } } }],
]
for (const [name, options] of negativeCases) {
  test(`${name}: null URL, no signer call or token`, async () => { await denied(options) })
}

test('actual Owner membership remains eligible despite Admin, Member, or SuperAdmin profile/JWT role', async () => {
  for (const user_role of ['admin', 'member', 'superadmin']) {
    const mock = harness({ claims: { user_role } })
    assert.equal((await mock.snapshot()).manageSubscriptionUrl, '/billing/langganan?token=MOCK_OWNER_TOKEN')
    assert.equal(mock.calls.filter((call) => call.method === 'signBillingToken').length, 1)
  }
})

test('missing initial membership preserves unauthorized redirect and never signs', async () => {
  const mock = harness({ selectionResult: success(null) })
  await assert.rejects(mock.snapshot(), /redirect:\/unauthorized/)
  assert.equal(mock.calls.filter((call) => call.method === 'signBillingToken').length, 0)
})

test('missing Auth subject preserves login redirect and never signs', async () => {
  const mock = harness({ claims: { sub: null } })
  await assert.rejects(mock.snapshot(), /redirect:\/hub\/login/)
  assert.equal(mock.calls.filter((call) => call.method === 'signBillingToken').length, 0)
})

test('failed tenant read preserves unauthorized redirect and never signs', async () => {
  const mock = harness({ adminResults: { tenants: { data: tenant, error: { message: 'Denied' } } } })
  await assert.rejects(mock.snapshot(), /redirect:\/unauthorized/)
  assert.equal(mock.calls.filter((call) => call.method === 'signBillingToken').length, 0)
})

test('signer failure produces no link', async () => {
  const mock = harness({ throwSigner: true })
  assert.equal((await mock.snapshot()).manageSubscriptionUrl, null)
})

test('read-only snapshots, invoice states, and tenant-selection queries match main baseline', async () => {
  for (const options of [
    {},
    { selectionResult: success({ tenant_id: tenantId, role: 'admin' }) },
    { selectionResult: success({ tenant_id: tenantId, role: 'member' }) },
    { throwAuth: true },
    { ownerResult: success(null) },
    { claims: { user_role: 'superadmin', tenant_id: tenantId }, selectionResult: success(null) },
    { adminResults: { subscription_invoices: success([]) } },
    { adminResults: { subscription_invoices: { data: null, error: { message: 'Not ready' } } } },
    { preview: true },
  ]) {
    const current = harness(options)
    const previous = harness(options, baselineSource)
    const { manageSubscriptionUrl: currentUrl, ...currentReadOnly } = await current.snapshot()
    const { manageSubscriptionUrl: previousUrl, ...previousReadOnly } = await previous.snapshot()
    assert.deepEqual(currentReadOnly, previousReadOnly)
    assert.ok(currentUrl === null || currentUrl === previousUrl)
    const initialQuery = (mock) => mock.calls.find((call) => call.table === 'tenant_members')
    assert.deepEqual(initialQuery(current), initialQuery(previous))
  }
})

test('preview never verifies an Owner or mints a token; shell matches PR49 and financial files match main baseline', async () => {
  const mock = harness({ preview: true })
  assert.equal((await mock.snapshot()).manageSubscriptionUrl, null)
  assert.ok(!mock.calls.some((call) => call.method === 'getUser' || call.method === 'signBillingToken'))
  for (const file of ['app/hub/_components/HubShell.tsx', 'lib/billing-link.ts', 'lib/billing.ts', 'app/api/billing/checkout-self/route.ts', 'app/api/billing/cancel-schedule/route.ts']) {
    const fileBaseline = file === 'app/hub/_components/HubShell.tsx' ? inventoryBaseline : baseline
    const old = execFileSync('git', ['-C', root, 'show', `${fileBaseline}:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n')
    assert.equal(readFileSync(join(root, file), 'utf8').replaceAll('\r\n', '\n'), old)
  }
  const shell = readFileSync(join(root, 'app/hub/_components/HubShell.tsx'), 'utf8')
  assert.match(shell, /snapshot\.manageSubscriptionUrl && !snapshot\.isPreview/)
  assert.match(shell, /snapshot\.invoices\.map/)
})
