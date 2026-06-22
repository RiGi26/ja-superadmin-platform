-- ============================================================
-- 010_backfill_real_tenants.sql
-- Jalankan di Core DB (hxhusfkrlafxdnyasmsu) SETELAH 009.
--
-- Import HANYA tenant LMS nyata (bukan demo) ke Core sebagai master.
-- ID di Core = ID di LMS (jqypnrwegqyjteparqpv) → linked_tenant_id
-- diset identik → jembatan lintas-DB tanpa tabel mapping terpisah.
--
-- Demo/test LMS sengaja TIDAK diimport (lihat 006 untuk daftar lengkap).
-- tenant_members & owner_user_id dikosongkan dulu (butuh auth.users Core
-- — diisi saat user superadmin/owner dibuat, atau saat onboarding ulang).
-- Idempotent (ON CONFLICT DO NOTHING).
-- ============================================================

-- 1. Japan Arena Academy (milik sendiri — enterprise, aktif)
INSERT INTO public.tenants
  (id, name, slug, platform, status, plan_tier, linked_tenant_id, metadata, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Japan Arena Academy', 'japan-arena', 'lms', 'active', 'enterprise',
   '00000000-0000-0000-0000-000000000001',
   '{"source":"lms-backfill"}'::jsonb,
   '2026-05-18T12:21:24.103177+00:00', NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. PT SUKA MAJU (tenant nyata — pro, trial)
INSERT INTO public.tenants
  (id, name, slug, platform, status, plan_tier, linked_tenant_id, metadata, created_at, updated_at)
VALUES
  ('38997a1c-1c46-4153-925f-978d02e1192f',
   'PT SUKA MAJU', 'pt-suka-maju', 'lms', 'trial', 'pro',
   '38997a1c-1c46-4153-925f-978d02e1192f',
   '{"source":"lms-backfill"}'::jsonb,
   '2026-05-25T03:08:02.851+00:00', NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Subscription Japan Arena Academy — enterprise active
INSERT INTO public.tenant_subscriptions
  (tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.subscription_plans WHERE platform='lms' AND tier='enterprise' LIMIT 1),
  'active',
  NOW(), NOW() + INTERVAL '1 year', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001'
);

-- 4. Subscription PT SUKA MAJU — pro trial
INSERT INTO public.tenant_subscriptions
  (tenant_id, plan_id, status, trial_ends_at, current_period_start, created_at, updated_at)
SELECT
  '38997a1c-1c46-4153-925f-978d02e1192f',
  (SELECT id FROM public.subscription_plans WHERE platform='lms' AND tier='pro' LIMIT 1),
  'trial',
  '2026-06-08T02:37:09.169+00:00', '2026-05-25T03:08:02.851+00:00', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_subscriptions WHERE tenant_id='38997a1c-1c46-4153-925f-978d02e1192f'
);
