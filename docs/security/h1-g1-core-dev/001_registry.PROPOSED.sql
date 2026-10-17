-- SOURCE_ONLY / DO_NOT_APPLY. ROLLBACK-ONLY candidate, not a durable installer.
-- ONLY mcvekinhgcqygfddyifs after exact Owner approval and provider preflight.
-- Based on PR47 cd9fe1e9b1a1a4c4ede55f15f16a9ef00d7b215d.
-- Does not import/modify historical migrations, tenants, billing or Auth data.
-- Differences: dedicated owners; no absent legacy tenants FK; all external
-- mappings are denied; all-history Company/product reservation remains locked.
-- Retention/RESTRICT and future lifecycle/legacy mapping still need signoff.
begin;

-- Unconditional refusal BEFORE any DDL. A final independent refusal in 002
-- also remains. Removing either requires a reviewed source revision; no flag.
do $installer_authority$
begin
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY';
end;
$installer_authority$;
do $installer_preflight$
begin
  -- SQL cannot independently prove the provider project ref. Verify that
  -- outside SQL first; this checks only the proposed connection contract.
  if current_user <> 'postgres' or session_user <> 'postgres'
    or pg_catalog.current_setting('server_version_num')::integer not between 170000 and 179999
    or pg_catalog.current_setting('server_encoding') <> 'UTF8'
    or not pg_catalog.has_schema_privilege(current_user, 'public', 'CREATE')
    or not pg_catalog.has_table_privilege(current_user, 'auth.users', 'REFERENCES')
    or not exists (select 1 from pg_catalog.pg_roles where rolname = current_user and rolcreaterole) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_MANAGED_PG17_INSTALLER';
  end if;
end;
$installer_preflight$;

-- Proposal only: this cannot run past the unconditional authority guard above.
set local createrole_self_grant = '';
create role wz_core_registry_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role wz_core_writer_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role wz_core_audit_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role wz_core_executor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- PG17 installer ADMIN/SET authority is explicit and temporary, never app authority.
-- Confirm managed postgres may perform these steps before executing any DDL.
-- PG17 automatically grants creator ADMIN via the bootstrap superuser. A
-- non-superuser cannot remove that grant. Do NOT promise zero memberships.
-- Clear optional creator INHERIT/SET defaults only within this transaction;
-- inspect all actual grantors/options. No persistent configuration change.
-- NOINHERIT role attributes do not override explicit membership INHERIT TRUE.
-- This SET must precede CREATE ROLE in an approved rehearsal revision.
grant wz_core_registry_owner, wz_core_writer_owner, wz_core_audit_owner, wz_core_executor
  to postgres with admin false, inherit false, set true granted by postgres;
grant usage, create on schema public to wz_core_registry_owner;
grant usage on schema public to wz_core_writer_owner, wz_core_audit_owner;
create schema wz_core_private authorization wz_core_registry_owner;
revoke all on schema wz_core_private from public, anon, authenticated, service_role;
grant usage on schema wz_core_private to wz_core_writer_owner, wz_core_audit_owner, wz_core_executor;

create table public.companies (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 2 and 100 and display_name ~ '[^[:space:]]'),
  status text not null check (status in ('active', 'inactive', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,
  check ((status = 'retired') = (retired_at is not null)),
  check (updated_at >= created_at and (retired_at is null or retired_at >= created_at))
);
create table public.company_memberships (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on update restrict on delete restrict,
  core_auth_user_id uuid not null references auth.users(id) on update restrict on delete restrict,
  role text not null check (role in ('owner', 'admin', 'member')),
  status text not null check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((status = 'revoked') = (revoked_at is not null)),
  check (updated_at >= created_at and (revoked_at is null or revoked_at >= created_at)),
  unique (id, company_id, core_auth_user_id)
);
-- Active membership slot covers inactive/suspended Companies too. Revoked
-- history never becomes clean-E1 eligibility; transfer/rejoin is not implemented.
create unique index company_memberships_active_user_uniq
  on public.company_memberships(core_auth_user_id) where status = 'active';
create index company_memberships_company_user_idx on public.company_memberships(company_id, core_auth_user_id);
create index company_memberships_core_auth_user_idx on public.company_memberships(core_auth_user_id);

create table public.company_portal_instances (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on update restrict on delete restrict,
  portal_type text not null check (portal_type in ('stock', 'lms', 'clinic', 'laundry', 'rental', 'pharmacy')),
  legacy_core_tenant_id uuid,
  portal_tenant_id uuid,
  lifecycle_state text not null check (lifecycle_state in ('reserved', 'provisioning', 'active', 'suspended', 'retired')),
  mapping_state text not null check (mapping_state in ('unmapped', 'pending_proof', 'verified', 'conflict', 'retired')),
  mapping_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,
  check ((lifecycle_state = 'retired') = (retired_at is not null)),
  check (updated_at >= created_at and (retired_at is null or retired_at >= created_at)),
  -- Clean DEV cannot invent a legacy FK or assert an external portal exists.
  constraint core_dev_external_mapping_disabled check (
    legacy_core_tenant_id is null and portal_tenant_id is null and
    mapping_state = 'unmapped' and mapping_verified_at is null and lifecycle_state = 'reserved'
  ),
  unique (company_id, portal_type)
);
create index company_portal_instances_company_idx on public.company_portal_instances(company_id);

alter table public.companies owner to wz_core_registry_owner;
alter table public.company_memberships owner to wz_core_registry_owner;
alter table public.company_portal_instances owner to wz_core_registry_owner;
set local role wz_core_registry_owner;
alter table public.companies enable row level security;
alter table public.companies force row level security;
alter table public.company_memberships enable row level security;
alter table public.company_memberships force row level security;
alter table public.company_portal_instances enable row level security;
alter table public.company_portal_instances force row level security;

-- Defeat managed/public default ACLs on THESE objects, without changing legacy
-- global defaults. No customer SELECT policy or generic service-role privilege.
revoke all privileges on public.companies, public.company_memberships, public.company_portal_instances
  from public, anon, authenticated, service_role, wz_core_executor;
grant select, insert on public.companies, public.company_memberships to wz_core_writer_owner;
grant references on public.companies, public.company_memberships to wz_core_audit_owner;
reset role;
revoke create on schema public from wz_core_registry_owner;
-- Continue with 002_writer.PROPOSED.sql on THIS connection/transaction.
-- No transaction end here. The eventual ROLLBACK removes the roles, implicit
-- creator ADMIN and explicit SET grants together. Post-COMMIT is unsupported.
