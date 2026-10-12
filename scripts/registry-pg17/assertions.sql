-- ENGINE_RUNTIME assertions. No GoTrue, PostgREST, proof, or Production claim.
-- Helpers, synthetic rows and control changes roll back after this test suite.
begin;
create schema harness;
grant usage on schema harness to anon, authenticated, service_role, harness_owner;
grant create on schema harness to harness_owner;

create function harness.assert(test_name text, passed boolean) returns void
language plpgsql security invoker as $$
begin
  if passed is distinct from true then
    raise exception 'FAIL %', test_name;
  end if;
  raise notice 'PASS %', test_name;
end;
$$;

create function harness.expect_sqlstate(test_name text, statement text, expected text)
returns void language plpgsql security invoker as $$
declare actual text := '00000';
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
  end;
  perform harness.assert(test_name || ' SQLSTATE=' || actual, actual = expected);
end;
$$;

select harness.assert('three empty Registry tables',
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in
     ('companies','company_memberships','company_portal_instances')
     and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity
     and pg_get_userbyid(c.relowner)='postgres') = 3
  and (select count(*) from public.companies)=0
  and (select count(*) from public.company_memberships)=0
  and (select count(*) from public.company_portal_instances)=0);
select harness.assert('seven explicit indexes plus three primary keys',
  (select count(*) from pg_indexes where schemaname='public' and tablename in
    ('companies','company_memberships','company_portal_instances'))=10);
select harness.assert('four RESTRICT identity foreign keys',
  (select count(*) from pg_constraint where conrelid in
    ('public.company_memberships'::regclass,'public.company_portal_instances'::regclass)
    and contype='f' and confupdtype='r' and confdeltype='r')=4);
select harness.assert('no Registry policies or user triggers',
  not exists(select 1 from pg_policies where schemaname='public' and tablename in
    ('companies','company_memberships','company_portal_instances'))
  and not exists(select 1 from pg_trigger where tgrelid in
    ('public.companies'::regclass,'public.company_memberships'::regclass,
     'public.company_portal_instances'::regclass) and not tgisinternal));
select harness.assert('client roles cannot bypass RLS or administer roles',
  (select count(*) from pg_roles where rolname in ('anon','authenticated')
   and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb)=2);
select harness.assert('service_role bypass is distinct from superuser',
  (select rolbypassrls and not rolsuper and not rolcreaterole and not rolcreatedb
   from pg_roles where rolname='service_role'));

do $$
declare role_name text; relation text; privilege text;
begin
  foreach relation in array array['public.companies','public.company_memberships',
                                  'public.company_portal_instances'] loop
    foreach role_name in array array['anon','authenticated','service_role'] loop
      foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE',
                                       'REFERENCES','TRIGGER','MAINTAIN'] loop
        perform harness.assert(role_name || ' ' || relation || ' ' || privilege,
          has_table_privilege(role_name, relation, privilege) =
            (role_name='service_role' and privilege='SELECT'));
      end loop;
    end loop;
  end loop;
end;
$$;
select harness.assert('service SELECT is not grantable',
  not exists(select 1 from pg_class c cross join lateral aclexplode(c.relacl) a
    where c.oid in ('public.companies'::regclass,'public.company_memberships'::regclass,
      'public.company_portal_instances'::regclass)
    and a.grantee=(select oid from pg_roles where rolname='service_role')
    and a.is_grantable));

insert into public.companies(id,display_name,status) values
  ('00000000-0000-4000-8000-000000000001','Synthetic Company A','active'),
  ('00000000-0000-4000-8000-000000000002','Synthetic Company B','active');
insert into public.company_memberships(company_id,core_auth_user_id,role,status) values
  ('00000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001','owner','active');
insert into public.company_portal_instances(company_id,portal_type,legacy_core_tenant_id,
  portal_tenant_id,lifecycle_state,mapping_state,mapping_verified_at) values
  ('00000000-0000-4000-8000-000000000001','stock',
   '20000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001','active','verified',now());

-- These calls also execute on separate non-superuser connections in run.sh.
set local role anon;
select harness.expect_sqlstate('anon SELECT denied','select * from public.companies','42501');
reset role;
set local role authenticated;
select harness.expect_sqlstate('authenticated SELECT denied','select * from public.companies','42501');
reset role;
set local role service_role;
select harness.assert('service_role reads through FORCE RLS',
  (select count(*) from public.companies)=2);
select harness.expect_sqlstate('service INSERT denied',
  'insert into public.companies(display_name,status) values (''Denied'',''active'')','42501');
select harness.expect_sqlstate('service UPDATE denied',
  'update public.companies set display_name=''Denied''','42501');
select harness.expect_sqlstate('service DELETE denied','delete from public.companies','42501');
select harness.expect_sqlstate('service TRUNCATE denied','truncate public.companies','42501');
reset role;

