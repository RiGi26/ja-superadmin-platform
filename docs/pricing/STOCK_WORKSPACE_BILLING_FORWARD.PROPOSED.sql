-- Core hxhusfkrlafxdnyasmsu only. Closed forward source proposal.
-- Requires v2 births, native-Owner FKs and per-workspace intents first.
-- Extends exact Company x Stock mapping; no settings, sales or financial rows.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR to_regclass('stock_workspace_private.origins') IS NULL
   OR to_regclass('stock_billing_private.workspace_intents') IS NULL
   OR to_regclass('stock_workspace_private.bindings') IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='stock_billing_private.accounts'::regclass
     AND conname='accounts_company_id_fkey' AND confrelid='core_e1_resource_private.origins'::regclass AND convalidated)
   OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='stock_billing_private.accounts'::regclass
     AND conname='accounts_reservation_id_fkey' AND confrelid='core_e1_resource_private.origins'::regclass AND convalidated)
   OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='stock_billing_private.sandbox_cohort'::regclass
     AND conname='sandbox_cohort_company_id_fkey' AND confrelid='core_e1_resource_private.origins'::regclass AND convalidated)
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_BILLING_BASELINE_DRIFT'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_BUSY_REAUTHENTICATE'; END IF;
END $preflight$;

DO $functions$ BEGIN
 IF EXISTS(SELECT 1 FROM (VALUES
   ('stock_billing_private.current_owner(uuid,uuid)','4132c87f721105380bfb7329ad19e042'),
   ('public.stock_billing_sandbox_allowed(uuid,uuid)','9a4f41871c4c62ca1fa0326c17e27737'),
   ('public.stock_billing_read_intent()','44a631147b585c8a6c8b38cc6ea6203a'),
   ('public.stock_billing_prepare_account(uuid,uuid,timestamp with time zone,uuid,uuid,uuid)','4bb2cb561d0da61acfc1313f42744f3f'),
   ('stock_billing_private.guard_subscription()','b10e089630b8b6b963f78aa7046eb74c'),
   ('stock_billing_private.guard_invoice()','35eb85a994a0e4a9c63f583715737c71'),
   ('public.stock_billing_owned_workspaces()','8434fd60bb4ed50a389d098003b272c2'),
   ('public.stock_billing_claim_activation(uuid)','952845331596833b7323ce449d498557'),
   ('public.stock_billing_ack_activation(uuid,jsonb)','f13caf7b822a52d7c94b7cf6ca434fe3'),
   ('public.stock_billing_pending_tenants()','c487f3d3bf287a407ab932b160045b91'),
   ('public.stock_billing_is_managed(uuid)','a20b90d80fde441599fb9f9831b0ea3e'),
   ('public.stock_billing_paid_access_context(uuid,uuid)','fe5963aaaa7966d12490c3245a085182'),
   ('public.stock_billing_remember_intent(uuid,uuid,timestamp with time zone,uuid,uuid)','42f57913580c6de1ded1a1cdbcd2e6c5'),
   ('public.stock_billing_read_workspace_intent(uuid)','7360717f9a30e794c93afd77eb063ae1')
 ) expected(signature,body_hash)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(expected.signature)
 WHERE p.oid IS NULL OR md5(p.prosrc) IS DISTINCT FROM expected.body_hash
   OR p.proowner IS DISTINCT FROM 'postgres'::regrole OR p.prosecdef IS DISTINCT FROM true
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[])
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_BILLING_FUNCTION_DRIFT'; END IF;
END $functions$;

