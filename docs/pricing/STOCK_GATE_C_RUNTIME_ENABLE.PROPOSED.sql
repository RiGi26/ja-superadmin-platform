-- PROPOSED ONLY. Exact Owner Production/operator authority required.
-- Core hxhusfkrlafxdnyasmsu. Global paid-Owner gates, not a finite Company allowlist.
-- Executes no invitation, membership admission, role mutation or payment.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $enable$
BEGIN
 IF current_user<>'postgres' OR NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION 'STOCK_GATE_C_OPERATOR_OR_BUSY'; END IF;
 PERFORM 1 FROM stock_membership_private.operator_invitation_settings WHERE singleton FOR UPDATE;
 PERFORM 1 FROM stock_membership_private.operator_commit_settings WHERE singleton FOR UPDATE;
 PERFORM 1 FROM stock_membership_private.operator_confirmation_settings WHERE singleton FOR UPDATE;
 PERFORM 1 FROM stock_membership_private.lifecycle_settings WHERE singleton FOR UPDATE;
 IF (SELECT count(*) FROM stock_membership_private.settings WHERE singleton AND enabled)<>1
   OR (SELECT count(*) FROM stock_membership_private.preparation_settings WHERE singleton AND enabled)<>1
   OR (SELECT count(*) FROM stock_workspace_private.settings WHERE singleton AND enabled)<>1
   OR (SELECT count(*) FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode='sandbox')<>1
   OR (SELECT count(*) FROM stock_membership_private.operator_invitation_settings WHERE singleton AND NOT enabled)<>1
   OR (SELECT count(*) FROM stock_membership_private.operator_commit_settings WHERE singleton AND NOT enabled)<>1
   OR (SELECT count(*) FROM stock_membership_private.operator_confirmation_settings WHERE singleton AND NOT enabled)<>1
   OR (SELECT count(*) FROM stock_membership_private.lifecycle_settings WHERE singleton AND NOT mutations_enabled AND NOT delivery_enabled)<>1
   OR EXISTS(SELECT 1 FROM stock_billing_private.sandbox_cohort WHERE enabled)
   OR (SELECT count(*) FROM public.subscription_plans WHERE id IN
      ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,'5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
      AND NOT is_active AND NOT is_for_sale AND stock_billing_private.approved_plan(id))<>2
 THEN RAISE EXCEPTION 'STOCK_GATE_C_RUNTIME_BASELINE_DENIED'; END IF;
 UPDATE stock_membership_private.operator_invitation_settings SET enabled=true WHERE singleton;
 UPDATE stock_membership_private.operator_commit_settings SET enabled=true WHERE singleton;
 UPDATE stock_membership_private.operator_confirmation_settings SET enabled=true WHERE singleton;
 UPDATE stock_membership_private.lifecycle_settings SET mutations_enabled=true,delivery_enabled=true WHERE singleton;
END $enable$;
COMMIT;
