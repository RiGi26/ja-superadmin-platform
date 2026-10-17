// Offline source-contract checks. No SQL parser, network, Auth or database execution.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = 'docs/security/h1-g1-core-dev/'
const read = path => readFileSync(join(root, path), 'utf8')
const base = read(`${dir}001_registry.PROPOSED.sql`)
const w1 = read(`${dir}005_w1_transport.DO_NOT_APPLY.sql`)
const install = read(`${dir}006_registry_w1_installation.DO_NOT_APPLY.sql`)
const recovery = read(`${dir}007_registry_w1_recovery.DO_NOT_APPLY.sql`)
const clean = text => text.replace(/--[^\n]*/g, '')
const flat = text => clean(text).replace(/\s+/g, ' ').trim()
const canonicalTables = ['companies', 'company_memberships', 'company_portal_instances']
const privateTables = ['provider_contract', 'company_authority', 'assertions', 'receipts']
const roles = ['wz_core_registry_owner', 'wz_w1_store_owner', 'wz_w1_session_owner',
  'wz_w1_issuer_owner', 'wz_w1_consumer_owner', 'wz_w1_issuer', 'wz_w1_consumer']
const functions = [
  ['verify_session', 'uuid,uuid,bigint', 'wz_w1_session_owner'],
  ['check_binding', 'uuid,uuid,uuid,text,uuid,text,text', 'wz_w1_store_owner'],
  ['lock_company_authority', 'uuid,uuid,text', 'wz_w1_store_owner'],
  ['issue_assertion', 'uuid,uuid,bigint,uuid,text,uuid,text,text', 'wz_w1_issuer_owner'],
  ['consume_assertion', 'uuid,uuid,uuid,bigint,uuid,text,uuid,text,text', 'wz_w1_consumer_owner'],
]

function roleAt(text, marker) {
  const sql = clean(text), at = sql.indexOf(marker)
  assert.ok(at >= 0, `Missing ${marker}`)
  return [...sql.slice(0, at).matchAll(/^set local role ([a-z_][a-z0-9_]*);$/gm)].at(-1)?.[1] ?? 'none'
}

function validateInstallation(text) {
  const sql = clean(text), normalized = flat(text)
  assert.match(sql, /^\s*begin;/)
  assert.match(sql, /rollback;\s*$/)
  assert.doesNotMatch(sql, /\bcommit\s*;|\bcreate\s+(?:or replace\s+)?function\s+public\./i)
  const refusal = sql.indexOf("message = 'REVIEW_REQUIRED_W1_DEV_INSTALLATION'")
  assert.ok(refusal >= 0 && refusal < sql.indexOf('create role'), 'initial refusal')
  assert.match(sql, /REVIEW_REQUIRED_W1_MEMBERSHIP_GRANTORS_AND_RECOVERY/)
  assert.match(sql, /REVIEW_REQUIRED_W1_CLEAN_DEV_BASELINE/)
  assert.match(sql, /REVIEW_REQUIRED_W1_MANAGED_AUTH_GRANTOR/)
  assert.match(sql, /REVIEW_REQUIRED_W1_PUBLIC_SCHEMA_GRANTOR/)
  assert.deepEqual([...sql.matchAll(/^create role (\w+) ([^;]+);$/gm)].map(m => m[1]), roles)
  for (const match of sql.matchAll(/^create role (\w+) ([^;]+);$/gm)) {
    for (const attribute of ['nologin','noinherit','nosuperuser','nobypassrls','nocreaterole','nocreatedb','noreplication']) {
      assert.ok(match[2].split(' ').includes(attribute), `${match[1]} ${attribute}`)
    }
  }
  for (const name of canonicalTables) {
    assert.equal(roleAt(text, `create table public.${name} (`), 'wz_core_registry_owner', `canonical creator ${name}`)
    assert.ok(sql.includes(`alter table public.${name} enable row level security;`))
    assert.ok(sql.includes(`alter table public.${name} force row level security;`))
  }
  const authReference = 'grant references (id) on auth.users to wz_core_registry_owner;'
  assert.equal(roleAt(text, authReference), 'supabase_auth_admin', 'Auth REFERENCES grantor')
  assert.ok(sql.indexOf(authReference) < sql.indexOf('create table public.company_memberships ('), 'Auth FK order')
  assert.equal(roleAt(text, 'grant usage, create on schema public'), 'pg_database_owner')
  assert.equal(roleAt(text, 'revoke create on schema public'), 'pg_database_owner')
  assert.ok(sql.indexOf('revoke create on schema public') > sql.indexOf('create table public.company_portal_instances ('), 'canonical CREATE lifetime')
  for (const name of ['companies','company_memberships']) {
    const grant = `grant references (id) on public.${name} to wz_w1_store_owner;`
    assert.equal(roleAt(text, grant), 'wz_core_registry_owner', 'canonical REFERENCES grantor')
    assert.ok(sql.indexOf(grant) < sql.indexOf('create schema wz_w1_private'), 'REFERENCES before private schema')
  }
  for (const name of privateTables) assert.equal(roleAt(text, `create table wz_w1_private.${name} (`), 'wz_w1_store_owner')
  for (const [name, args, owner] of functions) {
    const marker = `create function wz_w1_private.${name}(`
    assert.equal(roleAt(text, marker), owner)
    const revoke = `revoke all on function wz_w1_private.${name}(${args})`
    assert.equal(roleAt(text, revoke), owner)
    const grantee = name === 'issue_assertion' ? 'wz_w1_issuer' : name === 'consume_assertion'
      ? 'wz_w1_consumer' : 'wz_w1_issuer_owner, wz_w1_consumer_owner'
    assert.ok(normalized.includes(`grant execute on function wz_w1_private.${name}(${args}) to ${grantee};`), `EXECUTE ${name}`)
  }
  assert.doesNotMatch(sql, /alter (?:table|function)[^;]*owner to|grant (?:pg_database_owner|supabase_auth_admin) to/i)
  assert.doesNotMatch(sql, /references public\.tenants|insert into (?:public|auth)\.|(?:update|delete from) (?:public|auth)\./i)
  assert.doesNotMatch(sql, /grant references on|grant (?:usage, )?create on schema [^;]+ to public/i)
}

