-- H1.G1 Supabase-native empty-scaffold recovery proposal. NOT AUTHORIZED FOR EXECUTION.
-- Only after an independently approved durable installation of the exact SQL008 inventory.
-- Does not touch old W1 objects, roles, Auth, external systems or migration history.
-- Populated Registry recovery is a forward repair; never delete business/audit history.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE actual text[];
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
     OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.oid = n.nspowner
       WHERE n.nspname = 'core_registry_private' AND r.rolname = current_user) THEN
    RAISE EXCEPTION 'STOP: independently proven existing postgres recovery authority required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_roles r ON r.oid = c.relowner
    WHERE ((n.nspname = 'core_registry_private') OR (n.nspname = 'public'
      AND c.relname IN ('companies', 'company_memberships', 'company_portal_instances'))) AND r.rolname <> current_user)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
      WHERE (n.nspname = 'core_registry_private' OR (n.nspname = 'public' AND p.proname IN
        ('core_registry_authorize', 'core_registry_mutate', 'core_registry_owner_claim_context'))) AND r.rolname <> current_user) THEN
    RAISE EXCEPTION 'STOP: object ownership drift';
  END IF;
  SELECT array_agg(c.relname::text ORDER BY c.relname::text) INTO actual FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'core_registry_private' AND c.relkind IN ('r', 'p', 'v', 'm', 'f');
  IF actual IS DISTINCT FROM ARRAY['events', 'operators', 'owner_claims', 'provenance', 'settings'] THEN
    RAISE EXCEPTION 'STOP: private object inventory drift'; END IF;
END
$preflight$;

-- Same fence as every writer; table locks also exclude nonparticipating direct DML.
SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0));
LOCK TABLE public.companies, public.company_memberships, public.company_portal_instances,
  core_registry_private.settings, core_registry_private.operators, core_registry_private.provenance,
  core_registry_private.owner_claims, core_registry_private.events IN ACCESS EXCLUSIVE MODE;
DO $empty_only$
BEGIN
  IF (SELECT count(*) FROM core_registry_private.settings) <> 1
     OR NOT EXISTS (SELECT 1 FROM core_registry_private.settings WHERE singleton AND NOT runtime_enabled)
     OR EXISTS (SELECT 1 FROM public.companies)
     OR EXISTS (SELECT 1 FROM public.company_memberships)
     OR EXISTS (SELECT 1 FROM public.company_portal_instances)
     OR EXISTS (SELECT 1 FROM core_registry_private.operators)
     OR EXISTS (SELECT 1 FROM core_registry_private.provenance)
     OR EXISTS (SELECT 1 FROM core_registry_private.owner_claims)
     OR EXISTS (SELECT 1 FROM core_registry_private.events) THEN
    RAISE EXCEPTION 'STOP: populated or enabled Registry; preserve history and use reviewed forward recovery';
  END IF;
END
$empty_only$;

DROP FUNCTION public.core_registry_mutate(uuid, uuid, timestamptz, uuid, text, jsonb, uuid[]) RESTRICT;
DROP FUNCTION public.core_registry_owner_claim_context(uuid, uuid) RESTRICT;
DROP FUNCTION public.core_registry_authorize(uuid, boolean) RESTRICT;
DROP FUNCTION core_registry_private.append_event(uuid, uuid, uuid, uuid, text, text, jsonb, jsonb, text, uuid[], uuid) RESTRICT;
DROP FUNCTION core_registry_private.proof_valid(core_registry_private.provenance, boolean) RESTRICT;
DROP TRIGGER events_immutable ON core_registry_private.events RESTRICT;
DROP FUNCTION core_registry_private.reject_audit_change() RESTRICT;
DROP TABLE core_registry_private.events RESTRICT;
DROP TABLE core_registry_private.owner_claims RESTRICT;
DROP TABLE core_registry_private.provenance RESTRICT;
DROP TABLE core_registry_private.operators RESTRICT;
DROP TABLE core_registry_private.settings RESTRICT;
-- Drop dependent SELECT policies with their tables before the referenced base.
DROP TABLE public.company_portal_instances RESTRICT;
DROP POLICY own_active_company ON public.companies RESTRICT;
DROP TABLE public.company_memberships RESTRICT;
DROP TABLE public.companies RESTRICT;
DROP SCHEMA core_registry_private RESTRICT;

-- This exact proposal rehearses recovery only; no durable deletion is authorized.
ROLLBACK;
