-- SOURCE_ONLY / DO_NOT_APPLY / LOCAL_DRAFT. NOT a release migration.
-- Intended DEV only: mcvekinhgcqygfddyifs; identity/isolation NOT reverified.
-- Forward additions to the canonical Company contract; NEVER apply/replace 020.
-- Requires a separately approved canonical base and private connection/role
-- closure. Existing 001/002/004 refusals remain unchanged. See W1_DEV_PACKAGE.md.
begin;
do $authority$
begin
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_DEV_INSTALLATION';
end;
$authority$;

do $installer_identity$
begin
  if session_user <> 'postgres' or current_user <> 'postgres'
    or pg_catalog.current_setting('server_version_num')::integer not between 170000 and 179999
    or not pg_catalog.has_database_privilege(pg_catalog.current_database(), 'CREATE')
    or not exists (select 1 from pg_catalog.pg_roles where rolname = current_user and rolcreaterole) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_INSTALLER_IDENTITY_AND_CREATE';
  end if;
end;
$installer_identity$;

-- No LOGIN, passwords, provider settings, Auth policies or Auth DML created.
-- PG17 creator ADMIN/SET delegation and post-COMMIT recovery need actual proof.
set local createrole_self_grant = '';
create role wz_w1_store_owner nologin noinherit nosuperuser nobypassrls nocreaterole nocreatedb noreplication;
create role wz_w1_session_owner nologin noinherit nosuperuser nobypassrls nocreaterole nocreatedb noreplication;
create role wz_w1_issuer_owner nologin noinherit nosuperuser nobypassrls nocreaterole nocreatedb noreplication;
create role wz_w1_consumer_owner nologin noinherit nosuperuser nobypassrls nocreaterole nocreatedb noreplication;
create role wz_w1_issuer nologin noinherit nosuperuser nobypassrls nocreaterole nocreatedb noreplication;
create role wz_w1_consumer nologin noinherit nosuperuser nobypassrls nocreaterole nocreatedb noreplication;
grant wz_w1_store_owner, wz_w1_session_owner, wz_w1_issuer_owner, wz_w1_consumer_owner,
  wz_w1_issuer, wz_w1_consumer to postgres with admin false, inherit false, set true granted by postgres;
-- This controls the postgres-granted tuple only. The prior probe reported two
-- membership rows without their grantors/options; durable closure is unresolved.
create schema wz_w1_private authorization wz_w1_store_owner;
set local role wz_w1_store_owner;
revoke all on schema wz_w1_private from public, anon, authenticated, service_role;
grant usage on schema wz_w1_private to wz_w1_session_owner, wz_w1_issuer_owner,
  wz_w1_consumer_owner, wz_w1_issuer, wz_w1_consumer;
set local role none;

-- Proposed owners follow inherited metadata/local 001, NOT an installed base.
-- Verify exact actual owners and existing SET authority before owner-led grants.
-- Never grant membership in any provider/canonical owner as a workaround.
do $canonical_grantors$
declare v_owner oid;
begin
  select oid into v_owner from pg_catalog.pg_roles where rolname = 'pg_database_owner';
  if not exists (select 1 from pg_catalog.pg_namespace where nspname = 'public' and nspowner = v_owner)
    or not pg_catalog.pg_has_role(session_user, v_owner, 'SET') then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_PUBLIC_SCHEMA_GRANTOR';
  end if;
  select oid into v_owner from pg_catalog.pg_roles where rolname = 'wz_core_registry_owner';
  if v_owner is null then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_CANONICAL_OWNER_AND_REFERENCES';
  end if;
  if (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in ('companies','company_memberships')
        and c.relkind = 'r' and c.relowner = v_owner) <> 2
    or not pg_catalog.pg_has_role(session_user, v_owner, 'SET') then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_CANONICAL_OWNER_AND_REFERENCES';
  end if;
