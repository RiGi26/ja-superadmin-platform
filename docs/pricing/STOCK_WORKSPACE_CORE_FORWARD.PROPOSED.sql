-- Core hxhusfkrlafxdnyasmsu only. Closed source proposal; not rollout approval.
-- Genuine new Company x Stock births. Never attach/adopt an existing business.
-- Install alongside immutable v1 origins; old writers cannot mutate v2 graphs.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR to_regnamespace('stock_workspace_private') IS NOT NULL
   OR to_regclass('stock_membership_private.resources') IS NULL
   OR md5(pg_get_functiondef('core_e1_resource_private.guard_graph()'::regprocedure))
      IS DISTINCT FROM 'b1216196573a28f56081de18b1eec712'
   OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.company_memberships_one_active_user')
     AND indisunique AND indisvalid AND indkey::text=(SELECT attnum::text FROM pg_attribute
       WHERE attrelid='public.company_memberships'::regclass AND attname='core_auth_user_id')
     AND pg_get_expr(indpred,indrelid)='(status = ''active''::text)')
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_BASELINE_DRIFT'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_BUSY_REAUTHENTICATE'; END IF;
END $preflight$;

CREATE SCHEMA stock_workspace_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA stock_workspace_private FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA stock_workspace_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE stock_workspace_private.settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enabled boolean NOT NULL DEFAULT false
);
INSERT INTO stock_workspace_private.settings VALUES(true,false);
CREATE TABLE stock_workspace_private.origins(
 company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE RESTRICT,
 membership_id uuid NOT NULL UNIQUE,
 core_subject uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reservation_id uuid NOT NULL UNIQUE REFERENCES public.company_portal_instances(id) ON DELETE RESTRICT,
 core_tenant_id uuid NOT NULL UNIQUE,
 stock_tenant_id uuid NOT NULL UNIQUE,
 profile_id uuid NOT NULL UNIQUE,
 command_id uuid NOT NULL,
 request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 source text NOT NULL DEFAULT 'core.stock.workspace.v2' CHECK(source='core.stock.workspace.v2'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(membership_id,company_id,core_subject)
   REFERENCES public.company_memberships(id,company_id,core_auth_user_id) ON DELETE RESTRICT,
 UNIQUE(core_subject,command_id)
);
CREATE INDEX stock_workspace_origin_subject_idx ON stock_workspace_private.origins(core_subject);
-- Exact before/after row images, consumed once in the transaction that issued
-- them. No browser/service grants, GUC bypass, wildcard fields or reusable token.
CREATE TABLE stock_workspace_private.graph_permits(
 transaction_id xid8 NOT NULL,
 relation_name text NOT NULL CHECK(relation_name IN ('companies','company_memberships','company_portal_instances')),
 operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE')),
 record_id uuid NOT NULL,
 command_id uuid NOT NULL,
 prior jsonb NOT NULL,
 successor jsonb NOT NULL,
 PRIMARY KEY(transaction_id,relation_name,operation,record_id)
);
ALTER TABLE stock_workspace_private.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_workspace_private.settings FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_workspace_private.origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_workspace_private.origins FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_workspace_private.graph_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_workspace_private.graph_permits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA stock_workspace_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER stock_workspace_origin_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_workspace_private.origins
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();
CREATE TRIGGER stock_workspace_origin_fence BEFORE INSERT ON stock_workspace_private.origins
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry();

CREATE FUNCTION stock_workspace_private.guard_origin_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_BUSY_REAUTHENTICATE'; END IF;
 IF TG_TABLE_SCHEMA='stock_workspace_private' THEN
   IF EXISTS(SELECT 1 FROM core_e1_resource_private.origins o WHERE o.company_id=NEW.company_id
     OR o.reservation_id=NEW.reservation_id OR o.core_tenant_id=NEW.core_tenant_id)
   THEN RAISE EXCEPTION 'STOCK_WORKSPACE_ORIGIN_VERSION_CONFLICT'; END IF;
 ELSE
   IF EXISTS(SELECT 1 FROM stock_workspace_private.origins o WHERE o.company_id=NEW.company_id
     OR o.reservation_id=NEW.reservation_id OR o.core_tenant_id=NEW.core_tenant_id)
   THEN RAISE EXCEPTION 'STOCK_WORKSPACE_ORIGIN_VERSION_CONFLICT'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER stock_workspace_origin_version BEFORE INSERT ON stock_workspace_private.origins
 FOR EACH ROW EXECUTE FUNCTION stock_workspace_private.guard_origin_version();
CREATE TRIGGER stock_workspace_origin_version BEFORE INSERT ON core_e1_resource_private.origins
 FOR EACH ROW EXECUTE FUNCTION stock_workspace_private.guard_origin_version();

CREATE FUNCTION stock_workspace_private.graph_permitted(p_relation text,p_operation text,p_prior jsonb,p_next jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE consumed uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role'
   OR NOT EXISTS(SELECT 1 FROM stock_workspace_private.settings WHERE singleton AND enabled)
   OR p_operation NOT IN ('INSERT','UPDATE')
   OR p_relation='company_memberships' AND p_prior->>'status'='revoked'
 THEN RETURN false; END IF;
 DELETE FROM stock_workspace_private.graph_permits WHERE transaction_id=pg_current_xact_id()
   AND relation_name=p_relation AND operation=p_operation AND record_id=(p_next->>'id')::uuid
   AND prior=p_prior AND successor=p_next RETURNING record_id INTO consumed;
 RETURN consumed IS NOT NULL;
END $fn$;

-- This is the exact old guard body with a narrow v2 prefix. The baseline hash
-- above pins it; the old v1 branch and its scoped recovery rule are preserved.
CREATE OR REPLACE FUNCTION core_e1_resource_private.guard_graph() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE prior jsonb := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 next_row jsonb := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 o core_e1_resource_private.origins%ROWTYPE; company uuid;
BEGIN
 IF stock_workspace_private.graph_permitted(TG_TABLE_NAME,TG_OP,prior,next_row) THEN RETURN NEW; END IF;
 company:=CASE WHEN TG_TABLE_NAME='companies' THEN coalesce((next_row->>'id')::uuid,(prior->>'id')::uuid)
   ELSE coalesce((next_row->>'company_id')::uuid,(prior->>'company_id')::uuid) END;
 IF EXISTS(SELECT 1 FROM stock_workspace_private.origins WHERE company_id=company)
   OR EXISTS(SELECT 1 FROM stock_membership_private.resources WHERE company_id=company)
   OR EXISTS(SELECT 1 FROM stock_workspace_private.origins WHERE company_id=(prior->>'company_id')::uuid)
   OR EXISTS(SELECT 1 FROM stock_membership_private.resources WHERE company_id=(prior->>'company_id')::uuid)
   OR (TG_TABLE_NAME='companies' AND EXISTS(SELECT 1 FROM stock_workspace_private.origins WHERE company_id=(prior->>'id')::uuid))
   OR (TG_TABLE_NAME='companies' AND EXISTS(SELECT 1 FROM stock_membership_private.resources WHERE company_id=(prior->>'id')::uuid))
 THEN
   -- The birth's native append-only audit may advance only audit_head, with
   -- its exact new event chained to the previous hash. No legacy E1 action.
   IF TG_TABLE_NAME='companies' AND TG_OP='UPDATE' AND (next_row-'audit_head')=(prior-'audit_head')
     AND EXISTS(SELECT 1 FROM stock_workspace_private.origins v JOIN core_registry_private.events e
       ON e.company_id=v.company_id AND e.actor_id=v.core_subject AND e.command_id=v.command_id
       WHERE v.company_id=company AND e.action='v2.stock.create' AND e.previous_hash=prior->>'audit_head'
         AND e.event_hash=next_row->>'audit_head')
   THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'STOCK_WORKSPACE_SCOPED_MUTATION_REQUIRED';
 END IF;
 -- Replacing the global index does not admit legacy multi-membership writers.
 IF TG_TABLE_NAME='company_memberships' AND TG_OP IN ('INSERT','UPDATE') AND next_row->>'status'='active'
   AND EXISTS(SELECT 1 FROM public.company_memberships m WHERE m.core_auth_user_id=(next_row->>'core_auth_user_id')::uuid
     AND m.status='active' AND m.id<>(next_row->>'id')::uuid)
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_LEGACY_MEMBERSHIP_PROTECTED'; END IF;
 SELECT * INTO o FROM core_e1_resource_private.origins WHERE
   company_id IN ((prior->>'company_id')::uuid,(next_row->>'company_id')::uuid)
   OR (TG_TABLE_NAME='companies' AND company_id IN ((prior->>'id')::uuid,(next_row->>'id')::uuid))
   OR (TG_TABLE_NAME='company_memberships' AND core_subject IN
     ((prior->>'core_auth_user_id')::uuid,(next_row->>'core_auth_user_id')::uuid))
   OR (TG_TABLE_NAME='owner_claims' AND core_subject IN
     ((prior->>'target_user_id')::uuid,(next_row->>'target_user_id')::uuid)) LIMIT 1;
 IF FOUND THEN
   IF TG_TABLE_NAME='owner_claims' THEN RAISE EXCEPTION 'E1_CLAIM_REQUIRES_SCOPED_RECOVERY'; END IF;
   IF TG_TABLE_NAME='companies' AND TG_OP='UPDATE' AND (next_row-'audit_head')=(prior-'audit_head')
     AND EXISTS(SELECT 1 FROM core_registry_private.events e WHERE e.company_id=o.company_id
       AND e.actor_id=o.core_subject AND e.previous_hash=prior->>'audit_head'
       AND e.event_hash=next_row->>'audit_head' AND e.action IN ('e1.stock.admit','e1.stock.stage','e1.stock.bind','e1.stock.checkout'))
   THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'E1_PROTECTED_GRAPH';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE FUNCTION stock_workspace_private.no_graph_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM stock_workspace_private.origins) OR EXISTS(SELECT 1 FROM stock_membership_private.resources)
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_SCOPED_MUTATION_REQUIRED'; END IF;
 RETURN NULL;
END $fn$;
CREATE TRIGGER stock_workspace_no_truncate BEFORE TRUNCATE ON public.companies
 FOR EACH STATEMENT EXECUTE FUNCTION stock_workspace_private.no_graph_truncate();
CREATE TRIGGER stock_workspace_no_truncate BEFORE TRUNCATE ON public.company_memberships
 FOR EACH STATEMENT EXECUTE FUNCTION stock_workspace_private.no_graph_truncate();
CREATE TRIGGER stock_workspace_no_truncate BEFORE TRUNCATE ON public.company_portal_instances
 FOR EACH STATEMENT EXECUTE FUNCTION stock_workspace_private.no_graph_truncate();
CREATE UNIQUE INDEX company_memberships_current_workspace ON public.company_memberships(company_id,core_auth_user_id) WHERE status='active';
DROP INDEX public.company_memberships_one_active_user;

CREATE FUNCTION public.core_stock_workspace_create(p_actor uuid,p_session uuid,p_auth_until timestamptz,p_command uuid,p_company_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE origin stock_workspace_private.origins%ROWTYPE; fingerprint text; receipt jsonb; birth_timestamp timestamptz:=clock_timestamp();
 company public.companies%ROWTYPE; member public.company_memberships%ROWTYPE; instance public.company_portal_instances%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_session IS NULL OR p_command IS NULL
   OR p_auth_until IS NULL OR p_auth_until<=clock_timestamp() OR p_auth_until>clock_timestamp()+interval '30 seconds'
   OR p_company_name IS NULL OR length(p_company_name) NOT BETWEEN 2 AND 100
   OR p_company_name<>btrim(p_company_name) OR p_company_name ~ '[[:cntrl:]]'
   OR NOT EXISTS(SELECT 1 FROM stock_workspace_private.settings WHERE singleton AND enabled)
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_DENIED'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_WORKSPACE_BUSY_REAUTHENTICATE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
   WHERE s.id=p_session AND s.user_id=p_actor AND (s.not_after IS NULL OR s.not_after>clock_timestamp())
     AND u.deleted_at IS NULL AND u.is_anonymous IS FALSE AND u.email_confirmed_at<=clock_timestamp()
     AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))
   OR EXISTS(SELECT 1 FROM core_registry_private.operators WHERE subject_id=p_actor AND active)
   OR EXISTS(SELECT 1 FROM core_registry_private.owner_claims WHERE target_user_id=p_actor AND status='pending')
   OR EXISTS(SELECT 1 FROM stock_membership_private.identity_pairs WHERE core_subject=p_actor AND revoked_at IS NOT NULL)
   OR NOT stock_billing_private.paid_creation_allowed(p_actor,NULL)
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_DENIED'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('action','v2.stock.create','companyName',p_company_name)::text,'UTF8')),'hex');
 SELECT * INTO origin FROM stock_workspace_private.origins WHERE core_subject=p_actor AND command_id=p_command;
 IF FOUND THEN
   IF origin.request_digest<>fingerprint OR NOT EXISTS(SELECT 1 FROM public.companies c
     JOIN public.company_memberships m ON m.company_id=c.id WHERE c.id=origin.company_id AND c.status='active'
       AND m.id=origin.membership_id AND m.core_auth_user_id=p_actor AND m.role='owner' AND m.status='active')
   THEN RAISE EXCEPTION 'STOCK_WORKSPACE_REPLAY_CONFLICT'; END IF;
   SELECT result INTO STRICT receipt FROM core_registry_private.events WHERE actor_id=p_actor AND command_id=p_command
     AND company_id=origin.company_id AND action='v2.stock.create' AND request_digest=fingerprint;
 ELSE
   -- All identifiers are generated here. The request supplies no existing
   -- Company/resource, legacy identifier, role, membership, profile or tenant.
   company:=jsonb_populate_record(NULL::public.companies,jsonb_build_object('id',gen_random_uuid(),
     'display_name',p_company_name,'status','active','revision',0,'audit_head',repeat('0',64),'created_at',birth_timestamp));
   member:=jsonb_populate_record(NULL::public.company_memberships,jsonb_build_object('id',gen_random_uuid(),
     'company_id',company.id,'core_auth_user_id',p_actor,'role','owner','status','active','created_at',birth_timestamp));
   instance:=jsonb_populate_record(NULL::public.company_portal_instances,jsonb_build_object('id',gen_random_uuid(),
     'company_id',company.id,'portal_type','stock','lifecycle_status','reserved','created_at',birth_timestamp));
   INSERT INTO stock_workspace_private.graph_permits VALUES
     (pg_current_xact_id(),'companies','INSERT',company.id,p_command,'{}',to_jsonb(company)),
     (pg_current_xact_id(),'company_memberships','INSERT',member.id,p_command,'{}',to_jsonb(member)),
     (pg_current_xact_id(),'company_portal_instances','INSERT',instance.id,p_command,'{}',to_jsonb(instance));
   INSERT INTO public.companies SELECT company.*;
   INSERT INTO public.company_memberships SELECT member.*;
   INSERT INTO public.company_portal_instances SELECT instance.*;
   INSERT INTO stock_workspace_private.origins(company_id,membership_id,core_subject,reservation_id,
     core_tenant_id,stock_tenant_id,profile_id,command_id,request_digest)
   VALUES(company.id,member.id,p_actor,instance.id,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),p_command,fingerprint)
   RETURNING * INTO origin;
   receipt:=core_registry_private.append_event(company.id,p_actor,p_session,p_command,'v2.stock.create',fingerprint,
     'null',jsonb_build_object('companyId',company.id,'reservationId',instance.id,'source','core.stock.workspace.v2'),instance.id::text,'{}',NULL);
 END IF;
 IF p_auth_until<=clock_timestamp() OR EXISTS(SELECT 1 FROM stock_workspace_private.graph_permits WHERE transaction_id=pg_current_xact_id())
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_UNCONFIRMED'; END IF;
 RETURN jsonb_build_object('version',2,'status','reserved','companyId',origin.company_id,'instanceId',origin.reservation_id,
   'commandId',origin.command_id,'companyName',p_company_name,'receipt',receipt,'accessGranted',false);
END $fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA stock_workspace_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.core_stock_workspace_create(uuid,uuid,timestamptz,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_workspace_create(uuid,uuid,timestamptz,uuid,text) TO service_role;
COMMIT;
