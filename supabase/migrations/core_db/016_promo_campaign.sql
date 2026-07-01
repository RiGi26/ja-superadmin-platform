-- 016_promo_campaign.sql
-- Fase 2: engine promo diskon 50% x 3 bulan pertama, KHUSUS tier Pro (enterprise),
-- BULANAN saja, OTOMATIS saat kampanye aktif. Diterapkan live via MCP apply_migration;
-- file ini menjaga history migrasi repo tetap sinkron.
--
-- Diskon dihitung server-side (lib/billing.ts resolvePromoForCheckout). Kolom di
-- invoice = penanda/audit + basis hitung kuota (cap 3 invoice paid berpromo/tenant).
-- Config kampanye (toggle owner tanpa redeploy) = 1 baris JSON di platform_settings.

ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS promo_discount_percent INTEGER
    CHECK (promo_discount_percent IS NULL OR (promo_discount_percent >= 0 AND promo_discount_percent <= 100));

-- Index untuk hitung "sudah berapa bulan promo terpakai" per tenant (invoice paid berpromo).
CREATE INDEX IF NOT EXISTS idx_sub_invoices_promo_tenant
  ON public.subscription_invoices (tenant_id)
  WHERE promo_discount_percent > 0;

-- Config kampanye (single JSON, default OFF). Owner toggle tanpa redeploy.
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'promo_campaign',
  '{"active":false,"discountPct":50,"tier":"enterprise","months":3,"startDate":null,"endDate":null,"code":"PROMO_PRO_50_3M"}',
  now()
)
ON CONFLICT (key) DO NOTHING;
