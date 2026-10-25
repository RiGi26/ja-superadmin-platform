-- LOCAL PROPOSAL ONLY: RECOVERY_IDENTITY_ONLY. NOT APPROVED FOR EXECUTION.
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
    FROM observation_02 q)
  ) AS groups
),
report AS MATERIALIZED (
  SELECT jsonb_build_object(
    'format', 'H1G1_PHASE1_SINGLE_RESULT_V1_RECOVERY_IDENTITY_ONLY',
    'source_sql_sha256', '0418387c5a1c047d1ef04e56efb5f3ea6915a3ddda9fe36fde64f8effcdcc51e',
    'expected_group_count', 2,
    'observed_group_count', jsonb_array_length(groups),
    'cardinality_ok', jsonb_array_length(groups) = 2 AND NOT EXISTS (
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
