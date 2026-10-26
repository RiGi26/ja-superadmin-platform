-- DESIGN ONLY. Separate exact cleanup authority and task-ownership receipts required.
-- DEV mcvekinhgcqygfddyifs / verified postgres Primary. Stop process/browser and
-- drain task requests; restore API exposed-schemas before this transaction.
-- Only a separately reviewed derivative removes the refusal and changes the
-- terminal ROLLBACK to COMMIT. Auth deletion is a separate exact-UUID admin action.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $$ BEGIN RAISE EXCEPTION 'H1_ISOLATION_PREPARATION_ONLY_NOT_AUTHORIZED'; END $$;

-- Refuse non-fixture rows or paid/activated state. External dependencies make
-- RESTRICT fail; the transaction must roll back, never expand cleanup authority.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM h1_first_purchase_test.tenants WHERE id NOT IN
       ('8c15706b-f67e-4cc5-8b90-0fe619dd0101','8c15706b-f67e-4cc5-8b90-0fe619dd0102')) OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.tenant_members WHERE id NOT IN
       ('8c15706b-f67e-4cc5-8b90-0fe619dd0301','8c15706b-f67e-4cc5-8b90-0fe619dd0302')) OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.subscription_plans WHERE id <>
       '8c15706b-f67e-4cc5-8b90-0fe619dd0201') OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.platform_settings WHERE key NOT IN ('midtrans_mode','promo_campaign')) OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.subscription_events) OR
     (SELECT count(*) FROM h1_first_purchase_test.tenant_subscriptions) > 1 OR
     (SELECT count(*) FROM h1_first_purchase_test.subscription_invoices) > 1 OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.tenant_subscriptions WHERE tenant_id <>
       '8c15706b-f67e-4cc5-8b90-0fe619dd0101' OR plan_id IS DISTINCT FROM
       '8c15706b-f67e-4cc5-8b90-0fe619dd0201'::uuid OR status <> 'unpaid') OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.subscription_invoices WHERE tenant_id <>
       '8c15706b-f67e-4cc5-8b90-0fe619dd0101' OR plan_id IS DISTINCT FROM
       '8c15706b-f67e-4cc5-8b90-0fe619dd0201'::uuid OR status NOT IN ('unpaid','awaiting_payment','failed') OR
       paid_at IS NOT NULL OR midtrans_mode IS DISTINCT FROM 'sandbox' OR amount <> 100000 OR
       redirect_url IS NOT NULL AND redirect_url <> 'https://h1-checkout.invalid/checkout/synthetic') THEN
    RAISE EXCEPTION 'Unexpected state: preserve evidence and request bounded recovery';
  END IF;
END $$;

DROP TABLE h1_first_purchase_test.subscription_invoices RESTRICT;
DROP TABLE h1_first_purchase_test.subscription_events RESTRICT;
DROP TABLE h1_first_purchase_test.tenant_members RESTRICT;
DROP TABLE h1_first_purchase_test.tenant_subscriptions RESTRICT;
DROP TABLE h1_first_purchase_test.tenants RESTRICT;
DROP TABLE h1_first_purchase_test.subscription_plans RESTRICT;
DROP TABLE h1_first_purchase_test.platform_settings RESTRICT;
DROP SCHEMA h1_first_purchase_test RESTRICT;
ROLLBACK;
