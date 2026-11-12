-- Core hxhusfkrlafxdnyasmsu only. Native v2 preparation, not payment/access.
-- Requires v2 birth/billing readers and both independent preparation gates.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR to_regclass('stock_workspace_private.bindings') IS NULL
   OR to_regclass('stock_membership_private.preparation_confirmations') IS NULL
   OR to_regprocedure('public.core_stock_workspace_prepare_owner(uuid,uuid,uuid,uuid,timestamp with time zone,uuid,uuid,uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_PREPARATION_BASELINE_DRIFT'; END IF;
END $preflight$;

CREATE FUNCTION public.core_stock_workspace_is_v2(p_company uuid,p_instance uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'STOCK_WORKSPACE_DENIED'; END IF;
 IF EXISTS(SELECT 1 FROM stock_workspace_private.origins v JOIN core_e1_resource_private.origins old
   ON old.company_id=v.company_id OR old.reservation_id=v.reservation_id OR old.core_tenant_id=v.core_tenant_id
   WHERE v.company_id=p_company OR v.reservation_id=p_instance)
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_ORIGIN_VERSION_CONFLICT'; END IF;
 RETURN EXISTS(SELECT 1 FROM stock_workspace_private.origins WHERE company_id=p_company AND reservation_id=p_instance);
END $fn$;

CREATE FUNCTION public.core_stock_workspace_prepare_owner(p_core_subject uuid,p_core_session uuid,
 p_stock_subject uuid,p_stock_session uuid,p_verified_until timestamptz,p_company uuid,p_instance uuid,p_command uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE o stock_workspace_private.origins%ROWTYPE; b stock_workspace_private.bindings%ROWTYPE;
 pair stock_membership_private.identity_pairs%ROWTYPE; prior stock_membership_private.prepared_owners%ROWTYPE;
 plan uuid; account jsonb; result jsonb; company_name text; company_revision bigint;
BEGIN
 PERFORM stock_billing_private.require_service_actor(p_core_subject,p_core_session,p_verified_until);
 IF p_stock_subject IS NULL OR p_stock_session IS NULL OR p_command IS NULL
   OR NOT EXISTS(SELECT 1 FROM stock_workspace_private.settings WHERE singleton AND enabled)
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.preparation_settings WHERE singleton AND enabled)
   OR NOT core_registry_private.active_stock_core_session_live(p_core_subject,p_core_session)
   OR NOT stock_billing_private.current_owner(p_company,p_core_subject)
   OR NOT stock_billing_private.paid_creation_allowed(p_core_subject,p_stock_subject)
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_PREPARATION_DENIED'; END IF;
 SELECT * INTO STRICT o FROM stock_workspace_private.origins WHERE company_id=p_company
   AND reservation_id=p_instance AND core_subject=p_core_subject;
 SELECT plan_id INTO STRICT plan FROM stock_billing_private.workspace_intents WHERE owner_id=p_core_subject
   AND company_id=p_company AND command_id=p_command AND expires_at>clock_timestamp();
 IF NOT stock_billing_private.approved_plan(plan) THEN RAISE EXCEPTION 'STOCK_WORKSPACE_PREPARATION_DENIED'; END IF;
 SELECT display_name,revision INTO STRICT company_name,company_revision FROM public.companies WHERE id=p_company AND status='active';
 SELECT * INTO prior FROM stock_membership_private.prepared_owners WHERE company_id=p_company;
 IF FOUND THEN
   IF prior.core_subject<>p_core_subject OR prior.command_id<>p_command
   THEN RAISE EXCEPTION 'STOCK_WORKSPACE_PREPARATION_REPLAY_CONFLICT'; END IF;
   result:=prior.result;
 ELSE
   IF EXISTS(SELECT 1 FROM stock_membership_private.resources WHERE company_id=p_company)
     OR EXISTS(SELECT 1 FROM public.tenant_subscriptions WHERE tenant_id=o.core_tenant_id)
     OR EXISTS(SELECT 1 FROM public.subscription_invoices WHERE tenant_id=o.core_tenant_id)
   THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_EXISTING_RESOURCE_PROTECTED'; END IF;
   INSERT INTO stock_membership_private.identity_pairs(id,core_subject,stock_subject)
     VALUES(gen_random_uuid(),p_core_subject,p_stock_subject) ON CONFLICT DO NOTHING;
   SELECT * INTO STRICT pair FROM stock_membership_private.identity_pairs
     WHERE core_subject=p_core_subject AND stock_subject=p_stock_subject AND revoked_at IS NULL;
   INSERT INTO stock_workspace_private.bindings(reservation_id,company_id,stock_tenant_id,stock_subject,profile_id,stock_audit_event_id,command_id)
     VALUES(p_instance,p_company,o.stock_tenant_id,p_stock_subject,o.profile_id,gen_random_uuid(),p_command) ON CONFLICT DO NOTHING;
   SELECT * INTO STRICT b FROM stock_workspace_private.bindings WHERE reservation_id=p_instance AND company_id=p_company
     AND stock_tenant_id=o.stock_tenant_id AND stock_subject=p_stock_subject AND profile_id=o.profile_id AND command_id=p_command;
   account:=public.stock_billing_prepare_account(p_core_subject,p_core_session,p_verified_until,p_company,p_instance,plan);
   IF account->>'tenantId' IS DISTINCT FROM o.core_tenant_id::text OR account->>'planId' IS DISTINCT FROM plan::text
     OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=o.core_tenant_id AND platform='stock' AND status='suspended' AND owner_user_id=p_core_subject)
   THEN RAISE EXCEPTION 'STOCK_BILLING_MAPPING_CONFLICT'; END IF;
   INSERT INTO stock_membership_private.resources(company_id,instance_id,core_tenant_id,stock_tenant_id,binding_id,binding_revision,owner_membership_id)
     VALUES(p_company,p_instance,o.core_tenant_id,o.stock_tenant_id,p_instance,1,o.membership_id);
   INSERT INTO stock_membership_private.memberships(id,company_id,core_subject,stock_subject,pair_id,profile_id,role,revision)
     VALUES(o.membership_id,p_company,p_core_subject,p_stock_subject,pair.id,o.profile_id,'admin',1);
   result:=jsonb_build_object('version',2,'status','prepared','commandId',p_command,'companyId',p_company,'instanceId',p_instance,
     'coreTenantId',o.core_tenant_id,'stockTenantId',o.stock_tenant_id,'coreSubject',p_core_subject,'stockSubject',p_stock_subject,
     'ownerMembershipId',o.membership_id,'profileId',o.profile_id,'bindingId',p_instance,'bindingRevision',1,
     'companyRevision',company_revision,'membershipRevision',1,'role','admin','accessGranted',false,
     'originVersion',2,'companyName',company_name,'stockAuditEventId',b.stock_audit_event_id);
   INSERT INTO stock_membership_private.prepared_owners(company_id,core_subject,command_id,result)
     VALUES(p_company,p_core_subject,p_command,result);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM stock_membership_private.resources r
   JOIN stock_membership_private.memberships m ON m.id=r.owner_membership_id AND m.company_id=r.company_id
   JOIN stock_membership_private.identity_pairs ip ON ip.id=m.pair_id AND ip.core_subject=m.core_subject AND ip.stock_subject=m.stock_subject AND ip.revoked_at IS NULL
   JOIN stock_workspace_private.bindings binding ON binding.reservation_id=r.instance_id AND binding.company_id=r.company_id
     AND binding.stock_subject=m.stock_subject AND binding.stock_tenant_id=r.stock_tenant_id AND binding.profile_id=m.profile_id
   WHERE r.company_id=p_company AND r.instance_id=p_instance AND r.core_tenant_id=o.core_tenant_id AND r.stock_tenant_id=o.stock_tenant_id
     AND r.binding_id=p_instance AND r.binding_revision=1 AND r.revoked_at IS NULL
     AND m.id=o.membership_id AND m.core_subject=p_core_subject AND m.stock_subject=p_stock_subject
     AND m.profile_id=o.profile_id AND m.role='admin' AND m.revision=1 AND m.revoked_at IS NULL
     AND binding.command_id=p_command AND binding.stock_audit_event_id::text=result->>'stockAuditEventId')
   OR result->'originVersion' IS DISTINCT FROM '2'::jsonb
   OR result->'companyRevision' IS DISTINCT FROM to_jsonb(company_revision)
   OR p_verified_until<=clock_timestamp()
   OR NOT core_registry_private.active_stock_core_session_live(p_core_subject,p_core_session)
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_PREPARATION_DENIED'; END IF;
 RETURN result;