savepoint rls_control;
grant select on public.companies to authenticated;
set local role authenticated;
select harness.assert('RLS denies rows despite explicit SELECT grant',
  (select count(*) from public.companies)=0);
reset role;
rollback to savepoint rls_control;

savepoint bypass_control;
alter role service_role nobypassrls;
set local role service_role;
select harness.assert('service without BYPASSRLS sees no rows',
  (select count(*) from public.companies)=0);
reset role;
rollback to savepoint bypass_control;

-- Control relation only: do not change ownership of the Registry relations.
create table harness.owner_control(id integer primary key);
insert into harness.owner_control values (1);
alter table harness.owner_control owner to harness_owner;
alter table harness.owner_control enable row level security;
alter table harness.owner_control force row level security;
set local role harness_owner;
select harness.assert('ordinary owner subject to FORCE RLS',
  (select count(*) from harness.owner_control)=0);
reset role;
savepoint force_control;
alter table harness.owner_control no force row level security;
set local role harness_owner;
select harness.assert('negative control ordinary owner bypasses without FORCE',
  (select count(*) from harness.owner_control)=1);
reset role;
rollback to savepoint force_control;

savepoint inheritance_control;
grant insert on public.companies to harness_readers;
grant harness_readers to service_role;
revoke all on public.companies from service_role;
grant select on public.companies to service_role;
select harness.assert('negative control detects inherited INSERT after direct REVOKE',
  has_table_privilege('service_role','public.companies','INSERT'));
rollback to savepoint inheritance_control;
select harness.assert('control rollback restores service write denial',
  not has_table_privilege('service_role','public.companies','INSERT'));

select harness.expect_sqlstate('blank company name',
  'insert into public.companies(display_name,status) values (''   '',''active'')','23514');
select harness.expect_sqlstate('unsupported company status',
  'insert into public.companies(display_name,status) values (''Synthetic'',''suspended'')','23514');
select harness.expect_sqlstate('retired company needs timestamp',
  'insert into public.companies(display_name,status) values (''Synthetic'',''retired'')','23514');
