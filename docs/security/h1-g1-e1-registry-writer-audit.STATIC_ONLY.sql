-- STATIC_DRAFT_ONLY / DO_NOT_APPLY
-- H1.G1 E1: restricted new Company + initial Owner + creation audit + receipt.
-- NON_OPERATIONAL_PHYSICAL_CANDIDATE. This is not a migration or live RPC.
-- Core repo main: 8a9ae5e7d61b706c3bd87f5516d759560876bad5.
-- Depends on exact PR47 Registry020: cd9fe1e9b1a1a4c4ede55f15f16a9ef00d7b215d.
-- Contract C1-C8: https://app.notion.com/p/3f6f69eadca0814ba601d32145c0b0db
-- DEC-2026-025 A1/B1/C1/D1, revised clean-E1 DEC-2026-029, DEC-2026-031 apply.
-- This separate E1-only ledger is not subscription_events or an edit to PR47.
--
-- BLOCKING REVIEW_REQUIRED dependencies (no assumption supplies authority):
-- IDENTITY_TRANSPORT: fresh server auth.getUser(), confirmed email, explicitly
-- non-anonymous current Core subject, no internal operator impersonation;
-- bind a verified source reference to the actual request/connection, recheck
-- revocation/freshness after lock waits. JWT/GUC/email/role/server key alone
-- is not proof. The identity guard below unconditionally denies until approved.
-- LEGACY_PROVENANCE: no prior Core/Stock/LMS/customer/onboarding/financial or
-- pending/disputed claim associations; transaction-consistent completeness,
-- including other writers, must be independently proved. Known local fences
-- alone are insufficient. The provenance guard below unconditionally denies.
-- PROVIDER_ROLES_RLS: inspect exact object owners, role attributes/memberships,
-- inherited/default/column ACLs, FORCE RLS, schema exposure and installer power.
-- Proposed NOLOGIN role names below are not verified provider identities.
-- No role memberships, login credentials or gateway transport are supplied.
-- REGISTRY_PHYSICAL: exact PR47 table types/index semantics, one active Company
-- membership per subject, retention FKs and all-history mapping remain unsigned.
-- NAME_FINGERPRINT_CODEC / REVIEW_REQUIRED_CODEC_INTEGRATION: canonical v2
-- byte framing and shared vectors replace the incompatible JSON codecs.
-- SQL execution, Unicode-normalizer compatibility and the UUID argument adapter
-- remain unverified. The codec guard therefore still denies unconditionally.
-- REQUEST_INTEGRITY_PRIVACY: origin/CSRF, anti-abuse, privacy notice/lawful basis,
-- proportional retention, erasure/hold/recovery require separate signoff.
-- No real-document intake, fixed retention duration or perpetual retention claim.
--
-- Only a future approved atomic writer may run. Neither a SQL artifact nor an
-- event grants Hub reads, portal mapping, billing, payment authority or SSO.
-- Company Hub read authorization is a separate current-membership boundary.
-- Existing 019/Stock onboarding and all prior records remain untouched.
--
-- SOURCE-BACKED INTEGRATION, 14 October 2026 (local static/mock only):
-- Core lib/supabase/server.ts uses server cookies with the anon client.
-- Internal getE1WorkspaceCandidate() fresh-verifies auth.getUser(), confirmed
-- email and is_anonymous=false; binds getClaims().sub for denial-only operator
-- exclusion using the existing lib/auth.ts/lib/superadmin.ts conventions.
-- It never accepts client actors, roles, Companies or privileged proof context.
-- Canonical scope/fingerprint bind only to that verified subject and the parsed
-- request snapshot; this local context is never returned as creation authority.
-- After three subject-scoped, exact-count legacy reads it rechecks getUser().
-- This is NOT SQL identity transport, source_ref binding, complete operator
-- anti-impersonation, or transaction/lock-wait revocation proof. No RPC/admin
-- client or public route is connected. REVIEW_REQUIRED_IDENTITY_TRANSPORT stays.
--
-- Legacy denial sources: all tenant_members.user_id, tenants.owner_user_id and
-- customer_onboarding.owner_user_id, without active/status/platform filters.
-- Existing revoked/imported/manual/cancelled/pending ownership excludes E1.
-- PR47 denies customer Registry reads and excludes disputed claims from mapping
-- rows. The separate static Registry assessor is subject-bound and denial-only;
-- empty observations NEVER yield a new Company/Owner creation contract.
-- RLS-hidden data, Stock/LMS/financial history and other pending/disputed claims
-- remain UNKNOWN, not zero. 019 locks an onboarding row FOR UPDATE, not E1's
-- subject advisory lock; pending onboarding insertion is another writer.
-- No shared cross-writer locking/completeness protocol is established by these
-- sources. REVIEW_REQUIRED_LEGACY_PROVENANCE therefore remains unconditional.
--
-- CANONICAL E1 CODEC v2 (not a deployed adapter or durable runtime result):
-- Allowed request fields: companyName + UUID idempotencyKey; extra fields deny.
-- UUID text: canonical 8-4-4-4-12 hex, version 1..8, RFC variant 8/9/a/b;
-- case-insensitive input, lower-case output. Subject uses the same vocabulary.
-- Name: ECMAScript trim (the SQL btrim set enumerates all 25 code points), NFC,
-- 2..100 Unicode scalar values; reject C0/C1 controls and unpaired surrogates.
-- UTF8 PostgreSQL text cannot contain NUL or unpaired surrogate encodings.
-- name_hex = lower-case hex(UTF-8(normalized name)); no JSON serialization.
-- scope bytes = UTF-8("e1:v2:scope:" + subject + ":" + canonical UUID key).
-- payload bytes = UTF-8("e1:v2:payload:" + subject + ":" + name_hex).
-- requestScope and payloadFingerprint = lower-case 64-hex SHA-256; SQL stores
-- both as text, with fingerprint_codec='e1:v2'. Actor/key tuple remains receipt
-- identity; scope, fingerprint and codec bind both sides of the deferred FKs.
-- Same key + changed payload/scope/codec denies; identical retry still requires
-- current exact Owner membership and active Company. No durable TS store exists.
-- Shared positive/negative fixtures live in lib/e1-workspace.test.mjs and are
-- consumed by both local suites; SQL expressions are checked structurally only.
-- Specific remaining integration gaps: PostgreSQL's typed uuid accepts alternate
-- spellings BEFORE this function sees them; the strict TS string gate needs a
-- reviewed adapter. Node/PostgreSQL NFC Unicode versions and the Registry's
-- locale-sensitive nonblank check have not been tested together. No PostgreSQL
-- parsing/execution, provider binding or end-to-end byte equivalence is proved.
-- REVIEW_REQUIRED_CODEC_INTEGRATION remains an unconditional refusal.
--
-- PostgreSQL 17 design references (not parser/runtime validation):
-- https://www.postgresql.org/docs/17/sql-createfunction.html
-- https://www.postgresql.org/docs/17/ddl-rowsecurity.html
-- https://www.postgresql.org/docs/17/explicit-locking.html
-- https://www.postgresql.org/docs/17/sql-createtable.html
-- https://www.postgresql.org/docs/17/xfunc-volatility.html
-- https://www.postgresql.org/docs/17/functions-string.html
-- https://www.postgresql.org/docs/17/plpgsql-statements.html
-- https://supabase.com/docs/reference/javascript/auth-getuser

