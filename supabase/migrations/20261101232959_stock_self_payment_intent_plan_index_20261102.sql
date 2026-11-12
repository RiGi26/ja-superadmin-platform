-- Core hxhusfkrlafxdnyasmsu only. Additional exact-object approval required.
-- Corrects the new intents_plan_id_fkey advisor finding. No runtime enablement.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
DO $preflight$ BEGIN
  IF current_user <> 'postgres'
    OR to_regclass('stock_billing_private.stock_billing_intent_plan_idx') IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM stock_billing_private.settings
      WHERE singleton AND NOT enabled AND payment_mode = 'sandbox')
    OR EXISTS (SELECT 1 FROM stock_billing_private.intents LIMIT 1)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = 'stock_billing_private.intents'::regclass
        AND conname = 'intents_plan_id_fkey'
        AND confrelid = 'public.subscription_plans'::regclass AND contype = 'f')
  THEN RAISE EXCEPTION 'STOCK_BILLING_INTENT_INDEX_BASELINE_DRIFT'; END IF;
END $preflight$;
CREATE INDEX stock_billing_intent_plan_idx ON stock_billing_private.intents(plan_id);
COMMIT;
