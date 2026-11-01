-- Forward proposal only. Core hxhusfkrlafxdnyasmsu, existing Production database.
-- Empty on installation; inserting/enabling fixtures needs bounded Owner authority.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $guard$
BEGIN
  IF current_user<>'postgres' OR to_regnamespace('core_billing_sandbox_private') IS NOT NULL THEN
    RAISE EXCEPTION 'billing_uat_baseline_drift';
  END IF;
END $guard$;
CREATE SCHEMA core_billing_sandbox_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA core_billing_sandbox_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA core_billing_sandbox_private TO service_role;
CREATE TABLE core_billing_sandbox_private.cohort(
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  core_subject uuid NOT NULL REFERENCES auth.users(id),
  stock_tenant_id uuid NOT NULL UNIQUE,
  fixture_slug text NOT NULL UNIQUE CHECK(fixture_slug LIKE 'codex-billing-uat-%'),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_until timestamptz NOT NULL,
  CHECK(valid_until>created_at AND valid_until<=created_at+interval '6 hours')
);
CREATE INDEX billing_uat_subject ON core_billing_sandbox_private.cohort(core_subject);
ALTER TABLE core_billing_sandbox_private.cohort ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_billing_sandbox_private.cohort FORCE ROW LEVEL SECURITY;
REVOKE ALL ON core_billing_sandbox_private.cohort FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON core_billing_sandbox_private.cohort TO service_role;

CREATE FUNCTION core_billing_sandbox_private.retain_history() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $function$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'billing_uat_history_retained'; END IF;
  IF OLD.enabled IS NOT TRUE OR NEW.enabled IS NOT FALSE
    OR (to_jsonb(OLD)-'enabled') IS DISTINCT FROM (to_jsonb(NEW)-'enabled') THEN
    RAISE EXCEPTION 'billing_uat_history_retained';
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER billing_uat_history BEFORE UPDATE OR DELETE ON core_billing_sandbox_private.cohort
  FOR EACH ROW EXECUTE FUNCTION core_billing_sandbox_private.retain_history();
CREATE TRIGGER billing_uat_no_truncate BEFORE TRUNCATE ON core_billing_sandbox_private.cohort
  FOR EACH STATEMENT EXECUTE FUNCTION core_billing_sandbox_private.retain_history();

CREATE FUNCTION public.billing_sandbox_uat_allowed(p_tenant uuid,p_plan uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $function$
  SELECT current_user='service_role'
    AND p_plan IN ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,'5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
    AND (SELECT to_jsonb(s)->>'value' FROM public.platform_settings s WHERE key='midtrans_mode')='sandbox'
    AND EXISTS(SELECT 1 FROM core_billing_sandbox_private.cohort c
      JOIN public.tenants t ON t.id=c.tenant_id AND t.platform='stock' AND t.slug=c.fixture_slug AND t.owner_user_id=c.core_subject
      JOIN public.tenant_members m ON m.tenant_id=t.id AND m.user_id=c.core_subject AND m.role='owner' AND m.is_active
      WHERE c.tenant_id=p_tenant AND c.enabled AND c.valid_until>statement_timestamp());
$function$;
REVOKE ALL ON FUNCTION public.billing_sandbox_uat_allowed(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.billing_sandbox_uat_allowed(uuid,uuid) TO service_role;
COMMIT;
