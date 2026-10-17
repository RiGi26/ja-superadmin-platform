// Offline source and mocked-unit checks only. Never a live Auth/SQL result.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import * as zod from 'zod'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib/core-w1.ts'), 'utf8')
const sql = readFileSync(join(root, 'docs/security/h1-g1-core-dev/005_w1_transport.DO_NOT_APPLY.sql'), 'utf8')
const origin = 'https://mcvekinhgcqygfddyifs.supabase.co'
const subject = '11111111-1111-4111-8111-111111111111'
const session = '22222222-2222-4222-8222-222222222222'
const companyId = '33333333-3333-4333-8333-333333333333'
const idempotencyKey = '44444444-4444-4444-8444-444444444444'
const assertionId = '55555555-5555-4555-8555-555555555555'
const request = { companyId, idempotencyKey, operation: 'company.owner_check' }
const actor = { subject, sessionId: session }
const plain = (value) => JSON.parse(JSON.stringify(value))
const digest = (value) => createHash('sha256').update(value).digest('hex')

function assertAuthReadGrantsOnly(text) {
  const grants = text.replace(/--[^\n]*/g, '').split(';')
    .filter((statement) => /\bgrant\b[^;]*\bon\s+auth\./is.test(statement))
  assert.equal(grants.length, 2)
  for (const statement of grants) {
    assert.match(statement, /^\s*grant\s+select\s*\([^;]+\)\s+on\s+auth\.(?:users|sessions)\s+to\s+wz_w1_session_owner\s*$/is)
  }
}

function harness(options = {}) {
  const calls = []
  const forbidden = () => { throw new Error('No SQL, provider connection, writer or network in offline tests') }
  const loaded = { exports: {} }
  const user = { id: subject, email: 'synthetic@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false }
  const claims = { sub: subject, session_id: session, iss: `${origin}/auth/v1`, aud: 'authenticated',
    iat: Math.floor(Date.now() / 1000) - 10, exp: Math.floor(Date.now() / 1000) + 600 }
  const db = { auth: {
    getUser: async () => { calls.push('getUser'); return options.userResponse ?? { error: null, data: { user: { ...user, ...options.user } } } },
    getClaims: async () => { calls.push('getClaims'); return { error: null, data: { claims: { ...claims, ...options.claims } } } },
  }, from: forbidden, rpc: forbidden }
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, Buffer, fetch: forbidden,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: options.origin ?? origin, CORE_COMPANY_RUNTIME_ENABLED: 'true' } },
    require(name) {
      if (name === 'server-only') return {}
      if (name === 'node:crypto') return crypto
      if (name === 'zod') return zod
      if (name === '@/lib/core-company') return { CORE_DEV_ORIGIN: origin, CORE_COMPANY_RUNTIME_ENABLED: false }
      if (name === '@/lib/supabase/server') return { createClient: async () => { calls.push('createClient'); return db } }
      if (name === '@/lib/superadmin') return { isSuperadminEmail: (email) => email === 'operator@example.invalid' }
      return forbidden()
    },
  })
  return { api: loaded.exports, calls }
}

test('canonical command binds actor, session, Company, operation and key; codec grants no authority', () => {
  const { api } = harness()
  const binding = api.encodeCoreW1Request(actor, request)
  const expectedScope = digest(`w1:v1:scope:${subject}:${session}:${companyId}:company.owner_check:${idempotencyKey}`)
  assert.equal(binding.requestScope, expectedScope)
  assert.equal(binding.requestDigest, digest(`w1:v1:request:${expectedScope}:${digest(`w1:v1:payload:${companyId}:company.owner_check`)}`))
  for (const [field, value] of [['subject', assertionId], ['sessionId', assertionId]]) {
    assert.notEqual(api.encodeCoreW1Request({ ...actor, [field]: value }, request).requestDigest, binding.requestDigest)
  }
  for (const [field, value] of [['companyId', assertionId], ['operation', 'company.read'], ['idempotencyKey', assertionId]]) {
    assert.notEqual(api.encodeCoreW1Request(actor, { ...request, [field]: value }).requestDigest, binding.requestDigest)
  }
  assert.equal(Object.isFrozen(binding), true)
  assert.equal('authorized' in binding, false)
})

test('caller authority, legacy fields, creation and arbitrary operations reject before Auth', async () => {
  const h = harness()
  for (const field of ['subject', 'sessionId', 'role', 'tenantId', 'trusted', 'provenance', 'token', 'expiresAt']) {
    await assert.rejects(h.api.prepareCoreW1Issue({ ...request, [field]: assertionId }))
  }
  for (const operation of ['new_company_initial_owner', 'billing', 'retry', 'sync', 'company.read; select 1']) {
    await assert.rejects(h.api.prepareCoreW1Issue({ ...request, operation }))
  }
  assert.deepEqual(h.calls, [])
})

