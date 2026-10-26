-- PROPOSAL ONLY. Separate exact Owner authority required before execution.
-- Existing Core DEV mcvekinhgcqygfddyifs only. One rollback-only DDL attempt.
-- Creates only candidate E1 objects and one disabled settings row inside this transaction.
-- Native Registry tables receive transient triggers/locks; no existing data row is written.
-- No Auth fixture, RPC invocation, activation, migration ledger or extension change.
-- A separate approved READBACK.READ_ONLY.PROPOSED.sql call is required afterward.
BEGIN TRANSACTION READ WRITE;
SET LOCAL transaction_timeout = '30s';
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '10s';
SET LOCAL check_function_bodies = on;
DO $baseline$
DECLARE
  expected_baseline jsonb := $registry_baseline${"schemas":[{"acl":["postgres=UC/postgres"],"name":"core_registry_private","owner":"postgres"},{"acl":["pg_database_owner=UC/pg_database_owner","=U/pg_database_owner","postgres=U/pg_database_owner","anon=U/pg_database_owner","authenticated=U/pg_database_owner","service_role=U/pg_database_owner"],"name":"public","owner":"pg_database_owner"}],"tables":[{"acl":["postgres=arwdDxtm/postgres"],"rls":true,"kind":"r","name":"events","owner":"postgres","schema":"core_registry_private","columns":[{"acl":null,"name":"id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"company_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"actor_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"command_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"action","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"request_digest","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"result","type":"jsonb","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"canonical_payload","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"previous_hash","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"event_hash","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""}],"indexes":["CREATE UNIQUE INDEX events_actor_id_command_id_key ON core_registry_private.events USING btree (actor_id, command_id)","CREATE INDEX events_company ON core_registry_private.events USING btree (company_id)","CREATE UNIQUE INDEX events_pkey ON core_registry_private.events USING btree (id)"],"policies":null,"triggers":[{"name":"events_immutable","enabled":"O","definition":"CREATE TRIGGER events_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON core_registry_private.events FOR EACH STATEMENT EXECUTE FUNCTION core_registry_private.reject_audit_change()"}],"force_rls":true,"constraints":[{"name":"events_actor_id_command_id_key","definition":"UNIQUE (actor_id, command_id)"},{"name":"events_company_id_fkey","definition":"FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT"},{"name":"events_event_hash_check","definition":"CHECK (event_hash ~ '^[a-f0-9]{64}$'::text)"},{"name":"events_pkey","definition":"PRIMARY KEY (id)"},{"name":"events_previous_hash_check","definition":"CHECK (previous_hash ~ '^[a-f0-9]{64}$'::text)"},{"name":"events_request_digest_check","definition":"CHECK (request_digest ~ '^[a-f0-9]{64}$'::text)"}]},{"acl":["postgres=arwdDxtm/postgres"],"rls":true,"kind":"r","name":"operators","owner":"postgres","schema":"core_registry_private","columns":[{"acl":null,"name":"subject_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"active","type":"boolean","default":"false","identity":"","not_null":true,"generated":""},{"acl":null,"name":"valid_until","type":"timestamp with time zone","default":null,"identity":"","not_null":true,"generated":""}],"indexes":["CREATE UNIQUE INDEX operators_pkey ON core_registry_private.operators USING btree (subject_id)"],"policies":null,"triggers":null,"force_rls":true,"constraints":[{"name":"operators_pkey","definition":"PRIMARY KEY (subject_id)"}]},{"acl":["postgres=arwdDxtm/postgres"],"rls":true,"kind":"r","name":"owner_claims","owner":"postgres","schema":"core_registry_private","columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":""},{"acl":null,"name":"company_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"target_user_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"previous_owner_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"proposer_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"proposer_session_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"proposer_auth_until","type":"timestamp with time zone","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"proposal_command_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"proposal_digest","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"company_revision","type":"bigint","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"proof_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"proof_revision","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"case_kind","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"status","type":"text","default":"'pending'::text","identity":"","not_null":true,"generated":""},{"acl":null,"name":"approver_id","type":"uuid","default":null,"identity":"","not_null":false,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"acl":null,"name":"applied_at","type":"timestamp with time zone","default":null,"identity":"","not_null":false,"generated":""}],"indexes":["CREATE INDEX owner_claims_company ON core_registry_private.owner_claims USING btree (company_id)","CREATE UNIQUE INDEX owner_claims_pkey ON core_registry_private.owner_claims USING btree (id)","CREATE INDEX owner_claims_proof ON core_registry_private.owner_claims USING btree (proof_id)"],"policies":null,"triggers":null,"force_rls":true,"constraints":[{"name":"owner_claims_case_kind_check","definition":"CHECK (case_kind = ANY (ARRAY['legacy'::text, 'disputed'::text, 'takeover'::text, 'conflict'::text]))"},{"name":"owner_claims_check","definition":"CHECK (target_user_id <> proposer_id)"},{"name":"owner_claims_check1","definition":"CHECK ((status = 'applied'::text) = (approver_id IS NOT NULL AND applied_at IS NOT NULL))"},{"name":"owner_claims_check2","definition":"CHECK (approver_id IS NULL OR approver_id <> proposer_id AND approver_id <> target_user_id)"},{"name":"owner_claims_company_id_fkey","definition":"FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT"},{"name":"owner_claims_pkey","definition":"PRIMARY KEY (id)"},{"name":"owner_claims_proof_id_fkey","definition":"FOREIGN KEY (proof_id) REFERENCES core_registry_private.provenance(id) ON DELETE RESTRICT"},{"name":"owner_claims_proposal_digest_check","definition":"CHECK (proposal_digest ~ '^[a-f0-9]{64}$'::text)"},{"name":"owner_claims_status_check","definition":"CHECK (status = ANY (ARRAY['pending'::text, 'applied'::text]))"}]},{"acl":["postgres=arwdDxtm/postgres"],"rls":true,"kind":"r","name":"provenance","owner":"postgres","schema":"core_registry_private","columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":""},{"acl":null,"name":"subject_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"company_id","type":"uuid","default":null,"identity":"","not_null":false,"generated":""},{"acl":null,"name":"classification","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"revision","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"command_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"request_digest","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"coverage","type":"jsonb","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"evidence_ref","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"writer_fence_ref","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"verified_at","type":"timestamp with time zone","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"valid_until","type":"timestamp with time zone","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"consumed_at","type":"timestamp with time zone","default":null,"identity":"","not_null":false,"generated":""}],"indexes":["CREATE INDEX provenance_company ON core_registry_private.provenance USING btree (company_id)","CREATE UNIQUE INDEX provenance_pkey ON core_registry_private.provenance USING btree (id)","CREATE UNIQUE INDEX provenance_subject_id_command_id_key ON core_registry_private.provenance USING btree (subject_id, command_id)"],"policies":null,"triggers":null,"force_rls":true,"constraints":[{"name":"provenance_check","definition":"CHECK (valid_until > verified_at AND valid_until <= (verified_at + '00:00:30'::interval))"},{"name":"provenance_classification_check","definition":"CHECK (classification = ANY (ARRAY['clean'::text, 'legacy'::text, 'disputed'::text, 'takeover'::text, 'conflict'::text, 'unknown'::text]))"},{"name":"provenance_company_id_fkey","definition":"FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT"},{"name":"provenance_coverage_check","definition":"CHECK (jsonb_typeof(coverage) = 'object'::text)"},{"name":"provenance_evidence_ref_check","definition":"CHECK (length(evidence_ref) >= 1 AND length(evidence_ref) <= 200)"},{"name":"provenance_pkey","definition":"PRIMARY KEY (id)"},{"name":"provenance_request_digest_check","definition":"CHECK (request_digest ~ '^[a-f0-9]{64}$'::text)"},{"name":"provenance_subject_id_command_id_key","definition":"UNIQUE (subject_id, command_id)"},{"name":"provenance_writer_fence_ref_check","definition":"CHECK (length(writer_fence_ref) >= 1 AND length(writer_fence_ref) <= 200)"}]},{"acl":["postgres=arwdDxtm/postgres"],"rls":true,"kind":"r","name":"settings","owner":"postgres","schema":"core_registry_private","columns":[{"acl":null,"name":"singleton","type":"boolean","default":"true","identity":"","not_null":true,"generated":""},{"acl":null,"name":"runtime_enabled","type":"boolean","default":"false","identity":"","not_null":true,"generated":""}],"indexes":["CREATE UNIQUE INDEX settings_pkey ON core_registry_private.settings USING btree (singleton)"],"policies":null,"triggers":null,"force_rls":true,"constraints":[{"name":"settings_pkey","definition":"PRIMARY KEY (singleton)"},{"name":"settings_singleton_check","definition":"CHECK (singleton)"}]},{"acl":["postgres=arwdDxtm/postgres","authenticated=r/postgres"],"rls":true,"kind":"r","name":"companies","owner":"postgres","schema":"public","columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":""},{"acl":null,"name":"display_name","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"status","type":"text","default":"'active'::text","identity":"","not_null":true,"generated":""},{"acl":null,"name":"revision","type":"bigint","default":"0","identity":"","not_null":true,"generated":""},{"acl":null,"name":"audit_head","type":"text","default":"repeat('0'::text, 64)","identity":"","not_null":true,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"acl":null,"name":"retired_at","type":"timestamp with time zone","default":null,"identity":"","not_null":false,"generated":""}],"indexes":["CREATE UNIQUE INDEX companies_pkey ON public.companies USING btree (id)"],"policies":[{"name":"own_active_company","check":null,"roles":["authenticated"],"using":"((status = 'active'::text) AND (EXISTS ( SELECT 1\n   FROM company_memberships m\n  WHERE ((m.company_id = companies.id) AND (m.core_auth_user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text)))))","command":"r","permissive":true}],"triggers":null,"force_rls":true,"constraints":[{"name":"companies_audit_head_check","definition":"CHECK (audit_head ~ '^[a-f0-9]{64}$'::text)"},{"name":"companies_check","definition":"CHECK ((status = 'retired'::text) = (retired_at IS NOT NULL))"},{"name":"companies_display_name_check","definition":"CHECK (display_name = btrim(display_name) AND length(display_name) >= 2 AND length(display_name) <= 100)"},{"name":"companies_pkey","definition":"PRIMARY KEY (id)"},{"name":"companies_revision_check","definition":"CHECK (revision >= 0 AND revision <= '9007199254740991'::bigint)"},{"name":"companies_status_check","definition":"CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'retired'::text]))"}]},{"acl":["postgres=arwdDxtm/postgres","authenticated=r/postgres"],"rls":true,"kind":"r","name":"company_memberships","owner":"postgres","schema":"public","columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":""},{"acl":null,"name":"company_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"core_auth_user_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"role","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"status","type":"text","default":"'active'::text","identity":"","not_null":true,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"acl":null,"name":"revoked_at","type":"timestamp with time zone","default":null,"identity":"","not_null":false,"generated":""}],"indexes":["CREATE INDEX company_memberships_company ON public.company_memberships USING btree (company_id)","CREATE UNIQUE INDEX company_memberships_id_company_id_core_auth_user_id_key ON public.company_memberships USING btree (id, company_id, core_auth_user_id)","CREATE UNIQUE INDEX company_memberships_one_active_user ON public.company_memberships USING btree (core_auth_user_id) WHERE (status = 'active'::text)","CREATE UNIQUE INDEX company_memberships_pkey ON public.company_memberships USING btree (id)"],"policies":[{"name":"own_active_membership","check":null,"roles":["authenticated"],"using":"((core_auth_user_id = ( SELECT auth.uid() AS uid)) AND (status = 'active'::text))","command":"r","permissive":true}],"triggers":null,"force_rls":true,"constraints":[{"name":"company_memberships_check","definition":"CHECK ((status = 'revoked'::text) = (revoked_at IS NOT NULL))"},{"name":"company_memberships_company_id_fkey","definition":"FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT"},{"name":"company_memberships_id_company_id_core_auth_user_id_key","definition":"UNIQUE (id, company_id, core_auth_user_id)"},{"name":"company_memberships_pkey","definition":"PRIMARY KEY (id)"},{"name":"company_memberships_role_check","definition":"CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]))"},{"name":"company_memberships_status_check","definition":"CHECK (status = ANY (ARRAY['active'::text, 'revoked'::text]))"}]},{"acl":["postgres=arwdDxtm/postgres","authenticated=r/postgres"],"rls":true,"kind":"r","name":"company_portal_instances","owner":"postgres","schema":"public","columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":""},{"acl":null,"name":"company_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"portal_type","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"acl":null,"name":"lifecycle_status","type":"text","default":"'reserved'::text","identity":"","not_null":true,"generated":""},{"acl":null,"name":"legacy_tenant_id","type":"uuid","default":null,"identity":"","not_null":false,"generated":""},{"acl":null,"name":"portal_instance_id","type":"uuid","default":null,"identity":"","not_null":false,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""}],"indexes":["CREATE UNIQUE INDEX company_portal_instances_company_id_portal_type_key ON public.company_portal_instances USING btree (company_id, portal_type)","CREATE UNIQUE INDEX company_portal_instances_pkey ON public.company_portal_instances USING btree (id)"],"policies":[{"name":"own_company_portal","check":null,"roles":["authenticated"],"using":"(EXISTS ( SELECT 1\n   FROM companies c\n  WHERE ((c.id = company_portal_instances.company_id) AND (c.status = 'active'::text))))","command":"r","permissive":true}],"triggers":null,"force_rls":true,"constraints":[{"name":"company_portal_instances_company_id_fkey","definition":"FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT"},{"name":"company_portal_instances_company_id_portal_type_key","definition":"UNIQUE (company_id, portal_type)"},{"name":"company_portal_instances_legacy_tenant_id_check","definition":"CHECK (legacy_tenant_id IS NULL)"},{"name":"company_portal_instances_lifecycle_status_check","definition":"CHECK (lifecycle_status = 'reserved'::text)"},{"name":"company_portal_instances_pkey","definition":"PRIMARY KEY (id)"},{"name":"company_portal_instances_portal_instance_id_check","definition":"CHECK (portal_instance_id IS NULL)"},{"name":"company_portal_instances_portal_type_check","definition":"CHECK (portal_type = ANY (ARRAY['stock'::text, 'lms'::text, 'clinic'::text, 'laundry'::text, 'rental'::text, 'pharmacy'::text]))"}]}],"functions":[{"acl":["postgres=X/postgres"],"name":"append_event","owner":"postgres","config":["search_path=\"\""],"schema":"core_registry_private","signature":"p_company uuid, p_actor uuid, p_session uuid, p_command uuid, p_action text, p_digest text, p_before jsonb, p_after jsonb, p_evidence text, p_reviewers uuid[], p_claim uuid","security_definer":false,"definition_sha256":"e41d2d82ec1a634178b7250dfa8bef1b92dfea584d8c290df1162b52011d3857"},{"acl":["postgres=X/postgres"],"name":"proof_valid","owner":"postgres","config":["search_path=\"\""],"schema":"core_registry_private","signature":"p core_registry_private.provenance, clean boolean","security_definer":false,"definition_sha256":"6966365a3680948219da66bac9f6247f058a2d5471f324952dae2fde64710802"},{"acl":["postgres=X/postgres"],"name":"reject_audit_change","owner":"postgres","config":["search_path=\"\""],"schema":"core_registry_private","signature":"","security_definer":false,"definition_sha256":"f8be20a75100e99eb354b591ed4e7e25616fc15eaabc4bfcd9d9ae773403ac10"},{"acl":["postgres=X/postgres","authenticated=X/postgres"],"name":"core_registry_authorize","owner":"postgres","config":["search_path=\"\""],"schema":"public","signature":"p_company uuid, p_owner_only boolean","security_definer":false,"definition_sha256":"6b58b33e1bb42eab0797d8d500fb52cf91deef52045a5395ff40beefe3aa558b"},{"acl":["postgres=X/postgres","service_role=X/postgres"],"name":"core_registry_mutate","owner":"postgres","config":["search_path=\"\"","row_security=on","lock_timeout=3s","statement_timeout=10s"],"schema":"public","signature":"p_actor uuid, p_session uuid, p_auth_until timestamp with time zone, p_command uuid, p_action text, p_payload jsonb, p_verified_subjects uuid[]","security_definer":true,"definition_sha256":"9185872def4078ab4d16bb3545faa9d09476d91c959edae49065a4b1be49cd81"},{"acl":["postgres=X/postgres","service_role=X/postgres"],"name":"core_registry_owner_claim_context","owner":"postgres","config":["search_path=\"\"","row_security=on"],"schema":"public","signature":"p_actor uuid, p_claim uuid","security_definer":true,"definition_sha256":"01c29ee9f8181cc7ce7634aa9629550eb6dae41d514c7510185fcc4a5a1c14c5"}],"role_attributes":[{"name":"anon","login":false,"inherit":true,"superuser":false,"bypass_rls":false,"create_role":false},{"name":"authenticated","login":false,"inherit":true,"superuser":false,"bypass_rls":false,"create_role":false},{"name":"postgres","login":true,"inherit":true,"superuser":false,"bypass_rls":true,"create_role":true},{"name":"service_role","login":false,"inherit":true,"superuser":false,"bypass_rls":true,"create_role":false}]}$registry_baseline$::jsonb;
  actual_baseline jsonb;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
    OR pg_catalog.current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR pg_catalog.current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'E1_NATIVE_PROVIDER_BASELINE_REQUIRED';
  END IF;
  IF pg_catalog.to_regnamespace('core_e1_resource_private') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN
        ('core_registry_e1_stock_create', 'core_registry_e1_stock_context', 'core_registry_e1_stock_bind_stage')) THEN
    RAISE EXCEPTION 'E1_EXISTING_EXTENSION_REQUIRES_RECONCILIATION';
  END IF;
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0)) THEN
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'E1_NATIVE_REGISTRY_BUSY';
  END IF;
  LOCK TABLE public.companies, public.company_memberships, public.company_portal_instances,
    core_registry_private.settings, core_registry_private.operators, core_registry_private.provenance,
    core_registry_private.owner_claims, core_registry_private.events IN ACCESS EXCLUSIVE MODE NOWAIT;

  WITH target_tables AS (
    SELECT c.oid, n.nspname, c.relname, c.relkind, c.relowner,
           c.relrowsecurity, c.relforcerowsecurity, c.relacl
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p') AND (
      (n.nspname = 'public' AND c.relname IN
        ('companies', 'company_memberships', 'company_portal_instances'))
      OR n.nspname = 'core_registry_private')
  ), target_functions AS (
    SELECT p.oid, n.nspname, p.proname, p.proowner, p.prosecdef, p.proacl, p.proconfig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind = 'f' AND (
      n.nspname = 'core_registry_private'
      OR (n.nspname = 'public' AND pg_catalog.left(p.proname, 14) = 'core_registry_')
      OR p.oid IN (SELECT t.tgfoid FROM pg_catalog.pg_trigger t
                  JOIN target_tables tt ON tt.oid = t.tgrelid WHERE NOT t.tgisinternal))
  )
  SELECT pg_catalog.jsonb_build_object(
    'schemas', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', n.nspname, 'owner', pg_catalog.pg_get_userbyid(n.nspowner), 'acl', n.nspacl)
      ORDER BY n.nspname) FROM pg_catalog.pg_namespace n
      WHERE n.nspname IN ('public', 'core_registry_private')),
    'tables', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema', tt.nspname, 'name', tt.relname, 'kind', tt.relkind,
      'owner', pg_catalog.pg_get_userbyid(tt.relowner), 'rls', tt.relrowsecurity,
      'force_rls', tt.relforcerowsecurity, 'acl', tt.relacl,
      'columns', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', a.attname, 'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
        'not_null', a.attnotnull, 'identity', a.attidentity, 'generated', a.attgenerated,
        'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid), 'acl', a.attacl)
        ORDER BY a.attnum) FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = tt.oid AND a.attnum > 0 AND NOT a.attisdropped),
      'constraints', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', c.conname, 'definition', pg_catalog.pg_get_constraintdef(c.oid, true))
        ORDER BY c.conname) FROM pg_catalog.pg_constraint c WHERE c.conrelid = tt.oid),
      'indexes', (SELECT pg_catalog.jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid)
        ORDER BY i.indexrelid::pg_catalog.regclass::text)
        FROM pg_catalog.pg_index i WHERE i.indrelid = tt.oid),
      'policies', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', p.polname, 'command', p.polcmd, 'permissive', p.polpermissive,
        'roles', (SELECT pg_catalog.jsonb_agg(
          CASE WHEN role_id = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(role_id) END
          ORDER BY ordinal) FROM pg_catalog.unnest(p.polroles) WITH ORDINALITY AS policy_roles(role_id, ordinal)), 'using', pg_catalog.pg_get_expr(p.polqual, p.polrelid),
        'check', pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) ORDER BY p.polname)
        FROM pg_catalog.pg_policy p WHERE p.polrelid = tt.oid),
      'triggers', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', t.tgname, 'enabled', t.tgenabled, 'definition', pg_catalog.pg_get_triggerdef(t.oid, true))
        ORDER BY t.tgname) FROM pg_catalog.pg_trigger t
        WHERE t.tgrelid = tt.oid AND NOT t.tgisinternal)) ORDER BY tt.nspname, tt.relname)
      FROM target_tables tt),
    'functions', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema', tf.nspname, 'name', tf.proname,
      'signature', pg_catalog.pg_get_function_identity_arguments(tf.oid),
      'owner', pg_catalog.pg_get_userbyid(tf.proowner), 'security_definer', tf.prosecdef,
      'acl', tf.proacl, 'config', tf.proconfig, 'definition_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(tf.oid), 'UTF8')), 'hex'))
      ORDER BY tf.nspname, tf.proname, tf.oid) FROM target_functions tf),
    'role_attributes', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', r.rolname, 'superuser', r.rolsuper, 'bypass_rls', r.rolbypassrls,
      'inherit', r.rolinherit, 'create_role', r.rolcreaterole, 'login', r.rolcanlogin)
      ORDER BY r.rolname) FROM pg_catalog.pg_roles r
      WHERE r.rolname IN ('postgres', 'anon', 'authenticated', 'service_role')
         OR r.oid IN (SELECT relowner FROM target_tables UNION SELECT proowner FROM target_functions))
  ) INTO actual_baseline;
  IF actual_baseline IS DISTINCT FROM expected_baseline THEN
    RAISE EXCEPTION 'E1_NATIVE_BASELINE_DRIFT';
  END IF;
