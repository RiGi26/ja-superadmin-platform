-- LOCAL PROPOSAL ONLY: PRIMARY. NOT APPROVED FOR EXECUTION.
-- Independent review and fresh exact Owner authorization are required.
-- Target, principal and existing connection must be verified outside SQL first.
-- Original observation source SHA-256: 0418387c5a1c047d1ef04e56efb5f3ea6915a3ddda9fe36fde64f8effcdcc51e
-- Original SELECT text is unchanged; one statement changes snapshot/timing bounds.
-- No query text, function source export, credentials or customer rows are added.
-- Capture the complete raw result row; visible cells alone are insufficient.
BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

WITH
observation_01 AS MATERIALIZED (
SELECT current_database() AS database_name, current_user AS effective_role,
  session_user AS login_role, pg_backend_pid() AS backend_pid,
  current_setting('server_version') AS server_version,
  current_setting('transaction_isolation') AS validation_transaction_isolation,
  current_setting('default_transaction_isolation') AS connection_default_isolation,
  current_setting('default_transaction_read_only') AS connection_default_read_only,
  pg_is_in_recovery() AS is_replica,
  has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public,
  has_schema_privilege(current_user, 'core_registry_private', 'USAGE') AS can_use_private_schema,
  has_language_privilege(current_user, 'plpgsql', 'USAGE') AS can_use_plpgsql
),
observation_02 AS MATERIALIZED (
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = current_user
),
observation_03 AS MATERIALIZED (
SELECT count(*) AS settings_rows, bool_and(singleton AND NOT runtime_enabled) AS runtime_is_disabled
FROM core_registry_private.settings
),
observation_04 AS MATERIALIZED (
SELECT pid, usename, backend_type, state, xact_start, wait_event_type, wait_event
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid()
ORDER BY pid
),
observation_05 AS MATERIALIZED (
SELECT l.pid, l.granted, l.mode
FROM pg_locks l
WHERE l.locktype = 'advisory' AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND l.objsubid = 1
  AND l.classid = ((hashtextextended('core_registry_writes', 0) >> 32) & 4294967295)::oid
  AND l.objid = (hashtextextended('core_registry_writes', 0) & 4294967295)::oid
),
observation_06 AS MATERIALIZED (
SELECT count(*) AS prepared_transactions FROM pg_prepared_xacts WHERE database = current_database()
),
observation_07 AS MATERIALIZED (
SELECT r.rolname, s.setdatabase, c.isolation_setting
FROM pg_db_role_setting s LEFT JOIN pg_roles r ON r.oid = s.setrole
CROSS JOIN LATERAL unnest(s.setconfig) AS c(isolation_setting)
WHERE (s.setdatabase = 0 OR s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database()))
  AND (s.setrole = 0 OR r.rolname IN ('postgres','authenticator','service_role'))
  AND (c.isolation_setting LIKE 'default_transaction_isolation=%' OR c.isolation_setting LIKE 'transaction_isolation=%')
),
observation_08 AS MATERIALIZED (
SELECT e.evtname, e.evtevent, e.evtenabled, e.evttags, e.evtfoid::regprocedure AS handler,
  md5(pg_get_functiondef(e.evtfoid)) AS handler_definition_md5
FROM pg_event_trigger e
WHERE e.evtenabled <> 'D' AND (e.evttags IS NULL OR 'CREATE FUNCTION' = ANY(e.evttags))
ORDER BY e.evtname
),
observation_09 AS MATERIALIZED (
SELECT to_jsonb(p) - 'prosrc' AS preserved_function_metadata,
  obj_description(p.oid, 'pg_proc') AS preserved_comment,
  (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text), '[]'::jsonb)
    FROM pg_depend d WHERE (d.classid = 'pg_proc'::regclass AND d.objid = p.oid)
       OR (d.refclassid = 'pg_proc'::regclass AND d.refobjid = p.oid)) AS dependencies,
  (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text), '[]'::jsonb)
    FROM pg_shdepend d WHERE d.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND d.classid = 'pg_proc'::regclass AND d.objid = p.oid) AS shared_dependencies,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc p
