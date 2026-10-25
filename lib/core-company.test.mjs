// STATIC/UNIT ONLY: production source evaluated with mocked Auth/database clients.
// No provider requests, SQL engine, transaction simulation, or browser execution.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'
import * as crypto from 'node:crypto'
import ts from 'typescript'
import * as zod from 'zod'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const directory = join(root, 'docs/security/h1-g1-core-dev')
const subject = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const company = '33333333-3333-4333-8333-333333333333'
const session = '44444444-4444-4444-8444-444444444444'
const origin = 'https://mcvekinhgcqygfddyifs.supabase.co'
const source = readFileSync(join(root, 'lib/core-company.ts'), 'utf8')
const registry = readFileSync(join(directory, '001_registry.PROPOSED.sql'), 'utf8')
const writer = readFileSync(join(directory, '002_writer.PROPOSED.sql'), 'utf8')
const catalog = readFileSync(join(directory, '003_catalog_checks.READ_ONLY.sql'), 'utf8')
const recovery = readFileSync(join(directory, '004_recovery.PROPOSED.sql'), 'utf8')
const vectors = JSON.parse(readFileSync(join(directory, 'codec-vectors.json'), 'utf8'))
const plain = (value) => JSON.parse(JSON.stringify(value))
const user = () => ({ error: null, data: { user: { id: subject, email: 'synthetic@example.invalid',
  email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false } } })
const claims = () => ({ error: null, data: { claims: { sub: subject, session_id: session,
  iss: `${origin}/auth/v1`, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 } } })
const membership = (role = 'owner') => ({ id: other, company_id: company, core_auth_user_id: subject,
  role, status: 'active', company: { id: company, status: 'active' } })

function harness(options = {}) {
  const calls = []
  const forbidden = (name) => { calls.push(name); throw new Error(`Forbidden ${name}`) }
  const db = {
    auth: {
      getUser: async () => {
        calls.push('getUser')
        if (options.throwAuth) throw new Error('Sensitive error')
        return options.users?.shift() ?? options.user ?? user()
      },
      getClaims: async () => { calls.push('getClaims'); return options.claimsResults?.shift() ?? options.claims ?? claims() },
      admin: new Proxy({}, { get: () => forbidden('auth.admin') }),
      signUp: () => forbidden('signUp'), signOut: () => forbidden('signOut'),
    },
    from: (table) => {
      assert.equal(table, 'company_memberships')
      return { select: (columns) => {
        assert.equal(columns, 'id, company_id, core_auth_user_id, role, status, company:companies!inner(id, status)')
        return { eq: async (column, value) => {
          assert.equal(column, 'core_auth_user_id'); assert.equal(value, subject)
          calls.push('membership-read')
          return options.memberships ?? { error: null, data: [membership()] }
        } }
      }, insert: () => forbidden('insert'), update: () => forbidden('update'), delete: () => forbidden('delete') }
    },
    rpc: () => forbidden('rpc'),
  }
  const load = (path, suffix = '') => {
    const loadedModule = { exports: {} }
    const code = ts.transpileModule(readFileSync(join(root, path), 'utf8') + suffix, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    class HarnessDate extends Date { static now() { return options.clock?.now ?? Date.now() } }
    vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, Buffer, Date: HarnessDate,
      process: { env: { NEXT_PUBLIC_SUPABASE_URL: origin, CORE_COMPANY_RUNTIME_ENABLED: 'true',
        E1_ENABLED: 'true', E1_WRITER_APPROVED: 'true', NODE_ENV: 'development' } },
      require: (name) => {
        if (name === 'server-only') return {}
        if (name === 'zod') return zod
        if (name === 'node:crypto') return crypto
        if (name === '@/lib/superadmin') return { isSuperadminEmail: (email) => email === 'operator@example.invalid' }
        if (name === '@/lib/supabase/server') return { createClient: async () => { calls.push('createClient'); return db } }
        if (name === '@/lib/e1-workspace') return load('lib/e1-workspace.ts')
        return forbidden(`import:${name}`)
      }, fetch: () => forbidden('fetch'),
    })
    return loadedModule.exports
  }
  const api = load('lib/core-company.ts', `\nmodule.exports.testOnly = {
    observe: async () => observeActor(await createClient()), match: matchMembership, same: sameActor,
    executor: restrictedExecutor, inspect: inspectMembership, bootstrap: inspectBootstrap,
    parse: (value) => accessRequest.parse(value), screen: screenFirstOwnerClaim, contract: inspectW1Contract,
    ownerContract: inspectOwnerW1Contract,
  };`)
  return { api, calls, codec: load('lib/e1-workspace.ts').encodeE1WorkspaceRequest }
}

test('public entry points remain hard-disabled before any Auth/DB/network call', async () => {
  const h = harness()
  for (const result of [await h.api.getCoreCompanyCandidate({ operation: 'read' }),
    await h.api.requestCoreCompanyBootstrap({ companyName: 'Test Workspace', idempotencyKey: other })]) {
    assert.deepEqual(plain(result), { enabled: false, accessReady: false, writesPermitted: false,
      status: 'blocked', code: 'core_company_runtime_disabled', company: null,
      reviewRequired: plain(h.api.coreCompanyReviewRequired) })
  }
  assert.deepEqual(h.calls, [])
})