END
$baseline$;

DO $provider_catalog$
DECLARE
  expected_catalog jsonb := $provider_baseline${"e1_schemas":[],"policy_roles":[{"roles":["authenticated"],"table":"companies","policy":"own_active_company","schema":"public"},{"roles":["authenticated"],"table":"company_memberships","policy":"own_active_membership","schema":"public"},{"roles":["authenticated"],"table":"company_portal_instances","policy":"own_company_portal","schema":"public"}],"event_triggers":[{"name":"issue_graphql_placeholder","tags":["DROP EXTENSION"],"event":"sql_drop","owner":"supabase_admin","enabled":"O","function_name":"set_graphql_placeholder","function_owner":"supabase_admin","function_config":["search_path=\"\""],"function_schema":"extensions","function_security_definer":false,"function_definition_sha256":"b0cadab880dc68f569b3e01057dc6f5acee9d05e122de6f4256130ae330bbcec"},{"name":"issue_pg_cron_access","tags":["CREATE EXTENSION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function_name":"grant_pg_cron_access","function_owner":"supabase_admin","function_config":["search_path=\"\""],"function_schema":"extensions","function_security_definer":false,"function_definition_sha256":"eb3fa2e82a0135bc04a6236f93331911861c91b45d72cba5d9c03c1be2c34b4c"},{"name":"issue_pg_graphql_access","tags":["CREATE EXTENSION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function_name":"grant_pg_graphql_access","function_owner":"supabase_admin","function_config":["search_path=\"\""],"function_schema":"extensions","function_security_definer":false,"function_definition_sha256":"9ec845adab4ba00bbf7740458b6c4461094697023f0f7adc693b373e2ea54f68"},{"name":"issue_pg_net_access","tags":["CREATE EXTENSION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function_name":"grant_pg_net_access","function_owner":"supabase_admin","function_config":["search_path=\"\""],"function_schema":"extensions","function_security_definer":false,"function_definition_sha256":"e38c4060751c9695123350596f1cb0d0c943015f3267a2a455d8efe02c711184"},{"name":"pgrst_ddl_watch","tags":null,"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function_name":"pgrst_ddl_watch","function_owner":"supabase_admin","function_config":["search_path=\"\""],"function_schema":"extensions","function_security_definer":false,"function_definition_sha256":"2b4b5d702ddf70fbd1a05c9825f9f9016d5c0ef97dd3df5f5b012ea23d9b94b1"},{"name":"pgrst_drop_watch","tags":null,"event":"sql_drop","owner":"supabase_admin","enabled":"O","function_name":"pgrst_drop_watch","function_owner":"supabase_admin","function_config":["search_path=\"\""],"function_schema":"extensions","function_security_definer":false,"function_definition_sha256":"3a2696133853e17a0456cbfbb233a03815f50895492143e84df983b558d76593"}],"e1_public_functions":[]}$provider_baseline$::jsonb;
  actual_catalog jsonb;
BEGIN
SELECT pg_catalog.jsonb_build_object(
  'policy_roles', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema', n.nspname, 'table', c.relname, 'policy', p.polname,
      'roles', (SELECT pg_catalog.jsonb_agg(CASE WHEN role_id = 0 THEN 'PUBLIC' ELSE r.rolname END ORDER BY ordinal)
        FROM pg_catalog.unnest(p.polroles) WITH ORDINALITY AS policy_roles(role_id, ordinal)
        LEFT JOIN pg_catalog.pg_roles r ON r.oid = role_id)
    ) ORDER BY n.nspname, c.relname, p.polname)
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('companies', 'company_memberships', 'company_portal_instances')
  ), '[]'::jsonb),
  'e1_schemas', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', n.nspname, 'owner', pg_catalog.pg_get_userbyid(n.nspowner)
    ) ORDER BY n.nspname)
    FROM pg_catalog.pg_namespace n
    WHERE n.nspname IN ('core_e1_resource_private', 'core_e1_stock_private')
  ), '[]'::jsonb),
  'e1_public_functions', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', p.proname, 'signature', pg_catalog.pg_get_function_identity_arguments(p.oid),
      'owner', pg_catalog.pg_get_userbyid(p.proowner),
      'definition_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(p.oid), 'UTF8')), 'hex')
    ) ORDER BY p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid))
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.proname IN ('core_registry_e1_stock_create', 'core_registry_e1_stock_context',
        'core_registry_e1_stock_bind_stage', 'core_registry_e1_stock_command')
  ), '[]'::jsonb),
  'event_triggers', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', e.evtname, 'event', e.evtevent, 'enabled', e.evtenabled,
      'owner', pg_catalog.pg_get_userbyid(e.evtowner), 'tags', e.evttags,
      'function_schema', n.nspname, 'function_name', p.proname,
      'function_owner', pg_catalog.pg_get_userbyid(p.proowner),
      'function_security_definer', p.prosecdef, 'function_config', p.proconfig,
      'function_definition_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(p.oid), 'UTF8')), 'hex')
    ) ORDER BY e.evtname)
    FROM pg_catalog.pg_event_trigger e
    JOIN pg_catalog.pg_proc p ON p.oid = e.evtfoid
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  ), '[]'::jsonb)
) INTO actual_catalog;
  IF actual_catalog IS DISTINCT FROM expected_catalog THEN
    RAISE EXCEPTION 'E1_PROVIDER_CATALOG_DRIFT';
  END IF;