WHERE p.oid = to_regprocedure('public.core_registry_mutate(uuid,uuid,timestamp with time zone,uuid,text,jsonb,uuid[])')
),
observation_groups AS MATERIALIZED (
  SELECT jsonb_build_array(
    (SELECT jsonb_build_object(
      'id', '01_connection_identity',
      'expected_min_rows', 1, 'expected_max_rows', 1,
      'row_count', count(*), 'cardinality_ok', count(*) = 1,
      'rows', COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb))
    FROM observation_01 q),
    (SELECT jsonb_build_object(
      'id', '02_role_capabilities',
      'expected_min_rows', 1, 'expected_max_rows', 1,
      'row_count', count(*), 'cardinality_ok', count(*) = 1,
      'rows', COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb))
    FROM observation_02 q),
    (SELECT jsonb_build_object(
      'id', '03_runtime_disabled_singleton',
      'expected_min_rows', 1, 'expected_max_rows', 1,
      'row_count', count(*), 'cardinality_ok', count(*) = 1,
      'rows', COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb))
    FROM observation_03 q),
    (SELECT jsonb_build_object(
      'id', '04_other_database_sessions',
      'expected_min_rows', 0, 'expected_max_rows', NULL::integer,
      'row_count', count(*), 'cardinality_ok', count(*) >= 0,
      'rows', COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.pid), '[]'::jsonb))
    FROM observation_04 q),
    (SELECT jsonb_build_object(
      'id', '05_registry_advisory_fence',
      'expected_min_rows', 0, 'expected_max_rows', NULL::integer,
      'row_count', count(*), 'cardinality_ok', count(*) >= 0,
      'rows', COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb))
    FROM observation_05 q),
    (SELECT jsonb_build_object(
      'id', '06_prepared_transactions',
      'expected_min_rows', 1, 'expected_max_rows', 1,
      'row_count', count(*), 'cardinality_ok', count(*) = 1,
      'rows', COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb))
    FROM observation_06 q),
    (SELECT jsonb_build_object(
      'id', '07_caller_isolation_settings',
      'expected_min_rows', 0, 'expected_max_rows', NULL::integer,
      'row_count', count(*), 'cardinality_ok', count(*) >= 0,
      'rows', COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb))
    FROM observation_07 q),
    (SELECT jsonb_build_object(
      'id', '08_applicable_event_triggers',
      'expected_min_rows', 0, 'expected_max_rows', NULL::integer,
      'row_count', count(*), 'cardinality_ok', count(*) >= 0,
      'rows', COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.evtname), '[]'::jsonb))
    FROM observation_08 q),
    (SELECT jsonb_build_object(
      'id', '09_mutation_metadata_acl_dependencies',
      'expected_min_rows', 1, 'expected_max_rows', 1,
      'row_count', count(*), 'cardinality_ok', count(*) = 1,
      'rows', COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb))
    FROM observation_09 q)
  ) AS groups
),
report AS MATERIALIZED (
  SELECT jsonb_build_object(
    'format', 'H1G1_PHASE1_SINGLE_RESULT_V1_PRIMARY',
    'source_sql_sha256', '0418387c5a1c047d1ef04e56efb5f3ea6915a3ddda9fe36fde64f8effcdcc51e',
    'expected_group_count', 9,
    'observed_group_count', jsonb_array_length(groups),
    'cardinality_ok', jsonb_array_length(groups) = 9 AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(groups) AS g(value)
      WHERE (g.value ->> 'cardinality_ok')::boolean IS NOT TRUE),
    'observations', groups) AS payload
  FROM observation_groups
),
serialized AS MATERIALIZED (
  SELECT payload::text AS report_json,
    (payload ->> 'observed_group_count')::integer AS group_count,
    (payload ->> 'cardinality_ok')::boolean AS cardinality_ok
  FROM report
)
SELECT report_json,
  octet_length(convert_to(report_json, 'UTF8')) AS report_utf8_bytes,
  encode(sha256(convert_to(report_json, 'UTF8')), 'hex') AS report_sha256,
  group_count, cardinality_ok
FROM serialized;
ROLLBACK;
-- STOP. No PHASE 2, correction, recovery DDL or subsequent execution is included.
