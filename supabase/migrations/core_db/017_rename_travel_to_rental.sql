-- 017_rename_travel_to_rental.sql
-- Rename the SaaS-platform identifier 'travel' -> 'rental' to restore the canonical
-- name. 'travel' was drift introduced by 011_plans_reconcile_marketing.sql; the
-- canonical schema (core_schema.sql) always intended 'rental' (the portal, repo
-- ja-rental-platform, and domain rent.webzoka.com all use "rental").
--
-- Safe: at migration time there are 0 tenants on platform='travel'; only the 3
-- subscription_plans rows (starter/pro/enterprise) move. 3-step ordering keeps the
-- CHECK constraint from rejecting existing rows mid-migration.
-- Applied to live Core (hxhus) via MCP 2026-07-02.

-- step 1: widen both CHECK constraints to allow BOTH strings during transition
ALTER TABLE public.subscription_plans DROP CONSTRAINT subscription_plans_platform_check;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_platform_check
  CHECK (platform = ANY (ARRAY['lms','clinic','pharmacy','jastip','travel','rental','stock']));
ALTER TABLE public.tenants DROP CONSTRAINT tenants_platform_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_platform_check
  CHECK (platform = ANY (ARRAY['lms','clinic','pharmacy','jastip','travel','rental','stock']));

-- step 2: migrate data
UPDATE public.subscription_plans SET platform = 'rental' WHERE platform = 'travel';
UPDATE public.tenants           SET platform = 'rental' WHERE platform = 'travel';

-- step 3: tighten both constraints to final (drop 'travel')
ALTER TABLE public.subscription_plans DROP CONSTRAINT subscription_plans_platform_check;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_platform_check
  CHECK (platform = ANY (ARRAY['lms','clinic','pharmacy','jastip','rental','stock']));
ALTER TABLE public.tenants DROP CONSTRAINT tenants_platform_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_platform_check
  CHECK (platform = ANY (ARRAY['lms','clinic','pharmacy','jastip','rental','stock']));
