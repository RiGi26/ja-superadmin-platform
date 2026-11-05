-- Proposed read-only postcheck, Core hxhusfkrlafxdnyasmsu only.
-- Requires exact Owner SQL approval. Run after all Core forward transactions.
-- Only schema metadata, feature settings and the two approved offer rows.
-- No Auth/customer/session/invoice/audit rows or environment values.
BEGIN READ ONLY;
SELECT 'billing' AS feature, enabled, payment_mode = 'sandbox' AS sandbox_mode
FROM stock_billing_private.settings WHERE singleton;
SELECT 'membership' AS feature, enabled FROM stock_membership_private.settings WHERE singleton
UNION ALL SELECT 'preparation', enabled FROM stock_membership_private.preparation_settings WHERE singleton
UNION ALL SELECT 'workspace', enabled FROM stock_workspace_private.settings WHERE singleton
UNION ALL SELECT 'invitation', enabled FROM stock_membership_private.operator_invitation_settings WHERE singleton
UNION ALL SELECT 'operator_commit', enabled FROM stock_membership_private.operator_commit_settings WHERE singleton
UNION ALL SELECT 'operator_confirmation', enabled FROM stock_membership_private.operator_confirmation_settings WHERE singleton
UNION ALL SELECT 'lifecycle_mutations', mutations_enabled FROM stock_membership_private.lifecycle_settings WHERE singleton
UNION ALL SELECT 'lifecycle_delivery', delivery_enabled FROM stock_membership_private.lifecycle_settings WHERE singleton;
SELECT id, is_active, is_for_sale, stock_billing_private.approved_plan(id) AS approved_contract
FROM public.subscription_plans
WHERE id IN ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid, '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
ORDER BY id;
SELECT n.nspname AS schema_name, c.relname AS table_name, c.relrowsecurity AS rls,
       c.relforcerowsecurity AS forced_rls, c.relowner::regrole AS owner, c.relacl AS grants
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname IN ('stock_workspace_private', 'stock_membership_private')
ORDER BY schema_name, table_name;
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments, p.proowner::regrole AS owner,
       p.prosecdef AS security_definer, p.proacl AS grants,
       md5(pg_get_functiondef(p.oid)) AS definition_hash, md5(p.prosrc) AS body_hash
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('stock_workspace_private', 'stock_membership_private')
   OR (n.nspname = 'public' AND (p.proname LIKE 'core_stock_%' OR p.proname LIKE 'stock_billing_%'))
   OR (n.nspname = 'stock_billing_private' AND p.proname IN ('current_owner', 'current_paid_authority'))
ORDER BY schema_name, function_name, arguments;
SELECT n.nspname AS schema_name, c.relname AS table_name, k.conname,
       k.convalidated, pg_get_constraintdef(k.oid) AS definition
FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('stock_workspace_private', 'stock_membership_private')
ORDER BY schema_name, table_name, k.conname;
SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname, t.tgenabled,
       md5(pg_get_triggerdef(t.oid)) AS definition_hash
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal AND (n.nspname IN ('stock_workspace_private', 'stock_membership_private')
   OR (n.nspname = 'public' AND c.relname IN ('companies', 'company_memberships', 'company_portal_instances')))
ORDER BY schema_name, table_name, t.tgname;
COMMIT;
