-- PROPOSED READ-ONLY ACCESS. Core hxhusfkrlafxdnyasmsu only.
-- Exact Owner approval required before execution. Two named test fixtures only.
-- Returns resource IDs and status booleans; no native Auth IDs, emails,
-- passwords, sessions, tokens, audit payloads or unrelated customer records.
WITH fixtures(label, company_id, reservation_id, company_name, email_sha256, plan_id) AS (
  VALUES
    ('Basic', '0c0b5c44-2af7-471e-8685-bd99438db48d'::uuid,
     '80f34350-cf08-41b4-99b9-fa3012dc37ac'::uuid, 'Stock Sandbox Basic 20261102',
     '80054671e626cb4ada79324f6ec1c5667ec5a99981054c38873b553f0efb9e62',
     '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid),
    ('Pro', 'bab486e5-f50e-45ac-8dca-6ae8488104a0'::uuid,
     '1479f3e8-8e47-4a1e-a465-862260b229cb'::uuid, 'Stock Sandbox Pro 20261102',
     'f89bad06bbc562993eaf322b3cbc001a5ddc8f8851f96207f7fd5439a02302cc',
     '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
)
SELECT f.label AS fixture, o.company_id, o.reservation_id, o.core_tenant_id,
       b.stock_tenant_id, b.profile_id,
       stock_billing_private.current_owner(o.company_id, o.core_subject) AS current_owner,
       (u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
         AND (u.banned_until IS NULL OR u.banned_until <= statement_timestamp())) AS verified_fixture,
       stock_billing_private.paid_creation_allowed(o.core_subject, NULL::uuid) AS no_core_pilot_history,
       (i.plan_id = f.plan_id AND i.expires_at > statement_timestamp()) AS current_saved_plan_matches,
       EXISTS (SELECT 1 FROM stock_billing_private.accounts a
         WHERE a.company_id = o.company_id AND a.reservation_id = o.reservation_id) AS billing_account_exists
FROM fixtures f
JOIN core_e1_resource_private.origins o
  ON o.company_id = f.company_id AND o.reservation_id = f.reservation_id
  AND o.source = 'core.e1.resource.v1'
JOIN public.companies c ON c.id = o.company_id AND c.display_name = f.company_name
JOIN auth.users u ON u.id = o.core_subject
  AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.lower(u.email), 'UTF8')), 'hex')
    = f.email_sha256
LEFT JOIN core_e1_resource_private.stock_bindings b ON b.reservation_id = o.reservation_id
LEFT JOIN stock_billing_private.intents i ON i.owner_id = o.core_subject
ORDER BY fixture;