end;
$canonical_grantors$;
set local role pg_database_owner;
grant usage on schema public to wz_core_registry_owner, wz_w1_store_owner, wz_w1_issuer_owner, wz_w1_consumer_owner;
set local role none;
set local role wz_core_registry_owner;
grant references (id) on public.companies to wz_w1_store_owner;
grant references (id) on public.company_memberships to wz_w1_store_owner;
grant select on public.companies, public.company_memberships to wz_w1_issuer_owner, wz_w1_consumer_owner;
create policy w1_internal_companies_read on public.companies for select
  to wz_w1_issuer_owner, wz_w1_consumer_owner using (true);
create policy w1_internal_memberships_read on public.company_memberships for select
  to wz_w1_issuer_owner, wz_w1_consumer_owner using (true);
set local role none;

-- Actual creator = NOLOGIN schema owner; no inherited postgres CREATE assumed.
set local role wz_w1_store_owner;
create table wz_w1_private.provider_contract (
  singleton boolean primary key check (singleton),
  revision uuid not null,
  evidence_ref text not null check (length(evidence_ref) between 1 and 128),
  verified_until timestamptz not null,
  -- Only this reviewed provider profile is implemented. Other settings HOLD.
  profile text not null check (profile = 'no_timebox_inactivity_single_session_or_low_aal_timeout'),
  max_assertion_seconds integer not null check (max_assertion_seconds between 1 and 60)
);
create table wz_w1_private.company_authority (
  subject uuid primary key,
  company_id uuid not null references public.companies(id) on update restrict on delete restrict,
  membership_id uuid not null unique references public.company_memberships(id) on update restrict on delete restrict,
  revision uuid not null,
  provenance_ref text not null check (length(provenance_ref) between 1 and 128),
  valid_until timestamptz not null,
  disputed boolean not null default true,
  participating_writers_verified boolean not null default false
);
create index w1_authority_company_idx on wz_w1_private.company_authority(company_id);
create table wz_w1_private.assertions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  nonce uuid not null unique default pg_catalog.gen_random_uuid(),
  issuer text not null check (issuer = 'wz_w1_issuer_login'),
  audience text not null check (audience = 'wz_w1_consumer_login'),
  subject uuid not null,
  session_id uuid not null,
  token_expires_at timestamptz not null,
  company_id uuid not null,
  membership_id uuid not null,
  authority_revision uuid not null,
  provider_revision uuid not null,
  operation text not null check (operation in ('company.read', 'company.owner_check')),
  idempotency_key uuid not null,
  request_scope text not null check (request_scope ~ '^[0-9a-f]{64}$'),
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > issued_at),
  consumed_at timestamptz,
  check (consumed_at is null or consumed_at >= issued_at)
);
create index w1_assertion_subject_idx on wz_w1_private.assertions(subject);
create table wz_w1_private.receipts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  subject uuid not null,
  session_id uuid not null,
  company_id uuid not null,
  operation text not null,
  idempotency_key uuid not null,
  request_scope text not null,
  request_digest text not null,
  first_assertion_id uuid not null unique references wz_w1_private.assertions(id) on update restrict on delete restrict,
  occurred_at timestamptz not null,
  -- Security-consumption receipt ONLY; not a Company business mutation/audit.
  unique (subject, company_id, operation, idempotency_key)
);

alter table wz_w1_private.provider_contract enable row level security;
alter table wz_w1_private.provider_contract force row level security;
alter table wz_w1_private.company_authority enable row level security;
alter table wz_w1_private.company_authority force row level security;
alter table wz_w1_private.assertions enable row level security;
alter table wz_w1_private.assertions force row level security;
alter table wz_w1_private.receipts enable row level security;
alter table wz_w1_private.receipts force row level security;
revoke all on all tables in schema wz_w1_private from public, anon, authenticated, service_role,
  wz_w1_issuer, wz_w1_consumer;
-- Composite row types are separate USAGE privileges needed by function bodies.
revoke all on type wz_w1_private.provider_contract, wz_w1_private.company_authority,
  wz_w1_private.assertions, wz_w1_private.receipts
  from public, anon, authenticated, service_role, wz_w1_issuer, wz_w1_consumer;
