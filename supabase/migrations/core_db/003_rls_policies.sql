-- ============================================================
-- 003_rls_policies.sql
-- Core DB Baru: jexpxecxylyeefywdzpd
-- RLS policies untuk semua tabel Core
-- Jalankan di SQL Editor Core DB BARU setelah 002_seed_plans.sql
-- ============================================================

-- Enable RLS semua tabel
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: cek apakah user adalah superadmin (via JWT claim)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'user_role') = 'superadmin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Helper: ambil tenant_id dari JWT claim
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'tenant_id')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- tenants policies
-- ============================================================
CREATE POLICY "superadmin_all_tenants" ON public.tenants
  FOR ALL USING (public.is_superadmin());

CREATE POLICY "member_read_own_tenant" ON public.tenants
  FOR SELECT USING (id = public.my_tenant_id());

-- ============================================================
-- subscription_plans policies (read-only public)
-- ============================================================
CREATE POLICY "anyone_read_active_plans" ON public.subscription_plans
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "superadmin_manage_plans" ON public.subscription_plans
  FOR ALL USING (public.is_superadmin());

-- ============================================================
-- tenant_subscriptions policies
-- ============================================================
CREATE POLICY "superadmin_all_subscriptions" ON public.tenant_subscriptions
  FOR ALL USING (public.is_superadmin());

CREATE POLICY "tenant_read_own_subscription" ON public.tenant_subscriptions
  FOR SELECT USING (tenant_id = public.my_tenant_id());

-- ============================================================
-- tenant_members policies
-- ============================================================
CREATE POLICY "superadmin_all_members" ON public.tenant_members
  FOR ALL USING (public.is_superadmin());

CREATE POLICY "member_read_own_tenant_members" ON public.tenant_members
  FOR SELECT USING (tenant_id = public.my_tenant_id());

CREATE POLICY "user_read_own_membership" ON public.tenant_members
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- subscription_events policies
-- ============================================================
CREATE POLICY "superadmin_all_events" ON public.subscription_events
  FOR ALL USING (public.is_superadmin());

CREATE POLICY "tenant_read_own_events" ON public.subscription_events
  FOR SELECT USING (tenant_id = public.my_tenant_id());
