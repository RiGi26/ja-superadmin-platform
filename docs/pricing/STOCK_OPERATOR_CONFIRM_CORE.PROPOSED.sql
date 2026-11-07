-- Core forward proposal. Records an independently authenticated Stock activation.
-- This immutable confirmation grants no session and changes no membership revision.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.core_stock_operator_workspaces()') IS NULL
   OR to_regclass('stock_membership_private.operator_confirmations') IS NOT NULL
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_BASELINE_DENIED'; END IF;
END $preflight$;
CREATE TABLE stock_membership_private.operator_confirmation_settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false
);
INSERT INTO stock_membership_private.operator_confirmation_settings VALUES(true,false);
CREATE TABLE stock_membership_private.operator_confirmations(
 id uuid PRIMARY KEY REFERENCES stock_membership_private.operator_invitation_closures(id) ON DELETE RESTRICT,
 membership_id uuid NOT NULL UNIQUE REFERENCES stock_membership_private.memberships(id) ON DELETE RESTRICT,
 stock_audit_event_id uuid NOT NULL UNIQUE,
 core_session_id uuid NOT NULL,stock_session_id uuid NOT NULL,
 context jsonb NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $security$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['operator_confirmation_settings','operator_confirmations'] LOOP
   EXECUTE format('ALTER TABLE stock_membership_private.%I ENABLE ROW LEVEL SECURITY',n);
   EXECUTE format('ALTER TABLE stock_membership_private.%I FORCE ROW LEVEL SECURITY',n);
   EXECUTE format('REVOKE ALL ON TABLE stock_membership_private.%I FROM PUBLIC,anon,authenticated,service_role',n);
 END LOOP;
END $security$;
CREATE TRIGGER operator_confirmation_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.operator_confirmations
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();
CREATE TRIGGER operator_confirmation_fence BEFORE INSERT ON stock_membership_private.operator_confirmations
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry();
CREATE TRIGGER operator_confirmation_audit AFTER INSERT ON stock_membership_private.operator_confirmations
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit();

CREATE FUNCTION public.core_stock_operator_confirm_activation(p_core uuid,p_core_session uuid,p_stock uuid,
 p_stock_session uuid,p_until timestamptz,p_invite uuid,p_context jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE observed timestamptz; audit_id uuid; expected jsonb;
 invitation stock_membership_private.operator_invitations%ROWTYPE;
 claim stock_membership_private.operator_invitation_claims%ROWTYPE;
 member stock_membership_private.memberships%ROWTYPE;
 resource stock_membership_private.resources%ROWTYPE;
 existing stock_membership_private.operator_confirmations%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role'
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.operator_confirmation_settings WHERE singleton AND enabled)
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.settings WHERE singleton AND enabled)
   OR p_stock_session IS NULL OR p_until IS NULL OR p_until<=clock_timestamp()
   OR p_until>clock_timestamp()+interval '30 seconds' OR jsonb_typeof(p_context) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_DENIED'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_MEMBERSHIP_BUSY_REAUTHENTICATE'; END IF;
 observed:=clock_timestamp();
 IF p_until<=observed OR NOT stock_workspace_private.billing_session_live(p_core,p_core_session)
   OR NOT stock_billing_private.paid_creation_allowed(p_core,p_stock)
   OR EXISTS(SELECT 1 FROM core_registry_private.operators WHERE subject_id=p_core AND active)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_DENIED'; END IF;
 SELECT * INTO invitation FROM stock_membership_private.operator_invitations WHERE id=p_invite;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_DENIED'; END IF;
 SELECT c.* INTO claim FROM stock_membership_private.operator_invitation_claims c
 JOIN stock_membership_private.operator_invitation_closures closed ON closed.id=c.id AND closed.state='activated'
   AND closed.actor_id=p_core AND closed.command_id=p_invite
 WHERE c.id=p_invite AND c.core_subject=p_core AND c.stock_subject=p_stock;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_DENIED'; END IF;
 SELECT r.* INTO resource FROM stock_membership_private.resources r
 WHERE r.company_id=invitation.company_id AND r.instance_id=invitation.instance_id
   AND r.stock_tenant_id=invitation.stock_tenant_id AND r.owner_membership_id=invitation.owner_membership_id AND r.revoked_at IS NULL;
 IF NOT FOUND OR coalesce(stock_membership_private.operator_seats_remaining(resource.company_id,resource.instance_id,observed),-1)<0
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_DENIED'; END IF;
 SELECT m.* INTO member FROM stock_membership_private.memberships m
 JOIN stock_membership_private.identity_pairs pair ON pair.id=m.pair_id AND pair.revoked_at IS NULL
   AND pair.core_subject=p_core AND pair.stock_subject=p_stock
 JOIN public.company_memberships cm ON cm.id=m.id AND cm.company_id=m.company_id
   AND cm.core_auth_user_id=p_core AND cm.role='member' AND cm.status='active'
 WHERE m.id=claim.membership_id AND m.company_id=resource.company_id AND m.profile_id=claim.profile_id
   AND m.core_subject=p_core AND m.stock_subject=p_stock AND m.revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_DENIED'; END IF;
 IF jsonb_typeof(p_context->'stockAuditEventId') IS DISTINCT FROM 'string'
   OR p_context->>'stockAuditEventId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_DENIED'; END IF;
 audit_id:=(p_context->>'stockAuditEventId')::uuid;
 expected:=jsonb_build_object('status','activated','inviteId',p_invite,'companyId',resource.company_id,
   'instanceId',resource.instance_id,'membershipId',member.id,'profileId',member.profile_id,'membershipRevision',1,
   'role',invitation.role,'coreSubject',p_core,'stockSubject',p_stock,'stockAuditEventId',audit_id,'accessGranted',false);
 IF (p_context-'stockSessionId') IS DISTINCT FROM expected
   OR jsonb_typeof(p_context->'stockSessionId') IS DISTINCT FROM 'string'
   OR p_context->>'stockSessionId' IS DISTINCT FROM p_stock_session::text
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_DENIED'; END IF;
 SELECT * INTO existing FROM stock_membership_private.operator_confirmations WHERE id=p_invite;
 IF FOUND THEN
   IF existing.context IS DISTINCT FROM expected OR existing.membership_id<>member.id OR existing.stock_audit_event_id<>audit_id
   THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_REPLAY_CONFLICT'; END IF;
 ELSE
   IF member.revision<>1 OR member.role<>invitation.role THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_DENIED'; END IF;
   INSERT INTO stock_membership_private.operator_confirmations(id,membership_id,stock_audit_event_id,core_session_id,stock_session_id,context)
     VALUES(p_invite,member.id,audit_id,p_core_session,p_stock_session,expected);
 END IF;
 IF p_until<=clock_timestamp() OR NOT stock_workspace_private.billing_session_live(p_core,p_core_session)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_CONFIRM_DENIED'; END IF;
 RETURN jsonb_build_object('status','confirmed','inviteId',p_invite,'companyId',resource.company_id,
   'membershipId',member.id,'profileId',member.profile_id,'stockAuditEventId',audit_id,'accessGranted',false);
END $fn$;
REVOKE ALL ON FUNCTION public.core_stock_operator_confirm_activation(uuid,uuid,uuid,uuid,timestamptz,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_operator_confirm_activation(uuid,uuid,uuid,uuid,timestamptz,uuid,jsonb) TO service_role;
COMMIT;