grant usage on type wz_w1_private.provider_contract to wz_w1_session_owner, wz_w1_issuer_owner, wz_w1_consumer_owner;
grant usage on type wz_w1_private.company_authority to wz_w1_issuer_owner, wz_w1_consumer_owner;
grant usage on type wz_w1_private.assertions, wz_w1_private.receipts to wz_w1_consumer_owner;
grant select on wz_w1_private.provider_contract to wz_w1_session_owner, wz_w1_issuer_owner, wz_w1_consumer_owner;
grant select, update on wz_w1_private.company_authority to wz_w1_issuer_owner, wz_w1_consumer_owner;
grant select, insert on wz_w1_private.assertions to wz_w1_issuer_owner;
grant select, update on wz_w1_private.assertions to wz_w1_consumer_owner;
grant select, insert on wz_w1_private.receipts to wz_w1_consumer_owner;
create policy w1_contract_read on wz_w1_private.provider_contract for select
  to wz_w1_session_owner, wz_w1_issuer_owner, wz_w1_consumer_owner using (true);
create policy w1_authority_read on wz_w1_private.company_authority for select
  to wz_w1_issuer_owner, wz_w1_consumer_owner using (true);
-- Row locking by fixed definer functions only; actual authority updates denied.
create policy w1_authority_lock on wz_w1_private.company_authority for update
  to wz_w1_issuer_owner, wz_w1_consumer_owner using (true) with check (false);
create policy w1_assertions_read on wz_w1_private.assertions for select
  to wz_w1_issuer_owner, wz_w1_consumer_owner using (true);
create policy w1_assertions_issue on wz_w1_private.assertions for insert to wz_w1_issuer_owner
  with check (issuer = 'wz_w1_issuer_login' and consumed_at is null);
create policy w1_assertions_consume on wz_w1_private.assertions for update to wz_w1_consumer_owner
  using (consumed_at is null) with check (consumed_at is not null);
create policy w1_receipts_read on wz_w1_private.receipts for select to wz_w1_consumer_owner using (true);
create policy w1_receipts_insert on wz_w1_private.receipts for insert to wz_w1_consumer_owner with check (true);
-- No policy/seed writer for provider_contract or company_authority. Unknown
-- source/participating-writer provenance stays unavailable; no caller flag fills it.
set local role none;

