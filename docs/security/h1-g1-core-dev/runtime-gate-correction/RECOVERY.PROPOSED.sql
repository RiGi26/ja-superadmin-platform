-- EMERGENCY RECOVERY PROPOSAL ONLY. Separate explicit recovery authority required.
-- Restores a KNOWN-VULNERABLE baseline. Keep runtime disabled and all writers
-- quiesced throughout and afterwards. Never use this as a runtime repair or enablement.
-- Future target: webzoka-core-dev / mcvekinhgcqygfddyifs. Never Production.
-- Read REVIEW.md first. Source bytes are reconciled offline; external target proof,
-- writer/DDL quiescence, provider preflight and an independently verified recovery
-- connection remain mandatory.
-- Run only through one reviewed, stop-on-error, persistent transaction connection.
-- No project identity is inferred from current_database() or the function hash.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL check_function_bodies = on;

DO $h1g1_gate_recovery$
DECLARE
  target oid := pg_catalog.to_regprocedure('public.core_registry_mutate(uuid,uuid,timestamp with time zone,uuid,text,jsonb,uuid[])');
  expected_baseline_md5 constant text := '8a03a9deaae8e64d86cdeb49c74be6b2';
  expected_baseline_sha256 constant text := '9185872def4078ab4d16bb3545faa9d09476d91c959edae49065a4b1be49cd81';
  expected_corrected_md5 constant text := '9b729d11fa7405b257e68c2901e86d54';
  expected_corrected_sha256 constant text := '7ed7cf8d3d9a5299878ce1be948653e96667eede87b939002b376decf224577e';
  anchor constant text := $anchor$PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0));$anchor$;
  addition constant text := $addition$
  IF NOT EXISTS (SELECT 1 FROM core_registry_private.settings WHERE singleton AND runtime_enabled) THEN
    RAISE EXCEPTION 'RUNTIME_DISABLED_AFTER_WAIT';
  END IF;$addition$;
  fence bigint := pg_catalog.hashtextextended('core_registry_writes', 0);
  before_definition text;
  after_definition text;
  before_metadata jsonb;
  after_metadata jsonb;
  settings_rows bigint;
  disabled boolean;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
     OR pg_catalog.current_database() <> 'postgres'
     OR pg_catalog.pg_is_in_recovery()
     OR pg_catalog.current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
     OR pg_catalog.current_setting('transaction_isolation') <> 'read committed'
     OR NOT pg_catalog.has_schema_privilege(current_user, 'public', 'CREATE')
     OR NOT pg_catalog.has_language_privilege(current_user, 'plpgsql', 'USAGE')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolbypassrls)
     OR target IS NULL THEN
    RAISE EXCEPTION 'STOP: target, owner connection, PostgreSQL version or transaction precondition';
  END IF;
  IF NOT pg_catalog.pg_try_advisory_xact_lock(fence) THEN
    RAISE EXCEPTION 'STOP: writer fence busy; do not queue or terminate sessions';
  END IF;
  LOCK TABLE core_registry_private.settings IN SHARE MODE NOWAIT;
  SELECT count(*), bool_and(singleton AND NOT runtime_enabled)
    INTO settings_rows, disabled FROM core_registry_private.settings;
  IF settings_rows <> 1 OR disabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'STOP: database runtime must already be disabled; this script never changes it';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity
      WHERE datname = pg_catalog.current_database() AND pid <> pg_catalog.pg_backend_pid()
        AND backend_type = 'client backend' AND state IS DISTINCT FROM 'idle')
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_prepared_xacts WHERE database = pg_catalog.current_database())
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_locks
       WHERE locktype = 'advisory' AND database = (SELECT oid FROM pg_catalog.pg_database WHERE datname = pg_catalog.current_database())
         AND pid IS DISTINCT FROM pg_catalog.pg_backend_pid() AND objsubid = 1
         AND classid = ((fence >> 32) & 4294967295)::oid AND objid = (fence & 4294967295)::oid) THEN
    RAISE EXCEPTION 'STOP: another transaction, invisible session, prepared transaction or queued writer';
  END IF;
  -- Supplementary observations only: external ingress/job/custodian/DDL quiescence
  -- must be established before this transaction and retained through verification.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger
    WHERE evtenabled <> 'D' AND (evttags IS NULL OR 'CREATE FUNCTION' = ANY(evttags))) THEN
    RAISE EXCEPTION 'STOP: applicable provider DDL event trigger requires separate source review';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = target AND p.proowner = 'postgres'::regrole AND p.prosecdef
      AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
      AND p.prokind = 'f' AND p.prorettype = 'jsonb'::regtype AND NOT p.proretset
      AND p.provolatile = 'v' AND NOT p.proisstrict AND p.pronargdefaults = 1
      AND p.proargnames = ARRAY['p_actor','p_session','p_auth_until','p_command','p_action','p_payload','p_verified_subjects']
      AND p.proconfig @> ARRAY['search_path=""','row_security=on','lock_timeout=3s','statement_timeout=10s']
      AND pg_catalog.cardinality(p.proconfig) = 4)
     OR pg_catalog.has_function_privilege('anon', target, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', target, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', target, 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p,
       LATERAL pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
       WHERE p.oid = target AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
    RAISE EXCEPTION 'STOP: function identity, security, configuration or privilege drift';
  END IF;
  IF pg_catalog.md5(pg_catalog.pg_get_functiondef('public.core_registry_authorize(uuid,boolean)'::regprocedure))
       <> 'd9e8e3346f82538a9dd60c840d1a70b0'
     OR pg_catalog.md5(pg_catalog.pg_get_functiondef('public.core_registry_owner_claim_context(uuid,uuid)'::regprocedure))
       <> '3928f57a8ba163818540ee441a8983e6' THEN
    RAISE EXCEPTION 'STOP: companion RPC source drift';
  END IF;

  before_definition := pg_catalog.pg_get_functiondef(target);
  IF pg_catalog.md5(before_definition) <> expected_corrected_md5
     OR pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(before_definition, 'UTF8')), 'hex') <> expected_corrected_sha256
     OR (length(before_definition) - length(replace(before_definition, anchor, ''))) / length(anchor) <> 1
     OR (length(before_definition) - length(replace(before_definition, anchor || addition, ''))) / length(anchor || addition) <> 1 THEN
    RAISE EXCEPTION 'STOP: recovery requires exactly the reviewed correction at its advisory anchor';
  END IF;
  after_definition := pg_catalog.replace(before_definition, anchor || addition, anchor);
  IF pg_catalog.md5(after_definition) <> expected_baseline_md5
     OR pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(after_definition, 'UTF8')), 'hex') <> expected_baseline_sha256 THEN
    RAISE EXCEPTION 'STOP: recovery would not restore the exact accepted baseline';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'proc', pg_catalog.to_jsonb(p) - 'prosrc',
    'dependencies', (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text), '[]'::jsonb)
      FROM pg_catalog.pg_depend d WHERE (d.classid = 'pg_proc'::regclass AND d.objid = target)
         OR (d.refclassid = 'pg_proc'::regclass AND d.refobjid = target)),
    'shared_dependencies', (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text), '[]'::jsonb)
      FROM pg_catalog.pg_shdepend d WHERE d.dbid = (SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database())
        AND d.classid = 'pg_proc'::regclass AND d.objid = target),
    'comment', pg_catalog.obj_description(target, 'pg_proc'))
    INTO STRICT before_metadata FROM pg_catalog.pg_proc p WHERE p.oid = target;

  -- The sole persistent change: re-render the accepted installed definition with
  -- only that guard removed, under continued containment. Never DROP, GRANT or ALTER OWNER.
  EXECUTE after_definition;

  SELECT pg_catalog.jsonb_build_object(
    'proc', pg_catalog.to_jsonb(p) - 'prosrc',
    'dependencies', (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text), '[]'::jsonb)
      FROM pg_catalog.pg_depend d WHERE (d.classid = 'pg_proc'::regclass AND d.objid = target)
         OR (d.refclassid = 'pg_proc'::regclass AND d.refobjid = target)),
    'shared_dependencies', (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text), '[]'::jsonb)
      FROM pg_catalog.pg_shdepend d WHERE d.dbid = (SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database())
        AND d.classid = 'pg_proc'::regclass AND d.objid = target),
    'comment', pg_catalog.obj_description(target, 'pg_proc'))
    INTO STRICT after_metadata FROM pg_catalog.pg_proc p WHERE p.oid = target;
  IF after_metadata IS DISTINCT FROM before_metadata
     OR pg_catalog.pg_get_functiondef(target) IS DISTINCT FROM after_definition THEN
    RAISE EXCEPTION 'STOP: replacement changed metadata/dependencies or unexpected function bytes';
  END IF;
  RAISE NOTICE 'H1G1_GATE_RECOVERY pending COMMIT: OID=%, before_md5=%, before_sha256=%, after_md5=%, after_sha256=%',
    target, pg_catalog.md5(before_definition),
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(before_definition, 'UTF8')), 'hex'),
    pg_catalog.md5(after_definition),
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(after_definition, 'UTF8')), 'hex');
END
$h1g1_gate_recovery$;

-- A NOTICE is not commit evidence. Keep external writer/DDL containment in place.
-- Any error: stop client execution and ROLLBACK the same backend; never skip guards.
COMMIT;
