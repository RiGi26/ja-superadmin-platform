-- STATIC_DRAFT_ONLY / DO_NOT_APPLY
-- Core only: hxhusfkrlafxdnyasmsu. Prepared from main
-- 8a9ae5e7d61b706c3bd87f5516d759560876bad5 for local static review.
-- Contract: https://app.notion.com/p/3f6f69eadca081bb8a99ed14f4698d28
-- Task: https://app.notion.com/p/3f6f69eadca08156b238f03a3862ce27
--
-- Company identity, Core Auth identity, legacy Core billing tenant identity,
-- and a portal-local tenant identity are independent references. Equal UUID
-- values, email addresses, names, or legacy roles do not establish ownership.
-- These tables contain customer relationships, not internal operator roles.
-- No row, Owner claim, Company mapping, or billing authorization is created.
-- Registry DDL does not establish live Company/Owner authority or enable billing.
-- Trusted Owner claims, independent proof provenance, Core tenant platform
-- matching, and audited privileged writers are not implemented.
--
-- REVIEW_REQUIRED_PHYSICAL_SCHEMA_SIGNOFF before any application:
-- * Lifecycle vocabularies below describe stored states, not approved transitions.
-- * All-history tenant identifier reservation is PROVISIONAL / REVIEW_REQUIRED.
--   Historical identifier reuse or reassignment remains unapproved; a reviewed
--   correction/replacement policy is required. This draft offers no release path.
-- * A verified label and timestamp are not Owner proof. Proof
--   provenance, review/revocation, tenant-product agreement, and remote tenant
--   existence require a separately authorized verification boundary.
-- * Revocation/rejoin and retirement history are retained as separate rows by
--   design, but privileged updates are not an immutable audit ledger. Immutable
--   identity/history protection and identity retention/erasure remain unapproved.
--   The RESTRICT identity FKs are PROVISIONAL / REVIEW_REQUIRED.
-- * updated_at must be maintained by a future authorized writer. No trigger,
--   function, JWT hook, or customer access policy is introduced here.
--
-- Ordinary CREATE statements intentionally fail on existing object conflicts;
-- IF NOT EXISTS must not silently accept an incompatible pre-existing schema.

begin;

create table public.companies (
  id uuid not null default gen_random_uuid(),
  display_name text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,

  constraint companies_pkey primary key (id),
  constraint companies_display_name_check
    check (display_name ~ '[^[:space:]]'),
  constraint companies_status_check
    check (status in ('active', 'inactive', 'retired')),
  constraint companies_retirement_check
    check (
      (status = 'retired' and retired_at is not null)
      or (status <> 'retired' and retired_at is null)
    ),
  constraint companies_timestamps_check
    check (
      updated_at >= created_at
      and (retired_at is null or retired_at >= created_at)
    )
);

