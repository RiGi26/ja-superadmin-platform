-- Closed proposal. The committed invitation closure is the cleanup outbox.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $baseline$ BEGIN
  IF current_user <> 'postgres'
    OR to_regclass('stock_membership_private.operator_invitation_closures') IS NULL
    OR to_regclass('stock_membership_private.lifecycle_settings') IS NULL
    OR to_regclass('stock_membership_private.operator_closure_receipts') IS NOT NULL
  THEN RAISE EXCEPTION 'STOCK_OPERATOR_CLOSURE_BASELINE_DENIED'; END IF;
END $baseline$;

CREATE TABLE stock_membership_private.operator_closure_receipts (
  id uuid PRIMARY KEY REFERENCES stock_membership_private.operator_invitation_closures(id) ON DELETE RESTRICT,
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE stock_membership_private.operator_closure_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_membership_private.operator_closure_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE stock_membership_private.operator_closure_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER operator_closure_receipt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.operator_closure_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();
CREATE TRIGGER operator_closure_receipt_fence BEFORE INSERT ON stock_membership_private.operator_closure_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry();
CREATE TRIGGER operator_closure_receipt_audit AFTER INSERT ON stock_membership_private.operator_closure_receipts
  FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit();
CREATE INDEX stock_operator_expiry_due ON stock_membership_private.operator_invitations(expires_at,id);
CREATE INDEX stock_operator_closure_due ON stock_membership_private.operator_invitation_closures(closed_at,id)
  WHERE state IN ('canceled','expired');

CREATE FUNCTION public.core_stock_operator_closure_pending() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE observed timestamptz; pending jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR NOT EXISTS(SELECT 1 FROM stock_membership_private.lifecycle_settings WHERE singleton AND delivery_enabled)
  THEN RETURN '[]'::jsonb; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
  THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_MEMBERSHIP_BUSY_REAUTHENTICATE'; END IF;
  observed:=clock_timestamp();
  -- The same Registry fence protects admission, cancellation and expiration.
  INSERT INTO stock_membership_private.operator_invitation_closures(id,state,closed_at)
    SELECT i.id,'expired',observed
    FROM stock_membership_private.operator_invitations i
    WHERE i.expires_at<=observed
      AND NOT EXISTS(SELECT 1 FROM stock_membership_private.operator_invitation_closures c WHERE c.id=i.id)
    ORDER BY i.expires_at,i.id LIMIT 10;
  SELECT coalesce(jsonb_agg(id ORDER BY closed_at,id),'[]'::jsonb) INTO pending FROM (
    SELECT c.id,c.closed_at
    FROM stock_membership_private.operator_invitation_closures c
    JOIN stock_membership_private.operator_invitation_claims claim ON claim.id=c.id
    WHERE c.state IN ('canceled','expired')
      AND NOT EXISTS(SELECT 1 FROM stock_membership_private.operator_closure_receipts r WHERE r.id=c.id)
      AND NOT EXISTS(SELECT 1 FROM stock_membership_private.memberships m WHERE m.id=claim.membership_id)
    ORDER BY c.closed_at,c.id LIMIT 10
  ) due;
  RETURN pending;
END $fn$;

CREATE FUNCTION public.core_stock_operator_closure_delivery(p_invite uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $fn$
  SELECT jsonb_build_object('kind','stock_operator_closure_v2','inviteId',i.id,'companyId',i.company_id,
    'instanceId',i.instance_id,'stockTenantId',i.stock_tenant_id,'ownerMembershipId',i.owner_membership_id,
    'membershipId',claim.membership_id,'profileId',claim.profile_id,'coreSubject',claim.core_subject,
    'stockSubject',claim.stock_subject,'state',c.state,'closedAt',c.closed_at)
  FROM stock_membership_private.operator_invitation_closures c
  JOIN stock_membership_private.operator_invitations i ON i.id=c.id
  JOIN stock_membership_private.operator_invitation_claims claim ON claim.id=c.id
  WHERE c.id=p_invite AND c.state IN ('canceled','expired') AND auth.role()='service_role'
    AND EXISTS(SELECT 1 FROM stock_membership_private.lifecycle_settings WHERE singleton AND delivery_enabled)
    AND NOT EXISTS(SELECT 1 FROM stock_membership_private.memberships m WHERE m.id=claim.membership_id)
$fn$;

CREATE FUNCTION public.core_stock_operator_closure_ack(p_invite uuid,p_receipt jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE delivery jsonb; existing jsonb; keys text[];
BEGIN
  IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  delivery:=public.core_stock_operator_closure_delivery(p_invite);
  IF delivery IS NULL THEN RETURN false; END IF;
  SELECT array_agg(key ORDER BY key) INTO keys FROM jsonb_object_keys(p_receipt) key;
  IF keys IS DISTINCT FROM ARRAY['companyId','inviteId','profileId','status','stockAuditEventId']
    OR p_receipt->>'status' IS DISTINCT FROM 'retired'
    OR p_receipt->'inviteId' IS DISTINCT FROM delivery->'inviteId'
    OR p_receipt->'companyId' IS DISTINCT FROM delivery->'companyId'
    OR p_receipt->'profileId' IS DISTINCT FROM delivery->'profileId'
    OR jsonb_typeof(p_receipt->'stockAuditEventId') IS DISTINCT FROM 'string'
    OR p_receipt->>'stockAuditEventId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN RETURN false; END IF;
  INSERT INTO stock_membership_private.operator_closure_receipts(id,receipt)
    VALUES(p_invite,p_receipt) ON CONFLICT(id) DO NOTHING;
  SELECT receipt INTO STRICT existing FROM stock_membership_private.operator_closure_receipts WHERE id=p_invite;
  RETURN existing=p_receipt;
END $fn$;
REVOKE ALL ON FUNCTION public.core_stock_operator_closure_pending(),public.core_stock_operator_closure_delivery(uuid),
  public.core_stock_operator_closure_ack(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_operator_closure_pending(),public.core_stock_operator_closure_delivery(uuid),
  public.core_stock_operator_closure_ack(uuid,jsonb) TO service_role;
COMMIT;
