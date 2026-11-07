-- PROPOSED READ-ONLY. Only the two continuation entries, original closed-cohort booleans and permission metadata.
BEGIN READ ONLY;
SELECT
 (SELECT jsonb_agg(jsonb_build_object('companyId',company_id,'planId',plan_id,'enabled',enabled,'createdAt',created_at,
   'validUntil',valid_until,'sixHourBound',valid_until=created_at+interval '6 hours') ORDER BY company_id)
  FROM stock_billing_private.sandbox_continuations_20261107
  WHERE company_id IN ('d713ddba-3568-477b-af22-7dec7d7ec740'::uuid,'8215b025-e5b6-43d4-b2d1-3a4236178b6c'::uuid)) AS continuation,
 (SELECT count(*)=3 FROM stock_billing_private.sandbox_cohort WHERE NOT enabled AND company_id IN
   ('0c0b5c44-2af7-471e-8685-bd99438db48d'::uuid,'d713ddba-3568-477b-af22-7dec7d7ec740'::uuid,'8215b025-e5b6-43d4-b2d1-3a4236178b6c'::uuid)) AS old_three_still_retired,
 (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='stock_billing_private.sandbox_continuations_20261107'::regclass) AS forced_rls,
 NOT has_table_privilege('anon','stock_billing_private.sandbox_continuations_20261107','SELECT')
  AND NOT has_table_privilege('authenticated','stock_billing_private.sandbox_continuations_20261107','SELECT')
  AND NOT has_table_privilege('service_role','stock_billing_private.sandbox_continuations_20261107','SELECT') AS no_direct_customer_or_service_reads,
 (SELECT md5(prosrc)='80bbec24b2645e69ff65d7eabccd836d' AND proowner='postgres'::regrole AND prosecdef FROM pg_proc
   WHERE oid='public.stock_billing_sandbox_allowed(uuid,uuid)'::regprocedure) AS exact_sandbox_predicate;
COMMIT;
