// Offline facade behavior and pinned historical SQL contracts. No live Auth/SQL.
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
const origin = 'https://hxhusfkrlafxdnyasmsu.supabase.co'
const source = readFileSync(join(root, 'lib/core-company.ts'), 'utf8')
const registry = readFileSync(join(directory, '001_registry.PROPOSED.sql'), 'utf8')
const writer = readFileSync(join(directory, '002_writer.PROPOSED.sql'), 'utf8')
const catalog = readFileSync(join(directory, '003_catalog_checks.READ_ONLY.sql'), 'utf8')
const recovery = readFileSync(join(directory, '004_recovery.PROPOSED.sql'), 'utf8')
const vectors = JSON.parse(readFileSync(join(directory, 'codec-vectors.json'), 'utf8'))
const plain = value => JSON.parse(JSON.stringify(value))

function harness(options = {}) {
  const calls = []
  const load = path => {
    const mod = { exports: {} }
    let text = readFileSync(join(root, path), 'utf8')
    // Unit-only override. Shipped release fuse remains literal false.
    if (options.enabled && path === 'lib/core-company.ts') text = text.replace('CORE_COMPANY_RUNTIME_ENABLED = false', 'CORE_COMPANY_RUNTIME_ENABLED = true')
    vm.runInNewContext(ts.transpileModule(text, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    } }).outputText, { module: mod, exports: mod.exports, Buffer, process: { env: {
      NEXT_PUBLIC_SUPABASE_URL: options.origin ?? origin, CORE_COMPANY_RUNTIME_ENABLED: 'true',
    } }, require(name) {
      if (name === 'server-only') return {}
      if (name === 'zod') return zod
      if (name === 'node:crypto') return crypto
      if (name === '@/lib/e1-realm') return load('lib/e1-realm.ts')
      if (name === '@/lib/e1-workspace') return load('lib/e1-workspace.ts')
      if (name === '@/lib/supabase/server') return { createClient() { throw new Error('No direct Auth in facade') } }
      if (name === '@/lib/superadmin') return { isSuperadminEmail() { throw new Error('No direct authority in facade') } }
      if (name === '@/lib/core-registry-native') return {
        authorizeNativeCompany: async input => { calls.push(['read', plain(input)]); return options.result ?? { status: 'denied' } },
        executeNativeE1StockCommand: async input => { calls.push(['admit', plain(input)]); return options.result ?? { status: 'denied' } },
      }
      throw new Error('Unexpected dependency ' + name)
    } })
    return mod.exports
  }
  return { api: load('lib/core-company.ts'), calls, codec: load('lib/e1-workspace.ts').encodeE1WorkspaceRequest }
}

test('public entry points remain closed despite environment flags', async () => {
  const h = harness()
  for (const result of [await h.api.getCoreCompanyCandidate({ operation: 'read', companyId: company }),
    await h.api.requestCoreCompanyBootstrap({ companyName: 'Test Workspace', idempotencyKey: other })]) {
    assert.equal(result.status, 'blocked'); assert.equal(result.code, 'core_company_runtime_disabled')
    assert.equal(result.accessReady, false); assert.equal(result.writesPermitted, false)
  }
  assert.deepEqual(h.calls, [])
})
for (const field of ['actorId', 'subject', 'role', 'sessionId', 'sourceRef', 'companyId', 'approved', 'enabled',
  'twoOperatorsVerified', 'proofCaseId', 'classification', 'cleanE1', 'assertionId', 'operatorIds', 'expiresAt']) {
  test('bootstrap rejects client authority field ' + field, async () => {
    const h = harness({ enabled: true })
    assert.equal((await h.api.requestCoreCompanyBootstrap({ companyName: 'Test Workspace', idempotencyKey: other,
      [field]: subject })).code, 'invalid_request')
    assert.deepEqual(h.calls, [])
  })
}
for (const badOrigin of ['https://mcvekinhgcqygfddyifs.supabase.co', 'https://oyyfcmlquqfrdoffkgsd.supabase.co', origin + '/']) {
  test('native facade rejects foreign or old DEV realm ' + badOrigin, async () => {
    const h = harness({ enabled: true, origin: badOrigin })
    assert.equal((await h.api.requestCoreCompanyBootstrap({ companyName: 'AB', idempotencyKey: other })).code, 'core_origin_required')
    assert.equal((await h.api.getCoreCompanyCandidate({ operation: 'read', companyId: company })).code, 'core_origin_required')
    assert.deepEqual(h.calls, [])
  })
}
test('bootstrap forwards canonical name/key only to resource admission and preserves uncertain outcome', async () => {
  const h = harness({ enabled: true, result: { status: 'unconfirmed', commandId: other } })
  assert.deepEqual(plain(await h.api.requestCoreCompanyBootstrap({ companyName: '  Cafe\u0301  ', idempotencyKey: other })),
    { status: 'unconfirmed', commandId: other })
  assert.deepEqual(h.calls, [['admit', { action: 'e1.stock.admit', commandId: other,
    payload: { companyName: 'Café', product: 'stock' } }]])
})
test('Company facade requires explicit selector and delegates Owner check without mutation', async () => {
  const h = harness({ enabled: true })
  assert.equal((await h.api.getCoreCompanyCandidate({ operation: 'read' })).code, 'company_selector_required')
  assert.deepEqual(h.calls, [])
  for (const operation of ['read', 'owner_command']) await h.api.getCoreCompanyCandidate({ operation, companyId: company })
  assert.deepEqual(h.calls, [['read', { companyId: company, ownerOnly: false }], ['read', { companyId: company, ownerOnly: true }]])
})
for (const input of [null, {}, { operation: 'billing' }, { operation: 'owner_command', actorId: subject },
  { operation: 'read', companyId: 'bad' }]) {
  test('malformed access cannot reach native adapter: ' + JSON.stringify(input), async () => {
    const h = harness({ enabled: true })
    assert.equal((await h.api.getCoreCompanyCandidate(input)).code, 'invalid_request')
    assert.deepEqual(h.calls, [])
  })
}

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
test('historical First Owner SQL and DEV installation remain immutable and disabled', () => {
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
test('facade stays internal and does not wire Hub/legacy/billing/auth callers', () => {
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

test('rollback-only source contains no durable transaction command or uncontrolled permanent recovery grant', () => {
  const sql = (registry + writer + recovery).replace(/--[^\n]*/g, '')
  assert.doesNotMatch(sql, /\bcommit\b|prepare transaction|create subscription|alter system|security label/i)
  assert.match(catalog, /grantor_role\.rolsuper as grantor_is_superuser/)
  assert.match(registry, /non-superuser cannot remove that grant/)
  assert.match(writer, /not expected to pass on standard PG17/)
  assert.doesNotMatch(sql, /grant [^;]*to supabase_admin|grant supabase_admin/i)
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
})