function validateRecovery(text) {
  const sql = clean(text)
  assert.match(sql, /^\s*begin;/)
  assert.match(sql, /rollback;\s*$/)
  const refusal = sql.indexOf("message = 'REVIEW_REQUIRED_W1_INDEPENDENT_RECOVERY_AUTHORITY'")
  assert.ok(refusal >= 0 && refusal < sql.indexOf('revoke execute'), 'recovery refusal')
  assert.match(sql, /rolcreaterole and rolbypassrls/)
  assert.match(sql, /and admin_option/)
  assert.match(sql, /REVIEW_REQUIRED_W1_RECOVERY_FUNCTION_INVENTORY/)
  assert.match(sql, /not rolcanlogin and not rolinherit/)
  for (const name of [...canonicalTables.map(n => `public.${n}`), ...privateTables.map(n => `wz_w1_private.${n}`)]) {
    assert.ok(sql.includes(`exists (select 1 from ${name})`), `empty check ${name}`)
  }
  assert.ok(sql.indexOf('REVIEW_REQUIRED_W1_POPULATED_HISTORY_RECOVERY') < sql.indexOf('drop function'), 'empty before destruction')
  assert.ok(sql.indexOf('lock table public.companies') < sql.indexOf('REVIEW_REQUIRED_W1_POPULATED_HISTORY_RECOVERY'))
  assert.ok(sql.indexOf('drop table wz_w1_private.company_authority') < sql.indexOf('drop table public.company_memberships'), 'reverse FK order')
  assert.equal(roleAt(text, 'revoke references (id) on auth.users'), 'supabase_auth_admin')
  assert.equal(roleAt(text, 'revoke usage, create on schema public'), 'pg_database_owner')
  for (const [name, args, owner] of functions) assert.equal(roleAt(text, `drop function wz_w1_private.${name}(${args})`), owner)
  assert.deepEqual([...sql.matchAll(/drop table (\w+\.\w+) restrict;/g)].map(m => m[1]),
    ['wz_w1_private.receipts','wz_w1_private.assertions','wz_w1_private.company_authority','wz_w1_private.provider_contract',
      'public.company_portal_instances','public.company_memberships','public.companies'])
  assert.ok(sql.indexOf('drop role wz_w1_issuer') > sql.indexOf('revoke usage, create on schema public'), 'ACL before role removal')
  assert.doesNotMatch(sql, /cascade|drop owned|reassign owned|disable row level security|no force row level security|\bcommit\s*;|\b(?:delete from|truncate|update)\b/i)
}

test('accepted inputs remain exact; canonical DDL and complete W1 sections are reused', () => {
  assert.equal(createHash('sha256').update(w1).digest('hex'), '4d13c94d25c49b7a878ba50dc3852323b745e7e623fb38e2d053d687f3a9c19c')
  const ddl = base.slice(base.indexOf('create table public.companies ('), base.indexOf('alter table public.companies owner'))
  assert.ok(install.includes(ddl), 'all canonical constraints and indexes preserved')
  for (const [start, end] of [['create schema wz_w1_private', '-- Proposed owners follow'],
    ['-- Actual creator = NOLOGIN schema owner;', '-- Future dedicated logins']]) {
    assert.ok(install.includes(w1.slice(w1.indexOf(start), w1.indexOf(end))), `accepted W1 section ${start}`)
  }
})

