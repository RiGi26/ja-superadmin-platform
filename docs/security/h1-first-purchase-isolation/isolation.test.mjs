import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readPlan, assertInertPlan, runtimeBlockers, createOfflineFetch, describeDevRequest,
  DEV_ORIGIN, TEST_SCHEMA } from './offline-transport.mjs'

const here = new URL('./', import.meta.url)
const root = new URL('../../../', here)
const source = (name) => readFileSync(new URL(name, here), 'utf8')
const plan = readPlan()
const snap = 'https://app.sandbox.midtrans.com/snap/v1/transactions'
const payload = () => ({
  transaction_details: { order_id: 'JA-SUB-2026-ABCDEF12-MON', gross_amount: 100000 },
  customer_details: { first_name: 'H1 first-purchase A', email: plan.fixture.emailA },
  callbacks: { finish: 'http://localhost:3000/billing/selesai?inv=8c15706b-f67e-4cc5-8b90-0fe619dd0401' },
})
const options = (body = payload()) => ({ method: 'POST', headers: {
  'content-type': 'application/json',
  authorization: `Basic ${Buffer.from('H1_OFFLINE_ONLY:').toString('base64')}`,
}, body: JSON.stringify(body) })

test('checked-in configuration cannot start or access a provider', () => {
  assert.equal(assertInertPlan(plan), plan)
  assert.equal(plan.credentials, null)
  assert.equal(plan.sessions, null)
  assert.equal(plan.providerEvidence, null)
  assert.equal(runtimeBlockers(plan).length, 11)
  assert.ok(runtimeBlockers(plan).includes('owner_runtime_authorization'))
  assert.ok(runtimeBlockers(plan).includes('live_transport_not_implemented_or_authorized'))
})

test('each attempted enabling flag or supplied credential fails closed', () => {
  for (const [key, value] of Object.entries({ runtimeAuthorized: true, providerWritesAuthorized: true,
    automaticStart: true, realNetwork: 'ALLOW_DEV', mode: 'RUNTIME', credentials: {}, sessions: {}, providerEvidence: {} })) {
    assert.throws(() => createOfflineFetch({ ...plan, [key]: value }), /H1_ISOLATION_DENIED/, key)
  }
})

test('target, schema, origin and missing containment gates cannot be changed', () => {
  for (const [key, value] of Object.entries({ projectRef: 'hxhusfkrlafxdnyasmsu', databaseSchema: 'public',
    applicationOrigin: 'http://0.0.0.0:3000', checkoutOrigin: 'https://example.com', tables: ['companies'], requiredRuntimeEvidence: [] })) {
    assert.throws(() => assertInertPlan({ ...plan, [key]: value }), /H1_ISOLATION_DENIED/, key)
  }
})

test('existing Owner UUID, subscription or altered fixture cannot become runtime input', () => {
  for (const [key, value] of Object.entries({ ownerA: 'existing-user', ownerB: 'existing-user',
    initialSubscriptions: 1, initialInvoices: 1, initialEvents: 1, maximumSuccessfulCheckouts: 2,
    maximumAuthUsersCreated: 3, maximumRuntimeMinutes: 60, emailA: 'customer@example.com', tenantA: plan.fixture.tenantB })) {
    assert.throws(() => createOfflineFetch({ ...plan, fixture: { ...plan.fixture, [key]: value } }), /H1_ISOLATION_DENIED/, key)
  }
})

test('offline transport never calls native fetch for real Auth, database, mail, portal or payment', async () => {
  const original = globalThis.fetch
  let networkCalls = 0
  globalThis.fetch = () => { networkCalls++; throw new Error('network must not run') }
  try {
    const offline = createOfflineFetch()
    for (const url of [DEV_ORIGIN + '/auth/v1/user', DEV_ORIGIN + '/rest/v1/tenant_members',
      'https://hxhusfkrlafxdnyasmsu.supabase.co/rest/v1/tenants', 'https://api.resend.com/emails',
      'https://lms.webzoka.com/api/billing/sync', 'https://app.midtrans.com/snap/v1/transactions',
      'https://api.sandbox.midtrans.com/v2/order/status', 'http://localhost:3000/api/cron/customer-onboarding']) {
      await assert.rejects(() => offline(url), /real network disabled/, url)
    }
    const response = await offline(snap, options())
    assert.equal(response.status, 200)
    assert.equal(networkCalls, 0)
  } finally {
    globalThis.fetch = original
  }
})

