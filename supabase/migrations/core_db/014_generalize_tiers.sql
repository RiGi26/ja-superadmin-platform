-- 014_generalize_tiers.sql
-- Seragamkan model paket semua portal ke skema Stock (keputusan owner 2026-06-25):
--   Trial (14 hari, satu-satunya GRATIS) → Starter / Growth / Pro semua BERBAYAR.
-- Sebelumnya portal non-stock punya Starter GRATIS (is_active=false) + Pro/Business.
--
-- 1) Starter jadi berbayar + aktif (harga entry disetujui owner).
update public.subscription_plans set price_monthly=249000, price_yearly=2490000, is_active=true
  where platform='lms' and tier='starter';
update public.subscription_plans set price_monthly=299000, price_yearly=2990000, is_active=true
  where platform='clinic' and tier='starter';
update public.subscription_plans set price_monthly=199000, price_yearly=1990000, is_active=true
  where platform='pharmacy' and tier='starter';
update public.subscription_plans set price_monthly=349000, price_yearly=3490000, is_active=true
  where platform='travel' and tier='starter';

-- 2) Nama tampilan seragam: enum pro→"Growth", enterprise→"Pro" (stock sudah begitu).
--    Enum tier, harga Growth/Pro, dan struktur TIDAK berubah — hanya label + Starter.
update public.subscription_plans set tier_display_name='Growth'
  where tier='pro' and platform in ('lms','clinic','pharmacy','travel','jastip');
update public.subscription_plans set tier_display_name='Pro'
  where tier='enterprise' and platform in ('lms','clinic','pharmacy','travel','jastip');
