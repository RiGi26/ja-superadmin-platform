-- Core-only, disabled delivery readers and immutable acknowledgments.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $baseline$ BEGIN
 IF current_user<>'postgres' OR to_regclass('stock_membership_private.member_commands') IS NULL
   OR to_regclass('stock_membership_private.member_receipts') IS NOT NULL
 THEN RAISE EXCEPTION 'STOCK_MEMBER_DELIVERY_BASELINE_DENIED'; END IF;
END $baseline$;
CREATE TABLE stock_membership_private.member_receipts(
 id uuid PRIMARY KEY REFERENCES stock_membership_private.member_commands(id) ON DELETE RESTRICT,
 receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE stock_membership_private.member_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_membership_private.member_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE stock_membership_private.member_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER member_receipt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.member_receipts
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();
CREATE TRIGGER member_receipt_fence BEFORE INSERT ON stock_membership_private.member_receipts
 FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry();
CREATE TRIGGER member_receipt_audit AFTER INSERT ON stock_membership_private.member_receipts
 FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit();
CREATE FUNCTION public.core_stock_member_pending() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $fn$
 SELECT coalesce(jsonb_agg(id ORDER BY revocation DESC,created_at,id),'[]'::jsonb) FROM (
   SELECT c.id,c.created_at,(c.payload->>'action'='revoke') AS revocation FROM stock_membership_private.member_commands c
   WHERE auth.role()='service_role'
     AND EXISTS(SELECT 1 FROM stock_membership_private.lifecycle_settings WHERE singleton AND delivery_enabled)
     AND NOT EXISTS(SELECT 1 FROM stock_membership_private.member_receipts r WHERE r.id=c.id)
   ORDER BY (c.payload->>'action'='revoke') DESC,c.created_at,c.id LIMIT 20
 ) pending
$fn$;
CREATE FUNCTION public.core_stock_member_delivery(p_event uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $fn$
 SELECT c.payload FROM stock_membership_private.member_commands c WHERE c.id=p_event AND auth.role()='service_role'
   AND EXISTS(SELECT 1 FROM stock_membership_private.lifecycle_settings WHERE singleton AND delivery_enabled)
   AND NOT EXISTS(SELECT 1 FROM stock_membership_private.member_receipts r WHERE r.id=c.id)
$fn$;
CREATE FUNCTION public.core_stock_member_ack(p_event uuid,p_receipt jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE command stock_membership_private.member_commands%ROWTYPE; keys text[]; existing jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR jsonb_typeof(p_receipt) IS DISTINCT FROM 'object'
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.lifecycle_settings WHERE singleton AND delivery_enabled)
 THEN RAISE EXCEPTION 'STOCK_MEMBER_ACK_DENIED'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_MEMBERSHIP_BUSY_REAUTHENTICATE'; END IF;
 SELECT * INTO command FROM stock_membership_private.member_commands WHERE id=p_event;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MEMBER_ACK_DENIED'; END IF;
 SELECT array_agg(key ORDER BY key) INTO keys FROM jsonb_object_keys(p_receipt) key;
 IF keys IS DISTINCT FROM ARRAY['companyId','currentRevision','eventId','membershipId','revision','status','stockAuditEventId']
   OR p_receipt->'eventId' IS DISTINCT FROM command.payload->'eventId'
   OR p_receipt->'companyId' IS DISTINCT FROM command.payload->'companyId'
   OR p_receipt->'membershipId' IS DISTINCT FROM command.payload->'membershipId'
   OR p_receipt->'revision' IS DISTINCT FROM command.payload->'revision'
   OR jsonb_typeof(p_receipt->'currentRevision') IS DISTINCT FROM 'number'
   OR p_receipt->>'currentRevision' !~ '^[0-9]+$'
   OR (p_receipt->>'currentRevision')::numeric NOT BETWEEN (command.payload->>'revision')::bigint AND 9007199254740991
   OR jsonb_typeof(p_receipt->'stockAuditEventId') IS DISTINCT FROM 'string'
   OR p_receipt->>'stockAuditEventId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   OR p_receipt->>'status' IS NULL
   OR (CASE WHEN p_receipt->>'status'='superseded' THEN (p_receipt->>'currentRevision')::bigint<=(command.payload->>'revision')::bigint
     ELSE p_receipt->>'status'<>CASE WHEN command.payload->>'action'='role' THEN 'applied' ELSE 'revoked' END
       OR p_receipt->'currentRevision' IS DISTINCT FROM command.payload->'revision' END)
 THEN RAISE EXCEPTION 'STOCK_MEMBER_ACK_DENIED'; END IF;
 SELECT receipt INTO existing FROM stock_membership_private.member_receipts WHERE id=p_event;
 IF FOUND THEN
   IF existing IS DISTINCT FROM p_receipt THEN RAISE EXCEPTION 'STOCK_MEMBER_ACK_CONFLICT'; END IF;
   RETURN true;
 END IF;
 INSERT INTO stock_membership_private.member_receipts(id,receipt) VALUES(p_event,p_receipt);
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.core_stock_member_pending(),public.core_stock_member_delivery(uuid),public.core_stock_member_ack(uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_member_pending(),public.core_stock_member_delivery(uuid),public.core_stock_member_ack(uuid,jsonb) TO service_role;

CREATE FUNCTION public.core_stock_member_owner_view(p_company uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR NOT public.core_registry_session_is_live()
   OR NOT stock_billing_private.current_owner(p_company,auth.uid())
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.lifecycle_settings WHERE singleton AND (mutations_enabled OR delivery_enabled))
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.settings WHERE singleton AND enabled)
 THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('companyId',r.company_id,'companyName',c.display_name,
   'canManage',(SELECT mutations_enabled FROM stock_membership_private.lifecycle_settings WHERE singleton),
   'members',(SELECT coalesce(jsonb_agg(row.value ORDER BY row.revoked_at NULLS FIRST,row.id),'[]'::jsonb) FROM (
     SELECT m.id,m.revoked_at,jsonb_build_object('membershipId',m.id,'role',m.role,'revision',m.revision,
       'email',u.email,'revoked',m.revoked_at IS NOT NULL,
       'canChangeRole',m.revoked_at IS NULL AND EXISTS(SELECT 1 FROM stock_membership_private.operator_confirmations cf WHERE cf.membership_id=m.id)
         AND coalesce(stock_membership_private.operator_seats_remaining(r.company_id,r.instance_id,clock_timestamp()),-1)>=0,
       'pendingEvents',(SELECT coalesce(jsonb_agg(cmd.id ORDER BY cmd.revocation DESC,cmd.created_at),'[]'::jsonb) FROM (
         SELECT event.id,event.created_at,(event.payload->>'action'='revoke') AS revocation
         FROM stock_membership_private.member_commands event WHERE event.membership_id=m.id
         AND NOT EXISTS(SELECT 1 FROM stock_membership_private.member_receipts receipt WHERE receipt.id=event.id)
         ORDER BY (event.payload->>'action'='revoke') DESC,event.created_at LIMIT 20) cmd)) AS value
     FROM stock_membership_private.memberships m JOIN auth.users u ON u.id=m.core_subject
     WHERE m.company_id=r.company_id AND m.id<>r.owner_membership_id
     ORDER BY m.revoked_at NULLS FIRST,m.id LIMIT 20
   ) row)) INTO result FROM stock_membership_private.resources r JOIN public.companies c ON c.id=r.company_id
   WHERE r.company_id=p_company AND r.revoked_at IS NULL;
 RETURN result;
END $fn$;
CREATE FUNCTION public.core_stock_member_retry(p_actor uuid,p_session uuid,p_until timestamptz,p_company uuid,p_event uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_session IS NULL
   OR p_until IS NULL OR p_until<=clock_timestamp() OR p_until>clock_timestamp()+interval '30 seconds'
   OR NOT stock_workspace_private.billing_session_live(p_actor,p_session)
   OR NOT stock_billing_private.current_owner(p_company,p_actor)
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.lifecycle_settings WHERE singleton AND delivery_enabled)
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.member_commands WHERE id=p_event AND company_id=p_company)
 THEN RAISE EXCEPTION 'STOCK_MEMBER_RETRY_DENIED'; END IF;
 RETURN NOT EXISTS(SELECT 1 FROM stock_membership_private.member_receipts WHERE id=p_event);
END $fn$;
REVOKE ALL ON FUNCTION public.core_stock_member_owner_view(uuid),public.core_stock_member_retry(uuid,uuid,timestamptz,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_member_owner_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.core_stock_member_retry(uuid,uuid,timestamptz,uuid,uuid) TO service_role;
COMMIT;