test('dummy fixture payment returns an in-memory response and reserved invalid redirect', async () => {
  const response = await createOfflineFetch()(snap, options())
  assert.deepEqual(await response.json(), { token: 'H1_OFFLINE_SYNTHETIC_SNAP',
    redirect_url: 'https://h1-checkout.invalid/checkout/synthetic' })
})

test('real or absent payment credentials and wrong transport are denied', async () => {
  const offline = createOfflineFetch()
  for (const authorization of ['', 'Basic REAL_KEY', 'Bearer fake']) {
    const init = options()
    init.headers.authorization = authorization
    await assert.rejects(() => offline(snap, init), /dummy payment credentials/)
  }
  await assert.rejects(() => offline(snap, { ...options(), method: 'PUT' }), /real network disabled/)
  await assert.rejects(() => offline(snap + '?test=true', options()), /real network disabled/)
})

test('non-fixture customers, callbacks, amounts and order identifiers are denied', async () => {
  const bodies = [payload(), payload(), payload(), payload(), payload()]
  bodies[0].customer_details.email = 'customer@example.com'
  bodies[1].customer_details.phone = '123'
  bodies[2].callbacks.finish = 'https://www.webzoka.com/billing/selesai?inv=anything'
  bodies[3].transaction_details.gross_amount = 1
  bodies[4].transaction_details.order_id = 'REAL_ORDER'
  for (const body of bodies) await assert.rejects(() => createOfflineFetch()(snap, options(body)), /non-fixture/)
})

test('transport snapshots configuration instead of trusting later mutation', async () => {
  const input = structuredClone(plan)
  const offline = createOfflineFetch(input)
  input.checkoutOrigin = 'https://example.com'
  input.fixture.emailA = 'customer@example.com'
  assert.equal((await (await offline(snap, options())).json()).redirect_url,
    'https://h1-checkout.invalid/checkout/synthetic')
})

test('dry-run descriptors force both schema profiles on every declared REST table', () => {
  for (const table of plan.tables) {
    const descriptor = describeDevRequest(`${DEV_ORIGIN}/rest/v1/${table}?select=*`)
    assert.deepEqual(descriptor.headers, { 'Accept-Profile': TEST_SCHEMA, 'Content-Profile': TEST_SCHEMA })
    assert.equal(descriptor.kind, 'DESCRIPTOR_ONLY')
    assert.equal(descriptor.redirect, 'manual')
  }
})

test('dry-run descriptors do not route Registry, RPC, unknown services or foreign hosts', () => {
  for (const url of [DEV_ORIGIN + '/rest/v1/companies', DEV_ORIGIN + '/rest/v1/rpc/core_registry_mutate',
    DEV_ORIGIN + '/rest/v1/public.tenants', DEV_ORIGIN + '/functions/v1/billing',
    DEV_ORIGIN + '/storage/v1/object', DEV_ORIGIN + '/rest/v1/%74enants',
    DEV_ORIGIN + '/rest/v1/tenants#fragment', DEV_ORIGIN.replace('.supabase.co', '.supabase.co.evil.invalid') + '/rest/v1/tenants',
    'https://user:secret@mcvekinhgcqygfddyifs.supabase.co/rest/v1/tenants']) {
    assert.throws(() => describeDevRequest(url), /H1_ISOLATION_DENIED/)
  }
})

test('dry-run writes describe only subscription/invoice INSERT/PATCH; never issue them', () => {
  for (const table of ['tenant_subscriptions', 'subscription_invoices']) {
    for (const method of ['POST', 'PATCH']) assert.equal(
      describeDevRequest(`${DEV_ORIGIN}/rest/v1/${table}`, method).method, method)
  }
  for (const [table, method] of [['tenants', 'PATCH'], ['tenant_members', 'POST'],
    ['platform_settings', 'PATCH'], ['subscription_events', 'POST'], ['subscription_invoices', 'DELETE']]) {
    assert.throws(() => describeDevRequest(`${DEV_ORIGIN}/rest/v1/${table}`, method), /H1_ISOLATION_DENIED/)
  }
})

