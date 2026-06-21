-- ============================================================
-- 001_core_schema.sql
-- Core DB Baru: jexpxecxylyeefywdzpd
-- Jalankan di SQL Editor Core DB BARU — bukan OLD DB
-- ============================================================

-- ============================================================
-- TABEL 1: tenants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  platform          TEXT NOT NULL CHECK (platform IN ('lms','clinic','pharmacy','jastip')),
  status            TEXT NOT NULL DEFAULT 'trial'
                    CHECK (status IN ('trial','active','suspended','cancelled')),
  plan_tier         TEXT NOT NULL DEFAULT 'starter'
                    CHECK (plan_tier IN ('starter','pro','enterprise')),
  email             TEXT,
  phone             TEXT,
  address           TEXT,
  logo_url          TEXT,
  linked_tenant_id  UUID,
  fonnte_token      TEXT,
  suspended_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABEL 2: subscription_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      TEXT NOT NULL CHECK (platform IN ('lms','clinic','pharmacy','jastip')),
  tier          TEXT NOT NULL CHECK (tier IN ('starter','pro','enterprise')),
  name          TEXT NOT NULL,
  price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_yearly  NUMERIC(12,2) NOT NULL DEFAULT 0,
  features      JSONB NOT NULL DEFAULT '[]',
  max_users     INTEGER,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABEL 3: tenant_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id                  UUID REFERENCES public.subscription_plans(id),
  status                   TEXT NOT NULL DEFAULT 'trialing'
                           CHECK (status IN ('trialing','active','past_due','cancelled','unpaid')),
  trial_ends_at            TIMESTAMPTZ,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  grace_period_ends_at     TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ,
  midtrans_order_id        TEXT,
  midtrans_subscription_id TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABEL 4: tenant_members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('superadmin','owner','admin','member')),
  platform_role TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- ============================================================
-- TABEL 5: subscription_events (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_platform ON public.tenants(platform);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant_id ON public.tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_tenant_id ON public.subscription_events(tenant_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
