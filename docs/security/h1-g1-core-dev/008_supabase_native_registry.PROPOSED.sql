-- H1.G1 Supabase-native clean-DEV proposal. NOT AUTHORIZED FOR EXECUTION.
-- Replaces the W1 installation dependency; never run SQL001/002/004/005/006/007 first.
-- No Auth table access, custom roles, LOGINs, production data or payment writes.
-- Exact reviewed artifact is transaction-rollback-only. Runtime remains disabled.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
     OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
     OR current_setting('server_encoding') <> 'UTF8'
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolbypassrls)
     OR NOT pg_catalog.has_schema_privilege(current_user, 'public', 'CREATE')
     OR NOT pg_catalog.has_schema_privilege('authenticated', 'public', 'USAGE')
     OR NOT pg_catalog.has_schema_privilege('service_role', 'public', 'USAGE')
     OR NOT pg_catalog.has_function_privilege('authenticated', 'auth.uid()', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(current_user, 'auth.role()', 'EXECUTE') THEN
    RAISE EXCEPTION 'STOP: require PostgreSQL 17 UTF8 and existing postgres owner/BYPASSRLS plus standard Supabase roles/functions';
  END IF;
  IF pg_catalog.to_regnamespace('core_registry_private') IS NOT NULL
     OR pg_catalog.to_regclass('public.companies') IS NOT NULL
     OR pg_catalog.to_regclass('public.company_memberships') IS NOT NULL
     OR pg_catalog.to_regclass('public.company_portal_instances') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname IN
                  ('core_registry_authorize', 'core_registry_mutate', 'core_registry_owner_claim_context')) THEN
    RAISE EXCEPTION 'STOP: clean DEV only; existing objects require a separately reviewed forward reconciliation';
  END IF;
END
$preflight$;

