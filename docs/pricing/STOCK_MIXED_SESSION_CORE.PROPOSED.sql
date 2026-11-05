-- Preserve independent v1 and v2 workspace sessions without migrating either origin.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $baseline$
DECLARE owner_sql text; paid_sql text; enroll_sql text; prior_owner text; prior_paid text; prior_enroll text;
BEGIN
  IF current_user <> 'postgres'
    OR to_regclass('stock_billing_private.active_sessions') IS NULL
    OR to_regclass('stock_membership_private.sessions') IS NULL
    OR to_regclass('stock_membership_private.session_versions') IS NOT NULL
    OR to_regprocedure('stock_membership_private.guard_session_version()') IS NOT NULL
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure(
      'public.stock_billing_active_enroll(uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,timestamptz)'))
      IS DISTINCT FROM 'ed9ef0ae53ff8b9e3ec63c0e008d7853'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('stock_billing_private.current_owner(uuid,uuid)'))
      IS DISTINCT FROM 'fa29cf2605f081d9a20c2493ba481c02'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('stock_billing_private.current_paid_authority(uuid,uuid,uuid)'))
      IS DISTINCT FROM '2fdaf4d77d005dc5303803c5c7a7eb6c'
    OR EXISTS(SELECT 1 FROM stock_billing_private.active_sessions legacy
      JOIN stock_membership_private.sessions selected USING(stock_session))
  THEN RAISE EXCEPTION 'STOCK_MIXED_CORE_BASELINE_DENIED'; END IF;

  -- A v2 membership with exact workspace provenance is independent of the v1
  -- legacy-ownership count. Other historical associations still restrict v1.
  prior_owner:=pg_get_functiondef('stock_billing_private.current_owner(uuid,uuid)'::regprocedure);
  owner_sql:=replace(prior_owner,
    '(SELECT count(*) FROM public.company_memberships WHERE core_auth_user_id=p_actor)=1',
    $owner$(SELECT count(*) FROM public.company_memberships other
       WHERE other.core_auth_user_id=p_actor
         AND NOT EXISTS(SELECT 1 FROM stock_workspace_private.origins born
           WHERE born.company_id=other.company_id AND (born.membership_id=other.id AND born.core_subject=p_actor
             OR EXISTS(SELECT 1 FROM stock_membership_private.memberships member
               JOIN stock_membership_private.resources resource ON resource.company_id=member.company_id
                 AND resource.instance_id=born.reservation_id AND resource.core_tenant_id=born.core_tenant_id
               WHERE member.id=other.id AND member.company_id=other.company_id AND member.core_subject=p_actor))))=1$owner$);
  IF owner_sql=prior_owner THEN RAISE EXCEPTION 'STOCK_MIXED_CORE_BASELINE_DENIED'; END IF;
  EXECUTE owner_sql;

  -- The old engine may only authorize its retained legacy origin and binding.
  prior_paid:=pg_get_functiondef('stock_billing_private.current_paid_authority(uuid,uuid,uuid)'::regprocedure);
  paid_sql:=replace(prior_paid,'SELECT * INTO STRICT a FROM stock_billing_private.accounts WHERE owner_id=p_core;',
    $paid$SELECT account.* INTO STRICT a FROM stock_billing_private.accounts account
      JOIN core_e1_resource_private.origins origin ON origin.company_id=account.company_id
        AND origin.reservation_id=account.reservation_id AND origin.core_tenant_id=account.tenant_id
        AND origin.core_subject=account.owner_id
      JOIN core_e1_resource_private.stock_bindings binding ON binding.reservation_id=origin.reservation_id
        AND binding.stock_subject=p_stock
      WHERE account.owner_id=p_core
        AND NOT EXISTS(SELECT 1 FROM stock_workspace_private.origins born
          WHERE born.company_id=origin.company_id OR born.reservation_id=origin.reservation_id
            OR born.core_tenant_id=origin.core_tenant_id OR born.stock_tenant_id=binding.stock_tenant_id
            OR born.profile_id=binding.profile_id)
        AND NOT EXISTS(SELECT 1 FROM stock_membership_private.resources resource
          WHERE resource.company_id=origin.company_id OR resource.instance_id=origin.reservation_id
            OR resource.stock_tenant_id=binding.stock_tenant_id OR resource.core_tenant_id=origin.core_tenant_id)
        AND NOT EXISTS(SELECT 1 FROM stock_membership_private.identity_pairs pair
          WHERE (pair.core_subject=p_core OR pair.stock_subject=p_stock)
            AND (pair.core_subject<>p_core OR pair.stock_subject<>p_stock OR pair.revoked_at IS NOT NULL));$paid$);
  IF paid_sql=prior_paid THEN RAISE EXCEPTION 'STOCK_MIXED_CORE_BASELINE_DENIED'; END IF;
  EXECUTE paid_sql;

  prior_enroll:=pg_get_functiondef('public.stock_billing_active_enroll(uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,timestamptz)'::regprocedure);
  enroll_sql:=replace(prior_enroll,'OR (p_company IS NULL)<>(p_instance IS NULL)',
    $enroll$OR (p_company IS NULL)<>(p_instance IS NULL)
   OR (p_company IS NULL AND EXISTS(SELECT 1 FROM stock_membership_private.identity_pairs pair
       WHERE pair.core_subject=p_core_subject OR pair.stock_subject=p_stock_subject))$enroll$);
  IF enroll_sql=prior_enroll THEN RAISE EXCEPTION 'STOCK_MIXED_CORE_BASELINE_DENIED'; END IF;
  EXECUTE enroll_sql;
END $baseline$;

CREATE TABLE stock_membership_private.session_versions(
  stock_session uuid PRIMARY KEY,
  version integer NOT NULL CHECK(version IN (1,2))
);
INSERT INTO stock_membership_private.session_versions
  SELECT stock_session,1 FROM stock_billing_private.active_sessions
  UNION ALL SELECT stock_session,2 FROM stock_membership_private.sessions;
ALTER TABLE stock_membership_private.session_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_membership_private.session_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE stock_membership_private.session_versions FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER stock_session_version_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON stock_membership_private.session_versions
  FOR EACH STATEMENT EXECUTE FUNCTION stock_membership_private.immutable();

CREATE FUNCTION stock_membership_private.guard_session_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE expected integer:=CASE WHEN TG_TABLE_SCHEMA='stock_billing_private' THEN 1 ELSE 2 END;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('stock_native_session_version:'||NEW.stock_session::text,0))
  THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='STOCK_SESSION_VERSION_BUSY'; END IF;
  INSERT INTO stock_membership_private.session_versions VALUES(NEW.stock_session,expected) ON CONFLICT DO NOTHING;
  IF (SELECT version FROM stock_membership_private.session_versions WHERE stock_session=NEW.stock_session) IS DISTINCT FROM expected
  THEN RAISE EXCEPTION 'STOCK_SESSION_VERSION_CONFLICT'; END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER stock_paid_session_version BEFORE INSERT ON stock_billing_private.active_sessions
  FOR EACH ROW EXECUTE FUNCTION stock_membership_private.guard_session_version();
CREATE TRIGGER stock_selected_session_version BEFORE INSERT ON stock_membership_private.sessions
  FOR EACH ROW EXECUTE FUNCTION stock_membership_private.guard_session_version();
REVOKE ALL ON FUNCTION stock_membership_private.guard_session_version() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
