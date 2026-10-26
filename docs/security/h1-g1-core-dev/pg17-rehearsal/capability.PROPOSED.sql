-- NOT_EXECUTED. Review artifact only; never migration-discovered or auto-run.
-- Separate capability fixture. Does not load or modify guarded 001/002/004.
-- Only webzoka-core-dev mcvekinhgcqygfddyifs after exact future approval.
-- The fixed phase markers are consumed by runner.PROPOSED.mjs, not a SQL lexer.
-- @phase begin
BEGIN ISOLATION LEVEL READ COMMITTED;
-- @phase limits
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL transaction_timeout = '90s';
SET LOCAL createrole_self_grant = '';
-- @phase preconditions
DO $preconditions$
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
    OR current_database() <> 'postgres'
    OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR current_setting('server_encoding') <> 'UTF8'
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user
      AND rolcreaterole AND NOT rolsuper)
    OR NOT pg_catalog.has_database_privilege(current_user, current_database(), 'CREATE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname LIKE 'wz_h1g1_r17%'
      OR rolname IN ('wz_core_registry_owner','wz_core_writer_owner','wz_core_audit_owner','wz_core_executor'))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname IN ('wz_h1g1_r17','wz_core_private'))
    OR pg_catalog.to_regclass('public.companies') IS NOT NULL
    OR pg_catalog.to_regclass('public.company_memberships') IS NOT NULL
    OR pg_catalog.to_regclass('public.company_portal_instances') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'probe_preconditions_required';
  END IF;
END;
$preconditions$;
-- @phase roles
CREATE ROLE wz_h1g1_r17_registry NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE wz_h1g1_r17_audit NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE wz_h1g1_r17_writer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE wz_h1g1_r17_executor NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
-- @phase automatic_membership
SELECT r.rolname, g.rolname AS grantor, g.rolsuper AS grantor_is_superuser,
  a.admin_option, a.inherit_option, a.set_option
FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid = a.roleid
JOIN pg_catalog.pg_roles g ON g.oid = a.grantor
WHERE r.rolname LIKE 'wz_h1g1_r17%' ORDER BY r.rolname, g.rolname;
DO $automatic$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_auth_members a
    JOIN pg_catalog.pg_roles r ON r.oid = a.roleid
    JOIN pg_catalog.pg_roles g ON g.oid = a.grantor
    WHERE r.rolname LIKE 'wz_h1g1_r17%' AND a.member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = session_user)
      AND g.rolsuper AND a.admin_option AND NOT a.set_option AND NOT a.inherit_option) <> 4
    OR (SELECT count(*) FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r
      ON r.oid IN (a.roleid,a.member) WHERE r.rolname LIKE 'wz_h1g1_r17%') <> 4 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unexpected_automatic_membership';
  END IF;
END;
$automatic$;
-- @phase delegation_and_ownership
GRANT wz_h1g1_r17_registry, wz_h1g1_r17_audit, wz_h1g1_r17_writer, wz_h1g1_r17_executor
  TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres;
