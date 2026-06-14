-- ============================================================
-- 005_export_from_old_db.sql
-- Jalankan di OLD DB (jqypnrwegqyjteparqpv) via SQL Editor
-- JANGAN jalankan di Core DB baru
--
-- Tujuan: export data tenants, subscriptions, members, plans
-- Setelah dapat hasilnya, paste ke Claude Code untuk generate
-- script import (006_import_to_core_db.sql)
-- ============================================================

-- 1. Export tenants
SELECT row_to_json(t) FROM public.tenants t;

-- 2. Export tenant_subscriptions
SELECT row_to_json(ts) FROM public.tenant_subscriptions ts;

-- 3. Export tenant_members
SELECT row_to_json(tm) FROM public.tenant_members tm;

-- 4. Export subscription_plans (hanya yang aktif)
SELECT row_to_json(sp) FROM public.subscription_plans sp WHERE is_active = TRUE;
