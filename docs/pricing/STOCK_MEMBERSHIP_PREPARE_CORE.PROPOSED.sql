-- Explicit, inactive admission of an existing genuine E1 birth tuple only.
-- No Company, public membership, profile, invoice, subscription or grant writes.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR to_regclass('stock_membership_private.resources') IS NULL
   OR to_regclass('core_e1_resource_private.stock_bindings') IS NULL
   OR to_regclass('stock_membership_private.prepared_owners') IS NOT NULL
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_PREPARATION_BASELINE_DENIED'; END IF;
END $preflight$;
CREATE TABLE stock_membership_private.preparation_settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false
);
INSERT INTO stock_membership_private.preparation_settings VALUES(true,false);
CREATE TABLE stock_membership_private.prepared_owners(
 company_id uuid PRIMARY KEY REFERENCES stock_membership_private.resources(company_id) ON DELETE RESTRICT,
 core_subject uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 command_id uuid NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(core_subject,command_id)
);
CREATE INDEX stock_membership_prepared_subject_idx ON stock_membership_private.prepared_owners(core_subject);
ALTER TABLE stock_membership_private.preparation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_membership_private.preparation_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_membership_private.prepared_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_membership_private.prepared_owners FORCE ROW LEVEL SECURITY;
CREATE TRIGGER membership_prepared_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.prepared_owners
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();
CREATE TRIGGER membership_prepared_fence BEFORE INSERT ON stock_membership_private.prepared_owners
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry();
CREATE TRIGGER membership_prepared_audit AFTER INSERT ON stock_membership_private.prepared_owners
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit();