test('dry-run Auth descriptors exclude signup, recovery, OAuth, administration and global logout', () => {
  for (const [url, method] of [['/auth/v1/user', 'GET'], ['/auth/v1/.well-known/jwks.json', 'GET'],
    ['/auth/v1/token?grant_type=password', 'POST'], ['/auth/v1/token?grant_type=refresh_token', 'POST'],
    ['/auth/v1/logout?scope=local', 'POST']]) {
    assert.equal(describeDevRequest(DEV_ORIGIN + url, method).kind, 'DESCRIPTOR_ONLY')
  }
  for (const suffix of ['/signup', '/recover', '/invite', '/admin/users', '/authorize', '/logout', '/logout?scope=global',
    '/token?grant_type=authorization_code']) {
    assert.throws(() => describeDevRequest(DEV_ORIGIN + '/auth/v1' + suffix, 'POST'), /H1_ISOLATION_DENIED/)
  }
})

test('schema and fixture scripts refuse before any proposed mutation and end in rollback', () => {
  for (const name of ['schema.PROPOSED.sql', 'fixture.PROPOSED.sql', 'cleanup.PROPOSED.sql']) {
    const sql = source(name).replace(/^--.*$/gm, '')
    assert.match(sql, /^\s*BEGIN;/)
    assert.match(sql, /RAISE EXCEPTION 'H1_ISOLATION_PREPARATION_ONLY_NOT_AUTHORIZED'/)
    const refusal = sql.indexOf('H1_ISOLATION_PREPARATION_ONLY_NOT_AUTHORIZED')
    const mutation = sql.search(/CREATE SCHEMA|INSERT INTO|DROP TABLE/)
    assert.ok(refusal < mutation)
    assert.match(sql, /ROLLBACK;\s*$/)
    assert.doesNotMatch(sql, /\bCOMMIT\s*;/i)
  }
})

test('schema proposes exactly seven isolated tables with RLS and no public/Registry DDL', () => {
  const sql = source('schema.PROPOSED.sql').replace(/^--.*$/gm, '')
  const tables = [...sql.matchAll(/CREATE TABLE h1_first_purchase_test\.([a-z_]+)/g)].map(m => m[1])
  assert.deepEqual(tables.sort(), [...plan.tables].sort())
  assert.equal([...sql.matchAll(/ENABLE ROW LEVEL SECURITY/g)].length, 7)
  assert.doesNotMatch(sql, /(?:CREATE|ALTER|INSERT INTO|UPDATE|DELETE FROM|DROP)\s+(?:TABLE\s+)?(?:public|core_registry_private|auth)\./i)
  assert.doesNotMatch(sql, /CREATE (?:OR REPLACE )?(?:FUNCTION|TRIGGER|EVENT TRIGGER|EXTENSION)|IF NOT EXISTS|DISABLE ROW LEVEL SECURITY|\bCASCADE\b/i)
  assert.match(sql, /USING \(user_id = \(SELECT auth.uid\(\)\)\)/)
  assert.match(sql, /GRANT INSERT, UPDATE ON h1_first_purchase_test.tenant_subscriptions, h1_first_purchase_test.subscription_invoices TO service_role/)
})

test('proposed table fields and relationships cover the exercised Hub checkout contract', () => {
  const sql = source('schema.PROPOSED.sql')
  const columns = {
    tenants: ['id','name','slug','platform','status','plan_tier','owner_user_id','email','phone','trial_ends_at'],
    tenant_members: ['tenant_id','user_id','role','is_active'],
    subscription_plans: ['id','name','platform','tier','tier_display_name','price_monthly','price_yearly','features','is_active'],
    tenant_subscriptions: ['id','tenant_id','plan_id','status','trial_ends_at','current_period_start','current_period_end','created_at'],
    subscription_invoices: ['id','tenant_id','subscription_id','plan_id','period','amount','midtrans_order_id','snap_token','redirect_url',
      'status','midtrans_mode','change_type','promo_code','promo_discount_percent','paid_at','created_at','updated_at'],
    platform_settings: ['key','value'], subscription_events: ['tenant_id','event_type','payload'],
  }
  for (const [table, names] of Object.entries(columns)) {
    const body = sql.split(`CREATE TABLE h1_first_purchase_test.${table} (`)[1]?.split('\n);')[0]
    assert.ok(body, table)
    for (const name of names) assert.match(body, new RegExp(`\\n  ${name}\\s`), table + '.' + name)
  }
  assert.match(sql, /user_id uuid NOT NULL REFERENCES auth.users\(id\)/)
  assert.match(sql, /owner_user_id uuid REFERENCES auth.users\(id\)/)
  assert.match(sql, /plan_id uuid REFERENCES h1_first_purchase_test.subscription_plans\(id\)/)
  assert.match(sql, /UNIQUE \(tenant_id, user_id\)/)
})

