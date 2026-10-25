-- LOCAL SOURCE CANDIDATE / NOT A MIGRATION / DO NOT EXECUTE.
-- Owner-approved resource-isolated E1 successor. Historical SQL remains untouched.
-- Requires comparison with the accepted native Registry/ACL baseline before use.
-- The existing privileged Core server is the command boundary; customer JWTs
-- cannot call the writer directly and bypass its live getUser checks.
BEGIN;
DO $refuse$ BEGIN
  RAISE EXCEPTION 'LOCAL_PROPOSAL_ONLY: exact DEV authority and runtime validation required';
END $refuse$;

CREATE SCHEMA core_e1_resource_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA core_e1_resource_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE core_e1_resource_private.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  stock_origin text CHECK (stock_origin ~ '^https://[a-z0-9]{20}[.]supabase[.]co$'
    AND stock_origin NOT IN ('https://oyyfcmlquqfrdoffkgsd.supabase.co', 'https://mcvekinhgcqygfddyifs.supabase.co',
      'https://hxhusfkrlafxdnyasmsu.supabase.co'))
);
INSERT INTO core_e1_resource_private.settings VALUES (true, false, NULL);
CREATE TABLE core_e1_resource_private.origins (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL UNIQUE,
  core_subject uuid NOT NULL UNIQUE,
  reservation_id uuid NOT NULL UNIQUE REFERENCES public.company_portal_instances(id) ON DELETE RESTRICT,
  core_tenant_id uuid NOT NULL UNIQUE,
  command_id uuid NOT NULL,
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  stock_origin text NOT NULL CHECK (stock_origin ~ '^https://[a-z0-9]{20}[.]supabase[.]co$'
    AND stock_origin NOT IN ('https://oyyfcmlquqfrdoffkgsd.supabase.co', 'https://mcvekinhgcqygfddyifs.supabase.co',
      'https://hxhusfkrlafxdnyasmsu.supabase.co')),
  source text NOT NULL DEFAULT 'core.e1.resource.v1' CHECK (source = 'core.e1.resource.v1'),
  UNIQUE (core_subject, command_id),
  FOREIGN KEY (membership_id, company_id, core_subject)
    REFERENCES public.company_memberships(id, company_id, core_auth_user_id) ON DELETE RESTRICT
);
ALTER TABLE core_e1_resource_private.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_e1_resource_private.settings FORCE ROW LEVEL SECURITY;
ALTER TABLE core_e1_resource_private.origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_e1_resource_private.origins FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA core_e1_resource_private FROM PUBLIC, anon, authenticated, service_role;

-- The reciprocal mapping is also append-only. A different command/account may
-- never overwrite the first staged tuple, even after an uncertain response.
CREATE TABLE core_e1_resource_private.stock_bindings (
  reservation_id uuid PRIMARY KEY REFERENCES core_e1_resource_private.origins(reservation_id) ON DELETE RESTRICT,
  stock_tenant_id uuid NOT NULL UNIQUE, stock_subject uuid NOT NULL UNIQUE,
  profile_id uuid NOT NULL UNIQUE, stock_audit_event_id uuid NOT NULL UNIQUE,
  command_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE core_e1_resource_private.stock_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_e1_resource_private.stock_bindings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON core_e1_resource_private.stock_bindings FROM PUBLIC, anon, authenticated, service_role;

-- An origin is a birth record, never an editable claim or a reusable capability.
CREATE FUNCTION core_e1_resource_private.immutable_origin() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN RAISE EXCEPTION 'E1_ORIGIN_IMMUTABLE'; END
$fn$;
CREATE TRIGGER e1_origin_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON core_e1_resource_private.origins FOR EACH STATEMENT
  EXECUTE FUNCTION core_e1_resource_private.immutable_origin();
CREATE TRIGGER e1_binding_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON core_e1_resource_private.stock_bindings FOR EACH STATEMENT
  EXECUTE FUNCTION core_e1_resource_private.immutable_origin();

-- Reuse the native Registry fence, enforced for relevant tables even when a
-- writer forgets to take it. This is NOT a fence over unrelated legacy systems.
CREATE FUNCTION core_e1_resource_private.lock_registry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0)) THEN
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'E1_BUSY_REAUTHENTICATE';
  END IF;
  IF TG_OP = 'TRUNCATE' AND EXISTS (SELECT 1 FROM core_e1_resource_private.origins) THEN
    RAISE EXCEPTION 'E1_PROTECTED_GRAPH';
  END IF;
  RETURN NULL;
