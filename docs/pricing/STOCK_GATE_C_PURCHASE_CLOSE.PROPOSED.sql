-- PROPOSED ONLY. Exact Owner authority required; Core hxhusfkrlafxdnyasmsu.
-- Idempotent retirement only. Retain all cohort, financial and audit history.
-- Existing paid access, membership, activation/delivery and recovery stay enabled.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $close$
BEGIN
 IF current_user<>'postgres' OR NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION 'STOCK_GATE_C_OPERATOR_OR_BUSY'; END IF;
 UPDATE stock_billing_private.sandbox_cohort SET enabled=false WHERE enabled AND company_id IN ('0c0b5c44-2af7-471e-8685-bd99438db48d'::uuid,'d713ddba-3568-477b-af22-7dec7d7ec740'::uuid,'8215b025-e5b6-43d4-b2d1-3a4236178b6c'::uuid);
 IF EXISTS(SELECT 1 FROM stock_billing_private.sandbox_cohort WHERE enabled AND company_id IN ('0c0b5c44-2af7-471e-8685-bd99438db48d'::uuid,'d713ddba-3568-477b-af22-7dec7d7ec740'::uuid,'8215b025-e5b6-43d4-b2d1-3a4236178b6c'::uuid))
 THEN RAISE EXCEPTION 'STOCK_GATE_C_CLOSE_UNCONFIRMED'; END IF;
END $close$;
COMMIT;
