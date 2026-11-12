-- PROPOSED READ-ONLY: Core hxhusfkrlafxdnyasmsu. No customer/session/payment payloads.
BEGIN READ ONLY;
SELECT md5(p.prosrc)='966a113084bf699edb1c52cb42105be5' AS expected_preparer,
 p.proowner='postgres'::regrole AS postgres_owned,p.prosecdef AS security_definer,
 NOT has_function_privilege('anon',p.oid,'EXECUTE') AS anon_denied,
 NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_denied,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_only
FROM pg_proc p WHERE p.oid='public.stock_billing_prepare_account(uuid,uuid,timestamp with time zone,uuid,uuid,uuid)'::regprocedure;
SELECT 'membership' AS feature,enabled FROM stock_membership_private.settings WHERE singleton
UNION ALL SELECT 'preparation',enabled FROM stock_membership_private.preparation_settings WHERE singleton
UNION ALL SELECT 'workspace',enabled FROM stock_workspace_private.settings WHERE singleton;
SELECT count(*)=2 AND bool_and(NOT is_active AND NOT is_for_sale AND stock_billing_private.approved_plan(id)) AS both_offers_closed
FROM public.subscription_plans WHERE id IN
 ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,'5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid);
SELECT NOT EXISTS(SELECT 1 FROM stock_billing_private.sandbox_cohort WHERE enabled) AS cohort_still_closed;
COMMIT;