END
$provider_catalog$;

CREATE SCHEMA core_e1_resource_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA core_e1_resource_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE core_e1_resource_private.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  stock_origin text CHECK (stock_origin ~ '^https://[a-z0-9]{20}[.]supabase[.]co$'
    AND stock_origin NOT IN ('https://oyyfcmlquqfrdoffkgsd.supabase.co', 'https://mcvekinhgcqygfddyifs.supabase.co',
      'https://hxhusfkrlafxdnyasmsu.supabase.co'))
);
INSERT INTO core_e1_resource_private.settings VALUES (true, false, NULL);
CREATE TABLE core_e1_resource_private.origins (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL UNIQUE,
  core_subject uuid NOT NULL UNIQUE,
  reservation_id uuid NOT NULL UNIQUE REFERENCES public.company_portal_instances(id) ON DELETE RESTRICT,
  core_tenant_id uuid NOT NULL UNIQUE,
  command_id uuid NOT NULL,
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  stock_origin text NOT NULL CHECK (stock_origin ~ '^https://[a-z0-9]{20}[.]supabase[.]co$'
    AND stock_origin NOT IN ('https://oyyfcmlquqfrdoffkgsd.supabase.co', 'https://mcvekinhgcqygfddyifs.supabase.co',
      'https://hxhusfkrlafxdnyasmsu.supabase.co')),
  source text NOT NULL DEFAULT 'core.e1.resource.v1' CHECK (source = 'core.e1.resource.v1'),
  UNIQUE (core_subject, command_id),
  FOREIGN KEY (membership_id, company_id, core_subject)
    REFERENCES public.company_memberships(id, company_id, core_auth_user_id) ON DELETE RESTRICT
);
ALTER TABLE core_e1_resource_private.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_e1_resource_private.settings FORCE ROW LEVEL SECURITY;
ALTER TABLE core_e1_resource_private.origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_e1_resource_private.origins FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA core_e1_resource_private FROM PUBLIC, anon, authenticated, service_role;

