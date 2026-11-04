-- Core forward proposal. Reserves seats and stages native claims without activating access.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres'
   OR to_regprocedure('stock_workspace_private.billing_session_live(uuid,uuid)') IS NULL
   OR to_regclass('stock_membership_private.operator_invitations') IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='auth.users'::regclass AND attname='email' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_BASELINE_DENIED'; END IF;
END $preflight$;

CREATE TABLE stock_membership_private.operator_invitation_settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO stock_membership_private.operator_invitation_settings VALUES(true,false);
CREATE TABLE stock_membership_private.operator_invitations(
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 instance_id uuid NOT NULL,
 stock_tenant_id uuid NOT NULL,
 owner_membership_id uuid NOT NULL,
 issuer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 command_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','staff','produksi')),
 email_hash bytea NOT NULL CHECK(octet_length(email_hash)=32),
 secret_hash bytea NOT NULL UNIQUE CHECK(octet_length(secret_hash)=32),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at=issued_at+interval '24 hours'),
 FOREIGN KEY(company_id,instance_id,stock_tenant_id)
   REFERENCES stock_membership_private.resources(company_id,instance_id,stock_tenant_id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_membership_id,company_id)
   REFERENCES stock_membership_private.memberships(id,company_id) ON DELETE RESTRICT,
 UNIQUE(issuer_id,command_id)
);
CREATE INDEX stock_operator_invite_resource_idx ON stock_membership_private.operator_invitations(company_id,instance_id,stock_tenant_id);
CREATE INDEX stock_operator_invite_owner_idx ON stock_membership_private.operator_invitations(owner_membership_id,company_id);
CREATE INDEX stock_operator_invite_company_expiry_idx ON stock_membership_private.operator_invitations(company_id,expires_at);
CREATE TABLE stock_membership_private.operator_invitation_claims(
 id uuid PRIMARY KEY REFERENCES stock_membership_private.operator_invitations(id) ON DELETE RESTRICT,
 command_id uuid NOT NULL,
 core_subject uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 stock_subject uuid NOT NULL,
 first_stock_session uuid NOT NULL,
 membership_id uuid NOT NULL UNIQUE,
 profile_id uuid NOT NULL UNIQUE,
 claimed_at timestamptz NOT NULL,
 UNIQUE(core_subject,command_id)
);
CREATE INDEX stock_operator_claim_stock_idx ON stock_membership_private.operator_invitation_claims(stock_subject);
CREATE TABLE stock_membership_private.operator_invitation_closures(
 id uuid PRIMARY KEY REFERENCES stock_membership_private.operator_invitations(id) ON DELETE RESTRICT,
 state text NOT NULL CHECK(state IN ('canceled','expired','activated')),
 actor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 command_id uuid,
 closed_at timestamptz NOT NULL,
 CHECK((state='expired' AND actor_id IS NULL AND command_id IS NULL) OR
       (state IN ('canceled','activated') AND actor_id IS NOT NULL AND command_id IS NOT NULL)),
 UNIQUE(actor_id,command_id)
);

DO $protection$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['operator_invitation_settings','operator_invitations','operator_invitation_claims','operator_invitation_closures'] LOOP
   EXECUTE format('ALTER TABLE stock_membership_private.%I ENABLE ROW LEVEL SECURITY',n);
   EXECUTE format('ALTER TABLE stock_membership_private.%I FORCE ROW LEVEL SECURITY',n);
   EXECUTE format('REVOKE ALL ON TABLE stock_membership_private.%I FROM PUBLIC,anon,authenticated,service_role',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['operator_invitations','operator_invitation_claims','operator_invitation_closures'] LOOP
   EXECUTE format('CREATE TRIGGER operator_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.%I FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable()',n);
   EXECUTE format('CREATE TRIGGER operator_registry_fence BEFORE INSERT ON stock_membership_private.%I FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry()',n);
   EXECUTE format('CREATE TRIGGER operator_invitation_audit AFTER INSERT ON stock_membership_private.%I FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit()',n);
 END LOOP;
END $protection$;

CREATE FUNCTION stock_membership_private.operator_invitation_fence(p_until timestamptz) RETURNS timestamptz
LANGUAGE plpgsql SET search_path='' AS $fn$
DECLARE observed timestamptz;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS(
    SELECT 1 FROM stock_membership_private.operator_invitation_settings WHERE singleton AND enabled)
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.settings WHERE singleton AND enabled)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_MEMBERSHIP_BUSY_REAUTHENTICATE'; END IF;
 observed:=clock_timestamp();
 IF p_until IS NULL OR p_until<=observed OR p_until>observed+interval '30 seconds'
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 RETURN observed;
END $fn$;