begin;
-- Execution fuse comes before ANY role/schema/table/function changes.
do $static_only$
begin
  raise exception using errcode = '42501', message = 'STATIC_DRAFT_ONLY_DO_NOT_APPLY';
end;
$static_only$;

-- PROPOSED roles, created without IF NOT EXISTS: conflict must not silently
-- adopt existing roles. No gateway login or SET ROLE membership is authorized.
create role wz_e1_security_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role wz_e1_writer_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role wz_e1_gateway nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema wz_e1_private authorization wz_e1_security_owner;
revoke all on schema wz_e1_private from public, anon, authenticated, service_role;
grant usage on schema wz_e1_private to wz_e1_writer_owner, wz_e1_gateway;
-- Transient installation privilege for ALTER FUNCTION OWNER; revoked below.
-- Owner/installer/provider role safety is REVIEW_REQUIRED, not delegated here.
grant create on schema wz_e1_private to wz_e1_writer_owner;

create function wz_e1_private.assert_fresh_core_identity()
returns table (subject uuid, source_ref uuid)
language plpgsql volatile security invoker
set search_path = pg_catalog, pg_temp
set row_security = on
as $identity_guard$
begin
  -- REVIEW_REQUIRED_IDENTITY_TRANSPORT: no invented JWT/GUC/service-key bridge.
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_IDENTITY_TRANSPORT';
end;
$identity_guard$;
alter function wz_e1_private.assert_fresh_core_identity() owner to wz_e1_security_owner;

