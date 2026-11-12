-- Core-only source proposal. Audited operator commands and durable delivery payloads.
-- No managed SQL, delivery, activation or financial operation is enabled here.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $baseline$ BEGIN
 IF current_user<>'postgres' OR to_regclass('stock_membership_private.operator_confirmations') IS NULL
   OR to_regclass('stock_membership_private.member_commands') IS NOT NULL
   OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('stock_membership_private.guard_revoke()'))
      IS DISTINCT FROM '8c08aeb5c5dcf2ad143464d0b01e6efc'
   OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='stock_membership_private.memberships'::regclass
     AND tgname='membership_revoke_only' AND tgfoid='stock_membership_private.guard_revoke()'::regprocedure)
 THEN RAISE EXCEPTION 'STOCK_MEMBER_LIFECYCLE_BASELINE_DENIED'; END IF;
END $baseline$;
-- Revoked memberships retain their IDs and profiles; a later admission uses a
-- new record. Only current membership uniqueness is relaxed from the old model.
ALTER TABLE stock_membership_private.memberships
 DROP CONSTRAINT memberships_company_id_core_subject_key,
 DROP CONSTRAINT memberships_company_id_stock_subject_key;
CREATE UNIQUE INDEX stock_member_current_core ON stock_membership_private.memberships(company_id,core_subject) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX stock_member_current_stock ON stock_membership_private.memberships(company_id,stock_subject) WHERE revoked_at IS NULL;
CREATE TABLE stock_membership_private.lifecycle_settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),mutations_enabled boolean NOT NULL DEFAULT false,
 delivery_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO stock_membership_private.lifecycle_settings VALUES(true,false,false);
CREATE TABLE stock_membership_private.member_commands(
 id uuid PRIMARY KEY,actor_id uuid NOT NULL,command_id uuid NOT NULL,company_id uuid NOT NULL,
 membership_id uuid NOT NULL REFERENCES stock_membership_private.memberships(id) ON DELETE RESTRICT,
 request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 core_audit_event_id uuid NOT NULL UNIQUE REFERENCES core_registry_private.events(id) ON DELETE RESTRICT,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor_id,command_id)
);
CREATE INDEX stock_member_command_member_idx ON stock_membership_private.member_commands(membership_id);
CREATE INDEX stock_member_command_company_idx ON stock_membership_private.member_commands(company_id);
CREATE TABLE stock_membership_private.member_permits(
 transaction_id xid8 NOT NULL,membership_id uuid NOT NULL,prior jsonb NOT NULL,successor jsonb NOT NULL,
 PRIMARY KEY(transaction_id,membership_id)
);
CREATE TABLE stock_membership_private.member_audit_permits(
 transaction_id xid8 NOT NULL,company_id uuid NOT NULL,actor_id uuid NOT NULL,command_id uuid NOT NULL,
 action text NOT NULL,digest text NOT NULL,prior jsonb NOT NULL,successor jsonb NOT NULL,
 PRIMARY KEY(transaction_id,company_id,actor_id,command_id)
);
DO $security$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['lifecycle_settings','member_commands','member_permits','member_audit_permits'] LOOP
   EXECUTE format('ALTER TABLE stock_membership_private.%I ENABLE ROW LEVEL SECURITY',n);
   EXECUTE format('ALTER TABLE stock_membership_private.%I FORCE ROW LEVEL SECURITY',n);
   EXECUTE format('REVOKE ALL ON TABLE stock_membership_private.%I FROM PUBLIC,anon,authenticated,service_role',n);
 END LOOP;
END $security$;
CREATE TRIGGER member_command_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.member_commands
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();
CREATE TRIGGER member_command_fence BEFORE INSERT ON stock_membership_private.member_commands
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry();
CREATE TRIGGER member_command_audit AFTER INSERT ON stock_membership_private.member_commands
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit();

