// Structural source checks and in-memory negative controls only.
// Does not parse/execute PostgreSQL, connect to providers or simulate DB enforcement.
// Run: node --test docs/security/h1-g1-e1-registry-writer-audit.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const directory = dirname(fileURLToPath(import.meta.url))
const root = join(directory, '..', '..')
const sqlPath = join(directory, 'h1-g1-e1-registry-writer-audit.STATIC_ONLY.sql')
const source = readFileSync(sqlPath, 'utf8')
const baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'
const registryRef = 'cd9fe1e9b1a1a4c4ede55f15f16a9ef00d7b215d'
const compact = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase()
const sharedFixture = readFileSync(join(root, 'lib/e1-workspace.test.mjs'), 'utf8')
  .replaceAll('\r\n', '\n')
  .match(/const codecVectors = (\{[\s\S]*?\})\n\/\/ END_SHARED_E1_CODEC_VECTORS/)
assert.ok(sharedFixture, 'Shared codec vectors must remain explicit JSON')
const codecVectors = JSON.parse(sharedFixture[1])

// Limited lexer: preserves quoted values, removes line comments, and recognizes
// dollar-quoted bodies for top-level statement boundaries. Not a SQL parser.
function uncomment(value) {
  let output = ''
  let quoted = false
  for (let index = 0; index < value.length; index++) {
    const character = value[index]
    if (character === "'") {
      output += character
      if (quoted && value[index + 1] === "'") output += value[++index]
      else quoted = !quoted
    } else if (!quoted && character === '-' && value[index + 1] === '-') {
      while (index < value.length && value[index] !== '\n') index++
      output += '\n'
    } else output += character
  }
  return output
}

function statements(value) {
  const cleaned = uncomment(value)
  const parts = []
  let start = 0
  let quote = false
  let dollar = null
  for (let index = 0; index < cleaned.length; index++) {
    if (dollar) {
      if (cleaned.startsWith(dollar, index)) { index += dollar.length - 1; dollar = null }
    } else if (quote) {
      if (cleaned[index] === "'") {
        if (cleaned[index + 1] === "'") index++
        else quote = false
      }
    } else if (cleaned[index] === "'") quote = true
    else if (cleaned[index] === '$') {
      const match = cleaned.slice(index).match(/^\$(?:[a-z_][a-z0-9_]*)?\$/i)
      if (match) { dollar = match[0]; index += dollar.length - 1 }
    } else if (cleaned[index] === ';') { parts.push(cleaned.slice(start, index + 1).trim()); start = index + 1 }
  }
  assert.equal(quote, false, 'Unclosed quoted value')
  assert.equal(dollar, null, 'Unclosed dollar body')
  assert.equal(cleaned.slice(start).trim(), '', 'Unterminated top-level statement')
  return parts
}

function fn(sql, name) {
  const pattern = new RegExp(`create function wz_e1_private\\.${name}\\(([^)]*)\\)([\\s\\S]*?)as (\\$[a-z_][a-z0-9_]*\\$)([\\s\\S]*?)\\3;`, 'i')
  const match = uncomment(sql).match(pattern)
  assert.ok(match, `Missing function ${name}`)
  return { params: compact(match[1]), header: compact(match[2]), body: compact(match[4]) }
}

