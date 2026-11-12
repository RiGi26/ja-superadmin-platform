-- PROPOSED ONLY. Additional exact Production/financial authority required.
-- New immutable continuation ledger; original cohort rows remain retired.
-- Only S2/S3, one fresh six-hour window, no S1 repurchase or real charge.
-- Core hxhusfkrlafxdnyasmsu only. No public sales or existing-row reenablement.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $gate_c$
DECLARE expected jsonb := $fixtures$[{"label":"fresh_pro","company_id":"d713ddba-3568-477b-af22-7dec7d7ec740","instance_id":"cf6437d2-b6c2-4973-8ea7-ae69333883b1","core_subject":"36191ebc-3a6e-4d8c-b8e4-abb62e33b965","stock_subject":"c22a4ea5-3679-4cc6-a583-f8012bd471bc","core_tenant_id":"4613d510-58b2-4c76-b2bb-3860e7918765","stock_tenant_id":"add9ddac-4cc8-4c83-9be1-020c6f96f70b","membership_id":"1570435d-5e8a-42d6-955d-5a1aab8e50d7","profile_id":"1a694c28-d7ee-4ebc-a3f2-31f6da20b129","command_id":"9ca176ce-0639-46a0-934b-3e31afa511d4","plan_id":"5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002","receipt":{"role":"admin","status":"prepared","version":2,"bindingId":"cf6437d2-b6c2-4973-8ea7-ae69333883b1","commandId":"9ca176ce-0639-46a0-934b-3e31afa511d4","companyId":"d713ddba-3568-477b-af22-7dec7d7ec740","profileId":"1a694c28-d7ee-4ebc-a3f2-31f6da20b129","instanceId":"cf6437d2-b6c2-4973-8ea7-ae69333883b1","companyName":"Stock Fresh Pro 20261105","coreSubject":"36191ebc-3a6e-4d8c-b8e4-abb62e33b965","coreTenantId":"4613d510-58b2-4c76-b2bb-3860e7918765","stockSubject":"c22a4ea5-3679-4cc6-a583-f8012bd471bc","accessGranted":false,"originVersion":2,"stockTenantId":"add9ddac-4cc8-4c83-9be1-020c6f96f70b","bindingRevision":1,"companyRevision":0,"ownerMembershipId":"1570435d-5e8a-42d6-955d-5a1aab8e50d7","stockAuditEventId":"6d96b11f-ffdf-4da8-bf7a-9a397b175e8d","membershipRevision":1}},{"label":"additional_basic","company_id":"8215b025-e5b6-43d4-b2d1-3a4236178b6c","instance_id":"b326f8c3-8522-47cb-a267-ccd59fad823c","core_subject":"36191ebc-3a6e-4d8c-b8e4-abb62e33b965","stock_subject":"c22a4ea5-3679-4cc6-a583-f8012bd471bc","core_tenant_id":"5d813c3f-e45f-4893-9356-2f3f14566629","stock_tenant_id":"df28ca9c-d65d-4a21-99fb-a8e64514a808","membership_id":"70a36df6-a26a-4bbb-a07a-795a550411a3","profile_id":"d385d443-3423-4c7e-aa97-fc3523e449f4","command_id":"3f315484-2c46-4ae2-a408-3a231facbce8","plan_id":"5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001","receipt":{"role":"admin","status":"prepared","version":2,"bindingId":"b326f8c3-8522-47cb-a267-ccd59fad823c","commandId":"3f315484-2c46-4ae2-a408-3a231facbce8","companyId":"8215b025-e5b6-43d4-b2d1-3a4236178b6c","profileId":"d385d443-3423-4c7e-aa97-fc3523e449f4","instanceId":"b326f8c3-8522-47cb-a267-ccd59fad823c","companyName":"Stock Fresh Pro Second Basic 20261105","coreSubject":"36191ebc-3a6e-4d8c-b8e4-abb62e33b965","coreTenantId":"5d813c3f-e45f-4893-9356-2f3f14566629","stockSubject":"c22a4ea5-3679-4cc6-a583-f8012bd471bc","accessGranted":false,"originVersion":2,"stockTenantId":"df28ca9c-d65d-4a21-99fb-a8e64514a808","bindingRevision":1,"companyRevision":0,"ownerMembershipId":"70a36df6-a26a-4bbb-a07a-795a550411a3","stockAuditEventId":"013e8a81-761b-441e-8298-3d78404403e0","membershipRevision":1}}]$fixtures$::jsonb;
  matches integer; inserted integer; cohort_start timestamptz := statement_timestamp();