CREATE FUNCTION stock_membership_private.guard_member_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE consumed uuid;
BEGIN
 IF auth.role()='service_role' AND OLD.revoked_at IS NULL THEN
   DELETE FROM stock_membership_private.member_permits WHERE transaction_id=pg_current_xact_id()
     AND membership_id=OLD.id AND prior=to_jsonb(OLD) AND successor=to_jsonb(NEW) RETURNING membership_id INTO consumed;
   IF consumed IS NOT NULL THEN RETURN NEW; END IF;
 END IF;
 -- Retain the original revocation-only protection for existing custodians.
 IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
   OR (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at')
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_IDENTITY_IMMUTABLE'; END IF;
 NEW.revoked_at:=clock_timestamp();RETURN NEW;
END $fn$;
DROP TRIGGER membership_revoke_only ON stock_membership_private.memberships;
CREATE TRIGGER membership_revoke_only BEFORE UPDATE ON stock_membership_private.memberships
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.guard_member_change();

-- The existing graph guard consumes the exact Company row image produced here.
-- No legacy graph branch or Registry append implementation is replaced.
CREATE FUNCTION stock_membership_private.permit_member_audit_head() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE permitted uuid; before_company jsonb;
BEGIN
 IF NEW.action NOT IN ('v2.stock.member.role','v2.stock.member.revoke') THEN RETURN NEW; END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'STOCK_MEMBER_AUDIT_DENIED'; END IF;
 DELETE FROM stock_membership_private.member_audit_permits WHERE transaction_id=pg_current_xact_id()
   AND company_id=NEW.company_id AND actor_id=NEW.actor_id AND command_id=NEW.command_id
   AND action=NEW.action AND digest=NEW.request_digest
   AND prior=(NEW.canonical_payload::jsonb->'before') AND successor=(NEW.canonical_payload::jsonb->'after')
   RETURNING company_id INTO permitted;
 IF permitted IS NULL THEN RAISE EXCEPTION 'STOCK_MEMBER_AUDIT_DENIED'; END IF;
 SELECT to_jsonb(c) INTO STRICT before_company FROM public.companies c WHERE id=NEW.company_id AND audit_head=NEW.previous_hash;
 INSERT INTO stock_workspace_private.graph_permits VALUES(pg_current_xact_id(),'companies','UPDATE',NEW.company_id,
   NEW.command_id,before_company,before_company||jsonb_build_object('audit_head',NEW.event_hash));
 RETURN NEW;
END $fn$;
CREATE TRIGGER stock_member_audit_head AFTER INSERT ON core_registry_private.events
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.permit_member_audit_head();

CREATE FUNCTION public.core_stock_member_command(p_actor uuid,p_session uuid,p_until timestamptz,p_company uuid,
 p_member uuid,p_command uuid,p_expected_revision bigint,p_action text,p_role text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE observed timestamptz; digest text; event_id uuid:=gen_random_uuid(); audit jsonb; payload jsonb;
 prior_member stock_membership_private.memberships%ROWTYPE; next_member stock_membership_private.memberships%ROWTYPE;
 registry_member public.company_memberships%ROWTYPE; next_registry public.company_memberships%ROWTYPE;
 resource stock_membership_private.resources%ROWTYPE; replay stock_membership_private.member_commands%ROWTYPE;
 company_revision bigint;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_session IS NULL OR p_command IS NULL
   OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 1 AND 9007199254740990
   OR p_action IS NULL OR p_action NOT IN ('role','revoke')
   OR (p_action='role' AND (p_role IS NULL OR p_role NOT IN ('admin','staff','produksi')))
   OR (p_action='revoke' AND p_role IS NOT NULL)
   OR p_until IS NULL OR p_until<=clock_timestamp() OR p_until>clock_timestamp()+interval '30 seconds'
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.lifecycle_settings WHERE singleton AND mutations_enabled)
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.settings WHERE singleton AND enabled)
   OR NOT EXISTS(SELECT 1 FROM stock_workspace_private.settings WHERE singleton AND enabled)
 THEN RAISE EXCEPTION 'STOCK_MEMBER_COMMAND_DENIED'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_MEMBERSHIP_BUSY_REAUTHENTICATE'; END IF;
 observed:=clock_timestamp();
 IF p_until<=observed OR NOT stock_workspace_private.billing_session_live(p_actor,p_session)
   OR NOT stock_billing_private.current_owner(p_company,p_actor)
 THEN RAISE EXCEPTION 'STOCK_MEMBER_COMMAND_DENIED'; END IF;
 digest:=encode(sha256(convert_to(jsonb_build_object('companyId',p_company,'membershipId',p_member,
   'expectedRevision',p_expected_revision,'action',p_action,'role',p_role)::text,'UTF8')),'hex');
 SELECT * INTO replay FROM stock_membership_private.member_commands WHERE actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
   IF replay.request_digest<>digest THEN RAISE EXCEPTION 'STOCK_MEMBER_COMMAND_REPLAY_CONFLICT'; END IF;
   RETURN jsonb_build_object('status','saved','event',replay.payload);
 END IF;
 SELECT * INTO resource FROM stock_membership_private.resources WHERE company_id=p_company AND revoked_at IS NULL;
 IF NOT FOUND OR p_member=resource.owner_membership_id THEN RAISE EXCEPTION 'STOCK_MEMBER_OWNER_PROTECTED'; END IF;
 SELECT m.* INTO prior_member FROM stock_membership_private.memberships m
 JOIN public.company_memberships cm ON cm.id=m.id AND cm.company_id=m.company_id AND cm.core_auth_user_id=m.core_subject AND cm.role='member'
 WHERE m.id=p_member AND m.company_id=p_company;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MEMBER_COMMAND_DENIED'; END IF;
 IF prior_member.revoked_at IS NOT NULL THEN
   IF p_action='revoke' THEN RETURN jsonb_build_object('status','unchanged','membershipId',p_member,'revision',prior_member.revision); END IF;
   RAISE EXCEPTION 'STOCK_MEMBER_REVOKED';
 END IF;
 IF prior_member.revision<>p_expected_revision THEN RAISE EXCEPTION 'STOCK_MEMBER_REVISION_CONFLICT'; END IF;
 SELECT * INTO STRICT registry_member FROM public.company_memberships WHERE id=p_member AND status='active' AND role='member';
 IF p_action='role' THEN
   IF NOT EXISTS(SELECT 1 FROM stock_membership_private.operator_confirmations WHERE membership_id=p_member)
     OR coalesce(stock_membership_private.operator_seats_remaining(p_company,resource.instance_id,observed),-1)<0
     OR NOT EXISTS(SELECT 1 FROM stock_membership_private.identity_pairs WHERE id=prior_member.pair_id AND revoked_at IS NULL)
     OR NOT stock_billing_private.paid_creation_allowed(prior_member.core_subject,prior_member.stock_subject)
   THEN RAISE EXCEPTION 'STOCK_MEMBER_NOT_READY'; END IF;
   IF prior_member.role=p_role THEN RETURN jsonb_build_object('status','unchanged','membershipId',p_member,'revision',prior_member.revision); END IF;
 END IF;
 -- The current Owner is the retained admin and is never a target of this API.
 IF NOT EXISTS(SELECT 1 FROM stock_membership_private.memberships WHERE id=resource.owner_membership_id
   AND company_id=p_company AND role='admin' AND revoked_at IS NULL)
 THEN RAISE EXCEPTION 'STOCK_MEMBER_LAST_ADMIN_PROTECTED'; END IF;
 next_member:=prior_member;next_member.revision:=prior_member.revision+1;
 IF p_action='role' THEN next_member.role:=p_role; ELSE next_member.revoked_at:=observed; END IF;
 INSERT INTO stock_membership_private.member_permits VALUES(pg_current_xact_id(),p_member,to_jsonb(prior_member),to_jsonb(next_member));
 UPDATE stock_membership_private.memberships SET role=next_member.role,revision=next_member.revision,revoked_at=next_member.revoked_at WHERE id=p_member;
 IF p_action='revoke' THEN
   next_registry:=registry_member;next_registry.status:='revoked';next_registry.revoked_at:=observed;
   INSERT INTO stock_workspace_private.graph_permits VALUES(pg_current_xact_id(),'company_memberships','UPDATE',p_member,p_command,to_jsonb(registry_member),to_jsonb(next_registry));
   UPDATE public.company_memberships SET status='revoked',revoked_at=observed WHERE id=p_member;
 END IF;
 SELECT revision INTO STRICT company_revision FROM public.companies WHERE id=p_company;
 payload:=jsonb_build_object('kind','stock_member_event_v2','eventId',event_id,'commandId',p_command,
   'companyId',p_company,'companyRevision',company_revision,'instanceId',resource.instance_id,'coreTenantId',resource.core_tenant_id,
   'stockTenantId',resource.stock_tenant_id,'bindingId',resource.binding_id,'bindingRevision',resource.binding_revision,
   'ownerMembershipId',resource.owner_membership_id,'membershipId',p_member,'profileId',prior_member.profile_id,
   'coreSubject',prior_member.core_subject,'stockSubject',prior_member.stock_subject,'previousRevision',prior_member.revision,
   'revision',next_member.revision,'previousRole',prior_member.role,'role',next_member.role,'action',p_action,'occurredAt',observed);
 INSERT INTO stock_membership_private.member_audit_permits VALUES(pg_current_xact_id(),p_company,p_actor,p_command,
   'v2.stock.member.'||p_action,digest,to_jsonb(prior_member),payload);
 audit:=core_registry_private.append_event(p_company,p_actor,p_session,p_command,'v2.stock.member.'||p_action,digest,
   to_jsonb(prior_member),payload,event_id::text,'{}',NULL);
 payload:=payload||jsonb_build_object('coreAuditEventId',audit->'eventId');
 INSERT INTO stock_membership_private.member_commands(id,actor_id,command_id,company_id,membership_id,request_digest,core_audit_event_id,payload)
   VALUES(event_id,p_actor,p_command,p_company,p_member,digest,(audit->>'eventId')::uuid,payload);
 IF p_until<=clock_timestamp() OR NOT stock_workspace_private.billing_session_live(p_actor,p_session)
   OR EXISTS(SELECT 1 FROM stock_membership_private.member_permits WHERE transaction_id=pg_current_xact_id())
   OR EXISTS(SELECT 1 FROM stock_membership_private.member_audit_permits WHERE transaction_id=pg_current_xact_id())
   OR EXISTS(SELECT 1 FROM stock_workspace_private.graph_permits WHERE transaction_id=pg_current_xact_id())
 THEN RAISE EXCEPTION 'STOCK_MEMBER_COMMAND_DENIED'; END IF;
 RETURN jsonb_build_object('status','saved','event',payload);
END $fn$;
REVOKE ALL ON FUNCTION stock_membership_private.guard_member_change(),stock_membership_private.permit_member_audit_head(),
 public.core_stock_member_command(uuid,uuid,timestamptz,uuid,uuid,uuid,bigint,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_member_command(uuid,uuid,timestamptz,uuid,uuid,uuid,bigint,text,text) TO service_role;
COMMIT;
