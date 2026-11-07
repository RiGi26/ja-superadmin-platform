-- Core proposal. Owner-only invitation delivery snapshots and immutable provider acknowledgments.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR to_regclass('stock_membership_private.operator_invitations') IS NULL
   OR to_regclass('stock_membership_private.operator_mail') IS NOT NULL
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_MAIL_BASELINE_DENIED'; END IF;
END $preflight$;
CREATE TABLE stock_membership_private.operator_mail(
 id uuid PRIMARY KEY REFERENCES stock_membership_private.operator_invitations(id) ON DELETE RESTRICT,
 recipient text NOT NULL CHECK(recipient=lower(btrim(recipient)) AND length(recipient) BETWEEN 3 AND 254 AND recipient !~ '[[:cntrl:]]'),
 company_name text NOT NULL,
 prepared_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE stock_membership_private.operator_mail_receipts(
 id uuid PRIMARY KEY REFERENCES stock_membership_private.operator_mail(id) ON DELETE RESTRICT,
 provider_id text NOT NULL UNIQUE CHECK(length(provider_id) BETWEEN 1 AND 100 AND provider_id !~ '[[:cntrl:]]'),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $security$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['operator_mail','operator_mail_receipts'] LOOP
   EXECUTE format('ALTER TABLE stock_membership_private.%I ENABLE ROW LEVEL SECURITY',n);
   EXECUTE format('ALTER TABLE stock_membership_private.%I FORCE ROW LEVEL SECURITY',n);
   EXECUTE format('REVOKE ALL ON TABLE stock_membership_private.%I FROM PUBLIC,anon,authenticated,service_role',n);
   EXECUTE format('CREATE TRIGGER operator_mail_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.%I FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable()',n);
   EXECUTE format('CREATE TRIGGER operator_mail_fence BEFORE INSERT ON stock_membership_private.%I FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.lock_registry()',n);
   EXECUTE format('CREATE TRIGGER operator_mail_audit AFTER INSERT ON stock_membership_private.%I FOR EACH ROW EXECUTE FUNCTION stock_membership_private.audit()',n);
 END LOOP;
END $security$;

CREATE FUNCTION public.core_stock_operator_mail(p_actor uuid,p_session uuid,p_until timestamptz,p_company uuid,
 p_invite uuid,p_email text,p_provider_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='1ms' AS $fn$
DECLARE observed timestamptz; closed text; provider text;
 invitation stock_membership_private.operator_invitations%ROWTYPE;
 snapshot stock_membership_private.operator_mail%ROWTYPE;
BEGIN
 observed:=stock_membership_private.operator_invitation_fence(p_until);
 IF NOT stock_workspace_private.billing_session_live(p_actor,p_session)
   OR NOT stock_billing_private.current_owner(p_company,p_actor)
   OR p_email IS NULL OR p_email<>lower(btrim(p_email)) OR length(p_email) NOT BETWEEN 3 AND 254
   OR p_email ~ '[[:cntrl:]]'
   OR (p_provider_id IS NOT NULL AND (length(p_provider_id) NOT BETWEEN 1 AND 100 OR p_provider_id ~ '[[:cntrl:]]'))
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_MAIL_DENIED'; END IF;
 SELECT * INTO invitation FROM stock_membership_private.operator_invitations WHERE id=p_invite
   AND company_id=p_company AND issuer_id=p_actor AND email_hash=sha256(convert_to(p_email,'UTF8'));
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_OPERATOR_MAIL_DENIED'; END IF;
 SELECT * INTO snapshot FROM stock_membership_private.operator_mail WHERE id=p_invite;
 IF FOUND AND snapshot.recipient<>p_email THEN RAISE EXCEPTION 'STOCK_OPERATOR_MAIL_DENIED'; END IF;
 IF p_provider_id IS NOT NULL THEN
   IF snapshot.id IS NULL THEN RAISE EXCEPTION 'STOCK_OPERATOR_MAIL_DENIED'; END IF;
   INSERT INTO stock_membership_private.operator_mail_receipts(id,provider_id) VALUES(p_invite,p_provider_id)
     ON CONFLICT(id) DO NOTHING;
   SELECT provider_id INTO STRICT provider FROM stock_membership_private.operator_mail_receipts WHERE id=p_invite;
   IF provider<>p_provider_id THEN RAISE EXCEPTION 'STOCK_OPERATOR_MAIL_REPLAY_CONFLICT'; END IF;
 END IF;
 SELECT state INTO closed FROM stock_membership_private.operator_invitation_closures WHERE id=p_invite;
 IF closed IS NULL AND invitation.expires_at<=observed THEN closed:='expired'; END IF;
 IF closed IS NOT NULL THEN
   RETURN jsonb_build_object('status',closed,'inviteId',p_invite,'companyId',p_company);
 END IF;
 IF coalesce(stock_membership_private.operator_seats_remaining(p_company,invitation.instance_id,observed),-1)<0
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_MAIL_DENIED'; END IF;
 IF snapshot.id IS NULL THEN
   INSERT INTO stock_membership_private.operator_mail(id,recipient,company_name)
   SELECT p_invite,p_email,display_name FROM public.companies WHERE id=p_company RETURNING * INTO snapshot;
 END IF;
 IF provider IS NULL THEN SELECT provider_id INTO provider FROM stock_membership_private.operator_mail_receipts WHERE id=p_invite; END IF;
 IF p_until<=clock_timestamp() OR NOT stock_workspace_private.billing_session_live(p_actor,p_session)
 THEN RAISE EXCEPTION 'STOCK_OPERATOR_MAIL_DENIED'; END IF;
 RETURN jsonb_build_object('status',CASE WHEN provider IS NULL THEN 'ready' ELSE 'sent' END,
   'inviteId',p_invite,'companyId',p_company,'recipient',snapshot.recipient,'companyName',snapshot.company_name,
   'role',invitation.role,'expiresAt',invitation.expires_at);
END $fn$;

CREATE FUNCTION public.core_stock_operator_owner_view(p_company uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR NOT public.core_registry_session_is_live()
   OR NOT stock_billing_private.current_owner(p_company,auth.uid())
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.operator_invitation_settings WHERE singleton AND enabled)
   OR NOT EXISTS(SELECT 1 FROM stock_membership_private.settings WHERE singleton AND enabled)
 THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('companyId',r.company_id,'instanceId',r.instance_id,'companyName',c.display_name,
   'availableSeats',greatest(0,stock_membership_private.operator_seats_remaining(r.company_id,r.instance_id,clock_timestamp())),
   'canInvite',coalesce(stock_membership_private.operator_seats_remaining(r.company_id,r.instance_id,clock_timestamp())>0,false),
   'invitations',(SELECT coalesce(jsonb_agg(row.value ORDER BY row.issued_at DESC),'[]'::jsonb) FROM (
     SELECT i.issued_at,jsonb_build_object('inviteId',i.id,'commandId',i.command_id,'role',i.role,'expiresAt',i.expires_at,
       'email',mail.recipient,'state',coalesce(terminal.state,CASE WHEN i.expires_at<=clock_timestamp() THEN 'expired'
         WHEN claim.id IS NOT NULL THEN 'claimed' ELSE 'reserved' END),
       'sent',receipt.id IS NOT NULL) AS value
     FROM stock_membership_private.operator_invitations i
     LEFT JOIN stock_membership_private.operator_mail mail ON mail.id=i.id
     LEFT JOIN stock_membership_private.operator_mail_receipts receipt ON receipt.id=i.id
     LEFT JOIN stock_membership_private.operator_invitation_closures terminal ON terminal.id=i.id
     LEFT JOIN stock_membership_private.operator_invitation_claims claim ON claim.id=i.id
     WHERE i.company_id=r.company_id AND i.issuer_id=auth.uid() ORDER BY i.issued_at DESC LIMIT 20
   ) row))
 INTO result FROM stock_membership_private.resources r JOIN public.companies c ON c.id=r.company_id
 WHERE r.company_id=p_company AND r.revoked_at IS NULL;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.core_stock_operator_mail(uuid,uuid,timestamptz,uuid,uuid,text,text),
 public.core_stock_operator_owner_view(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_operator_mail(uuid,uuid,timestamptz,uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.core_stock_operator_owner_view(uuid) TO authenticated;
COMMIT;
