-- =========================================================================================
-- JAPAN ARENA SAAS - CORE SCHEMA (SUPERADMIN & SUBSCRIPTION HUB)
-- Run this script in the SQL Editor of your NEW Core Supabase Project (jexpxecxylyeefywdzpd)
-- =========================================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================================
-- 2. ENUMS
-- =========================================================================================
CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'past_due', 'suspended', 'cancelled');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'unpaid');
CREATE TYPE platform_type AS ENUM ('lms', 'rental', 'clinic', 'pharmacy', 'jastip');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'staff', 'viewer');

-- =========================================================================================
-- 3. TABLES
-- =========================================================================================

-- A. USERS PROFILE (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- B. SUBSCRIPTION PLANS (Master Data Pricing)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL, -- e.g. "Rental Starter", "LMS Pro"
  platform platform_type NOT NULL,
  tier_display_name text NOT NULL,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric NOT NULL DEFAULT 0,
  features jsonb DEFAULT '{}'::jsonb, -- e.g. {"max_vehicles": 10, "custom_domain": false}
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- C. TENANTS (Client Organizations)
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  platform platform_type NOT NULL,
  status tenant_status DEFAULT 'trial',
  plan_tier text NOT NULL, -- e.g. 'starter', 'pro' (Denormalized for quick access)
  owner_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  linked_tenant_id uuid REFERENCES public.tenants(id), -- For Cross-Platform SSO (Same Client, Multiple Apps)
  trial_ends_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- D. TENANT MEMBERS (User roles within a Tenant)
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role member_role DEFAULT 'staff',
  platform_role text, -- Optional: Specific role within the app (e.g. 'driver', 'teacher')
  is_active boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- E. TENANT SUBSCRIPTIONS (Billing logic)
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE RESTRICT NOT NULL,
  status subscription_status DEFAULT 'trial',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  payment_gateway_customer_id text, -- e.g. Stripe/Midtrans ID
  payment_gateway_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id) -- One active subscription per tenant
);

-- F. SUBSCRIPTION EVENTS (Audit Log / Webhook History)
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL, -- e.g., 'trial_started', 'payment_succeeded', 'subscription_canceled'
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- =========================================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Plans are public to read
CREATE POLICY "Plans are public" ON public.subscription_plans FOR SELECT USING (true);

-- Tenants: Superadmin OR Members can view
CREATE POLICY "Members can view their tenants" ON public.tenants FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id = tenants.id AND user_id = auth.uid())
    OR owner_user_id = auth.uid()
  );

-- Tenant Members: Members can view other members in their tenant
CREATE POLICY "Members can view tenant members" ON public.tenant_members FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = tenant_members.tenant_id AND tm.user_id = auth.uid())
  );

-- Subscriptions: Only Tenant Owners or Admins can view
CREATE POLICY "Owners can view subscriptions" ON public.tenant_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members 
      WHERE tenant_id = tenant_subscriptions.tenant_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- =========================================================================================
-- 5. TRIGGERS & FUNCTIONS
-- =========================================================================================

-- Function to handle new user registration automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================================================================
-- 6. SEED DATA (INITIAL SETUP)
-- =========================================================================================

-- Seed basic Subscription Plans for Rental Platform
INSERT INTO public.subscription_plans (name, platform, tier_display_name, price_monthly, features) VALUES
('Rental Starter', 'rental', 'Starter', 250000, '{"max_vehicles": 5, "max_drivers": 5, "support": "email"}'),
('Rental Pro', 'rental', 'Pro', 750000, '{"max_vehicles": 20, "max_drivers": 20, "support": "priority"}'),
('Rental Enterprise', 'rental', 'Enterprise', 1500000, '{"max_vehicles": 999, "max_drivers": 999, "support": "24/7"}');

-- Seed basic Subscription Plans for LMS Platform
INSERT INTO public.subscription_plans (name, platform, tier_display_name, price_monthly, features) VALUES
('LMS Basic', 'lms', 'Basic', 300000, '{"max_students": 100, "storage_gb": 10}'),
('LMS Pro', 'lms', 'Pro', 900000, '{"max_students": 500, "storage_gb": 50}');