-- The new native pair is prepared before Stock acknowledges it. Independent
-- reciprocal confirmation remains mandatory before any invoice/subscription.
CREATE TABLE stock_workspace_private.bindings(
 reservation_id uuid PRIMARY KEY REFERENCES stock_workspace_private.origins(reservation_id) ON DELETE RESTRICT,
 company_id uuid NOT NULL UNIQUE REFERENCES stock_workspace_private.origins(company_id) ON DELETE RESTRICT,
 stock_tenant_id uuid NOT NULL UNIQUE,
 stock_subject uuid NOT NULL,
 profile_id uuid NOT NULL UNIQUE,
 stock_audit_event_id uuid NOT NULL UNIQUE,
 command_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX stock_workspace_binding_subject_idx ON stock_workspace_private.bindings(stock_subject);
ALTER TABLE stock_workspace_private.bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_workspace_private.bindings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON stock_workspace_private.bindings FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER stock_workspace_binding_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_workspace_private.bindings
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();
CREATE TRIGGER stock_workspace_binding_fence BEFORE INSERT ON stock_workspace_private.bindings
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry();
CREATE TRIGGER stock_workspace_binding_audit AFTER INSERT ON stock_workspace_private.bindings
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit();

CREATE VIEW stock_workspace_private.billing_origins AS
 SELECT company_id,membership_id,core_subject,reservation_id,core_tenant_id,command_id,request_digest,
   stock_origin,source,1 AS origin_version FROM core_e1_resource_private.origins
 UNION ALL
 SELECT company_id,membership_id,core_subject,reservation_id,core_tenant_id,command_id,request_digest,
   'https://oyyfcmlquqfrdoffkgsd.supabase.co'::text,source,2 FROM stock_workspace_private.origins;
CREATE VIEW stock_workspace_private.billing_bindings AS
 SELECT reservation_id,stock_tenant_id,stock_subject,profile_id,stock_audit_event_id,command_id,created_at
 FROM core_e1_resource_private.stock_bindings
 UNION ALL
 SELECT reservation_id,stock_tenant_id,stock_subject,profile_id,stock_audit_event_id,command_id,created_at
 FROM stock_workspace_private.bindings;
REVOKE ALL ON stock_workspace_private.billing_origins,stock_workspace_private.billing_bindings FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION stock_billing_private.current_owner(p_company uuid,p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM stock_workspace_private.billing_origins o
   JOIN public.companies c ON c.id=o.company_id AND c.status='active'
   JOIN public.company_memberships m ON m.id=o.membership_id AND m.company_id=o.company_id
     AND m.core_auth_user_id=o.core_subject AND m.role='owner' AND m.status='active'
   JOIN public.company_portal_instances i ON i.id=o.reservation_id AND i.company_id=o.company_id
     AND i.portal_type='stock' AND i.lifecycle_status='reserved' AND i.legacy_tenant_id IS NULL AND i.portal_instance_id IS NULL
   JOIN auth.users u ON u.id=o.core_subject AND u.deleted_at IS NULL AND u.is_anonymous IS FALSE
     AND u.email_confirmed_at<=clock_timestamp() AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
   WHERE o.company_id=p_company AND o.core_subject=p_actor
     AND (SELECT count(*) FROM stock_workspace_private.billing_origins WHERE company_id=p_company)=1
     AND NOT EXISTS(SELECT 1 FROM core_registry_private.operators WHERE subject_id=p_actor AND active)
     AND NOT EXISTS(SELECT 1 FROM core_registry_private.owner_claims WHERE company_id=p_company AND status='pending')
     AND NOT EXISTS(SELECT 1 FROM stock_membership_private.identity_pairs WHERE core_subject=p_actor AND revoked_at IS NOT NULL)
     AND ((o.origin_version=1 AND NOT EXISTS(SELECT 1 FROM stock_membership_private.resources WHERE company_id=p_company)
         AND (SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id=p_actor)=1)
       OR ((o.origin_version=2 OR EXISTS(SELECT 1 FROM stock_membership_private.resources WHERE company_id=p_company))
         AND (NOT EXISTS(SELECT 1 FROM stock_membership_private.resources WHERE company_id=p_company)
           OR EXISTS(SELECT 1 FROM stock_membership_private.resources r
             JOIN stock_membership_private.memberships owner_member ON owner_member.id=r.owner_membership_id AND owner_member.company_id=r.company_id
               AND owner_member.id=o.membership_id AND owner_member.core_subject=p_actor AND owner_member.role='admin' AND owner_member.revoked_at IS NULL
             JOIN stock_membership_private.identity_pairs pair ON pair.id=owner_member.pair_id AND pair.core_subject=owner_member.core_subject
               AND pair.stock_subject=owner_member.stock_subject AND pair.revoked_at IS NULL
             JOIN stock_workspace_private.billing_bindings b ON b.reservation_id=o.reservation_id AND b.stock_subject=owner_member.stock_subject
               AND b.profile_id=owner_member.profile_id AND b.stock_tenant_id=r.stock_tenant_id
             WHERE r.company_id=p_company AND r.instance_id=o.reservation_id AND r.core_tenant_id=o.core_tenant_id AND r.revoked_at IS NULL)))))
$fn$;

-- Public parent FKs admit either immutable origin version. The row trigger
-- preserves the stronger exact origin/Owner/reservation/tenant relationship.
CREATE FUNCTION stock_workspace_private.guard_billing_mapping() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF TG_TABLE_NAME='accounts' THEN
   IF NOT EXISTS(SELECT 1 FROM stock_workspace_private.billing_origins o
     JOIN public.tenants t ON t.id=o.core_tenant_id AND t.platform='stock' AND t.owner_user_id=o.core_subject
     WHERE o.company_id=NEW.company_id AND o.reservation_id=NEW.reservation_id
       AND o.core_tenant_id=NEW.tenant_id AND o.core_subject=NEW.owner_id
       AND stock_billing_private.current_owner(o.company_id,o.core_subject))
   THEN RAISE EXCEPTION 'STOCK_BILLING_MAPPING_CONFLICT'; END IF;
 ELSE
   IF NOT EXISTS(SELECT 1 FROM stock_workspace_private.billing_origins o WHERE o.company_id=NEW.company_id
     AND stock_billing_private.current_owner(o.company_id,o.core_subject))
   THEN RAISE EXCEPTION 'STOCK_BILLING_MAPPING_CONFLICT'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER stock_workspace_account_mapping BEFORE INSERT ON stock_billing_private.accounts
 FOR EACH ROW EXECUTE FUNCTION stock_workspace_private.guard_billing_mapping();
CREATE TRIGGER stock_workspace_cohort_mapping BEFORE INSERT ON stock_billing_private.sandbox_cohort
 FOR EACH ROW EXECUTE FUNCTION stock_workspace_private.guard_billing_mapping();
ALTER TABLE stock_billing_private.accounts DROP CONSTRAINT accounts_company_id_fkey,
 DROP CONSTRAINT accounts_reservation_id_fkey,
 ADD CONSTRAINT accounts_company_id_fkey FOREIGN KEY(company_id) REFERENCES public.companies(id) ON DELETE RESTRICT,
 ADD CONSTRAINT accounts_reservation_id_fkey FOREIGN KEY(reservation_id) REFERENCES public.company_portal_instances(id) ON DELETE RESTRICT;
ALTER TABLE stock_billing_private.sandbox_cohort DROP CONSTRAINT sandbox_cohort_company_id_fkey,
 ADD CONSTRAINT sandbox_cohort_company_id_fkey FOREIGN KEY(company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;

-- Exact adaptations of existing readers/writers follow. Financial engines,
-- invoice identities, verified atomic commit and outbox semantics stay shared.
CREATE FUNCTION stock_workspace_private.billing_session_live(p_actor uuid,p_session uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
   WHERE s.id=p_session AND s.user_id=p_actor AND (s.not_after IS NULL OR s.not_after>clock_timestamp())
     AND u.deleted_at IS NULL AND u.is_anonymous IS FALSE AND u.email_confirmed_at<=clock_timestamp()
     AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))
   AND core_registry_private.active_stock_core_session_live(p_actor,p_session)
$fn$;

CREATE OR REPLACE FUNCTION public.stock_billing_sandbox_allowed(p_tenant uuid,p_plan uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT auth.role()='service_role' AND stock_billing_private.approved_plan(p_plan)
   AND EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode='sandbox')
   AND EXISTS(SELECT 1 FROM stock_billing_private.sandbox_cohort c
     JOIN stock_workspace_private.billing_origins o ON o.company_id=c.company_id AND o.core_tenant_id=p_tenant
     JOIN stock_workspace_private.billing_bindings b ON b.reservation_id=o.reservation_id
     WHERE c.enabled AND c.valid_until>clock_timestamp() AND stock_billing_private.current_owner(o.company_id,o.core_subject))
$fn$;


CREATE OR REPLACE FUNCTION public.stock_billing_read_intent() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT jsonb_build_object('planId',i.plan_id,'companyId',i.company_id,'reservationId',o.reservation_id,'commandId',i.command_id)
 FROM stock_billing_private.intents i LEFT JOIN stock_workspace_private.billing_origins o ON o.company_id=i.company_id AND o.core_subject=auth.uid()
 WHERE auth.role()='authenticated' AND public.core_registry_session_is_live() AND i.owner_id=auth.uid() AND i.expires_at>clock_timestamp()
   AND stock_billing_private.approved_plan(i.plan_id)
   AND (i.company_id IS NULL OR stock_billing_private.current_owner(i.company_id,auth.uid()))
$fn$;


CREATE OR REPLACE FUNCTION public.stock_billing_prepare_account(p_actor uuid,p_session uuid,p_auth_until timestamptz,p_company uuid,p_reservation uuid,p_plan uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE o stock_workspace_private.billing_origins%ROWTYPE; b stock_workspace_private.billing_bindings%ROWTYPE; a stock_billing_private.accounts%ROWTYPE; company_name text;
BEGIN
 PERFORM stock_billing_private.require_service_actor(p_actor,p_session,p_auth_until);
 IF NOT stock_billing_private.current_owner(p_company,p_actor) OR NOT stock_billing_private.approved_plan(p_plan) THEN RAISE EXCEPTION 'STOCK_BILLING_DENIED'; END IF;
 SELECT * INTO STRICT o FROM stock_workspace_private.billing_origins WHERE company_id=p_company AND reservation_id=p_reservation AND core_subject=p_actor;
 SELECT * INTO STRICT b FROM stock_workspace_private.billing_bindings WHERE reservation_id=p_reservation;
 IF NOT stock_billing_private.paid_creation_allowed(p_actor,b.stock_subject) THEN RAISE EXCEPTION 'STOCK_BILLING_PILOT_HISTORY_PROTECTED'; END IF;
 SELECT * INTO a FROM stock_billing_private.accounts WHERE company_id=p_company FOR UPDATE;
 IF FOUND THEN
   IF a.tenant_id<>o.core_tenant_id OR a.reservation_id<>p_reservation OR a.owner_id<>p_actor OR NOT EXISTS(
     SELECT 1 FROM public.tenants t WHERE t.id=a.tenant_id AND t.platform='stock' AND t.owner_user_id=p_actor AND t.slug='e1-'||b.stock_tenant_id::text)
     THEN RAISE EXCEPTION 'STOCK_BILLING_MAPPING_CONFLICT'; END IF;
   UPDATE stock_billing_private.accounts SET session_id=p_session,auth_until=p_auth_until WHERE company_id=p_company;
 ELSE
   IF EXISTS(SELECT 1 FROM public.tenants WHERE id=o.core_tenant_id OR slug='e1-'||b.stock_tenant_id::text)
     OR (o.origin_version=1 AND NOT EXISTS(SELECT 1 FROM stock_membership_private.resources WHERE company_id=p_company) AND EXISTS(SELECT 1 FROM public.tenant_members WHERE user_id=p_actor))
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


CREATE OR REPLACE FUNCTION stock_billing_private.guard_subscription() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a stock_billing_private.accounts%ROWTYPE;
BEGIN
 SELECT * INTO a FROM stock_billing_private.accounts WHERE tenant_id=CASE WHEN TG_OP='UPDATE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
 IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM stock_workspace_private.billing_origins WHERE core_tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'STOCK_BILLING_ACCOUNT_REQUIRED'; END IF;
   RETURN NEW;
 END IF;
 IF NEW.scheduled_plan_id IS NOT NULL OR (TG_OP='UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.plan_id IS DISTINCT FROM OLD.plan_id))
 THEN RAISE EXCEPTION 'STOCK_BILLING_CONTRACT_IMMUTABLE'; END IF;
 IF TG_OP='INSERT' AND (auth.role() IS DISTINCT FROM 'service_role' OR a.auth_until<=clock_timestamp()
   OR NOT stock_workspace_private.billing_session_live(a.owner_id,a.session_id)
   OR NOT stock_billing_private.current_owner(a.company_id,a.owner_id) OR NOT stock_billing_private.approved_plan(NEW.plan_id)
   OR NEW.status<>'unpaid') THEN RAISE EXCEPTION 'STOCK_BILLING_SUBSCRIPTION_DENIED'; END IF;
 RETURN NEW;
END $fn$;


CREATE OR REPLACE FUNCTION stock_billing_private.guard_invoice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a stock_billing_private.accounts%ROWTYPE; p public.subscription_plans%ROWTYPE;
BEGIN
 SELECT * INTO a FROM stock_billing_private.accounts WHERE tenant_id=NEW.tenant_id;
 IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM stock_workspace_private.billing_origins WHERE core_tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'STOCK_BILLING_ACCOUNT_REQUIRED'; END IF;
   RETURN NEW;
 END IF;
 IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('stock_billing:'||a.tenant_id::text,0)) THEN RAISE EXCEPTION 'STOCK_BILLING_BUSY'; END IF;
 SELECT * INTO STRICT p FROM public.subscription_plans WHERE id=NEW.plan_id;
 IF auth.role() IS DISTINCT FROM 'service_role' OR a.auth_until<=clock_timestamp() OR NOT stock_billing_private.current_owner(a.company_id,a.owner_id)
   OR NOT stock_workspace_private.billing_session_live(a.owner_id,a.session_id)
   OR NOT stock_billing_private.approved_plan(NEW.plan_id) OR NEW.period<>'monthly' OR NEW.amount<>p.price_monthly OR NEW.change_type<>'renew'
   OR NOT EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode=NEW.midtrans_mode)
   OR NOT EXISTS(SELECT 1 FROM public.tenant_subscriptions WHERE id=NEW.subscription_id AND tenant_id=NEW.tenant_id AND plan_id=NEW.plan_id)
   OR EXISTS(SELECT 1 FROM public.tenant_subscriptions WHERE tenant_id=NEW.tenant_id AND current_period_end>clock_timestamp())
   OR ((NOT p.is_active OR (NOT p.is_for_sale AND NOT EXISTS(SELECT 1 FROM public.subscription_invoices WHERE tenant_id=NEW.tenant_id AND plan_id=NEW.plan_id AND status='paid')))
     AND NOT (NEW.midtrans_mode='sandbox' AND public.stock_billing_sandbox_allowed(NEW.tenant_id,NEW.plan_id)))
 THEN RAISE EXCEPTION 'STOCK_BILLING_INVOICE_DENIED'; END IF;
 RETURN NEW;
END $fn$;


CREATE OR REPLACE FUNCTION public.stock_billing_owned_workspaces() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT coalesce(jsonb_agg(jsonb_build_object('companyId',o.company_id,'companyName',c.display_name,'reservationId',o.reservation_id,
   'coreTenantId',o.core_tenant_id,'ownerId',o.core_subject,'stockTenantId',coalesce(b.stock_tenant_id,(SELECT stock_tenant_id FROM stock_workspace_private.origins WHERE company_id=o.company_id)),
   'accessProtocol',CASE WHEN o.origin_version=2 OR EXISTS(SELECT 1 FROM stock_membership_private.resources r
     WHERE r.company_id=o.company_id AND r.instance_id=o.reservation_id) THEN 'membership' ELSE 'legacy' END,
   'hasPaidContract',EXISTS(SELECT 1 FROM public.subscription_invoices paid WHERE paid.tenant_id=a.tenant_id AND paid.plan_id=s.plan_id AND paid.status='paid'),
   'activation',CASE WHEN d.invoice_id IS NOT NULL AND (s.status<>'active' OR s.current_period_end<=clock_timestamp()) THEN 'suspended'
     WHEN d.state='active' THEN 'active' WHEN d.state='pending' THEN 'pending' ELSE 'not_started' END,
   'subscription',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('planId',s.plan_id,'status',s.status,'expiresAt',s.current_period_end) END,
   'invoices',(SELECT coalesce(jsonb_agg(x.value ORDER BY x.created_at DESC),'[]'::jsonb) FROM (
     SELECT i.created_at,jsonb_build_object('id',i.id,'planId',i.plan_id,'amount',i.amount,'status',i.status,'createdAt',i.created_at,'paidAt',i.paid_at) value
     FROM public.subscription_invoices i WHERE i.tenant_id=a.tenant_id ORDER BY i.created_at DESC LIMIT 20) x)
 ) ORDER BY c.display_name),'[]'::jsonb)
 FROM stock_workspace_private.billing_origins o JOIN public.companies c ON c.id=o.company_id
 LEFT JOIN stock_workspace_private.billing_bindings b ON b.reservation_id=o.reservation_id
 LEFT JOIN stock_billing_private.accounts a ON a.company_id=o.company_id
 LEFT JOIN public.tenant_subscriptions s ON s.tenant_id=a.tenant_id
 LEFT JOIN LATERAL(SELECT state,invoice_id FROM stock_billing_private.deliveries WHERE tenant_id=a.tenant_id ORDER BY created_at DESC LIMIT 1) d ON true
 WHERE auth.role()='authenticated' AND public.core_registry_session_is_live() AND o.core_subject=auth.uid()
   AND stock_billing_private.current_owner(o.company_id,auth.uid())
   AND stock_billing_private.paid_creation_allowed(o.core_subject,b.stock_subject)
$fn$;


CREATE OR REPLACE FUNCTION public.stock_billing_claim_activation(p_tenant uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE d stock_billing_private.deliveries%ROWTYPE; a stock_billing_private.accounts%ROWTYPE; o stock_workspace_private.billing_origins%ROWTYPE;
 b stock_workspace_private.billing_bindings%ROWTYPE; i public.subscription_invoices%ROWTYPE; p public.subscription_plans%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled) THEN RAISE EXCEPTION 'STOCK_BILLING_DENIED'; END IF;
 SELECT * INTO a FROM stock_billing_private.accounts WHERE tenant_id=p_tenant;
 IF NOT FOUND OR NOT stock_billing_private.current_owner(a.company_id,a.owner_id)
   OR NOT stock_billing_private.paid_creation_allowed(a.owner_id,(SELECT stock_subject FROM stock_workspace_private.billing_bindings WHERE reservation_id=a.reservation_id)) THEN RETURN NULL; END IF;
 SELECT * INTO d FROM stock_billing_private.deliveries WHERE tenant_id=p_tenant AND state IN ('pending','active') ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND OR d.expires_at<=clock_timestamp() THEN RETURN NULL; END IF;
 SELECT * INTO STRICT i FROM public.subscription_invoices WHERE id=d.invoice_id AND status='paid';
 SELECT * INTO STRICT p FROM public.subscription_plans WHERE id=d.plan_id;
 IF NOT stock_billing_private.approved_plan(p.id) OR NOT EXISTS(SELECT 1 FROM public.tenant_subscriptions
   WHERE tenant_id=p_tenant AND plan_id=d.plan_id AND status='active' AND current_period_end=d.expires_at)
   OR NOT EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode=i.midtrans_mode) THEN RETURN NULL; END IF;
 SELECT * INTO STRICT o FROM stock_workspace_private.billing_origins WHERE company_id=a.company_id AND reservation_id=a.reservation_id AND core_tenant_id=p_tenant;
 SELECT * INTO STRICT b FROM stock_workspace_private.billing_bindings WHERE reservation_id=o.reservation_id;
 UPDATE stock_billing_private.deliveries SET last_attempt_at=clock_timestamp() WHERE invoice_id=d.invoice_id;
 RETURN jsonb_build_object('kind','stock_paid_activation_v1','invoiceId',i.id,'deliveryId',d.delivery_id,
   'companyId',o.company_id,'reservationId',o.reservation_id,'coreTenantId',o.core_tenant_id,'coreSubject',o.core_subject,
   'stockTenantId',b.stock_tenant_id,'stockSubject',b.stock_subject,'profileId',b.profile_id,'stockAuditEventId',b.stock_audit_event_id,
   'planId',p.id,'offerVersion',p.offer_version,'publicTier',p.public_tier,'planDisplayName',p.tier_display_name,
   'planTier',p.entitlement_contract->>'portal_tier','features',p.entitlement_contract->'features',
   'maxActiveUsers',p.entitlement_contract->'max_active_users','amount',i.amount,'mode',i.midtrans_mode,
   'expiresAt',d.expires_at,'validUntil',clock_timestamp()+interval '30 seconds');
