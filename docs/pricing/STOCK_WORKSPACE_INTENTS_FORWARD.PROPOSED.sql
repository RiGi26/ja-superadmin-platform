-- Core hxhusfkrlafxdnyasmsu only. Forward proposal, not managed authorization.
-- Requires the native-Owner FK correction and installed billing foundation.
-- Retain the old last-choice pointer for existing callers. Recovery commands
-- belong to identity x workspace; package changes cannot replace those commands.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '20s';
DO $preflight$ BEGIN
 IF current_user <> 'postgres'
   OR to_regclass('stock_billing_private.workspace_intents') IS NOT NULL
   OR to_regprocedure('stock_billing_private.require_service_actor(uuid,uuid,timestamp with time zone)') IS NULL
   OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='stock_billing_private.intents'::regclass
     AND conname='intents_owner_id_fkey' AND confrelid='auth.users'::regclass AND convalidated)
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_INTENT_BASELINE_DRIFT'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_INTENT_BUSY'; END IF;
END $preflight$;

CREATE TABLE stock_billing_private.workspace_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
 plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
 command_id uuid NOT NULL DEFAULT gen_random_uuid(),
 expires_at timestamptz NOT NULL,
 UNIQUE NULLS NOT DISTINCT(owner_id,company_id),
 UNIQUE(owner_id,command_id)
);
CREATE INDEX stock_workspace_intent_company_idx ON stock_billing_private.workspace_intents(company_id);
CREATE INDEX stock_workspace_intent_plan_idx ON stock_billing_private.workspace_intents(plan_id);
ALTER TABLE stock_billing_private.workspace_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_billing_private.workspace_intents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON stock_billing_private.workspace_intents FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER stock_workspace_intent_no_delete BEFORE DELETE OR TRUNCATE ON stock_billing_private.workspace_intents
 FOR EACH STATEMENT EXECUTE FUNCTION stock_billing_private.immutable();
CREATE FUNCTION stock_billing_private.guard_workspace_intent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF (to_jsonb(OLD)-ARRAY['plan_id','expires_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['plan_id','expires_at'])
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_INTENT_IDENTITY_IMMUTABLE'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION stock_billing_private.guard_workspace_intent() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER stock_workspace_intent_identity BEFORE UPDATE ON stock_billing_private.workspace_intents
 FOR EACH ROW EXECUTE FUNCTION stock_billing_private.guard_workspace_intent();
-- Preserve every existing uncertain command during installation, without
-- granting new ownership or extending its expiry.
INSERT INTO stock_billing_private.workspace_intents(owner_id,company_id,plan_id,command_id,expires_at)
 SELECT owner_id,company_id,plan_id,command_id,expires_at FROM stock_billing_private.intents;

CREATE OR REPLACE FUNCTION public.stock_billing_remember_intent(p_actor uuid,p_session uuid,p_auth_until timestamptz,p_plan uuid,p_company uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE selected uuid; saved stock_billing_private.workspace_intents%ROWTYPE;
BEGIN
 PERFORM stock_billing_private.require_service_actor(p_actor,p_session,p_auth_until);
 IF NOT stock_billing_private.approved_plan(p_plan)
   OR p_company IS NOT NULL AND NOT stock_billing_private.current_owner(p_company,p_actor)
 THEN RAISE EXCEPTION 'STOCK_BILLING_DENIED'; END IF;
 SELECT reservation_id INTO selected FROM core_e1_resource_private.origins WHERE company_id=p_company;
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

CREATE FUNCTION public.stock_billing_read_workspace_intent(p_company uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT jsonb_build_object('planId',i.plan_id,'companyId',i.company_id,'reservationId',o.reservation_id,'commandId',i.command_id)
 FROM stock_billing_private.workspace_intents i
 LEFT JOIN core_e1_resource_private.origins o ON o.company_id=i.company_id AND o.core_subject=auth.uid()
 WHERE auth.role()='authenticated' AND public.core_registry_session_is_live()
   AND i.owner_id=auth.uid() AND i.company_id IS NOT DISTINCT FROM p_company
   AND i.expires_at>clock_timestamp() AND stock_billing_private.approved_plan(i.plan_id)
   AND (i.company_id IS NULL OR stock_billing_private.current_owner(i.company_id,auth.uid()))
$fn$;
REVOKE ALL ON FUNCTION public.stock_billing_read_workspace_intent(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.stock_billing_read_workspace_intent(uuid) TO authenticated;
COMMIT;