-- The reciprocal mapping is also append-only. A different command/account may
-- never overwrite the first staged tuple, even after an uncertain response.
CREATE TABLE core_e1_resource_private.stock_bindings (
  reservation_id uuid PRIMARY KEY REFERENCES core_e1_resource_private.origins(reservation_id) ON DELETE RESTRICT,
  stock_tenant_id uuid NOT NULL UNIQUE, stock_subject uuid NOT NULL UNIQUE,
  profile_id uuid NOT NULL UNIQUE, stock_audit_event_id uuid NOT NULL UNIQUE,
  command_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE core_e1_resource_private.stock_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_e1_resource_private.stock_bindings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON core_e1_resource_private.stock_bindings FROM PUBLIC, anon, authenticated, service_role;

-- An origin is a birth record, never an editable claim or a reusable capability.
CREATE FUNCTION core_e1_resource_private.immutable_origin() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN RAISE EXCEPTION 'E1_ORIGIN_IMMUTABLE'; END
$fn$;
CREATE TRIGGER e1_origin_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON core_e1_resource_private.origins FOR EACH STATEMENT
  EXECUTE FUNCTION core_e1_resource_private.immutable_origin();
CREATE TRIGGER e1_binding_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON core_e1_resource_private.stock_bindings FOR EACH STATEMENT
  EXECUTE FUNCTION core_e1_resource_private.immutable_origin();

-- Reuse the native Registry fence, enforced for relevant tables even when a
-- writer forgets to take it. This is NOT a fence over unrelated legacy systems.
CREATE FUNCTION core_e1_resource_private.lock_registry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0)) THEN
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'E1_BUSY_REAUTHENTICATE';
  END IF;
  IF TG_OP = 'TRUNCATE' AND EXISTS (SELECT 1 FROM core_e1_resource_private.origins) THEN
    RAISE EXCEPTION 'E1_PROTECTED_GRAPH';
  END IF;
  RETURN NULL;