END
$fn$;
CREATE TRIGGER e1_company_lock BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.companies
  FOR EACH STATEMENT EXECUTE FUNCTION core_e1_resource_private.lock_registry();
CREATE TRIGGER e1_membership_lock BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.company_memberships
  FOR EACH STATEMENT EXECUTE FUNCTION core_e1_resource_private.lock_registry();
CREATE TRIGGER e1_instance_lock BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.company_portal_instances
  FOR EACH STATEMENT EXECUTE FUNCTION core_e1_resource_private.lock_registry();
CREATE TRIGGER e1_claim_lock BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON core_registry_private.owner_claims
  FOR EACH STATEMENT EXECUTE FUNCTION core_e1_resource_private.lock_registry();

CREATE FUNCTION core_e1_resource_private.guard_graph() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE prior jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  next_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  o core_e1_resource_private.origins%ROWTYPE;
BEGIN
  SELECT * INTO o FROM core_e1_resource_private.origins WHERE
    company_id IN ((prior->>'company_id')::uuid, (next_row->>'company_id')::uuid)
    OR (TG_TABLE_NAME = 'companies' AND company_id IN ((prior->>'id')::uuid, (next_row->>'id')::uuid))
    OR (TG_TABLE_NAME = 'company_memberships' AND core_subject IN
      ((prior->>'core_auth_user_id')::uuid, (next_row->>'core_auth_user_id')::uuid))
    OR (TG_TABLE_NAME = 'owner_claims' AND core_subject IN
      ((prior->>'target_user_id')::uuid, (next_row->>'target_user_id')::uuid)) LIMIT 1;
  IF FOUND THEN
    -- Native legacy claims/writes cannot adopt or reparent a protected graph.
    -- E2/E3 must use a separately validated two-operator path; no bypass here.
    IF TG_TABLE_NAME = 'owner_claims' THEN RAISE EXCEPTION 'E1_CLAIM_REQUIRES_SCOPED_RECOVERY'; END IF;
    IF TG_TABLE_NAME = 'companies' AND TG_OP = 'UPDATE'
      AND (next_row - 'audit_head') = (prior - 'audit_head')
      AND EXISTS (SELECT 1 FROM core_registry_private.events e WHERE e.company_id = o.company_id
        AND e.actor_id = o.core_subject AND e.previous_hash = prior->>'audit_head'
        AND e.event_hash = next_row->>'audit_head' AND e.action IN ('e1.stock.admit', 'e1.stock.stage', 'e1.stock.bind', 'e1.stock.checkout')) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'E1_PROTECTED_GRAPH';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER e1_company_guard BEFORE INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION core_e1_resource_private.guard_graph();
CREATE TRIGGER e1_membership_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION core_e1_resource_private.guard_graph();
CREATE TRIGGER e1_instance_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_portal_instances
  FOR EACH ROW EXECUTE FUNCTION core_e1_resource_private.guard_graph();
CREATE TRIGGER e1_claim_guard BEFORE INSERT OR UPDATE OR DELETE ON core_registry_private.owner_claims
  FOR EACH ROW EXECUTE FUNCTION core_e1_resource_private.guard_graph();

CREATE FUNCTION core_e1_resource_private.reservation_json(o core_e1_resource_private.origins)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
  SELECT jsonb_build_object('companyId', o.company_id, 'reservationId', o.reservation_id,
    'coreTenantId', o.core_tenant_id, 'coreSubject', o.core_subject, 'product', 'stock',
    'status', 'reserved', 'stockTenantId', NULL, 'stockSubject', NULL, 'profileId', NULL)
