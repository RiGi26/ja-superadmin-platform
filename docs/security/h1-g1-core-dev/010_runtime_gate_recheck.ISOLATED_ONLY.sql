-- H1.G1 isolated security candidate. Never apply to installed DEV or Production.
-- Forward replacement derived from immutable SQL008; only the post-fence runtime gate is added.
BEGIN;
DO $isolated$
BEGIN
  IF current_database() <> 'h1g1_synthetic' OR current_setting('h1g1.disposable_runtime', true) IS DISTINCT FROM 'only' THEN
    RAISE EXCEPTION 'ISOLATED_RUNTIME_ONLY';
  END IF;
END
$isolated$;
CREATE OR REPLACE FUNCTION public.core_registry_mutate(p_actor uuid, p_session uuid, p_auth_until timestamptz,
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
  IF NOT EXISTS (SELECT 1 FROM core_registry_private.settings WHERE singleton AND runtime_enabled) THEN
    RAISE EXCEPTION 'RUNTIME_DISABLED_AFTER_WAIT';
  END IF;
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
COMMIT;