test('issue prepares a fixed private statement from cookie Auth; no capability or SQL execution', async () => {
  const h = harness()
  const result = await h.api.prepareCoreW1Issue(request)
  assert.equal(result.authority, 'NOT_ESTABLISHED')
  assert.equal(result.executionAuthorized, false)
  assert.equal(result.connection, 'w1_issuer')
  assert.match(result.text, /^select wz_w1_private\.issue_assertion\(\$1::uuid,\$2::uuid,\$3::bigint,/)
  assert.deepEqual(plain(result.values.slice(0, 2)), [subject, session])
  assert.deepEqual(plain(result.values.slice(3, 6)), [companyId, 'company.owner_check', idempotencyKey])
  assert.equal(result.values.length, 8)
  assert.equal(Object.isFrozen(result.values), true)
  assert.deepEqual(h.calls, ['createClient', 'getUser', 'getClaims'])
})

test('consume prepares current actor and exact binding anew, never trusting an assertion ID', async () => {
  const h = harness()
  const first = await h.api.prepareCoreW1Consume({ ...request, assertionId })
  const second = await h.api.prepareCoreW1Consume({ ...request, assertionId })
  assert.equal(first.authority, 'NOT_ESTABLISHED')
  assert.equal(first.executionAuthorized, false)
  assert.equal(first.connection, 'w1_consumer')
  assert.deepEqual(plain(first.values.slice(0, 3)), [assertionId, subject, session])
  assert.equal(first.values.length, 9)
  assert.deepEqual(plain(second), plain(first))
  assert.deepEqual(h.calls, ['createClient', 'getUser', 'getClaims', 'createClient', 'getUser', 'getClaims'])
})

for (const [label, options] of [
  ['wrong origin', { origin: 'https://untrusted.invalid' }],
  ['missing user', { userResponse: { error: null, data: { user: null } } }],
  ['subject mismatch', { claims: { sub: assertionId } }],
  ['wrong issuer', { claims: { iss: 'https://untrusted.invalid/auth/v1' } }],
  ['wrong audience', { claims: { aud: 'service_role' } }],
  ['missing session', { claims: { session_id: undefined } }],
  ['expired JWT', { claims: { exp: 1 } }],
  ['future issuance', { claims: { iat: 9999999999 } }],
  ['future not-before', { claims: { nbf: 9999999999 } }],
  ['anonymous', { user: { is_anonymous: true } }],
  ['unconfirmed', { user: { email_confirmed_at: null } }],
  ['operator role', { claims: { user_role: 'superadmin' } }],
  ['operator email', { user: { email: 'operator@example.invalid' } }],
]) {
  test(`server request observation rejects ${label} (mock Auth only)`, async () => {
    const h = harness(options)
    await assert.rejects(h.api.prepareCoreW1Issue(request))
    await assert.rejects(h.api.prepareCoreW1Consume({ ...request, assertionId }))
  })
}

test('SQL proposal refuses before DDL; no public route, provider execution or business mutation', () => {
  assert.ok(sql.indexOf("raise exception using errcode = '42501'") < sql.indexOf('create role'))
  assert.match(sql, /DO_NOT_APPLY/)
  assert.match(sql, /rollback;\s*$/)
  assert.doesNotMatch(sql, /^\s*commit\s*;/im)
  assert.doesNotMatch(sql, /\b(?:insert into|update|delete from)\s+(?:public\.|auth\.)/i)
  assert.doesNotMatch(sql, /create (?:or replace )?function public\./i)
  assert.doesNotMatch(source, /\.rpc\(|\.from\(|fetch\(|\.query\(|\.execute\(/)
})

test('SQL source binds protected issuer/consumer, current session and authoritative Company before store writes', () => {
  assert.match(sql, /session_user <> 'wz_w1_issuer_login'/)
  assert.match(sql, /session_user <> 'wz_w1_consumer_login'/)
  assert.match(sql, /s\.id = p_session and s\.user_id = p_subject/)
  assert.match(sql, /s\.not_after/)
  assert.match(sql, /v_contract\.verified_until <= v_now/)
  assert.match(sql, /v_authority\.disputed/)
  assert.match(sql, /not v_authority\.participating_writers_verified/)
  assert.match(sql, /p_operation = 'company\.owner_check' and v_role <> 'owner'/)
  assert.doesNotMatch(sql, /insert into wz_w1_private\.(?:provider_contract|company_authority)\b/i)
})

test('SQL source serializes consume, revalidates after wait and records receipt/consumption together', () => {
  const body = sql.slice(sql.indexOf('as $consume$'), sql.indexOf('$consume$;'))
  const lastLock = body.indexOf('where id = p_assertion for update')
  assert.ok(lastLock > 0)
  assert.ok(body.indexOf('wz_w1_private.verify_session', lastLock) > lastLock)
  assert.ok(body.indexOf('v_assertion.consumed_at is not null') > lastLock)
  assert.match(body, /v_session_limit <= v_now or v_authority\.valid_until <= v_now/)
  for (const field of ['subject', 'session_id', 'company_id', 'operation', 'idempotency_key', 'request_scope',
    'request_digest', 'membership_id', 'authority_revision', 'provider_revision', 'expires_at', 'token_expires_at']) {
    assert.ok(body.includes(`v_assertion.${field}`), field)
  }
  assert.match(body, /insert into wz_w1_private\.receipts/)
  assert.match(body, /update wz_w1_private\.assertions set consumed_at/)
  assert.doesNotMatch(body, /exception when|commit;|rollback;/i)
  assert.match(sql, /unique \(subject, company_id, operation, idempotency_key\)/)
  // These inspect source ordering only; no SQL execution/atomicity PASS is claimed.
})

test('all four private stores FORCE RLS; execution groups get no direct table or Auth privileges', () => {
  for (const table of ['provider_contract', 'company_authority', 'assertions', 'receipts']) {
    assert.ok(sql.includes(`alter table wz_w1_private.${table} force row level security;`))
  }
  const revoked = [...sql.matchAll(/revoke all on function wz_w1_private\.([a-z_]+)\([a-z_,]+\)\s+from public, anon, authenticated, service_role, wz_w1_issuer, wz_w1_consumer;/g)]
  assert.deepEqual(revoked.map((match) => match[1]).sort(),
    ['check_binding', 'consume_assertion', 'issue_assertion', 'lock_company_authority', 'verify_session'])
  assert.match(sql, /revoke all on all tables in schema wz_w1_private from public, anon, authenticated, service_role/)
  assertAuthReadGrantsOnly(sql)
  for (const privilege of ['insert', 'update', 'delete', 'all']) {
    assert.throws(() => assertAuthReadGrantsOnly(`${sql}\ngrant ${privilege} on auth.users to wz_w1_session_owner;`))
  }
  assert.equal((sql.match(/create role .*nologin .*nobypassrls/g) ?? []).length, 6)
})

const privateFunctionContract = [
  ['verify_session', 'uuid,uuid,bigint', 'wz_w1_session_owner', 'definer'],
  ['check_binding', 'uuid,uuid,uuid,text,uuid,text,text', 'wz_w1_store_owner', 'invoker'],
  ['lock_company_authority', 'uuid,uuid,text', 'wz_w1_store_owner', 'invoker'],
  ['issue_assertion', 'uuid,uuid,bigint,uuid,text,uuid,text,text', 'wz_w1_issuer_owner', 'definer'],
  ['consume_assertion', 'uuid,uuid,uuid,bigint,uuid,text,uuid,text,text', 'wz_w1_consumer_owner', 'definer'],
]

// Source-order validation only. This is not a PostgreSQL parser/runtime test.
function assertPg17CreationContract(text) {
  const clean = text.replace(/--[^\n]*/g, '')
  const flat = clean.replace(/\s+/g, ' ')
  const roleAt = (marker) => {
    const index = clean.indexOf(marker)
    assert.ok(index >= 0, `Missing statement: ${marker}`)
    const changes = [...clean.slice(0, index).matchAll(/^set local role ([a-z_][a-z0-9_]*);$/gm)]
    return changes.at(-1)?.[1] ?? 'none'
  }
  for (const table of ['provider_contract', 'company_authority', 'assertions', 'receipts']) {
    assert.equal(roleAt(`create table wz_w1_private.${table} (`), 'wz_w1_store_owner', `table creator ${table}`)
  }
  for (const [name, args, owner, mode] of privateFunctionContract) {
    const marker = `create function wz_w1_private.${name}(`
    assert.equal(roleAt(marker), owner, `function creator ${name}`)
    const phase = clean.slice(clean.indexOf(marker), clean.indexOf('set local role none;', clean.indexOf(marker)))
    assert.match(phase, new RegExp(`security ${mode} set search_path = ''`))
    assert.ok(phase.replace(/\s+/g, ' ').includes(`revoke all on function wz_w1_private.${name}(${args}) from public, anon, authenticated, service_role, wz_w1_issuer, wz_w1_consumer;`), `owner-led EXECUTE revoke ${name}`)
    const grantee = name === 'issue_assertion' ? 'wz_w1_issuer' : name === 'consume_assertion'
      ? 'wz_w1_consumer' : 'wz_w1_issuer_owner, wz_w1_consumer_owner'
    assert.ok(phase.replace(/\s+/g, ' ').includes(`grant execute on function wz_w1_private.${name}(${args}) to ${grantee};`), `exact EXECUTE ${name}`)
  }
  for (const table of ['companies', 'company_memberships']) {
    const grant = `grant references (id) on public.${table} to wz_w1_store_owner;`
    assert.ok(flat.includes(grant), `REFERENCES(id) ${table}`)
    assert.equal(roleAt(grant), 'wz_core_registry_owner')
    assert.ok(clean.indexOf(grant) < clean.indexOf('create table wz_w1_private.company_authority ('))
  }
  assert.equal(roleAt('grant usage on schema public'), 'pg_database_owner')
  assert.equal(roleAt('grant usage on schema auth'), 'supabase_auth_admin')
  assert.equal(roleAt('revoke all on schema wz_w1_private'), 'wz_w1_store_owner')
  assert.equal(roleAt('revoke all on type wz_w1_private.provider_contract'), 'wz_w1_store_owner')
  for (const owner of ['wz_w1_session_owner', 'wz_w1_issuer_owner', 'wz_w1_consumer_owner']) {
    const grant = `grant create on schema wz_w1_private to ${owner};`
    const revoke = `revoke create on schema wz_w1_private from ${owner};`
    assert.equal(roleAt(grant), 'wz_w1_store_owner')
    assert.equal(roleAt(revoke), 'wz_w1_store_owner')
    assert.ok(clean.indexOf(grant) < clean.indexOf(revoke))
  }
  assert.doesNotMatch(clean, /alter (?:table|function)[^;]*owner to/i)
  assert.doesNotMatch(clean, /grant references on public\./i)
  assert.doesNotMatch(clean, /grant create on schema wz_w1_private to (?:postgres|public|anon|authenticated|service_role|wz_w1_issuer|wz_w1_consumer);/i)
  assert.doesNotMatch(clean, /grant (?:pg_database_owner|supabase_auth_admin|wz_core_registry_owner)\s+to/i)
  assert.match(clean, /REVIEW_REQUIRED_W1_CANONICAL_OWNER_AND_REFERENCES/)
  assert.match(clean, /REVIEW_REQUIRED_W1_MANAGED_AUTH_GRANTOR/)
  assert.match(clean, /REVIEW_REQUIRED_W1_MEMBERSHIP_GRANTORS_AND_RECOVERY/)
  assert.match(clean, /session_user <> 'postgres' or current_user <> 'postgres'/)
  assert.match(clean, /REVIEW_REQUIRED_W1_INSTALLER_IDENTITY_AND_CREATE/)
  assert.doesNotMatch(clean, /revoke wz_w1_store_owner,[^;]*from postgres/i)
}

test('PG17 source uses actual creators, owner-led REFERENCES/EXECUTE and blocked unresolved grantors', () => {
  assertPg17CreationContract(sql)
})

test('PG17 creation-contract validator rejects owner/REFERENCES/EXECUTE/cleanup regressions', () => {
  assertPg17CreationContract(sql)
  const controls = [
    ['table created as installer', 'set local role wz_w1_store_owner;\ncreate table', 'set local role none;\ncreate table', /table creator provider_contract/],
    ['function created as installer', 'set local role wz_w1_session_owner;\ncreate function', 'set local role none;\ncreate function', /function creator verify_session/],
    ['missing REFERENCES', 'grant references (id) on public.companies to wz_w1_store_owner;', '', /REFERENCES\(id\) companies/],
    ['wrong canonical grantor', 'set local role wz_core_registry_owner;\ngrant references', 'set local role none;\ngrant references', /wz_core_registry_owner/],
    ['wrong Auth grantor', 'set local role supabase_auth_admin;\ngrant usage', 'set local role none;\ngrant usage', /supabase_auth_admin/],
    ['wrong definer mode', 'returns timestamptz language plpgsql volatile security definer', 'returns timestamptz language plpgsql volatile security invoker', /security definer/],
    ['removed function revoke', 'revoke all on function wz_w1_private.consume_assertion(uuid,uuid,uuid,bigint,uuid,text,uuid,text,text)', 'revoke all on function wz_w1_private.other_function(uuid,uuid,uuid,bigint,uuid,text,uuid,text,text)', /owner-led EXECUTE revoke consume_assertion/],
    ['public function execution', 'to wz_w1_issuer;\nset local role none;', 'to public;\nset local role none;', /exact EXECUTE issue_assertion/],
    ['broad private CREATE', 'rollback;', 'grant create on schema wz_w1_private to public;\nrollback;', /grant create on schema/],
    ['unreconciled durable cleanup', 'rollback;', 'revoke wz_w1_store_owner, wz_w1_session_owner from postgres granted by postgres restrict;\nrollback;', /revoke wz_w1_store_owner/],
  ]
  for (const [label, needle, replacement, expected] of controls) {
    assert.ok(sql.includes(needle), label)
    const mutated = sql.replace(needle, replacement)
    assert.notEqual(mutated, sql, label)
    assert.throws(() => assertPg17CreationContract(mutated), expected, label)
  }
})