create function wz_e1_private.assert_clean_e1_provenance(p_verified_subject uuid)
returns void
language plpgsql volatile security invoker
set search_path = pg_catalog, pg_temp
set row_security = on
as $provenance_guard$
begin
  -- Only the verified internal subject is passed, never a customer Owner claim.
  -- REVIEW_REQUIRED_LEGACY_PROVENANCE: authoritative complete source, pending
  -- claims and concurrency with immutable 019/other writers are unresolved.
  -- This is not a caller-supplied "no history" flag or a portal-network bypass.
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_LEGACY_PROVENANCE';
end;
$provenance_guard$;
alter function wz_e1_private.assert_clean_e1_provenance(uuid) owner to wz_e1_security_owner;

create table wz_e1_private.creation_events (
  event_id uuid primary key,
  actor_user_id uuid not null references auth.users(id) on update restrict on delete restrict,
  company_id uuid not null references public.companies(id) on update restrict on delete restrict,
  membership_id uuid not null references public.company_memberships(id) on update restrict on delete restrict,
  idempotency_key uuid not null,
  request_scope text not null check (request_scope ~ '^[0-9a-f]{64}$'),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  fingerprint_codec text not null check (fingerprint_codec = 'e1:v2'),
  source_ref uuid not null,
  source_class text not null check (source_class = 'E1'),
  source text not null check (source = 'core_e1_new_workspace'),
  action text not null check (action = 'new_company_initial_owner'),
  outcome text not null check (outcome = 'created'),
  schema_version integer not null check (schema_version = 1),
  occurred_at timestamptz not null,
  constraint e1_event_subject_key_unique unique (actor_user_id, idempotency_key),
  constraint e1_event_company_unique unique (company_id),
  constraint e1_event_membership_unique unique (membership_id),
  constraint e1_event_receipt_binding_unique unique
    (actor_user_id, idempotency_key, request_scope, payload_fingerprint, fingerprint_codec, company_id, membership_id, event_id)
);
alter table wz_e1_private.creation_events owner to wz_e1_security_owner;