CREATE SCHEMA core_registry_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA core_registry_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  display_name text NOT NULL CHECK (display_name = btrim(display_name) AND length(display_name) BETWEEN 2 AND 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired')),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
  audit_head text NOT NULL DEFAULT repeat('0', 64) CHECK (audit_head ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  retired_at timestamptz,
  CHECK ((status = 'retired') = (retired_at IS NOT NULL))
);
CREATE TABLE public.company_memberships (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  -- External Supabase Auth identifier, deliberately no FK/privilege on managed Auth.
  core_auth_user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
  UNIQUE (id, company_id, core_auth_user_id)
);
CREATE UNIQUE INDEX company_memberships_one_active_user ON public.company_memberships(core_auth_user_id) WHERE status = 'active';
CREATE INDEX company_memberships_company ON public.company_memberships(company_id);
CREATE TABLE public.company_portal_instances (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  portal_type text NOT NULL CHECK (portal_type IN ('stock', 'lms', 'clinic', 'laundry', 'rental', 'pharmacy')),
  lifecycle_status text NOT NULL DEFAULT 'reserved' CHECK (lifecycle_status = 'reserved'),
  legacy_tenant_id uuid CHECK (legacy_tenant_id IS NULL),
  portal_instance_id uuid CHECK (portal_instance_id IS NULL),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (company_id, portal_type)
);

CREATE TABLE core_registry_private.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  runtime_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO core_registry_private.settings(singleton, runtime_enabled) VALUES (true, false);
CREATE TABLE core_registry_private.operators (
  subject_id uuid PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  valid_until timestamptz NOT NULL
);
CREATE TABLE core_registry_private.provenance (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  subject_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  classification text NOT NULL CHECK (classification IN ('clean', 'legacy', 'disputed', 'takeover', 'conflict', 'unknown')),
  revision uuid NOT NULL,
  command_id uuid NOT NULL,
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  coverage jsonb NOT NULL CHECK (jsonb_typeof(coverage) = 'object'),
  evidence_ref text NOT NULL CHECK (length(evidence_ref) BETWEEN 1 AND 200),
  writer_fence_ref text NOT NULL CHECK (length(writer_fence_ref) BETWEEN 1 AND 200),
  verified_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL CHECK (valid_until > verified_at AND valid_until <= verified_at + interval '30 seconds'),
  consumed_at timestamptz,
  UNIQUE (subject_id, command_id)
);
CREATE INDEX provenance_company ON core_registry_private.provenance(company_id);
CREATE TABLE core_registry_private.owner_claims (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL,
  previous_owner_id uuid NOT NULL,
  proposer_id uuid NOT NULL,
  proposer_session_id uuid NOT NULL,
  proposer_auth_until timestamptz NOT NULL,
  proposal_command_id uuid NOT NULL,
  proposal_digest text NOT NULL CHECK (proposal_digest ~ '^[a-f0-9]{64}$'),
  company_revision bigint NOT NULL,
  proof_id uuid NOT NULL REFERENCES core_registry_private.provenance(id) ON DELETE RESTRICT,
  proof_revision uuid NOT NULL,
  case_kind text NOT NULL CHECK (case_kind IN ('legacy', 'disputed', 'takeover', 'conflict')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied')),
  approver_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  applied_at timestamptz,
  CHECK (target_user_id <> proposer_id),
  CHECK ((status = 'applied') = (approver_id IS NOT NULL AND applied_at IS NOT NULL)),
  CHECK (approver_id IS NULL OR (approver_id <> proposer_id AND approver_id <> target_user_id))
);
CREATE INDEX owner_claims_company ON core_registry_private.owner_claims(company_id);
CREATE INDEX owner_claims_proof ON core_registry_private.owner_claims(proof_id);
CREATE TABLE core_registry_private.events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  command_id uuid NOT NULL,
  action text NOT NULL,
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL,
  canonical_payload text NOT NULL,
  previous_hash text NOT NULL CHECK (previous_hash ~ '^[a-f0-9]{64}$'),
  event_hash text NOT NULL CHECK (event_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (actor_id, command_id)
);
CREATE INDEX events_company ON core_registry_private.events(company_id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_portal_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_portal_instances FORCE ROW LEVEL SECURITY;
ALTER TABLE core_registry_private.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_registry_private.settings FORCE ROW LEVEL SECURITY;
ALTER TABLE core_registry_private.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_registry_private.operators FORCE ROW LEVEL SECURITY;
ALTER TABLE core_registry_private.provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_registry_private.provenance FORCE ROW LEVEL SECURITY;
ALTER TABLE core_registry_private.owner_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_registry_private.owner_claims FORCE ROW LEVEL SECURITY;
ALTER TABLE core_registry_private.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_registry_private.events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.companies, public.company_memberships, public.company_portal_instances
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA core_registry_private FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.companies, public.company_memberships, public.company_portal_instances TO authenticated;
-- Membership policy terminates here: no mutual membership/Company recursion.
CREATE POLICY own_active_membership ON public.company_memberships FOR SELECT TO authenticated
  USING (core_auth_user_id = (SELECT auth.uid()) AND status = 'active');
CREATE POLICY own_active_company ON public.companies FOR SELECT TO authenticated
  USING (status = 'active' AND EXISTS (SELECT 1 FROM public.company_memberships m
    WHERE m.company_id = companies.id AND m.core_auth_user_id = (SELECT auth.uid()) AND m.status = 'active'));
CREATE POLICY own_company_portal ON public.company_portal_instances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_portal_instances.company_id AND c.status = 'active'));

CREATE FUNCTION core_registry_private.reject_audit_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN RAISE EXCEPTION 'APPEND_ONLY_AUDIT'; END
$fn$;
CREATE TRIGGER events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core_registry_private.events
  FOR EACH STATEMENT EXECUTE FUNCTION core_registry_private.reject_audit_change();

CREATE FUNCTION core_registry_private.proof_valid(p core_registry_private.provenance, clean boolean) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path = '' AS $fn$
DECLARE item jsonb; source_key text;
BEGIN
  IF p.id IS NULL OR p.consumed_at IS NOT NULL OR p.verified_at > clock_timestamp()
     OR p.valid_until <= clock_timestamp() OR p.classification = 'unknown'
     OR (clean AND p.classification <> 'clean')
     OR (SELECT count(*) FROM jsonb_object_keys(p.coverage)) <> 15 THEN RETURN false; END IF;
  FOR i IN 1..15 LOOP
    source_key := 'W' || lpad(i::text, 2, '0');
    item := p.coverage -> source_key;
    IF item IS NULL OR item->'complete' IS DISTINCT FROM 'true'::jsonb
       OR item->'participatingWriter' IS DISTINCT FROM 'true'::jsonb
       OR jsonb_typeof(item->'revision') IS DISTINCT FROM 'string' OR length(item->>'revision') = 0
       OR (clean AND item->>'state' IS DISTINCT FROM 'clean') THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END
$fn$;

CREATE FUNCTION core_registry_private.append_event(p_company uuid, p_actor uuid, p_session uuid,
  p_command uuid, p_action text, p_digest text, p_before jsonb, p_after jsonb,
  p_evidence text, p_reviewers uuid[], p_claim uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE prior text; encoded text; head text; event_id uuid := pg_catalog.gen_random_uuid(); result jsonb; rev bigint;
BEGIN
  SELECT audit_head, revision INTO STRICT prior, rev FROM public.companies WHERE id = p_company FOR UPDATE;
  encoded := jsonb_build_object('eventId', event_id, 'companyId', p_company, 'actorId', p_actor,
    'sessionId', p_session, 'commandId', p_command, 'action', p_action, 'requestDigest', p_digest,
    'before', p_before, 'after', p_after, 'evidenceRef', p_evidence, 'reviewers', to_jsonb(p_reviewers),
    'reason', coalesce(p_after->>'caseKind', p_action), 'outcome', 'succeeded',
    'occurredAt', clock_timestamp())::text;
  head := encode(sha256(convert_to(prior || ':' || encoded, 'UTF8')), 'hex');
  result := jsonb_build_object('companyId', p_company, 'eventId', event_id, 'eventHash', head, 'revision', rev);
  IF p_claim IS NOT NULL THEN result := result || jsonb_build_object('claimId', p_claim); END IF;
  INSERT INTO core_registry_private.events(id, company_id, actor_id, command_id, action, request_digest,
    result, canonical_payload, previous_hash, event_hash)
    VALUES (event_id, p_company, p_actor, p_command, p_action, p_digest, result, encoded, prior, head);
  UPDATE public.companies SET audit_head = head WHERE id = p_company;
  RETURN result;
END
$fn$;

CREATE FUNCTION public.core_registry_authorize(p_company uuid, p_owner_only boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT jsonb_build_object('companyId', c.id, 'membershipId', m.id, 'role', m.role, 'revision', c.revision)
  FROM public.companies c JOIN public.company_memberships m ON m.company_id = c.id
  WHERE c.id = p_company AND c.status = 'active' AND m.core_auth_user_id = (SELECT auth.uid())
    AND m.status = 'active' AND (p_owner_only IS FALSE OR (p_owner_only IS TRUE AND m.role = 'owner'))
$fn$;

CREATE FUNCTION public.core_registry_owner_claim_context(p_actor uuid, p_claim uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on AS $fn$
DECLARE result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     OR NOT EXISTS (SELECT 1 FROM core_registry_private.settings WHERE singleton AND runtime_enabled)
     OR NOT EXISTS (SELECT 1 FROM core_registry_private.operators
       WHERE subject_id = p_actor AND active AND valid_until > clock_timestamp()) THEN RAISE EXCEPTION 'DENIED'; END IF;
  SELECT jsonb_build_object('targetUserId', target_user_id, 'proposerId', proposer_id) INTO STRICT result
    FROM core_registry_private.owner_claims WHERE id = p_claim AND proposer_id <> p_actor AND target_user_id <> p_actor;
  RETURN result;
END
$fn$;

CREATE FUNCTION public.core_registry_mutate(p_actor uuid, p_session uuid, p_auth_until timestamptz,
  p_command uuid, p_action text, p_payload jsonb, p_verified_subjects uuid[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on
SET lock_timeout = '3s' SET statement_timeout = '10s' AS $fn$
DECLARE company uuid; portal uuid; member public.company_memberships%ROWTYPE; prior jsonb; after_state jsonb;
  proof core_registry_private.provenance%ROWTYPE; claim core_registry_private.owner_claims%ROWTYPE;
  replay core_registry_private.events%ROWTYPE; digest text; rev bigint; claim_id uuid; reviewers uuid[] := '{}';
  expected_keys text[]; actual_keys text[]; target uuid; old_owner uuid; evidence text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_session IS NULL OR p_command IS NULL
     OR p_auth_until IS NULL OR p_auth_until <= clock_timestamp() OR p_auth_until > clock_timestamp() + interval '30 seconds'
     OR NOT EXISTS (SELECT 1 FROM core_registry_private.settings WHERE singleton AND runtime_enabled)
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'DENIED'; END IF;
  -- All authorized writers/custodians must participate in this same transaction fence.
  -- Global lock deliberately favors correctness over throughput in this bounded DEV path.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0));
  IF p_auth_until <= clock_timestamp() THEN RAISE EXCEPTION 'AUTH_EXPIRED_AFTER_WAIT'; END IF;
  expected_keys := CASE p_action
    WHEN 'company.bootstrap' THEN ARRAY['companyName', 'portalType']
    WHEN 'company.rename' THEN ARRAY['companyId', 'companyName', 'expectedRevision']
    WHEN 'membership.revoke' THEN ARRAY['companyId', 'expectedRevision', 'membershipId']
    WHEN 'owner.propose' THEN ARRAY['caseKind', 'companyId', 'expectedRevision', 'previousOwnerId', 'targetUserId']
    WHEN 'owner.approve' THEN ARRAY['claimId'] ELSE NULL END;
  SELECT array_agg(k ORDER BY k) INTO actual_keys FROM jsonb_object_keys(p_payload) AS k;
  IF expected_keys IS NULL OR actual_keys IS DISTINCT FROM expected_keys THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
  IF p_action IN ('company.bootstrap', 'company.rename') AND
     (jsonb_typeof(p_payload->'companyName') IS DISTINCT FROM 'string'
      OR length(p_payload->>'companyName') NOT BETWEEN 2 AND 100
      OR p_payload->>'companyName' <> btrim(p_payload->>'companyName')) THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF p_action = 'company.bootstrap' AND p_payload->>'portalType' NOT IN
     ('stock', 'lms', 'clinic', 'laundry', 'rental', 'pharmacy') THEN RAISE EXCEPTION 'INVALID_PRODUCT'; END IF;
  digest := encode(sha256(convert_to(p_action || ':' || p_payload::text, 'UTF8')), 'hex');
  IF p_action IN ('owner.propose', 'owner.approve') THEN
    IF NOT EXISTS (SELECT 1 FROM core_registry_private.operators WHERE subject_id = p_actor AND active
      AND valid_until > clock_timestamp()) THEN RAISE EXCEPTION 'OPERATOR_REQUIRED'; END IF;
  END IF;
  SELECT * INTO replay FROM core_registry_private.events WHERE actor_id = p_actor AND command_id = p_command;
  IF FOUND THEN
    IF replay.action <> p_action OR replay.request_digest <> digest THEN RAISE EXCEPTION 'REPLAY_CONFLICT'; END IF;
    IF p_action NOT IN ('owner.propose', 'owner.approve') AND NOT EXISTS (
      SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id = m.company_id
      WHERE c.id = replay.company_id AND c.status = 'active' AND m.core_auth_user_id = p_actor
      AND m.status = 'active' AND m.role = 'owner') THEN RAISE EXCEPTION 'CURRENT_OWNER_REQUIRED'; END IF;
    RETURN replay.result;
  END IF;
  IF p_action = 'company.bootstrap' THEN
    IF EXISTS (SELECT 1 FROM public.company_memberships WHERE core_auth_user_id = p_actor) THEN
      RAISE EXCEPTION 'COMPANY_OR_HISTORY_ALREADY_EXISTS'; END IF;
    SELECT * INTO proof FROM core_registry_private.provenance WHERE subject_id = p_actor AND command_id = p_command FOR UPDATE;
    IF NOT core_registry_private.proof_valid(proof, true) OR proof.company_id IS NOT NULL
       OR proof.request_digest IS DISTINCT FROM digest THEN RAISE EXCEPTION 'COMPLETE_CLEAN_PROVENANCE_REQUIRED'; END IF;
    INSERT INTO public.companies(display_name) VALUES (p_payload->>'companyName') RETURNING id INTO company;
    INSERT INTO public.company_memberships(company_id, core_auth_user_id, role) VALUES (company, p_actor, 'owner') RETURNING * INTO member;
    INSERT INTO public.company_portal_instances(company_id, portal_type) VALUES (company, p_payload->>'portalType') RETURNING id INTO portal;
    UPDATE core_registry_private.provenance SET consumed_at = clock_timestamp() WHERE id = proof.id;
    evidence := proof.evidence_ref;
    prior := 'null'::jsonb;
    after_state := jsonb_build_object('companyName', p_payload->>'companyName', 'ownerId', p_actor,
      'membershipId', member.id, 'portalInstanceId', portal,
      'portalType', p_payload->>'portalType', 'proofId', proof.id, 'proofRevision', proof.revision);
  ELSIF p_action = 'owner.approve' THEN
    SELECT * INTO STRICT claim FROM core_registry_private.owner_claims WHERE id = (p_payload->>'claimId')::uuid FOR UPDATE;
    company := claim.company_id; claim_id := claim.id;
    SELECT revision INTO STRICT rev FROM public.companies WHERE id = company AND status = 'active' FOR UPDATE;
    SELECT * INTO STRICT proof FROM core_registry_private.provenance WHERE id = claim.proof_id FOR UPDATE;
    IF claim.status <> 'pending' OR claim.proposer_id IN (p_actor, claim.target_user_id) OR p_actor = claim.target_user_id
       OR claim.proposer_auth_until <= clock_timestamp() OR claim.company_revision <> rev
       OR NOT EXISTS (SELECT 1 FROM core_registry_private.operators WHERE subject_id = claim.proposer_id
         AND active AND valid_until > clock_timestamp())
       OR NOT core_registry_private.proof_valid(proof, false) OR proof.revision <> claim.proof_revision
       OR proof.command_id <> claim.proposal_command_id OR proof.request_digest <> claim.proposal_digest
       OR proof.classification <> claim.case_kind OR proof.company_id IS DISTINCT FROM company
       OR proof.subject_id <> claim.target_user_id
       OR p_verified_subjects IS DISTINCT FROM ARRAY[claim.target_user_id, claim.proposer_id]
       OR EXISTS (SELECT 1 FROM public.company_memberships WHERE core_auth_user_id = claim.target_user_id
         AND status = 'active' AND company_id <> company) THEN RAISE EXCEPTION 'INDEPENDENT_CURRENT_APPROVAL_REQUIRED'; END IF;
    SELECT * INTO STRICT member FROM public.company_memberships WHERE company_id = company
      AND core_auth_user_id = claim.previous_owner_id AND role = 'owner' AND status = 'active' FOR UPDATE;
    prior := jsonb_build_object('previousOwnerId', member.core_auth_user_id, 'revision', rev);
    UPDATE public.company_memberships SET role = 'owner' WHERE company_id = company
      AND core_auth_user_id = claim.target_user_id AND status = 'active';
    IF NOT FOUND THEN
      INSERT INTO public.company_memberships(company_id, core_auth_user_id, role) VALUES (company, claim.target_user_id, 'owner');
    END IF;
    UPDATE public.company_memberships SET status = 'revoked', revoked_at = clock_timestamp() WHERE id = member.id;
    UPDATE public.companies SET revision = revision + 1 WHERE id = company;
    UPDATE core_registry_private.owner_claims SET status = 'applied', approver_id = p_actor, applied_at = clock_timestamp() WHERE id = claim.id;
    UPDATE core_registry_private.provenance SET consumed_at = clock_timestamp() WHERE id = proof.id;
    reviewers := ARRAY[claim.proposer_id, p_actor]; evidence := proof.evidence_ref;
    after_state := jsonb_build_object('ownerId', claim.target_user_id,
      'ownerMembershipId', (SELECT id FROM public.company_memberships WHERE company_id = company
        AND core_auth_user_id = claim.target_user_id AND status = 'active'), 'revokedMembershipId', member.id,
      'revision', rev + 1, 'caseKind', claim.case_kind, 'proofId', proof.id, 'proofRevision', proof.revision);
  ELSE
    company := (p_payload->>'companyId')::uuid;
    SELECT revision INTO STRICT rev FROM public.companies WHERE id = company AND status = 'active' FOR UPDATE;
    IF (p_payload->>'expectedRevision')::bigint IS DISTINCT FROM rev THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
    IF p_action = 'owner.propose' THEN
      target := (p_payload->>'targetUserId')::uuid; old_owner := (p_payload->>'previousOwnerId')::uuid;
      IF target IS NULL OR old_owner IS NULL OR target IN (p_actor, old_owner)
         OR p_payload->>'caseKind' NOT IN ('legacy', 'disputed', 'takeover', 'conflict')
         OR NOT EXISTS (SELECT 1 FROM public.company_memberships WHERE company_id = company
           AND core_auth_user_id = old_owner AND role = 'owner' AND status = 'active')
         OR EXISTS (SELECT 1 FROM public.company_memberships WHERE core_auth_user_id = target
           AND status = 'active' AND company_id <> company) THEN RAISE EXCEPTION 'INVALID_OWNER_CLAIM'; END IF;
      SELECT * INTO proof FROM core_registry_private.provenance WHERE subject_id = target AND command_id = p_command FOR UPDATE;
      IF NOT core_registry_private.proof_valid(proof, false) OR proof.company_id IS DISTINCT FROM company
         OR proof.request_digest IS DISTINCT FROM digest OR proof.classification IS DISTINCT FROM p_payload->>'caseKind'
         THEN RAISE EXCEPTION 'COMPLETE_CASE_PROVENANCE_REQUIRED'; END IF;
      INSERT INTO core_registry_private.owner_claims(company_id, target_user_id, previous_owner_id, proposer_id,
        proposer_session_id, proposer_auth_until, proposal_command_id, proposal_digest,
        company_revision, proof_id, proof_revision, case_kind)
        VALUES (company, target, old_owner, p_actor, p_session, p_auth_until, p_command, digest,
          rev, proof.id, proof.revision, p_payload->>'caseKind')
        RETURNING id INTO claim_id;
      prior := jsonb_build_object('ownerId', old_owner, 'revision', rev);
      after_state := jsonb_build_object('claimId', claim_id, 'targetUserId', target, 'caseKind', p_payload->>'caseKind', 'status', 'pending');
      reviewers := ARRAY[p_actor]; evidence := proof.evidence_ref;
    ELSE
      SELECT * INTO STRICT member FROM public.company_memberships WHERE company_id = company AND core_auth_user_id = p_actor
        AND role = 'owner' AND status = 'active' FOR UPDATE;
      IF p_action = 'company.rename' THEN
        SELECT jsonb_build_object('companyName', display_name, 'revision', revision) INTO prior FROM public.companies WHERE id = company;
        UPDATE public.companies SET display_name = p_payload->>'companyName', revision = revision + 1 WHERE id = company;
        after_state := jsonb_build_object('companyName', p_payload->>'companyName', 'revision', rev + 1);
      ELSE
        SELECT * INTO STRICT member FROM public.company_memberships WHERE id = (p_payload->>'membershipId')::uuid
          AND company_id = company AND status = 'active' FOR UPDATE;
        IF member.role = 'owner' AND (SELECT count(*) FROM public.company_memberships WHERE company_id = company
          AND role = 'owner' AND status = 'active') <= 1 THEN RAISE EXCEPTION 'LAST_OWNER'; END IF;
        prior := to_jsonb(member);
        UPDATE public.company_memberships SET status = 'revoked', revoked_at = clock_timestamp() WHERE id = member.id;
        UPDATE public.companies SET revision = revision + 1 WHERE id = company;
        after_state := jsonb_build_object('membershipId', member.id, 'status', 'revoked', 'revision', rev + 1);
      END IF;
    END IF;
  END IF;
  IF p_auth_until <= clock_timestamp() OR (p_action IN ('company.bootstrap', 'owner.propose', 'owner.approve')
     AND proof.valid_until <= clock_timestamp()) OR (p_action = 'owner.approve' AND claim.proposer_auth_until <= clock_timestamp()) THEN
    RAISE EXCEPTION 'AUTH_OR_PROOF_EXPIRED_BEFORE_AUDIT'; END IF;
  -- No exception handler: audit/constraint failure aborts every preceding write.
  RETURN core_registry_private.append_event(company, p_actor, p_session, p_command, p_action, digest,
    prior, after_state, evidence, reviewers, claim_id);
END
$fn$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA core_registry_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.core_registry_authorize(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.core_registry_owner_claim_context(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.core_registry_mutate(uuid, uuid, timestamptz, uuid, text, jsonb, uuid[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_registry_authorize(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.core_registry_owner_claim_context(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.core_registry_mutate(uuid, uuid, timestamptz, uuid, text, jsonb, uuid[]) TO service_role;

DO $effective_acl$
DECLARE object_name text; subject_name text; privilege_name text; routine regprocedure;
BEGIN
  -- Check effective inherited/default ACLs, not just the explicit GRANT text.
  FOREACH subject_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF subject_name <> 'service_role' AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = subject_name AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'STOP: client role bypasses RLS'; END IF;
    IF pg_catalog.pg_has_role(subject_name, 'postgres', 'USAGE') OR
       pg_catalog.has_schema_privilege(subject_name, 'core_registry_private', 'USAGE') OR
       pg_catalog.has_schema_privilege(subject_name, 'core_registry_private', 'CREATE') THEN
      RAISE EXCEPTION 'STOP: unexpected inherited owner/private schema authority'; END IF;
    FOREACH object_name IN ARRAY ARRAY['public.companies', 'public.company_memberships', 'public.company_portal_instances',
      'core_registry_private.settings', 'core_registry_private.operators', 'core_registry_private.provenance',
      'core_registry_private.owner_claims', 'core_registry_private.events'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF pg_catalog.has_table_privilege(subject_name, object_name, privilege_name) THEN
          RAISE EXCEPTION 'STOP: unexpected effective table write/reference/trigger privilege'; END IF;
      END LOOP;
      IF pg_catalog.has_table_privilege(subject_name, object_name, 'SELECT') IS DISTINCT FROM
        (subject_name = 'authenticated' AND object_name IN ('public.companies', 'public.company_memberships', 'public.company_portal_instances'))
        THEN RAISE EXCEPTION 'STOP: effective table read privilege drift'; END IF;
    END LOOP;
    FOR routine IN SELECT p.oid::regprocedure FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'core_registry_private' OR (n.nspname = 'public' AND p.proname IN
        ('core_registry_authorize', 'core_registry_owner_claim_context', 'core_registry_mutate')) LOOP
      IF pg_catalog.has_function_privilege(subject_name, routine, 'EXECUTE') IS DISTINCT FROM
        ((subject_name = 'authenticated' AND routine = 'public.core_registry_authorize(uuid,boolean)'::regprocedure)
         OR (subject_name = 'service_role' AND routine IN ('public.core_registry_owner_claim_context(uuid,uuid)'::regprocedure,
           'public.core_registry_mutate(uuid,uuid,timestamp with time zone,uuid,text,jsonb,uuid[])'::regprocedure))) THEN
        RAISE EXCEPTION 'STOP: effective function EXECUTE drift'; END IF;
    END LOOP;
  END LOOP;
END
$effective_acl$;

-- Never change this artifact into an installer without separate runtime approval.
ROLLBACK;