BEGIN
 IF current_user<>'postgres' OR NOT pg_try_advisory_xact_lock(hashtextextended('core_registry_writes',0))
 THEN RAISE EXCEPTION 'STOCK_GATE_C_OPERATOR_OR_BUSY'; END IF;
 LOCK TABLE stock_billing_private.sandbox_cohort IN SHARE ROW EXCLUSIVE MODE NOWAIT;
 IF (SELECT count(*) FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode='sandbox')<>1
   OR (SELECT count(*) FROM public.platform_settings s WHERE key='midtrans_mode' AND (to_jsonb(s)->>'value')='sandbox')<>1
   OR (SELECT count(*) FROM stock_membership_private.settings WHERE singleton AND enabled)<>1
   OR (SELECT count(*) FROM stock_membership_private.preparation_settings WHERE singleton AND enabled)<>1
   OR (SELECT count(*) FROM stock_workspace_private.settings WHERE singleton AND enabled)<>1
   OR (SELECT count(*) FROM public.subscription_plans WHERE id IN
      ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,'5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
      AND NOT is_active AND NOT is_for_sale AND stock_billing_private.approved_plan(id))<>2
   OR EXISTS(SELECT 1 FROM stock_billing_private.sandbox_cohort WHERE enabled)
   OR to_regclass('stock_billing_private.sandbox_continuations_20261107') IS NOT NULL
   OR md5((SELECT prosrc FROM pg_proc WHERE oid='public.stock_billing_sandbox_allowed(uuid,uuid)'::regprocedure))
      IS DISTINCT FROM 'e7095c31c69dbf43df920cda2aae4e3c'
   OR (SELECT count(*) FROM stock_billing_private.sandbox_cohort WHERE NOT enabled AND company_id IN
     ('0c0b5c44-2af7-471e-8685-bd99438db48d'::uuid,'d713ddba-3568-477b-af22-7dec7d7ec740'::uuid,'8215b025-e5b6-43d4-b2d1-3a4236178b6c'::uuid)
     AND created_at='2026-11-06T23:28:19.120524+00:00'::timestamptz
     AND valid_until='2026-11-07T05:28:19.120524+00:00'::timestamptz)<>3
   OR NOT EXISTS(SELECT 1 FROM public.subscription_invoices i
     JOIN public.tenant_subscriptions s ON s.id=i.subscription_id AND s.tenant_id=i.tenant_id
       AND s.plan_id=i.plan_id AND s.status='active' AND s.current_period_end>clock_timestamp()
     JOIN stock_billing_private.deliveries d ON d.invoice_id=i.id AND d.tenant_id=i.tenant_id
       AND d.delivery_id='b9c84a4d-9818-4b19-b933-75480766880e'::uuid AND d.state='active' AND d.expires_at=s.current_period_end
     WHERE i.id='6ccbb714-3491-4b1f-b9cf-9410e7ba4f6f'::uuid
       AND i.tenant_id='55f50424-6663-440f-8001-0e77af2b1d35'::uuid
       AND i.plan_id='5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid
       AND i.period='monthly' AND i.amount=149000 AND i.midtrans_mode='sandbox' AND i.status='paid')
 THEN RAISE EXCEPTION 'STOCK_GATE_C_SANDBOX_BASELINE_DENIED'; END IF;
 SELECT count(*) INTO matches FROM jsonb_to_recordset(expected) AS e(label text,company_id uuid,instance_id uuid,core_subject uuid,stock_subject uuid,core_tenant_id uuid,stock_tenant_id uuid,membership_id uuid,profile_id uuid,command_id uuid,plan_id uuid,receipt jsonb)
 JOIN stock_workspace_private.billing_origins o ON o.company_id=e.company_id AND o.reservation_id=e.instance_id
   AND o.core_subject=e.core_subject AND o.core_tenant_id=e.core_tenant_id
 JOIN stock_workspace_private.billing_bindings b ON b.reservation_id=e.instance_id
   AND b.stock_subject=e.stock_subject AND b.stock_tenant_id=e.stock_tenant_id AND b.profile_id=e.profile_id
 JOIN stock_membership_private.prepared_owners p ON p.company_id=e.company_id
   AND p.core_subject=e.core_subject AND p.command_id=e.command_id AND p.result=e.receipt
 JOIN stock_membership_private.preparation_confirmations c ON c.company_id=e.company_id AND c.command_id=e.command_id
 JOIN stock_membership_private.memberships mm ON mm.id=e.membership_id AND mm.company_id=e.company_id
   AND mm.core_subject=e.core_subject AND mm.stock_subject=e.stock_subject AND mm.profile_id=e.profile_id
   AND mm.role='admin' AND mm.revision=1 AND mm.revoked_at IS NULL
 JOIN stock_billing_private.workspace_intents i ON i.owner_id=e.core_subject AND i.company_id=e.company_id
   AND i.command_id=e.command_id AND i.plan_id=e.plan_id AND i.expires_at>clock_timestamp()
 JOIN stock_billing_private.accounts a ON a.company_id=e.company_id AND a.reservation_id=e.instance_id
   AND a.tenant_id=e.core_tenant_id AND a.owner_id=e.core_subject
 WHERE stock_billing_private.current_owner(e.company_id,e.core_subject)
   AND stock_billing_private.paid_creation_allowed(e.core_subject,e.stock_subject)
   AND EXISTS(SELECT 1 FROM stock_billing_private.sandbox_cohort sc WHERE sc.company_id=e.company_id AND NOT sc.enabled)
   AND NOT EXISTS(SELECT 1 FROM public.subscription_invoices si WHERE si.tenant_id=e.core_tenant_id)
   AND NOT EXISTS(SELECT 1 FROM public.tenant_subscriptions ts WHERE ts.tenant_id=e.core_tenant_id);
 IF matches<>2 OR jsonb_array_length(expected)<>2 THEN RAISE EXCEPTION 'STOCK_GATE_C_SCOPED_PREPARATIONS_REQUIRED'; END IF;
 CREATE TABLE stock_billing_private.sandbox_continuations_20261107 (
   company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE RESTRICT,
   plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
   enabled boolean NOT NULL DEFAULT false,
   created_at timestamptz NOT NULL,
   valid_until timestamptz NOT NULL,
   approval_ref text NOT NULL CHECK(approval_ref='STOCK-GATE-C-RESUME-20261107'),
   CHECK(valid_until>created_at AND valid_until<=created_at+interval '6 hours'),
   CHECK((company_id='d713ddba-3568-477b-af22-7dec7d7ec740'::uuid AND plan_id='5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
     OR (company_id='8215b025-e5b6-43d4-b2d1-3a4236178b6c'::uuid AND plan_id='5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid))
 );
 CREATE INDEX stock_sandbox_continuation_plan_idx ON stock_billing_private.sandbox_continuations_20261107(plan_id);
 ALTER TABLE stock_billing_private.sandbox_continuations_20261107 ENABLE ROW LEVEL SECURITY;
 ALTER TABLE stock_billing_private.sandbox_continuations_20261107 FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON TABLE stock_billing_private.sandbox_continuations_20261107 FROM PUBLIC,anon,authenticated,service_role;
 CREATE TRIGGER stock_sandbox_continuation_no_delete BEFORE DELETE OR TRUNCATE ON stock_billing_private.sandbox_continuations_20261107
   FOR EACH STATEMENT EXECUTE FUNCTION stock_billing_private.immutable();
 CREATE TRIGGER stock_sandbox_continuation_retirement BEFORE UPDATE ON stock_billing_private.sandbox_continuations_20261107
   FOR EACH ROW EXECUTE FUNCTION stock_billing_private.guard_cohort();
 INSERT INTO stock_billing_private.sandbox_continuations_20261107(company_id,plan_id,enabled,created_at,valid_until,approval_ref)
 SELECT e.company_id,e.plan_id,true,cohort_start,cohort_start+interval '6 hours','STOCK-GATE-C-RESUME-20261107'
 FROM jsonb_to_recordset(expected) AS e(company_id uuid,plan_id uuid);
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted<>2 THEN RAISE EXCEPTION 'STOCK_GATE_C_CONTINUATION_MISMATCH'; END IF;
END $gate_c$;

CREATE OR REPLACE FUNCTION public.stock_billing_sandbox_allowed(p_tenant uuid,p_plan uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT auth.role()='service_role' AND stock_billing_private.approved_plan(p_plan)
   AND EXISTS(SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode='sandbox')
   AND EXISTS(SELECT 1 FROM (
     SELECT company_id,valid_until FROM stock_billing_private.sandbox_cohort WHERE enabled
     UNION ALL
     SELECT company_id,valid_until FROM stock_billing_private.sandbox_continuations_20261107 WHERE enabled AND plan_id=p_plan
   ) c
     JOIN stock_workspace_private.billing_origins o ON o.company_id=c.company_id AND o.core_tenant_id=p_tenant
     JOIN stock_workspace_private.billing_bindings b ON b.reservation_id=o.reservation_id
     WHERE c.valid_until>clock_timestamp() AND stock_billing_private.current_owner(o.company_id,o.core_subject))
$fn$;
COMMIT;
