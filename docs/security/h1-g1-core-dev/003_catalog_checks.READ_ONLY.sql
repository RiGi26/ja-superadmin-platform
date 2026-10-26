-- SOURCE_ONLY. Post-install READ-ONLY checks for mcvekinhgcqygfddyifs only.
-- No rows from application/Auth/session/billing tables are inspected.
select r.rolname, r.rolcanlogin, r.rolinherit, r.rolsuper, r.rolbypassrls,
  r.rolcreaterole, r.rolcreatedb, r.rolreplication,
  not (r.rolcanlogin or r.rolinherit or r.rolsuper or r.rolbypassrls or
    r.rolcreaterole or r.rolcreatedb or r.rolreplication) as attributes_match,
  not exists (select 1 from pg_catalog.pg_auth_members a where a.roleid = r.oid or a.member = r.oid) as no_delegation
from pg_catalog.pg_roles r
where r.rolname in ('wz_core_registry_owner', 'wz_core_writer_owner', 'wz_core_audit_owner', 'wz_core_executor')
order by r.rolname;

select n.nspname, c.relname, pg_catalog.pg_get_userbyid(c.relowner) as owner,
  c.relrowsecurity, c.relforcerowsecurity, c.relacl::text as acl
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and ((n.nspname = 'public' and c.relname in
  ('companies', 'company_memberships', 'company_portal_instances')) or
  (n.nspname = 'wz_core_private' and c.relname in ('creation_events', 'creation_receipts')))
order by n.nspname, c.relname;

select r.rolname, c.oid::regclass::text as object,
  pg_catalog.has_table_privilege(r.oid, c.oid, 'SELECT') as can_select,
  pg_catalog.has_table_privilege(r.oid, c.oid, 'INSERT') as can_insert,
  pg_catalog.has_table_privilege(r.oid, c.oid, 'UPDATE') as can_update,
  pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE') as can_delete,
  pg_catalog.has_table_privilege(r.oid, c.oid, 'TRUNCATE') as can_truncate,
  pg_catalog.has_table_privilege(r.oid, c.oid, 'MAINTAIN') as can_maintain
from pg_catalog.pg_roles r cross join pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where r.rolname in ('anon', 'authenticated', 'service_role', 'wz_core_executor', 'wz_core_writer_owner')
  and c.relkind = 'r' and ((n.nspname = 'public' and c.relname in
    ('companies', 'company_memberships', 'company_portal_instances')) or n.nspname = 'wz_core_private')
order by r.rolname, object;

select p.proname, pg_catalog.pg_get_userbyid(p.proowner) as owner,
  p.prosecdef, p.proconfig, p.proacl::text as acl,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as customer_execute,
  pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
  pg_catalog.has_function_privilege('wz_core_executor', p.oid, 'EXECUTE') as executor_execute
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'wz_core_private' order by p.proname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies where schemaname = 'wz_core_private' or
  (schemaname = 'public' and tablename in ('companies', 'company_memberships', 'company_portal_instances'))
order by schemaname, tablename, policyname;
select c.conrelid::regclass::text as object, c.conname,
  pg_catalog.pg_get_constraintdef(c.oid) as definition, c.condeferrable, c.condeferred
from pg_catalog.pg_constraint c join pg_catalog.pg_namespace n on n.oid = c.connamespace
where n.nspname = 'wz_core_private' or c.conrelid in
  (pg_catalog.to_regclass('public.company_memberships'), pg_catalog.to_regclass('public.company_portal_instances'))
order by object, c.conname;
select pg_catalog.current_setting('pgrst.db_schemas', true) as observed_api_schemas;
-- PG17 SET/INHERIT/ADMIN are independent options. Inspect all three explicitly.
-- Bootstrap-superuser creator ADMIN is not a grant postgres can revoke itself.
-- An observed remaining grant is not approved permanent recovery authority.
select pg_catalog.pg_get_userbyid(a.roleid) as granted_role,
  pg_catalog.pg_get_userbyid(a.member) as member_role,
  pg_catalog.pg_get_userbyid(a.grantor) as grantor, grantor_role.rolsuper as grantor_is_superuser,
  a.admin_option, a.inherit_option, a.set_option
from pg_catalog.pg_auth_members a join pg_catalog.pg_roles r
  on r.oid in (a.roleid, a.member)
join pg_catalog.pg_roles grantor_role on grantor_role.oid = a.grantor
where r.rolname in ('wz_core_registry_owner', 'wz_core_writer_owner', 'wz_core_audit_owner', 'wz_core_executor')
order by granted_role, member_role;
-- NULL does not establish schema exposure. Verify provider Data API config separately.

-- Installer observations are necessary, not proof of usable role transfer/recovery.
select current_user, session_user, pg_catalog.current_database(),
  pg_catalog.current_setting('server_version_num') as server_version_num,
  pg_catalog.current_setting('server_encoding') as server_encoding,
  pg_catalog.current_setting('transaction_isolation') as transaction_isolation,
  pg_catalog.current_setting('createrole_self_grant', true) as creator_options,
  r.rolsuper, r.rolcreaterole, r.rolbypassrls,
  pg_catalog.has_schema_privilege(current_user, 'public', 'CREATE') as public_create,
  pg_catalog.has_table_privilege(current_user, 'auth.users', 'REFERENCES') as auth_user_references