test('fixture writes only seven seed rows and no subscription/invoice/event or Company rows', () => {
  const sql = source('fixture.PROPOSED.sql').replace(/^--.*$/gm, '')
  assert.match(sql, /OWNER_A_NEW_AUTH_UUID/)
  assert.match(sql, /OWNER_B_NEW_AUTH_UUID/)
  const targets = [...sql.matchAll(/INSERT INTO h1_first_purchase_test\.([a-z_]+)/g)].map(m => m[1])
  assert.deepEqual(targets, ['tenants','tenant_members','subscription_plans','platform_settings'])
  for (const id of [plan.fixture.tenantA, plan.fixture.tenantB, plan.fixture.plan,
    plan.fixture.membershipA, plan.fixture.membershipB]) assert.ok(sql.includes(id))
  assert.match(sql, /email_confirmed_at IS NOT NULL AND is_anonymous IS FALSE/)
  assert.match(sql, /RAISE EXCEPTION 'Fixture schema must be empty and task-owned'/)
  assert.doesNotMatch(sql, /(?:INSERT INTO|UPDATE|DELETE FROM) (?:public|auth|core_registry_private)\./)
})

test('catalog proposal is SELECT-only and does not invoke mutating RPC or expose user data', () => {
  const sql = source('catalog.READ_ONLY.sql').replace(/^--.*$/gm, '')
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO|SET)\b/i)
  assert.doesNotMatch(sql, /FROM auth.users|SELECT \*|p.prosrc\s*(?:,|FROM)/i)
  assert.match(sql, /pg_event_trigger/)
  assert.match(sql, /pg_trigger/)
})

test('cleanup refuses unexpected rows/paid state and uses only ordered task-object RESTRICT drops', () => {
  const sql = source('cleanup.PROPOSED.sql').replace(/^--.*$/gm, '')
  const drops = [...sql.matchAll(/DROP TABLE h1_first_purchase_test\.([a-z_]+) RESTRICT;/g)].map(m => m[1])
  assert.deepEqual(drops, ['subscription_invoices','subscription_events','tenant_members',
    'tenant_subscriptions','tenants','subscription_plans','platform_settings'])
  assert.match(sql, /DROP SCHEMA h1_first_purchase_test RESTRICT;/)
  assert.match(sql, /Unexpected state: preserve evidence and request bounded recovery/)
  assert.match(sql, /paid_at IS NOT NULL/)
  assert.doesNotMatch(sql, /CASCADE|TRUNCATE|DELETE FROM|DROP (?:TABLE|SCHEMA) (?:public|auth|core_registry_private)/i)
})

test('offline module contains no live transport, runtime installer or environment loader', () => {
  const moduleSource = source('offline-transport.mjs')
  assert.deepEqual([...moduleSource.matchAll(/from '([^']+)'/g)].map(m => m[1]), ['node:fs'])
  assert.doesNotMatch(moduleSource, /process\.env|\.env\.local|node:(?:net|tls|http|https|child_process)|\b(?:fetch|connect|listen|spawn|execFile|import)\s*\(/)
})

test('all 35 accepted application, security and schema sources remain byte-identical', () => {
  const pins = JSON.parse(source('source-pins.json'))
  assert.equal(Object.keys(pins).length, 35)
  for (const [name, expected] of Object.entries(pins)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(name, root))).digest('hex'), expected, name)
  }
  assert.match(readFileSync(new URL('lib/core-company.ts', root), 'utf8'), /CORE_COMPANY_RUNTIME_ENABLED = false/)
})