-- Caller holds the Registry fence. The paid contract and exact acknowledged
-- delivery select capacity. An unexpired claim still occupies its reservation.
CREATE FUNCTION stock_membership_private.operator_seats_remaining(p_company uuid,p_instance uuid,p_observed timestamptz)
RETURNS bigint LANGUAGE sql SET search_path='' AS $fn$
 SELECT plan.max_users
   - (SELECT count(*) FROM stock_membership_private.memberships m
      WHERE m.company_id=r.company_id AND m.revoked_at IS NULL)
   - (SELECT count(*) FROM stock_membership_private.operator_invitations i
      WHERE i.company_id=r.company_id AND i.expires_at>p_observed
        AND NOT EXISTS(SELECT 1 FROM stock_membership_private.operator_invitation_closures closed WHERE closed.id=i.id))
 FROM stock_membership_private.resources r
 JOIN stock_membership_private.memberships owner ON owner.id=r.owner_membership_id AND owner.company_id=r.company_id
 JOIN public.tenants t ON t.id=r.core_tenant_id AND t.platform='stock' AND t.status='active' AND t.owner_user_id=owner.core_subject
 JOIN stock_billing_private.accounts a ON a.company_id=r.company_id AND a.reservation_id=r.instance_id
   AND a.tenant_id=t.id AND a.owner_id=owner.core_subject
 JOIN public.tenant_subscriptions s ON s.tenant_id=t.id AND s.status='active' AND s.current_period_end>p_observed
 JOIN public.subscription_plans plan ON plan.id=s.plan_id
 WHERE r.company_id=p_company AND r.instance_id=p_instance AND r.revoked_at IS NULL
   AND stock_billing_private.current_owner(r.company_id,owner.core_subject)
   AND stock_billing_private.paid_creation_allowed(owner.core_subject,owner.stock_subject)
   AND stock_billing_private.approved_plan(plan.id) AND plan.max_users IN (1,3)
   AND EXISTS(SELECT 1 FROM stock_billing_private.deliveries d
     JOIN public.subscription_invoices i ON i.id=d.invoice_id AND i.tenant_id=d.tenant_id
       AND i.plan_id=d.plan_id AND i.status='paid' AND i.period='monthly' AND i.amount=plan.price_monthly
     JOIN stock_billing_private.settings cfg ON cfg.singleton AND cfg.enabled AND cfg.payment_mode=i.midtrans_mode
     WHERE d.tenant_id=t.id AND d.plan_id=s.plan_id AND d.state='active' AND d.expires_at=s.current_period_end)
$fn$;