END
$fn$;
CREATE TRIGGER e1_company_lock BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.companies
  FOR EACH STATEMENT EXECUTE FUNCTION core_e1_resource_private.lock_registry();
CREATE TRIGGER e1_membership_lock BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.company_memberships
  FOR EACH STATEMENT EXECUTE FUNCTION core_e1_resource_private.lock_registry();
CREATE TRIGGER e1_instance_lock BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.company_portal_instances
  FOR EACH STATEMENT EXECUTE FUNCTION core_e1_resource_private.lock_registry();
CREATE TRIGGER e1_claim_lock BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON core_registry_private.owner_claims
  FOR EACH STATEMENT EXECUTE FUNCTION core_e1_resource_private.lock_registry();

CREATE FUNCTION core_e1_resource_private.guard_graph() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE prior jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  next_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  o core_e1_resource_private.origins%ROWTYPE;
BEGIN
  SELECT * INTO o FROM core_e1_resource_private.origins WHERE
    company_id IN ((prior->>'company_id')::uuid, (next_row->>'company_id')::uuid)
    OR (TG_TABLE_NAME = 'companies' AND company_id IN ((prior->>'id')::uuid, (next_row->>'id')::uuid))
    OR (TG_TABLE_NAME = 'company_memberships' AND core_subject IN
      ((prior->>'core_auth_user_id')::uuid, (next_row->>'core_auth_user_id')::uuid))
    OR (TG_TABLE_NAME = 'owner_claims' AND core_subject IN
      ((prior->>'target_user_id')::uuid, (next_row->>'target_user_id')::uuid)) LIMIT 1;
  IF FOUND THEN
    -- Native legacy claims/writes cannot adopt or reparent a protected graph.
    -- E2/E3 must use a separately validated two-operator path; no bypass here.
    IF TG_TABLE_NAME = 'owner_claims' THEN RAISE EXCEPTION 'E1_CLAIM_REQUIRES_SCOPED_RECOVERY'; END IF;
    IF TG_TABLE_NAME = 'companies' AND TG_OP = 'UPDATE'
      AND (next_row - 'audit_head') = (prior - 'audit_head')
      AND EXISTS (SELECT 1 FROM core_registry_private.events e WHERE e.company_id = o.company_id
        AND e.actor_id = o.core_subject AND e.previous_hash = prior->>'audit_head'
        AND e.event_hash = next_row->>'audit_head' AND e.action IN ('e1.stock.admit', 'e1.stock.stage', 'e1.stock.bind', 'e1.stock.checkout')) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'E1_PROTECTED_GRAPH';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER e1_company_guard BEFORE INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION core_e1_resource_private.guard_graph();
