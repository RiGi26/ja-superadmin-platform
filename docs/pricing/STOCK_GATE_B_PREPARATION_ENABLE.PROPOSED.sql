-- PROPOSED ONLY. Requires explicit Owner authority for managed execution.
-- Core hxhusfkrlafxdnyasmsu only. Gate B preparation/selection; no payment enablement.
-- Deploy the reviewed receiver-first Gate B pair with pilot false and Core sandbox
-- checkout false before executing. Public release fuses stay false.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '20s';
DO $gate_b$
DECLARE n integer;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'STOCK_GATE_B_OPERATOR_REQUIRED'; END IF;
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes',0))
    THEN RAISE EXCEPTION 'STOCK_GATE_B_BUSY'; END IF;
  PERFORM 1 FROM stock_membership_private.settings WHERE singleton FOR UPDATE;
  PERFORM 1 FROM stock_membership_private.preparation_settings WHERE singleton FOR UPDATE;
  PERFORM 1 FROM stock_workspace_private.settings WHERE singleton FOR UPDATE;
  IF (SELECT count(*) FROM (SELECT 'membership' AS feature, enabled FROM stock_membership_private.settings WHERE singleton
UNION ALL SELECT 'preparation', enabled FROM stock_membership_private.preparation_settings WHERE singleton
UNION ALL SELECT 'workspace', enabled FROM stock_workspace_private.settings WHERE singleton
UNION ALL SELECT 'invitation', enabled FROM stock_membership_private.operator_invitation_settings WHERE singleton
UNION ALL SELECT 'operator_commit', enabled FROM stock_membership_private.operator_commit_settings WHERE singleton
UNION ALL SELECT 'operator_confirmation', enabled FROM stock_membership_private.operator_confirmation_settings WHERE singleton
UNION ALL SELECT 'lifecycle_mutations', mutations_enabled FROM stock_membership_private.lifecycle_settings WHERE singleton
UNION ALL SELECT 'lifecycle_delivery', delivery_enabled FROM stock_membership_private.lifecycle_settings WHERE singleton) s) <> 8
    OR EXISTS(SELECT 1 FROM (SELECT 'membership' AS feature, enabled FROM stock_membership_private.settings WHERE singleton
UNION ALL SELECT 'preparation', enabled FROM stock_membership_private.preparation_settings WHERE singleton
UNION ALL SELECT 'workspace', enabled FROM stock_workspace_private.settings WHERE singleton
UNION ALL SELECT 'invitation', enabled FROM stock_membership_private.operator_invitation_settings WHERE singleton
UNION ALL SELECT 'operator_commit', enabled FROM stock_membership_private.operator_commit_settings WHERE singleton
UNION ALL SELECT 'operator_confirmation', enabled FROM stock_membership_private.operator_confirmation_settings WHERE singleton
UNION ALL SELECT 'lifecycle_mutations', mutations_enabled FROM stock_membership_private.lifecycle_settings WHERE singleton
UNION ALL SELECT 'lifecycle_delivery', delivery_enabled FROM stock_membership_private.lifecycle_settings WHERE singleton) s WHERE enabled IS DISTINCT FROM false)
    OR (SELECT count(*) FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode='sandbox') <> 1
    OR (SELECT count(*) FROM public.subscription_plans WHERE id IN
      ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,'5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
      AND NOT is_active AND NOT is_for_sale AND stock_billing_private.approved_plan(id)) <> 2
    OR EXISTS(SELECT 1 FROM stock_billing_private.sandbox_cohort WHERE enabled)
    THEN RAISE EXCEPTION 'STOCK_GATE_B_CLOSED_BASELINE_DENIED'; END IF;
  IF EXISTS(
    SELECT 1 FROM (VALUES
      ('core_stock_membership_authorize_request', '31caf7303b02236d518dbe284a5d84be'),
      ('core_stock_membership_confirm_owner', '9c80f0565f5d161e678e1c355ae5bb54'),
      ('core_stock_membership_prepare_owner', 'dd672ce9bb587fc0156df035d66591e0'),
      ('core_stock_membership_select_session', '4d45f8a385927f5c89fd7947cc77f65f'),
      ('core_stock_workspace_create', '4c8893f311172bce6ea74e01fb4fab45'),
      ('core_stock_workspace_prepare_owner', 'be248e50c26f8b5848ef5ec7795ad284')
    ) expected(name,hash)
    LEFT JOIN pg_catalog.pg_namespace ns ON ns.nspname='public'
    LEFT JOIN pg_catalog.pg_proc p ON p.pronamespace=ns.oid AND p.proname=expected.name
    WHERE p.oid IS NULL OR p.proowner <> 'postgres'::regrole
      OR md5(pg_catalog.pg_get_functiondef(p.oid)) IS DISTINCT FROM expected.hash
  ) THEN RAISE EXCEPTION 'STOCK_GATE_B_FUNCTION_DRIFT'; END IF;
  UPDATE stock_workspace_private.settings SET enabled=true WHERE singleton AND NOT enabled;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'STOCK_GATE_B_WORKSPACE_MISMATCH'; END IF;
  UPDATE stock_membership_private.preparation_settings SET enabled=true WHERE singleton AND NOT enabled;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'STOCK_GATE_B_PREPARATION_MISMATCH'; END IF;
  UPDATE stock_membership_private.settings SET enabled=true WHERE singleton AND NOT enabled;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'STOCK_GATE_B_MEMBERSHIP_MISMATCH'; END IF;
END
$gate_b$;
COMMIT;
