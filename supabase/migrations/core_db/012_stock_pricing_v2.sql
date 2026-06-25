-- 012_stock_pricing_v2.sql
-- Reposisi paket Portal Operasi (Stock) ke struktur 4-kartu marketing:
--   Trial (gratis 14 hari, bukan plan — status langganan) | Starter | Growth | Pro
-- Pemetaan display → enum Core (subscription_plans.tier):
--   Starter (Rp 500rb)  → tier 'starter'     (1 seat)
--   Growth  (Rp 750rb)  → tier 'pro'         (3 seat, popular)
--   Pro     (Rp 1jt)    → tier 'enterprise'  (unlimited seat)
-- Murni UPDATE 3 baris yang sudah ada (platform/tier = TEXT, tanpa DDL).
-- Sinkron dgn kartu di ja-corp-landing/app/pricing/PricingPageClient.tsx.
-- price_yearly = bulanan × 10 (2 bulan gratis). Promo "bulan 1 gratis / separuh bln 2-4"
-- = copy marketing, belum ditegakkan engine billing.

-- Starter (Rp 500.000) — sebelumnya gratis/inactive
UPDATE public.subscription_plans
SET name              = 'Stock Starter',
    tier_display_name = 'Starter',
    price_monthly     = 500000,
    price_yearly      = 5000000,
    max_users         = 1,
    is_active         = true,
    features          = '["Dashboard ringkasan omzet & pesanan harian","Kelola pesanan (status: menunggu → dikirim)","Invoice & label pengiriman otomatis","Notifikasi WhatsApp ke pelanggan otomatis","Manajemen produk & katalog","1 akun admin"]'::jsonb
WHERE platform = 'stock' AND tier = 'starter';

-- Growth (Rp 750.000) — enum 'pro', kartu populer
UPDATE public.subscription_plans
SET name              = 'Stock Growth',
    tier_display_name = 'Growth',
    price_monthly     = 750000,
    price_yearly      = 7500000,
    max_users         = 3,
    is_active         = true,
    features          = '["Semua fitur Starter","Stok & lot tracking + stok opname","Pemantauan kadaluarsa (expiry monitoring)","Manajemen pemasok (purchase order)","Laporan keuangan & arus kas otomatis","Sampai 3 akun tim & hak akses","Verifikasi pembayaran manual & COD"]'::jsonb
WHERE platform = 'stock' AND tier = 'pro';

-- Pro (Rp 1.000.000) — enum 'enterprise', unlimited seat
UPDATE public.subscription_plans
SET name              = 'Stock Pro',
    tier_display_name = 'Pro',
    price_monthly     = 1000000,
    price_yearly      = 10000000,
    max_users         = NULL,
    is_active         = true,
    features          = '["Semua fitur Growth","Resep / BOM & modul Produksi","Perencanaan produksi (MRP)","SDM & Penggajian tim produksi","Akun & hak akses tim tanpa batas","Konfigurasi & white-label penuh","Prioritas dukungan teknis"]'::jsonb
WHERE platform = 'stock' AND tier = 'enterprise';