CREATE FUNCTION public.core_stock_membership_prepare_owner(p_core_subject uuid,p_core_session uuid,
 p_stock_subject uuid,p_stock_session uuid,p_verified_until timestamptz,p_company uuid,p_instance uuid,p_command uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE tuple record; pair stock_membership_private.identity_pairs%ROWTYPE;
 previous stock_membership_private.prepared_owners%ROWTYPE; result jsonb; pair_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_core_subject IS NULL OR p_core_session IS NULL
   OR p_stock_subject IS NULL OR p_stock_session IS NULL OR p_command IS NULL
   OR p_command::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   OR p_verified_until IS NULL OR p_verified_until<=clock_timestamp()
   OR p_verified_until>clock_timestamp()+interval '30 seconds'
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.preparation_settings WHERE singleton AND enabled)
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_PREPARATION_DENIED'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_MEMBERSHIP_BUSY_REAUTHENTICATE'; END IF;
 IF p_verified_until<=clock_timestamp()
   OR NOT core_registry_private.active_stock_core_session_live(p_core_subject,p_core_session)
   OR NOT stock_billing_private.paid_creation_allowed(p_core_subject,p_stock_subject)
   OR EXISTS(SELECT 1 FROM core_registry_private.operators WHERE subject_id=p_core_subject AND active)
   OR EXISTS(SELECT 1 FROM core_registry_private.owner_claims WHERE company_id=p_company AND status='pending')
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_PREPARATION_DENIED'; END IF;
 SELECT o.company_id,o.reservation_id,o.core_tenant_id,o.membership_id,b.stock_tenant_id,b.profile_id,
   c.revision,t.status AS tenant_status INTO STRICT tuple
 FROM core_e1_resource_private.origins o
 JOIN core_e1_resource_private.stock_bindings b ON b.reservation_id=o.reservation_id AND b.stock_subject=p_stock_subject
 JOIN public.companies c ON c.id=o.company_id AND c.status='active' AND c.revision BETWEEN 0 AND 9007199254740991
 JOIN public.company_memberships m ON m.id=o.membership_id AND m.company_id=o.company_id
   AND m.core_auth_user_id=p_core_subject AND m.status='active' AND m.role='owner'
 JOIN public.company_portal_instances pi ON pi.id=o.reservation_id AND pi.company_id=o.company_id AND pi.portal_type='stock'
   AND pi.lifecycle_status='reserved' AND pi.legacy_tenant_id IS NULL AND pi.portal_instance_id IS NULL
 JOIN stock_billing_private.accounts a ON a.company_id=o.company_id AND a.reservation_id=o.reservation_id
   AND a.tenant_id=o.core_tenant_id AND a.owner_id=p_core_subject
 JOIN public.tenants t ON t.id=a.tenant_id AND t.platform='stock' AND t.owner_user_id=p_core_subject
   AND t.slug='e1-'||b.stock_tenant_id::text
 JOIN auth.users u ON u.id=p_core_subject AND u.deleted_at IS NULL AND u.is_anonymous IS FALSE
   AND u.email_confirmed_at IS NOT NULL AND u.email_confirmed_at<=clock_timestamp()
   AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
 WHERE o.company_id=p_company AND o.reservation_id=p_instance AND o.core_subject=p_core_subject
   AND o.source='core.e1.resource.v1' AND o.stock_origin='https://oyyfcmlquqfrdoffkgsd.supabase.co';
 SELECT * INTO previous FROM stock_membership_private.prepared_owners WHERE company_id=p_company;
 IF FOUND THEN
   IF previous.core_subject<>p_core_subject OR previous.command_id<>p_command
   THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_PREPARATION_REPLAY_CONFLICT'; END IF;
   result:=previous.result;
 ELSE
   -- Admission is limited to a new unpaid resource. Existing/legacy paid
   -- subscriptions never acquire this contract through a selector or receipt.
   IF tuple.tenant_status<>'suspended'
     OR EXISTS(SELECT 1 FROM public.tenant_subscriptions WHERE tenant_id=tuple.core_tenant_id)
     OR EXISTS(SELECT 1 FROM public.subscription_invoices WHERE tenant_id=tuple.core_tenant_id)
     OR EXISTS(SELECT 1 FROM stock_membership_private.resources WHERE company_id=p_company)
   THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_EXISTING_RESOURCE_PROTECTED'; END IF;
   INSERT INTO stock_membership_private.identity_pairs(id,core_subject,stock_subject)
     VALUES(gen_random_uuid(),p_core_subject,p_stock_subject) ON CONFLICT DO NOTHING;
   SELECT * INTO STRICT pair FROM stock_membership_private.identity_pairs
     WHERE core_subject=p_core_subject AND stock_subject=p_stock_subject AND revoked_at IS NULL;
   pair_id:=pair.id;
   INSERT INTO stock_membership_private.resources(company_id,instance_id,core_tenant_id,stock_tenant_id,
     binding_id,binding_revision,owner_membership_id)
     VALUES(p_company,p_instance,tuple.core_tenant_id,tuple.stock_tenant_id,p_instance,1,tuple.membership_id);
   INSERT INTO stock_membership_private.memberships(id,company_id,core_subject,stock_subject,pair_id,profile_id,role,revision)
     VALUES(tuple.membership_id,p_company,p_core_subject,p_stock_subject,pair_id,tuple.profile_id,'admin',1);
   result:=jsonb_build_object('version',2,'status','prepared','commandId',p_command,
     'companyId',p_company,'instanceId',p_instance,'coreTenantId',tuple.core_tenant_id,'stockTenantId',tuple.stock_tenant_id,
     'coreSubject',p_core_subject,'stockSubject',p_stock_subject,'ownerMembershipId',tuple.membership_id,
     'profileId',tuple.profile_id,'bindingId',p_instance,'bindingRevision',1,'companyRevision',tuple.revision,
     'membershipRevision',1,'role','admin','accessGranted',false);
   INSERT INTO stock_membership_private.prepared_owners(company_id,core_subject,command_id,result)
     VALUES(p_company,p_core_subject,p_command,result);
 END IF;
 -- A replay may read a now-paid resource, but cannot revive or change a row.
 IF NOT EXISTS(SELECT 1 FROM stock_membership_private.resources r
   JOIN stock_membership_private.memberships m ON m.id=r.owner_membership_id AND m.company_id=r.company_id
   JOIN stock_membership_private.identity_pairs ip ON ip.id=m.pair_id AND ip.revoked_at IS NULL
   WHERE r.company_id=p_company AND r.instance_id=p_instance AND r.core_tenant_id=tuple.core_tenant_id
     AND r.stock_tenant_id=tuple.stock_tenant_id AND r.binding_id=p_instance AND r.binding_revision=1 AND r.revoked_at IS NULL
     AND m.id=tuple.membership_id AND m.core_subject=p_core_subject AND m.stock_subject=p_stock_subject
     AND m.profile_id=tuple.profile_id AND m.role='admin' AND m.revision=1 AND m.revoked_at IS NULL)
   OR result->'companyRevision' IS DISTINCT FROM to_jsonb(tuple.revision)
   OR p_verified_until<=clock_timestamp()
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_PREPARATION_DENIED'; END IF;
 RETURN result;