create table public.company_memberships (
  id uuid not null default gen_random_uuid(),
  company_id uuid not null,
  core_auth_user_id uuid not null,
  role text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,

  constraint company_memberships_pkey primary key (id),
  constraint company_memberships_company_fk
    foreign key (company_id) references public.companies (id)
    on update restrict on delete restrict,
  constraint company_memberships_core_auth_user_fk
    foreign key (core_auth_user_id) references auth.users (id)
    on update restrict on delete restrict,
  constraint company_memberships_role_check
    check (role in ('owner', 'admin', 'member')),
  constraint company_memberships_status_check
    check (status in ('active', 'revoked')),
  constraint company_memberships_revocation_check
    check (
      (status = 'active' and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    ),
  constraint company_memberships_timestamps_check
    check (
      updated_at >= created_at
      and (revoked_at is null or revoked_at >= created_at)
    )
);

-- One active customer membership per Core Auth subject, including suspended
-- or inactive Companies. Changing a Company's status cannot open a second slot.
-- Revoked rows do not consume the slot. Rejoin history uses a new membership row.
-- No unique Owner-per-Company constraint or all-history Company/user uniqueness.
create unique index company_memberships_active_user_uniq
  on public.company_memberships (core_auth_user_id)
  where status = 'active';

-- Full-history indexes cover both foreign keys, including revoked memberships.
create index company_memberships_company_user_idx
  on public.company_memberships (company_id, core_auth_user_id);
create index company_memberships_core_auth_user_idx
  on public.company_memberships (core_auth_user_id);

create table public.company_portal_instances (
  id uuid not null default gen_random_uuid(),
  company_id uuid not null,
  portal_type text not null,
  legacy_core_tenant_id uuid,
  portal_tenant_id uuid,
  lifecycle_state text not null,
  mapping_state text not null,
  mapping_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,

  constraint company_portal_instances_pkey primary key (id),
  constraint company_portal_instances_company_fk
    foreign key (company_id) references public.companies (id)
    on update restrict on delete restrict,
  constraint company_portal_instances_core_tenant_fk
    foreign key (legacy_core_tenant_id) references public.tenants (id)
    on update restrict on delete restrict,
  constraint company_portal_instances_portal_type_check
    check (portal_type in ('stock', 'lms', 'clinic', 'laundry', 'rental', 'pharmacy')),
  constraint company_portal_instances_lifecycle_check
    check (lifecycle_state in ('reserved', 'provisioning', 'active', 'suspended', 'retired')),
  constraint company_portal_instances_mapping_check
    check (mapping_state in ('unmapped', 'pending_proof', 'verified', 'conflict', 'retired')),
  constraint company_portal_instances_verified_mapping_check
    check (
      mapping_state <> 'verified'
      or (
        legacy_core_tenant_id is not null
        and portal_tenant_id is not null
        and mapping_verified_at is not null
      )
    ),
  constraint company_portal_instances_retired_mapping_check
    check (mapping_state <> 'retired' or lifecycle_state = 'retired'),
  constraint company_portal_instances_retirement_check
    check (
      (lifecycle_state = 'retired' and retired_at is not null)
      or (lifecycle_state <> 'retired' and retired_at is null)
    ),
  constraint company_portal_instances_timestamps_check
    check (
      updated_at >= created_at
      and (retired_at is null or retired_at >= created_at)
    )
);

-- Suspension and unresolved mapping retain the Company/product reservation.
-- Only retired lifecycle rows leave this partial index; their references below
-- remain reserved. Retirement does not automatically authorize a replacement.
create unique index company_portal_instances_current_product_uniq
  on public.company_portal_instances (company_id, portal_type)
  where lifecycle_state in ('reserved', 'provisioning', 'active', 'suspended');

-- Reserve every asserted nonnull reference across all mapping/lifecycle states,
-- including retired rows. A verification downgrade must not free a historical
-- association for another Company. Disputed claim cases are outside this table.
create unique index company_portal_instances_core_tenant_uniq
  on public.company_portal_instances (legacy_core_tenant_id)
  where legacy_core_tenant_id is not null;
create unique index company_portal_instances_portal_tenant_uniq
  on public.company_portal_instances (portal_type, portal_tenant_id)
  where portal_tenant_id is not null;

create index company_portal_instances_company_product_idx
  on public.company_portal_instances (company_id, portal_type);

-- No client policies: both reads and mutations remain fail-closed. FORCE RLS
-- also covers ordinary table owners; privileged BYPASSRLS roles remain distinct.
alter table public.companies enable row level security;
alter table public.companies force row level security;
alter table public.company_memberships enable row level security;
alter table public.company_memberships force row level security;
alter table public.company_portal_instances enable row level security;
alter table public.company_portal_instances force row level security;

-- Clear inherited object defaults for these new tables only. SELECT is the sole
-- service_role grant; no INSERT/UPDATE privilege is granted in this phase.
-- Audited privileged writers and future write access require separate approval.
-- This is not Owner authorization. PostgreSQL table-owner/superuser contexts
-- remain separate; their safety is not proven by this draft. No DELETE or
-- TRUNCATE grant is provided for retained history.
revoke all privileges on table
  public.companies,
  public.company_memberships,
  public.company_portal_instances
from public, anon, authenticated, service_role;

grant select on table
  public.companies,
  public.company_memberships,
  public.company_portal_instances
to service_role;

commit;