for (const field of ['actorId', 'subject', 'role', 'sessionId', 'sourceRef', 'companyId', 'approved', 'enabled', 'twoOperatorsVerified', 'proofCaseId',
  'classification', 'cleanE1', 'assertionId', 'operatorIds', 'expiresAt']) {
  test(`bootstrap rejects client authority field ${field}`, async () => {
    const h = harness()
    assert.equal((await h.api.requestCoreCompanyBootstrap({ companyName: 'Test Workspace', idempotencyKey: other,
      [field]: subject })).code, 'invalid_request')
    assert.deepEqual(h.calls, [])
  })
}
for (const input of [null, {}, { operation: 'billing' }, { operation: 'owner_command', actorId: subject },
  { operation: 'read', companyId: `{${company}}` }, { operation: 'read', companyId: company.replaceAll('-', '') }]) {
  test(`reject malformed access request ${JSON.stringify(input)}`, async () => {
    const h = harness()
    assert.equal((await h.api.getCoreCompanyCandidate(input)).code, 'invalid_request')
    assert.deepEqual(h.calls, [])
  })
}
test('private server verifier observes signed subject/session, never creates mutation authority', async () => {
  const h = harness()
  const actor = await h.api.testOnly.observe()
  assert.equal(actor.subject, subject); assert.equal(actor.sessionId, session)
  assert.equal(Object.isFrozen(actor), true)
  assert.deepEqual(h.calls, ['createClient', 'getUser', 'getClaims'])
})
for (const [label, modify] of [
  ['missing user', (u) => { u.data.user = null }], ['user error', (u) => { u.error = {} }],
  ['anonymous', (u) => { u.data.user.is_anonymous = true }],
  ['unconfirmed', (u) => { u.data.user.email_confirmed_at = null }],
  ['future confirmation', (u) => { u.data.user.email_confirmed_at = '2999-01-01T00:00:00Z' }],
  ['operator email', (u) => { u.data.user.email = 'operator@example.invalid' }],
  ['subject mismatch', (_u, c) => { c.data.claims.sub = other }],
  ['missing session', (_u, c) => { delete c.data.claims.session_id }],
  ['expired token', (_u, c) => { c.data.claims.exp = 1 }],
  ['foreign issuer', (_u, c) => { c.data.claims.iss = 'https://foreign.supabase.co/auth/v1' }],
  ['service audience', (_u, c) => { c.data.claims.aud = 'service_role' }],
  ['claim error', (_u, c) => { c.error = {} }],
  ['operator claim', (_u, c) => { c.data.claims.user_role = 'superadmin' }],
]) {
  test(`Auth boundary denies ${label}`, async () => {
    const u = user(); const c = claims(); modify(u, c)
    assert.equal(await harness({ user: u, claims: c }).api.testOnly.observe(), null)
  })
}
for (const role of ['owner', 'admin', 'member']) {
  test(`${role} can match own active Company for read; only Owner matches Owner command`, async () => {
    const h = harness(); const actor = await h.api.testOnly.observe()
    assert.ok(h.api.testOnly.match(actor, { operation: 'read' }, [membership(role)]))
    assert.equal(Boolean(h.api.testOnly.match(actor, { operation: 'owner_command' }, [membership(role)])), role === 'owner')
  })
}
for (const [label, rows] of [
  ['missing', []], ['ambiguous', [membership(), membership()]], ['invalid', null],
  ['revoked', [{ ...membership(), status: 'revoked' }]],
  ['foreign actor', [{ ...membership(), core_auth_user_id: other }]],
  ['Company join mismatch', [{ ...membership(), company_id: other }]],
  ['inactive Company', [{ ...membership(), company: { id: company, status: 'inactive' } }]],
  ['retired Company', [{ ...membership(), company: { id: company, status: 'retired' } }]],
  ['unsupported role', [{ ...membership(), role: 'superadmin' }]],
  ['ambiguous join', [{ ...membership(), company: [membership().company] }]],
]) {
  test(`Company policy denies ${label}`, async () => {
    const h = harness(); const actor = await h.api.testOnly.observe()
    assert.equal(h.api.testOnly.match(actor, { operation: 'read' }, rows), null)
  })
}
test('Company selector, forged actor object and borrowed actor cannot authorize access', async () => {
  const h = harness(); const actor = await h.api.testOnly.observe()
  assert.equal(h.api.testOnly.match(actor, { operation: 'read', companyId: other }, [membership()]), null)
  assert.equal(h.api.testOnly.match(plain(actor), { operation: 'read' }, [membership()]), null)
  assert.equal(harness().api.testOnly.match(actor, { operation: 'read' }, [membership()]), null)
})
test('unchanged valid membership stays blocked pending managed session proof', async () => {
  const h = harness()
  assert.equal((await h.api.testOnly.inspect({ operation: 'read' })).code, 'REVIEW_REQUIRED_MANAGED_SESSION_REVOCATION')
  assert.equal(h.calls.filter((x) => x === 'getUser').length, 2)
})
test('membership read failure holds without fallback to JWT Company/role', async () => {
  const h = harness({ memberships: { error: {}, data: null } })
  assert.equal((await h.api.testOnly.inspect({ operation: 'read' })).status, 'hold')
})
test('session replacement after read denies even for same user', async () => {
  const changed = claims(); changed.data.claims.session_id = other
  const h = harness({ claimsResults: [claims(), changed] })
  assert.equal((await h.api.testOnly.inspect({ operation: 'read' })).code, 'actor_or_session_changed')
})
test('sign-out/missing Auth response after read denies', async () => {
  const h = harness({ users: [user(), { error: null, data: { user: null } }] })
  assert.equal((await h.api.testOnly.inspect({ operation: 'read' })).code, 'actor_or_session_changed')
})
test('matching actor, codec and correlation never permit restricted executor or E1', async () => {
  const h = harness()
  const result = await h.api.testOnly.bootstrap({ companyName: 'Test Workspace', idempotencyKey: other })
  assert.equal(result.code, 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT'); assert.equal(result.writesPermitted, false)
  assert.deepEqual(h.calls, ['createClient', 'getUser', 'getClaims', 'getUser', 'getClaims'])
})
test('forged actor/command or reused same observation rejects writer', async () => {
  const h = harness(); const a = await h.api.testOnly.observe(); const b = await h.api.testOnly.observe()
  const command = { subject, sessionId: session, sourceRef: null, action: 'new_company_initial_owner',
    classification: 'UNKNOWN', requestScope: 'fake', payloadFingerprint: 'fake' }
  for (const [initial, after, cmd] of [[plain(a), b, command], [a, a, command], [a, b, { ...command, subject: other }],
    [a, b, { ...command, sessionId: other }]]) {
    assert.equal(h.api.testOnly.executor(initial, after, cmd).status, 'rejected')
  }
})

const zeroHistory = () => Object.fromEntries(['onboarding', 'provisioning', 'company', 'legacy', 'portal', 'financial', 'dispute'].map((key) => [key, 0]))
for (const input of [null, {}, { case: 'unknown', observedHistory: null },
  { case: 'new', observedHistory: zeroHistory() }, { case: 'new', observedHistory: { ...zeroHistory(), dispute: null } },
  { case: 'new', observedHistory: zeroHistory(), cleanE1: true },
  { case: 'new', observedHistory: zeroHistory(), approved: true },
  { case: 'new', observedHistory: zeroHistory(), operators: [subject, other] },
  { case: 'new', observedHistory: { ...zeroHistory(), financial: -1 } }]) {
  test(`untrusted/zero/ambiguous eligibility cannot classify E1: ${JSON.stringify(input)}`, () => {
    const result = harness().api.testOnly.screen(input)
    assert.equal(result.classification, 'UNKNOWN'); assert.equal(result.canBootstrap, false)
  })
}
for (const sourceName of Object.keys(zeroHistory())) {
  test(`${sourceName} history claim forces E2/E3 hold, never a bootstrap exemption`, () => {
    const result = harness().api.testOnly.screen({ case: 'new', observedHistory: { ...zeroHistory(), [sourceName]: 1 } })
    assert.equal(result.classification, 'E2_E3'); assert.equal(result.manualOperatorMinimum, 2)
    assert.equal(result.canBootstrap, false)
  })
}
for (const path of ['legacy', 'disputed']) {
  test(`${path} cannot bypass two-operator S1 policy with zero history`, () => {
    const result = harness().api.testOnly.screen({ case: path, observedHistory: zeroHistory() })
    assert.equal(result.manualOperatorMinimum, 2); assert.equal(result.canBootstrap, false)
  })
}
test('changed source/action/classification is rejected; a UUID cannot stand in for creation authority', async () => {
  const h = harness(); const a = await h.api.testOnly.observe(); const b = await h.api.testOnly.observe()
  const command = { subject, sessionId: session, sourceRef: null, action: 'new_company_initial_owner',
    classification: 'UNKNOWN', requestScope: 'fake', payloadFingerprint: 'fake' }
  for (const change of [{ sourceRef: company }, { action: 'claim_legacy_owner' }, { classification: 'E1' }]) {
    assert.equal(h.api.testOnly.executor(a, b, { ...command, ...change }).code, 'untrusted_creation_authority')
  }
  assert.doesNotMatch(source, /randomUUID/)
})
test('expiry after observation cannot match membership or reach executor', async () => {
  const clock = { now: Date.now() }; const h = harness({ clock })
  const a = await h.api.testOnly.observe(); const b = await h.api.testOnly.observe()
  clock.now = b.expiresAt
  assert.equal(h.api.testOnly.match(a, { operation: 'read' }, [membership()]), null)
  assert.equal(h.api.testOnly.executor(a, b, { subject, sessionId: session, sourceRef: null,
    action: 'new_company_initial_owner', classification: 'UNKNOWN', requestScope: 'fake', payloadFingerprint: 'fake' }).code, 'actor_or_session_changed')
})

test('proposal scopes four non-login/non-bypass roles and clears inherited default grants', () => {
  for (const role of ['registry_owner', 'writer_owner', 'audit_owner', 'executor']) {
    assert.match(registry, new RegExp(`create role wz_core_${role} nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;`))
  }
  assert.match(registry, /from public, anon, authenticated, service_role, wz_core_executor;/)
  assert.match(writer, /revoke wz_core_registry_owner, wz_core_writer_owner, wz_core_audit_owner, wz_core_executor\s+from postgres granted by postgres restrict;/)
  assert.doesNotMatch(registry + writer, /grant\s+(all|update|delete|truncate)\s/i)
})
test('canonical cardinality and unmapped portal reservation are explicit database constraints', () => {
  assert.match(registry, /company_memberships\(core_auth_user_id\) where status = 'active'/)
  assert.match(registry, /unique \(company_id, portal_type\)/)
  assert.match(registry, /legacy_core_tenant_id is null and portal_tenant_id is null/)
  assert.match(registry, /references auth\.users\(id\) on update restrict on delete restrict/)
  assert.doesNotMatch(registry, /references public\.tenants|insert into|if not exists/i)
})
test('all registry/audit tables FORCE RLS, clients have no read/write policies', () => {
  for (const table of ['public.companies', 'public.company_memberships', 'public.company_portal_instances']) {
    assert.ok(registry.includes(`alter table ${table} force row level security;`))
  }
  for (const table of ['creation_events', 'creation_receipts']) assert.ok(writer.includes(`alter table wz_core_private.${table} force row level security;`))
  assert.doesNotMatch(writer, /create policy[^;]*to (public|anon|authenticated|service_role)/i)
  assert.match(writer, /grant execute on function wz_core_private\.bootstrap_company\(text, uuid\) to wz_core_executor;/)
})
test('private writer rejects spoofed transport and preserves codec/provenance fuses', () => {
  for (const message of ['REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT', 'REVIEW_REQUIRED_CLEAN_E1_PROVENANCE', 'REVIEW_REQUIRED_CODEC_INTEGRATION', 'REVIEW_REQUIRED_FIRST_OWNER_AUTHORITY']) {
    assert.match(writer, new RegExp(`raise exception using errcode = '42501', message = '${message}'`))
  }
  assert.doesNotMatch(writer, /auth\.jwt\(|auth\.uid\(|set_config\(|request\.jwt|p_actor|p_company_id|p_role/i)
  assert.match(writer, /security definer set search_path = '' set row_security = on/)
  assert.match(writer, /where r.rolname = current_user\)/)
})
for (const [index, vector] of vectors.vectors.valid.entries()) {
  test(`exact packaged E1 implementation matches frozen Node codec vector ${index + 1}`, () => {
    const result = harness().codec(vector.subject, { companyName: vector.input, idempotencyKey: vector.key })
    assert.equal(result.companyName, vector.name)
    assert.equal(Buffer.from(result.companyName, 'utf8').toString('hex'), vector.nameHex)
    assert.equal(result.requestScope, vector.scope)
    assert.equal(result.payloadFingerprint, vector.fingerprint)
  })
}
test('codec dependency hash and SQL framing are reconciled without claiming SQL execution', () => {
  assert.equal(crypto.createHash('sha256').update(readFileSync(join(root, 'lib/e1-workspace.ts'))).digest('hex'), vectors.implementation_sha256)
  assert.match(writer, /'e1:v2:scope:' \|\| v_actor::text \|\| ':' \|\| p_key::text/)
  assert.match(writer, /'e1:v2:payload:' \|\| v_actor::text \|\| ':'/)
  assert.match(writer, /normalize\(pg_catalog\.btrim\(p_name,/)
  assert.match(writer, /pg_catalog\.encode\(pg_catalog\.convert_to\(v_name, 'UTF8'\), 'hex'\)/)
  assert.equal(vectors.sql_runtime, 'NOT_EXECUTED')
})
test('First Owner classification and durable DEV installation remain separately disabled', () => {
  assert.match(source, /'REVIEW_REQUIRED_FIRST_OWNER_AUTHORITY'/)
  const body = writer.split('as $writer$')[1].split('$writer$;')[0]
  assert.ok(body.indexOf('assert_first_owner_authority(v_actor, v_source)') < body.indexOf('insert into public.companies'))
  assert.match(registry, /session_user <> 'postgres'/)
  assert.match(registry, /not between 170000 and 179999/)
  assert.ok(writer.lastIndexOf("message = 'REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY'") < writer.lastIndexOf('rollback;'))
  assert.ok(writer.lastIndexOf("message = 'REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY'") > writer.indexOf('revoke wz_core_registry_owner'))
})
test('atomicity/idempotency/concurrency are SQL source contracts, not simulated runtime PASS', () => {
  assert.match(writer, /pg_advisory_xact_lock\(77102/)
  assert.match(writer, /v_after_session is distinct from v_session/)
  assert.match(writer, /idempotency_payload_conflict/)
  assert.match(writer, /replay_no_longer_authorized/)
  assert.match(writer, /core_receipt_event_fk/); assert.match(writer, /core_event_receipt_fk/)
  assert.match(writer, /deferrable initially deferred/)
  const body = writer.split('as $writer$')[1].split('$writer$;')[0]
  assert.doesNotMatch(body, /\bcommit\s*;|exception\s+when|on conflict/i)
  const lock = body.indexOf('pg_advisory_xact_lock')
  assert.ok(body.indexOf('v_after_actor', lock) < body.indexOf('insert into public.companies'))
  for (const target of ['public.companies', 'public.company_memberships', 'wz_core_private.creation_events', 'wz_core_private.creation_receipts']) {
    assert.ok(body.includes(`insert into ${target}`))
  }
})
test('installation uses one transaction and performs owner-only ACL/policy work under exact owners', () => {
  const uncomment = (s) => s.replace(/--[^\n]*/g, '')
  assert.equal((uncomment(registry + writer).match(/\bbegin;/g) ?? []).length, 1)
  assert.equal((uncomment(registry + writer).match(/\bcommit;/g) ?? []).length, 0)
  assert.equal((uncomment(registry + writer).match(/\brollback;/g) ?? []).length, 1)
  assert.doesNotMatch(uncomment(registry), /\bcommit;/)
  assert.match(registry, /with admin false, inherit false, set true granted by postgres/)
  assert.ok(registry.indexOf("set local createrole_self_grant = '';") < registry.indexOf('create role'))
  assert.ok(registry.indexOf('set local role wz_core_registry_owner;') < registry.indexOf('alter table public.companies enable'))
  assert.ok(writer.indexOf('set local role wz_core_audit_owner;') < writer.indexOf('create table wz_core_private.creation_events'))
  assert.ok(writer.indexOf('set local role wz_core_writer_owner;') < writer.indexOf('create function wz_core_private.bootstrap_company'))
})
test('new seam is unwired and never changes Hub/legacy/billing/auth configuration', () => {
  assert.doesNotMatch(source, /createAdminClient|SUPABASE_SERVICE_ROLE|\.rpc\(|\.insert\(|\.update\(|\.delete\(/)
  for (const path of ['lib/hub-data.ts', 'lib/customer-onboarding.ts', 'lib/auth.ts', 'proxy.ts', 'app/hub/page.tsx']) {
    assert.doesNotMatch(readFileSync(join(root, path), 'utf8'), /core-company/)
  }
})

for (const [index, value] of [...vectors.vectors.invalidNames, 'A\ud800B', 'A\udfffB'].entries()) {
  test(`frozen/relevant negative Node name vector ${index + 1} rejects`, () => {
    assert.throws(() => harness().codec(subject, { companyName: value, idempotencyKey: other }))
  })
}
for (const [index, value] of vectors.vectors.invalidKeys.entries()) {
  test(`strict Node UUID rejects key AND subject vector ${index + 1}`, () => {
    assert.throws(() => harness().codec(subject, { companyName: 'AB', idempotencyKey: value }))
    assert.throws(() => harness().codec(value, { companyName: 'AB', idempotencyKey: other }))
  })
}
test('installer refuses unconditionally before DDL and again before terminal ROLLBACK', () => {
  const early = registry.split('do $installer_authority$')[1].split('$installer_authority$;')[0]
  assert.match(early, /raise exception[^;]*REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY/)
  assert.doesNotMatch(early, /\bif\b|current_setting|set_config/i)
  assert.ok(registry.indexOf('$installer_authority$;') < registry.indexOf('create role'))
  const continuation = writer.split('do $writer_installation_authority$')[1].split('$writer_installation_authority$;')[0]
  assert.match(continuation, /raise exception[^;]*REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY/)
  assert.doesNotMatch(continuation, /\bif\b|current_setting|set_config/i)
  assert.ok(writer.indexOf('$writer_installation_authority$;') < writer.indexOf('set local role'))
  const final = writer.split('do $installation_gate$')[1].split('$installation_gate$;')[0]
  assert.match(final, /REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY';\s*end;/)
  assert.match(final, /has_any_column_privilege/); assert.match(final, /has_function_privilege/)
  assert.match(final, /has_schema_privilege/)
})
test('PG17 metadata contract covers default/column/sequence ACLs, grantor, role escape and dependencies', () => {
  for (const name of ['pg_default_acl', 'attacl', 'has_column_privilege', 'has_sequence_privilege', 'has_schema_privilege',
    'pg_has_role', 'admin_option', 'inherit_option', 'set_option', 'a.grantor', 'pg_depend', 'pg_shdepend', 'createrole_self_grant']) {
    assert.ok(catalog.includes(name), name)
  }
  assert.match(catalog, /pg_has_role\(r\.oid, target\.oid, 'SET'\)/)
  const sql = catalog.replace(/--[^\n]*/g, '')
  assert.doesNotMatch(sql, /\b(insert|update|delete|alter|drop|grant|revoke|set|create)\s+(table|role|schema|into|on|from)\b/i)
  assert.doesNotMatch(sql, /from\s+(auth\.(users|sessions)|public\.(tenants|subscription_invoices))/i)
})
test('writer closure catches both directions and never changes provider default ACLs', () => {
  assert.match(writer, /r\.oid in \(a\.roleid, a\.member\) where r\.rolname = current_user/)
  assert.doesNotMatch(registry + writer, /alter default privileges|on all (tables|sequences|functions) in schema public/i)
  assert.match(writer, /has_table_privilege[^;]*MAINTAIN/)
  assert.match(writer, /has_any_column_privilege[^;]*REFERENCES/)
})
test('recovery remains guarded and removes explicit dependencies in safe proposed order', () => {
  const early = recovery.split('do $recovery_authority$')[1].split('$recovery_authority$;')[0]
  assert.match(early, /raise exception[^;]*REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY/)
  assert.doesNotMatch(early, /\bif\b|current_setting|set_config/i)
  assert.ok(recovery.indexOf('$recovery_authority$;') < recovery.indexOf('drop function'))
  const order = ['drop function wz_core_private.bootstrap_company', 'drop policy core_writer_company_read',
    'drop constraint core_event_receipt_fk', 'drop constraint core_receipt_event_fk', 'drop table wz_core_private.creation_receipts',
    'drop table wz_core_private.creation_events', 'drop table public.company_portal_instances',
    'drop table public.company_memberships', 'drop table public.companies', 'drop function wz_core_private.assert_current_identity',
    'drop schema wz_core_private', 'revoke usage on schema public', 'drop role wz_core_executor', 'drop role wz_core_registry_owner']
  let previous = -1
  for (const statement of order) { const index = recovery.indexOf(statement); assert.ok(index > previous, statement); previous = index }
  const sql = recovery.replace(/--[^\n]*/g, '')
  assert.doesNotMatch(sql, /\bcascade\b|drop owned|reassign owned|drop\s+(table|schema)\s+auth\./i)
  assert.match(sql, /m\.admin_option/)
  assert.match(sql, /pg_has_role\(session_user, r\.oid, 'SET'\)/)
  assert.match(sql, /not pg_catalog\.pg_has_role\(session_user, r\.oid, 'USAGE'\)/)
  assert.ok(recovery.lastIndexOf('REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY') < recovery.lastIndexOf('rollback;'))
  assert.equal((sql.match(/\bbegin;/g) ?? []).length, 1)
  assert.equal((sql.match(/\bcommit;/g) ?? []).length, 0)
  assert.equal((sql.match(/\brollback;/g) ?? []).length, 1)
})

async function mockW1() {
  const clock = { now: Date.now() }; const h = harness({ clock })
  const before = await h.api.testOnly.observe(); const after = await h.api.testOnly.observe()
  const canonical = h.codec(subject, { companyName: 'Mock Workspace', idempotencyKey: other })
  const sources = () => Object.fromEntries(Object.keys(zeroHistory()).map((name) => [name,
    { state: 'clean', complete: true, revision: 'mock-revision-1', fence: 'mock-fence-1' }]))
  const envelope = { issuer: `${origin}/auth/v1`, project: 'mcvekinhgcqygfddyifs', audience: 'wz_core_executor',
    subject, sessionId: session, assertionId: company, action: 'new_company_initial_owner', sourceRef: other,
    nonce: other, idempotencyKey: other, companyId: null, managedSessionState: 'active',
    intentRevision: 'mock-intent-1', classification: 'E1', codec: 'e1:v2',
    requestScope: canonical.requestScope, payloadFingerprint: canonical.payloadFingerprint,
    issuedAt: clock.now - 1000, expiresAt: clock.now + 20000,
    sourcesBeforeWait: sources(), sourcesAfterWait: sources() }
  return { h, before, after, canonical, envelope, clock,
    inspect: () => h.api.testOnly.contract(envelope, before, after, canonical) }
}
test('complete mock W1 binding conforms but cannot mint trusted execution authority', async () => {
  const m = await mockW1(); const result = m.inspect()
  assert.equal(result.code, 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT')
  assert.equal(result.writesPermitted, false); assert.equal(result.company, null)
  assert.deepEqual(m.h.calls, ['createClient', 'getUser', 'getClaims', 'createClient', 'getUser', 'getClaims'])
})
for (const [field, value] of [['issuer', 'https://foreign.invalid/auth/v1'], ['project', 'foreign'],
  ['audience', 'service_role'], ['subject', other], ['sessionId', other], ['action', 'claim_existing_owner'],
  ['sourceRef', 'untrusted'], ['intentRevision', ''], ['codec', 'e1:v1'], ['requestScope', '0'.repeat(64)],
  ['payloadFingerprint', '1'.repeat(64)], ['approved', true], ['operators', [subject, other]]]) {
  test(`W1 forged/mismatched ${field} cannot reach executor`, async () => {
    const m = await mockW1(); m.envelope[field] = value
    const result = m.inspect()
    assert.equal(result.status, 'rejected'); assert.equal(result.writesPermitted, false)
  })
}
for (const [field, value] of [['managedSessionState', 'revoked'], ['managedSessionState', 'unknown'],
  ['nonce', 'invalid'], ['idempotencyKey', company], ['companyId', company]]) {
  test(`W1 ${field}=${value} cannot authorize`, async () => {
    const m = await mockW1(); m.envelope[field] = value
    assert.equal(m.inspect().status, 'rejected'); assert.equal(m.inspect().writesPermitted, false)
  })
}
for (const classification of ['UNKNOWN', 'E2_E3']) {
  test(`W1 ${classification} cannot use automatic E1 path despite complete mock coverage`, async () => {
    const m = await mockW1(); m.envelope.classification = classification
    assert.equal(m.inspect().status, 'hold'); assert.equal(m.inspect().writesPermitted, false)
  })
}
for (const key of Object.keys(zeroHistory())) {
  for (const mutation of ['missing', 'incomplete', 'unavailable', 'history', 'conflict', 'revision', 'fence']) {
    test(`W1 ${key} ${mutation} coverage fails closed after wait`, async () => {
      const m = await mockW1(); const observation = m.envelope.sourcesAfterWait[key]
      if (mutation === 'missing') delete m.envelope.sourcesAfterWait[key]
      else if (mutation === 'incomplete') observation.complete = false
      else if (mutation === 'revision' || mutation === 'fence') observation[mutation] = 'mock-changed'
      else observation.state = mutation
      const result = m.inspect()
      assert.equal(result.writesPermitted, false)
      assert.notEqual(result.code, 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT')
    })
  }
}
for (const mode of ['future', 'expired', 'past-session', 'expires-during-wait']) {
  test(`W1 ${mode} time binding is denied`, async () => {
    const m = await mockW1()
    if (mode === 'future') m.envelope.issuedAt = m.clock.now + 1
    if (mode === 'expired') m.envelope.expiresAt = m.clock.now
    if (mode === 'past-session') m.envelope.expiresAt = m.after.expiresAt + 1
    if (mode === 'expires-during-wait') m.clock.now = m.envelope.expiresAt
    assert.equal(m.inspect().code, 'stale_w1_contract')
  })
}
test('W1 complete mock still rejects cloned actor, including after concurrency wait', async () => {
  const m = await mockW1()
  assert.equal(m.h.api.testOnly.contract(m.envelope, m.before, plain(m.after), m.canonical).code, 'actor_or_session_changed')
})
test('rollback-only source contains no durable transaction command or uncontrolled permanent recovery grant', () => {
  const sql = (registry + writer + recovery).replace(/--[^\n]*/g, '')
  assert.doesNotMatch(sql, /\bcommit\b|prepare transaction|create subscription|alter system|security label/i)
  assert.match(catalog, /grantor_role\.rolsuper as grantor_is_superuser/)
  assert.match(registry, /non-superuser cannot remove that grant/)
  assert.match(writer, /not expected to pass on standard PG17/)
  assert.doesNotMatch(sql, /grant [^;]*to supabase_admin|grant supabase_admin/i)
})

async function mockOwnerW1() {
  const clock = { now: Date.now() }; const h = harness({ clock })
  const before = await h.api.testOnly.observe()
  clock.now += 10
  const after = await h.api.testOnly.observe()
  // Correlation fixtures only; no real issuer, session lookup or command codec.
  const binding = { idempotencyKey: other, requestScope: 'a'.repeat(64), payloadFingerprint: 'b'.repeat(64) }
  const observation = (actor) => ({ subject, sessionId: session, checkedAt: actor.checkedAt,
    sessionState: 'active', accountState: 'eligible', sessionValidUntil: clock.now + 60000,
    membershipId: other, membershipRevision: 'mock-membership-1', provenance: 'verified',
    provenanceRevision: 'mock-provenance-1', fence: 'mock-fence-1' })
  const envelope = { issuer: `${origin}/auth/v1`, project: 'mcvekinhgcqygfddyifs', audience: 'wz_core_executor',
    subject, sessionId: session, assertionId: company, nonce: other, state: 'unused',
    action: 'owner_command', companyId: company, ...binding,
    issuedAt: before.checkedAt, expiresAt: clock.now + 20000,
    beforeWait: observation(before), afterWait: observation(after) }
  const m = { h, before, after, binding, envelope, clock,
    request: { operation: 'owner_command', companyId: company },
    rowsBefore: [membership()], rowsAfter: [membership()] }
  return Object.assign(m, { inspect: () => h.api.testOnly.ownerContract(m.envelope,
    m.before, m.after, m.request, m.rowsBefore, m.rowsAfter, m.binding) })
}
test('complete Owner mock and repeated assertion never authorize or execute', async () => {
  const m = await mockOwnerW1()
  for (let replay = 0; replay < 2; replay++) {
    const result = m.inspect()
    assert.equal(result.code, 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT')
    assert.equal(result.writesPermitted, false); assert.equal(result.company, null)
  }
  assert.deepEqual(m.h.calls, ['createClient', 'getUser', 'getClaims', 'createClient', 'getUser', 'getClaims'])
})
for (const [field, value] of [['issuer', 'https://foreign.invalid/auth/v1'], ['project', 'foreign'],
  ['audience', 'service_role'], ['subject', other], ['sessionId', other], ['assertionId', 'invalid'],
  ['nonce', 'invalid'], ['state', 'consumed'], ['state', 'revoked'], ['action', 'new_company_initial_owner'],
  ['companyId', other], ['idempotencyKey', company], ['requestScope', 'c'.repeat(64)],
  ['payloadFingerprint', 'd'.repeat(64)], ['role', 'owner'], ['approved', true], ['operators', [subject, other]]]) {
  test(`Owner contract denies forged/replayed ${field}=${JSON.stringify(value)}`, async () => {
    const m = await mockOwnerW1(); m.envelope[field] = value
    const result = m.inspect()
    assert.equal(result.writesPermitted, false)
    assert.notEqual(result.code, 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT')
  })
}
for (const phase of ['beforeWait', 'afterWait']) {
  for (const [field, value] of [['subject', other], ['sessionId', other], ['membershipId', company],
    ['sessionState', 'revoked'], ['sessionState', 'unknown'], ['accountState', 'disabled'],
    ['accountState', 'unknown'], ['provenance', 'unknown'], ['provenance', 'disputed'],
    ['membershipRevision', 'changed'], ['provenanceRevision', 'changed'], ['fence', 'changed'],
    ['checkedAt', 1], ['sessionValidUntil', 1], ['clientApproved', true]]) {
    test(`Owner ${phase} denies ${field}=${JSON.stringify(value)}`, async () => {
      const m = await mockOwnerW1(); m.envelope[phase][field] = value
      const result = m.inspect()
      assert.equal(result.writesPermitted, false)
      assert.notEqual(result.code, 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT')
      if (field === 'provenance') assert.equal(result.status, 'hold')
    })
  }
  test(`Owner ${phase} missing observation denies`, async () => {
    const m = await mockOwnerW1(); delete m.envelope[phase]
    assert.equal(m.inspect().code, 'invalid_owner_w1_contract')
  })
}
for (const phase of ['rowsBefore', 'rowsAfter']) {
  for (const [label, rows] of [['missing', []], ['ambiguous', [membership(), membership()]],
    ['Admin', [membership('admin')]], ['Member', [membership('member')]],
    ['revoked', [{ ...membership(), status: 'revoked' }]],
    ['wrong subject', [{ ...membership(), core_auth_user_id: other }]],
    ['wrong Company', [{ ...membership(), company_id: other, company: { id: other, status: 'active' } }]],
    ['inactive Company', [{ ...membership(), company: { id: company, status: 'inactive' } }]],
    ['replaced membership', [{ ...membership(), id: company }]]]) {
    test(`Owner ${phase} ${label} denies despite valid-looking assertion`, async () => {
      const m = await mockOwnerW1(); m[phase] = rows
      assert.equal(m.inspect().code, 'owner_membership_not_current')
    })
  }
}
for (const mode of ['future', 'expired', 'outlives-token', 'expires-during-wait', 'wrong-selector',
  'read-operation', 'no-binding', 'cloned-before', 'cloned-after', 'same-observation']) {
  test(`Owner ${mode} cannot authorize`, async () => {
    const m = await mockOwnerW1()
    if (mode === 'future') m.envelope.issuedAt = m.before.checkedAt + 1
    if (mode === 'expired') m.envelope.expiresAt = m.after.checkedAt
    if (mode === 'outlives-token') m.envelope.expiresAt = m.after.expiresAt + 1
    if (mode === 'expires-during-wait') m.clock.now = m.envelope.expiresAt
    if (mode === 'wrong-selector') m.request.companyId = other
    if (mode === 'read-operation') m.request.operation = 'read'
    if (mode === 'no-binding') m.binding = null
    if (mode === 'cloned-before') m.before = plain(m.before)
    if (mode === 'cloned-after') m.after = plain(m.after)
    if (mode === 'same-observation') m.after = m.before
    assert.equal(m.inspect().writesPermitted, false)
    assert.notEqual(m.inspect().code, 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT')
  })
}
test('unwired Owner path cannot supply its own assertion or infer current revocation', async () => {
  const h = harness()
  assert.equal((await h.api.testOnly.inspect({ operation: 'owner_command', companyId: company })).code,
    'REVIEW_REQUIRED_MANAGED_SESSION_REVOCATION')
  assert.deepEqual(h.calls, ['createClient', 'getUser', 'getClaims', 'membership-read', 'getUser', 'getClaims'])
})
test('recovery refusal artifacts retain exact accepted hashes; mock authority cannot open SQL', () => {
  const expected = [
    ['001_registry.PROPOSED.sql', 'b242b4eb188ddadd0ffc7e3d99849bec119ed336a20cf6283a817c53ac384c11'],
    ['002_writer.PROPOSED.sql', 'b4e2cbc6d72b817a2806793f86fd571f5e95ff83a966adf4ae2a750ccdb5e859'],
    ['003_catalog_checks.READ_ONLY.sql', 'b2b144f92e65b7c6164c9ca38772b5f3718b6f09244ea79bc960c360455d5044'],
    ['004_recovery.PROPOSED.sql', '3b8a8b3fe1f6c07d101da10700d856f449af4281b5ef57d9c3d95ba7cf4c6f8a'],
  ]
  for (const [path, digest] of expected) {
    assert.equal(crypto.createHash('sha256').update(readFileSync(join(directory, path))).digest('hex'), digest)
  }
  assert.match(source, /CORE_COMPANY_RUNTIME_ENABLED = false as const/)
  const ownerSource = source.split('function inspectOwnerW1Contract')[1].split('function restrictedExecutor')[0]
  assert.doesNotMatch(ownerSource, /\.rpc\(|\.insert\(|\.update\(|\.delete\(|fetch\(|return true/)
  assert.match(ownerSource, /return denied\('blocked', 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT'\)/)
})