create table wz_e1_private.creation_receipts (
  actor_user_id uuid not null references auth.users(id) on update restrict on delete restrict,
  idempotency_key uuid not null,
  request_scope text not null check (request_scope ~ '^[0-9a-f]{64}$'),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  fingerprint_codec text not null check (fingerprint_codec = 'e1:v2'),
  company_id uuid not null references public.companies(id) on update restrict on delete restrict,
  membership_id uuid not null references public.company_memberships(id) on update restrict on delete restrict,
  event_id uuid not null,
  recorded_at timestamptz not null,
  constraint e1_receipt_subject_key_pk primary key (actor_user_id, idempotency_key),
  constraint e1_receipt_company_unique unique (company_id),
  constraint e1_receipt_membership_unique unique (membership_id),
  constraint e1_receipt_event_unique unique (event_id),
  constraint e1_receipt_event_binding_unique unique
    (actor_user_id, idempotency_key, request_scope, payload_fingerprint, fingerprint_codec, company_id, membership_id, event_id),
  constraint e1_receipt_requires_event foreign key
    (actor_user_id, idempotency_key, request_scope, payload_fingerprint, fingerprint_codec, company_id, membership_id, event_id)
    references wz_e1_private.creation_events
    (actor_user_id, idempotency_key, request_scope, payload_fingerprint, fingerprint_codec, company_id, membership_id, event_id)
    on update no action on delete no action deferrable initially deferred
);
alter table wz_e1_private.creation_receipts owner to wz_e1_security_owner;
alter table wz_e1_private.creation_events add constraint e1_event_requires_receipt foreign key
  (actor_user_id, idempotency_key, request_scope, payload_fingerprint, fingerprint_codec, company_id, membership_id, event_id)
  references wz_e1_private.creation_receipts
  (actor_user_id, idempotency_key, request_scope, payload_fingerprint, fingerprint_codec, company_id, membership_id, event_id)
  on update no action on delete no action deferrable initially deferred;
-- Reciprocal exact-tuple FKs forbid orphan events/receipts at transaction end.
-- RESTRICT on identity references is interim anti-loss, NOT permanent erasure
-- denial. Corrected retention/erasure needs separately authorized audited design.

alter table wz_e1_private.creation_events enable row level security;
alter table wz_e1_private.creation_events force row level security;
alter table wz_e1_private.creation_receipts enable row level security;
alter table wz_e1_private.creation_receipts force row level security;

create function wz_e1_private.reject_history_mutation()
returns trigger
language plpgsql security invoker
set search_path = pg_catalog, pg_temp
as $immutable_guard$
begin
  raise exception using errcode = '42501', message = 'E1_HISTORY_APPEND_ONLY';
end;
$immutable_guard$;
alter function wz_e1_private.reject_history_mutation() owner to wz_e1_security_owner;
create trigger e1_events_append_only before update or delete or truncate
  on wz_e1_private.creation_events for each statement
  execute function wz_e1_private.reject_history_mutation();
create trigger e1_receipts_append_only before update or delete or truncate
  on wz_e1_private.creation_receipts for each statement
  execute function wz_e1_private.reject_history_mutation();
-- Ordinary runtime roles cannot mutate history. Superusers/BYPASSRLS/table
-- owners/installer DDL can defeat protections: governed separately, not absolute
-- immutability. No retention purge, backup/restore or DBA override is implemented.

-- PR47 prerequisite: exact active-user UNIQUE index, ENABLE+FORCE RLS and
-- unsigned owner/ACL/column semantics must be verified before any application.
-- No DDL here recreates or changes PR47's Registry tables or active-user index.
revoke insert, update, delete, truncate, references, trigger on
  public.companies, public.company_memberships, public.company_portal_instances
  from public, anon, authenticated, service_role;
revoke all on table wz_e1_private.creation_events, wz_e1_private.creation_receipts
  from public, anon, authenticated, service_role, wz_e1_gateway, wz_e1_writer_owner;
grant select (id, status) on public.companies to wz_e1_writer_owner;
grant insert (id, display_name, status, created_at, updated_at) on public.companies to wz_e1_writer_owner;
grant select (id, company_id, core_auth_user_id, role, status) on public.company_memberships to wz_e1_writer_owner;
grant insert (id, company_id, core_auth_user_id, role, status, created_at, updated_at) on public.company_memberships to wz_e1_writer_owner;
grant select (user_id) on public.tenant_members to wz_e1_writer_owner;
grant select (owner_user_id) on public.tenants to wz_e1_writer_owner;
grant select (owner_user_id) on public.customer_onboarding to wz_e1_writer_owner;
grant select, insert on wz_e1_private.creation_events, wz_e1_private.creation_receipts to wz_e1_writer_owner;
-- No UPDATE/DELETE/TRUNCATE, no Auth-table grant, no portal/billing write grant.

