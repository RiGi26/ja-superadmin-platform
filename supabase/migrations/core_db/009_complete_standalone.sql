-- ============================================================
-- 009_complete_standalone.sql
-- Core DB standalone: hxhusfkrlafxdnyasmsu
-- Jalankan di SQL Editor Core DB (BUKAN OLD/LMS DB).
--
-- Tujuan: lengkapi Core agar app superadmin (create-tenant + 4 dashboard)
-- berfungsi penuh sebagai DB standalone. Jalur 1 (ADITIF) — samakan Core
-- ke skema yang kode app sudah pakai. Tidak mengubah kode app.
--
-- Aman untuk billing Phase 1 (lib/billing.ts hanya pakai status
-- 'unpaid'/'awaiting_payment'/'active' — semua tetap valid).
-- Idempotent: aman dijalankan ulang.
-- ============================================================

-- ------------------------------------------------------------
-- 1. tenants: kolom yang dipakai create-tenant + tenant detail
-- ------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 2. tenant_members: kolom yang dipakai create-tenant + tenant detail
--    (app pakai joined_at, is_active, invited_by — Core hanya punya created_at)
-- ------------------------------------------------------------
ALTER TABLE public.tenant_members
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN     NOT NULL DEFAULT TRUE;

-- backfill joined_at dari created_at bila ada baris lama
UPDATE public.tenant_members SET joined_at = created_at WHERE joined_at IS DISTINCT FROM created_at AND created_at IS NOT NULL;

-- ------------------------------------------------------------
-- 3. tenant_subscriptions: izinkan status 'trial' (create-tenant insert 'trial')
--    + 'trialing' (fresh schema) — keduanya valid agar tak ada dialek pecah.
-- ------------------------------------------------------------
ALTER TABLE public.tenant_subscriptions DROP CONSTRAINT IF EXISTS tenant_subscriptions_status_check;
ALTER TABLE public.tenant_subscriptions
  ADD CONSTRAINT tenant_subscriptions_status_check
  CHECK (status IN ('trial','trialing','active','past_due','cancelled','unpaid'));

-- ------------------------------------------------------------
-- 3b. subscription_plans: kolom tier_display_name (dipakai create-tenant
--     `plan.tier_display_name.toLowerCase()`, tenants/new, subscriptions,
--     tenant detail). Core fresh hanya punya `tier` + `name`.
--     Backfill = initcap(tier) → 'Starter'/'Pro'/'Enterprise'
--     → .toLowerCase() == plan_tier check ('starter'/'pro'/'enterprise').
-- ------------------------------------------------------------
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS tier_display_name TEXT;
UPDATE public.subscription_plans
  SET tier_display_name = initcap(tier)
  WHERE tier_display_name IS NULL;

-- ------------------------------------------------------------
-- 4. public.users — profil user (dipakai create-tenant insert + tenant detail read)
--    Dashboard baca via service_role (createAdminClient) → RLS cukup minimal.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  full_name  TEXT,
  email      TEXT,
  phone      TEXT,
  role       TEXT NOT NULL DEFAULT 'member'
             CHECK (role IN ('superadmin','owner','admin','member','student')),
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active','inactive','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass_users" ON public.users;
CREATE POLICY "service_role_bypass_users" ON public.users
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "superadmin_all_users" ON public.users;
CREATE POLICY "superadmin_all_users" ON public.users
  FOR ALL USING ((auth.jwt() ->> 'user_role') = 'superadmin');
DROP POLICY IF EXISTS "self_read_users" ON public.users;
CREATE POLICY "self_read_users" ON public.users
  FOR SELECT USING (id = auth.uid());

-- ------------------------------------------------------------
-- 5. leads — form interest landing page (dipakai dashboard/leads)
--    Disalin dari 20260524_leads_table.sql (di luar core_db, tak ikut bootstrap).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone_wa      TEXT,
  business_name TEXT,
  platforms     TEXT[],
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','contacted','converted','rejected')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass_leads" ON public.leads;
CREATE POLICY "service_role_bypass_leads" ON public.leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "superadmin_all_leads" ON public.leads;
CREATE POLICY "superadmin_all_leads" ON public.leads
  FOR ALL USING ((auth.jwt() ->> 'user_role') = 'superadmin');
DROP POLICY IF EXISTS "anon_insert_leads" ON public.leads;
CREATE POLICY "anon_insert_leads" ON public.leads
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- SELESAI skema. Langkah NON-SQL (lihat checklist di PLAN-BILLING-TERPUSAT.md §12):
--   - Buat user superadmin di Core (Auth → Users) + set SUPERADMIN_EMAIL.
--   - Pasang JWT hook custom_jwt_claims (Auth → Hooks).
--   - Import data tenant riil (lihat 010_backfill_real_tenants.sql).
-- ============================================================
