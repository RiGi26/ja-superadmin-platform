-- 015_press_prices_2026-07.sql
-- Fase 1: turunkan (press) harga langganan portal agar kompetitif dengan pasar
-- SaaS UMKM Indonesia (riset terverifikasi Juni 2026, 5 vertikal). Masalah utama:
-- Stock & Travel salah-harga parah menyeret persepsi seluruh halaman /pricing.
--
-- Aturan: price_yearly = price_monthly * 10 (2 bulan gratis).
-- Mapping tier tampilan -> core enum: Starter->starter, Growth->pro, Pro->enterprise.
-- Platform 'jastip' TIDAK disentuh (prototype, tidak tampil di /pricing).

-- Pharmacy
UPDATE subscription_plans SET price_monthly=149000, price_yearly=1490000 WHERE platform='pharmacy' AND tier='starter';
UPDATE subscription_plans SET price_monthly=399000, price_yearly=3990000 WHERE platform='pharmacy' AND tier='pro';
UPDATE subscription_plans SET price_monthly=799000, price_yearly=7990000 WHERE platform='pharmacy' AND tier='enterprise';

-- LMS
UPDATE subscription_plans SET price_monthly=149000, price_yearly=1490000 WHERE platform='lms' AND tier='starter';
UPDATE subscription_plans SET price_monthly=399000, price_yearly=3990000 WHERE platform='lms' AND tier='pro';
UPDATE subscription_plans SET price_monthly=899000, price_yearly=8990000 WHERE platform='lms' AND tier='enterprise';

-- Clinic
UPDATE subscription_plans SET price_monthly=199000, price_yearly=1990000 WHERE platform='clinic' AND tier='starter';
UPDATE subscription_plans SET price_monthly=499000, price_yearly=4990000 WHERE platform='clinic' AND tier='pro';
UPDATE subscription_plans SET price_monthly=1199000, price_yearly=11990000 WHERE platform='clinic' AND tier='enterprise';

-- Travel
UPDATE subscription_plans SET price_monthly=149000, price_yearly=1490000 WHERE platform='travel' AND tier='starter';
UPDATE subscription_plans SET price_monthly=399000, price_yearly=3990000 WHERE platform='travel' AND tier='pro';
UPDATE subscription_plans SET price_monthly=799000, price_yearly=7990000 WHERE platform='travel' AND tier='enterprise';

-- Stock
UPDATE subscription_plans SET price_monthly=199000, price_yearly=1990000 WHERE platform='stock' AND tier='starter';
UPDATE subscription_plans SET price_monthly=399000, price_yearly=3990000 WHERE platform='stock' AND tier='pro';
UPDATE subscription_plans SET price_monthly=899000, price_yearly=8990000 WHERE platform='stock' AND tier='enterprise';
