-- LOCAL REVIEW PROPOSAL ONLY. NOT A MIGRATION. DO NOT EXECUTE.
-- Additive successor, never a rewrite/reinstall of SQL008 or installed DEV.
-- Assumes SQL008-shaped native objects; installed permanent bytes differ.
-- Exact as-built function/ACL/schema comparison and managed source/session fence
-- are mandatory before independently authorized adaptation/application.
BEGIN;
DO $refuse$ BEGIN
  RAISE EXCEPTION 'LOCAL_PROPOSAL_ONLY: installed schema and trusted issuer require independent verification';
END $refuse$;

-- Illustrative exact forward objects. No existing users, financial records,
-- historical migrations, tables, constraints or runtime settings are changed.
CREATE SCHEMA core_e1_stock_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA core_e1_stock_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE core_e1_stock_private.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO core_e1_stock_private.settings VALUES (true, false);
CREATE TABLE core_e1_stock_private.reservations (
  reservation_id uuid PRIMARY KEY REFERENCES public.company_portal_instances(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  core_subject uuid NOT NULL,
  -- A future billing-tenant identity reservation, NOT a row in tenants or an invoice.
  core_tenant_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  product text NOT NULL DEFAULT 'stock' CHECK (product = 'stock'),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'provisioned', 'revoked')),
  stock_tenant_id uuid UNIQUE,
  stock_subject uuid UNIQUE,
  profile_id uuid UNIQUE,
  UNIQUE (company_id, product),
  UNIQUE (core_subject),
  CHECK ((status = 'reserved' AND stock_tenant_id IS NULL AND stock_subject IS NULL AND profile_id IS NULL)
    OR (status = 'provisioned' AND stock_tenant_id IS NOT NULL AND stock_subject IS NOT NULL AND profile_id IS NOT NULL)
    OR (status = 'revoked' AND ((stock_tenant_id IS NULL AND stock_subject IS NULL AND profile_id IS NULL)
      OR (stock_tenant_id IS NOT NULL AND stock_subject IS NOT NULL AND profile_id IS NOT NULL))))
);
CREATE INDEX e1_stock_reservations_company ON core_e1_stock_private.reservations(company_id);

-- A private issuer must independently verify managed current sessions, full
-- W01-W15 history and all participating writers. There is intentionally NO
-- service_role INSERT/UPDATE grant and no public "trust these booleans" issuer.
-- Binding attestations must come from current Stock Auth + PR7 canonical resolver,
-- exact reciprocal mapping/entitlement, and a source fence covering this COMMIT.
CREATE TABLE core_e1_stock_private.attestations (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  session_id uuid NOT NULL,
  command_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('e1.stock.admit', 'e1.stock.bind', 'e1.stock.checkout')),
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  evidence_ref uuid NOT NULL,
  fence_ref uuid NOT NULL,
  source_revision text NOT NULL CHECK (length(source_revision) BETWEEN 1 AND 200),
  stock_tenant_id uuid,
  stock_subject uuid,
  profile_id uuid,
  verified_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL CHECK (valid_until > verified_at AND valid_until <= verified_at + interval '30 seconds'),
  consumed_at timestamptz,
  UNIQUE(actor_id, command_id),
  CHECK (action <> 'e1.stock.bind' OR (stock_tenant_id IS NOT NULL AND stock_subject IS NOT NULL AND profile_id IS NOT NULL))
);
ALTER TABLE core_e1_stock_private.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_e1_stock_private.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_e1_stock_private.attestations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA core_e1_stock_private FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION core_e1_stock_private.reservation_json(r core_e1_stock_private.reservations) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
 SELECT jsonb_build_object('companyId', r.company_id, 'reservationId', r.reservation_id,
   'coreTenantId', r.core_tenant_id, 'coreSubject', r.core_subject, 'product', r.product,
   'status', r.status, 'stockTenantId', r.stock_tenant_id, 'stockSubject', r.stock_subject, 'profileId', r.profile_id)
$fn$;