from pg_catalog.pg_roles r where r.rolname = current_user;

-- Default ACLs depend on actual creating role, not the eventual object owner.
-- Global and schema-specific rows both matter. Do not alter provider defaults.
select pg_catalog.pg_get_userbyid(d.defaclrole) as creator,
  case when d.defaclnamespace = 0 then '<global>' else n.nspname end as schema_context,
  d.defaclobjtype, d.defaclacl::text as acl
from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
where d.defaclnamespace = 0 or n.nspname in ('public', 'wz_core_private')
order by creator, schema_context, d.defaclobjtype;
select n.nspname, pg_catalog.pg_get_userbyid(n.nspowner) as owner, n.nspacl::text as acl,
  r.rolname, pg_catalog.has_schema_privilege(r.oid, n.oid, 'USAGE') as can_use,
  pg_catalog.has_schema_privilege(r.oid, n.oid, 'CREATE') as can_create
from pg_catalog.pg_namespace n cross join pg_catalog.pg_roles r
where n.nspname in ('public', 'wz_core_private') and r.rolname in
  ('postgres', 'anon', 'authenticated', 'service_role', 'wz_core_registry_owner',
   'wz_core_writer_owner', 'wz_core_audit_owner', 'wz_core_executor')
order by n.nspname, r.rolname;

-- Effective column privileges can survive table-level revocation.
select c.oid::regclass::text as object, a.attname, a.attacl::text as column_acl, r.rolname,
  pg_catalog.has_column_privilege(r.oid, c.oid, a.attnum, 'SELECT,INSERT,UPDATE,REFERENCES') as any_column_access
from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace cross join pg_catalog.pg_roles r
where a.attnum > 0 and not a.attisdropped and c.relkind = 'r'
  and ((n.nspname = 'public' and c.relname in ('companies', 'company_memberships', 'company_portal_instances'))
    or n.nspname = 'wz_core_private')
  and r.rolname in ('anon', 'authenticated', 'service_role', 'wz_core_executor')
order by object, a.attnum, r.rolname;

-- Expected zero candidate sequences. Inspect any unexpected dependency before
-- stopping; do not grant/revoke/drop all sequences in public.
select c.oid::regclass::text as object, pg_catalog.pg_get_userbyid(c.relowner) as owner,
  c.relacl::text as acl, r.rolname,
  pg_catalog.has_sequence_privilege(r.oid, c.oid, 'USAGE,SELECT,UPDATE') as any_sequence_access
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
cross join pg_catalog.pg_roles r where c.relkind = 'S' and
  (n.nspname = 'wz_core_private' or (n.nspname = 'public' and c.relname like 'wz_core_%'))
  and r.rolname in ('anon', 'authenticated', 'service_role', 'wz_core_executor')
order by object, r.rolname;

-- Check reachability to EVERY other role: NOINHERIT does not imply no SET path.
-- has-role checks cover transitive paths; direct memberships above expose ADMIN.
select r.rolname as principal, target.rolname as reachable_role,
  pg_catalog.pg_has_role(r.oid, target.oid, 'USAGE') as inherits_privileges,
  pg_catalog.pg_has_role(r.oid, target.oid, 'SET') as can_set_role
from pg_catalog.pg_roles r cross join pg_catalog.pg_roles target
where r.rolname in ('wz_core_registry_owner', 'wz_core_writer_owner', 'wz_core_audit_owner', 'wz_core_executor')
  and target.oid <> r.oid and (pg_catalog.pg_has_role(r.oid, target.oid, 'USAGE')
    or pg_catalog.pg_has_role(r.oid, target.oid, 'SET'))
order by principal, reachable_role;

-- Resolve dependencies explicitly for recovery; unexpected dependency = STOP.
-- Stored PL/pgSQL text may omit catalog dependencies: explicit function/policy
-- ordering is still required. Role dependencies are cluster-wide.
select pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid) as dependent,
  pg_catalog.pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) as referenced, d.deptype
from pg_catalog.pg_depend d where
  (d.refclassid = 'pg_catalog.pg_class'::regclass and d.refobjid in
    (select c.oid from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'wz_core_private' or (n.nspname = 'public' and c.relname in
        ('companies', 'company_memberships', 'company_portal_instances'))))
  or (d.refclassid = 'pg_catalog.pg_proc'::regclass and d.refobjid in
    (select p.oid from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'wz_core_private'))
order by referenced, dependent;
select d.dbid, d.classid::regclass::text as catalog, d.objid, d.objsubid, d.deptype,
  pg_catalog.pg_get_userbyid(d.refobjid) as role
from pg_catalog.pg_shdepend d where d.refclassid = 'pg_catalog.pg_authid'::regclass
  and d.refobjid in (select oid from pg_catalog.pg_roles where rolname in
    ('wz_core_registry_owner', 'wz_core_writer_owner', 'wz_core_audit_owner', 'wz_core_executor'))
order by role, d.dbid, catalog, d.objid;
