SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '25s';
DO $preflight$ BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
    OR (SELECT runtime_enabled FROM core_registry_private.settings WHERE singleton) IS DISTINCT FROM false
    OR (SELECT enabled FROM core_e1_resource_private.settings WHERE singleton) IS DISTINCT FROM false
    OR to_regprocedure('public.core_registry_session_is_live()') IS NOT NULL
    OR md5(pg_get_functiondef('public.core_registry_e1_stock_context(uuid,uuid)'::regprocedure)) <> '4f43d4dfd2744786e6a0574dfe73b661'
  THEN RAISE EXCEPTION 'STOP_CORE_SESSION_BASELINE_DRIFT'; END IF;
END $preflight$;
CREATE FUNCTION public.core_registry_session_is_live()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' SET row_security = on AS $live$
DECLARE subject uuid := auth.uid(); claims jsonb := auth.jwt(); sid uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR subject IS NULL
    OR jsonb_typeof(claims->'session_id') IS DISTINCT FROM 'string'
    OR (claims->>'session_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR jsonb_typeof(claims->'exp') IS DISTINCT FROM 'number'
    OR (claims->>'exp')::numeric <= extract(epoch FROM clock_timestamp()) THEN RETURN false; END IF;
  sid := (claims->>'session_id')::uuid;
  RETURN EXISTS (SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
    WHERE s.id=sid AND s.user_id=subject AND (s.not_after IS NULL OR s.not_after>clock_timestamp())
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()));
EXCEPTION WHEN OTHERS THEN RETURN false;
END $live$;
ALTER FUNCTION public.core_registry_session_is_live() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.core_registry_session_is_live() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_registry_session_is_live() TO authenticated;
CREATE POLICY core_managed_session_required ON public.companies AS RESTRICTIVE
  FOR ALL TO authenticated USING ((SELECT public.core_registry_session_is_live()))
  WITH CHECK ((SELECT public.core_registry_session_is_live()));
CREATE POLICY core_managed_session_required ON public.company_memberships AS RESTRICTIVE
  FOR ALL TO authenticated USING ((SELECT public.core_registry_session_is_live()))
  WITH CHECK ((SELECT public.core_registry_session_is_live()));
CREATE POLICY core_managed_session_required ON public.company_portal_instances AS RESTRICTIVE
  FOR ALL TO authenticated USING ((SELECT public.core_registry_session_is_live()))
  WITH CHECK ((SELECT public.core_registry_session_is_live()));
CREATE OR REPLACE FUNCTION public.core_registry_e1_stock_context(p_company uuid, p_reservation uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'on'
AS $function$
  SELECT core_e1_resource_private.reservation_json(o) || jsonb_build_object('companyName', c.display_name,
    'stockOrigin', o.stock_origin, 'stockBinding', CASE WHEN b.reservation_id IS NULL THEN NULL ELSE
      jsonb_build_object('stockTenantId', b.stock_tenant_id, 'stockSubject', b.stock_subject,
        'profileId', b.profile_id, 'auditEventId', b.stock_audit_event_id, 'status', 'quarantined') END)
  FROM core_e1_resource_private.origins o JOIN public.companies c ON c.id = o.company_id
  JOIN public.company_memberships m ON m.id = o.membership_id
  JOIN public.company_portal_instances i ON i.id = o.reservation_id
  LEFT JOIN core_e1_resource_private.stock_bindings b ON b.reservation_id = o.reservation_id
  WHERE public.core_registry_session_is_live() AND o.core_subject = auth.uid()
    AND o.company_id = p_company AND o.reservation_id = p_reservation
    AND c.status = 'active' AND m.company_id = o.company_id AND m.core_auth_user_id = auth.uid()
    AND m.status = 'active' AND m.role = 'owner' AND i.company_id = o.company_id
    AND i.portal_type = 'stock' AND i.lifecycle_status = 'reserved'
    AND i.legacy_tenant_id IS NULL AND i.portal_instance_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM core_registry_private.operators WHERE subject_id = auth.uid() AND active)
    AND (SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id = auth.uid()) = 1
$function$
;
NOTIFY pgrst, 'reload schema';
