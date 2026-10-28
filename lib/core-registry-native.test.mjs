// Offline DAL behavior, audit verification and SQL source contracts. No live SQL/Auth.
import assert from 'node:assert/strict'
import { signupHistoricalBytes } from './hub-signup-source-contract.mjs'
import { historicalNavigationBytes } from './hub-navigation-source-contract.mjs'
import * as crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import * as zod from 'zod'
import { createClient as createSdkClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const docs = 'docs/security/h1-g1-core-dev/'
const source = readFileSync(join(root, 'lib/core-registry-native.ts'), 'utf8')
const sql = readFileSync(join(root, docs, '008_supabase_native_registry.PROPOSED.sql'), 'utf8')
const recovery = readFileSync(join(root, docs, '009_supabase_native_recovery.PROPOSED.sql'), 'utf8')
const origin = 'https://hxhusfkrlafxdnyasmsu.supabase.co'
const realmModule = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync(join(root, 'lib/e1-realm.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: realmModule, exports: realmModule.exports })
const id = (n) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`
const actor = id(1), session = id(2), company = id(3), key = id(4), target = id(5), proposer = id(6), claim = id(7)
const bootstrap = { action: 'company.bootstrap', commandId: key, payload: { companyName: 'Synthetic Company', portalType: 'stock' } }
const approve = { action: 'owner.approve', commandId: key, payload: { claimId: claim } }
const rename = { action: 'company.rename', commandId: key, payload: { companyId: company, expectedRevision: 0, companyName: 'Renamed Synthetic' } }
const baseReceipt = { companyId: company, eventId: id(8), eventHash: 'a'.repeat(64), revision: 1 }
const plain = (v) => JSON.parse(JSON.stringify(v))
const digest = (v) => crypto.createHash('sha256').update(v).digest('hex')
const issuerModule = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync(join(root, 'lib/registry-mutation-binding.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: issuerModule, exports: issuerModule.exports, require(name) {
  if (name === 'server-only') return {}
  throw new Error(name)
} })

const e1Request = { action: 'e1.stock.admit', commandId: key,
  payload: { companyName: 'Synthetic Company', product: 'stock' } }
const e1Receipt = { reservation: { companyId: company, reservationId: id(11), coreTenantId: id(12),
  coreSubject: actor, product: 'stock', status: 'reserved', stockTenantId: null, stockSubject: null, profileId: null },
  receipt: baseReceipt, modeledOnly: false }

function harness(options = {}) {
  const calls = []
  const forbidden = () => { throw new Error('Unexpected direct table, network or payment call') }
  const user = { id: actor, email: 'customer@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false }
  const claims = { sub: actor, session_id: session, iss: `${origin}/auth/v1`, aud: 'authenticated', role: 'authenticated',
    iat: Math.floor(Date.now() / 1000) - 10, exp: Math.floor(Date.now() / 1000) + 600 }
  let authCalls = 0, storageCalls = 0, liveCalls = 0
  const db = { from: forbidden, auth: {
    getSession: async () => { storageCalls++; calls.push(['getSession'])
      return { error: options.storageError ?? null, data: { session: {
        access_token: options.noToken ? null : options.changeToken && storageCalls % 2 === 0 ? 'changed' : 'synthetic-token',
        // A fake stored user must never enter the native RPC identity.
        user: { id: target },
      } } }
    },
    getUser: async token => { assert.equal(token, 'synthetic-token'); calls.push(['getUser']); authCalls++
      return options.authError || (options.revokeOnRefresh && authCalls > 1) || (options.revokeAt && authCalls >= options.revokeAt)
        ? { error: { message: 'revoked' }, data: { user: null } }
        : { error: null, data: { user: { ...user, ...options.user } } }
    },
    getClaims: async token => { assert.equal(token, 'synthetic-token'); calls.push(['getClaims']); return { error: options.claimsError ?? null,
      data: { claims: { ...claims, ...options.claims } } } },
  }, rpc: (name, args) => ({ setHeader: async (header, token) => {
    assert.equal(header, 'Authorization'); assert.equal(token, 'Bearer synthetic-token')
    calls.push([name, args])
    if (name === 'core_registry_session_is_live') {
      liveCalls++
      if (options.clockAdvance) options.clock.now += options.clockAdvance
      return { error: options.liveError ?? null,
        data: options.liveRevokeAt <= liveCalls ? false : options.live === undefined ? true : options.live }
    }
    if (name === 'core_registry_e1_stock_context') return { error: options.contextError ?? null,
      data: options.stockContext ?? null }
    assert.equal(name, 'core_registry_authorize')
    return { error: options.readError ?? null,
      data: options.access === undefined ? { companyId: company, membershipId: id(9), role: 'owner', revision: 0 } : options.access }
  } }) }
  const admin = { from: forbidden, auth: { admin: { getUserById: async (subject) => {
    calls.push(['getUserById', subject]); return { error: options.adminAuthError ?? null,
      data: { user: { ...user, id: subject, ...(options.targetUser ?? {}) } } }
  } } }, rpc: async (name, args) => {
    calls.push([name, args])
    if (name === 'core_registry_owner_claim_context') return { error: options.contextError ?? null,
      data: options.context ?? { targetUserId: target, proposerId: proposer } }
    if (options.writeHook) return options.writeHook(name, args)
    return { error: options.writeError ?? null, data: options.receipt ?? baseReceipt }
  } }
  const loaded = { exports: {} }
  class HarnessDate extends Date { static now() { return options.clock?.now ?? Date.now() } }
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, Buffer, Date: HarnessDate, fetch: forbidden,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: options.origin ?? origin, CORE_COMPANY_RUNTIME_ENABLED: 'true' } },
    require(name) {
      if (name === 'server-only') return {}
      if (name === 'node:crypto') return crypto
      if (name === 'zod') return zod
      if (name === '@/lib/e1-realm') return realmModule.exports
      if (name === '@/lib/superadmin') return { isSuperadminEmail: email => email === 'operator@example.test' }
      // Gate override is confined to this offline mock. Real constant stays false.
      if (name === '@/lib/core-company') return { CORE_DEV_ORIGIN: origin, CORE_COMPANY_RUNTIME_ENABLED: options.enabled ?? true }
      if (name === '@/lib/e1-stock-integration') return { E1_STOCK_RUNTIME_ENABLED: options.e1Enabled ?? true }
      if (name === '@/lib/e1-quarantine-release') return { E1_QUARANTINE_RUNTIME_ENABLED: (options.enabled ?? true) && (options.e1Enabled ?? true) }
      // Existing transport tests simulate a future bound issuer only. New tests
      // below load the real source and prove that no such issuer is registered.
      if (name === '@/lib/registry-mutation-binding') return options.realBinding ? issuerModule.exports : {
        registryMutationBinding: () => ({ status: 'synthetic-unit-only' }),
        e1StockMutationBinding: issuerModule.exports.e1StockMutationBinding,
      }
      if (name === '@/lib/supabase/server') return { createClient: async () => { calls.push(['createClient']); return db } }
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => { calls.push(['createAdminClient']); return admin } }
      throw new Error(`Unapproved dependency: ${name}`)
    },
  })
  return { api: loaded.exports, calls, writes: () => calls.filter(([name]) => name === 'core_registry_mutate') }
}

const hubContext = { ...e1Receipt.reservation, companyName: 'Synthetic Company',
  stockOrigin: 'https://oyyfcmlquqfrdoffkgsd.supabase.co', stockBinding: null }
test('Hub context read pins bearer, requires current customer and returns only the inactive selected graph', async () => {
  for (const stockBinding of [null, { stockTenantId: id(20), stockSubject: id(21), profileId: id(22), auditEventId: id(23), status: 'quarantined' }]) {
    const h = harness({ stockContext: { ...hubContext, stockBinding } })
    const result = await h.api.readNativeE1StockContext({ companyId: company, reservationId: id(11) })
    assert.deepEqual(plain(result), { status: stockBinding ? 'quarantined' : 'reserved', companyName: 'Synthetic Company',
      companyId: company, reservationId: id(11), isActive: false })
    assert.equal(h.calls.filter(([name]) => name === 'core_registry_session_is_live').length, 2)
    assert.equal(h.calls.some(([name]) => name === 'createAdminClient'), false)
  }
})
for (const [name, options, status] of [
  ['closed gate', { enabled: false }, 'blocked'], ['closed Stock gate', { e1Enabled: false }, 'blocked'],
  ['foreign realm', { origin: 'https://foreign.supabase.co' }, 'blocked'],
  ['revoked session', { live: false }, 'denied'], ['revocation after read', { liveRevokeAt: 2 }, 'denied'],
  ['operator', { user: { email: 'operator@example.test' } }, 'denied'],
  ['foreign actor', { stockContext: { ...hubContext, coreSubject: target } }, 'denied'],
  ['foreign Company', { stockContext: { ...hubContext, companyId: target } }, 'denied'],
  ['foreign reservation', { stockContext: { ...hubContext, reservationId: target } }, 'denied'],
  ['active profile assertion', { stockContext: { ...hubContext, isActive: true } }, 'denied'],
  ['failed context read', { contextError: { code: 'PGRST202' } }, 'unconfirmed'],
]) test(`Hub context ${name}: no active access or private context escapes`, async () => {
  const h = harness({ stockContext: hubContext, ...options })
  assert.deepEqual(plain(await h.api.readNativeE1StockContext({ companyId: company, reservationId: id(11) })), { status })
})

test('E1 native transport stays disabled and accepts no identity, approval or provenance fields', async () => {
  const dormant = harness({ enabled: false })
  assert.equal((await dormant.api.executeNativeE1StockCommand(e1Request)).status, 'blocked')
  assert.deepEqual(dormant.calls, [])
  const e1Dormant = harness({ enabled: true, e1Enabled: false })
  assert.equal((await e1Dormant.api.executeNativeE1StockCommand(e1Request)).status, 'blocked')
  assert.deepEqual(e1Dormant.calls, [])
  const h = harness()
  for (const field of ['actor', 'session', 'companyId', 'classification', 'proof', 'operators']) {
    assert.equal((await h.api.executeNativeE1StockCommand({ ...e1Request, [field]: actor })).status, 'denied')
    assert.equal((await h.api.executeNativeE1StockCommand({ ...e1Request,
      payload: { ...e1Request.payload, [field]: actor } })).status, 'denied')
  }
  assert.equal((await h.api.executeNativeE1StockCommand({ ...e1Request,
    payload: { ...e1Request.payload, product: 'lms' } })).status, 'denied')
  assert.deepEqual(h.calls, [])
})
test('synthetic transport model reuses Auth checks and exact proposed RPC selectors; not managed runtime', async () => {
  const h = harness({ receipt: e1Receipt })
  const result = await h.api.executeNativeE1StockCommand(e1Request)
  assert.equal(result.status, 'completed')
  const calls = h.calls.filter(([name]) => name === 'core_registry_e1_stock_create')
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1].p_actor, actor); assert.equal(calls[0][1].p_session, session)
  assert.equal(calls[0][1].p_company_name, e1Request.payload.companyName)
  assert.equal('p_payload' in calls[0][1], false)
  assert.equal(h.calls.filter(([name]) => name === 'getUser').length, 3)
  assert.equal(h.calls.filter(([name]) => name === 'core_registry_session_is_live').length, 3)
})

for (const live of [false, null, 'true', 1, {}, [true]]) {
  test(`managed checkpoint must return literal true: ${JSON.stringify(live)}`, async () => {
    const h = harness({ live, realBinding: true, receipt: e1Receipt })
    assert.equal((await h.api.executeNativeE1StockCommand(e1Request)).status, 'denied')
    assert.equal(h.calls.some(([name]) => name === 'createAdminClient'), false)
  })
}
test('missing managed RPC, permission error and transport failure never fall back to JWT-only authority', async () => {
  for (const code of ['PGRST202', '42501', '']) {
    const h = harness({ liveError: { code, message: 'private provider detail' }, realBinding: true })
    assert.deepEqual(plain(await h.api.executeNativeE1StockCommand(e1Request)), { status: 'denied' })
    assert.equal(h.calls.some(([name]) => name === 'createAdminClient'), false)
  }
})
test('managed revocation at final pre-write checkpoint denies with no write', async () => {
  const h = harness({ liveRevokeAt: 2, realBinding: true, receipt: e1Receipt })
  assert.equal((await h.api.executeNativeE1StockCommand(e1Request)).status, 'denied')
  assert.equal(h.calls.some(([name]) => name === 'core_registry_e1_stock_create'), false)
})
test('managed revocation after write preserves uncertainty and original command key', async () => {
  const h = harness({ liveRevokeAt: 3, realBinding: true, receipt: e1Receipt })
  assert.deepEqual(plain(await h.api.executeNativeE1StockCommand(e1Request)), { status: 'unconfirmed', commandId: key })
  assert.equal(h.calls.filter(([name]) => name === 'core_registry_e1_stock_create').length, 1)
})
test('managed revocation after Company read suppresses authorization result', async () => {
  const h = harness({ liveRevokeAt: 2 })
  assert.deepEqual(plain(await h.api.authorizeNativeCompany({ companyId: company, ownerOnly: false })), { status: 'denied' })
})
test('slow checkpoint cannot renew a stale 30-second observation', async () => {
  const h = harness({ clock: { now: Date.now() }, clockAdvance: 30_001, realBinding: true })
  assert.equal((await h.api.executeNativeE1StockCommand(e1Request)).status, 'denied')
  assert.equal(h.calls.some(([name]) => name === 'createAdminClient'), false)
})
test('missing admission RPC reports a specific deployment dependency without fallback or retry', async () => {
  const h = harness({ writeError: { code: 'PGRST202' }, realBinding: true })
  assert.deepEqual(plain(await h.api.executeNativeE1StockCommand(e1Request)),
    { status: 'blocked', reason: 'E1_ADMISSION_RPC_UNAVAILABLE' })
  assert.equal(h.calls.filter(([name]) => name === 'core_registry_e1_stock_create').length, 1)
})
test('busy fence requires a caller retry with fresh managed checkpoints and same command', async () => {
  const h = harness({ writeError: { code: '55P03' }, realBinding: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await h.api.executeNativeE1StockCommand(e1Request)).status, 'unconfirmed')
    assert.equal(h.calls.filter(([name]) => name === 'core_registry_e1_stock_create').length, attempt + 1)
  }
  assert.equal(h.calls.filter(([name]) => name === 'core_registry_session_is_live').length, 4)
  for (const [, args] of h.calls.filter(([name]) => name === 'core_registry_e1_stock_create')) assert.equal(args.p_command, key)
})

test('contention recovery: busy admission preserves the command as uncertain for an explicit retry', async () => {
  const h = harness({ receipt: e1Receipt, writeError: { code: '55P03' } })
  const result = await h.api.executeNativeE1StockCommand(e1Request)
  assert.deepEqual(plain(result), { status: 'unconfirmed', commandId: key })
  assert.equal(h.calls.filter(([name]) => name === 'core_registry_e1_stock_create').length, 1)
})

test('controlled overlapping admission callers preserve one command and reauthenticate on explicit retry', async () => {
  let entered, release, attempts = 0
  const arrived = new Promise(resolve => { entered = resolve })
  const resume = new Promise(resolve => { release = resolve })
  const h = harness({ writeHook: async (name, args) => {
    assert.equal(name, 'core_registry_e1_stock_create'); assert.equal(args.p_command, key)
    if (++attempts === 1) { entered(); await resume }
    else if (attempts === 2) return { error: { code: '55P03' }, data: null }
    return { error: null, data: e1Receipt }
  } })
  const first = h.api.executeNativeE1StockCommand(e1Request); await arrived
  assert.deepEqual(plain(await h.api.executeNativeE1StockCommand(e1Request)), { status: 'unconfirmed', commandId: key })
  assert.equal(attempts, 2, 'Busy result must not trigger an automatic writer retry')
  release(); const completed = await first
  const liveBeforeRetry = h.calls.filter(([name]) => name === 'core_registry_session_is_live').length
  const recovered = await h.api.executeNativeE1StockCommand(e1Request)
  assert.equal(recovered.status, 'completed'); assert.deepEqual(plain(recovered), plain(completed))
  assert.equal(attempts, 3)
  assert.equal(h.calls.filter(([name]) => name === 'core_registry_session_is_live').length - liveBeforeRetry, 3)
})
test('installed SDK sends pinned bearer on managed RPC even when client default identity differs', async () => {
  let count = 0
  const client = createSdkClient(origin, 'synthetic-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: 'Bearer different-default' }, fetch: async (url, init) => {
      count++
      assert.equal(String(url), `${origin}/rest/v1/rpc/core_registry_session_is_live`)
      assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer pinned-customer')
      return new Response('true', { status: 200, headers: { 'Content-Type': 'application/json' } })
    } },
  })
  const result = await client.rpc('core_registry_session_is_live').setHeader('Authorization', 'Bearer pinned-customer')
  assert.equal(result.error, null); assert.equal(result.data, true); assert.equal(count, 1)
})

test('unsupported generic bind/checkout dispatch is blocked before Auth or client creation even with synthetic bound issuer', async () => {
  for (const action of ['e1.stock.bind', 'e1.stock.checkout']) {
    const h = harness({ receipt: e1Receipt })
    const result = await h.api.executeNativeE1StockCommand({ action, commandId: key,
      payload: { companyId: company, reservationId: id(11), product: 'stock' } })
    assert.deepEqual(plain(result), { status: 'blocked', reason: 'E1_COMMAND_ADAPTER_UNBOUND' })
    assert.deepEqual(h.calls, [])
  }
})
test('E1 transport observes revocation on refresh before constructing admin/writing', async () => {
  const h = harness({ revokeOnRefresh: true })
  assert.equal((await h.api.executeNativeE1StockCommand(e1Request)).status, 'denied')
  assert.equal(h.calls.some(([name]) => name === 'createAdminClient'), false)
})

test('platform operator claims and allowlisted account cannot become an E1 customer', async () => {
  for (const options of [{ claims: { user_role: 'superadmin' } }, { user: { email: 'operator@example.test' } }]) {
    const h = harness(options)
    assert.equal((await h.api.executeNativeE1StockCommand(e1Request)).status, 'denied')
    assert.equal(h.calls.some(([name]) => name === 'createAdminClient'), false)
  }
})
test('E1 transport refuses unsupported RPC/schema and does not retry an unconfirmed write', async () => {
  const denied = harness({ writeError: { code: 'P0001' } })
  assert.equal((await denied.api.executeNativeE1StockCommand(e1Request)).status, 'denied')
  const lost = harness({ writeError: { message: 'connection lost' } })
  assert.deepEqual(plain(await lost.api.executeNativeE1StockCommand(e1Request)), { status: 'unconfirmed', commandId: key })
  assert.equal(lost.calls.filter(([name]) => name === 'core_registry_e1_stock_create').length, 1)
})

test('revocation after an E1 RPC response is unconfirmed, never a claimed database rollback', async () => {
  const h = harness({ receipt: e1Receipt, revokeAt: 3 })
  assert.equal((await h.api.executeNativeE1StockCommand(e1Request)).status, 'unconfirmed')
  assert.equal(h.calls.filter(([name]) => name === 'core_registry_e1_stock_create').length, 1)
})
for (const change of [value => { value.reservation.coreSubject = target },
  value => { value.reservation.product = 'lms' }, value => { value.modeledOnly = true },
  value => { value.receipt.companyId = target }, value => { value.reservation.profileId = target },
  value => { Object.assign(value.reservation, { status: 'provisioned', stockSubject: id(13), stockTenantId: id(14), profileId: id(15) }) }]) {
  test(`E1 malformed/wrong binding receipt never establishes completion: ${change.toString()}`, async () => {
    const bad = plain(e1Receipt); change(bad)
    const h = harness({ receipt: bad })
    assert.equal((await h.api.executeNativeE1StockCommand(e1Request)).status, 'unconfirmed')
  })
}
test('E1 forward SQL remains guarded, additive, private, atomic and rollback-only', () => {
  const proposal = readFileSync(join(root, 'docs/security/h1-g1-e1-stock-forward.PROPOSED.sql'), 'utf8')
  assert.match(proposal, /RAISE EXCEPTION 'LOCAL_PROPOSAL_ONLY/)
  assert.match(proposal, /CREATE SCHEMA core_e1_stock_private/)
  assert.match(proposal, /public\.core_registry_mutate\(/)
  assert.match(proposal, /core_registry_private\.append_event\(/)
  assert.match(proposal, /SELECT count\(\*\) FROM public\.company_memberships/)
  assert.match(proposal, /p_auth_until <= clock_timestamp\(\).*a\.valid_until <= clock_timestamp\(\)/)
  assert.doesNotMatch(proposal, /(?:INSERT INTO|UPDATE|DELETE FROM) (?:public\.(?:tenants|tenant_subscriptions|invoices)|auth\.)/i)
  assert.doesNotMatch(proposal, /(?:DROP|ALTER) TABLE public\./i)
  assert.match(proposal, /ROLLBACK;\s*$/)
})

test('resource-isolated E1 uses native birth records, scoped writer guards and no historical-cleanliness issuer', () => {
  const proposal = readFileSync(join(root, 'docs/security/E1_RESOURCE_ISOLATION.PROPOSED.sql'), 'utf8')
  assert.match(proposal, /RAISE EXCEPTION 'LOCAL_PROPOSAL_ONLY/)
  for (const table of ['companies', 'company_memberships', 'company_portal_instances']) {
    assert.match(proposal, new RegExp(`INSERT INTO public\\.${table}\\(`))
  }
  assert.match(proposal, /FOREIGN KEY \(membership_id, company_id, core_subject\)/)
  assert.match(proposal, /core_subject uuid NOT NULL UNIQUE/)
  assert.match(proposal, /core_tenant_id uuid NOT NULL UNIQUE/)
  assert.match(proposal, /core_registry_private\.append_event\(/)
  assert.match(proposal, /pg_try_advisory_xact_lock\(pg_catalog.hashtextextended\('core_registry_writes'/)
  assert.match(proposal, /E1_BUSY_REAUTHENTICATE/)
  assert.match(proposal, /E1_PROTECTED_GRAPH/)
  assert.match(proposal, /E1_ORIGIN_IMMUTABLE/)
  assert.match(proposal, /CURRENT_OWNER_REQUIRED/)
  assert.match(proposal, /E1_CLAIM_REQUIRES_SCOPED_RECOVERY/)
  assert.doesNotMatch(proposal, /core_registry_private\.proof_valid|core_registry_private\.provenance|public\.core_registry_mutate\(/)
  assert.doesNotMatch(proposal.replace(/--[^\n]*/g, ''), /\b(?:CREATE|ALTER)\s+ROLE|\bauth\.(?:users|sessions|identities)\b|\bCOMMIT\s*;/i)
  assert.match(proposal, /REVOKE ALL ON FUNCTION public\.core_registry_e1_stock_create[\s\S]*FROM PUBLIC, anon, authenticated, service_role/)
  assert.match(proposal, /ROLLBACK;\s*$/)
})

test('real source constant is false; environment cannot bypass dormant native gate', async () => {
  assert.match(readFileSync(join(root, 'lib/core-company.ts'), 'utf8'), /CORE_COMPANY_RUNTIME_ENABLED = false as const/)
  const h = harness({ enabled: false })
  assert.equal((await h.api.executeNativeCompanyCommand(bootstrap)).status, 'blocked')
  assert.equal((await h.api.authorizeNativeOwnerBilling({ companyId: company })).status, 'blocked')
  assert.deepEqual(h.calls, [])
})
test('wrong project denies before constructing either client', async () => {
  const h = harness({ origin: 'https://wrong-project.invalid' })
  assert.equal((await h.api.executeNativeCompanyCommand(bootstrap)).status, 'blocked')
  assert.deepEqual(h.calls, [])
})
test('forged identity, Owner, provenance and unknown action reject before Auth', async () => {
  const h = harness()
  for (const name of ['actor', 'session', 'role', 'owner', 'provenance', 'verifiedSubjects', 'serviceKey']) {
    assert.equal((await h.api.executeNativeCompanyCommand({ ...bootstrap, [name]: actor })).status, 'denied')
    assert.equal((await h.api.executeNativeCompanyCommand({ ...bootstrap, payload: { ...bootstrap.payload, [name]: actor } })).status, 'denied')
  }
  assert.equal((await h.api.executeNativeCompanyCommand({ ...bootstrap, action: 'owner.promote' })).status, 'denied')
  assert.deepEqual(h.calls, [])
})
for (const [label, options] of [
  ['missing token bytes', { noToken: true }], ['storage unavailable', { storageError: true }],
  ['token changes during verification', { changeToken: true }],
  ['future account confirmation', { user: { email_confirmed_at: '2999-01-01T00:00:00Z' } }],
  ['unauthenticated', { authError: true }], ['revoked session response', { authError: true }],
  ['anonymous user', { user: { is_anonymous: true } }], ['unconfirmed account', { user: { email_confirmed_at: null } }],
  ['banned account', { user: { banned_until: '2999-01-01T00:00:00Z' } }], ['deleted account', { user: { deleted_at: '2026-01-01' } }],
  ['invalid claims', { claimsError: { message: 'bad signature' } }], ['forged subject', { claims: { sub: target } }],
  ['wrong issuer', { claims: { iss: 'https://forged.invalid/auth/v1' } }], ['wrong audience', { claims: { aud: 'service_role' } }],
  ['wrong database role', { claims: { role: 'service_role' } }],
  ['missing session', { claims: { session_id: undefined } }], ['expired token', { claims: { exp: 1 } }],
  ['future token', { claims: { iat: 9999999999 } }], ['future nbf', { claims: { nbf: 9999999999 } }],
]) test(`${label}: no mutation or admin client`, async () => {
  const h = harness(options)
  assert.equal((await h.api.executeNativeCompanyCommand(bootstrap)).status, 'denied')
  assert.equal(h.writes().length, 0)
  assert.equal(h.calls.some(([name]) => name === 'createAdminClient'), false)
})
test('normal command derives actor/session, uses one RPC, never accepts a positive client claim', async () => {
  const h = harness()
  const result = await h.api.executeNativeCompanyCommand(bootstrap)
  assert.equal(result.status, 'completed')
  assert.equal(h.writes().length, 1)
  const args = h.writes()[0][1]
  assert.equal(args.p_actor, actor); assert.equal(args.p_session, session)
  assert.equal(args.p_command, key); assert.deepEqual(plain(args.p_verified_subjects), [])
  assert.deepEqual(plain(args.p_payload), bootstrap.payload)
  assert.ok(Date.parse(args.p_auth_until) > Date.now() && Date.parse(args.p_auth_until) <= Date.now() + 30_000)
})
for (const reason of ['duplicate Company', 'replay conflict', 'revoked membership', 'cross-tenant membership', 'audit insertion failure', 'incomplete provenance']) {
  test(`${reason}: RPC error denies; no fallback write, retry or success receipt`, async () => {
    const h = harness({ writeError: { code: 'P0001', message: reason } })
    const result = await h.api.executeNativeCompanyCommand(rename)
    assert.deepEqual(plain(result), { status: 'denied' }); assert.equal(h.writes().length, 1)
  })
}
test('idempotent retry uses identical command and payload; receipt is never reused locally', async () => {
  const h = harness()
  await h.api.executeNativeCompanyCommand(rename); await h.api.executeNativeCompanyCommand(rename)
  assert.equal(h.writes().length, 2)
  assert.equal(h.calls.filter(([name]) => name === 'getUser').length, 2)
  assert.deepEqual(plain(h.writes().map(([, args]) => [args.p_command, args.p_payload])), [[key, rename.payload], [key, rename.payload]])
})
test('Owner billing uses user-scoped RLS RPC and fixed Owner check', async () => {
  const h = harness()
  assert.equal((await h.api.authorizeNativeOwnerBilling({ companyId: company })).status, 'authorized')
  const read = h.calls.find(([name]) => name === 'core_registry_authorize')
  assert.equal(read[1].p_owner_only, true)
  assert.equal(h.calls.some(([name]) => name === 'createAdminClient'), false)
  assert.equal((await h.api.authorizeNativeOwnerBilling({ companyId: company, ownerOnly: false })).status, 'denied')
})
test('lost transport response or invalid receipt is unconfirmed, never a promised rollback or automatic retry', async () => {
  for (const options of [{ writeError: { message: 'connection lost' } }, { receipt: { malformed: true } }]) {
    const h = harness(options)
    assert.deepEqual(plain(await h.api.executeNativeCompanyCommand(rename)), { status: 'unconfirmed', commandId: key })
    assert.equal(h.writes().length, 1)
  }
})
for (const [label, access] of [
  ['non-Owner', { companyId: company, membershipId: id(9), role: 'admin', revision: 0 }],
  ['cross-tenant', { companyId: target, membershipId: id(9), role: 'owner', revision: 0 }],
  ['revoked/no membership', null],
]) test(`${label}: Owner billing denied`, async () => {
  const h = harness({ access })
  assert.equal((await h.api.authorizeNativeOwnerBilling({ companyId: company })).status, 'denied')
})
test('synthetic approval transport checks accounts; real current-session issuer remains blocked', async () => {
  const h = harness()
  assert.equal((await h.api.executeNativeCompanyCommand(approve)).status, 'completed')
  assert.deepEqual(plain(h.calls.filter(([name]) => name === 'getUserById')), [['getUserById', target], ['getUserById', proposer]])
  assert.deepEqual(plain(h.writes()[0][1].p_verified_subjects), [target, proposer])
  assert.equal(h.calls.filter(([name]) => name === 'getUser').length, 2)
  assert.equal(h.writes().length, 1)
})

test('real issuer source blocks every Company/Owner mutation before privileged client or RPC', async () => {
  const revoke = { action: 'membership.revoke', commandId: key,
    payload: { companyId: company, expectedRevision: 0, membershipId: id(9) } }
  const propose = { action: 'owner.propose', commandId: key, payload: {
    companyId: company, expectedRevision: 0, targetUserId: target,
    previousOwnerId: id(10), caseKind: 'legacy',
  } }
  for (const input of [bootstrap, rename, revoke, propose, approve]) {
    const h = harness({ realBinding: true })
    const result = await h.api.executeNativeCompanyCommand(input)
    assert.equal(result.status, 'blocked')
    assert.equal(result.reason, 'TRUSTED_REGISTRY_ISSUER_UNBOUND')
    assert.ok(result.dependencies.includes('INDEPENDENT_COMPANY_PORTAL_PROOF_AND_TWO_CURRENT_OPERATOR_SESSIONS_UNBOUND'))
    assert.equal(h.calls.some(([name]) => name === 'createAdminClient'), false)
    assert.equal(h.writes().length, 0)
  }
})

test('real E1 admission binding uses concrete native command; reciprocal commands stay blocked', async () => {
  const admission = harness({ realBinding: true, receipt: e1Receipt })
  assert.equal((await admission.api.executeNativeE1StockCommand(e1Request)).status, 'completed')
  assert.equal(admission.calls.filter(([name]) => name === 'core_registry_e1_stock_create').length, 1)
  assert.equal(admission.calls.some(([name]) => name === 'core_registry_mutate'), false)
  for (const input of ['e1.stock.checkout', 'e1.stock.bind'].map(action => ({
    action, commandId: key, payload: { companyId: company, reservationId: id(11), product: 'stock' },
  }))) {
    const h = harness({ realBinding: true, receipt: e1Receipt })
    const result = await h.api.executeNativeE1StockCommand(input)
    assert.equal(result.status, 'blocked')
    assert.equal(result.reason, 'E1_COMMAND_ADAPTER_UNBOUND')
    assert.equal(h.calls.some(([name]) => name === 'createAdminClient'), false)
    assert.equal(h.calls.some(([name]) => name === 'core_registry_e1_stock_command'), false)
    assert.equal(h.calls.some(([name]) => name === 'core_registry_e1_stock_create'), false)
    assert.deepEqual(h.calls, [])
  }
})
test('binding selection separates admission and reciprocal RPCs while denying legacy and activation', () => {
  for (const action of [undefined, null, {}, 'company.bootstrap', 'owner.approve', 'e1.stock.checkout']) {
    assert.equal(issuerModule.exports.e1StockMutationBinding(action).status, 'blocked')
  }
  assert.equal(issuerModule.exports.registryMutationBinding().status, 'blocked')
  assert.deepEqual(plain(issuerModule.exports.e1StockMutationBinding('e1.stock.admit')),
    { status: 'bound', action: 'e1.stock.admit', rpc: 'core_registry_e1_stock_create' })
  assert.deepEqual(plain(issuerModule.exports.e1StockMutationBinding('e1.stock.bind')),
    { status: 'bound', action: 'e1.stock.bind', rpc: 'core_registry_e1_stock_bind_stage' })
})
test('installed-source E1 command retains fresh graph, uniqueness, pending-claim denial, atomic audit and nonblocking fence', () => {
  const installed = readFileSync(join(root, 'supabase/migrations/core_db/20261023112244_h1_g1_e1_core_production.sql'), 'utf8')
  const creation = installed.split('CREATE FUNCTION public.core_registry_e1_stock_create')[1]
    .split('REVOKE ALL ON ALL FUNCTIONS')[0]
  for (const fragment of [
    "auth.role() IS DISTINCT FROM 'service_role'", 'singleton AND enabled AND stock_origin IS NOT NULL',
    "p_auth_until > clock_timestamp() + interval '30 seconds'", 'pg_try_advisory_xact_lock',
    'FOR SHARE NOWAIT', "status = 'pending'", 'FROM public.company_memberships WHERE core_auth_user_id = p_actor)',
    'o.command_id <> p_command OR o.request_digest <> fingerprint', "RAISE EXCEPTION 'CURRENT_OWNER_REQUIRED'",
    'INSERT INTO public.companies', 'INSERT INTO public.company_memberships', 'INSERT INTO public.company_portal_instances',
    'INSERT INTO core_e1_resource_private.origins', 'core_registry_private.append_event', 'AUTH_EXPIRED_BEFORE_RETURN',
  ]) assert.ok(creation.includes(fragment), fragment)
  assert.doesNotMatch(creation, /core_registry_private\.provenance|p_company_id|EXCEPTION\s+WHEN|COMMIT;/i)
  for (const fragment of ['core_subject uuid NOT NULL UNIQUE', 'reservation_id uuid NOT NULL UNIQUE',
    'core_tenant_id uuid NOT NULL UNIQUE', 'FOREIGN KEY (membership_id, company_id, core_subject)',
    'E1_PROTECTED_GRAPH', 'E1_ORIGIN_IMMUTABLE', 'E1_CLAIM_REQUIRES_SCOPED_RECOVERY',
    "stock_origin = 'https://oyyfcmlquqfrdoffkgsd.supabase.co'"])
    assert.ok(installed.includes(fragment), fragment)
})
for (const [label, options] of [
  ['same proposer/approver', { context: { targetUserId: target, proposerId: actor } }],
  ['target approves own claim', { context: { targetUserId: actor, proposerId: proposer } }],
  ['proposer claims own ownership', { context: { targetUserId: target, proposerId: target } }],
  ['operator not enrolled', { contextError: { message: 'denied' } }],
  ['target/proposer Auth disabled', { adminAuthError: { message: 'not found' } }],
  ['target/proposer unconfirmed', { targetUser: { email_confirmed_at: null } }],
  ['approver revoked during Auth lookups', { revokeOnRefresh: true }],
]) test(`${label}: approval writes nothing`, async () => {
  const h = harness(options)
  assert.equal((await h.api.executeNativeCompanyCommand(approve)).status, 'denied')
  assert.equal(h.writes().length, 0)
})
test('audit export verifies exact stored bytes against independent head; forged, missing, reordered and other Company fail', () => {
  const h = harness()
  const zero = '0'.repeat(64)
  const first = { previous_hash: zero, canonical_payload: JSON.stringify({ companyId: company, action: 'company.bootstrap' }) }
  first.event_hash = digest(`${zero}:${first.canonical_payload}`)
  const second = { previous_hash: first.event_hash, canonical_payload: JSON.stringify({ companyId: company, action: 'company.rename' }) }
  second.event_hash = digest(`${second.previous_hash}:${second.canonical_payload}`)
  const input = { companyId: company, initialHash: zero, trustedHead: second.event_hash, events: [first, second] }
  assert.equal(h.api.verifyNativeAudit(input), true)
  for (const bad of [ { ...input, events: [first] }, { ...input, events: [second, first] },
    { ...input, companyId: target }, { ...input, events: [{ ...first, canonical_payload: '{}' }, second] },
    { ...input, trustedHead: 'f'.repeat(64) }, { ...input, events: [] } ]) assert.equal(h.api.verifyNativeAudit(bad), false)
})

// Negative source mutation controls catch dangerous weakening; not SQL execution.
function assertSqlSecurity(text) {
  assert.match(text, /CREATE UNIQUE INDEX company_memberships_one_active_user[^;]+WHERE status = 'active'/)
  assert.match(text, /UNIQUE \(company_id, portal_type\)/)
  for (const table of ['public.companies', 'public.company_memberships', 'public.company_portal_instances',
    'core_registry_private.settings', 'core_registry_private.operators', 'core_registry_private.provenance',
    'core_registry_private.owner_claims', 'core_registry_private.events']) {
    assert.ok(text.includes(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`), table)
  }
  assert.match(text, /GRANT SELECT ON public\.companies, public\.company_memberships, public\.company_portal_instances TO authenticated;/)
  assert.doesNotMatch(text, /GRANT\s+(?:ALL|INSERT|UPDATE|DELETE|CREATE|TRUNCATE)[^;]+TO\s+(?:PUBLIC|anon|authenticated|service_role)/i)
  assert.match(text, /GRANT EXECUTE ON FUNCTION public\.core_registry_mutate\([^;]+TO service_role;/)
  assert.match(text, /m\.core_auth_user_id = \(SELECT auth\.uid\(\)\)/)
  assert.match(text, /m\.status = 'active' AND \(p_owner_only IS FALSE OR \(p_owner_only IS TRUE AND m\.role = 'owner'\)\)/)
  assert.match(text, /p_actor = claim\.target_user_id/)
  assert.match(text, /claim\.proposer_id IN \(p_actor, claim\.target_user_id\)/)
  assert.match(text, /claim\.company_revision <> rev/)
  assert.match(text, /proof\.revision <> claim\.proof_revision/)
  assert.match(text, /p_verified_subjects IS DISTINCT FROM ARRAY\[claim\.target_user_id, claim\.proposer_id\]/)
  assert.match(text, /replay\.request_digest <> digest THEN RAISE EXCEPTION 'REPLAY_CONFLICT'/)
  assert.match(text, /'CURRENT_OWNER_REQUIRED'/)
  assert.match(text, /'LAST_OWNER'/)
  assert.match(text, /'AUTH_EXPIRED_AFTER_WAIT'/)
  assert.match(text, /'AUTH_OR_PROOF_EXPIRED_BEFORE_AUDIT'/)
  assert.match(text, /RETURN core_registry_private\.append_event\(/)
  assert.doesNotMatch(text, /EXCEPTION\s+WHEN/i)
  assert.doesNotMatch(text.replace(/--[^\n]*/g, ''), /\b(?:CREATE|ALTER)\s+ROLE|\bLOGIN\b|\bauth\.(?:users|sessions|identities)\b|\bwz_w1_|\bCOMMIT\s*;/i)
  assert.match(text.trim(), /ROLLBACK;$/)
}
test('SQL constraints, RLS, ACL, current authority, replay and atomic audit contracts', () => assertSqlSecurity(sql))
test('source guard detects disabled RLS, client writer grant, lost replay/last-Owner checks and removed audit', () => {
  for (const mutate of [
    (s) => s.replace('ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;', ''),
    (s) => `${s}\nGRANT UPDATE ON public.company_memberships TO authenticated;`,
    (s) => s.replace('replay.request_digest <> digest', 'false'),
    (s) => s.replace("'LAST_OWNER'", "'REMOVED'"),
    (s) => s.replace('RETURN core_registry_private.append_event(', 'RETURN bogus('),
  ]) assert.throws(() => assertSqlSecurity(mutate(sql)))
})
test('proof requires full W01-W15 coverage, participating writers, revision, freshness and one-time consumption', () => {
  for (const fragment of ['FOR i IN 1..15 LOOP', "item->'complete' IS DISTINCT FROM 'true'::jsonb",
    "item->'participatingWriter' IS DISTINCT FROM 'true'::jsonb", "item->>'state' IS DISTINCT FROM 'clean'",
    'p.consumed_at IS NOT NULL', 'p.valid_until <= clock_timestamp()', 'proof.request_digest IS DISTINCT FROM digest',
    "RAISE EXCEPTION 'COMPANY_OR_HISTORY_ALREADY_EXISTS'", 'SET consumed_at = clock_timestamp()']) assert.ok(sql.includes(fragment), fragment)
})
test('audit is append-only and recovery refuses populated state before any drop; reverse dependency order', () => {
  assert.match(sql, /BEFORE UPDATE OR DELETE OR TRUNCATE ON core_registry_private.events/)
  assert.match(sql, /head := encode\(sha256\(convert_to\(prior \|\| ':' \|\| encoded, 'UTF8'\)\), 'hex'\)/)
  assert.ok(recovery.indexOf('$empty_only$;') < recovery.indexOf('DROP FUNCTION'))
  for (const table of ['public.companies', 'public.company_memberships', 'public.company_portal_instances',
    'core_registry_private.operators', 'core_registry_private.provenance', 'core_registry_private.owner_claims', 'core_registry_private.events']) {
    assert.ok(recovery.includes(`EXISTS (SELECT 1 FROM ${table})`))
  }
  assert.ok(recovery.indexOf('DROP POLICY own_active_company') < recovery.indexOf('DROP TABLE public.company_memberships'))
  assert.ok(recovery.indexOf('DROP TABLE public.company_memberships') < recovery.indexOf('DROP TABLE public.companies'))
  assert.doesNotMatch(recovery.replace(/--[^\n]*/g, ''), /\bCASCADE\b|\bDROP OWNED\b|\bCOMMIT\s*;/i)
  assert.match(recovery.trim(), /ROLLBACK;$/)
})
test('old installation and recovery are byte-identical protected references', () => {
  for (const [file, expected] of [
    ['006_registry_w1_installation.DO_NOT_APPLY.sql', '0c0550332346c337ccb8b8420813767cc3df097a907411d107c499d43cff2f5f'],
    ['007_registry_w1_recovery.DO_NOT_APPLY.sql', 'b8e416dd01577b264b8d2e784daad3bc30e03c149359f7d5ee6ddb3a06ebd990'],
  ]) assert.equal(digest(readFileSync(join(root, docs, file))), expected)
})
test('new manifest hashes cover the exact native package and direct local dependencies', () => {
  const manifest = readFileSync(join(root, docs, 'NATIVE_MANIFEST.sha256'), 'utf8')
  const entries = new Map(manifest.trim().split(/\r?\n/).map((line) => [line.slice(66), line.slice(0, 64)]))
  const gitManifest = readFileSync(join(root, docs, 'NATIVE_MANIFEST.git.sha256'), 'utf8')
  const gitEntries = new Map(gitManifest.trim().split(/\r?\n/).map((line) => [line.slice(66), line.slice(0, 64)]))
  for (const path of ['lib/core-registry-native.ts', 'lib/core-registry-native.test.mjs', 'lib/core-company.ts',
    'lib/supabase/server.ts', 'lib/supabase/admin.ts', docs + '008_supabase_native_registry.PROPOSED.sql',
    docs + '009_supabase_native_recovery.PROPOSED.sql', docs + 'SUPABASE_NATIVE_DEV_PACKAGE.md']) assert.ok(entries.has(path), path)
  for (const [path, expected] of entries) {
    const source = signupHistoricalBytes(path, historicalNavigationBytes(path, readFileSync(join(root, path))))
    if (digest(source) === expected) continue
    // Git normalizes text line endings on export. Both manifests pin exact bytes;
    // this fallback accepts only the separately recorded Git representation.
    assert.equal(digest(source), gitEntries.get(path), path)
  }
})
