-- Forward proposal only. Target: Core hxhusfkrlafxdnyasmsu.
-- No execution or financial mutation is authorized by this file.
-- The application verifies the native provider status before this short transaction.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '20s';
DO $guard$
BEGIN
  IF current_user <> 'postgres' OR
    to_regprocedure('public.apply_verified_subscription_payment(text,text,integer,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'payment_migration_baseline_drift';
  END IF;
END $guard$;

CREATE FUNCTION public.apply_verified_subscription_payment(
  p_order text, p_mode text, p_amount integer, p_verified_status jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog
SET timezone = 'UTC'
AS $function$
DECLARE
  inv public.subscription_invoices%ROWTYPE;
  sub public.tenant_subscriptions%ROWTYPE;
  tenant public.tenants%ROWTYPE;
  plan public.subscription_plans%ROWTYPE;
  v_paid_at timestamptz := statement_timestamp();
  base_at timestamptz;
BEGIN
  IF current_user <> 'service_role' OR p_mode NOT IN ('sandbox','production')
    OR p_mode IS NULL OR p_order IS NULL OR length(p_order) NOT BETWEEN 1 AND 100
    OR p_amount IS NULL OR p_amount < 0 OR jsonb_typeof(p_verified_status) IS DISTINCT FROM 'object'
    OR p_verified_status->>'order_id' IS DISTINCT FROM p_order
    OR p_verified_status->>'currency' IS DISTINCT FROM 'IDR'
    OR coalesce(p_verified_status->>'gross_amount','') !~ '^[0-9]+([.]00)?$'
    OR p_verified_status->>'status_code' IS DISTINCT FROM '200'
    OR coalesce(p_verified_status->>'transaction_status','') NOT IN ('capture','settlement')
    OR (p_verified_status ? 'fraud_status' AND p_verified_status->>'fraud_status' IS DISTINCT FROM 'accept')
  THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='verified_payment_required'; END IF;
  IF (p_verified_status->>'gross_amount')::numeric IS DISTINCT FROM p_amount::numeric THEN
    RAISE EXCEPTION 'payment_amount_mismatch';
  END IF;

  -- Consistent lock order: invoice, subscription, tenant. No network in this transaction.
  SELECT * INTO STRICT inv FROM public.subscription_invoices WHERE midtrans_order_id=p_order FOR UPDATE;
  IF EXISTS(SELECT 1 FROM core_billing_sandbox_private.cohort WHERE tenant_id=inv.tenant_id)
    AND NOT public.billing_sandbox_uat_allowed(inv.tenant_id,inv.plan_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='billing_uat_closed';
  END IF;
  IF inv.amount<>p_amount OR (inv.midtrans_mode IS NOT NULL AND inv.midtrans_mode<>p_mode)
    OR inv.period NOT IN ('monthly','yearly') OR inv.change_type NOT IN ('renew','upgrade')
    OR inv.subscription_id IS NULL OR inv.plan_id IS NULL THEN
    RAISE EXCEPTION 'payment_invoice_mismatch';
  END IF;
  SELECT * INTO STRICT sub FROM public.tenant_subscriptions WHERE id=inv.subscription_id FOR UPDATE;
  SELECT * INTO STRICT tenant FROM public.tenants WHERE id=inv.tenant_id FOR UPDATE;
  SELECT * INTO STRICT plan FROM public.subscription_plans WHERE id=inv.plan_id;
  IF sub.tenant_id<>inv.tenant_id OR plan.platform IS DISTINCT FROM tenant.platform THEN
    RAISE EXCEPTION 'payment_tenant_plan_mismatch';
  END IF;
  -- Renew the issued contract even if new sales are closed. Never reprice an invoice.
  IF inv.status='paid' THEN
    RETURN jsonb_build_object('firstTransition',false,'tenantId',inv.tenant_id,'invoiceId',inv.id);
  END IF;
  base_at := greatest(v_paid_at,coalesce(sub.current_period_end,v_paid_at));
  UPDATE public.tenant_subscriptions SET
    status='active', plan_id=inv.plan_id, grace_period_ends_at=NULL, cancelled_at=NULL,
    scheduled_plan_id=NULL, scheduled_plan_set_at=NULL, updated_at=v_paid_at,
    current_period_start=CASE WHEN inv.change_type='upgrade' THEN sub.current_period_start
      ELSE coalesce(sub.current_period_start,v_paid_at) END,
    current_period_end=CASE WHEN inv.change_type='upgrade' THEN sub.current_period_end
      WHEN inv.period='yearly' THEN base_at+interval '1 year' ELSE base_at+interval '1 month' END
  WHERE id=sub.id;
  UPDATE public.tenants SET status='active',plan_tier=plan.tier,updated_at=v_paid_at WHERE id=tenant.id;
  UPDATE public.subscription_invoices SET status='paid',paid_at=v_paid_at,
    payment_type=p_verified_status->>'payment_type',raw_notification=p_verified_status,updated_at=v_paid_at WHERE id=inv.id;
  INSERT INTO public.subscription_events(tenant_id,event_type,payload) VALUES
    (inv.tenant_id,'payment_received',jsonb_build_object('invoice_id',inv.id,'subscription_id',inv.subscription_id,
      'plan_id',inv.plan_id,'period',inv.period,'amount',inv.amount,'midtrans_order_id',p_order,
      'midtrans_mode',p_mode,'payment_type',p_verified_status->>'payment_type')),
    (inv.tenant_id,'subscription_activated',jsonb_build_object('invoice_id',inv.id,'subscription_id',inv.subscription_id,
      'plan_id',inv.plan_id,'period',inv.period));
  RETURN jsonb_build_object('firstTransition',true,'tenantId',inv.tenant_id,'invoiceId',inv.id);
END $function$;
REVOKE ALL ON FUNCTION public.apply_verified_subscription_payment(text,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_subscription_payment(text,text,integer,jsonb) TO service_role;
DO $postconditions$
BEGIN
  IF has_function_privilege('anon','public.apply_verified_subscription_payment(text,text,integer,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.apply_verified_subscription_payment(text,text,integer,jsonb)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.apply_verified_subscription_payment(text,text,integer,jsonb)','EXECUTE')
    OR (SELECT prosecdef FROM pg_proc WHERE oid='public.apply_verified_subscription_payment(text,text,integer,jsonb)'::regprocedure)
  THEN RAISE EXCEPTION 'payment_function_privileges_failed'; END IF;
END $postconditions$;
COMMIT;
