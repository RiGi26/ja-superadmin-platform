-- LOCAL PROPOSAL ONLY. NO authority to execute even these SELECTs in existing DEV.
-- Future target must first be proved outside SQL: webzoka-core-dev /
-- mcvekinhgcqygfddyifs, owner-verified endpoint and TLS, existing access only.
-- Capture results locally. Do not collect connection secrets or customer rows.
-- PHASE 1 BEGIN: provider observations only. This is the next requested scope.
BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

-- Database name and fingerprints are drift checks, not cloud project identity.
SELECT current_database() AS database_name, current_user AS effective_role,
  session_user AS login_role, pg_backend_pid() AS backend_pid,
  current_setting('server_version') AS server_version,
  current_setting('transaction_isolation') AS validation_transaction_isolation,
  current_setting('default_transaction_isolation') AS connection_default_isolation,
  current_setting('default_transaction_read_only') AS connection_default_read_only,
  pg_is_in_recovery() AS is_replica,
  has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public,
  has_schema_privilege(current_user, 'core_registry_private', 'USAGE') AS can_use_private_schema,
  has_language_privilege(current_user, 'plpgsql', 'USAGE') AS can_use_plpgsql;
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = current_user;

SELECT count(*) AS settings_rows, bool_and(singleton AND NOT runtime_enabled) AS runtime_is_disabled
FROM core_registry_private.settings;

-- No query text: it could contain unrelated values. NULL/hidden state is a STOP.
SELECT pid, usename, backend_type, state, xact_start, wait_event_type, wait_event
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid()
ORDER BY pid;

SELECT l.pid, l.granted, l.mode
FROM pg_locks l
WHERE l.locktype = 'advisory' AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND l.objsubid = 1
  AND l.classid = ((hashtextextended('core_registry_writes', 0) >> 32) & 4294967295)::oid
  AND l.objid = (hashtextextended('core_registry_writes', 0) & 4294967295)::oid;
SELECT count(*) AS prepared_transactions FROM pg_prepared_xacts WHERE database = current_database();

-- Config evidence cannot prove every direct caller's actual transaction mode.
SELECT r.rolname, s.setdatabase, c.isolation_setting
FROM pg_db_role_setting s LEFT JOIN pg_roles r ON r.oid = s.setrole
CROSS JOIN LATERAL unnest(s.setconfig) AS c(isolation_setting)
WHERE (s.setdatabase = 0 OR s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database()))
  AND (s.setrole = 0 OR r.rolname IN ('postgres','authenticator','service_role'))
  AND (c.isolation_setting LIKE 'default_transaction_isolation=%' OR c.isolation_setting LIKE 'transaction_isolation=%');

-- Any applicable enabled DDL event trigger blocks PATCH/RECOVERY as currently written.
-- Review provider trigger source separately before proposing any explicit exception.
SELECT e.evtname, e.evtevent, e.evtenabled, e.evttags, e.evtfoid::regprocedure AS handler,
  md5(pg_get_functiondef(e.evtfoid)) AS handler_definition_md5
FROM pg_event_trigger e
WHERE e.evtenabled <> 'D' AND (e.evttags IS NULL OR 'CREATE FUNCTION' = ANY(e.evttags))
ORDER BY e.evtname;

-- Snapshot for independent post-COMMIT comparison, without creating backup tables.
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
WHERE p.oid = to_regprocedure('public.core_registry_mutate(uuid,uuid,timestamp with time zone,uuid,text,jsonb,uuid[])');
ROLLBACK;
-- PHASE 1 END. Stop here under any provider-preflight-only approval.

-- PHASE 2 BEGIN: future outcome fingerprints, NOT part of the next requested scope.
-- Run only under a separate exact write-and-verification or outcome-diagnosis approval.
-- Reuse PHASE 1's gate/metadata queries for post-COMMIT comparison only if also authorized.
-- Exact definitions are already recovered; no source text is exported here either.
BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

SELECT p.oid, p.oid::regprocedure AS identity,
  md5(pg_get_functiondef(p.oid)) AS installed_definition_md5,
  encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') AS installed_definition_sha256,
  octet_length(convert_to(pg_get_functiondef(p.oid), 'UTF8')) AS definition_utf8_bytes,
  CASE encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex')
    WHEN '9185872def4078ab4d16bb3545faa9d09476d91c959edae49065a4b1be49cd81' THEN 'ACCEPTED_BASELINE'
    WHEN '7ed7cf8d3d9a5299878ce1be948653e96667eede87b939002b376decf224577e' THEN 'PROPOSED_CORRECTION'
    ELSE 'DRIFT_STOP' END AS definition_state
FROM pg_proc p
WHERE p.oid = to_regprocedure('public.core_registry_mutate(uuid,uuid,timestamp with time zone,uuid,text,jsonb,uuid[])');

SELECT p.oid::regprocedure AS companion_rpc, md5(pg_get_functiondef(p.oid)) AS definition_md5
FROM pg_proc p WHERE p.oid IN (
  to_regprocedure('public.core_registry_authorize(uuid,boolean)'),
  to_regprocedure('public.core_registry_owner_claim_context(uuid,uuid)'));
ROLLBACK;
-- PHASE 2 END.