$fn$;

CREATE FUNCTION public.core_registry_e1_stock_create(p_actor uuid, p_session uuid,
  p_auth_until timestamptz, p_command uuid, p_company_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on
SET lock_timeout = '1ms' SET statement_timeout = '10s' AS $fn$
DECLARE o core_e1_resource_private.origins%ROWTYPE; fingerprint text; result jsonb; target_origin text;
  company uuid := gen_random_uuid(); membership uuid := gen_random_uuid(); instance uuid := gen_random_uuid();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_session IS NULL OR p_command IS NULL
    OR p_auth_until IS NULL OR p_auth_until <= clock_timestamp()
    OR p_auth_until > clock_timestamp() + interval '30 seconds'
    OR NOT EXISTS (SELECT 1 FROM core_e1_resource_private.settings WHERE singleton AND enabled AND stock_origin IS NOT NULL)
    OR p_company_name IS NULL OR length(p_company_name) NOT BETWEEN 2 AND 100
    OR p_company_name <> btrim(p_company_name) OR p_company_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'E1_DENIED';
  END IF;
  -- Never wait on the Registry fence with a prior Auth observation. A caller
  -- must reauthenticate before retrying this SAME idempotency key.
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0)) THEN
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'E1_BUSY_REAUTHENTICATE';
  END IF;
  IF p_auth_until <= clock_timestamp() THEN RAISE EXCEPTION 'AUTH_EXPIRED_AFTER_WAIT'; END IF;
  SELECT stock_origin INTO STRICT target_origin FROM core_e1_resource_private.settings
    WHERE singleton AND enabled AND stock_origin IS NOT NULL FOR SHARE NOWAIT;
  IF EXISTS (SELECT 1 FROM core_registry_private.operators WHERE subject_id = p_actor AND active) THEN
    RAISE EXCEPTION 'CUSTOMER_ONLY';
  END IF;
  fingerprint := encode(sha256(convert_to('e1.stock.admit:' ||
    jsonb_build_object('companyName', p_company_name, 'product', 'stock')::text, 'UTF8')), 'hex');
  SELECT * INTO o FROM core_e1_resource_private.origins WHERE core_subject = p_actor;
  IF FOUND THEN
    IF o.command_id <> p_command OR o.request_digest <> fingerprint THEN RAISE EXCEPTION 'E1_REPLAY_CONFLICT'; END IF;
    IF (SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id = p_actor) <> 1
      OR NOT EXISTS (SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id = m.company_id
        WHERE m.id = o.membership_id AND m.core_auth_user_id = p_actor AND m.company_id = o.company_id
        AND m.role = 'owner' AND m.status = 'active' AND c.status = 'active') THEN
      RAISE EXCEPTION 'CURRENT_OWNER_REQUIRED';
    END IF;
    SELECT e.result INTO STRICT result FROM core_registry_private.events e
      WHERE e.actor_id = p_actor AND e.command_id = p_command AND e.company_id = o.company_id
      AND e.action = 'e1.stock.admit' AND e.request_digest = fingerprint;
  ELSE
    IF EXISTS (SELECT 1 FROM public.company_memberships WHERE core_auth_user_id = p_actor)
      OR EXISTS (SELECT 1 FROM core_registry_private.owner_claims WHERE target_user_id = p_actor AND status = 'pending') THEN
      RAISE EXCEPTION 'EXISTING_OR_AMBIGUOUS_CANONICAL_COMPANY';
    END IF;
    INSERT INTO public.companies(id, display_name) VALUES (company, p_company_name);
    INSERT INTO public.company_memberships(id, company_id, core_auth_user_id, role)
      VALUES (membership, company, p_actor, 'owner');
    INSERT INTO public.company_portal_instances(id, company_id, portal_type) VALUES (instance, company, 'stock');
    INSERT INTO core_e1_resource_private.origins(company_id, membership_id, core_subject,
      reservation_id, core_tenant_id, command_id, request_digest, stock_origin)
      VALUES (company, membership, p_actor, instance, gen_random_uuid(), p_command, fingerprint, target_origin) RETURNING * INTO o;
    -- Existing native audit, in the SAME transaction. Failure rolls back everything.
    result := core_registry_private.append_event(company, p_actor, p_session, p_command, 'e1.stock.admit',
      fingerprint, 'null'::jsonb, core_e1_resource_private.reservation_json(o), instance::text, '{}', NULL);
  END IF;
  IF p_auth_until <= clock_timestamp() THEN RAISE EXCEPTION 'AUTH_EXPIRED_BEFORE_RETURN'; END IF;
  RETURN jsonb_build_object('reservation', core_e1_resource_private.reservation_json(o), 'receipt', result, 'modeledOnly', false);