END $fn$;

CREATE FUNCTION public.core_stock_workspace_confirm_owner(p_core_subject uuid,p_core_session uuid,
 p_stock_subject uuid,p_stock_session uuid,p_verified_until timestamptz,p_company uuid,p_instance uuid,p_command uuid,p_stock_receipt jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE expected jsonb;
BEGIN
 expected:=public.core_stock_workspace_prepare_owner(p_core_subject,p_core_session,p_stock_subject,p_stock_session,
   p_verified_until,p_company,p_instance,p_command);
 IF expected IS DISTINCT FROM p_stock_receipt THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_RECIPROCAL_PREPARATION_DENIED'; END IF;
 INSERT INTO stock_membership_private.preparation_confirmations(company_id,command_id)
   VALUES(p_company,p_command) ON CONFLICT(company_id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM stock_membership_private.preparation_confirmations WHERE company_id=p_company AND command_id=p_command)
   OR p_verified_until<=clock_timestamp()
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_RECIPROCAL_PREPARATION_DENIED'; END IF;
 RETURN jsonb_build_object('status','confirmed','companyId',p_company,'instanceId',p_instance,'commandId',p_command,'accessGranted',false);
END $fn$;
REVOKE ALL ON FUNCTION public.core_stock_workspace_is_v2(uuid,uuid),
 public.core_stock_workspace_prepare_owner(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid),
 public.core_stock_workspace_confirm_owner(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_workspace_is_v2(uuid,uuid),
 public.core_stock_workspace_prepare_owner(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid),
 public.core_stock_workspace_confirm_owner(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb) TO service_role;
COMMIT;
