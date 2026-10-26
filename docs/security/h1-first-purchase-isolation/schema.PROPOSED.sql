-- DESIGN ONLY. NOT A MIGRATION. NEVER APPLY HISTORICAL CORE MIGRATIONS TO DEV.
-- Target: webzoka-core-dev / mcvekinhgcqygfddyifs, Owner-verified postgres Primary.
-- A separately authorized execution derivative must remove ONLY this refusal
-- and replace terminal ROLLBACK with COMMIT, after all README preconditions pass.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $$ BEGIN RAISE EXCEPTION 'H1_ISOLATION_PREPARATION_ONLY_NOT_AUTHORIZED'; END $$;

-- Existing schema is a collision: no IF NOT EXISTS, adoption, DROP, or REPLACE.
CREATE SCHEMA h1_first_purchase_test AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA h1_first_purchase_test FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA h1_first_purchase_test TO authenticated, service_role;

CREATE TABLE h1_first_purchase_test.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('lms','clinic','pharmacy','jastip','stock','rental','laundry')),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','suspended','cancelled')),
  plan_tier text NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter','pro','enterprise')),
  owner_user_id uuid REFERENCES auth.users(id),
  email text,
  phone text,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE h1_first_purchase_test.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('lms','clinic','pharmacy','jastip','stock','rental','laundry')),
  tier text NOT NULL CHECK (tier IN ('starter','pro','enterprise')),
  name text NOT NULL,
  tier_display_name text,
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  price_yearly numeric(12,2) NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE h1_first_purchase_test.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES h1_first_purchase_test.tenants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('superadmin','owner','admin','member')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE h1_first_purchase_test.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES h1_first_purchase_test.tenants(id),
  plan_id uuid REFERENCES h1_first_purchase_test.subscription_plans(id),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trial','trialing','active','past_due','cancelled','unpaid')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- No invented tenant uniqueness constraint: Core migration001 lacks one.
-- Concurrent first-purchase correctness is outside this serial fixture contract.
-- Scheduled-plan columns/FK are outside this first-purchase subset. See README:
-- migration013's second plans FK needs a separate deployed join-parity check.

CREATE TABLE h1_first_purchase_test.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES h1_first_purchase_test.tenants(id),
  subscription_id uuid REFERENCES h1_first_purchase_test.tenant_subscriptions(id),
  plan_id uuid REFERENCES h1_first_purchase_test.subscription_plans(id),
  period text NOT NULL CHECK (period IN ('monthly','yearly')),
  amount integer NOT NULL CHECK (amount > 0),
  midtrans_order_id text UNIQUE,
  snap_token text,
  redirect_url text,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','awaiting_payment','paid','failed','expired')),
  midtrans_mode text CHECK (midtrans_mode IN ('sandbox','production')),
  change_type text NOT NULL DEFAULT 'renew' CHECK (change_type IN ('renew','upgrade')),
  promo_code text,
  promo_discount_percent integer CHECK (promo_discount_percent BETWEEN 0 AND 100),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscription_invoices_live_uniq ON h1_first_purchase_test.subscription_invoices
  (subscription_id, plan_id, period) WHERE status IN ('unpaid','awaiting_payment');

CREATE TABLE h1_first_purchase_test.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES h1_first_purchase_test.tenants(id),
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE h1_first_purchase_test.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE h1_first_purchase_test.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE h1_first_purchase_test.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE h1_first_purchase_test.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE h1_first_purchase_test.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE h1_first_purchase_test.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE h1_first_purchase_test.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE h1_first_purchase_test.platform_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA h1_first_purchase_test FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA h1_first_purchase_test TO service_role;
GRANT SELECT ON h1_first_purchase_test.tenant_members, h1_first_purchase_test.subscription_plans TO authenticated;
GRANT INSERT, UPDATE ON h1_first_purchase_test.tenant_subscriptions, h1_first_purchase_test.subscription_invoices TO service_role;
CREATE POLICY self_membership ON h1_first_purchase_test.tenant_members
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY active_plans ON h1_first_purchase_test.subscription_plans
  FOR SELECT TO authenticated USING (is_active = true);
-- No Auth hooks/triggers, SQL functions, schedulers, HTTP extensions, public
-- objects, Registry access, user write policies, or foreign portal dependencies.
-- No updated_at trigger needed by this path: checkout explicitly writes it.
ROLLBACK;
