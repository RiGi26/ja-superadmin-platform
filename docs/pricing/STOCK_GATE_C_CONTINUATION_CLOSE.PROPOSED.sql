-- PROPOSED ONLY. Exact continuation retirement, preserving all history.
BEGIN;
SET LOCAL lock_timeout='1s';SET LOCAL statement_timeout='20s';
DO $close$
BEGIN
 IF current_user<>'postgres' OR NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION 'STOCK_GATE_C_CONTINUATION_OPERATOR_OR_BUSY'; END IF;
 IF (SELECT count(*) FROM stock_billing_private.sandbox_continuations_20261107
   WHERE company_id IN ('d713ddba-3568-477b-af22-7dec7d7ec740'::uuid,'8215b025-e5b6-43d4-b2d1-3a4236178b6c'::uuid)
     AND approval_ref='STOCK-GATE-C-RESUME-20261107')<>2
 THEN RAISE EXCEPTION 'STOCK_GATE_C_CONTINUATION_ROWS_REQUIRED'; END IF;
 UPDATE stock_billing_private.sandbox_continuations_20261107 SET enabled=false WHERE enabled
   AND company_id IN ('d713ddba-3568-477b-af22-7dec7d7ec740'::uuid,'8215b025-e5b6-43d4-b2d1-3a4236178b6c'::uuid);
 IF EXISTS(SELECT 1 FROM stock_billing_private.sandbox_continuations_20261107 WHERE enabled)
 THEN RAISE EXCEPTION 'STOCK_GATE_C_CONTINUATION_CLOSE_UNCONFIRMED'; END IF;
END $close$;
COMMIT;