CREATE FUNCTION public.core_stock_operator_invite(
 p_actor uuid,p_session uuid,p_until timestamptz,p_company uuid,p_instance uuid,p_command uuid,
 p_role text,p_email_hash text,p_secret_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE observed timestamptz; capacity bigint; existing_state text;
 resource stock_membership_private.resources%ROWTYPE; invitation stock_membership_private.operator_invitations%ROWTYPE;
BEGIN
 IF p_command IS NULL OR p_role IS NULL OR p_role NOT IN ('admin','staff','produksi')
   OR p_email_hash IS NULL OR p_email_hash !~ '^[0-9a-f]{64}$'
   OR p_secret_hash IS NULL OR p_secret_hash !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 observed:=stock_membership_private.operator_invitation_fence(p_until);
 IF NOT stock_workspace_private.billing_session_live(p_actor,p_session)
   OR NOT stock_billing_private.current_owner(p_company,p_actor)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 SELECT * INTO resource FROM stock_membership_private.resources
  WHERE company_id=p_company AND instance_id=p_instance AND revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 -- Expiry releases capacity by clock even before the next write materializes
 -- its immutable audit. A claim is retained when its reservation closes.
 INSERT INTO stock_membership_private.operator_invitation_closures(id,state,closed_at)
 SELECT i.id,'expired',observed FROM stock_membership_private.operator_invitations i
  WHERE i.company_id=p_company AND i.expires_at<=observed
    AND NOT EXISTS(SELECT 1 FROM stock_membership_private.operator_invitation_closures c WHERE c.id=i.id)
 ON CONFLICT(id) DO NOTHING;
 SELECT * INTO invitation FROM stock_membership_private.operator_invitations
   WHERE issuer_id=p_actor AND command_id=p_command;
 IF FOUND THEN
   IF invitation.company_id<>p_company OR invitation.instance_id<>p_instance OR invitation.role<>p_role
     OR invitation.email_hash<>decode(p_email_hash,'hex') OR invitation.secret_hash<>decode(p_secret_hash,'hex')
   THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_REPLAY_CONFLICT'; END IF;
   SELECT state INTO existing_state FROM stock_membership_private.operator_invitation_closures WHERE id=invitation.id;
   IF existing_state IS NULL THEN
     capacity:=stock_membership_private.operator_seats_remaining(p_company,p_instance,observed);
     IF capacity IS NULL OR capacity<0 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
     IF EXISTS(SELECT 1 FROM stock_membership_private.operator_invitation_claims WHERE id=invitation.id)
     THEN existing_state:='claimed'; END IF;
   END IF;
 ELSE
   capacity:=stock_membership_private.operator_seats_remaining(p_company,p_instance,observed);
   IF capacity IS NULL THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
   IF capacity<1 THEN RETURN jsonb_build_object('status','full'); END IF;
   IF EXISTS(SELECT 1 FROM stock_membership_private.operator_invitations i
       WHERE i.company_id=p_company AND i.expires_at>observed AND i.email_hash=decode(p_email_hash,'hex')
         AND NOT EXISTS(SELECT 1 FROM stock_membership_private.operator_invitation_closures closed WHERE closed.id=i.id))
     OR EXISTS(SELECT 1 FROM stock_membership_private.memberships m JOIN auth.users u ON u.id=m.core_subject
       WHERE m.company_id=p_company AND m.revoked_at IS NULL AND sha256(convert_to(lower(btrim(u.email)),'UTF8'))=decode(p_email_hash,'hex'))
   THEN RETURN jsonb_build_object('status','duplicate'); END IF;
   INSERT INTO stock_membership_private.operator_invitations(id,company_id,instance_id,stock_tenant_id,owner_membership_id,
     issuer_id,command_id,role,email_hash,secret_hash,issued_at,expires_at)
   VALUES(gen_random_uuid(),p_company,p_instance,resource.stock_tenant_id,resource.owner_membership_id,
     p_actor,p_command,p_role,decode(p_email_hash,'hex'),decode(p_secret_hash,'hex'),observed,observed+interval '24 hours')
   RETURNING * INTO invitation;
 END IF;
 IF p_until<=clock_timestamp() OR NOT stock_workspace_private.billing_session_live(p_actor,p_session)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 RETURN jsonb_build_object('status',coalesce(existing_state,'reserved'),'inviteId',invitation.id,
   'companyId',invitation.company_id,'instanceId',invitation.instance_id,'commandId',invitation.command_id,
   'role',invitation.role,'expiresAt',invitation.expires_at);
END $fn$;

CREATE FUNCTION public.core_stock_operator_claim(
 p_core_subject uuid,p_core_session uuid,p_stock_subject uuid,p_stock_session uuid,p_until timestamptz,
 p_invite uuid,p_command uuid,p_secret_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE observed timestamptz; capacity bigint; closed text;
 invitation stock_membership_private.operator_invitations%ROWTYPE;
 admission stock_membership_private.operator_invitation_claims%ROWTYPE;
BEGIN
 IF p_command IS NULL OR p_stock_subject IS NULL OR p_stock_session IS NULL OR p_secret_hash IS NULL
   OR p_secret_hash !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 observed:=stock_membership_private.operator_invitation_fence(p_until);
 IF NOT stock_workspace_private.billing_session_live(p_core_subject,p_core_session)
   OR NOT stock_billing_private.paid_creation_allowed(p_core_subject,p_stock_subject)
   OR EXISTS(SELECT 1 FROM core_registry_private.operators WHERE subject_id=p_core_subject AND active)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 SELECT i.* INTO invitation FROM stock_membership_private.operator_invitations i
 JOIN auth.users u ON u.id=p_core_subject
   AND sha256(convert_to(lower(btrim(u.email)),'UTF8'))=i.email_hash
 WHERE i.id=p_invite AND i.secret_hash=decode(p_secret_hash,'hex') AND i.issuer_id<>p_core_subject;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 IF invitation.expires_at<=observed THEN
   INSERT INTO stock_membership_private.operator_invitation_closures(id,state,closed_at)
   VALUES(invitation.id,'expired',observed) ON CONFLICT(id) DO NOTHING;
 END IF;
 SELECT state INTO closed FROM stock_membership_private.operator_invitation_closures WHERE id=invitation.id;
 IF closed IS NOT NULL THEN RETURN jsonb_build_object('status',closed,'inviteId',invitation.id,'accessGranted',false); END IF;
 capacity:=stock_membership_private.operator_seats_remaining(invitation.company_id,invitation.instance_id,observed);
 IF capacity IS NULL OR capacity<0
   OR EXISTS(SELECT 1 FROM stock_membership_private.memberships m WHERE m.company_id=invitation.company_id
     AND (m.core_subject=p_core_subject OR m.stock_subject=p_stock_subject) AND m.revoked_at IS NULL)
   OR EXISTS(SELECT 1 FROM stock_membership_private.identity_pairs pair
     WHERE (pair.core_subject=p_core_subject OR pair.stock_subject=p_stock_subject)
       AND (pair.revoked_at IS NOT NULL OR pair.core_subject<>p_core_subject OR pair.stock_subject<>p_stock_subject))
   OR EXISTS(SELECT 1 FROM stock_membership_private.operator_invitation_claims other
     JOIN stock_membership_private.operator_invitations i ON i.id=other.id AND i.expires_at>observed
     WHERE other.id<>invitation.id AND (other.core_subject=p_core_subject OR other.stock_subject=p_stock_subject)
       AND (i.company_id=invitation.company_id OR other.core_subject<>p_core_subject OR other.stock_subject<>p_stock_subject)
       AND NOT EXISTS(SELECT 1 FROM stock_membership_private.operator_invitation_closures terminal WHERE terminal.id=i.id))
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 SELECT * INTO admission FROM stock_membership_private.operator_invitation_claims WHERE id=p_invite;
 IF FOUND THEN
   IF admission.core_subject<>p_core_subject OR admission.stock_subject<>p_stock_subject OR admission.command_id<>p_command
   THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_REPLAY_CONFLICT'; END IF;
 ELSE
   INSERT INTO stock_membership_private.operator_invitation_claims(id,command_id,core_subject,stock_subject,
     first_stock_session,membership_id,profile_id,claimed_at)
   VALUES(p_invite,p_command,p_core_subject,p_stock_subject,p_stock_session,gen_random_uuid(),gen_random_uuid(),observed)
   RETURNING * INTO admission;
 END IF;
 IF p_until<=clock_timestamp() OR invitation.expires_at<=clock_timestamp()
   OR NOT stock_workspace_private.billing_session_live(p_core_subject,p_core_session)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 RETURN jsonb_build_object('status','claimed','inviteId',admission.id,'commandId',admission.command_id,
   'companyId',invitation.company_id,'instanceId',invitation.instance_id,'stockTenantId',invitation.stock_tenant_id,
   'ownerMembershipId',invitation.owner_membership_id,'coreSubject',admission.core_subject,'stockSubject',admission.stock_subject,
   'membershipId',admission.membership_id,'profileId',admission.profile_id,'role',invitation.role,
   'expiresAt',invitation.expires_at,'accessGranted',false);
END $fn$;

CREATE FUNCTION public.core_stock_operator_cancel_invite(
 p_actor uuid,p_session uuid,p_until timestamptz,p_company uuid,p_invite uuid,p_command uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE observed timestamptz; closed text; expires timestamptz;
BEGIN
 IF p_command IS NULL THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 observed:=stock_membership_private.operator_invitation_fence(p_until);
 IF NOT stock_workspace_private.billing_session_live(p_actor,p_session)
   OR NOT stock_billing_private.current_owner(p_company,p_actor)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 SELECT expires_at INTO expires FROM stock_membership_private.operator_invitations
   WHERE id=p_invite AND company_id=p_company AND issuer_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 IF expires<=observed THEN
   INSERT INTO stock_membership_private.operator_invitation_closures(id,state,closed_at)
   VALUES(p_invite,'expired',observed) ON CONFLICT(id) DO NOTHING;
 ELSE
   INSERT INTO stock_membership_private.operator_invitation_closures(id,state,actor_id,command_id,closed_at)
   VALUES(p_invite,'canceled',p_actor,p_command,observed) ON CONFLICT(id) DO NOTHING;
 END IF;
 SELECT state INTO STRICT closed FROM stock_membership_private.operator_invitation_closures WHERE id=p_invite;
 IF p_until<=clock_timestamp() OR NOT stock_workspace_private.billing_session_live(p_actor,p_session)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_INVITATION_DENIED'; END IF;
 RETURN jsonb_build_object('status',closed,'inviteId',p_invite,'companyId',p_company);
END $fn$;

REVOKE ALL ON FUNCTION stock_membership_private.operator_invitation_fence(timestamptz),
 stock_membership_private.operator_seats_remaining(uuid,uuid,timestamptz),
 public.core_stock_operator_invite(uuid,uuid,timestamptz,uuid,uuid,uuid,text,text,text),
 public.core_stock_operator_claim(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,text),
 public.core_stock_operator_cancel_invite(uuid,uuid,timestamptz,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_operator_invite(uuid,uuid,timestamptz,uuid,uuid,uuid,text,text,text),
 public.core_stock_operator_claim(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,text),
 public.core_stock_operator_cancel_invite(uuid,uuid,timestamptz,uuid,uuid,uuid) TO service_role;
COMMIT;
