-- Core hxhusfkrlafxdnyasmsu only. Definitions and schema metadata only.
-- No business, Auth, payment, settings, session or audit rows are selected.
-- Scope: deployed active-Stock authorization dependencies, including pilot
-- routing, plus managed-session liveness. No DDL or provider changes.
WITH selected AS (
 SELECT p.oid, n.nspname AS schema_name,p.proname AS function_name
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='core_stock_pilot_private')
 OR (n.nspname='core_registry_private' AND p.proname LIKE 'active_stock_%')
 OR (n.nspname='public' AND p.proname IN ('core_stock_active_enroll_session','core_stock_active_authorize_request','core_registry_session_is_live'))
), objects AS (
 SELECT c.oid,n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity,c.relforcerowsecurity,c.relacl
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind='r' AND (n.nspname='core_stock_pilot_private'
 OR (n.nspname='core_registry_private' AND c.relname LIKE 'active_stock_%'))
)
SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',schema_name,'name',function_name,
 'arguments',pg_get_function_identity_arguments(oid),'definition',pg_get_functiondef(oid),
 'hash',md5(pg_get_functiondef(oid))) ORDER BY schema_name,function_name) FROM selected),
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',schema_name,'name',table_name,
 'rls',relrowsecurity,'forceRls',relforcerowsecurity,'grants',relacl::text) ORDER BY schema_name,table_name) FROM objects),
 'columns',(SELECT jsonb_agg(jsonb_build_object('schema',o.schema_name,'table',o.table_name,
 'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull) ORDER BY o.schema_name,o.table_name,a.attnum)
 FROM objects o JOIN pg_catalog.pg_attribute a ON a.attrelid=o.oid WHERE a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('schema',o.schema_name,'table',o.table_name,
 'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY o.schema_name,o.table_name,c.conname)
 FROM objects o JOIN pg_catalog.pg_constraint c ON c.conrelid=o.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('schema',o.schema_name,'table',o.table_name,
 'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY o.schema_name,o.table_name,t.tgname)
 FROM objects o JOIN pg_catalog.pg_trigger t ON t.tgrelid=o.oid WHERE NOT t.tgisinternal)
) AS contract;