-- Inherited Auth owner metadata is not a usable grantor/SET authorization.
-- This proposal fails closed unless the exact schema/table owner AND existing
-- SET authority are established. No owner-role membership is provisioned here.
do $managed_auth_grantor$
declare v_owner oid;
begin
  select oid into v_owner from pg_catalog.pg_roles where rolname = 'supabase_auth_admin';
  if v_owner is null then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_MANAGED_AUTH_GRANTOR';
  end if;
  if not exists (select 1 from pg_catalog.pg_namespace where nspname = 'auth' and nspowner = v_owner)
    or (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth' and c.relname in ('users','sessions') and c.relkind = 'r' and c.relowner = v_owner) <> 2
    or not pg_catalog.pg_has_role(session_user, v_owner, 'SET') then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_MANAGED_AUTH_GRANTOR';
  end if;
end;
$managed_auth_grantor$;
set local role supabase_auth_admin;
grant usage on schema auth to wz_w1_session_owner;
grant select (id, email_confirmed_at, is_anonymous, banned_until, deleted_at)
  on auth.users to wz_w1_session_owner;
grant select (id, user_id, not_after) on auth.sessions to wz_w1_session_owner;
set local role none;

set local role wz_w1_store_owner;
grant create on schema wz_w1_private to wz_w1_session_owner;
set local role none;
set local role wz_w1_session_owner;
create function wz_w1_private.verify_session(p_subject uuid, p_session uuid, p_token_expiry bigint)
returns timestamptz language plpgsql volatile security definer set search_path = '' set row_security = on
as $session$
declare
  v_contract wz_w1_private.provider_contract%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_limit timestamptz;
begin
  if p_token_expiry is null or p_token_expiry <= 0 or p_token_expiry > 9007199254740991 then
    raise exception 'w1_invalid_token_expiry';
  end if;
  select * into strict v_contract from wz_w1_private.provider_contract where singleton;
  if v_contract.verified_until <= v_now then raise exception 'w1_provider_contract_unavailable'; end if;
  select least(pg_catalog.to_timestamp(p_token_expiry::double precision / 1000),
      coalesce(s.not_after, 'infinity'::timestamptz), v_contract.verified_until)
    into strict v_limit from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id = p_session and s.user_id = p_subject and u.is_anonymous = false
      and u.email_confirmed_at is not null and u.email_confirmed_at <= v_now
      and u.deleted_at is null and (u.banned_until is null or u.banned_until <= v_now);
  if v_limit <= pg_catalog.clock_timestamp() then raise exception 'w1_session_not_current'; end if;
  -- Row presence is insufficient for other timeout/single-session/AAL profiles.
  -- This implementation accepts ONLY the independently attested profile above.
  -- No Auth row lock or globally serialized revocation guarantee is claimed.
  return v_limit;
end;
$session$;
revoke all on function wz_w1_private.verify_session(uuid,uuid,bigint)
  from public, anon, authenticated, service_role, wz_w1_issuer, wz_w1_consumer;
grant execute on function wz_w1_private.verify_session(uuid,uuid,bigint) to wz_w1_issuer_owner, wz_w1_consumer_owner;
set local role none;

set local role wz_w1_store_owner;
revoke create on schema wz_w1_private from wz_w1_session_owner;
create function wz_w1_private.check_binding(p_subject uuid, p_session uuid, p_company uuid,
  p_operation text, p_key uuid, p_scope text, p_digest text)
returns void language plpgsql immutable security invoker set search_path = ''
as $binding$
declare v_scope text; v_payload text;
begin
  if p_subject is null or p_session is null or p_company is null or p_key is null or
    p_operation is null or p_operation not in ('company.read', 'company.owner_check') or
    p_scope is null or p_digest is null then raise exception 'w1_invalid_binding'; end if;
  v_scope := encode(sha256(convert_to('w1:v1:scope:' || p_subject::text || ':' || p_session::text || ':' ||
    p_company::text || ':' || p_operation || ':' || p_key::text, 'UTF8')), 'hex');
  v_payload := encode(sha256(convert_to('w1:v1:payload:' || p_company::text || ':' || p_operation, 'UTF8')), 'hex');
  if p_scope <> v_scope or p_digest <> encode(sha256(convert_to('w1:v1:request:' || v_scope || ':' || v_payload, 'UTF8')), 'hex')
    then raise exception 'w1_request_binding_mismatch'; end if;
end;
$binding$;
revoke all on function wz_w1_private.check_binding(uuid,uuid,uuid,text,uuid,text,text)
  from public, anon, authenticated, service_role, wz_w1_issuer, wz_w1_consumer;
grant execute on function wz_w1_private.check_binding(uuid,uuid,uuid,text,uuid,text,text) to wz_w1_issuer_owner, wz_w1_consumer_owner;

create function wz_w1_private.lock_company_authority(p_subject uuid, p_company uuid, p_operation text)
returns wz_w1_private.company_authority language plpgsql volatile security invoker set search_path = '' set row_security = on
as $company$
declare v_authority wz_w1_private.company_authority%rowtype; v_role text;
begin
  select * into strict v_authority from wz_w1_private.company_authority where subject = p_subject for update;
  if v_authority.company_id <> p_company or v_authority.disputed or
    not v_authority.participating_writers_verified or v_authority.valid_until <= pg_catalog.clock_timestamp()
    then raise exception 'w1_company_provenance_unavailable'; end if;
  select m.role into strict v_role from public.company_memberships m join public.companies c on c.id = m.company_id
    where m.id = v_authority.membership_id and m.core_auth_user_id = p_subject and m.company_id = p_company
      and m.status = 'active' and c.status = 'active';
  if (select count(*) from public.company_memberships where core_auth_user_id = p_subject and status = 'active') <> 1
    or v_role not in ('owner', 'admin', 'member') or (p_operation = 'company.owner_check' and v_role <> 'owner')
    then raise exception 'w1_company_role_not_authorized'; end if;
  return v_authority;
end;
$company$;
revoke all on function wz_w1_private.lock_company_authority(uuid,uuid,text)
  from public, anon, authenticated, service_role, wz_w1_issuer, wz_w1_consumer;
grant execute on function wz_w1_private.lock_company_authority(uuid,uuid,text) to wz_w1_issuer_owner, wz_w1_consumer_owner;
set local role none;

set local role wz_w1_store_owner;
grant create on schema wz_w1_private to wz_w1_issuer_owner;
set local role none;
set local role wz_w1_issuer_owner;
create function wz_w1_private.issue_assertion(p_subject uuid, p_session uuid, p_token_expiry bigint,
  p_company uuid, p_operation text, p_key uuid, p_scope text, p_digest text)
returns uuid language plpgsql volatile security definer set search_path = '' set row_security = on
as $issue$
declare v_authority wz_w1_private.company_authority%rowtype;
  v_contract wz_w1_private.provider_contract%rowtype; v_limit timestamptz; v_id uuid; v_now timestamptz;
begin
  if session_user <> 'wz_w1_issuer_login' then raise exception 'w1_private_issuer_required'; end if;
  perform wz_w1_private.check_binding(p_subject,p_session,p_company,p_operation,p_key,p_scope,p_digest);
  -- Lock first; current session and canonical authority are read AFTER waiting.
  v_authority := wz_w1_private.lock_company_authority(p_subject,p_company,p_operation);
  v_limit := wz_w1_private.verify_session(p_subject,p_session,p_token_expiry);
  select * into strict v_contract from wz_w1_private.provider_contract where singleton;
  v_now := pg_catalog.clock_timestamp();
  v_limit := least(v_limit, v_authority.valid_until, v_contract.verified_until,
    v_now + pg_catalog.make_interval(secs => v_contract.max_assertion_seconds));
  if v_limit <= v_now then raise exception 'w1_assertion_expired'; end if;
  insert into wz_w1_private.assertions(issuer,audience,subject,session_id,token_expires_at,company_id,
    membership_id,authority_revision,provider_revision,operation,idempotency_key,request_scope,request_digest,issued_at,expires_at)
    values ('wz_w1_issuer_login','wz_w1_consumer_login',p_subject,p_session,
      pg_catalog.to_timestamp(p_token_expiry::double precision / 1000),p_company,v_authority.membership_id,
      v_authority.revision,v_contract.revision,p_operation,p_key,p_scope,p_digest,v_now,v_limit) returning id into v_id;
  return v_id;
end;
$issue$;
revoke all on function wz_w1_private.issue_assertion(uuid,uuid,bigint,uuid,text,uuid,text,text)
  from public, anon, authenticated, service_role, wz_w1_issuer, wz_w1_consumer;
grant execute on function wz_w1_private.issue_assertion(uuid,uuid,bigint,uuid,text,uuid,text,text) to wz_w1_issuer;
set local role none;

set local role wz_w1_store_owner;
revoke create on schema wz_w1_private from wz_w1_issuer_owner;
grant create on schema wz_w1_private to wz_w1_consumer_owner;
set local role none;
set local role wz_w1_consumer_owner;
create function wz_w1_private.consume_assertion(p_assertion uuid,p_subject uuid,p_session uuid,p_token_expiry bigint,
  p_company uuid,p_operation text,p_key uuid,p_scope text,p_digest text)
returns uuid language plpgsql volatile security definer set search_path = '' set row_security = on
as $consume$
declare v_authority wz_w1_private.company_authority%rowtype;
  v_assertion wz_w1_private.assertions%rowtype; v_receipt wz_w1_private.receipts%rowtype;
  v_provider uuid; v_id uuid; v_now timestamptz; v_session_limit timestamptz;
begin
  if session_user <> 'wz_w1_consumer_login' then raise exception 'w1_private_consumer_required'; end if;
  perform wz_w1_private.check_binding(p_subject,p_session,p_company,p_operation,p_key,p_scope,p_digest);
  -- Uniform lock order: subject authority, assertion. No arbitrary writer callback.
  v_authority := wz_w1_private.lock_company_authority(p_subject,p_company,p_operation);
  select * into strict v_assertion from wz_w1_private.assertions where id = p_assertion for update;
  -- Re-read Company authority and provider session AFTER the last row-lock wait.
  v_authority := wz_w1_private.lock_company_authority(p_subject,p_company,p_operation);
  v_session_limit := wz_w1_private.verify_session(p_subject,p_session,p_token_expiry);
  select revision into strict v_provider from wz_w1_private.provider_contract where singleton;
  v_now := pg_catalog.clock_timestamp();
  if v_session_limit <= v_now or v_authority.valid_until <= v_now
    or v_assertion.consumed_at is not null or v_assertion.subject <> p_subject or v_assertion.session_id <> p_session
    or v_assertion.company_id <> p_company or v_assertion.operation <> p_operation or v_assertion.idempotency_key <> p_key
    or v_assertion.request_scope <> p_scope or v_assertion.request_digest <> p_digest
    or v_assertion.membership_id <> v_authority.membership_id or v_assertion.authority_revision <> v_authority.revision
    or v_assertion.provider_revision <> v_provider or v_assertion.issued_at > v_now or v_assertion.expires_at <= v_now
    or v_assertion.token_expires_at <= v_now
    then raise exception 'w1_assertion_not_current_or_bound'; end if;
  select * into v_receipt from wz_w1_private.receipts
    where subject = p_subject and company_id = p_company and operation = p_operation and idempotency_key = p_key;
  if found then
    if v_receipt.session_id <> p_session or v_receipt.request_scope <> p_scope or v_receipt.request_digest <> p_digest
      then raise exception 'w1_idempotency_conflict'; end if;
    v_id := v_receipt.id;
  else
    insert into wz_w1_private.receipts(subject,session_id,company_id,operation,idempotency_key,
      request_scope,request_digest,first_assertion_id,occurred_at)
      values (p_subject,p_session,p_company,p_operation,p_key,p_scope,p_digest,p_assertion,v_now) returning id into v_id;
  end if;
  update wz_w1_private.assertions set consumed_at = v_now where id = p_assertion and consumed_at is null;
  if not found then raise exception 'w1_assertion_already_consumed'; end if;
  -- Receipt + consumption commit/rollback together in the caller transaction.
  -- No Company, Owner, portal, billing or lifecycle mutation occurs here.
  return v_id;
end;
$consume$;
revoke all on function wz_w1_private.consume_assertion(uuid,uuid,uuid,bigint,uuid,text,uuid,text,text)
  from public, anon, authenticated, service_role, wz_w1_issuer, wz_w1_consumer;
grant execute on function wz_w1_private.consume_assertion(uuid,uuid,uuid,bigint,uuid,text,uuid,text,text) to wz_w1_consumer;
set local role none;
set local role wz_w1_store_owner;
revoke create on schema wz_w1_private from wz_w1_consumer_owner;
set local role none;
-- Future dedicated logins must use exact names checked above, NOSUPERUSER,
-- NOBYPASSRLS/NOCREATEROLE/NOCREATEDB/NOREPLICATION and ONLY their execute group:
-- ADMIN FALSE, INHERIT TRUE, SET FALSE. Never membership in a function/table owner.
-- No LOGIN or delegation is created by this draft. Effective ACL/role closure,
-- connection TLS, Data API exclusion and recovery must be proved separately.
-- A grantor-qualified REVOKE would affect only that grantor's tuple, not every
-- observed membership path. The two probe tuples/options remain unidentified.
-- Do not specify durable cleanup until all grantors and independent recovery
-- authority are resolved. Same-backend ROLLBACK removes these new roles/grants.
do $membership_cleanup_blocker$
begin
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_MEMBERSHIP_GRANTORS_AND_RECOVERY';
end;
$membership_cleanup_blocker$;
rollback;
