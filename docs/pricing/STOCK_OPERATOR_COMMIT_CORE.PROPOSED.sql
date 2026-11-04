-- Core forward proposal. Accepts an independently authenticated Stock stage receipt.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres'
   OR to_regprocedure('stock_membership_private.operator_invitation_fence(timestamptz)') IS NULL
   OR to_regclass('stock_workspace_private.graph_permits') IS NULL
   OR md5(pg_get_functiondef(to_regprocedure('core_e1_resource_private.guard_graph()')))
       IS DISTINCT FROM '173504a475a8f99f88b50595a1f73b5a'
   OR to_regprocedure('public.core_stock_operator_commit(uuid,uuid,uuid,uuid,timestamptz,uuid,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_COMMIT_BASELINE_DENIED'; END IF;
END $preflight$;
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
   -- Operator admission has its own exact scoped member insert. Only the
   -- chained event for that member may move the Company's audit head.
   IF TG_TABLE_NAME='companies' AND TG_OP='UPDATE' AND (next_row-'audit_head')=(prior-'audit_head')
     AND EXISTS(SELECT 1 FROM core_registry_private.events e
       JOIN stock_membership_private.memberships m ON m.company_id=e.company_id AND m.core_subject=e.actor_id
         AND m.id::text=(e.canonical_payload::jsonb->'after'->>'membershipId') AND m.revoked_at IS NULL AND m.revision=1
       JOIN stock_membership_private.resources r ON r.company_id=m.company_id AND r.owner_membership_id<>m.id
         AND r.instance_id::text=(e.canonical_payload::jsonb->'after'->>'instanceId')
       WHERE e.company_id=company AND e.action='v2.stock.operator.admit'
         AND e.previous_hash=prior->>'audit_head' AND e.event_hash=next_row->>'audit_head'
         AND e.command_id::text=(e.canonical_payload::jsonb->'after'->>'inviteId')
         AND m.profile_id::text=(e.canonical_payload::jsonb->'after'->>'profileId')
         AND m.role=(e.canonical_payload::jsonb->'after'->>'role'))
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