create policy e1_member_read on public.company_memberships for select to wz_e1_writer_owner
  using (core_auth_user_id = (select subject from wz_e1_private.assert_fresh_core_identity()));
create policy e1_member_insert on public.company_memberships for insert to wz_e1_writer_owner
  with check (core_auth_user_id = (select subject from wz_e1_private.assert_fresh_core_identity())
    and role = 'owner' and status = 'active');
create policy e1_company_read on public.companies for select to wz_e1_writer_owner
  using (exists (select 1 from public.company_memberships m
    where m.company_id = companies.id and m.core_auth_user_id = (select subject from wz_e1_private.assert_fresh_core_identity())));
create policy e1_company_insert on public.companies for insert to wz_e1_writer_owner
  with check (true);
-- Company has no actor column: this insert policy is ONLY for the non-login,
-- non-inherited definer role with no membership delegates and a fixed gated
-- writer. Its effective ACL/role exclusivity is REVIEW_REQUIRED; never grant
-- this policy or role to customer sessions or the generic service role.
create policy e1_legacy_members_read on public.tenant_members for select to wz_e1_writer_owner
  using (user_id = (select subject from wz_e1_private.assert_fresh_core_identity()));
create policy e1_legacy_tenants_read on public.tenants for select to wz_e1_writer_owner
  using (owner_user_id = (select subject from wz_e1_private.assert_fresh_core_identity()));
create policy e1_legacy_onboarding_read on public.customer_onboarding for select to wz_e1_writer_owner
  using (owner_user_id = (select subject from wz_e1_private.assert_fresh_core_identity()));
create policy e1_events_read on wz_e1_private.creation_events for select to wz_e1_writer_owner
  using (actor_user_id = (select subject from wz_e1_private.assert_fresh_core_identity()));
create policy e1_events_insert on wz_e1_private.creation_events for insert to wz_e1_writer_owner
  with check (actor_user_id = (select subject from wz_e1_private.assert_fresh_core_identity()));
create policy e1_receipts_read on wz_e1_private.creation_receipts for select to wz_e1_writer_owner
  using (actor_user_id = (select subject from wz_e1_private.assert_fresh_core_identity()));
create policy e1_receipts_insert on wz_e1_private.creation_receipts for insert to wz_e1_writer_owner
  with check (actor_user_id = (select subject from wz_e1_private.assert_fresh_core_identity()));

create function wz_e1_private.create_new_company(p_company_name text, p_idempotency_key uuid)
returns uuid
language plpgsql volatile security definer
set search_path = pg_catalog, pg_temp
set row_security = on
as $e1_writer$
declare
  v_subject uuid;
  v_rechecked_subject uuid;
  v_source_ref uuid;
  v_rechecked_source_ref uuid;
  v_name text;
  v_scope text;
  v_fingerprint text;
  v_receipt wz_e1_private.creation_receipts%rowtype;
  v_active_memberships bigint;
  v_company uuid;
  v_membership uuid;
  v_event uuid;
  v_now timestamptz;