const writer = (sql) => fn(sql, 'create_new_company')
const assertions = {
  'draft marker, early execution fuse and final rollback': (sql) => {
    assert.match(sql, /^-- STATIC_DRAFT_ONLY \/ DO_NOT_APPLY/)
    const parts = statements(sql).map(compact)
    assert.equal(parts[0], 'begin;')
    assert.match(parts[1], /^do \$static_only\$ begin raise exception using errcode = '42501', message = 'static_draft_only_do_not_apply'; end; \$static_only\$;$/)
    assert.equal(parts.at(-1), 'rollback;')
    assert.ok(!parts.some((part) => part === 'commit;'))
  },
  'identity and provenance dependencies unconditionally deny': (sql) => {
    for (const name of ['assert_fresh_core_identity', 'assert_clean_e1_provenance']) {
      const guard = fn(sql, name)
      assert.match(guard.body, /^begin raise exception using errcode = '42501', message = 'review_required_[a-z_]+'; end;$/)
      assert.ok(guard.header.includes('security invoker'))
    }
    for (const requirement of ['IDENTITY_TRANSPORT', 'LEGACY_PROVENANCE', 'PROVIDER_ROLES_RLS', 'REGISTRY_PHYSICAL', 'NAME_FINGERPRINT_CODEC', 'REVIEW_REQUIRED_CODEC_INTEGRATION', 'REQUEST_INTEGRITY_PRIVACY']) assert.ok(sql.includes(requirement))
    assert.match(sql, /auth\.getUser\(\)/)
    assert.match(sql, /non-anonymous current Core subject/)
    assert.match(sql, /no internal operator impersonation/)
  },
  'proposed roles cannot login, inherit, bypass RLS or administer': (sql) => {
    const roleStatements = statements(sql).filter((part) => /^create role /i.test(part))
    assert.equal(roleStatements.length, 3)
    for (const name of ['wz_e1_security_owner', 'wz_e1_writer_owner', 'wz_e1_gateway']) {
      assert.ok(roleStatements.some((part) => compact(part) === `create role ${name} nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;`))
    }
    assert.ok(!/create role[^;]*\bpassword\b/i.test(uncomment(sql)))
  },
  'grants allow only isolated writer data and gateway command': (sql) => {
    for (const statement of statements(sql).filter((part) => /^grant /i.test(part))) {
      const grant = compact(statement).match(/^grant (.+) on (.+) to (.+);$/)
      assert.ok(grant, 'No delegated role memberships')
      const [, privileges, target, grantees] = grant
      const roles = grantees.split(',').map((role) => role.trim())
      assert.ok(roles.every((role) => ['wz_e1_writer_owner', 'wz_e1_gateway'].includes(role)))
      if (target === 'schema wz_e1_private') {
        assert.ok(['usage', 'create'].includes(privileges))
        if (privileges === 'create') assert.deepEqual(roles, ['wz_e1_writer_owner'])
      } else if (target.startsWith('function ')) {
        assert.equal(privileges, 'execute')
        if (target === 'function wz_e1_private.create_new_company(text, uuid)') assert.deepEqual(roles, ['wz_e1_gateway'])
        else {
          assert.ok(['function wz_e1_private.assert_fresh_core_identity()', 'function wz_e1_private.assert_clean_e1_provenance(uuid)'].includes(target))
          assert.deepEqual(roles, ['wz_e1_writer_owner'])
        }
      } else {
        assert.deepEqual(roles, ['wz_e1_writer_owner'])
        const allowed = [
          ['public.companies', ['select (id, status)', 'insert (id, display_name, status, created_at, updated_at)']],
          ['public.company_memberships', ['select (id, company_id, core_auth_user_id, role, status)', 'insert (id, company_id, core_auth_user_id, role, status, created_at, updated_at)']],
          ['public.tenant_members', ['select (user_id)']],
          ['public.tenants', ['select (owner_user_id)']],
          ['public.customer_onboarding', ['select (owner_user_id)']],
          ['wz_e1_private.creation_events, wz_e1_private.creation_receipts', ['select, insert']],
        ]
        assert.ok(allowed.some(([object, permitted]) => target === object && permitted.includes(privileges)), `Unexpected grant: ${statement}`)
      }
    }
    const cleaned = compact(uncomment(sql))
    assert.ok(cleaned.includes('revoke create on schema wz_e1_private from wz_e1_writer_owner;'))
    assert.ok(cleaned.indexOf('revoke create on schema') > cleaned.indexOf('alter function wz_e1_private.create_new_company'))
    assert.ok(cleaned.includes('revoke all on all functions in schema wz_e1_private from public, anon, authenticated, service_role, wz_e1_gateway;'))
    assert.ok(cleaned.includes('revoke insert, update, delete, truncate, references, trigger on public.companies, public.company_memberships, public.company_portal_instances from public, anon, authenticated, service_role;'))
  },
  'single hardened definer, explicit ownership, no dynamic SQL or transaction splitting': (sql) => {
    const command = writer(sql)
    assert.equal(command.params, 'p_company_name text, p_idempotency_key uuid')
    assert.ok(command.header.includes('language plpgsql volatile security definer'))
    assert.ok(command.header.includes('set search_path = pg_catalog, pg_temp'))
    assert.ok(command.header.includes('set row_security = on'))
    assert.equal((uncomment(sql).match(/\bsecurity definer\b/gi) ?? []).length, 1)
    assert.match(uncomment(sql), /alter function wz_e1_private\.create_new_company\(text, uuid\) owner to wz_e1_writer_owner;/i)
    assert.ok(!/\bexecute\b|\bcommit\b|\brollback\b|\bexception when\b|\bon conflict\b|\blimit 1\b|request\.jwt|auth\.uid\(|auth\.jwt\(|\bset role\b/.test(command.body))
  },
  'role drift and transaction prerequisites deny before identity or writes': (sql) => {
    const body = writer(sql).body
    for (const check of ['not r.rolsuper', 'not r.rolbypassrls', 'not r.rolcanlogin', 'not r.rolinherit', 'not r.rolcreatedb', 'not r.rolcreaterole', 'not r.rolreplication']) assert.ok(body.includes(check))
    assert.ok(body.includes("current_user <> 'wz_e1_writer_owner'"))
    assert.ok(body.includes("current_setting('transaction_isolation') <> 'read committed'"))
    assert.ok(body.includes("current_setting('server_encoding') <> 'utf8'"))
  },
  'fresh subject before lock and reverified afterward; no client-supplied identity': (sql) => {
    const body = writer(sql).body
    assert.ok(body.includes('select subject, source_ref into strict v_subject, v_source_ref from wz_e1_private.assert_fresh_core_identity();'))
    assert.ok(body.includes('select subject, source_ref into strict v_rechecked_subject, v_rechecked_source_ref from wz_e1_private.assert_fresh_core_identity();'))
    assert.ok(body.includes('v_rechecked_source_ref uuid;'))
    assert.ok(body.includes('if v_subject is null or v_source_ref is null then raise exception'))
    assert.ok(body.includes("if v_rechecked_subject is null or v_rechecked_source_ref is null or v_rechecked_subject is distinct from v_subject or v_rechecked_source_ref is distinct from v_source_ref then raise exception using errcode = '42501', message = 'e1_current_identity_changed'; end if;"))
    assert.equal((body.match(/from wz_e1_private\.assert_fresh_core_identity\(\);/g) ?? []).length, 2)
    // Original actor/source must remain the pre-lock snapshot through audit use.
    assert.ok(!/\bv_(subject|source_ref)\s*:=/.test(body))
    const captures = [...body.matchAll(/\binto\s+(?:strict\s+)?(v_[a-z_]+(?:\s*,\s*v_[a-z_]+)*)\s+from\b/g)]
      .filter((match) => /\bv_(subject|source_ref)\b/.test(match[1]))
    assert.equal(captures.length, 1, 'Never recapture original identity/source')
    const first = body.indexOf('into strict v_subject')
    const lock = body.indexOf('pg_advisory_xact_lock(77101, pg_catalog.hashtext(v_subject::text))')
    const recheck = body.indexOf('into strict v_rechecked_subject')
    const comparison = body.indexOf('if v_rechecked_subject is null')
    const receipt = body.indexOf('select * into v_receipt')
    assert.ok(first < lock && lock < recheck && recheck < comparison && comparison < receipt)
  },
  'canonical codec remains unconditionally blocked pending adapter and runtime equivalence': (sql) => {
    const body = writer(sql).body
    const denial = "raise exception using errcode = '42501', message = 'review_required_codec_integration';"
    assert.ok(body.includes(`end if; ${denial} select subject, source_ref into strict v_subject`), 'Codec denial must be unconditional')
    assert.ok(body.indexOf(denial) < body.indexOf('into strict v_subject'))
    assert.ok(body.indexOf(denial) < body.indexOf('insert into public.companies'))
    for (const detail of ['ECMAScript trim', 'Unicode scalar values', 'UTF-8', 'requestScope', 'e1:v2', 'typed uuid', 'NFC Unicode versions', 'locale-sensitive nonblank']) assert.ok(sql.includes(detail), detail)
    assert.ok(!body.includes('jsonb_build_array'), 'No JSON formatting in canonical bytes')
  },
  'server canonical payload, subject/key receipt, conflicts and authorized replay': (sql) => {
    const body = writer(sql).body
    for (const fragment of [
      'p_company_name is null or p_idempotency_key is null',
      'normalize(pg_catalog.btrim(p_company_name,',
      'pg_catalog.char_length(v_name) < 2 or pg_catalog.char_length(v_name) > 100',
      'pg_catalog.ascii(pg_catalog.substr(v_name, points.n, 1)) between 0 and 31',
      'pg_catalog.ascii(pg_catalog.substr(v_name, points.n, 1)) between 127 and 159',
      "'e1:v2:scope:' || v_subject::text || ':' || p_idempotency_key::text",
      "'e1:v2:payload:' || v_subject::text || ':' || pg_catalog.encode(pg_catalog.convert_to(v_name, 'utf8'), 'hex')",
      'v_receipt.request_scope is distinct from v_scope',
      'where actor_user_id = v_subject and idempotency_key = p_idempotency_key',
      'v_receipt.payload_fingerprint is distinct from v_fingerprint',
      "v_receipt.fingerprint_codec <> 'e1:v2'",
      'm.id = v_receipt.membership_id and m.company_id = v_receipt.company_id',
      "m.core_auth_user_id = v_subject and m.role = 'owner' and m.status = 'active' and c.status = 'active'",
      'return v_receipt.company_id;',
    ]) assert.ok(body.includes(fragment), fragment)
    assert.match(uncomment(sql), /primary key \(actor_user_id, idempotency_key\)/i)
    assert.ok(body.indexOf('return v_receipt.company_id;') < body.indexOf('insert into public.companies'))
  },
  'v2 exact byte framing, scalar/control validation, UUID grammar and hex storage': (sql) => {
    const body = writer(sql).body
    const trim = body.match(/btrim\(p_company_name, u&'([^']+)'\)/)
    assert.ok(trim, 'Explicit locale-independent trim set required')
    const points = [...trim[1].matchAll(/\\([0-9a-f]{4})/g)].map((match) => Number.parseInt(match[1], 16))
    assert.deepEqual(points, [9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279])
    assert.ok(body.includes("\\feff'), nfc);"), 'Normalization form must be NFC')
    assert.ok(body.includes("p_idempotency_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then"))
    assert.ok(body.includes("v_scope := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to( 'e1:v2:scope:' || v_subject::text || ':' || p_idempotency_key::text, 'utf8')), 'hex');"))
    assert.ok(body.includes("v_fingerprint := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to( 'e1:v2:payload:' || v_subject::text || ':' || pg_catalog.encode(pg_catalog.convert_to(v_name, 'utf8'), 'hex'), 'utf8')), 'hex');"))
    const cleaned = compact(uncomment(sql))
    for (const column of ['request_scope', 'payload_fingerprint']) {
      assert.equal(cleaned.split(`${column} text not null check (${column} ~ '^[0-9a-f]{64}$')`).length - 1, 2)
    }
    assert.equal(cleaned.split("fingerprint_codec text not null check (fingerprint_codec = 'e1:v2')").length - 1, 2)
  },
  'all active memberships and all-history legacy fences precede creation': (sql) => {
    const body = writer(sql).body
    for (const fragment of [
      "count(*) into v_active_memberships from public.company_memberships where core_auth_user_id = v_subject and status = 'active'",
      'if v_active_memberships > 1 then', 'if v_active_memberships = 1 then',
      'exists (select 1 from public.company_memberships where core_auth_user_id = v_subject)',
      'exists (select 1 from public.tenant_members where user_id = v_subject)',
      'exists (select 1 from public.tenants where owner_user_id = v_subject)',
      'exists (select 1 from public.customer_onboarding where owner_user_id = v_subject)',
      'perform wz_e1_private.assert_clean_e1_provenance(v_subject);',
    ]) assert.ok(body.includes(fragment), fragment)
    assert.ok(body.indexOf('if v_active_memberships > 1') < body.indexOf('if found then'))
    assert.ok(body.indexOf('assert_clean_e1_provenance(v_subject)') < body.indexOf('insert into public.companies'))
    assert.match(sql, /company_memberships_active_user_uniq|active-user UNIQUE index/)
  },
  'four coupled writes and generated identifiers; no products or financial operations': (sql) => {
    const body = writer(sql).body
    const targets = [...body.matchAll(/\binsert into ([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)/g)].map((match) => match[1])
    assert.deepEqual(targets, ['public.companies', 'public.company_memberships', 'wz_e1_private.creation_events', 'wz_e1_private.creation_receipts'])
    for (const identifier of ['v_company', 'v_membership', 'v_event']) assert.ok(body.includes(`${identifier} := pg_catalog.gen_random_uuid();`))
    assert.ok(body.includes('v_now := pg_catalog.transaction_timestamp();'))
    assert.ok(body.includes("values (v_membership, v_company, v_subject, 'owner', 'active', v_now, v_now)"))
    assert.ok(body.includes("v_event, v_subject, v_company, v_membership, p_idempotency_key, v_scope, v_fingerprint, 'e1:v2', v_source_ref, 'e1'"))
    assert.ok(body.includes('v_subject, p_idempotency_key, v_scope, v_fingerprint'))
    assert.ok(body.includes('v_company, v_membership, v_event, v_now'))
    assert.ok(!/\bupdate\b|\bdelete\b|\btruncate\b|\bcall\b|subscription|invoice|payment|trial|mapping_state|provision|billing|stock/.test(body))
  },
  'reciprocal durable event/receipt FKs and forced validation before success': (sql) => {
    const cleaned = compact(uncomment(sql))
    assert.equal((cleaned.match(/deferrable initially deferred/g) ?? []).length, 2)
    assert.ok(cleaned.includes('constraint e1_receipt_requires_event foreign key'))
    assert.ok(cleaned.includes('add constraint e1_event_requires_receipt foreign key'))
    assert.ok(cleaned.includes('references wz_e1_private.creation_events (actor_user_id, idempotency_key, request_scope, payload_fingerprint, fingerprint_codec, company_id, membership_id, event_id)'))
    assert.ok(cleaned.includes('references wz_e1_private.creation_receipts (actor_user_id, idempotency_key, request_scope, payload_fingerprint, fingerprint_codec, company_id, membership_id, event_id)'))
    const body = writer(sql).body
    const start = body.indexOf('set constraints wz_e1_private.e1_event_requires_receipt, wz_e1_private.e1_receipt_requires_event deferred;')
    const writes = body.indexOf('insert into public.companies')
    const validate = body.indexOf('set constraints wz_e1_private.e1_event_requires_receipt, wz_e1_private.e1_receipt_requires_event immediate;')
    assert.ok(start < writes && writes < validate && validate < body.lastIndexOf('return v_company;'))
  },
  'audit provenance fixed, immutable by policy, no secrets or unapproved retention': (sql) => {
    const cleaned = compact(uncomment(sql))
    for (const table of ['creation_events', 'creation_receipts']) {
      assert.ok(cleaned.includes(`alter table wz_e1_private.${table} enable row level security;`))
      assert.ok(cleaned.includes(`alter table wz_e1_private.${table} force row level security;`))
      assert.ok(cleaned.includes(`on wz_e1_private.${table} for each statement execute function wz_e1_private.reject_history_mutation();`))
    }
    assert.equal((cleaned.match(/before update or delete or truncate/g) ?? []).length, 2)
    assert.match(fn(sql, 'reject_history_mutation').body, /^begin raise exception using errcode = '42501', message = 'e1_history_append_only'; end;$/)
    assert.ok(cleaned.includes("source_class text not null check (source_class = 'e1')"))
    assert.ok(cleaned.includes("source text not null check (source = 'core_e1_new_workspace')"))
    assert.ok(cleaned.includes("action text not null check (action = 'new_company_initial_owner')"))
    assert.ok(cleaned.includes("outcome text not null check (outcome = 'created')"))
    assert.ok(cleaned.includes('schema_version integer not null check (schema_version = 1)'))
    assert.ok(!/\b(password|jwt|token|email|document|payload_json)\s+(text|jsonb|bytea)\b/.test(cleaned))
    assert.match(sql, /NOT permanent erasure/)
    assert.match(sql, /not absolute\s+-- immutability/)
    assert.match(sql, /fixed retention duration or perpetual retention claim/)
  },
  'all proposed policies isolated; customer membership is never role/JWT-derived': (sql) => {
    const policies = statements(sql).filter((part) => /^create policy /i.test(part)).map(compact)
    assert.equal(policies.length, 11)
    assert.ok(policies.every((policy) => /to wz_e1_writer_owner\b/.test(policy)))
    assert.ok(!policies.some((policy) => /\bfor (all|update|delete)\b/.test(policy)))
    assert.ok(policies.find((policy) => policy.includes('policy e1_member_insert')).includes("core_auth_user_id = (select subject from wz_e1_private.assert_fresh_core_identity()) and role = 'owner' and status = 'active'"))
    assert.ok(policies.filter((policy) => /policy e1_(events|receipts)_(read|insert)/.test(policy)).every((policy) => policy.includes('actor_user_id = (select subject from wz_e1_private.assert_fresh_core_identity())')))
  },
}

function verify(sql) { for (const check of Object.values(assertions)) check(sql) }
for (const [name, check] of Object.entries(assertions)) test(`positive structural contract: ${name}`, () => check(source))
test('complete baseline validates before negative controls, including digit-bearing identifiers and dollar tags', () => verify(source))

const addStatement = (sql, statement) => sql.replace(/rollback;\s*$/, `${statement}\nrollback;\n`)

const negativeControls = [
  ['remove draft marker', (sql) => sql.replace('STATIC_DRAFT_ONLY / DO_NOT_APPLY', 'APPLY')],
  ['remove early execution fuse', (sql) => sql.replace("raise exception using errcode = '42501', message = 'STATIC_DRAFT_ONLY_DO_NOT_APPLY';", 'null;')],
  ['DDL before execution fuse', (sql) => sql.replace('begin;\n-- Execution fuse', 'begin;\ncreate role unsafe login;\n-- Execution fuse')],
  ['commit artifact', (sql) => sql.replace(/rollback;\s*$/, 'commit;')],
  ['generic service-role INSERT', (sql) => addStatement(sql, 'grant insert on public.companies to service_role;')],
  ['customer Registry write', (sql) => addStatement(sql, 'grant insert on public.company_memberships to authenticated;')],
  ['PUBLIC writer execution', (sql) => addStatement(sql, 'grant execute on function wz_e1_private.create_new_company(text, uuid) to public;')],
  ['service-role writer execution', (sql) => sql.replace('create_new_company(text, uuid) to wz_e1_gateway', 'create_new_company(text, uuid) to service_role')],
  ['writer login', (sql) => sql.replace('wz_e1_writer_owner nologin', 'wz_e1_writer_owner login')],
  ['writer BYPASSRLS', (sql) => sql.replace('nobypassrls;', 'bypassrls;')],
  ['role delegation', (sql) => addStatement(sql, 'grant wz_e1_writer_owner to authenticated;')],
  ['retained schema CREATE', (sql) => sql.replace('revoke create on schema wz_e1_private from wz_e1_writer_owner;', '')],
  ['grant guard execution to gateway', (sql) => sql.replace('assert_fresh_core_identity() to wz_e1_writer_owner', 'assert_fresh_core_identity() to wz_e1_gateway')],
  ['broad writer UPDATE', (sql) => addStatement(sql, 'grant update on public.companies to wz_e1_writer_owner;')],
  ['service-role definer owner', (sql) => sql.replace('create_new_company(text, uuid) owner to wz_e1_writer_owner', 'create_new_company(text, uuid) owner to service_role')],
  ['untrusted search path', (sql) => sql.replaceAll('set search_path = pg_catalog, pg_temp', 'set search_path = public, pg_temp')],
  ['row security off', (sql) => sql.replaceAll('set row_security = on', 'set row_security = off')],
  ['invented identity from JWT', (sql) => sql.replace("raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_IDENTITY_TRANSPORT';", "return query select auth.uid(), pg_catalog.gen_random_uuid();")],
  ['provenance silently approved', (sql) => sql.replace("raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_LEGACY_PROVENANCE';", 'return;')],
  ['client Owner parameter', (sql) => sql.replace('create_new_company(p_company_name text, p_idempotency_key uuid)', 'create_new_company(p_company_name text, p_idempotency_key uuid, p_owner uuid)')],
  ['session instead of transaction lock', (sql) => sql.replace('pg_advisory_xact_lock(77101', 'pg_advisory_lock(77101')],
  ['missing post-wait identity check', (sql) => sql.replace('v_rechecked_subject is distinct from v_subject', 'false')],
  ['post-lock source overwrites original', (sql) => sql.replace('into strict v_rechecked_subject, v_rechecked_source_ref', 'into strict v_rechecked_subject, v_source_ref')],
  ['changed post-lock source ignored', (sql) => sql.replace('v_rechecked_source_ref is distinct from v_source_ref', 'false')],
  ['missing refreshed provenance allowed', (sql) => sql.replace('v_rechecked_source_ref is null', 'false')],
  ['missing refreshed subject allowed', (sql) => sql.replace('v_rechecked_subject is null', 'false')],
  ['missing initial provenance allowed', (sql) => sql.replace('v_subject is null or v_source_ref is null', 'v_subject is null')],
  ['ambiguous refreshed identity allowed', (sql) => sql.replace('into strict v_rechecked_subject', 'into v_rechecked_subject')],
  ['ambiguous initial identity allowed', (sql) => sql.replace('into strict v_subject', 'into v_subject')],
  ['original source reassigned before comparison', (sql) => sql.replace('  if v_rechecked_subject is null', '  v_source_ref := v_rechecked_source_ref;\n  if v_rechecked_subject is null')],
  ['audit uses refreshed source instead of preserved source', (sql) => sql.replace("v_scope, v_fingerprint, 'e1:v2', v_source_ref, 'E1'", "v_scope, v_fingerprint, 'e1:v2', v_rechecked_source_ref, 'E1'")],
  ['incompatible codec denial removed', (sql) => sql.replace("raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_CODEC_INTEGRATION';", 'null;')],
  ['codec denial conditional', (sql) => sql.replace("raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_CODEC_INTEGRATION';", "if false then raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_CODEC_INTEGRATION'; end if;")],
  ['SQL codec silently relabelled as application codec', (sql) => sql.replaceAll("'e1:v2'", "'e1:v1'")],
  ['unscoped receipt lookup', (sql) => sql.replace('where actor_user_id = v_subject and idempotency_key = p_idempotency_key', 'where idempotency_key = p_idempotency_key')],
  ['payload conflict ignored', (sql) => sql.replace('v_receipt.payload_fingerprint is distinct from v_fingerprint', 'false')],
  ['request scope conflict ignored', (sql) => sql.replace('v_receipt.request_scope is distinct from v_scope', 'false')],
  ['scope domain changed', (sql) => sql.replace("'e1:v2:scope:'", "'e1:v2:payload:'")],
  ['payload domain changed', (sql) => sql.replace("'e1:v2:payload:'", "'e1:v1:payload:'")],
  ['NFC normalization removed', (sql) => sql.replace("\\FEFF'), NFC)", "\\FEFF'), NFD)")],
  ['NBSP trim omitted', (sql) => sql.replace('\\00A0', '')],
  ['C1 control rejection removed', (sql) => sql.replace('between 127 and 159', 'between 1 and 2')],
  ['character bound replaced by byte bound', (sql) => sql.replace('pg_catalog.char_length(v_name) > 100', 'pg_catalog.octet_length(v_name) > 100')],
  ['UUID versions widened', (sql) => sql.replace('[1-8][0-9a-f]{3}', '[0-9][0-9a-f]{3}')],
  ['SHA256 replaced', (sql) => sql.replace('pg_catalog.sha256(', 'pg_catalog.md5(')],
  ['fingerprint representation changed', (sql) => sql.replace('payload_fingerprint text not null', 'payload_fingerprint bytea not null')],
  ['request scope omitted from binding', (sql) => sql.replaceAll('idempotency_key, request_scope, payload_fingerprint', 'idempotency_key, payload_fingerprint')],
  ['revoked replay allowed', (sql) => sql.replace("and m.status = 'active' and c.status = 'active'", "and c.status = 'active'")],
  ['ambiguous membership ignored', (sql) => sql.replace('if v_active_memberships > 1 then', 'if false then')],
  ['second key can create another Company', (sql) => sql.replace('if v_active_memberships = 1 then', 'if false then')],
  ['revoked history hidden', (sql) => sql.replace('exists (select 1 from public.company_memberships where core_auth_user_id = v_subject)', "exists (select 1 from public.company_memberships where core_auth_user_id = v_subject and status = 'active')")],
  ['external legacy fence skipped', (sql) => sql.replace('perform wz_e1_private.assert_clean_e1_provenance(v_subject);', 'null;')],
  ['missing audit write', (sql) => sql.replace('insert into wz_e1_private.creation_events (', 'perform missing_audit(')],
  ['missing receipt write', (sql) => sql.replace('insert into wz_e1_private.creation_receipts (', 'perform missing_receipt(')],
  ['foreign initial Owner', (sql) => sql.replace("values (v_membership, v_company, v_subject, 'owner', 'active', v_now, v_now)", "values (v_membership, v_company, p_owner, 'owner', 'active', v_now, v_now)")],
  ['intermediate commit', (sql) => sql.replace('  return v_company;', '  commit;\n  return v_company;')],
  ['swallow audit failure', (sql) => sql.replace('  return v_company;', '  return v_company;\nexception when others then return v_company;')],
  ['event/receipt linkage removed', (sql) => sql.replace('constraint e1_receipt_requires_event foreign key', 'constraint removed_receipt_link foreign key')],
  ['receipt/event linkage removed', (sql) => sql.replace('add constraint e1_event_requires_receipt foreign key', 'add constraint removed_event_link foreign key')],
  ['deferred link cannot defer', (sql) => sql.replace('deferrable initially deferred', 'not deferrable')],
  ['success before constraint validation', (sql) => sql.replace('set constraints wz_e1_private.e1_event_requires_receipt, wz_e1_private.e1_receipt_requires_event immediate;', '')],
  ['Stock trial/subscription side effect', (sql) => sql.replace('  return v_company;', "  insert into public.tenant_subscriptions(status) values ('trialing');\n  return v_company;")],
  ['mutable audit trigger', (sql) => sql.replace("raise exception using errcode = '42501', message = 'E1_HISTORY_APPEND_ONLY';", 'return new;')],
  ['no truncate audit guard', (sql) => sql.replace('before update or delete or truncate', 'before update or delete')],
  ['no audit FORCE RLS', (sql) => sql.replace('alter table wz_e1_private.creation_events force row level security;', '')],
  ['customer write policy', (sql) => sql.replace('create policy e1_member_insert on public.company_memberships for insert to wz_e1_writer_owner', 'create policy e1_member_insert on public.company_memberships for insert to authenticated')],
]
for (const [name, mutate] of negativeControls) {
  test(`negative structural control: ${name}`, () => {
    const altered = mutate(source)
    assert.notEqual(altered, source, 'Mutation must exercise the check')
    assert.throws(() => verify(altered))
  })
}

test('artifact is outside migration discovery; PR47 schema and active-user index untouched', () => {
  assert.equal(sqlPath, join(root, 'docs/security/h1-g1-e1-registry-writer-audit.STATIC_ONLY.sql'))
  const migrations = execFileSync('git', ['-C', root, 'ls-files', 'supabase/migrations'], { encoding: 'utf8' })
  assert.ok(!migrations.includes('h1-g1-e1-registry-writer-audit'))
  assert.ok(!/create table public\.(companies|company_memberships|company_portal_instances)\b/i.test(uncomment(source)))
  const pr47 = execFileSync('git', ['-C', root, 'show', `${registryRef}:supabase/migrations/core_db/020_company_registry_forward.sql`], { encoding: 'utf8' })
  assert.match(pr47, /create unique index company_memberships_active_user_uniq\s+on public\.company_memberships \(core_auth_user_id\)\s+where status = 'active'/)
  assert.equal(execFileSync('git', ['-C', root, 'rev-parse', 'draft/core-company-registry-static'], { encoding: 'utf8' }).trim(), registryRef)
})

test('protected UI, gitignore and integration branches remain exact; four E1 files are authorized edits', () => {
  const expected = {
    '.gitignore': '03c97e7459c7ba733590bfd5c4bf123043768dd069401a40d5789e7a6fa75f51',
    'app/hub/_components/E1WorkspaceCandidate.tsx': '03d9203eab830e9ff2ce9c658059f98246ddbc552b92364a544d0b32a4a7facd',
  }
  for (const [file, hash] of Object.entries(expected)) assert.equal(createHash('sha256').update(readFileSync(join(root, file))).digest('hex'), hash, file)
  for (const [branch, ref] of Object.entries({
    'integrate/hub-inventory-owner-billing-static': 'cd3ee875713bed9ca0e0cdc2ba5b37c8f97a1783',
    'feat/hub-1-authorized-inventory': '377a89aca0e3869454b544365705b1d868a57c5c',
    'fix/hub-owner-billing-link-static': 'fa63784e121b71b8b0c992c490a0876f7e119ad7',
  })) assert.equal(execFileSync('git', ['-C', root, 'rev-parse', branch], { encoding: 'utf8' }).trim(), ref)
})

test('historical 019 and existing application/migration source remain main-identical', () => {
  const protectedPaths = ['supabase/migrations', 'lib', 'app', 'proxy.ts', 'package.json', 'package-lock.json', 'vercel.json']
  assert.equal(execFileSync('git', ['-C', root, 'diff', '--name-only', baseline, '--', ...protectedPaths], { encoding: 'utf8' }).trim(), '')
  const file = 'supabase/migrations/core_db/019_customer_onboarding.sql'
  const current = readFileSync(join(root, file), 'utf8').replaceAll('\r\n', '\n')
  const prior = execFileSync('git', ['-C', root, 'show', `${baseline}:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n')
  assert.equal(current, prior)
})

// Model the declared canonical domain only. This does not evaluate SQL, model
// PostgreSQL UUID coercion, or establish Node/PostgreSQL Unicode equivalence.
function canonicalDomainModel(name, actor, key) {
  const body = writer(source).body
  const uuidPattern = new RegExp(body.match(/p_idempotency_key::text !~ '([^']+)'/)[1], 'i')
  for (const value of [actor, key]) {
    assert.equal(typeof value, 'string')
    assert.equal(value.length, 36)
    assert.match(value, uuidPattern)
  }
  assert.equal(typeof name, 'string')
  const trimSet = new Set([...body.match(/btrim\(p_company_name, u&'([^']+)'\)/)[1].matchAll(/\\([0-9a-f]{4})/g)]
    .map((match) => Number.parseInt(match[1], 16)))
  const characters = Array.from(name)
  while (trimSet.has(characters[0]?.codePointAt(0))) characters.shift()
  while (trimSet.has(characters.at(-1)?.codePointAt(0))) characters.pop()
  const normalized = characters.join('').normalize('NFC')
  const points = Array.from(normalized, (character) => character.codePointAt(0))
  assert.ok(points.length >= 2 && points.length <= 100)
  assert.ok(points.every((point) => point >= 32 && !(point >= 127 && point <= 159) && !(point >= 0xd800 && point <= 0xdfff)))
  const bytes = (text) => new TextEncoder().encode(text)
  const nameHex = Array.from(bytes(normalized), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const hash = (text) => createHash('sha256').update(bytes(text)).digest('hex')
  return {
    name: normalized, nameHex,
    scope: hash(['e1:v2:scope', actor.toLowerCase(), key.toLowerCase()].join(':')),
    fingerprint: hash(['e1:v2:payload', actor.toLowerCase(), nameHex].join(':')),
  }
}

for (const [index, vector] of codecVectors.valid.entries()) {
  test(`shared canonical-domain model vector ${index}: fixed UTF-8 bytes (not PostgreSQL)`, () => {
    assert.deepEqual(canonicalDomainModel(vector.input, vector.subject, vector.key), {
      name: vector.name, nameHex: vector.nameHex, scope: vector.scope, fingerprint: vector.fingerprint,
    })
  })
}
for (const [index, name] of codecVectors.invalidNames.entries()) {
  test(`shared canonical-domain negative name ${index} (not PostgreSQL)`, () => {
    assert.throws(() => canonicalDomainModel(name, codecVectors.valid[0].subject, codecVectors.valid[0].key))
  })
}
for (const [index, key] of codecVectors.invalidKeys.entries()) {
  test(`shared canonical-domain negative key ${index} (not PostgreSQL UUID coercion)`, () => {
    assert.throws(() => canonicalDomainModel('New Business', codecVectors.valid[0].subject, key))
  })
}
