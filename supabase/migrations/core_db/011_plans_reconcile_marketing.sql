-- ============================================================
-- 011_plans_reconcile_marketing.sql
-- Core DB live: hxhusfkrlafxdnyasmsu
-- Reconcile subscription_plans to the (honesty-fixed) marketing prices so that
-- "displayed price == charged price". Also add Travel & Stock platforms and make
-- Starter the free tier. Idempotent — safe to re-run.
--
-- Canonical prices (monthly): yearly = monthly × 10.
--   LMS      Pro 499.000   Business 1.199.000
--   Klinik   Pro 599.000   Business 1.499.000
--   Farmasi  Pro 449.000   Business   999.000
--   Travel   Pro 749.000   Business 1.899.000   (NEW)
--   Stock    Pro 499.000   Business   999.000   (NEW)
-- tier 'enterprise' is shown to customers as "Business" via tier_display_name.
-- ============================================================

-- 0) Allow 'travel' and 'stock' platforms (CHECK constraints previously limited to lms/clinic/pharmacy/jastip)
ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_platform_check;
ALTER TABLE public.subscription_plans ADD  CONSTRAINT subscription_plans_platform_check
  CHECK (platform = ANY (ARRAY['lms','clinic','pharmacy','jastip','travel','stock']));
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_platform_check;
ALTER TABLE public.tenants ADD  CONSTRAINT tenants_platform_check
  CHECK (platform = ANY (ARRAY['lms','clinic','pharmacy','jastip','travel','stock']));

-- 1) Update Pro / Business (enterprise) prices for existing real platforms
UPDATE public.subscription_plans SET price_monthly=499000, price_yearly=4990000  WHERE platform='lms'      AND tier='pro';
UPDATE public.subscription_plans SET price_monthly=1199000,price_yearly=11990000 WHERE platform='lms'      AND tier='enterprise';
UPDATE public.subscription_plans SET price_monthly=599000, price_yearly=5990000  WHERE platform='clinic'   AND tier='pro';
UPDATE public.subscription_plans SET price_monthly=1499000,price_yearly=14990000 WHERE platform='clinic'   AND tier='enterprise';
UPDATE public.subscription_plans SET price_monthly=449000, price_yearly=4490000  WHERE platform='pharmacy' AND tier='pro';
UPDATE public.subscription_plans SET price_monthly=999000, price_yearly=9990000  WHERE platform='pharmacy' AND tier='enterprise';

-- 2) Make Starter the free tier (not chargeable) for the real platforms
UPDATE public.subscription_plans
   SET price_monthly=0, price_yearly=0, is_active=false
 WHERE tier='starter' AND platform IN ('lms','clinic','pharmacy','travel','stock');

-- 3) Customer-facing tier labels (checkout shows "Business", not "Enterprise")
UPDATE public.subscription_plans SET tier_display_name='Starter'  WHERE tier='starter'    AND platform IN ('lms','clinic','pharmacy','travel','stock');
UPDATE public.subscription_plans SET tier_display_name='Pro'      WHERE tier='pro'        AND platform IN ('lms','clinic','pharmacy','travel','stock');
UPDATE public.subscription_plans SET tier_display_name='Business' WHERE tier='enterprise' AND platform IN ('lms','clinic','pharmacy','travel','stock');

-- 4) Add Travel & Stock plans (idempotent insert by platform+tier)
INSERT INTO public.subscription_plans (platform, tier, name, tier_display_name, price_monthly, price_yearly, max_users, features, is_active)
SELECT v.platform, v.tier, v.name, v.tier_display_name, v.price_monthly, v.price_yearly, v.max_users, v.features::jsonb, v.is_active
FROM (VALUES
  -- Travel & Rental
  ('travel','starter','Travel Starter','Starter',0,0,NULL,'["10 Unit Aset","Booking Online","Konfirmasi Otomatis"]',false),
  ('travel','pro','Travel Pro','Pro',749000,7490000,NULL,'["Unlimited Unit","Anti Double Booking","Notif WA Otomatis","Laporan Pendapatan"]',true),
  ('travel','enterprise','Travel Business','Business',1899000,18990000,NULL,'["Multi-Lokasi","Custom Domain","API Pembayaran","Priority Support"]',true),
  -- Stock / Operasi
  ('stock','starter','Stock Starter','Starter',0,0,NULL,'["Akses penuh semua fitur Business","Coba 14 hari — tanpa kartu kredit","Data aman setelah trial berakhir"]',false),
  ('stock','pro','Stock Pro','Pro',499000,4990000,3,'["Unlimited Produk","Lacak Lot & Kadaluarsa (FEFO)","Laporan Omzet & HPP","3 Pengguna"]',true),
  ('stock','enterprise','Stock Business','Business',999000,9990000,NULL,'["WA Otomatis (Pembeli & Tim)","Modul Gaji & Slip via WA","Pengguna tak terbatas","Download Excel/PDF + Priority Support"]',true)
) AS v(platform, tier, name, tier_display_name, price_monthly, price_yearly, max_users, features, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans p
  WHERE p.platform = v.platform AND p.tier = v.tier
);