test('canonical identity retains history and denies all external mapping', () => {
  const sql = flat(install)
  assert.match(sql, /unique \(id, company_id, core_auth_user_id\)/)
  assert.match(sql, /company_memberships_active_user_uniq on public.company_memberships\(core_auth_user_id\) where status = 'active'/)
  assert.match(sql, /unique \(company_id, portal_type\)/)
  assert.match(sql, /legacy_core_tenant_id is null and portal_tenant_id is null and mapping_state = 'unmapped' and mapping_verified_at is null and lifecycle_state = 'reserved'/)
  assert.doesNotMatch(sql, /create role wz_core_(?:writer_owner|audit_owner|executor)|create schema wz_core_private|references public\.tenants/)
})

test('single transaction uses actual owners, narrow grantors, ordered dependencies and hard refusals', () => {
  validateInstallation(install)
})

test('temporary CREATE closes for canonical and each non-schema function owner', () => {
  for (const owner of ['wz_w1_session_owner','wz_w1_issuer_owner','wz_w1_consumer_owner']) {
    const grant = `grant create on schema wz_w1_private to ${owner};`
    const revoke = `revoke create on schema wz_w1_private from ${owner};`
    assert.equal(roleAt(install, grant), 'wz_w1_store_owner')
    assert.equal(roleAt(install, revoke), 'wz_w1_store_owner')
    assert.ok(install.indexOf(grant) < install.indexOf(revoke))
  }
  assert.match(install, /REVIEW_REQUIRED_W1_EFFECTIVE_ROLE_AND_CREATE_CLOSURE/)
  assert.match(install, /REVIEW_REQUIRED_W1_PRIVATE_CREATE_CLOSURE/)
  assert.match(install, /REVIEW_REQUIRED_W1_LANGUAGE_USAGE/)
  assert.match(install, /REVIEW_REQUIRED_W1_BUILTIN_TYPE_USAGE/)
})

test('recovery is guarded, owner-led, empty-only and reverses exact dependencies', () => {
  validateRecovery(recovery)
})

test('installation validator rejects privilege, identity, dependency and refusal regressions', () => {
  const controls = [
    ['canonical creator', 'set local role wz_core_registry_owner;\ncreate table', 'set local role none;\ncreate table'],
    ['Auth FK authority', 'grant references (id) on auth.users', 'grant references (email) on auth.users'],
    ['private FK authority', 'grant references (id) on public.companies', 'grant references (display_name) on public.companies'],
    ['public function execution', 'text,text) to wz_w1_issuer;', 'text,text) to public;'],
    ['login owner', 'wz_core_registry_owner nologin', 'wz_core_registry_owner login'],
    ['bypass owner', 'noreplication nobypassrls', 'noreplication bypassrls'],
    ['missing initial refusal', "message = 'REVIEW_REQUIRED_W1_DEV_INSTALLATION'", "message = 'UNKNOWN'"],
    ['committed proposal', 'rollback;', 'commit;'],
  ]
  for (const [label, needle, replacement] of controls) {
    assert.ok(install.includes(needle), label)
    assert.throws(() => validateInstallation(install.replace(needle, replacement)), undefined, label)
  }
})

test('recovery validator rejects bypassed refusal, false-empty visibility and destructive cleanup', () => {
  for (const [needle, replacement] of [
    ["message = 'REVIEW_REQUIRED_W1_INDEPENDENT_RECOVERY_AUTHORITY'", "message = 'UNKNOWN'"],
    ['rolcreaterole and rolbypassrls', 'rolcreaterole'],
    ['exists (select 1 from wz_w1_private.receipts)', 'false'],
    ['drop table public.companies restrict;', 'drop table public.companies cascade;'],
    ['rollback;', 'commit;'],
  ]) {
    assert.ok(recovery.includes(needle))
    assert.throws(() => validateRecovery(recovery.replace(needle, replacement)))
  }
})

test('manifest hashes exact candidate, tests, contract and protected dependencies', () => {
  const manifest = read(`${dir}INSTALLATION_MANIFEST.sha256`).trim().split('\n')
  const entries = manifest.filter(line => line && !line.startsWith('#')).map(line => {
    const match = /^([0-9a-f]{64})  ([^\r\n]+)$/.exec(line)
    assert.ok(match, 'sha256sum format')
    return { hash: match[1], path: match[2] }
  })
  assert.equal(new Set(entries.map(e => e.path)).size, entries.length)
  for (const path of [`${dir}001_registry.PROPOSED.sql`, `${dir}005_w1_transport.DO_NOT_APPLY.sql`,
    `${dir}006_registry_w1_installation.DO_NOT_APPLY.sql`, `${dir}007_registry_w1_recovery.DO_NOT_APPLY.sql`,
    `${dir}W1_DEV_PACKAGE.md`, 'lib/core-w1-installation.test.mjs', 'lib/core-w1.test.mjs', 'lib/core-w1.ts']) {
    assert.ok(entries.some(e => e.path === path), `manifest ${path}`)
  }
  for (const entry of entries) assert.equal(createHash('sha256').update(readFileSync(join(root, entry.path))).digest('hex'), entry.hash, entry.path)
})
