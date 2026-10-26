-- LOCAL_CANDIDATE_ONLY / SYNTHETIC_ISOLATED_FIXTURE_ONLY.
-- Execute only after separate Owner approval in the disposable CI stack.
-- This is NOT Registry 020 or the STATIC_DRAFT_ONLY / DO_NOT_APPLY E1 writer.
-- No real Auth accounts, customer records, products, billing or portal objects.
begin;

do $isolation$
begin
  if current_database() <> 'postgres'
    or to_regnamespace('e1_ci') is not null
    or to_regclass('public.tenants') is not null
    or to_regclass('public.companies') is not null
    or to_regclass('public.customer_onboarding') is not null then
    raise exception using errcode = '42501', message = 'ISOLATED_EMPTY_FIXTURE_REQUIRED';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon' and not rolbypassrls)
    or not exists (select 1 from pg_roles where rolname = 'authenticated' and not rolbypassrls)
    or not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception using errcode = '42501', message = 'EXPECTED_LOCAL_ROLE_BASELINE_REQUIRED';
  end if;
end;
$isolation$;

create role e1_ci_reader nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema e1_ci;
revoke all on schema e1_ci from public, anon, authenticated, service_role;
grant usage on schema e1_ci to anon, authenticated, e1_ci_reader;
alter default privileges in schema e1_ci revoke execute on functions from public;
alter default privileges in schema e1_ci revoke all on tables from public, anon, authenticated, service_role;

-- These identities are synthetic rows, not auth.users or authenticated sessions.
create table e1_ci.synthetic_identities (
  id uuid primary key,
  kind text not null check (kind in ('customer', 'anonymous')),
  status text not null check (status in ('active', 'revoked'))
);
comment on table e1_ci.synthetic_identities is 'H1_G1_E1_SYNTHETIC_DISPOSABLE_V1';
create table e1_ci.companies (
  id uuid primary key,
  name text not null,
  status text not null check (status in ('active', 'inactive'))
);
create table e1_ci.memberships (
  actor_id uuid not null references e1_ci.synthetic_identities(id) on delete restrict,
  company_id uuid not null references e1_ci.companies(id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'member')),
  status text not null check (status in ('active', 'revoked')),
  primary key (actor_id, company_id)
);
create index e1_ci_memberships_company_idx on e1_ci.memberships(company_id);
-- Deliberately permits two memberships to test denial of inconsistent history.
-- This does not model or modify PR47's one-active-membership unique index.
create table e1_ci.legacy_history (
  actor_id uuid primary key references e1_ci.synthetic_identities(id) on delete restrict,
  reason text not null check (reason = 'synthetic_conflicting_workspace')
);

insert into e1_ci.synthetic_identities values
  ('10000000-0000-4000-8000-000000000001', 'customer', 'active'),
  ('10000000-0000-4000-8000-000000000002', 'customer', 'active'),
  ('10000000-0000-4000-8000-000000000003', 'customer', 'active'),
  ('10000000-0000-4000-8000-000000000004', 'customer', 'active'),
  ('10000000-0000-4000-8000-000000000005', 'customer', 'active'),
  ('10000000-0000-4000-8000-000000000006', 'customer', 'active'),
  ('10000000-0000-4000-8000-000000000007', 'anonymous', 'active'),
  ('10000000-0000-4000-8000-000000000008', 'customer', 'revoked');
insert into e1_ci.companies values
  ('20000000-0000-4000-8000-000000000001', 'Synthetic Company A', 'active'),
  ('20000000-0000-4000-8000-000000000002', 'Synthetic Company B', 'active'),
  ('20000000-0000-4000-8000-000000000003', 'Synthetic Inactive Company', 'inactive');