begin
  if current_user <> 'wz_e1_writer_owner' or not exists (
    select 1 from pg_catalog.pg_roles r where r.rolname = current_user
      and not r.rolsuper and not r.rolbypassrls and not r.rolcanlogin
      and not r.rolinherit and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication
  ) then
    raise exception using errcode = '42501', message = 'E1_WRITER_ROLE_REVIEW_REQUIRED';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed'
    or pg_catalog.current_setting('server_encoding') <> 'UTF8' then
    raise exception using errcode = '42501', message = 'E1_TRANSACTION_CONTRACT_REQUIRED';
  end if;
  if p_company_name is null or p_idempotency_key is null
    or p_idempotency_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception using errcode = '22023', message = 'E1_REQUEST_INVALID';
  end if;
  v_name := normalize(pg_catalog.btrim(p_company_name,
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'), NFC);
  if pg_catalog.char_length(v_name) < 2 or pg_catalog.char_length(v_name) > 100
    or exists (
      select 1 from pg_catalog.generate_series(1, pg_catalog.char_length(v_name)) as points(n)
      where pg_catalog.ascii(pg_catalog.substr(v_name, points.n, 1)) between 0 and 31
        or pg_catalog.ascii(pg_catalog.substr(v_name, points.n, 1)) between 127 and 159
    ) then
    raise exception using errcode = '22023', message = 'E1_REQUEST_INVALID';
  end if;

  -- Unconditional integration fuse, not a caller flag or approval bypass.
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_CODEC_INTEGRATION';

  select subject, source_ref into strict v_subject, v_source_ref
    from wz_e1_private.assert_fresh_core_identity();
  if v_subject is null or v_source_ref is null then
    raise exception using errcode = '42501', message = 'E1_VERIFIED_SUBJECT_REQUIRED';
  end if;
  -- Hash collision only serializes unrelated subjects; UNIQUE is final protection.
  perform pg_catalog.pg_advisory_xact_lock(77101, pg_catalog.hashtext(v_subject::text));
  -- Preserve the initial subject/source snapshot. STRICT rejects zero/many rows;
  -- all errors propagate. Rechecked provenance must be the same request source,
  -- not a newly generated reference or a replacement for the original value.
  select subject, source_ref into strict v_rechecked_subject, v_rechecked_source_ref
    from wz_e1_private.assert_fresh_core_identity();
  if v_rechecked_subject is null or v_rechecked_source_ref is null
    or v_rechecked_subject is distinct from v_subject
    or v_rechecked_source_ref is distinct from v_source_ref then
    raise exception using errcode = '42501', message = 'E1_CURRENT_IDENTITY_CHANGED';
  end if;
  v_scope := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    'e1:v2:scope:' || v_subject::text || ':' || p_idempotency_key::text, 'UTF8')), 'hex');
  v_fingerprint := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    'e1:v2:payload:' || v_subject::text || ':' ||
    pg_catalog.encode(pg_catalog.convert_to(v_name, 'UTF8'), 'hex'), 'UTF8')), 'hex');

  select pg_catalog.count(*) into v_active_memberships from public.company_memberships
    where core_auth_user_id = v_subject and status = 'active';
  if v_active_memberships > 1 then
    raise exception using errcode = '42501', message = 'E1_AMBIGUOUS_MEMBERSHIP_HOLD';
  end if;

  select * into v_receipt from wz_e1_private.creation_receipts
    where actor_user_id = v_subject and idempotency_key = p_idempotency_key;
  if found then
    if v_receipt.request_scope is distinct from v_scope
      or v_receipt.payload_fingerprint is distinct from v_fingerprint
      or v_receipt.fingerprint_codec <> 'e1:v2' then
      raise exception using errcode = '22023', message = 'E1_IDEMPOTENCY_PAYLOAD_CONFLICT';
    end if;
    if not exists (
      select 1 from public.company_memberships m join public.companies c on c.id = m.company_id
      where m.id = v_receipt.membership_id and m.company_id = v_receipt.company_id
        and m.core_auth_user_id = v_subject and m.role = 'owner'
        and m.status = 'active' and c.status = 'active'
    ) then
      raise exception using errcode = '42501', message = 'E1_REPLAY_NO_LONGER_AUTHORIZED';
    end if;
    return v_receipt.company_id;
  end if;

  -- No LIMIT 1, no filtering away revoked history, no email/slug/UUID matching.
  if v_active_memberships = 1 then
    raise exception using errcode = '42501', message = 'E1_EXISTING_COMPANY_USE_MEMBER_HUB';
  end if;
  if exists (select 1 from public.company_memberships where core_auth_user_id = v_subject)
    or exists (select 1 from public.tenant_members where user_id = v_subject)
    or exists (select 1 from public.tenants where owner_user_id = v_subject)
    or exists (select 1 from public.customer_onboarding where owner_user_id = v_subject) then
    raise exception using errcode = '42501', message = 'E1_LEGACY_OR_REVOKED_HISTORY_HOLD';
  end if;
  perform wz_e1_private.assert_clean_e1_provenance(v_subject);

  v_company := pg_catalog.gen_random_uuid();
  v_membership := pg_catalog.gen_random_uuid();
  v_event := pg_catalog.gen_random_uuid();
  v_now := pg_catalog.transaction_timestamp();
  set constraints wz_e1_private.e1_event_requires_receipt, wz_e1_private.e1_receipt_requires_event deferred;
  insert into public.companies (id, display_name, status, created_at, updated_at)
    values (v_company, v_name, 'active', v_now, v_now);
  insert into public.company_memberships (id, company_id, core_auth_user_id, role, status, created_at, updated_at)
    values (v_membership, v_company, v_subject, 'owner', 'active', v_now, v_now);
  insert into wz_e1_private.creation_events (
    event_id, actor_user_id, company_id, membership_id, idempotency_key,
    request_scope, payload_fingerprint, fingerprint_codec, source_ref, source_class,
    source, action, outcome, schema_version, occurred_at
  ) values (
    v_event, v_subject, v_company, v_membership, p_idempotency_key,
    v_scope, v_fingerprint, 'e1:v2', v_source_ref, 'E1',
    'core_e1_new_workspace', 'new_company_initial_owner', 'created', 1, v_now
  );
  insert into wz_e1_private.creation_receipts (
    actor_user_id, idempotency_key, request_scope, payload_fingerprint, fingerprint_codec,
    company_id, membership_id, event_id, recorded_at
  ) values (
    v_subject, p_idempotency_key, v_scope, v_fingerprint, 'e1:v2',
    v_company, v_membership, v_event, v_now
  );
  set constraints wz_e1_private.e1_event_requires_receipt, wz_e1_private.e1_receipt_requires_event immediate;
  -- No exception handler, internal COMMIT, partial-success result or upsert.
  -- Any operation/constraint/audit failure propagates; the statement rolls back
  -- Company, membership, event and receipt together. Caller must not swallow
  -- errors or emit success before its transaction commits.
  return v_company;