CREATE TRIGGER e1_membership_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION core_e1_resource_private.guard_graph();
CREATE TRIGGER e1_instance_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_portal_instances
  FOR EACH ROW EXECUTE FUNCTION core_e1_resource_private.guard_graph();
CREATE TRIGGER e1_claim_guard BEFORE INSERT OR UPDATE OR DELETE ON core_registry_private.owner_claims
  FOR EACH ROW EXECUTE FUNCTION core_e1_resource_private.guard_graph();

CREATE FUNCTION core_e1_resource_private.reservation_json(o core_e1_resource_private.origins)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
  SELECT jsonb_build_object('companyId', o.company_id, 'reservationId', o.reservation_id,
    'coreTenantId', o.core_tenant_id, 'coreSubject', o.core_subject, 'product', 'stock',
    'status', 'reserved', 'stockTenantId', NULL, 'stockSubject', NULL, 'profileId', NULL)
$fn$;

CREATE FUNCTION public.core_registry_e1_stock_create(p_actor uuid, p_session uuid,
  p_auth_until timestamptz, p_command uuid, p_company_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on
SET lock_timeout = '1ms' SET statement_timeout = '10s' AS $fn$
DECLARE o core_e1_resource_private.origins%ROWTYPE; fingerprint text; result jsonb; target_origin text;
  company uuid := gen_random_uuid(); membership uuid := gen_random_uuid(); instance uuid := gen_random_uuid();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_session IS NULL OR p_command IS NULL
    OR p_auth_until IS NULL OR p_auth_until <= clock_timestamp()
    OR p_auth_until > clock_timestamp() + interval '30 seconds'
    OR NOT EXISTS (SELECT 1 FROM core_e1_resource_private.settings WHERE singleton AND enabled AND stock_origin IS NOT NULL)
    OR p_company_name IS NULL OR length(p_company_name) NOT BETWEEN 2 AND 100
    OR p_company_name <> btrim(p_company_name) OR p_company_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'E1_DENIED';
  END IF;
  -- Never wait on the Registry fence with a prior Auth observation. A caller
  -- must reauthenticate before retrying this SAME idempotency key.
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0)) THEN
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'E1_BUSY_REAUTHENTICATE';
  END IF;
  IF p_auth_until <= clock_timestamp() THEN RAISE EXCEPTION 'AUTH_EXPIRED_AFTER_WAIT'; END IF;
  SELECT stock_origin INTO STRICT target_origin FROM core_e1_resource_private.settings
    WHERE singleton AND enabled AND stock_origin IS NOT NULL FOR SHARE NOWAIT;
  IF EXISTS (SELECT 1 FROM core_registry_private.operators WHERE subject_id = p_actor AND active) THEN
    RAISE EXCEPTION 'CUSTOMER_ONLY';
  END IF;
  fingerprint := encode(sha256(convert_to('e1.stock.admit:' ||
    jsonb_build_object('companyName', p_company_name, 'product', 'stock')::text, 'UTF8')), 'hex');
  SELECT * INTO o FROM core_e1_resource_private.origins WHERE core_subject = p_actor;
  IF FOUND THEN
    IF o.command_id <> p_command OR o.request_digest <> fingerprint THEN RAISE EXCEPTION 'E1_REPLAY_CONFLICT'; END IF;
    IF (SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id = p_actor) <> 1
      OR NOT EXISTS (SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id = m.company_id
        WHERE m.id = o.membership_id AND m.core_auth_user_id = p_actor AND m.company_id = o.company_id
        AND m.role = 'owner' AND m.status = 'active' AND c.status = 'active') THEN
      RAISE EXCEPTION 'CURRENT_OWNER_REQUIRED';
    END IF;
    SELECT e.result INTO STRICT result FROM core_registry_private.events e
      WHERE e.actor_id = p_actor AND e.command_id = p_command AND e.company_id = o.company_id
      AND e.action = 'e1.stock.admit' AND e.request_digest = fingerprint;
  ELSE
    IF EXISTS (SELECT 1 FROM public.company_memberships WHERE core_auth_user_id = p_actor)
      OR EXISTS (SELECT 1 FROM core_registry_private.owner_claims WHERE target_user_id = p_actor AND status = 'pending') THEN
      RAISE EXCEPTION 'EXISTING_OR_AMBIGUOUS_CANONICAL_COMPANY';
    END IF;
    INSERT INTO public.companies(id, display_name) VALUES (company, p_company_name);
    INSERT INTO public.company_memberships(id, company_id, core_auth_user_id, role)
      VALUES (membership, company, p_actor, 'owner');
    INSERT INTO public.company_portal_instances(id, company_id, portal_type) VALUES (instance, company, 'stock');
    INSERT INTO core_e1_resource_private.origins(company_id, membership_id, core_subject,
      reservation_id, core_tenant_id, command_id, request_digest, stock_origin)
      VALUES (company, membership, p_actor, instance, gen_random_uuid(), p_command, fingerprint, target_origin) RETURNING * INTO o;
    -- Existing native audit, in the SAME transaction. Failure rolls back everything.
    result := core_registry_private.append_event(company, p_actor, p_session, p_command, 'e1.stock.admit',
      fingerprint, 'null'::jsonb, core_e1_resource_private.reservation_json(o), instance::text, '{}', NULL);
  END IF;
  IF p_auth_until <= clock_timestamp() THEN RAISE EXCEPTION 'AUTH_EXPIRED_BEFORE_RETURN'; END IF;
  RETURN jsonb_build_object('reservation', core_e1_resource_private.reservation_json(o), 'receipt', result, 'modeledOnly', false);
