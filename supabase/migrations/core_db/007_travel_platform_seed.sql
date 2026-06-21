-- ============================================================
-- 007_travel_platform_seed.sql
-- Core DB: jexpxecxylyeefywdzpd
-- Tambah platform 'travel' dan seed demo tenant + members
-- untuk ja-rental-platform (ja-travel-platform)
--
-- JALANKAN DI: SQL Editor Core DB (bukan Rental DB)
-- Core DB URL: https://jexpxecxylyeefywdzpd.supabase.co
-- ============================================================

-- ── Step 1: Extend platform CHECK constraint ───────────────────
-- Constraint lama hanya: ('lms','clinic','pharmacy','jastip')
-- Perlu tambah 'travel' dan 'rental' untuk rental platform

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_platform_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_platform_check
    CHECK (platform IN ('lms','clinic','pharmacy','jastip','travel','rental'));


-- ── Step 2: Insert JaTravel Demo tenant ke Core DB ─────────────
-- Tenant ini juga ada di Rental DB (mmwudanyyeyxuxfpudcy) untuk
-- data operasional, tapi Core DB butuh record ini agar JWT hook
-- bisa inject tenant_id, tenant_slug, user_role ke JWT claims.

INSERT INTO public.tenants (id, name, slug, platform, status, plan_tier)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'JaTravel Demo',
  'jatravel-demo',
  'travel',
  'active',
  'pro'
)
ON CONFLICT (id) DO UPDATE SET
  name      = EXCLUDED.name,
  slug      = EXCLUDED.slug,
  platform  = EXCLUDED.platform,
  status    = EXCLUDED.status,
  plan_tier = EXCLUDED.plan_tier;


-- ── Step 3: Insert demo users ke Core DB tenant_members ────────
-- admin@demo.com  → UUID e1eda9d5-b6e1-48e8-a4c8-b7220e8d9472
-- driver@demo.com → UUID 2cdfd68a-e4a0-4617-9c0b-8e189096417f
--
-- PENTING: user UUID ini HARUS sudah ada di auth.users Core DB.
-- Jika belum ada (mis. baru dibuat manual), pastikan dulu di:
--   Core DB Dashboard → Authentication → Users
-- Baru jalankan INSERT ini.

INSERT INTO public.tenant_members (tenant_id, user_id, role, platform_role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'e1eda9d5-b6e1-48e8-a4c8-b7220e8d9472',
  'admin',
  NULL
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
  role          = 'admin',
  platform_role = NULL;

INSERT INTO public.tenant_members (tenant_id, user_id, role, platform_role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '2cdfd68a-e4a0-4617-9c0b-8e189096417f',
  'member',
  'driver'
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
  role          = 'member',
  platform_role = 'driver';


-- ── Verification: jalankan ini untuk konfirmasi ────────────────
SELECT
  tm.user_id,
  u.email,
  tm.role,
  tm.platform_role,
  t.slug  AS tenant_slug,
  t.platform
FROM public.tenant_members tm
JOIN public.tenants t ON t.id = tm.tenant_id
JOIN auth.users u     ON u.id = tm.user_id
WHERE t.slug = 'jatravel-demo';
-- Harus muncul 2 rows: admin@demo.com (admin) dan driver@demo.com (member/driver)