end;
$e1_writer$;
alter function wz_e1_private.create_new_company(text, uuid) owner to wz_e1_writer_owner;
revoke create on schema wz_e1_private from wz_e1_writer_owner;

-- Private schema is not intended as a PostgREST-exposed schema; actual exposure
-- and effective role closure must be verified. No customer/direct public RPC.
revoke all on all functions in schema wz_e1_private from public, anon, authenticated, service_role, wz_e1_gateway;
grant execute on function wz_e1_private.assert_fresh_core_identity() to wz_e1_writer_owner;
grant execute on function wz_e1_private.assert_clean_e1_provenance(uuid) to wz_e1_writer_owner;
grant execute on function wz_e1_private.create_new_company(text, uuid) to wz_e1_gateway;

-- REQUIRED FUTURE RUNTIME (NOT EXECUTED): exact provider ACL/owner closure;
-- direct anon/auth/service-role RPC denial; forged/expired/anonymous/revoked or
-- impersonated identity denial; complete legacy/claim and cross-writer fence;
-- same-key retry and changed payload; concurrent same/different keys; replay
-- after membership revocation; forced audit/receipt/FK failure full rollback;
-- zero product/trial/subscription/invoice/payment; no cross-Company Hub reads.
-- Independent physical/privacy/codec signoff and isolated authorized runtime
-- are required. This file's role/policy declarations are not deployed proof.
rollback;
