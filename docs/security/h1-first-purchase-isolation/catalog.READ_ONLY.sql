-- PROPOSED ONLY. Not submitted by this task. No function bodies or user data.
-- Owner must bind the SQL Editor to DEV mcvekinhgcqygfddyifs / Primary first.
-- A successful metadata result does not certify scheduler/queue non-interference.
SELECT current_user AS effective_role, session_user AS login_role,
       current_database() AS database_name, pg_is_in_recovery() AS replica,
       current_setting('transaction_read_only') AS transaction_read_only;

SELECT n.nspname AS schema_name, c.relname, c.relkind, c.relrowsecurity,
       c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS owner, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'core_registry_private', 'h1_first_purchase_test')
  AND c.relkind IN ('r','p','v','m','f')
ORDER BY n.nspname, c.relname;

SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname,
       format_type(a.atttypid, a.atttypmod) AS column_type, a.attnotnull
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public','h1_first_purchase_test')
  AND c.relname IN ('tenants','tenant_members','subscription_plans','tenant_subscriptions',
                   'subscription_invoices','subscription_events','platform_settings')
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY n.nspname, c.relname, a.attnum;

SELECT n.nspname AS schema_name, c.relname, con.conname, con.contype,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('h1_first_purchase_test','core_registry_private')
   OR n.nspname = 'public' AND c.relname IN ('tenants','tenant_members','subscription_plans',
      'tenant_subscriptions','subscription_invoices','subscription_events','platform_settings',
      'companies','company_memberships','company_portal_instances')
ORDER BY n.nspname, c.relname, con.conname;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public','core_registry_private','h1_first_purchase_test')
ORDER BY schemaname, tablename, policyname;

SELECT n.nspname AS table_schema, c.relname, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid) AS trigger_definition,
       pn.nspname AS function_schema, p.proname, p.prosecdef, p.proconfig,
       md5(p.prosrc) AS source_md5
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace pn ON pn.oid = p.pronamespace
WHERE NOT t.tgisinternal AND n.nspname IN ('auth','public','core_registry_private','h1_first_purchase_test')
ORDER BY n.nspname, c.relname, t.tgname;

SELECT e.evtname, e.evtevent, e.evtenabled, e.evttags,
       pg_get_userbyid(e.evtowner) AS trigger_owner, n.nspname, p.proname,
       pg_get_userbyid(p.proowner) AS function_owner, p.prosecdef, p.proconfig,
       md5(p.prosrc) AS source_md5
FROM pg_event_trigger e JOIN pg_proc p ON p.oid = e.evtfoid
JOIN pg_namespace n ON n.oid = p.pronamespace ORDER BY e.evtname;

SELECT extname, extversion FROM pg_extension
WHERE extname IN ('pg_cron','pg_net','http','supabase_functions','pgmq');
-- Auth Hooks/SMTP/API exposed-schemas/webhooks/Edge schedules and hidden/NULL
-- scheduler states require Owner/provider records; no inference from empty rows.
