-- PROPOSED ONLY. Requires explicit Owner approval before managed execution.
-- Core hxhusfkrlafxdnyasmsu only. Preparation is not payment enablement.
-- Apply only with the reviewed closed-sales source candidate and an explicit
-- BILLING_SANDBOX_UAT_ENABLED=false deployment override. Stock's private paid
-- receiver must remain disabled. No public offer, engine mode or cohort changes.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '20s';
DO $prepare$
DECLARE changed integer;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'STOCK_PREPARATION_OPERATOR_REQUIRED'; END IF;
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0))
    THEN RAISE EXCEPTION 'STOCK_PREPARATION_BUSY'; END IF;
  PERFORM 1 FROM stock_billing_private.settings WHERE singleton FOR UPDATE;
  PERFORM 1 FROM public.platform_settings WHERE key = 'midtrans_mode' FOR SHARE;
  PERFORM 1 FROM public.subscription_plans
    WHERE id IN ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,
                 '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid) FOR SHARE;
  IF (SELECT count(*) FROM stock_billing_private.settings
      WHERE singleton AND NOT enabled AND payment_mode = 'sandbox') <> 1
    OR (SELECT count(*) FROM public.platform_settings WHERE key = 'midtrans_mode') <> 1
    OR (SELECT to_jsonb(s)->>'value' FROM public.platform_settings s
        WHERE key = 'midtrans_mode') IS DISTINCT FROM 'sandbox'
    OR (SELECT count(*) FROM public.subscription_plans
        WHERE id IN ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,
                     '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)) <> 2
    OR EXISTS (SELECT 1 FROM public.subscription_plans
        WHERE id IN ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,
                     '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
          AND (is_active IS DISTINCT FROM false OR is_for_sale IS DISTINCT FROM false
               OR stock_billing_private.approved_plan(id) IS DISTINCT FROM true))
    OR EXISTS (SELECT 1 FROM stock_billing_private.sandbox_cohort)
    OR EXISTS (SELECT 1 FROM stock_billing_private.accounts)
    THEN RAISE EXCEPTION 'STOCK_PREPARATION_BASELINE_DRIFT';
  END IF;
  UPDATE stock_billing_private.settings SET enabled = true
    WHERE singleton AND NOT enabled AND payment_mode = 'sandbox';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'STOCK_PREPARATION_SETTINGS_MISMATCH'; END IF;
END
$prepare$;
COMMIT;
