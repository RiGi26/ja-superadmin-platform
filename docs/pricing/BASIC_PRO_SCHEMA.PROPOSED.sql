-- PROPOSED ONLY. NOT an applied or registered migration.
-- Target: Core hxhusfkrlafxdnyasmsu / public.subscription_plans.
-- Obtain exact-object runtime authority, verify live schema/IDs/constraints,
-- generate a forward migration with the approved Supabase CLI, and rehearse first.
-- This preparation never enables sales or updates legacy prices/subscriptions/invoices.
BEGIN;

ALTER TABLE public.subscription_plans
  ADD COLUMN offer_version text,
  ADD COLUMN public_tier text CHECK (public_tier IN ('basic', 'pro')),
  ADD COLUMN is_for_sale boolean NOT NULL DEFAULT true,
  ADD COLUMN allowed_periods text[] NOT NULL DEFAULT ARRAY['monthly','yearly']::text[],
  ADD COLUMN entitlement_contract jsonb;
ALTER TABLE public.subscription_plans ALTER COLUMN price_yearly DROP NOT NULL;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plan_offer_contract_check CHECK (
  (offer_version IS NULL AND public_tier IS NULL AND entitlement_contract IS NULL AND price_yearly IS NOT NULL)
  OR
  (offer_version IS NOT NULL AND offer_version = 'basic-pro-2026-10-v1' AND platform IN ('lms','stock')
    AND public_tier IS NOT NULL AND entitlement_contract IS NOT NULL
    AND allowed_periods = ARRAY['monthly']::text[] AND price_yearly IS NULL)
);
CREATE UNIQUE INDEX subscription_plans_version_public_tier_idx
  ON public.subscription_plans (platform, offer_version, public_tier)
  WHERE offer_version IS NOT NULL;

INSERT INTO public.subscription_plans
 (id, platform, tier, name, tier_display_name, price_monthly, price_yearly, max_users,
  features, is_active, offer_version, public_tier, is_for_sale, allowed_periods, entitlement_contract)
VALUES
 ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a1001','lms','starter','LMS Basic','Basic',119000,NULL,100,
  '["100 siswa aktif","200 MiB lampiran materi","Materi, kuis, dan flashcard","Administrasi dan absensi siswa"]',false,
  'basic-pro-2026-10-v1','basic',false,ARRAY['monthly'],
  '{"portal_tier":"starter","features":["materials","quiz","flashcard","students"],"max_active_users":100,"storage_bytes":209715200}'),
 ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a1002','lms','pro','LMS Pro','Pro',299000,NULL,500,
  '["500 siswa aktif","1 GiB lampiran materi","Semua fitur Basic","Laporan, jadwal kelas, dan keuangan","Buku salah, ranking, dan kuis langsung"]',false,
  'basic-pro-2026-10-v1','pro',false,ARRAY['monthly'],
  '{"portal_tier":"growth","features":["materials","quiz","flashcard","students","reports","schedule","finance","review_book","leaderboard","live_quiz"],"max_active_users":500,"storage_bytes":1073741824}'),
 ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001','stock','starter','Stock Basic','Basic',149000,NULL,1,
  '["1 akun operator aktif","Pesanan dan katalog","Invoice dan label pengiriman","Stok, lot, opname, dan pemantauan kedaluwarsa"]',false,
  'basic-pro-2026-10-v1','basic',false,ARRAY['monthly'],
  '{"portal_tier":"starter","features":["orders","catalog","stock"],"max_active_users":1,"storage_bytes":null}'),
 ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002','stock','pro','Stock Pro','Pro',359000,NULL,3,
  '["3 akun operator aktif","Semua fitur Basic","Pemasok dan purchase order","Laporan keuangan dan arus kas"]',false,
  'basic-pro-2026-10-v1','pro',false,ARRAY['monthly'],
  '{"portal_tier":"growth","features":["orders","catalog","stock","suppliers","finance"],"max_active_users":3,"storage_bytes":null}');

-- Contract terms become immutable for versioned plans and referenced legacy plans.
-- Sale visibility and is_active remain operational fields; recovery should disable
-- is_for_sale, not invalidate an existing paid customer's active contract.
CREATE FUNCTION public.enforce_subscription_plan_contract_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.offer_version IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.tenant_subscriptions s WHERE s.plan_id = OLD.id OR s.scheduled_plan_id = OLD.id)
    OR EXISTS (SELECT 1 FROM public.subscription_invoices i WHERE i.plan_id = OLD.id)
  THEN
    IF ROW(NEW.id,NEW.platform,NEW.tier,NEW.name,NEW.tier_display_name,NEW.price_monthly,NEW.price_yearly,
           NEW.max_users,NEW.features,NEW.offer_version,NEW.public_tier,NEW.allowed_periods,NEW.entitlement_contract)
       IS DISTINCT FROM
       ROW(OLD.id,OLD.platform,OLD.tier,OLD.name,OLD.tier_display_name,OLD.price_monthly,OLD.price_yearly,
           OLD.max_users,OLD.features,OLD.offer_version,OLD.public_tier,OLD.allowed_periods,OLD.entitlement_contract)
    THEN
      RAISE EXCEPTION 'Referenced subscription contract is immutable; create a new plan version';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_subscription_plan_contract_immutability() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER subscription_plan_contract_immutable BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_plan_contract_immutability();

COMMIT;

-- Deliberately absent: activation UPDATE, legacy plan deletion/repricing,
-- invoice/subscription changes, RLS/ownership changes, grants, payment activation.