END $fn$;
REVOKE ALL ON stock_membership_private.preparation_settings,stock_membership_private.prepared_owners FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.core_stock_membership_prepare_owner(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_membership_prepare_owner(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid) TO service_role;

CREATE TABLE stock_membership_private.preparation_confirmations(
 company_id uuid PRIMARY KEY REFERENCES stock_membership_private.prepared_owners(company_id) ON DELETE RESTRICT,
 command_id uuid NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE stock_membership_private.preparation_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_membership_private.preparation_confirmations FORCE ROW LEVEL SECURITY;
CREATE TRIGGER membership_confirmation_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.preparation_confirmations
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();
CREATE TRIGGER membership_confirmation_fence BEFORE INSERT ON stock_membership_private.preparation_confirmations
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry();
CREATE TRIGGER membership_confirmation_audit AFTER INSERT ON stock_membership_private.preparation_confirmations
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit();
REVOKE ALL ON stock_membership_private.preparation_confirmations FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.core_stock_membership_confirm_owner(p_core_subject uuid,p_core_session uuid,
 p_stock_subject uuid,p_stock_session uuid,p_verified_until timestamptz,p_company uuid,p_instance uuid,p_command uuid,p_stock_receipt jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE current_receipt jsonb;
BEGIN
 -- Same exact Owner/resource validation and global mutation fence as admission.
 current_receipt:=public.core_stock_membership_prepare_owner(p_core_subject,p_core_session,p_stock_subject,
   p_stock_session,p_verified_until,p_company,p_instance,p_command);
 IF current_receipt IS DISTINCT FROM p_stock_receipt
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_RECIPROCAL_PREPARATION_DENIED'; END IF;
 INSERT INTO stock_membership_private.preparation_confirmations(company_id,command_id)
   VALUES(p_company,p_command) ON CONFLICT(company_id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM stock_membership_private.preparation_confirmations WHERE company_id=p_company AND command_id=p_command)
   OR p_verified_until<=clock_timestamp()
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_RECIPROCAL_PREPARATION_DENIED'; END IF;
 RETURN jsonb_build_object('status','confirmed','companyId',p_company,'instanceId',p_instance,'commandId',p_command,'accessGranted',false);
END $fn$;
REVOKE ALL ON FUNCTION public.core_stock_membership_confirm_owner(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_membership_confirm_owner(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb) TO service_role;

-- A partially completed callback can never issue an invoice. This additional
-- guard affects only admitted v2 resources; existing billing guards still apply.
CREATE FUNCTION stock_membership_private.preparation_ready(p_company uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM stock_membership_private.resources r
 JOIN stock_membership_private.prepared_owners p ON p.company_id=r.company_id
 JOIN stock_membership_private.preparation_confirmations c ON c.company_id=p.company_id AND c.command_id=p.command_id
 JOIN stock_membership_private.memberships m ON m.id=r.owner_membership_id AND m.company_id=r.company_id AND m.revoked_at IS NULL
 JOIN stock_membership_private.identity_pairs ip ON ip.id=m.pair_id AND ip.revoked_at IS NULL
 JOIN public.companies company ON company.id=r.company_id AND company.status='active'
   AND company.revision=(p.result->>'companyRevision')::bigint
 WHERE r.company_id=p_company AND r.revoked_at IS NULL)
$fn$;
REVOKE ALL ON FUNCTION stock_membership_private.preparation_ready(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.core_stock_membership_purchase_readiness(p_company uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR NOT public.core_registry_session_is_live()
   OR NOT stock_billing_private.current_owner(p_company,auth.uid())
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_PREPARATION_DENIED'; END IF;
 RETURN jsonb_build_object('companyId',p_company,'ready',stock_membership_private.preparation_ready(p_company));
END $fn$;
REVOKE ALL ON FUNCTION public.core_stock_membership_purchase_readiness(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_membership_purchase_readiness(uuid) TO authenticated;

CREATE FUNCTION stock_membership_private.guard_prepared_purchase() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE company uuid;
BEGIN
 SELECT company_id INTO company FROM stock_membership_private.resources WHERE core_tenant_id=NEW.tenant_id;
 IF FOUND THEN
   IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
   THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_MEMBERSHIP_BUSY_REAUTHENTICATE'; END IF;
   IF NOT stock_membership_private.preparation_ready(company)
   THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_RECIPROCAL_PREPARATION_REQUIRED'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION stock_membership_private.guard_prepared_purchase() FROM PUBLIC,anon,authenticated,service_role;
-- Sort before the existing billing row guards: Registry fence precedes the
-- invoice's tenant lock and is held through the financial transaction commit.
CREATE TRIGGER stock_00_membership_prepared_invoice_guard BEFORE INSERT ON public.subscription_invoices
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.guard_prepared_purchase();
CREATE TRIGGER stock_00_membership_prepared_subscription_guard BEFORE INSERT ON public.tenant_subscriptions
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.guard_prepared_purchase();
COMMIT;
