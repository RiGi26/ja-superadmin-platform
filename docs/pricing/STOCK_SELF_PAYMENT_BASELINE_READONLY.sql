-- Reviewable read-only probe. Target only Core hxhusfkrlafxdnyasmsu.
-- Requires explicit permission to use the Core SQL/query tool. Do not apply DDL.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS database_role;
SELECT n.nspname AS schema_name, p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer, md5(coalesce(p.proconfig::text,'')) AS function_config_hash,
  p.proacl AS grants, md5(pg_get_functiondef(p.oid)) AS definition_hash
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='public' AND p.proname IN (
 'core_registry_session_is_live','apply_verified_subscription_payment','billing_sandbox_uat_allowed',
 'stock_billing_owned_workspaces','stock_billing_prepare_account','stock_billing_claim_activation'))
 OR n.nspname IN ('stock_billing_private','core_e1_resource_private')
ORDER BY n.nspname,p.proname,arguments;
SELECT table_schema,table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE (table_schema='core_e1_resource_private' AND table_name IN ('origins','stock_bindings'))
 OR table_schema='stock_billing_private'
 OR (table_schema='public' AND table_name IN ('companies','company_memberships','company_portal_instances',
  'tenants','tenant_subscriptions','subscription_invoices','subscription_events','subscription_plans'))
ORDER BY table_schema,table_name,ordinal_position;
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls,
 c.relforcerowsecurity AS forced_rls,c.relowner::regrole AS owner,c.relacl AS grants
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='r' AND (n.nspname IN ('stock_billing_private','core_e1_resource_private')
 OR (n.nspname='public' AND c.relname IN ('companies','company_memberships','company_portal_instances',
 'tenants','tenant_subscriptions','subscription_invoices','subscription_events','subscription_plans')))
ORDER BY n.nspname,c.relname;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,
 md5(coalesce(qual,'')) AS using_hash,md5(coalesce(with_check,'')) AS check_hash
FROM pg_catalog.pg_policies
WHERE schemaname IN ('stock_billing_private','core_e1_resource_private')
 OR (schemaname='public' AND tablename IN ('companies','company_memberships','company_portal_instances',
 'tenants','tenant_subscriptions','subscription_invoices','subscription_events','subscription_plans'))
ORDER BY schemaname,tablename,policyname;
SELECT id,platform,offer_version,public_tier,tier,price_monthly,price_yearly,
 is_active,is_for_sale,allowed_periods,entitlement_contract
FROM public.subscription_plans
WHERE id IN ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001','5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002')
ORDER BY id;
COMMIT;
