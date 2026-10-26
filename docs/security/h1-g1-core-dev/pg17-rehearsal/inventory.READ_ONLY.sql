-- NOT_EXECUTED. One catalog-only statement; no customer/Auth rows or secrets.
SELECT jsonb_build_object(
  'roles', COALESCE((SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolcanlogin,rolsuper,
    rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls) ORDER BY rolname)
    FROM pg_catalog.pg_roles WHERE rolname LIKE 'wz_h1g1_r17%' OR rolname LIKE 'wz_core_%'), '[]'::jsonb),
  'memberships', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.roleid,a.member,a.grantor)
    FROM pg_catalog.pg_auth_members a WHERE a.roleid IN
      (SELECT oid FROM pg_catalog.pg_roles WHERE rolname LIKE 'wz_h1g1_r17%' OR rolname LIKE 'wz_core_%')
    OR a.member IN (SELECT oid FROM pg_catalog.pg_roles WHERE rolname LIKE 'wz_h1g1_r17%' OR rolname LIKE 'wz_core_%')), '[]'::jsonb),
  'schemas', COALESCE((SELECT jsonb_agg(jsonb_build_array(oid,nspname,nspowner,nspacl::text) ORDER BY nspname)
    FROM pg_catalog.pg_namespace WHERE nspname IN ('public','wz_h1g1_r17','wz_core_private','supabase_migrations')), '[]'::jsonb),
  'relations', COALESCE((SELECT jsonb_agg(jsonb_build_array(c.oid,n.nspname,c.relname,c.relkind,
    c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) ORDER BY n.nspname,c.relname)
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public','wz_h1g1_r17','wz_core_private','supabase_migrations')), '[]'::jsonb),
  'functions', COALESCE((SELECT jsonb_agg(jsonb_build_array(p.oid,p.proname,p.proowner,
    p.prosecdef,p.proconfig,p.proacl::text) ORDER BY p.oid)
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('wz_h1g1_r17','wz_core_private')), '[]'::jsonb),
  'default_acls', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_catalog.pg_default_acl d), '[]'::jsonb),
  'event_triggers', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid)
    FROM pg_catalog.pg_event_trigger t), '[]'::jsonb),
  'shared_dependencies', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.dbid,d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.deptype)
    FROM pg_catalog.pg_shdepend d WHERE d.refclassid = 'pg_catalog.pg_authid'::regclass
    AND d.refobjid IN (SELECT oid FROM pg_catalog.pg_roles WHERE rolname LIKE 'wz_h1g1_r17%' OR rolname LIKE 'wz_core_%')), '[]'::jsonb),
  'primary_sessions', COALESCE((SELECT jsonb_agg(jsonb_build_array(pid,backend_start,state) ORDER BY pid)
    FROM pg_catalog.pg_stat_activity WHERE application_name = 'h1g1-r17-primary'), '[]'::jsonb)
) AS inventory;