select harness.expect_sqlstate('company timestamp ordering',
  'insert into public.companies(display_name,status,updated_at) values
   (''Synthetic'',''active'',now()-interval ''1 day'')','23514');
select harness.expect_sqlstate('second active membership across companies',
  'insert into public.company_memberships(company_id,core_auth_user_id,role,status) values
   (''00000000-0000-4000-8000-000000000002'',
    ''10000000-0000-4000-8000-000000000001'',''member'',''active'')','23505');
select harness.expect_sqlstate('membership missing company',
  'insert into public.company_memberships(company_id,core_auth_user_id,role,status) values
   (''00000000-0000-4000-8000-000000000099'',
    ''10000000-0000-4000-8000-000000000002'',''member'',''active'')','23503');
select harness.expect_sqlstate('membership missing Auth reference',
  'insert into public.company_memberships(company_id,core_auth_user_id,role,status) values
   (''00000000-0000-4000-8000-000000000001'',
    ''10000000-0000-4000-8000-000000000099'',''member'',''active'')','23503');
select harness.expect_sqlstate('unsupported customer membership role',
  'insert into public.company_memberships(company_id,core_auth_user_id,role,status) values
   (''00000000-0000-4000-8000-000000000001'',
    ''10000000-0000-4000-8000-000000000002'',''superadmin'',''active'')','23514');
select harness.expect_sqlstate('revoked membership needs timestamp',
  'insert into public.company_memberships(company_id,core_auth_user_id,role,status) values
   (''00000000-0000-4000-8000-000000000001'',
    ''10000000-0000-4000-8000-000000000002'',''member'',''revoked'')','23514');
select harness.expect_sqlstate('unsupported membership status',
  'insert into public.company_memberships(company_id,core_auth_user_id,role,status) values
   (''00000000-0000-4000-8000-000000000001'',
    ''10000000-0000-4000-8000-000000000002'',''member'',''inactive'')','23514');
update public.company_memberships set status='revoked',revoked_at=now();
insert into public.company_memberships(company_id,core_auth_user_id,role,status) values
  ('00000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001','owner','active');
select harness.assert('rejoin creates separate retained history row',
  (select count(*) from public.company_memberships)=2);
update public.companies set status='inactive'
  where id='00000000-0000-4000-8000-000000000002';
select harness.expect_sqlstate('inactive Company does not free active user slot',
  'insert into public.company_memberships(company_id,core_auth_user_id,role,status) values
   (''00000000-0000-4000-8000-000000000001'',
    ''10000000-0000-4000-8000-000000000001'',''member'',''active'')','23505');

select harness.expect_sqlstate('Auth delete RESTRICT',
  'delete from auth.users where id=''10000000-0000-4000-8000-000000000001''','23503');
select harness.expect_sqlstate('Auth identity update RESTRICT',
  'update auth.users set id=gen_random_uuid() where
   id=''10000000-0000-4000-8000-000000000001''','23503');
select harness.expect_sqlstate('Company delete RESTRICT including revoked history',
  'delete from public.companies where id=''00000000-0000-4000-8000-000000000001''','23503');
select harness.expect_sqlstate('Company identity update RESTRICT',
  'update public.companies set id=gen_random_uuid() where
   id=''00000000-0000-4000-8000-000000000001''','23503');
select harness.expect_sqlstate('legacy tenant delete RESTRICT',
  'delete from public.tenants where id=''20000000-0000-4000-8000-000000000001''','23503');
select harness.expect_sqlstate('legacy tenant identity update RESTRICT',
  'update public.tenants set id=gen_random_uuid() where
   id=''20000000-0000-4000-8000-000000000001''','23503');

select harness.expect_sqlstate('duplicate current product reservation',
  'insert into public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
   values (''00000000-0000-4000-8000-000000000001'',''stock'',''reserved'',''unmapped'')','23505');
update public.company_portal_instances set lifecycle_state='suspended',mapping_state='pending_proof';
select harness.expect_sqlstate('suspended unresolved mapping keeps product slot',
  'insert into public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
   values (''00000000-0000-4000-8000-000000000001'',''stock'',''active'',''unmapped'')','23505');
select harness.expect_sqlstate('verified mapping requires all references and timestamp',
  'insert into public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
   values (''00000000-0000-4000-8000-000000000002'',''lms'',''active'',''verified'')','23514');
select harness.expect_sqlstate('missing legacy tenant FK',
  'insert into public.company_portal_instances(company_id,portal_type,legacy_core_tenant_id,
    lifecycle_state,mapping_state) values
   (''00000000-0000-4000-8000-000000000002'',''lms'',
    ''20000000-0000-4000-8000-000000000099'',''active'',''pending_proof'')','23503');
select harness.expect_sqlstate('retired mapping requires retired lifecycle',
  'insert into public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
   values (''00000000-0000-4000-8000-000000000002'',''lms'',''active'',''retired'')','23514');
select harness.expect_sqlstate('retired lifecycle requires timestamp',
  'insert into public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
   values (''00000000-0000-4000-8000-000000000002'',''lms'',''retired'',''unmapped'')','23514');
select harness.expect_sqlstate('Jastip outside technical portal domain',
  'insert into public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
   values (''00000000-0000-4000-8000-000000000002'',''jastip'',''active'',''unmapped'')','23514');
select harness.expect_sqlstate('unsupported portal lifecycle',
  'insert into public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
   values (''00000000-0000-4000-8000-000000000002'',''lms'',''deleted'',''unmapped'')','23514');
select harness.expect_sqlstate('unsupported mapping state',
  'insert into public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
   values (''00000000-0000-4000-8000-000000000002'',''lms'',''active'',''approved'')','23514');
select harness.expect_sqlstate('portal timestamp ordering',
  'insert into public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state,
    updated_at) values (''00000000-0000-4000-8000-000000000002'',
    ''lms'',''active'',''unmapped'',now()-interval ''1 day'')','23514');

update public.company_portal_instances set lifecycle_state='retired',mapping_state='retired',retired_at=now();
select harness.expect_sqlstate('retired history reserves Core tenant identifier',
  'insert into public.company_portal_instances(company_id,portal_type,legacy_core_tenant_id,
    lifecycle_state,mapping_state) values (''00000000-0000-4000-8000-000000000002'',
    ''lms'',''20000000-0000-4000-8000-000000000001'',''active'',''unmapped'')','23505');
select harness.expect_sqlstate('retired history reserves portal/product identifier',
  'insert into public.company_portal_instances(company_id,portal_type,portal_tenant_id,
    lifecycle_state,mapping_state) values (''00000000-0000-4000-8000-000000000002'',
    ''stock'',''30000000-0000-4000-8000-000000000001'',''active'',''unmapped'')','23505');
insert into public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
  values ('00000000-0000-4000-8000-000000000001','stock','reserved','unmapped');
insert into public.company_portal_instances(company_id,portal_type,portal_tenant_id,lifecycle_state,mapping_state)
  values ('00000000-0000-4000-8000-000000000002','lms',
    '30000000-0000-4000-8000-000000000001','active','unmapped');
select harness.assert('retirement frees current product slot but retains identifiers',
  (select count(*) from public.company_portal_instances)=3);

select harness.assert('Registry timestamps have no automatic update trigger',
  not exists(select 1 from pg_trigger where tgrelid in
    ('public.companies'::regclass,'public.company_memberships'::regclass,
     'public.company_portal_instances'::regclass) and not tgisinternal));
rollback;
