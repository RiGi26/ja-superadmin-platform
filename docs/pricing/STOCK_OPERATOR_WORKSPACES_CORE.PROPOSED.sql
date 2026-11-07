-- Core proposal. Exact current operational memberships for the authenticated Hub user.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.core_stock_operator_owner_view(uuid)') IS NULL
   OR to_regprocedure('public.core_stock_operator_workspaces()') IS NOT NULL
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_WORKSPACES_BASELINE_DENIED'; END IF;
END $preflight$;
CREATE FUNCTION public.core_stock_operator_workspaces() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR NOT public.core_registry_session_is_live()
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.settings WHERE singleton AND enabled)
 THEN RETURN '[]'::jsonb; END IF;
 SELECT coalesce(jsonb_agg(row.value ORDER BY row.company_name,row.company_id),'[]'::jsonb) INTO result FROM (
   SELECT c.display_name AS company_name,c.id AS company_id,jsonb_build_object(
     'companyId',c.id,'companyName',c.display_name,'instanceId',r.instance_id,
     'membershipId',m.id,'coreSubject',m.core_subject,'role',m.role) AS value
   FROM stock_membership_private.memberships m
   JOIN stock_membership_private.identity_pairs pair ON pair.id=m.pair_id AND pair.revoked_at IS NULL
     AND pair.core_subject=m.core_subject AND pair.stock_subject=m.stock_subject
   JOIN public.company_memberships cm ON cm.id=m.id AND cm.company_id=m.company_id
     AND cm.core_auth_user_id=m.core_subject AND cm.role='member' AND cm.status='active'
   JOIN auth.users u ON u.id=m.core_subject AND u.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL
     AND u.email_confirmed_at<=clock_timestamp() AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
   JOIN stock_membership_private.resources r ON r.company_id=m.company_id AND r.revoked_at IS NULL
     AND r.owner_membership_id<>m.id
   JOIN public.companies c ON c.id=m.company_id AND c.status='active'
   JOIN public.company_portal_instances pi ON pi.id=r.instance_id AND pi.company_id=c.id AND pi.portal_type='stock'
   WHERE m.core_subject=auth.uid() AND m.revoked_at IS NULL AND m.role IN ('admin','staff','produksi')
     AND stock_billing_private.paid_creation_allowed(m.core_subject,m.stock_subject)
     AND stock_membership_private.operator_seats_remaining(c.id,r.instance_id,clock_timestamp())>=0
     AND EXISTS(SELECT 1 FROM stock_membership_private.operator_invitation_claims claim
       JOIN stock_membership_private.operator_invitation_closures closed ON closed.id=claim.id AND closed.state='activated'
       WHERE claim.membership_id=m.id AND claim.profile_id=m.profile_id
         AND claim.core_subject=m.core_subject AND claim.stock_subject=m.stock_subject)
   ORDER BY c.display_name,c.id LIMIT 20
 ) row;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.core_stock_operator_workspaces() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_operator_workspaces() TO authenticated;
COMMIT;
