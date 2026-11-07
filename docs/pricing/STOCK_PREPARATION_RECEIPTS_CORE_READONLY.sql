-- PROPOSED READ-ONLY; NOT AUTHORIZED OR EXECUTED. Core hxhusfkrlafxdnyasmsu only.
-- Exactly five frozen fixture tuples. No passwords, tokens, sessions, invitation
-- capabilities, invoices, payment payloads or unrestricted audit data.
-- Privileged receipt metadata is not authenticated customer/RLS evidence.
BEGIN READ ONLY;
WITH allowed(label,company_id,instance_id,core_subject,stock_subject,core_tenant_id,stock_tenant_id,membership_id,profile_id,origin_version) AS (VALUES
    ('existing_basic','0c0b5c44-2af7-471e-8685-bd99438db48d'::uuid,'80f34350-cf08-41b4-99b9-fa3012dc37ac'::uuid,'fdbcf474-722b-4f5b-a3e7-23086e3f490d'::uuid,'26e9a59b-dd0d-47da-bc0b-dad349dc206f'::uuid,'55f50424-6663-440f-8001-0e77af2b1d35'::uuid,'900376ee-8003-4c20-807e-e4ff50f2be06'::uuid,'1af51693-caf9-401b-b942-4734dc7bd0a3'::uuid,'94387c2e-3491-4254-9392-6010eddcbb8b'::uuid,1),
    ('existing_pro','bab486e5-f50e-45ac-8dca-6ae8488104a0'::uuid,'1479f3e8-8e47-4a1e-a465-862260b229cb'::uuid,'3f8c7096-db2e-4e9c-af69-05902358b8c0'::uuid,'8cc47e5f-82b9-4fa0-a125-a4fefea9da13'::uuid,'871aadb3-b581-456b-a2f5-076f90d16564'::uuid,'0b740b9d-9a8d-4493-90f4-fddafe9c6fad'::uuid,'8777ce56-6bcb-4cfa-b8d6-1f1da55fbbff'::uuid,'8022b87c-6e70-42bf-b3e0-a2658720229a'::uuid,1),
    ('fresh_basic','d2c2f26b-9740-4f05-b775-b814563bfd79'::uuid,'6deede3f-a3cf-4d6d-815c-130e80c25f10'::uuid,'8a0a703c-63d7-44d7-b8fd-d76a129349d1'::uuid,'cecba884-f703-467a-8f44-3b932ba3a833'::uuid,'cdf19ca9-f529-4bd2-a3f8-d75b53671a8f'::uuid,'f358b30d-3141-401c-99cf-63421126ef29'::uuid,'7f75d067-a713-4937-973e-6481efbfbdde'::uuid,'bf3169ed-5e2a-4eb4-a98d-69ac0e8de259'::uuid,2),
    ('fresh_pro','d713ddba-3568-477b-af22-7dec7d7ec740'::uuid,'cf6437d2-b6c2-4973-8ea7-ae69333883b1'::uuid,'36191ebc-3a6e-4d8c-b8e4-abb62e33b965'::uuid,'c22a4ea5-3679-4cc6-a583-f8012bd471bc'::uuid,'4613d510-58b2-4c76-b2bb-3860e7918765'::uuid,'add9ddac-4cc8-4c83-9be1-020c6f96f70b'::uuid,'1570435d-5e8a-42d6-955d-5a1aab8e50d7'::uuid,'1a694c28-d7ee-4ebc-a3f2-31f6da20b129'::uuid,2),
    ('additional_basic','8215b025-e5b6-43d4-b2d1-3a4236178b6c'::uuid,'b326f8c3-8522-47cb-a267-ccd59fad823c'::uuid,'36191ebc-3a6e-4d8c-b8e4-abb62e33b965'::uuid,'c22a4ea5-3679-4cc6-a583-f8012bd471bc'::uuid,'5d813c3f-e45f-4893-9356-2f3f14566629'::uuid,'df28ca9c-d65d-4a21-99fb-a8e64514a808'::uuid,'70a36df6-a26a-4bbb-a07a-795a550411a3'::uuid,'d385d443-3423-4c7e-aa97-fc3523e449f4'::uuid,2)
),
scoped AS (
  SELECT a.*,p.command_id,p.result,
    i.plan_id AS saved_plan_id,
    EXISTS(SELECT 1 FROM stock_membership_private.preparation_confirmations c
      WHERE c.company_id=a.company_id AND c.command_id=p.command_id) AS reciprocal_confirmed,
    EXISTS(SELECT 1 FROM stock_membership_private.memberships m
      WHERE m.id=a.membership_id AND m.company_id=a.company_id AND m.core_subject=a.core_subject
        AND m.stock_subject=a.stock_subject AND m.profile_id=a.profile_id AND m.role='admin'
        AND m.revision=1 AND m.revoked_at IS NULL) AS current_membership_matches
  FROM allowed a
  LEFT JOIN stock_membership_private.prepared_owners p ON p.company_id=a.company_id AND p.core_subject=a.core_subject
  LEFT JOIN stock_billing_private.workspace_intents i ON i.company_id=a.company_id
    AND i.owner_id=a.core_subject AND i.command_id=p.command_id
), checked AS (
  SELECT *,coalesce(jsonb_typeof(result)='object'
      AND result-ARRAY['version','status','commandId','companyId','instanceId','coreTenantId','stockTenantId','coreSubject','stockSubject','ownerMembershipId','profileId','bindingId','bindingRevision','companyRevision','membershipRevision','role','accessGranted','originVersion','companyName','stockAuditEventId']::text[]='{}'::jsonb
      AND result->>'status'='prepared' AND result->>'version'='2'
      AND result->>'role'='admin' AND result->'accessGranted'='false'::jsonb
      AND result->>'commandId'=command_id::text
      AND result->>'companyId'=company_id::text AND result->>'instanceId'=instance_id::text
      AND result->>'coreSubject'=core_subject::text AND result->>'stockSubject'=stock_subject::text
      AND result->>'coreTenantId'=core_tenant_id::text AND result->>'stockTenantId'=stock_tenant_id::text
      AND result->>'ownerMembershipId'=membership_id::text AND result->>'profileId'=profile_id::text
      AND CASE WHEN origin_version=1 THEN NOT(result?'originVersion') ELSE result->>'originVersion'='2' END,false) AS receipt_matches
  FROM scoped
)
SELECT label,company_id,instance_id,origin_version,receipt_matches,current_membership_matches,
  reciprocal_confirmed,
  CASE WHEN receipt_matches THEN command_id END AS preparation_command_id,
  CASE WHEN receipt_matches THEN saved_plan_id END AS saved_plan_id,
  CASE WHEN receipt_matches THEN result END AS preparation_receipt
FROM checked ORDER BY label;
COMMIT;
