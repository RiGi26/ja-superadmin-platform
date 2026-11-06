-- PROPOSED ONLY: Core hxhusfkrlafxdnyasmsu. Separate exact Owner authority required.
-- Only unpaid account preparation; no account/data/settings/grant or financial writes.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$
DECLARE target oid:=to_regprocedure('public.stock_billing_prepare_account(uuid,uuid,timestamp with time zone,uuid,uuid,uuid)');
BEGIN
 IF current_user<>'postgres' OR NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION 'STOCK_PREPARATION_REPAIR_OPERATOR_OR_BUSY'; END IF;
 IF target IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner='postgres'::regrole
   AND prosecdef AND proconfig=ARRAY['search_path=""']::text[] AND md5(prosrc)='966a113084bf699edb1c52cb42105be5')
   OR has_function_privilege('anon',target,'EXECUTE')
   OR has_function_privilege('authenticated',target,'EXECUTE')
   OR NOT has_function_privilege('service_role',target,'EXECUTE')
 THEN RAISE EXCEPTION 'STOCK_PREPARATION_REPAIR_FUNCTION_DRIFT'; END IF;
 IF (SELECT count(*) FROM stock_membership_private.settings WHERE singleton AND enabled)<>1
   OR (SELECT count(*) FROM stock_membership_private.preparation_settings WHERE singleton AND enabled)<>1
   OR (SELECT count(*) FROM stock_workspace_private.settings WHERE singleton AND enabled)<>1
   OR (SELECT count(*) FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode='sandbox')<>1
   OR (SELECT count(*) FROM public.subscription_plans WHERE id IN
     ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,'5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
     AND NOT is_active AND NOT is_for_sale AND stock_billing_private.approved_plan(id))<>2
   OR EXISTS(SELECT 1 FROM stock_billing_private.sandbox_cohort WHERE enabled)
 THEN RAISE EXCEPTION 'STOCK_PREPARATION_REPAIR_CLOSED_BASELINE_DENIED'; END IF;
END $preflight$;
-- Restore only the prior account preparer after an unsuccessful verification; retain all created mappings, memberships and audit.
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
COMMIT;
