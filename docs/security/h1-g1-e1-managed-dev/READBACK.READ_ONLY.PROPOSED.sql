-- PROPOSAL ONLY. Separate exact Owner authority required. Core DEV only.
-- One mandatory catalog/lock-metadata readback after the approved rollback attempt.
-- If the attempt errors/times out, wait for its 30-second transaction window before readback.
-- No retry, terminate-backend action or fixture cleanup is authorized by this file.
BEGIN TRANSACTION READ ONLY;
SET LOCAL transaction_timeout = '10s';
SET LOCAL statement_timeout = '8s';
SET LOCAL lock_timeout = '1s';
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

DO $lock_readback$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_locks l
    JOIN pg_catalog.pg_class c ON c.oid = l.relation
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE l.locktype = 'relation' AND l.mode = 'AccessExclusiveLock' AND l.granted
      AND l.pid IS DISTINCT FROM pg_catalog.pg_backend_pid()
      AND ((n.nspname = 'public' AND c.relname IN ('companies', 'company_memberships', 'company_portal_instances'))
        OR (n.nspname = 'core_registry_private' AND c.relname IN ('settings', 'operators', 'provenance', 'owner_claims', 'events')))) THEN
    RAISE EXCEPTION 'E1_READBACK_EXCLUSIVE_LOCK_STILL_PRESENT';
  END IF;
END
$lock_readback$;
SELECT pg_catalog.jsonb_build_object('status', 'ROLLBACK_READBACK_PASS', 'metadata_only', true,
  'native_baseline_matches', true, 'provider_catalog_matches', true, 'e1_objects_absent', true,
  'registry_exclusive_locks_absent', true) AS rollback_readback;
ROLLBACK;