CREATE FUNCTION public.core_registry_e1_stock_command(p_actor uuid, p_session uuid,
 p_auth_until timestamptz, p_command uuid, p_action text, p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on
SET lock_timeout = '3s' SET statement_timeout = '10s' AS $fn$
DECLARE a core_e1_stock_private.attestations%ROWTYPE;
 r core_e1_stock_private.reservations%ROWTYPE;
 e core_registry_private.events%ROWTYPE;
 native_result jsonb; result jsonb; fingerprint text; native_digest text; prior jsonb;
 company uuid; portal uuid; keys text[]; expected text[];
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_session IS NULL OR p_command IS NULL
  OR p_auth_until IS NULL OR p_auth_until <= clock_timestamp() OR p_auth_until > clock_timestamp() + interval '30 seconds'
  OR NOT EXISTS (SELECT 1 FROM core_e1_stock_private.settings WHERE singleton AND enabled)
  OR NOT EXISTS (SELECT 1 FROM core_registry_private.settings WHERE singleton AND runtime_enabled)
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'DENIED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('core_registry_writes', 0));
 IF p_auth_until <= clock_timestamp() THEN RAISE EXCEPTION 'EXPIRED_AFTER_WAIT'; END IF;
 expected := CASE p_action WHEN 'e1.stock.admit' THEN ARRAY['companyName','product']
   WHEN 'e1.stock.bind' THEN ARRAY['companyId','product','reservationId']
   WHEN 'e1.stock.checkout' THEN ARRAY['companyId','product','reservationId'] ELSE NULL END;
 SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(p_payload) k;
 IF expected IS NULL OR keys IS DISTINCT FROM expected OR p_payload->>'product' IS DISTINCT FROM 'stock'
  THEN RAISE EXCEPTION 'INVALID_E1_COMMAND'; END IF;
 fingerprint := encode(sha256(convert_to(p_action || ':' || p_payload::text, 'UTF8')), 'hex');
 -- Every attempt, including a replay, needs a fresh privately issued current
 -- actor/fence attestation. A previous event or unexpired JWT is not enough.
 SELECT * INTO STRICT a FROM core_e1_stock_private.attestations
  WHERE actor_id = p_actor AND session_id = p_session AND command_id = p_command FOR UPDATE;
 IF a.action <> p_action OR a.request_digest <> fingerprint OR a.verified_at > clock_timestamp()
  OR a.valid_until <= clock_timestamp() THEN RAISE EXCEPTION 'CURRENT_TRUSTED_ATTESTATION_REQUIRED'; END IF;
 SELECT * INTO e FROM core_registry_private.events WHERE actor_id = p_actor AND command_id = p_command;
 IF FOUND THEN
  IF e.action <> p_action OR e.request_digest <> fingerprint THEN RAISE EXCEPTION 'REPLAY_CONFLICT'; END IF;
  SELECT * INTO STRICT r FROM core_e1_stock_private.reservations WHERE company_id = e.company_id FOR UPDATE;
 ELSE
  IF a.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'ATTESTATION_CONSUMED'; END IF;
  IF p_action = 'e1.stock.admit' THEN
   IF EXISTS (SELECT 1 FROM public.company_memberships WHERE core_auth_user_id = p_actor)
    OR EXISTS (SELECT 1 FROM core_e1_stock_private.reservations WHERE core_subject = p_actor)
    THEN RAISE EXCEPTION 'E2_E3_REQUIRES_NATIVE_INDEPENDENT_DUAL_REVIEW'; END IF;
   -- Reuse native proof_valid, clean W01-W15 provenance, unique membership and
   -- atomic Company/Owner/portal creation. No local Stock profile prerequisite.
   -- The issuer must bind a second native bootstrap command, since the native
   -- event and this integration event cannot share their actor/command key.
   native_digest := encode(sha256(convert_to('company.bootstrap:' ||
     jsonb_build_object('companyName', p_payload->>'companyName', 'portalType','stock')::text, 'UTF8')), 'hex');
   SELECT command_id INTO STRICT portal FROM core_registry_private.provenance
    WHERE subject_id = p_actor AND request_digest = native_digest AND classification = 'clean'
      AND evidence_ref = a.evidence_ref::text AND writer_fence_ref = a.fence_ref::text
      AND consumed_at IS NULL AND valid_until > clock_timestamp() FOR UPDATE;
   IF portal = p_command THEN RAISE EXCEPTION 'DISTINCT_NATIVE_COMMAND_REQUIRED'; END IF;
   native_result := public.core_registry_mutate(p_actor,p_session,p_auth_until,portal,'company.bootstrap',
     jsonb_build_object('companyName',p_payload->>'companyName','portalType','stock'),'{}');
   company := (native_result->>'companyId')::uuid;
   SELECT id INTO STRICT portal FROM public.company_portal_instances
    WHERE company_id = company AND portal_type = 'stock' AND lifecycle_status = 'reserved'
      AND legacy_tenant_id IS NULL AND portal_instance_id IS NULL;
   INSERT INTO core_e1_stock_private.reservations(reservation_id,company_id,core_subject)
    VALUES(portal,company,p_actor) RETURNING * INTO r;
  ELSE
   SELECT * INTO STRICT r FROM core_e1_stock_private.reservations
    WHERE reservation_id = (p_payload->>'reservationId')::uuid AND company_id = (p_payload->>'companyId')::uuid FOR UPDATE;
  END IF;
 END IF;
 -- Exactly one current Owner across all active Company memberships. Do not
 -- promote local Stock admin, match email, or adopt legacy tenant references.
 IF r.core_subject <> p_actor OR r.status = 'revoked' OR
  (SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id = p_actor AND status = 'active') <> 1 OR
  NOT EXISTS (SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id = m.company_id
   WHERE m.company_id = r.company_id AND m.core_auth_user_id = p_actor AND m.status = 'active'
     AND m.role = 'owner' AND c.status = 'active') OR
  (SELECT count(*) FROM public.company_portal_instances WHERE company_id = r.company_id AND portal_type = 'stock') <> 1 OR
  NOT EXISTS (SELECT 1 FROM public.company_portal_instances WHERE id = r.reservation_id
    AND company_id = r.company_id AND portal_type = 'stock')
  THEN RAISE EXCEPTION 'CURRENT_EXACT_OWNER_REQUIRED'; END IF;
 IF p_action <> 'e1.stock.admit' AND (r.company_id <> (p_payload->>'companyId')::uuid
  OR r.reservation_id <> (p_payload->>'reservationId')::uuid) THEN RAISE EXCEPTION 'WRONG_RESERVATION'; END IF;
 IF p_action = 'e1.stock.checkout' AND r.status <> 'reserved' THEN RAISE EXCEPTION 'FIRST_CHECKOUT_ONLY'; END IF;
 IF p_action = 'e1.stock.checkout' AND EXISTS(SELECT 1 FROM core_registry_private.events
  WHERE company_id=r.company_id AND action='e1.stock.checkout' AND command_id<>p_command)
  THEN RAISE EXCEPTION 'FIRST_CHECKOUT_ALREADY_AUTHORIZED'; END IF;
 prior := CASE WHEN p_action='e1.stock.admit' THEN 'null'::jsonb ELSE core_e1_stock_private.reservation_json(r) END;
 IF p_action = 'e1.stock.bind' THEN
  IF r.status = 'provisioned' AND (r.stock_tenant_id IS DISTINCT FROM a.stock_tenant_id
    OR r.stock_subject IS DISTINCT FROM a.stock_subject OR r.profile_id IS DISTINCT FROM a.profile_id)
    THEN RAISE EXCEPTION 'IMMUTABLE_STOCK_MAPPING'; END IF;
  IF a.stock_tenant_id IS NULL OR a.stock_subject IS NULL OR a.profile_id IS NULL THEN RAISE EXCEPTION 'STOCK_PROOF_REQUIRED'; END IF;
  IF e.id IS NULL THEN
   UPDATE core_e1_stock_private.reservations SET status='provisioned', stock_tenant_id=a.stock_tenant_id,
    stock_subject=a.stock_subject, profile_id=a.profile_id WHERE reservation_id=r.reservation_id RETURNING * INTO r;
  END IF;
 END IF;
 IF p_auth_until <= clock_timestamp() OR a.valid_until <= clock_timestamp() THEN RAISE EXCEPTION 'EXPIRED_BEFORE_AUDIT'; END IF;
 IF e.id IS NOT NULL THEN
  result := e.result;
 ELSE
  -- No exception handler: audit failure aborts native bootstrap and reservation.
  result := core_registry_private.append_event(r.company_id,p_actor,p_session,p_command,p_action,fingerprint,
    prior,core_e1_stock_private.reservation_json(r),a.evidence_ref::text,'{}',NULL);
  UPDATE core_e1_stock_private.attestations SET consumed_at=clock_timestamp() WHERE id=a.id;
 END IF;
 RETURN jsonb_build_object('reservation',core_e1_stock_private.reservation_json(r),'receipt',result,
   'modeledOnly',p_action='e1.stock.checkout');
END $fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA core_e1_stock_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.core_registry_e1_stock_command(uuid,uuid,timestamptz,uuid,text,jsonb)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_registry_e1_stock_command(uuid,uuid,timestamptz,uuid,text,jsonb) TO service_role;
-- Issuer enrollment, current managed session/fence transport and effective ACL
-- closure are deliberately not invented. No writer can populate attestations yet.
ROLLBACK;