END
$fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA core_e1_resource_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.core_registry_e1_stock_create(uuid, uuid, timestamptz, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_registry_e1_stock_create(uuid, uuid, timestamptz, uuid, text) TO service_role;

-- Read-only handoff context, using the actual customer's Core JWT. It supplies
-- only this new resource graph, never legacy tenants, invoices or a bearer grant.
CREATE FUNCTION public.core_registry_e1_stock_context(p_company uuid, p_reservation uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' SET row_security = on AS $fn$
  SELECT core_e1_resource_private.reservation_json(o) || jsonb_build_object('companyName', c.display_name,
    'stockOrigin', o.stock_origin, 'stockBinding', CASE WHEN b.reservation_id IS NULL THEN NULL ELSE
      jsonb_build_object('stockTenantId', b.stock_tenant_id, 'stockSubject', b.stock_subject,
        'profileId', b.profile_id, 'auditEventId', b.stock_audit_event_id, 'status', 'quarantined') END)
  FROM core_e1_resource_private.origins o JOIN public.companies c ON c.id = o.company_id
  JOIN public.company_memberships m ON m.id = o.membership_id
  JOIN public.company_portal_instances i ON i.id = o.reservation_id
  LEFT JOIN core_e1_resource_private.stock_bindings b ON b.reservation_id = o.reservation_id
  WHERE auth.role() = 'authenticated' AND o.core_subject = auth.uid()
    AND o.company_id = p_company AND o.reservation_id = p_reservation
    AND c.status = 'active' AND m.company_id = o.company_id AND m.core_auth_user_id = auth.uid()
    AND m.status = 'active' AND m.role = 'owner' AND i.company_id = o.company_id
    AND i.portal_type = 'stock' AND i.lifecycle_status = 'reserved'
    AND i.legacy_tenant_id IS NULL AND i.portal_instance_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM core_registry_private.operators WHERE subject_id = auth.uid() AND active)
    AND (SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id = auth.uid()) = 1
$fn$;
REVOKE ALL ON FUNCTION public.core_registry_e1_stock_context(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_registry_e1_stock_context(uuid, uuid) TO authenticated;

CREATE FUNCTION public.core_registry_e1_stock_bind_stage(p_actor uuid, p_session uuid, p_auth_until timestamptz,
  p_command uuid, p_company uuid, p_reservation uuid, p_stock_subject uuid, p_stock_session uuid,
  p_stock_tenant uuid, p_profile uuid, p_stock_audit_event uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on
SET lock_timeout = '1ms' SET statement_timeout = '10s' AS $fn$
DECLARE o core_e1_resource_private.origins%ROWTYPE; b core_e1_resource_private.stock_bindings%ROWTYPE;
  fingerprint text; result jsonb; staged jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_session IS NULL OR p_command IS NULL
    OR p_company IS NULL OR p_reservation IS NULL OR p_stock_subject IS NULL OR p_stock_session IS NULL
    OR p_stock_tenant IS NULL OR p_profile IS NULL OR p_stock_audit_event IS NULL
    OR p_auth_until IS NULL OR p_auth_until <= clock_timestamp()
    OR p_auth_until > clock_timestamp() + interval '30 seconds'
    OR NOT EXISTS (SELECT 1 FROM core_e1_resource_private.settings WHERE singleton AND enabled) THEN
    RAISE EXCEPTION 'E1_BIND_DENIED';
  END IF;
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0)) THEN
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'E1_BUSY_REAUTHENTICATE';
  END IF;
  SELECT * INTO STRICT o FROM core_e1_resource_private.origins WHERE company_id = p_company
    AND reservation_id = p_reservation AND core_subject = p_actor FOR UPDATE NOWAIT;
  IF EXISTS (SELECT 1 FROM core_registry_private.operators WHERE subject_id = p_actor AND active)
    OR NOT EXISTS (SELECT 1 FROM public.company_portal_instances WHERE id = o.reservation_id
      AND company_id = o.company_id AND portal_type = 'stock' AND lifecycle_status = 'reserved'
      AND legacy_tenant_id IS NULL AND portal_instance_id IS NULL)
    OR (SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id = p_actor) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id = m.company_id
      WHERE m.id = o.membership_id AND m.company_id = o.company_id AND m.core_auth_user_id = p_actor
      AND m.role = 'owner' AND m.status = 'active' AND c.status = 'active') THEN
    RAISE EXCEPTION 'CURRENT_OWNER_REQUIRED';
  END IF;
  staged := jsonb_build_object('companyId', o.company_id, 'reservationId', o.reservation_id,
    'coreTenantId', o.core_tenant_id, 'coreSubject', o.core_subject, 'stockOrigin', o.stock_origin,
    'stockTenantId', p_stock_tenant, 'stockSubject', p_stock_subject, 'profileId', p_profile,
    'auditEventId', p_stock_audit_event, 'product', 'stock', 'status', 'quarantined', 'isActive', false);
  fingerprint := encode(sha256(convert_to('e1.stock.stage:' || staged::text, 'UTF8')), 'hex');
  SELECT * INTO b FROM core_e1_resource_private.stock_bindings WHERE reservation_id = p_reservation;
  IF FOUND THEN
    IF b.command_id <> p_command OR b.stock_subject <> p_stock_subject OR b.stock_tenant_id <> p_stock_tenant
      OR b.profile_id <> p_profile OR b.stock_audit_event_id <> p_stock_audit_event THEN RAISE EXCEPTION 'E1_BIND_REPLAY_CONFLICT'; END IF;
    SELECT e.result INTO STRICT result FROM core_registry_private.events e WHERE e.actor_id = p_actor
      AND e.command_id = p_command AND e.company_id = o.company_id AND e.action = 'e1.stock.stage'
      AND e.request_digest = fingerprint;
  ELSE
    INSERT INTO core_e1_resource_private.stock_bindings(reservation_id, stock_tenant_id, stock_subject,
      profile_id, stock_audit_event_id, command_id)
      VALUES (p_reservation, p_stock_tenant, p_stock_subject, p_profile, p_stock_audit_event, p_command);
    result := core_registry_private.append_event(o.company_id, p_actor, p_session, p_command, 'e1.stock.stage',
      fingerprint, 'null'::jsonb, staged || jsonb_build_object('stockSessionId', p_stock_session),
      p_stock_audit_event::text, '{}', NULL);
  END IF;
  IF p_auth_until <= clock_timestamp() THEN RAISE EXCEPTION 'AUTH_EXPIRED_BEFORE_RETURN'; END IF;
  RETURN jsonb_build_object('binding', staged, 'receipt', result);
