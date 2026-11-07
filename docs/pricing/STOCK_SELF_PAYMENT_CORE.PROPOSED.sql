-- Forward source proposal: Core hxhusfkrlafxdnyasmsu only.
-- Requires exact-object migration approval. Does not enable sales or payments.
-- Historical Registry, quarantine and payment migrations remain unchanged.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR to_regnamespace('stock_billing_private') IS NOT NULL
   OR to_regprocedure('public.apply_verified_subscription_payment(text,text,integer,jsonb)') IS NULL
   OR to_regprocedure('public.core_registry_session_is_live()') IS NULL
   OR to_regclass('core_e1_resource_private.stock_bindings') IS NULL THEN RAISE EXCEPTION 'STOCK_BILLING_BASELINE_DRIFT'; END IF;
END $preflight$;

CREATE SCHEMA stock_billing_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA stock_billing_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE stock_billing_private.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled boolean NOT NULL DEFAULT false,
  payment_mode text NOT NULL DEFAULT 'sandbox' CHECK(payment_mode IN ('sandbox','production'))
);
INSERT INTO stock_billing_private.settings VALUES(true,false,'sandbox');

CREATE TABLE stock_billing_private.intents (
  owner_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  command_id uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX stock_billing_intent_company_idx ON stock_billing_private.intents(company_id);

CREATE TABLE stock_billing_private.accounts (
  company_id uuid PRIMARY KEY REFERENCES core_e1_resource_private.origins(company_id) ON DELETE RESTRICT,
  reservation_id uuid NOT NULL UNIQUE REFERENCES core_e1_resource_private.origins(reservation_id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL,
  auth_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX stock_billing_account_owner_idx ON stock_billing_private.accounts(owner_id);

-- Empty finite sandbox cohort. Enrollment is a separate exact-Company approval;
-- it cannot establish ownership, activate public offers or grant product access.
CREATE TABLE stock_billing_private.sandbox_cohort (
  company_id uuid PRIMARY KEY REFERENCES core_e1_resource_private.origins(company_id) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_until timestamptz NOT NULL,
  CHECK(valid_until>created_at AND valid_until<=created_at+interval '6 hours')
);

CREATE TABLE stock_billing_private.deliveries (
  invoice_id uuid PRIMARY KEY REFERENCES public.subscription_invoices(id) ON DELETE RESTRICT,
  delivery_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES stock_billing_private.accounts(tenant_id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active','superseded')),
  acknowledged_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX stock_billing_delivery_pending_idx ON stock_billing_private.deliveries(tenant_id,created_at DESC) WHERE state='pending';
CREATE INDEX stock_billing_delivery_plan_idx ON stock_billing_private.deliveries(plan_id);

CREATE TABLE stock_billing_private.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK(action IN ('billing.prepared','billing.payment_verified','billing.stock_activated')),
  invoice_id uuid REFERENCES public.subscription_invoices(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(action,invoice_id)
);
CREATE INDEX stock_billing_event_company_idx ON stock_billing_private.events(company_id,created_at DESC);
CREATE INDEX stock_billing_event_actor_idx ON stock_billing_private.events(actor_id);
CREATE INDEX stock_billing_event_invoice_idx ON stock_billing_private.events(invoice_id);

DO $rls$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['settings','intents','accounts','deliveries','events','sandbox_cohort'] LOOP
    EXECUTE format('ALTER TABLE stock_billing_private.%I ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('ALTER TABLE stock_billing_private.%I FORCE ROW LEVEL SECURITY',name);
  END LOOP;
END $rls$;
REVOKE ALL ON ALL TABLES IN SCHEMA stock_billing_private FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION stock_billing_private.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN RAISE EXCEPTION 'STOCK_BILLING_IMMUTABLE'; END $fn$;
CREATE TRIGGER stock_billing_event_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_billing_private.events
  FOR EACH STATEMENT EXECUTE FUNCTION stock_billing_private.immutable();
CREATE TRIGGER stock_billing_account_no_delete BEFORE DELETE OR TRUNCATE ON stock_billing_private.accounts
  FOR EACH STATEMENT EXECUTE FUNCTION stock_billing_private.immutable();
CREATE TRIGGER stock_billing_delivery_no_delete BEFORE DELETE OR TRUNCATE ON stock_billing_private.deliveries
  FOR EACH STATEMENT EXECUTE FUNCTION stock_billing_private.immutable();
CREATE TRIGGER stock_billing_cohort_no_delete BEFORE DELETE OR TRUNCATE ON stock_billing_private.sandbox_cohort
  FOR EACH STATEMENT EXECUTE FUNCTION stock_billing_private.immutable();
CREATE FUNCTION stock_billing_private.guard_cohort() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF OLD.enabled IS NOT TRUE OR NEW.enabled IS NOT FALSE OR (to_jsonb(OLD)-'enabled') IS DISTINCT FROM (to_jsonb(NEW)-'enabled')
 THEN RAISE EXCEPTION 'STOCK_BILLING_COHORT_IMMUTABLE'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER stock_billing_cohort_identity BEFORE UPDATE ON stock_billing_private.sandbox_cohort
  FOR EACH ROW EXECUTE FUNCTION stock_billing_private.guard_cohort();

CREATE FUNCTION stock_billing_private.guard_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
  IF TG_TABLE_NAME='accounts' AND (to_jsonb(NEW)-ARRAY['session_id','auth_until']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['session_id','auth_until'])
    OR TG_TABLE_NAME='deliveries' AND (to_jsonb(NEW)-ARRAY['state','acknowledged_at','last_attempt_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','acknowledged_at','last_attempt_at']) THEN
    RAISE EXCEPTION 'STOCK_BILLING_IDENTITY_IMMUTABLE';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER stock_billing_account_identity BEFORE UPDATE ON stock_billing_private.accounts
  FOR EACH ROW EXECUTE FUNCTION stock_billing_private.guard_identity();
CREATE TRIGGER stock_billing_delivery_identity BEFORE UPDATE ON stock_billing_private.deliveries
  FOR EACH ROW EXECUTE FUNCTION stock_billing_private.guard_identity();

CREATE FUNCTION stock_billing_private.current_owner(p_company uuid,p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM core_e1_resource_private.origins o
   JOIN public.companies c ON c.id=o.company_id
   JOIN public.company_memberships m ON m.id=o.membership_id AND m.company_id=o.company_id AND m.core_auth_user_id=o.core_subject
   JOIN public.company_portal_instances i ON i.id=o.reservation_id AND i.company_id=o.company_id
   WHERE o.company_id=p_company AND o.core_subject=p_actor AND c.status='active' AND m.role='owner' AND m.status='active'
     AND o.source='core.e1.resource.v1' AND (SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id=p_actor)=1
     AND i.portal_type='stock' AND i.lifecycle_status='reserved' AND i.legacy_tenant_id IS NULL AND i.portal_instance_id IS NULL
     AND NOT EXISTS(SELECT 1 FROM core_registry_private.operators WHERE subject_id=p_actor AND active))
$fn$;

CREATE FUNCTION stock_billing_private.approved_plan(p_plan uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.subscription_plans p WHERE p.id=p_plan AND p.platform='stock'
   AND p.offer_version='basic-pro-2026-10-v1' AND p.price_yearly IS NULL AND p.allowed_periods=ARRAY['monthly']::text[]
   AND ((p.id='5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001' AND p.public_tier='basic' AND p.tier='starter'
     AND p.tier_display_name='Basic' AND p.price_monthly=149000 AND p.entitlement_contract=
       '{"portal_tier":"starter","features":["orders","catalog","stock"],"max_active_users":1,"storage_bytes":null}'::jsonb)
   OR (p.id='5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002' AND p.public_tier='pro' AND p.tier='pro'
     AND p.tier_display_name='Pro' AND p.price_monthly=359000 AND p.entitlement_contract=
       '{"portal_tier":"growth","features":["orders","catalog","stock","suppliers","finance"],"max_active_users":3,"storage_bytes":null}'::jsonb)))
$fn$;

-- Retained pilot history is never converted into a normal commercial account.
-- A legacy or contested business must use the existing protected proof process.
CREATE FUNCTION stock_billing_private.paid_creation_allowed(p_core uuid,p_stock uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE retained boolean;
BEGIN
 IF to_regclass('core_stock_pilot_private.authority') IS NOT NULL THEN
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM core_stock_pilot_private.authority WHERE core_subject=$1 OR stock_subject=$2)'
     INTO retained USING p_core,p_stock;
   IF retained THEN RETURN false; END IF;
 END IF;
 IF to_regclass('core_stock_pilot_private.cohort') IS NOT NULL THEN
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM core_stock_pilot_private.cohort WHERE core_subject=$1)'
     INTO retained USING p_core;
   IF retained THEN RETURN false; END IF;
 END IF;
 RETURN true;
END $fn$;

CREATE FUNCTION stock_billing_private.require_service_actor(p_actor uuid,p_session uuid,p_until timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_session IS NULL OR p_until IS NULL
   OR p_until<=clock_timestamp() OR p_until>clock_timestamp()+interval '30 seconds'
   OR NOT EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled) THEN RAISE EXCEPTION 'STOCK_BILLING_DENIED'; END IF;
 IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes',0)) THEN
   RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_BILLING_REAUTHENTICATE';
 END IF;
END $fn$;

CREATE FUNCTION public.stock_billing_sandbox_allowed(p_tenant uuid,p_plan uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT auth.role()='service_role' AND stock_billing_private.approved_plan(p_plan)
   AND EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode='sandbox')
   AND EXISTS(SELECT 1 FROM stock_billing_private.sandbox_cohort c
     JOIN core_e1_resource_private.origins o ON o.company_id=c.company_id AND o.core_tenant_id=p_tenant
     JOIN core_e1_resource_private.stock_bindings b ON b.reservation_id=o.reservation_id
     WHERE c.enabled AND c.valid_until>clock_timestamp() AND stock_billing_private.current_owner(o.company_id,o.core_subject))
$fn$;

CREATE FUNCTION public.stock_billing_remember_intent(p_actor uuid,p_session uuid,p_auth_until timestamptz,p_plan uuid,p_company uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE selected uuid; result stock_billing_private.intents%ROWTYPE;
BEGIN
 PERFORM stock_billing_private.require_service_actor(p_actor,p_session,p_auth_until);
 IF NOT stock_billing_private.approved_plan(p_plan)
   OR p_company IS NOT NULL AND NOT stock_billing_private.current_owner(p_company,p_actor) THEN RAISE EXCEPTION 'STOCK_BILLING_DENIED'; END IF;
 SELECT reservation_id INTO selected FROM core_e1_resource_private.origins WHERE company_id=p_company;
 INSERT INTO stock_billing_private.intents(owner_id,plan_id,company_id,expires_at) VALUES(p_actor,p_plan,p_company,clock_timestamp()+interval '7 days')
 ON CONFLICT(owner_id) DO UPDATE SET plan_id=excluded.plan_id,company_id=excluded.company_id,expires_at=excluded.expires_at,
   command_id=CASE WHEN stock_billing_private.intents.company_id IS NOT DISTINCT FROM excluded.company_id THEN stock_billing_private.intents.command_id ELSE gen_random_uuid() END
 RETURNING * INTO result;
 RETURN jsonb_build_object('planId',result.plan_id,'companyId',result.company_id,'reservationId',selected,'commandId',result.command_id);
END $fn$;

CREATE FUNCTION public.stock_billing_read_intent() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT jsonb_build_object('planId',i.plan_id,'companyId',i.company_id,'reservationId',o.reservation_id,'commandId',i.command_id)
 FROM stock_billing_private.intents i LEFT JOIN core_e1_resource_private.origins o ON o.company_id=i.company_id AND o.core_subject=auth.uid()
 WHERE auth.role()='authenticated' AND public.core_registry_session_is_live() AND i.owner_id=auth.uid() AND i.expires_at>clock_timestamp()
   AND stock_billing_private.approved_plan(i.plan_id)
   AND (i.company_id IS NULL OR stock_billing_private.current_owner(i.company_id,auth.uid()))
$fn$;

CREATE FUNCTION public.stock_billing_prepare_account(p_actor uuid,p_session uuid,p_auth_until timestamptz,p_company uuid,p_reservation uuid,p_plan uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE o core_e1_resource_private.origins%ROWTYPE; b core_e1_resource_private.stock_bindings%ROWTYPE; a stock_billing_private.accounts%ROWTYPE; company_name text;
BEGIN
 PERFORM stock_billing_private.require_service_actor(p_actor,p_session,p_auth_until);
 IF NOT stock_billing_private.current_owner(p_company,p_actor) OR NOT stock_billing_private.approved_plan(p_plan) THEN RAISE EXCEPTION 'STOCK_BILLING_DENIED'; END IF;
 SELECT * INTO STRICT o FROM core_e1_resource_private.origins WHERE company_id=p_company AND reservation_id=p_reservation AND core_subject=p_actor;
 SELECT * INTO STRICT b FROM core_e1_resource_private.stock_bindings WHERE reservation_id=p_reservation;
 IF NOT stock_billing_private.paid_creation_allowed(p_actor,b.stock_subject) THEN RAISE EXCEPTION 'STOCK_BILLING_PILOT_HISTORY_PROTECTED'; END IF;
 SELECT * INTO a FROM stock_billing_private.accounts WHERE company_id=p_company FOR UPDATE;
 IF FOUND THEN
   IF a.tenant_id<>o.core_tenant_id OR a.reservation_id<>p_reservation OR a.owner_id<>p_actor OR NOT EXISTS(
     SELECT 1 FROM public.tenants t WHERE t.id=a.tenant_id AND t.platform='stock' AND t.owner_user_id=p_actor AND t.slug='e1-'||b.stock_tenant_id::text)
     THEN RAISE EXCEPTION 'STOCK_BILLING_MAPPING_CONFLICT'; END IF;
   UPDATE stock_billing_private.accounts SET session_id=p_session,auth_until=p_auth_until WHERE company_id=p_company;
 ELSE
   IF EXISTS(SELECT 1 FROM public.tenants WHERE id=o.core_tenant_id OR slug='e1-'||b.stock_tenant_id::text)
     OR EXISTS(SELECT 1 FROM public.tenant_members WHERE user_id=p_actor)
     OR (NOT EXISTS(SELECT 1 FROM public.subscription_plans WHERE id=p_plan AND is_active AND is_for_sale)
       AND NOT public.stock_billing_sandbox_allowed(o.core_tenant_id,p_plan)) THEN RAISE EXCEPTION 'STOCK_BILLING_EXISTING_RESOURCE'; END IF;
   SELECT display_name INTO STRICT company_name FROM public.companies WHERE id=p_company;
   INSERT INTO public.tenants(id,name,slug,platform,status,plan_tier,owner_user_id)
     SELECT o.core_tenant_id,company_name,'e1-'||b.stock_tenant_id::text,'stock','suspended',tier,p_actor FROM public.subscription_plans WHERE id=p_plan;
   INSERT INTO stock_billing_private.accounts(company_id,reservation_id,tenant_id,owner_id,session_id,auth_until)
     VALUES(p_company,p_reservation,o.core_tenant_id,p_actor,p_session,p_auth_until);
   INSERT INTO stock_billing_private.events(company_id,actor_id,action,payload) VALUES(p_company,p_actor,'billing.prepared',
     jsonb_build_object('reservationId',p_reservation,'tenantId',o.core_tenant_id,'stockTenantId',b.stock_tenant_id,'sessionId',p_session));
 END IF;
 IF p_auth_until<=clock_timestamp() THEN RAISE EXCEPTION 'STOCK_BILLING_AUTH_EXPIRED'; END IF;
 RETURN jsonb_build_object('tenantId',o.core_tenant_id,'planId',p_plan);
END $fn$;

CREATE FUNCTION stock_billing_private.guard_subscription() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a stock_billing_private.accounts%ROWTYPE;
BEGIN
 SELECT * INTO a FROM stock_billing_private.accounts WHERE tenant_id=CASE WHEN TG_OP='UPDATE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
 IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM core_e1_resource_private.origins WHERE core_tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'STOCK_BILLING_ACCOUNT_REQUIRED'; END IF;
   RETURN NEW;
 END IF;
 IF NEW.scheduled_plan_id IS NOT NULL OR (TG_OP='UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.plan_id IS DISTINCT FROM OLD.plan_id))
 THEN RAISE EXCEPTION 'STOCK_BILLING_CONTRACT_IMMUTABLE'; END IF;
 IF TG_OP='INSERT' AND (auth.role() IS DISTINCT FROM 'service_role' OR a.auth_until<=clock_timestamp()
   OR NOT stock_billing_private.current_owner(a.company_id,a.owner_id) OR NOT stock_billing_private.approved_plan(NEW.plan_id)
   OR NEW.status<>'unpaid') THEN RAISE EXCEPTION 'STOCK_BILLING_SUBSCRIPTION_DENIED'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER stock_billing_subscription_guard BEFORE INSERT OR UPDATE ON public.tenant_subscriptions
 FOR EACH ROW EXECUTE FUNCTION stock_billing_private.guard_subscription();

CREATE FUNCTION stock_billing_private.guard_invoice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a stock_billing_private.accounts%ROWTYPE; p public.subscription_plans%ROWTYPE;
BEGIN
 SELECT * INTO a FROM stock_billing_private.accounts WHERE tenant_id=NEW.tenant_id;
 IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM core_e1_resource_private.origins WHERE core_tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'STOCK_BILLING_ACCOUNT_REQUIRED'; END IF;
   RETURN NEW;
 END IF;
 IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('stock_billing:'||a.tenant_id::text,0)) THEN RAISE EXCEPTION 'STOCK_BILLING_BUSY'; END IF;
 SELECT * INTO STRICT p FROM public.subscription_plans WHERE id=NEW.plan_id;
 IF auth.role() IS DISTINCT FROM 'service_role' OR a.auth_until<=clock_timestamp() OR NOT stock_billing_private.current_owner(a.company_id,a.owner_id)
   OR NOT stock_billing_private.approved_plan(NEW.plan_id) OR NEW.period<>'monthly' OR NEW.amount<>p.price_monthly OR NEW.change_type<>'renew'
   OR NOT EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode=NEW.midtrans_mode)
   OR NOT EXISTS(SELECT 1 FROM public.tenant_subscriptions WHERE id=NEW.subscription_id AND tenant_id=NEW.tenant_id AND plan_id=NEW.plan_id)
   OR EXISTS(SELECT 1 FROM public.tenant_subscriptions WHERE tenant_id=NEW.tenant_id AND current_period_end>clock_timestamp())
   OR ((NOT p.is_active OR (NOT p.is_for_sale AND NOT EXISTS(SELECT 1 FROM public.subscription_invoices WHERE tenant_id=NEW.tenant_id AND plan_id=NEW.plan_id AND status='paid')))
     AND NOT (NEW.midtrans_mode='sandbox' AND public.stock_billing_sandbox_allowed(NEW.tenant_id,NEW.plan_id)))
 THEN RAISE EXCEPTION 'STOCK_BILLING_INVOICE_DENIED'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER stock_billing_invoice_guard BEFORE INSERT ON public.subscription_invoices FOR EACH ROW EXECUTE FUNCTION stock_billing_private.guard_invoice();

CREATE FUNCTION stock_billing_private.guard_issued_invoice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM stock_billing_private.accounts WHERE tenant_id=OLD.tenant_id) AND (
   ROW(NEW.id,NEW.tenant_id,NEW.subscription_id,NEW.plan_id,NEW.period,NEW.amount,NEW.midtrans_mode,NEW.change_type)
     IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.subscription_id,OLD.plan_id,OLD.period,OLD.amount,OLD.midtrans_mode,OLD.change_type)
   OR (OLD.midtrans_order_id IS NOT NULL AND NEW.midtrans_order_id IS DISTINCT FROM OLD.midtrans_order_id)
   OR (OLD.status='paid' AND ROW(NEW.status,NEW.paid_at,NEW.payment_type,NEW.raw_notification)
     IS DISTINCT FROM ROW(OLD.status,OLD.paid_at,OLD.payment_type,OLD.raw_notification))) THEN
   RAISE EXCEPTION 'STOCK_ISSUED_INVOICE_IMMUTABLE';
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER stock_billing_issued_invoice_guard BEFORE UPDATE ON public.subscription_invoices FOR EACH ROW EXECUTE FUNCTION stock_billing_private.guard_issued_invoice();

CREATE FUNCTION stock_billing_private.queue_activation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a stock_billing_private.accounts%ROWTYPE; ends_at timestamptz;
BEGIN
 SELECT * INTO a FROM stock_billing_private.accounts WHERE tenant_id=NEW.tenant_id;
 IF NOT FOUND OR NEW.status<>'paid' OR OLD.status='paid' THEN RETURN NEW; END IF;
 SELECT current_period_end INTO STRICT ends_at FROM public.tenant_subscriptions WHERE id=NEW.subscription_id AND tenant_id=NEW.tenant_id AND plan_id=NEW.plan_id AND status='active';
 IF NOT stock_billing_private.approved_plan(NEW.plan_id) OR NEW.period<>'monthly' OR NEW.paid_at IS NULL OR ends_at<=clock_timestamp()
   OR NEW.raw_notification->>'order_id' IS DISTINCT FROM NEW.midtrans_order_id
   OR NEW.raw_notification->>'currency' IS DISTINCT FROM 'IDR'
   OR coalesce(NEW.raw_notification->>'transaction_status','') NOT IN ('capture','settlement') THEN RAISE EXCEPTION 'STOCK_VERIFIED_PAYMENT_REQUIRED'; END IF;
 UPDATE stock_billing_private.deliveries SET state='superseded' WHERE tenant_id=NEW.tenant_id AND state='pending';
 INSERT INTO stock_billing_private.deliveries(invoice_id,tenant_id,plan_id,expires_at) VALUES(NEW.id,NEW.tenant_id,NEW.plan_id,ends_at);
 INSERT INTO stock_billing_private.events(company_id,action,invoice_id,payload) VALUES(a.company_id,'billing.payment_verified',NEW.id,
   jsonb_build_object('amount',NEW.amount,'planId',NEW.plan_id,'mode',NEW.midtrans_mode,'expiresAt',ends_at));
 RETURN NEW;
END $fn$;
CREATE TRIGGER stock_billing_payment_outbox AFTER UPDATE OF status ON public.subscription_invoices
 FOR EACH ROW EXECUTE FUNCTION stock_billing_private.queue_activation();

CREATE FUNCTION public.stock_billing_owned_workspaces() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT coalesce(jsonb_agg(jsonb_build_object('companyId',o.company_id,'companyName',c.display_name,'reservationId',o.reservation_id,
   'coreTenantId',o.core_tenant_id,'ownerId',o.core_subject,'stockTenantId',b.stock_tenant_id,
   'hasPaidContract',EXISTS(SELECT 1 FROM public.subscription_invoices paid WHERE paid.tenant_id=a.tenant_id AND paid.plan_id=s.plan_id AND paid.status='paid'),
   'activation',CASE WHEN d.invoice_id IS NOT NULL AND (s.status<>'active' OR s.current_period_end<=clock_timestamp()) THEN 'suspended'
     WHEN d.state='active' THEN 'active' WHEN d.state='pending' THEN 'pending' ELSE 'not_started' END,
   'subscription',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('planId',s.plan_id,'status',s.status,'expiresAt',s.current_period_end) END,
   'invoices',(SELECT coalesce(jsonb_agg(x.value ORDER BY x.created_at DESC),'[]'::jsonb) FROM (
     SELECT i.created_at,jsonb_build_object('id',i.id,'planId',i.plan_id,'amount',i.amount,'status',i.status,'createdAt',i.created_at,'paidAt',i.paid_at) value
     FROM public.subscription_invoices i WHERE i.tenant_id=a.tenant_id ORDER BY i.created_at DESC LIMIT 20) x)
 ) ORDER BY c.display_name),'[]'::jsonb)
 FROM core_e1_resource_private.origins o JOIN public.companies c ON c.id=o.company_id
 LEFT JOIN core_e1_resource_private.stock_bindings b ON b.reservation_id=o.reservation_id
 LEFT JOIN stock_billing_private.accounts a ON a.company_id=o.company_id
 LEFT JOIN public.tenant_subscriptions s ON s.tenant_id=a.tenant_id
 LEFT JOIN LATERAL(SELECT state,invoice_id FROM stock_billing_private.deliveries WHERE tenant_id=a.tenant_id ORDER BY created_at DESC LIMIT 1) d ON true
 WHERE auth.role()='authenticated' AND public.core_registry_session_is_live() AND o.core_subject=auth.uid()
   AND stock_billing_private.current_owner(o.company_id,auth.uid())
   AND stock_billing_private.paid_creation_allowed(o.core_subject,b.stock_subject)
$fn$;

CREATE FUNCTION public.stock_billing_claim_activation(p_tenant uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE d stock_billing_private.deliveries%ROWTYPE; a stock_billing_private.accounts%ROWTYPE; o core_e1_resource_private.origins%ROWTYPE;
 b core_e1_resource_private.stock_bindings%ROWTYPE; i public.subscription_invoices%ROWTYPE; p public.subscription_plans%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled) THEN RAISE EXCEPTION 'STOCK_BILLING_DENIED'; END IF;
 SELECT * INTO a FROM stock_billing_private.accounts WHERE tenant_id=p_tenant;
 IF NOT FOUND OR NOT stock_billing_private.current_owner(a.company_id,a.owner_id)
   OR NOT stock_billing_private.paid_creation_allowed(a.owner_id,(SELECT stock_subject FROM core_e1_resource_private.stock_bindings WHERE reservation_id=a.reservation_id)) THEN RETURN NULL; END IF;
 SELECT * INTO d FROM stock_billing_private.deliveries WHERE tenant_id=p_tenant AND state IN ('pending','active') ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND OR d.expires_at<=clock_timestamp() THEN RETURN NULL; END IF;
 SELECT * INTO STRICT i FROM public.subscription_invoices WHERE id=d.invoice_id AND status='paid';
 SELECT * INTO STRICT p FROM public.subscription_plans WHERE id=d.plan_id;
 IF NOT stock_billing_private.approved_plan(p.id) OR NOT EXISTS(SELECT 1 FROM public.tenant_subscriptions
   WHERE tenant_id=p_tenant AND plan_id=d.plan_id AND status='active' AND current_period_end=d.expires_at)
   OR NOT EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode=i.midtrans_mode) THEN RETURN NULL; END IF;
 SELECT * INTO STRICT o FROM core_e1_resource_private.origins WHERE company_id=a.company_id AND reservation_id=a.reservation_id AND core_tenant_id=p_tenant;
 SELECT * INTO STRICT b FROM core_e1_resource_private.stock_bindings WHERE reservation_id=o.reservation_id;
 UPDATE stock_billing_private.deliveries SET last_attempt_at=clock_timestamp() WHERE invoice_id=d.invoice_id;
 RETURN jsonb_build_object('kind','stock_paid_activation_v1','invoiceId',i.id,'deliveryId',d.delivery_id,
   'companyId',o.company_id,'reservationId',o.reservation_id,'coreTenantId',o.core_tenant_id,'coreSubject',o.core_subject,
   'stockTenantId',b.stock_tenant_id,'stockSubject',b.stock_subject,'profileId',b.profile_id,'stockAuditEventId',b.stock_audit_event_id,
   'planId',p.id,'offerVersion',p.offer_version,'publicTier',p.public_tier,'planDisplayName',p.tier_display_name,
   'planTier',p.entitlement_contract->>'portal_tier','features',p.entitlement_contract->'features',
   'maxActiveUsers',p.entitlement_contract->'max_active_users','amount',i.amount,'mode',i.midtrans_mode,
   'expiresAt',d.expires_at,'validUntil',clock_timestamp()+interval '30 seconds');
END $fn$;

CREATE FUNCTION public.stock_billing_ack_activation(p_invoice uuid,p_receipt jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE d stock_billing_private.deliveries%ROWTYPE; a stock_billing_private.accounts%ROWTYPE; b core_e1_resource_private.stock_bindings%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'STOCK_BILLING_DENIED'; END IF;
 SELECT * INTO STRICT d FROM stock_billing_private.deliveries WHERE invoice_id=p_invoice FOR UPDATE;
 SELECT * INTO STRICT a FROM stock_billing_private.accounts WHERE tenant_id=d.tenant_id;
 SELECT * INTO STRICT b FROM core_e1_resource_private.stock_bindings WHERE reservation_id=a.reservation_id;
 IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' OR p_receipt->>'status' IS DISTINCT FROM 'active'
   OR p_receipt->>'invoiceId' IS DISTINCT FROM p_invoice::text OR p_receipt->>'deliveryId' IS DISTINCT FROM d.delivery_id::text
   OR p_receipt->>'companyId' IS DISTINCT FROM a.company_id::text OR p_receipt->>'stockTenantId' IS DISTINCT FROM b.stock_tenant_id::text
   OR p_receipt->>'profileId' IS DISTINCT FROM b.profile_id::text OR NOT stock_billing_private.current_owner(a.company_id,a.owner_id) THEN RAISE EXCEPTION 'STOCK_ACTIVATION_RECEIPT_MISMATCH'; END IF;
 IF d.state='superseded' THEN RETURN false; END IF;
 UPDATE stock_billing_private.deliveries SET state='active',acknowledged_at=coalesce(acknowledged_at,clock_timestamp()) WHERE invoice_id=p_invoice;
 INSERT INTO stock_billing_private.events(company_id,action,invoice_id,payload) VALUES(a.company_id,'billing.stock_activated',p_invoice,p_receipt) ON CONFLICT(action,invoice_id) DO NOTHING;
 RETURN true;
END $fn$;

CREATE FUNCTION public.stock_billing_pending_tenants() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT d.tenant_id FROM stock_billing_private.deliveries d JOIN stock_billing_private.accounts a ON a.tenant_id=d.tenant_id
 JOIN public.subscription_invoices i ON i.id=d.invoice_id AND i.status='paid'
 JOIN public.tenant_subscriptions s ON s.id=i.subscription_id AND s.plan_id=d.plan_id AND s.status='active' AND s.current_period_end=d.expires_at
 JOIN stock_billing_private.settings cfg ON cfg.singleton AND cfg.enabled AND cfg.payment_mode=i.midtrans_mode
 WHERE auth.role()='service_role' AND d.state='pending' AND d.expires_at>clock_timestamp()
   AND stock_billing_private.current_owner(a.company_id,a.owner_id) AND stock_billing_private.approved_plan(d.plan_id)
 GROUP BY d.tenant_id ORDER BY min(d.last_attempt_at) NULLS FIRST,min(d.created_at) LIMIT 50
$fn$;
CREATE FUNCTION public.stock_billing_is_managed(p_tenant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT auth.role()='service_role' AND EXISTS(SELECT 1 FROM core_e1_resource_private.origins WHERE core_tenant_id=p_tenant)
$fn$;

CREATE FUNCTION public.stock_billing_paid_access_context(p_company uuid,p_reservation uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT jsonb_build_object('companyId',o.company_id,'reservationId',o.reservation_id,'coreTenantId',o.core_tenant_id,'coreSubject',o.core_subject,
   'stockTenantId',b.stock_tenant_id,'stockSubject',b.stock_subject,'profileId',b.profile_id,'stockAuditEventId',b.stock_audit_event_id,'expiresAt',s.current_period_end)
 FROM core_e1_resource_private.origins o JOIN core_e1_resource_private.stock_bindings b ON b.reservation_id=o.reservation_id
 JOIN stock_billing_private.accounts a ON a.company_id=o.company_id JOIN public.tenant_subscriptions s ON s.tenant_id=a.tenant_id
 WHERE auth.role()='authenticated' AND public.core_registry_session_is_live() AND o.core_subject=auth.uid()
   AND o.company_id=p_company AND o.reservation_id=p_reservation AND stock_billing_private.current_owner(o.company_id,auth.uid())
   AND s.status='active' AND s.current_period_end>clock_timestamp() AND stock_billing_private.approved_plan(s.plan_id)
   AND EXISTS(SELECT 1 FROM stock_billing_private.deliveries d WHERE d.tenant_id=a.tenant_id AND d.plan_id=s.plan_id AND d.expires_at=s.current_period_end AND d.state='active')
$fn$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA stock_billing_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.stock_billing_remember_intent(uuid,uuid,timestamptz,uuid,uuid),
 public.stock_billing_prepare_account(uuid,uuid,timestamptz,uuid,uuid,uuid),public.stock_billing_claim_activation(uuid),
 public.stock_billing_ack_activation(uuid,jsonb),public.stock_billing_pending_tenants(),public.stock_billing_is_managed(uuid),public.stock_billing_sandbox_allowed(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.stock_billing_remember_intent(uuid,uuid,timestamptz,uuid,uuid),
 public.stock_billing_prepare_account(uuid,uuid,timestamptz,uuid,uuid,uuid),public.stock_billing_claim_activation(uuid),
 public.stock_billing_ack_activation(uuid,jsonb),public.stock_billing_pending_tenants(),public.stock_billing_is_managed(uuid),public.stock_billing_sandbox_allowed(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.stock_billing_owned_workspaces(),public.stock_billing_read_intent(),
 public.stock_billing_paid_access_context(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.stock_billing_owned_workspaces(),public.stock_billing_read_intent(),
 public.stock_billing_paid_access_context(uuid,uuid) TO authenticated;
COMMIT;
