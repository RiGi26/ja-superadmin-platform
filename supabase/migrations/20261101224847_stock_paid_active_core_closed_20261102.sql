-- Forward source proposal, Core hxhusfkrlafxdnyasmsu only. No enablement.
-- Install only after the self-payment schema and reviewed active-Core baseline.
-- No deployed pilot/existing-business function or authority is replaced.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR to_regclass('stock_billing_private.accounts') IS NULL
   OR md5(pg_get_functiondef(to_regprocedure('core_registry_private.active_stock_core_session_live(uuid,uuid)')))
     IS DISTINCT FROM 'f4e62c2e0f8fb2d4151921662e75d28d'
   OR md5(pg_get_functiondef(to_regprocedure('public.core_registry_session_is_live()')))
     IS DISTINCT FROM 'a1ca5fc1f0e7efc1fa587cebbf555786'
   OR to_regclass('stock_billing_private.active_sessions') IS NOT NULL THEN
   RAISE EXCEPTION 'STOCK_PAID_ACTIVE_CORE_BASELINE_DRIFT';
 END IF;
END $preflight$;

CREATE TABLE stock_billing_private.active_sessions(
 stock_session uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES stock_billing_private.accounts(company_id) ON DELETE RESTRICT,
 stock_subject uuid NOT NULL,
 core_subject uuid NOT NULL,
 core_session uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '1 hour')
);
CREATE INDEX stock_billing_active_company_idx ON stock_billing_private.active_sessions(company_id);
CREATE INDEX stock_billing_active_subject_idx ON stock_billing_private.active_sessions(stock_subject);
CREATE TABLE stock_billing_private.session_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 stock_session uuid NOT NULL REFERENCES stock_billing_private.active_sessions(stock_session) ON DELETE RESTRICT,
 event text NOT NULL CHECK(event IN ('enrolled','revoked')),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX stock_billing_session_event_session_idx ON stock_billing_private.session_events(stock_session);
ALTER TABLE stock_billing_private.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_billing_private.active_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_billing_private.session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_billing_private.session_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON stock_billing_private.active_sessions,stock_billing_private.session_events FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE stock_billing_private.session_events_id_seq FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER stock_billing_session_no_delete BEFORE DELETE OR TRUNCATE ON stock_billing_private.active_sessions
 FOR EACH STATEMENT EXECUTE FUNCTION stock_billing_private.immutable();
CREATE TRIGGER stock_billing_session_event_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_billing_private.session_events
 FOR EACH STATEMENT EXECUTE FUNCTION stock_billing_private.immutable();
