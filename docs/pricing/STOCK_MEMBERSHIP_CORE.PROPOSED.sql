-- Core-only forward proposal. Source review and disposable tests only.
-- Does not replace E1 guards, admit members, enable sales, or grant table access.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '20s';
DO $preflight$ BEGIN
 IF current_user <> 'postgres'
   OR to_regnamespace('stock_membership_private') IS NOT NULL
   OR to_regclass('public.company_memberships') IS NULL
   OR to_regprocedure('core_registry_private.active_stock_core_session_live(uuid,uuid)') IS NULL
   OR to_regprocedure('stock_billing_private.paid_creation_allowed(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_BASELINE_DENIED'; END IF;
END $preflight$;

CREATE SCHEMA stock_membership_private;
REVOKE ALL ON SCHEMA stock_membership_private FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA stock_membership_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE stock_membership_private.settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO stock_membership_private.settings VALUES(true, false);

-- A native identity pair may own/join several resources; either subject can
-- belong to only one pair, including after revocation. Email is not a key.
CREATE TABLE stock_membership_private.identity_pairs (
 id uuid PRIMARY KEY,
 core_subject uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
 stock_subject uuid NOT NULL UNIQUE,
 revoked_at timestamptz,
 UNIQUE(id, core_subject, stock_subject)
);
CREATE TABLE stock_membership_private.resources (
 company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE RESTRICT,
 instance_id uuid NOT NULL UNIQUE REFERENCES public.company_portal_instances(id) ON DELETE RESTRICT,
 core_tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE RESTRICT,
 stock_tenant_id uuid NOT NULL UNIQUE,
 binding_id uuid NOT NULL UNIQUE,
 binding_revision bigint NOT NULL CHECK(binding_revision BETWEEN 1 AND 9007199254740991),
 owner_membership_id uuid NOT NULL,
 revoked_at timestamptz,
 UNIQUE(company_id, instance_id, stock_tenant_id)
);
CREATE TABLE stock_membership_private.memberships (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES stock_membership_private.resources(company_id) ON DELETE RESTRICT,
 core_subject uuid NOT NULL,
 stock_subject uuid NOT NULL,
 pair_id uuid NOT NULL,
 profile_id uuid NOT NULL UNIQUE,
 role text NOT NULL CHECK(role IN ('admin','staff','produksi')),
 revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
 revoked_at timestamptz,
 FOREIGN KEY(id, company_id, core_subject)
   REFERENCES public.company_memberships(id, company_id, core_auth_user_id) ON DELETE RESTRICT,
 FOREIGN KEY(pair_id, core_subject, stock_subject)
   REFERENCES stock_membership_private.identity_pairs(id, core_subject, stock_subject) ON DELETE RESTRICT,
 UNIQUE(id, company_id),
 UNIQUE(company_id, core_subject),
 UNIQUE(company_id, stock_subject)
);
CREATE INDEX stock_membership_member_pair_idx ON stock_membership_private.memberships(pair_id, core_subject, stock_subject);
CREATE INDEX stock_membership_member_core_idx ON stock_membership_private.memberships(core_subject);
CREATE INDEX stock_membership_member_stock_idx ON stock_membership_private.memberships(stock_subject);
ALTER TABLE stock_membership_private.resources ADD CONSTRAINT stock_membership_resource_owner_fk
 FOREIGN KEY(owner_membership_id, company_id) REFERENCES stock_membership_private.memberships(id, company_id)
 DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX stock_membership_resource_owner_idx ON stock_membership_private.resources(owner_membership_id, company_id);

-- A session has one immutable identity pair. Workspace choices append revisions
-- under the Registry fence; neither a retry nor a switch extends its lifetime.
CREATE TABLE stock_membership_private.sessions (
 stock_session uuid PRIMARY KEY,
 pair_id uuid NOT NULL REFERENCES stock_membership_private.identity_pairs(id) ON DELETE RESTRICT,
 core_session uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_at timestamptz,
 CHECK(expires_at > created_at AND expires_at <= created_at + interval '1 hour')
);
CREATE INDEX stock_membership_session_pair_idx ON stock_membership_private.sessions(pair_id);
CREATE TABLE stock_membership_private.selections (
 stock_session uuid NOT NULL REFERENCES stock_membership_private.sessions(stock_session) ON DELETE RESTRICT,
 revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
 command_id uuid NOT NULL,
 membership_id uuid NOT NULL REFERENCES stock_membership_private.memberships(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(stock_session,revision),
 UNIQUE(stock_session,command_id)
);
CREATE INDEX stock_membership_selection_member_idx ON stock_membership_private.selections(membership_id);
CREATE TABLE stock_membership_private.events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 relation_name text NOT NULL,
 record_id text NOT NULL,
 operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE')),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION stock_membership_private.immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN RAISE EXCEPTION 'STOCK_MEMBERSHIP_HISTORY_IMMUTABLE'; END $fn$;
CREATE FUNCTION stock_membership_private.guard_revoke() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
   OR (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at')
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_IDENTITY_IMMUTABLE'; END IF;
 NEW.revoked_at := clock_timestamp();
 RETURN NEW;
END $fn$;
CREATE FUNCTION stock_membership_private.audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 INSERT INTO stock_membership_private.events(relation_name,record_id,operation)
 VALUES(TG_TABLE_NAME,coalesce(to_jsonb(NEW)->>'id',to_jsonb(NEW)->>'company_id',to_jsonb(NEW)->>'stock_session'),TG_OP);
 RETURN NEW;
END $fn$;
CREATE FUNCTION stock_membership_private.lock_registry() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_MEMBERSHIP_BUSY_REAUTHENTICATE'; END IF;
 RETURN NULL;
END $fn$;
DO $security$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['settings','identity_pairs','resources','memberships','sessions','selections','events'] LOOP
   EXECUTE format('ALTER TABLE stock_membership_private.%I ENABLE ROW LEVEL SECURITY',n);
   EXECUTE format('ALTER TABLE stock_membership_private.%I FORCE ROW LEVEL SECURITY',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['identity_pairs','resources','memberships','sessions'] LOOP
   EXECUTE format('CREATE TRIGGER membership_no_delete BEFORE DELETE OR TRUNCATE ON stock_membership_private.%I FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable()',n);
   EXECUTE format('CREATE TRIGGER membership_revoke_only BEFORE UPDATE ON stock_membership_private.%I FOR EACH ROW EXECUTE FUNCTION stock_membership_private.guard_revoke()',n);
   EXECUTE format('CREATE TRIGGER membership_audit AFTER INSERT OR UPDATE ON stock_membership_private.%I FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit()',n);
 END LOOP;
END $security$;
DO $fences$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['identity_pairs','resources','memberships','sessions','selections'] LOOP
   EXECUTE format('CREATE TRIGGER membership_registry_fence BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.%I FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry()',n);
 END LOOP;
END $fences$;
CREATE TRIGGER membership_selection_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.selections
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();
CREATE TRIGGER membership_selection_audit AFTER INSERT ON stock_membership_private.selections
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit();
CREATE TRIGGER membership_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.events
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();

CREATE FUNCTION public.core_stock_membership_is_managed(p_core_subject uuid,p_stock_subject uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_core_subject IS NULL OR p_stock_subject IS NULL
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_DENIED'; END IF;
 -- OR is intentional: a substituted half of a retained pair must not select v1.
 RETURN EXISTS(SELECT 1 FROM stock_membership_private.identity_pairs
   WHERE core_subject=p_core_subject OR stock_subject=p_stock_subject);
END $fn$;

CREATE FUNCTION public.core_stock_membership_authorize_request(
 p_company uuid,p_instance uuid,p_profile uuid,p_membership uuid,p_membership_revision bigint,
 p_stock_subject uuid,p_stock_session uuid,p_core_subject uuid,p_verified_until timestamptz,p_selection_revision bigint) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_verified_until IS NULL
   OR p_verified_until <= clock_timestamp() OR p_verified_until > clock_timestamp()+interval '30 seconds'
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.settings WHERE singleton AND enabled)
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_DENIED'; END IF;
 SELECT jsonb_build_object(
   'bindingId',r.binding_id,'bindingRevision',r.binding_revision,
   'companyId',r.company_id,'companyRevision',c.revision,
   'coreSessionId',ss.core_session,'coreSubject',m.core_subject,'coreTenantId',r.core_tenant_id,
   'instanceId',r.instance_id,'stockTenantId',r.stock_tenant_id,'profileId',m.profile_id,
   'membershipId',m.id,'membershipRevision',m.revision,'selectionRevision',selection.revision,'role',m.role,
   'ownerMembershipId',om.id,'ownerMembershipRevision',om.revision)
 INTO STRICT result
 FROM stock_membership_private.resources r
 JOIN public.companies c ON c.id=r.company_id AND c.status='active'
 JOIN public.company_portal_instances pi ON pi.id=r.instance_id AND pi.company_id=r.company_id AND pi.portal_type='stock'
 JOIN stock_membership_private.memberships m ON m.company_id=r.company_id
 JOIN stock_membership_private.identity_pairs ip ON ip.id=m.pair_id AND ip.revoked_at IS NULL
 JOIN auth.users member_user ON member_user.id=m.core_subject
   AND member_user.deleted_at IS NULL AND member_user.email_confirmed_at IS NOT NULL
   AND member_user.email_confirmed_at<=clock_timestamp()
   AND (member_user.banned_until IS NULL OR member_user.banned_until<=clock_timestamp())
 JOIN public.company_memberships cm ON cm.id=m.id AND cm.company_id=m.company_id
   AND cm.core_auth_user_id=m.core_subject AND cm.status='active'
 JOIN stock_membership_private.memberships om ON om.id=r.owner_membership_id AND om.company_id=r.company_id AND om.revoked_at IS NULL AND om.role='admin'
 JOIN stock_membership_private.identity_pairs op ON op.id=om.pair_id AND op.revoked_at IS NULL
 JOIN auth.users owner_user ON owner_user.id=om.core_subject
   AND owner_user.deleted_at IS NULL AND owner_user.email_confirmed_at IS NOT NULL
   AND owner_user.email_confirmed_at<=clock_timestamp()
   AND (owner_user.banned_until IS NULL OR owner_user.banned_until<=clock_timestamp())
 JOIN public.company_memberships oc ON oc.id=om.id AND oc.company_id=r.company_id
   AND oc.core_auth_user_id=om.core_subject AND oc.role='owner' AND oc.status='active'
 JOIN stock_membership_private.sessions ss ON ss.pair_id=m.pair_id AND ss.stock_session=p_stock_session
   AND ss.revoked_at IS NULL AND ss.expires_at>clock_timestamp()
 JOIN stock_membership_private.selections selection ON selection.stock_session=ss.stock_session
   AND selection.membership_id=m.id AND selection.revision=p_selection_revision
   AND NOT EXISTS(SELECT 1 FROM stock_membership_private.selections newer
     WHERE newer.stock_session=ss.stock_session AND newer.revision>selection.revision)
 JOIN public.tenants t ON t.id=r.core_tenant_id AND t.platform='stock' AND t.status='active' AND t.owner_user_id=om.core_subject
 JOIN stock_billing_private.accounts ba ON ba.company_id=r.company_id AND ba.reservation_id=r.instance_id
   AND ba.tenant_id=r.core_tenant_id AND ba.owner_id=om.core_subject
 JOIN public.tenant_subscriptions sub ON sub.tenant_id=t.id AND sub.status='active' AND sub.current_period_end>clock_timestamp()
 JOIN public.subscription_plans plan ON plan.id=sub.plan_id
 WHERE r.company_id=p_company AND r.instance_id=p_instance AND r.revoked_at IS NULL
   AND m.id=p_membership AND m.profile_id=p_profile AND m.revision=p_membership_revision
   AND m.stock_subject=p_stock_subject AND m.core_subject=p_core_subject AND m.revoked_at IS NULL
   AND core_registry_private.active_stock_core_session_live(m.core_subject,ss.core_session)
   AND stock_billing_private.paid_creation_allowed(m.core_subject,m.stock_subject)
   AND stock_billing_private.paid_creation_allowed(om.core_subject,om.stock_subject)
   AND stock_billing_private.approved_plan(plan.id)
   AND plan.max_users IN (1,3)
   AND (SELECT count(*) FROM stock_membership_private.memberships seats
     WHERE seats.company_id=r.company_id AND seats.revoked_at IS NULL)<=plan.max_users
   AND EXISTS(SELECT 1 FROM stock_billing_private.deliveries d
     JOIN public.subscription_invoices inv ON inv.id=d.invoice_id AND inv.tenant_id=d.tenant_id
       AND inv.plan_id=d.plan_id AND inv.status='paid' AND inv.period='monthly' AND inv.amount=plan.price_monthly
     JOIN stock_billing_private.settings cfg ON cfg.singleton AND cfg.enabled AND cfg.payment_mode=inv.midtrans_mode
     WHERE d.tenant_id=t.id AND d.plan_id=sub.plan_id AND d.state='active' AND d.expires_at=sub.current_period_end);
 IF p_verified_until<=clock_timestamp() THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_DENIED'; END IF;
 RETURN result;
END $fn$;

-- Called only after both native identities have been verified by the trusted
-- bridge. A selector can choose an already admitted membership, never create it.
CREATE FUNCTION public.core_stock_membership_select_session(
 p_core_subject uuid,p_core_session uuid,p_stock_subject uuid,p_stock_session uuid,
 p_verified_until timestamptz,p_core_token_expires timestamptz,p_company uuid,p_instance uuid,
 p_command uuid,p_expected_revision bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE m stock_membership_private.memberships%ROWTYPE;
 s stock_membership_private.sessions%ROWTYPE;
 previous stock_membership_private.selections%ROWTYPE;
 replay stock_membership_private.selections%ROWTYPE;
 latest bigint; result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_core_subject IS NULL OR p_core_session IS NULL
   OR p_stock_subject IS NULL OR p_stock_session IS NULL OR p_command IS NULL
   OR p_verified_until IS NULL OR p_verified_until<=clock_timestamp()
   OR p_verified_until>clock_timestamp()+interval '30 seconds'
   OR p_core_token_expires IS NULL OR p_core_token_expires<=clock_timestamp()
   OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 9007199254740990
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.settings WHERE singleton AND enabled)
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_SELECTION_DENIED'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_MEMBERSHIP_BUSY_REAUTHENTICATE'; END IF;
 IF p_verified_until<=clock_timestamp()
   OR NOT core_registry_private.active_stock_core_session_live(p_core_subject,p_core_session)
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_SELECTION_DENIED'; END IF;
 SELECT member.* INTO STRICT m FROM stock_membership_private.memberships member
   JOIN stock_membership_private.resources r ON r.company_id=member.company_id AND r.revoked_at IS NULL
   JOIN stock_membership_private.identity_pairs pair ON pair.id=member.pair_id AND pair.revoked_at IS NULL
   WHERE member.company_id=p_company AND r.instance_id=p_instance AND member.core_subject=p_core_subject
     AND member.stock_subject=p_stock_subject AND member.revoked_at IS NULL;
 INSERT INTO stock_membership_private.sessions(stock_session,pair_id,core_session,expires_at)
   VALUES(p_stock_session,m.pair_id,p_core_session,least(p_core_token_expires,clock_timestamp()+interval '1 hour'))
   ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT s FROM stock_membership_private.sessions WHERE stock_session=p_stock_session FOR UPDATE NOWAIT;
 IF s.pair_id<>m.pair_id OR s.core_session<>p_core_session OR s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_SESSION_CONFLICT'; END IF;
 SELECT * INTO previous FROM stock_membership_private.selections WHERE stock_session=p_stock_session ORDER BY revision DESC LIMIT 1;
 latest:=coalesce(previous.revision,0);
 SELECT * INTO replay FROM stock_membership_private.selections WHERE stock_session=p_stock_session AND command_id=p_command;
 IF FOUND THEN
   IF replay.membership_id<>m.id OR replay.revision<>p_expected_revision+1 OR replay.revision<>latest
   THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_SELECTION_REPLAY_CONFLICT'; END IF;
 ELSE
   IF latest<>p_expected_revision THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_SELECTION_STALE'; END IF;
   latest:=latest+1;
   INSERT INTO stock_membership_private.selections(stock_session,revision,command_id,membership_id)
     VALUES(p_stock_session,latest,p_command,m.id);
 END IF;
 -- Re-read current paid, Owner and native-session authority after the lock and
 -- selection append. Any failure rolls back the session, selection and audit.
 result:=public.core_stock_membership_authorize_request(p_company,p_instance,m.profile_id,m.id,m.revision,
   p_stock_subject,p_stock_session,p_core_subject,p_verified_until,latest);
 IF p_verified_until<=clock_timestamp() OR p_core_token_expires<=clock_timestamp()
 THEN RAISE EXCEPTION 'STOCK_MEMBERSHIP_SELECTION_DENIED'; END IF;
 RETURN result;
END $fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA stock_membership_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA stock_membership_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA stock_membership_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.core_stock_membership_is_managed(uuid,uuid),
 public.core_stock_membership_authorize_request(uuid,uuid,uuid,uuid,bigint,uuid,uuid,uuid,timestamptz,bigint),
 public.core_stock_membership_select_session(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid,uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_membership_is_managed(uuid,uuid),
 public.core_stock_membership_authorize_request(uuid,uuid,uuid,uuid,bigint,uuid,uuid,uuid,timestamptz,bigint),
 public.core_stock_membership_select_session(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid,uuid,uuid,bigint) TO service_role;
COMMIT;