END $fn$;


CREATE OR REPLACE FUNCTION public.stock_billing_ack_activation(p_invoice uuid,p_receipt jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE d stock_billing_private.deliveries%ROWTYPE; a stock_billing_private.accounts%ROWTYPE; b stock_workspace_private.billing_bindings%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'STOCK_BILLING_DENIED'; END IF;
 SELECT * INTO STRICT d FROM stock_billing_private.deliveries WHERE invoice_id=p_invoice FOR UPDATE;
 SELECT * INTO STRICT a FROM stock_billing_private.accounts WHERE tenant_id=d.tenant_id;
 SELECT * INTO STRICT b FROM stock_workspace_private.billing_bindings WHERE reservation_id=a.reservation_id;
 IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' OR p_receipt->>'status' IS DISTINCT FROM 'active'
   OR p_receipt->>'invoiceId' IS DISTINCT FROM p_invoice::text OR p_receipt->>'deliveryId' IS DISTINCT FROM d.delivery_id::text
   OR p_receipt->>'companyId' IS DISTINCT FROM a.company_id::text OR p_receipt->>'stockTenantId' IS DISTINCT FROM b.stock_tenant_id::text
   OR p_receipt->>'profileId' IS DISTINCT FROM b.profile_id::text OR NOT stock_billing_private.current_owner(a.company_id,a.owner_id) THEN RAISE EXCEPTION 'STOCK_ACTIVATION_RECEIPT_MISMATCH'; END IF;
 IF d.state='superseded' THEN RETURN false; END IF;
 UPDATE stock_billing_private.deliveries SET state='active',acknowledged_at=coalesce(acknowledged_at,clock_timestamp()) WHERE invoice_id=p_invoice;
 INSERT INTO stock_billing_private.events(company_id,action,invoice_id,payload) VALUES(a.company_id,'billing.stock_activated',p_invoice,p_receipt) ON CONFLICT(action,invoice_id) DO NOTHING;
 RETURN true;
END $fn$;


CREATE OR REPLACE FUNCTION public.stock_billing_pending_tenants() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT d.tenant_id FROM stock_billing_private.deliveries d JOIN stock_billing_private.accounts a ON a.tenant_id=d.tenant_id
 JOIN public.subscription_invoices i ON i.id=d.invoice_id AND i.status='paid'
 JOIN public.tenant_subscriptions s ON s.id=i.subscription_id AND s.plan_id=d.plan_id AND s.status='active' AND s.current_period_end=d.expires_at
 JOIN stock_billing_private.settings cfg ON cfg.singleton AND cfg.enabled AND cfg.payment_mode=i.midtrans_mode
 WHERE auth.role()='service_role' AND d.state='pending' AND d.expires_at>clock_timestamp()
   AND stock_billing_private.current_owner(a.company_id,a.owner_id) AND stock_billing_private.approved_plan(d.plan_id)
 GROUP BY d.tenant_id ORDER BY min(d.last_attempt_at) NULLS FIRST,min(d.created_at) LIMIT 50
$fn$;


CREATE OR REPLACE FUNCTION public.stock_billing_is_managed(p_tenant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT auth.role()='service_role' AND EXISTS(SELECT 1 FROM stock_workspace_private.billing_origins WHERE core_tenant_id=p_tenant)
$fn$;


CREATE OR REPLACE FUNCTION public.stock_billing_paid_access_context(p_company uuid,p_reservation uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT jsonb_build_object('companyId',o.company_id,'reservationId',o.reservation_id,'coreTenantId',o.core_tenant_id,'coreSubject',o.core_subject,
   'stockTenantId',b.stock_tenant_id,'stockSubject',b.stock_subject,'profileId',b.profile_id,'stockAuditEventId',b.stock_audit_event_id,'expiresAt',s.current_period_end)
 FROM stock_workspace_private.billing_origins o JOIN stock_workspace_private.billing_bindings b ON b.reservation_id=o.reservation_id
 JOIN stock_billing_private.accounts a ON a.company_id=o.company_id JOIN public.tenant_subscriptions s ON s.tenant_id=a.tenant_id
 WHERE auth.role()='authenticated' AND public.core_registry_session_is_live() AND o.core_subject=auth.uid()
   AND o.company_id=p_company AND o.reservation_id=p_reservation AND stock_billing_private.current_owner(o.company_id,auth.uid())
   AND s.status='active' AND s.current_period_end>clock_timestamp() AND stock_billing_private.approved_plan(s.plan_id)
   AND EXISTS(SELECT 1 FROM stock_billing_private.deliveries d WHERE d.tenant_id=a.tenant_id AND d.plan_id=s.plan_id AND d.expires_at=s.current_period_end AND d.state='active')
$fn$;


CREATE OR REPLACE FUNCTION public.stock_billing_remember_intent(p_actor uuid,p_session uuid,p_auth_until timestamptz,p_plan uuid,p_company uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE selected uuid; saved stock_billing_private.workspace_intents%ROWTYPE;
BEGIN
 PERFORM stock_billing_private.require_service_actor(p_actor,p_session,p_auth_until);
 IF NOT stock_billing_private.approved_plan(p_plan)
   OR p_company IS NOT NULL AND NOT stock_billing_private.current_owner(p_company,p_actor)
 THEN RAISE EXCEPTION 'STOCK_BILLING_DENIED'; END IF;
 SELECT reservation_id INTO selected FROM stock_workspace_private.billing_origins WHERE company_id=p_company;
 INSERT INTO stock_billing_private.workspace_intents(owner_id,plan_id,company_id,expires_at)
 VALUES(p_actor,p_plan,p_company,clock_timestamp()+interval '7 days')
 ON CONFLICT(owner_id,company_id) DO UPDATE SET plan_id=excluded.plan_id,expires_at=excluded.expires_at
 RETURNING * INTO saved;
 INSERT INTO stock_billing_private.intents(owner_id,plan_id,company_id,command_id,expires_at)
 VALUES(saved.owner_id,saved.plan_id,saved.company_id,saved.command_id,saved.expires_at)
 ON CONFLICT(owner_id) DO UPDATE SET plan_id=excluded.plan_id,company_id=excluded.company_id,
   command_id=excluded.command_id,expires_at=excluded.expires_at;
 RETURN jsonb_build_object('planId',saved.plan_id,'companyId',saved.company_id,'reservationId',selected,'commandId',saved.command_id);
END $fn$;


CREATE OR REPLACE FUNCTION public.stock_billing_read_workspace_intent(p_company uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT jsonb_build_object('planId',i.plan_id,'companyId',i.company_id,'reservationId',o.reservation_id,'commandId',i.command_id)
 FROM stock_billing_private.workspace_intents i
 LEFT JOIN stock_workspace_private.billing_origins o ON o.company_id=i.company_id AND o.core_subject=auth.uid()
 WHERE auth.role()='authenticated' AND public.core_registry_session_is_live()
   AND i.owner_id=auth.uid() AND i.company_id IS NOT DISTINCT FROM p_company
   AND i.expires_at>clock_timestamp() AND stock_billing_private.approved_plan(i.plan_id)
   AND (i.company_id IS NULL OR stock_billing_private.current_owner(i.company_id,auth.uid()))
$fn$;


REVOKE ALL ON ALL FUNCTIONS IN SCHEMA stock_workspace_private FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