insert into e1_ci.memberships values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'member', 'active'),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'owner', 'revoked'),
  ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 'owner', 'active'),
  ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', 'owner', 'active'),
  ('10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('10000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('10000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', 'owner', 'active');
insert into e1_ci.legacy_history values
  ('10000000-0000-4000-8000-000000000006', 'synthetic_conflicting_workspace');

-- Explicit synthetic GUC simulation, never authenticated Core actor transport.
create function e1_ci.synthetic_actor() returns uuid
language sql stable security invoker set search_path = pg_catalog, pg_temp
as $$ select nullif(current_setting('e1_ci.actor', true), '')::uuid $$;

alter table e1_ci.synthetic_identities enable row level security;
alter table e1_ci.synthetic_identities force row level security;
alter table e1_ci.companies enable row level security;
alter table e1_ci.companies force row level security;
alter table e1_ci.memberships enable row level security;
alter table e1_ci.memberships force row level security;
alter table e1_ci.legacy_history enable row level security;
alter table e1_ci.legacy_history force row level security;

create policy synthetic_identity_read on e1_ci.synthetic_identities for select to e1_ci_reader
  using (id = (select e1_ci.synthetic_actor()));
create policy synthetic_membership_read on e1_ci.memberships for select to e1_ci_reader
  using (actor_id = (select e1_ci.synthetic_actor()));
create policy synthetic_history_read on e1_ci.legacy_history for select to e1_ci_reader
  using (actor_id = (select e1_ci.synthetic_actor()));
create policy synthetic_company_read on e1_ci.companies for select to e1_ci_reader
  using (
    status = 'active'
    and exists (select 1 from e1_ci.synthetic_identities i
      where i.id = (select e1_ci.synthetic_actor()) and i.kind = 'customer' and i.status = 'active')
    and (select count(*) from e1_ci.memberships m
      where m.actor_id = (select e1_ci.synthetic_actor())) = 1
    and exists (select 1 from e1_ci.memberships m
      where m.actor_id = (select e1_ci.synthetic_actor()) and m.company_id = companies.id and m.status = 'active')
    and not exists (select 1 from e1_ci.legacy_history h
      where h.actor_id = (select e1_ci.synthetic_actor()))
  );

create function e1_ci.request_workspace_disabled(
  p_company_name text, p_key uuid, p_actor uuid default null,
  p_company uuid default null, p_role text default null, p_source_ref uuid default null
) returns void
language plpgsql volatile security invoker set search_path = pg_catalog, pg_temp
as $disabled$
begin
  if p_actor is not null or p_company is not null or p_role is not null or p_source_ref is not null then
    raise exception using errcode = '42501', message = 'CLIENT_IDENTITY_DENIED';
  end if;
  -- Even synthetic eligible readers cannot create a workspace.
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_IDENTITY_TRANSPORT';
end;
$disabled$;

create function e1_ci.assert_continuity_disabled(
  p_initial_actor uuid, p_current_actor uuid, p_initial_source uuid, p_current_source uuid
) returns void
language plpgsql volatile security invoker set search_path = pg_catalog, pg_temp
as $continuity$
begin
  if p_initial_actor is null or p_current_actor is null or p_initial_source is null or p_current_source is null
    or p_initial_actor is distinct from p_current_actor or p_initial_source is distinct from p_current_source then
    raise exception using errcode = '42501', message = 'ACTOR_SOURCE_CONTINUITY_DENIED';
  end if;
  -- Matching UUIDs prove no session, provenance, revocation or post-lock binding.
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_IDENTITY_TRANSPORT';
end;
$continuity$;

-- Read-only independent codec projection, not the real writer or an adapter.
create function e1_ci.codec_projection(p_actor uuid, p_key uuid, p_name text) returns jsonb
language plpgsql immutable security invoker set search_path = pg_catalog, pg_temp
as $codec$
declare
  v_name text;
  v_hex text;
begin
  v_name := normalize(btrim(p_name,
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'), NFC);
  if p_actor is null or p_key is null or v_name is null or char_length(v_name) < 2 or char_length(v_name) > 100
    or exists (select 1 from generate_series(1, char_length(v_name)) as points(n)
      where ascii(substr(v_name, points.n, 1)) between 0 and 31
        or ascii(substr(v_name, points.n, 1)) between 127 and 159) then
    raise exception using errcode = '22023', message = 'SYNTHETIC_CODEC_INPUT_INVALID';
  end if;
  v_hex := encode(convert_to(v_name, 'UTF8'), 'hex');
  return jsonb_build_object('name', v_name, 'nameHex', v_hex,
    'scope', encode(sha256(convert_to('e1:v2:scope:' || p_actor::text || ':' || p_key::text, 'UTF8')), 'hex'),
    'fingerprint', encode(sha256(convert_to('e1:v2:payload:' || p_actor::text || ':' || v_hex, 'UTF8')), 'hex'));
end;
$codec$;

revoke all on all tables in schema e1_ci from public, anon, authenticated, service_role, e1_ci_reader;
revoke all on all functions in schema e1_ci from public, anon, authenticated, service_role, e1_ci_reader;
grant select on e1_ci.synthetic_identities, e1_ci.companies, e1_ci.memberships, e1_ci.legacy_history to e1_ci_reader;
grant execute on function e1_ci.synthetic_actor() to e1_ci_reader;
grant execute on function e1_ci.request_workspace_disabled(text, uuid, uuid, uuid, text, uuid) to anon, authenticated, e1_ci_reader;
grant execute on function e1_ci.assert_continuity_disabled(uuid, uuid, uuid, uuid) to anon, authenticated, e1_ci_reader;
-- Codec projection is callable only by the isolated supervisor for comparisons.
-- No table mutation grant, operational writer, SECURITY DEFINER, Auth or financial write.
commit;
