-- DESIGN ONLY. Same DEV/principal/receipt gates as schema.PROPOSED.sql.
-- After separate authorization, the only substitutions are TWO newly created
-- test Auth UUIDs. Do not substitute any existing/protected Auth user.
-- In the approved derivative remove ONLY the refusal; terminal ROLLBACK -> COMMIT.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $$ BEGIN RAISE EXCEPTION 'H1_ISOLATION_PREPARATION_ONLY_NOT_AUTHORIZED'; END $$;

DO $$
DECLARE
  owner_a uuid := 'OWNER_A_NEW_AUTH_UUID';
  owner_b uuid := 'OWNER_B_NEW_AUTH_UUID';
BEGIN
  IF owner_a = owner_b OR
     (SELECT count(*) FROM auth.users WHERE
       (id = owner_a AND email = 'h1-first-purchase-a@example.invalid' OR
        id = owner_b AND email = 'h1-first-purchase-b@example.invalid')
       AND email_confirmed_at IS NOT NULL AND is_anonymous IS FALSE
       AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until <= now())) <> 2 THEN
    RAISE EXCEPTION 'Dedicated confirmed test Auth subjects required';
  END IF;
  IF EXISTS (SELECT 1 FROM h1_first_purchase_test.tenants) OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.tenant_members) OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.subscription_plans) OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.tenant_subscriptions) OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.subscription_invoices) OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.subscription_events) OR
     EXISTS (SELECT 1 FROM h1_first_purchase_test.platform_settings) THEN
    RAISE EXCEPTION 'Fixture schema must be empty and task-owned';
  END IF;

  INSERT INTO h1_first_purchase_test.tenants (id, name, slug, platform, status, plan_tier, owner_user_id, email)
  VALUES
    ('8c15706b-f67e-4cc5-8b90-0fe619dd0101', 'H1 first-purchase A', 'h1-first-purchase-a', 'lms', 'active', 'starter', owner_a, 'h1-first-purchase-a@example.invalid'),
    ('8c15706b-f67e-4cc5-8b90-0fe619dd0102', 'H1 first-purchase B', 'h1-first-purchase-b', 'lms', 'active', 'starter', owner_b, 'h1-first-purchase-b@example.invalid');
  INSERT INTO h1_first_purchase_test.tenant_members (id, tenant_id, user_id, role, is_active)
  VALUES
    ('8c15706b-f67e-4cc5-8b90-0fe619dd0301', '8c15706b-f67e-4cc5-8b90-0fe619dd0101', owner_a, 'owner', true),
    ('8c15706b-f67e-4cc5-8b90-0fe619dd0302', '8c15706b-f67e-4cc5-8b90-0fe619dd0102', owner_b, 'owner', true);
  INSERT INTO h1_first_purchase_test.subscription_plans
    (id, platform, tier, name, tier_display_name, price_monthly, price_yearly, features, is_active)
  VALUES ('8c15706b-f67e-4cc5-8b90-0fe619dd0201', 'lms', 'starter', 'H1 synthetic Starter', 'Starter', 100000, 1000000, '[]', true);
  INSERT INTO h1_first_purchase_test.platform_settings (key, value) VALUES
    ('midtrans_mode', 'sandbox'),
    ('promo_campaign', '{"active":false}');
END $$;
-- Expected counts: tenants=2, members=2, plans=1, settings=2,
-- subscriptions=0, invoices=0, events=0. No public.users row or Company mapping.
ROLLBACK;
