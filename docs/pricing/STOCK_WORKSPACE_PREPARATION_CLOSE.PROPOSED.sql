-- PROPOSED ONLY. Requires explicit Owner approval before managed execution.
-- Core hxhusfkrlafxdnyasmsu only. Safe preparation rollback, never paid recovery.
-- Retains all Company, reservation, intent and native audit history. Refuses
-- when a billing account or any sandbox cohort exists; paid recovery instead
-- closes new purchases while preserving subscriptions and activation retries.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '20s';
DO $close_preparation$
DECLARE changed integer;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'STOCK_PREPARATION_OPERATOR_REQUIRED'; END IF;
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0))
    THEN RAISE EXCEPTION 'STOCK_PREPARATION_BUSY'; END IF;
  PERFORM 1 FROM stock_billing_private.settings WHERE singleton FOR UPDATE;
  IF EXISTS (SELECT 1 FROM stock_billing_private.accounts)
    OR EXISTS (SELECT 1 FROM stock_billing_private.sandbox_cohort)
    OR (SELECT count(*) FROM stock_billing_private.settings
        WHERE singleton AND enabled AND payment_mode = 'sandbox') <> 1
    THEN RAISE EXCEPTION 'STOCK_PREPARATION_CLOSE_UNSAFE';
  END IF;
  UPDATE stock_billing_private.settings SET enabled = false
    WHERE singleton AND enabled AND payment_mode = 'sandbox';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'STOCK_PREPARATION_SETTINGS_MISMATCH'; END IF;
END
$close_preparation$;
COMMIT;
