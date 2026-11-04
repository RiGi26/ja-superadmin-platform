-- Core forward proposal. Accepts an independently authenticated Stock stage receipt.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres'
   OR to_regprocedure('stock_membership_private.operator_invitation_fence(timestamptz)') IS NULL
   OR to_regclass('stock_workspace_private.graph_permits') IS NULL
   OR to_regprocedure('public.core_stock_operator_commit(uuid,uuid,uuid,uuid,timestamptz,uuid,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_BASELINE_DENIED'; END IF;
END $preflight$;
CREATE TABLE stock_membership_private.operator_commit_settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false
);
INSERT INTO stock_membership_private.operator_commit_settings VALUES(true,false);
ALTER TABLE stock_membership_private.operator_commit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_membership_private.operator_commit_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE stock_membership_private.operator_commit_settings FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE stock_membership_private.operator_invitation_closures ADD COLUMN receipt jsonb,
 ADD CONSTRAINT stock_operator_committed_receipt CHECK(
   (state='activated' AND jsonb_typeof(receipt) IS NOT DISTINCT FROM 'object') OR
   (state<>'activated' AND receipt IS NULL));

CREATE FUNCTION public.core_stock_operator_commit(p_core uuid,p_core_session uuid,p_stock uuid,p_stock_session uuid,
 p_until timestamptz,p_invite uuid,p_stage jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE observed timestamptz; capacity bigint; audit_id uuid; fingerprint text; pair_id uuid;
 invite stock_membership_private.operator_invitations%ROWTYPE;
 claim stock_membership_private.operator_invitation_claims%ROWTYPE;
 closed stock_membership_private.operator_invitation_closures%ROWTYPE;
 resource stock_membership_private.resources%ROWTYPE;
 registry_member public.company_memberships%ROWTYPE;
 expected jsonb; event jsonb; result jsonb;
BEGIN
 observed:=stock_membership_private.operator_invitation_fence(p_until);
 IF p_stock_session IS NULL OR NOT stock_workspace_private.billing_session_live(p_core,p_core_session)
   OR NOT stock_billing_private.paid_creation_allowed(p_core,p_stock)
   OR EXISTS(SELECT 1 FROM core_registry_private.operators WHERE subject_id=p_core AND active)
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.operator_commit_settings WHERE singleton AND enabled)
   OR NOT EXISTS(SELECT 1 FROM stock_workspace_private.settings WHERE singleton AND enabled)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_DENIED'; END IF;
 SELECT i.* INTO invite FROM stock_membership_private.operator_invitations i
 JOIN auth.users u ON u.id=p_core AND sha256(convert_to(lower(btrim(u.email)),'UTF8'))=i.email_hash
 WHERE i.id=p_invite;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_DENIED'; END IF;
 SELECT * INTO claim FROM stock_membership_private.operator_invitation_claims
   WHERE id=p_invite AND command_id=p_invite AND core_subject=p_core AND stock_subject=p_stock;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_DENIED'; END IF;
 SELECT * INTO resource FROM stock_membership_private.resources
   WHERE company_id=invite.company_id AND instance_id=invite.instance_id AND stock_tenant_id=invite.stock_tenant_id
     AND owner_membership_id=invite.owner_membership_id AND revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_DENIED'; END IF;
 capacity:=stock_membership_private.operator_seats_remaining(invite.company_id,invite.instance_id,observed);
 IF capacity IS NULL OR capacity<0 THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_DENIED'; END IF;
 SELECT * INTO closed FROM stock_membership_private.operator_invitation_closures WHERE id=p_invite;
 IF FOUND THEN
   IF closed.state<>'activated' OR closed.actor_id<>p_core OR closed.command_id<>p_invite
     OR (p_stage IS NOT NULL AND closed.receipt->'stage' IS DISTINCT FROM p_stage)
     OR NOT EXISTS(SELECT 1 FROM stock_membership_private.memberships m
       JOIN stock_membership_private.identity_pairs pair ON pair.id=m.pair_id AND pair.revoked_at IS NULL
       JOIN public.company_memberships cm ON cm.id=m.id AND cm.company_id=m.company_id
         AND cm.core_auth_user_id=m.core_subject AND cm.role='member' AND cm.status='active'
       WHERE m.id=claim.membership_id AND m.company_id=invite.company_id AND m.core_subject=p_core AND m.stock_subject=p_stock
         AND m.profile_id=claim.profile_id AND m.role=invite.role AND m.revision=1 AND m.revoked_at IS NULL)
   THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_DENIED'; END IF;
   result:=closed.receipt;
 ELSE
   IF invite.expires_at<=clock_timestamp() OR jsonb_typeof(p_stage) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_stage->'stockAuditEventId') IS DISTINCT FROM 'string'
     OR p_stage->>'stockAuditEventId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_DENIED'; END IF;
   audit_id:=(p_stage->>'stockAuditEventId')::uuid;
   expected:=jsonb_build_object('status','staged','inviteId',p_invite,'commandId',p_invite,
     'companyId',invite.company_id,'instanceId',invite.instance_id,'stockTenantId',invite.stock_tenant_id,
     'ownerMembershipId',invite.owner_membership_id,'coreSubject',p_core,'stockSubject',p_stock,
     'membershipId',claim.membership_id,'profileId',claim.profile_id,'role',invite.role,'expiresAt',invite.expires_at,
     'accessGranted',false,'stockAuditEventId',audit_id);
   IF p_stage IS DISTINCT FROM expected THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_DENIED'; END IF;
   INSERT INTO stock_membership_private.identity_pairs(id,core_subject,stock_subject)
     VALUES(gen_random_uuid(),p_core,p_stock) ON CONFLICT DO NOTHING;
   SELECT id INTO STRICT pair_id FROM stock_membership_private.identity_pairs
     WHERE core_subject=p_core AND stock_subject=p_stock AND revoked_at IS NULL;
   registry_member:=jsonb_populate_record(NULL::public.company_memberships,
     jsonb_build_object('id',claim.membership_id,'company_id',invite.company_id,'core_auth_user_id',p_core,
       'role','member','status','active','created_at',observed));
   INSERT INTO stock_workspace_private.graph_permits VALUES(pg_current_xact_id(),'company_memberships','INSERT',
     registry_member.id,p_invite,'{}',to_jsonb(registry_member));
   INSERT INTO public.company_memberships SELECT registry_member.*;
   INSERT INTO stock_membership_private.memberships(id,company_id,core_subject,stock_subject,pair_id,profile_id,role,revision)
     VALUES(claim.membership_id,invite.company_id,p_core,p_stock,pair_id,claim.profile_id,invite.role,1);
   fingerprint:=encode(sha256(convert_to(expected::text,'UTF8')),'hex');
   event:=core_registry_private.append_event(invite.company_id,p_core,p_core_session,p_invite,'v2.stock.operator.admit',fingerprint,
     'null',expected,audit_id::text,'{}',NULL);
   result:=jsonb_build_object('status','admitted','stage',expected,'coreTenantId',resource.core_tenant_id,
     'companyRevision',event->'revision','membershipRevision',1,'coreAuditEventId',event->'eventId','accessGranted',false);
   INSERT INTO stock_membership_private.operator_invitation_closures(id,state,actor_id,command_id,closed_at,receipt)
     VALUES(p_invite,'activated',p_core,p_invite,clock_timestamp(),result);
   IF invite.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_DENIED'; END IF;
 END IF;
 IF p_until<=clock_timestamp() OR NOT stock_workspace_private.billing_session_live(p_core,p_core_session)
   OR EXISTS(SELECT 1 FROM stock_workspace_private.graph_permits WHERE transaction_id=pg_current_xact_id())
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_DENIED'; END IF;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.core_stock_operator_commit(uuid,uuid,uuid,uuid,timestamptz,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_operator_commit(uuid,uuid,uuid,uuid,timestamptz,uuid,jsonb) TO service_role;
COMMIT;