END
$fn$;
REVOKE ALL ON FUNCTION public.core_registry_e1_stock_bind_stage(uuid,uuid,timestamptz,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_registry_e1_stock_bind_stage(uuid,uuid,timestamptz,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) TO service_role;
-- No Auth-table privileges, custom roles, provenance issuer or global history scan.
-- Existing legacy runtime flag stays OFF. Privileged operator custody, managed
-- session checkpoints after waits and all trigger/RPC behavior need runtime proof.


DO $transient_checks$
DECLARE target record; role_name name;
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'core_e1_resource_private' AND c.relkind = 'r') <> 3
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'core_e1_resource_private' AND c.relkind = 'r'
        AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR pg_catalog.pg_get_userbyid(c.relowner) <> 'postgres')) THEN
    RAISE EXCEPTION 'E1_REHEARSAL_PRIVATE_TABLES_RLS_OWNER_MISMATCH';
  END IF;
  IF (SELECT count(*) FROM core_e1_resource_private.settings) <> 1
    OR NOT EXISTS (SELECT 1 FROM core_e1_resource_private.settings WHERE singleton AND NOT enabled AND stock_origin IS NULL)
    OR EXISTS (SELECT 1 FROM core_e1_resource_private.origins)
    OR EXISTS (SELECT 1 FROM core_e1_resource_private.stock_bindings) THEN
    RAISE EXCEPTION 'E1_REHEARSAL_DISABLED_EMPTY_STATE_REQUIRED';
  END IF;
  FOR target IN SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'core_e1_resource_private' AND c.relkind = 'r' LOOP
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF pg_catalog.has_schema_privilege(role_name, 'core_e1_resource_private', 'USAGE')
        OR pg_catalog.has_table_privilege(role_name, target.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
        RAISE EXCEPTION 'E1_REHEARSAL_PRIVATE_ACCESS_LEAK';
      END IF;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'core_e1_resource_private' AND p.prokind = 'f') <> 4 THEN
    RAISE EXCEPTION 'E1_REHEARSAL_PRIVATE_FUNCTION_COUNT';
  END IF;
  FOR target IN SELECT p.oid, p.proowner, p.proconfig FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'core_e1_resource_private' AND p.prokind = 'f' LOOP
    IF pg_catalog.pg_get_userbyid(target.proowner) <> 'postgres'
      OR NOT COALESCE(target.proconfig @> ARRAY['search_path=""'], false) THEN
      RAISE EXCEPTION 'E1_REHEARSAL_PRIVATE_FUNCTION_OWNER_OR_PATH';
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF pg_catalog.has_function_privilege(role_name, target.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'E1_REHEARSAL_PRIVATE_FUNCTION_ACCESS_LEAK';
      END IF;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN
        ('core_registry_e1_stock_create', 'core_registry_e1_stock_context', 'core_registry_e1_stock_bind_stage')
        AND p.prokind = 'f' AND p.prosecdef AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
        AND p.proconfig @> ARRAY['search_path=""', 'row_security=on']) <> 3 THEN
    RAISE EXCEPTION 'E1_REHEARSAL_PUBLIC_RPC_METADATA';
  END IF;
  FOR target IN SELECT p.oid, p.proname FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN
        ('core_registry_e1_stock_create', 'core_registry_e1_stock_context', 'core_registry_e1_stock_bind_stage') LOOP
    IF pg_catalog.has_function_privilege('anon', target.oid, 'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated', target.oid, 'EXECUTE') IS DISTINCT FROM
        (target.proname = 'core_registry_e1_stock_context')
      OR pg_catalog.has_function_privilege('service_role', target.oid, 'EXECUTE') IS DISTINCT FROM
        (target.proname IN ('core_registry_e1_stock_create', 'core_registry_e1_stock_bind_stage')) THEN
      RAISE EXCEPTION 'E1_REHEARSAL_RPC_EXECUTION_GRANT_MISMATCH';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_trigger t
      JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal AND t.tgenabled = 'O' AND (n.nspname, c.relname, t.tgname) IN (
        ('core_e1_resource_private', 'origins', 'e1_origin_immutable'),
        ('core_e1_resource_private', 'stock_bindings', 'e1_binding_immutable'),
        ('public', 'companies', 'e1_company_lock'), ('public', 'companies', 'e1_company_guard'),
        ('public', 'company_memberships', 'e1_membership_lock'), ('public', 'company_memberships', 'e1_membership_guard'),
        ('public', 'company_portal_instances', 'e1_instance_lock'), ('public', 'company_portal_instances', 'e1_instance_guard'),
        ('core_registry_private', 'owner_claims', 'e1_claim_lock'), ('core_registry_private', 'owner_claims', 'e1_claim_guard')
      )) <> 10 THEN RAISE EXCEPTION 'E1_REHEARSAL_ENABLED_TRIGGER_COUNT'; END IF;
END
$transient_checks$;
SELECT pg_catalog.jsonb_build_object('status', 'TRANSIENT_DDL_CHECKS_PASS_NOT_COMMITTED',
  'private_tables', 3, 'private_functions', 4, 'public_rpcs', 3, 'enabled_triggers', 10,
  'enabled', false, 'stock_origin', NULL, 'activation', false) AS rehearsal_checks;

ROLLBACK;