CREATE SCHEMA wz_h1g1_r17;
REVOKE ALL ON SCHEMA wz_h1g1_r17 FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, CREATE ON SCHEMA wz_h1g1_r17 TO wz_h1g1_r17_registry, wz_h1g1_r17_audit, wz_h1g1_r17_writer;
GRANT USAGE ON SCHEMA wz_h1g1_r17 TO wz_h1g1_r17_executor;
CREATE TABLE wz_h1g1_r17.registry_probe (id uuid PRIMARY KEY);
CREATE TABLE wz_h1g1_r17.audit_probe (id uuid PRIMARY KEY);
ALTER TABLE wz_h1g1_r17.registry_probe OWNER TO wz_h1g1_r17_registry;
ALTER TABLE wz_h1g1_r17.audit_probe OWNER TO wz_h1g1_r17_audit;
SET LOCAL ROLE wz_h1g1_r17_registry;
ALTER TABLE wz_h1g1_r17.registry_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE wz_h1g1_r17.registry_probe FORCE ROW LEVEL SECURITY;
REVOKE ALL ON wz_h1g1_r17.registry_probe FROM PUBLIC, anon, authenticated, service_role, wz_h1g1_r17_executor;
GRANT SELECT, INSERT ON wz_h1g1_r17.registry_probe TO wz_h1g1_r17_writer;
RESET ROLE;
SET LOCAL ROLE wz_h1g1_r17_audit;
ALTER TABLE wz_h1g1_r17.audit_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE wz_h1g1_r17.audit_probe FORCE ROW LEVEL SECURITY;
REVOKE ALL ON wz_h1g1_r17.audit_probe FROM PUBLIC, anon, authenticated, service_role, wz_h1g1_r17_executor;
GRANT SELECT, INSERT ON wz_h1g1_r17.audit_probe TO wz_h1g1_r17_writer;
RESET ROLE;
SET LOCAL ROLE wz_h1g1_r17_writer;
CREATE FUNCTION wz_h1g1_r17.refuse() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on
AS $refuse$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT';
END;
$refuse$;
REVOKE ALL ON FUNCTION wz_h1g1_r17.refuse() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION wz_h1g1_r17.refuse() TO wz_h1g1_r17_executor;
RESET ROLE;
REVOKE CREATE ON SCHEMA wz_h1g1_r17 FROM wz_h1g1_r17_registry, wz_h1g1_r17_audit, wz_h1g1_r17_writer;
-- @phase privilege_assertions
DO $privileges$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname LIKE 'wz_h1g1_r17%'
    AND (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
    OR (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'wz_h1g1_r17' AND c.relkind = 'r' AND c.relrowsecurity AND c.relforcerowsecurity
      AND ((c.relname = 'registry_probe' AND pg_catalog.pg_get_userbyid(c.relowner) = 'wz_h1g1_r17_registry')
        OR (c.relname = 'audit_probe' AND pg_catalog.pg_get_userbyid(c.relowner) = 'wz_h1g1_r17_audit'))) <> 2
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'wz_h1g1_r17' AND c.relkind = 'r'
      AND r.rolname IN ('anon','authenticated','service_role','wz_h1g1_r17_executor')
      AND (pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR pg_catalog.has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname LIKE 'wz_h1g1_r17%'
      AND pg_catalog.has_schema_privilege(r.oid,'wz_h1g1_r17','CREATE'))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'wz_h1g1_r17' AND r.rolname IN ('anon','authenticated','service_role')
      AND pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'probe_privilege_closure_failed';
  END IF;
END;
$privileges$;
-- @phase catalog
SELECT jsonb_build_object(
  'tables', (SELECT jsonb_agg(jsonb_build_object('name',c.relname,
    'owner',pg_catalog.pg_get_userbyid(c.relowner),'acl',c.relacl::text,
    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.relname)
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'wz_h1g1_r17' AND c.relkind = 'r'),
  'functions', (SELECT jsonb_agg(jsonb_build_object('name',p.proname,
    'owner',pg_catalog.pg_get_userbyid(p.proowner),'definer',p.prosecdef,
    'settings',p.proconfig,'acl',p.proacl::text) ORDER BY p.proname)
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'wz_h1g1_r17'),
  'memberships', (SELECT jsonb_agg(jsonb_build_object('role',r.rolname,
    'member',pg_catalog.pg_get_userbyid(a.member),'grantor',pg_catalog.pg_get_userbyid(a.grantor),
    'admin',a.admin_option,'set',a.set_option,'inherit',a.inherit_option) ORDER BY r.rolname,a.grantor)
    FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid = a.roleid
    WHERE r.rolname LIKE 'wz_h1g1_r17%')
) AS observed;
-- @phase denial
SET LOCAL ROLE wz_h1g1_r17_executor;
DO $negative$
BEGIN
  BEGIN
    PERFORM wz_h1g1_r17.refuse();
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'unexpected_writer_allow';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    IF SQLERRM <> 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT' THEN RAISE; END IF;
  END;
END;
$negative$;
RESET ROLE;
-- @phase revoke
REVOKE wz_h1g1_r17_registry, wz_h1g1_r17_audit, wz_h1g1_r17_writer, wz_h1g1_r17_executor
  FROM postgres GRANTED BY postgres RESTRICT;
-- @phase remaining_authority
SELECT r.rolname, g.rolname AS grantor, g.rolsuper AS grantor_is_superuser,
  a.admin_option, a.inherit_option, a.set_option,
  pg_catalog.pg_has_role(session_user,r.oid,'SET') AS effective_set,
  pg_catalog.pg_has_role(session_user,r.oid,'USAGE') AS effective_inherit
FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid = a.roleid
JOIN pg_catalog.pg_roles g ON g.oid = a.grantor
WHERE r.rolname LIKE 'wz_h1g1_r17%' ORDER BY r.rolname,g.rolname;
DO $remaining$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_auth_members a
    JOIN pg_catalog.pg_roles r ON r.oid = a.roleid JOIN pg_catalog.pg_roles g ON g.oid = a.grantor
    WHERE r.rolname LIKE 'wz_h1g1_r17%' AND g.rolsuper AND a.admin_option
      AND NOT a.inherit_option AND NOT a.set_option
      AND a.member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = session_user)) <> 4
    OR (SELECT count(*) FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r
      ON r.oid IN (a.roleid,a.member) WHERE r.rolname LIKE 'wz_h1g1_r17%') <> 4
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid = a.roleid
      WHERE r.rolname LIKE 'wz_h1g1_r17%' AND a.grantor = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = session_user))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname LIKE 'wz_h1g1_r17%'
      AND (pg_catalog.pg_has_role(session_user,r.oid,'SET') OR pg_catalog.pg_has_role(session_user,r.oid,'USAGE'))) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unexpected_post_revoke_authority';
  END IF;
  -- ADMIN remains a re-delegation power. This is NOT permanent role closure.
END;
$remaining$;
-- @phase rollback
ROLLBACK;