CREATE FUNCTION stock_billing_private.guard_active_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF TG_OP='UPDATE' THEN
   IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
     OR (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') THEN
     RAISE EXCEPTION 'STOCK_PAID_SESSION_IMMUTABLE';
   END IF;
   NEW.revoked_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER stock_billing_session_identity BEFORE UPDATE ON stock_billing_private.active_sessions
 FOR EACH ROW EXECUTE FUNCTION stock_billing_private.guard_active_session();
CREATE FUNCTION stock_billing_private.audit_active_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 INSERT INTO stock_billing_private.session_events(stock_session,event)
 VALUES(NEW.stock_session,CASE WHEN TG_OP='INSERT' THEN 'enrolled' ELSE 'revoked' END);
 RETURN NEW;
END $fn$;
CREATE TRIGGER stock_billing_session_audit AFTER INSERT OR UPDATE ON stock_billing_private.active_sessions
 FOR EACH ROW EXECUTE FUNCTION stock_billing_private.audit_active_session();

CREATE FUNCTION stock_billing_private.current_paid_authority(p_core uuid,p_stock uuid,p_core_session uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a stock_billing_private.accounts%ROWTYPE; b core_e1_resource_private.stock_bindings%ROWTYPE; revision bigint;
BEGIN
 SELECT * INTO STRICT a FROM stock_billing_private.accounts WHERE owner_id=p_core;
 SELECT * INTO STRICT b FROM core_e1_resource_private.stock_bindings WHERE reservation_id=a.reservation_id AND stock_subject=p_stock;
 IF NOT core_registry_private.active_stock_core_session_live(p_core,p_core_session)
   OR NOT stock_billing_private.current_owner(a.company_id,p_core)
   OR NOT stock_billing_private.paid_creation_allowed(p_core,p_stock)
   OR NOT EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled)
   OR NOT EXISTS(SELECT 1 FROM public.tenant_subscriptions s
     JOIN stock_billing_private.deliveries d ON d.tenant_id=s.tenant_id AND d.plan_id=s.plan_id
       AND d.expires_at=s.current_period_end AND d.state='active'
     JOIN public.subscription_invoices i ON i.id=d.invoice_id AND i.tenant_id=s.tenant_id
       AND i.plan_id=s.plan_id AND i.period='monthly' AND i.status='paid'
     JOIN public.subscription_plans p ON p.id=s.plan_id AND i.amount=p.price_monthly
     JOIN stock_billing_private.settings cfg ON cfg.singleton AND cfg.payment_mode=i.midtrans_mode
     JOIN public.tenants t ON t.id=s.tenant_id AND t.platform='stock' AND t.status='active' AND t.owner_user_id=p_core
     WHERE s.tenant_id=a.tenant_id AND s.status='active' AND s.current_period_end>clock_timestamp()
       AND stock_billing_private.approved_plan(s.plan_id))
 THEN RAISE EXCEPTION 'STOCK_PAID_AUTHORITY_DENIED'; END IF;
 SELECT c.revision INTO STRICT revision FROM public.companies c WHERE c.id=a.company_id AND c.status='active';
 RETURN jsonb_build_object('bindingId',a.reservation_id,'bindingRevision',0,'companyId',a.company_id,
   'companyRevision',revision,'coreSessionId',p_core_session,'coreSubject',p_core,'coreTenantId',a.tenant_id,
   'instanceId',a.reservation_id,'stockTenantId',b.stock_tenant_id);
END $fn$;

CREATE FUNCTION public.stock_billing_active_is_managed(p_core_subject uuid,p_stock_subject uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'STOCK_PAID_SESSION_DENIED'; END IF;
 RETURN EXISTS(SELECT 1 FROM stock_billing_private.accounts a
   JOIN core_e1_resource_private.stock_bindings b ON b.reservation_id=a.reservation_id
   WHERE a.owner_id=p_core_subject OR b.stock_subject=p_stock_subject);
END $fn$;
CREATE FUNCTION public.stock_billing_active_enroll(p_core_subject uuid,p_stock_subject uuid,p_stock_session uuid,
 p_verified_until timestamptz,p_company uuid,p_instance uuid,p_core_session uuid,p_core_token_expires timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1s' AS $fn$
DECLARE authority jsonb; s stock_billing_private.active_sessions%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_stock_session IS NULL OR p_verified_until IS NULL
   OR p_verified_until<=clock_timestamp() OR p_verified_until>clock_timestamp()+interval '30 seconds'
   OR p_core_token_expires IS NULL OR p_core_token_expires<=clock_timestamp()
   OR (p_company IS NULL)<>(p_instance IS NULL) THEN RAISE EXCEPTION 'STOCK_PAID_SESSION_DENIED'; END IF;
 authority:=stock_billing_private.current_paid_authority(p_core_subject,p_stock_subject,p_core_session);
 IF p_company IS NOT NULL AND (authority->>'companyId'<>p_company::text OR authority->>'instanceId'<>p_instance::text)
 THEN RAISE EXCEPTION 'STOCK_PAID_SESSION_SELECTOR_CONFLICT'; END IF;
 INSERT INTO stock_billing_private.active_sessions(stock_session,company_id,stock_subject,core_subject,core_session,expires_at)
 VALUES(p_stock_session,(authority->>'companyId')::uuid,p_stock_subject,p_core_subject,p_core_session,
   least(p_core_token_expires,clock_timestamp()+interval '1 hour')) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT s FROM stock_billing_private.active_sessions WHERE stock_session=p_stock_session FOR UPDATE;
 IF s.company_id::text<>authority->>'companyId' OR s.stock_subject<>p_stock_subject OR s.core_subject<>p_core_subject
   OR s.core_session<>p_core_session OR s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp()
   OR p_verified_until<=clock_timestamp() THEN RAISE EXCEPTION 'STOCK_PAID_SESSION_CONFLICT'; END IF;
 RETURN authority;
END $fn$;
CREATE FUNCTION public.stock_billing_active_authorize(p_core_subject uuid,p_stock_subject uuid,p_stock_session uuid,
 p_verified_until timestamptz) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE s stock_billing_private.active_sessions%ROWTYPE; authority jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_verified_until IS NULL OR p_verified_until<=clock_timestamp()
   OR p_verified_until>clock_timestamp()+interval '30 seconds' THEN RAISE EXCEPTION 'STOCK_PAID_SESSION_DENIED'; END IF;
 SELECT * INTO STRICT s FROM stock_billing_private.active_sessions WHERE stock_session=p_stock_session
   AND core_subject=p_core_subject AND stock_subject=p_stock_subject AND revoked_at IS NULL AND expires_at>clock_timestamp();
 authority:=stock_billing_private.current_paid_authority(p_core_subject,p_stock_subject,s.core_session);
 IF authority->>'companyId'<>s.company_id::text OR p_verified_until<=clock_timestamp() THEN RAISE EXCEPTION 'STOCK_PAID_SESSION_CONFLICT'; END IF;
 RETURN authority;
END $fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA stock_billing_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.stock_billing_active_is_managed(uuid,uuid),
 public.stock_billing_active_enroll(uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,timestamptz),
 public.stock_billing_active_authorize(uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.stock_billing_active_is_managed(uuid,uuid),
 public.stock_billing_active_enroll(uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,timestamptz),
 public.stock_billing_active_authorize(uuid,uuid,uuid,timestamptz) TO service_role;
COMMIT;