END
$fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA core_e1_resource_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.core_registry_e1_stock_create(uuid, uuid, timestamptz, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_registry_e1_stock_create(uuid, uuid, timestamptz, uuid, text) TO service_role;

-- Read-only handoff context, using the actual customer's Core JWT. It supplies
-- only this new resource graph, never legacy tenants, invoices or a bearer grant.
CREATE FUNCTION public.core_registry_e1_stock_context(p_company uuid, p_reservation uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' SET row_security = on AS $fn$
  SELECT core_e1_resource_private.reservation_json(o) || jsonb_build_object('companyName', c.display_name,
    'stockOrigin', o.stock_origin, 'stockBinding', CASE WHEN b.reservation_id IS NULL THEN NULL ELSE
      jsonb_build_object('stockTenantId', b.stock_tenant_id, 'stockSubject', b.stock_subject,
        'profileId', b.profile_id, 'auditEventId', b.stock_audit_event_id, 'status', 'quarantined') END)
  FROM core_e1_resource_private.origins o JOIN public.companies c ON c.id = o.company_id
  JOIN public.company_memberships m ON m.id = o.membership_id
  JOIN public.company_portal_instances i ON i.id = o.reservation_id
  LEFT JOIN core_e1_resource_private.stock_bindings b ON b.reservation_id = o.reservation_id
  WHERE auth.role() = 'authenticated' AND o.core_subject = auth.uid()
    AND o.company_id = p_company AND o.reservation_id = p_reservation
    AND c.status = 'active' AND m.company_id = o.company_id AND m.core_auth_user_id = auth.uid()
    AND m.status = 'active' AND m.role = 'owner' AND i.company_id = o.company_id
    AND i.portal_type = 'stock' AND i.lifecycle_status = 'reserved'
    AND i.legacy_tenant_id IS NULL AND i.portal_instance_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM core_registry_private.operators WHERE subject_id = auth.uid() AND active)
    AND (SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id = auth.uid()) = 1
$fn$;
REVOKE ALL ON FUNCTION public.core_registry_e1_stock_context(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_registry_e1_stock_context(uuid, uuid) TO authenticated;

CREATE FUNCTION public.core_registry_e1_stock_bind_stage(p_actor uuid, p_session uuid, p_auth_until timestamptz,
  p_command uuid, p_company uuid, p_reservation uuid, p_stock_subject uuid, p_stock_session uuid,
  p_stock_tenant uuid, p_profile uuid, p_stock_audit_event uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on
SET lock_timeout = '1ms' SET statement_timeout = '10s' AS $fn$
DECLARE o core_e1_resource_private.origins%ROWTYPE; b core_e1_resource_private.stock_bindings%ROWTYPE;
  fingerprint text; result jsonb; staged jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_session IS NULL OR p_command IS NULL
    OR p_company IS NULL OR p_reservation IS NULL OR p_stock_subject IS NULL OR p_stock_session IS NULL
    OR p_stock_tenant IS NULL OR p_profile IS NULL OR p_stock_audit_event IS NULL
    OR p_auth_until IS NULL OR p_auth_until <= clock_timestamp()
    OR p_auth_until > clock_timestamp() + interval '30 seconds'
    OR NOT EXISTS (SELECT 1 FROM core_e1_resource_private.settings WHERE singleton AND enabled) THEN
    RAISE EXCEPTION 'E1_BIND_DENIED';
  END IF;
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0)) THEN
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'E1_BUSY_REAUTHENTICATE';
  END IF;
  SELECT * INTO STRICT o FROM core_e1_resource_private.origins WHERE company_id = p_company
    AND reservation_id = p_reservation AND core_subject = p_actor FOR UPDATE NOWAIT;
  IF EXISTS (SELECT 1 FROM core_registry_private.operators WHERE subject_id = p_actor AND active)
    OR NOT EXISTS (SELECT 1 FROM public.company_portal_instances WHERE id = o.reservation_id
      AND company_id = o.company_id AND portal_type = 'stock' AND lifecycle_status = 'reserved'
      AND legacy_tenant_id IS NULL AND portal_instance_id IS NULL)
    OR (SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id = p_actor) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id = m.company_id
      WHERE m.id = o.membership_id AND m.company_id = o.company_id AND m.core_auth_user_id = p_actor
      AND m.role = 'owner' AND m.status = 'active' AND c.status = 'active') THEN
    RAISE EXCEPTION 'CURRENT_OWNER_REQUIRED';
  END IF;
  staged := jsonb_build_object('companyId', o.company_id, 'reservationId', o.reservation_id,
    'coreTenantId', o.core_tenant_id, 'coreSubject', o.core_subject, 'stockOrigin', o.stock_origin,
    'stockTenantId', p_stock_tenant, 'stockSubject', p_stock_subject, 'profileId', p_profile,
    'auditEventId', p_stock_audit_event, 'product', 'stock', 'status', 'quarantined', 'isActive', false);
  fingerprint := encode(sha256(convert_to('e1.stock.stage:' || staged::text, 'UTF8')), 'hex');
  SELECT * INTO b FROM core_e1_resource_private.stock_bindings WHERE reservation_id = p_reservation;
  IF FOUND THEN
    IF b.command_id <> p_command OR b.stock_subject <> p_stock_subject OR b.stock_tenant_id <> p_stock_tenant
      OR b.profile_id <> p_profile OR b.stock_audit_event_id <> p_stock_audit_event THEN RAISE EXCEPTION 'E1_BIND_REPLAY_CONFLICT'; END IF;
    SELECT e.result INTO STRICT result FROM core_registry_private.events e WHERE e.actor_id = p_actor
      AND e.command_id = p_command AND e.company_id = o.company_id AND e.action = 'e1.stock.stage'
      AND e.request_digest = fingerprint;
  ELSE
    INSERT INTO core_e1_resource_private.stock_bindings(reservation_id, stock_tenant_id, stock_subject,
      profile_id, stock_audit_event_id, command_id)
      VALUES (p_reservation, p_stock_tenant, p_stock_subject, p_profile, p_stock_audit_event, p_command);
    result := core_registry_private.append_event(o.company_id, p_actor, p_session, p_command, 'e1.stock.stage',
      fingerprint, 'null'::jsonb, staged || jsonb_build_object('stockSessionId', p_stock_session),
      p_stock_audit_event::text, '{}', NULL);
  END IF;
  IF p_auth_until <= clock_timestamp() THEN RAISE EXCEPTION 'AUTH_EXPIRED_BEFORE_RETURN'; END IF;
  RETURN jsonb_build_object('binding', staged, 'receipt', result);
END
$fn$;
REVOKE ALL ON FUNCTION public.core_registry_e1_stock_bind_stage(uuid,uuid,timestamptz,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_registry_e1_stock_bind_stage(uuid,uuid,timestamptz,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) TO service_role;
-- No Auth-table privileges, custom roles, provenance issuer or global history scan.
-- Existing legacy runtime flag stays OFF. Privileged operator custody, managed
-- session checkpoints after waits and all trigger/RPC behavior need runtime proof.
ROLLBACK;
