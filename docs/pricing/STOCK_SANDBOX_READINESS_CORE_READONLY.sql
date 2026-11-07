-- PROPOSED READ-ONLY ACCESS: Core hxhusfkrlafxdnyasmsu only.
-- Requires Owner approval before execution. No DDL, DML, payment or enablement.
-- Reads only the named billing-mode setting, new feature settings, the two
-- approved public offers and the exact Pro fixture's server-created mapping.
-- No passwords, keys, tokens, sessions, raw logs or unrelated customer rows.

SELECT count(*) AS matching_settings,
       coalesce(bool_and((to_jsonb(s)->>'value') = 'sandbox'), false) AS engine_is_sandbox
FROM public.platform_settings AS s
WHERE s.key = 'midtrans_mode';

SELECT enabled,
       payment_mode = 'sandbox' AS feature_is_sandbox
FROM stock_billing_private.settings
WHERE singleton;

SELECT CASE p.id
         WHEN '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid THEN 'Basic'
         WHEN '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid THEN 'Pro'
       END AS offer,
       stock_billing_private.approved_plan(p.id) AS approved_contract,
       p.is_active,
       p.is_for_sale
FROM public.subscription_plans AS p
WHERE p.id IN ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,
               '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
ORDER BY offer;

-- The Pro Company and reservation below came from the successful native E1
-- workspace form. A hash binds the exact approved Pro email without committing
-- the full inbox address. No email or Auth identifier is returned.
SELECT 'Pro' AS fixture,
       o.company_id,
       o.reservation_id,
       o.core_tenant_id,
       stock_billing_private.current_owner(o.company_id, o.core_subject) AS current_owner,
       (u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
         AND (u.banned_until IS NULL OR u.banned_until <= statement_timestamp())) AS verified_fixture,
       stock_billing_private.paid_creation_allowed(o.core_subject, NULL::uuid) AS no_core_pilot_history,
       EXISTS (SELECT 1 FROM core_e1_resource_private.stock_bindings AS b
               WHERE b.reservation_id = o.reservation_id) AS stock_binding_exists
FROM core_e1_resource_private.origins AS o
JOIN public.companies AS c ON c.id = o.company_id
JOIN auth.users AS u ON u.id = o.core_subject
WHERE o.company_id = 'bab486e5-f50e-45ac-8dca-6ae8488104a0'::uuid
  AND o.reservation_id = '1479f3e8-8e47-4a1e-a465-862260b229cb'::uuid
  AND o.source = 'core.e1.resource.v1'
  AND c.display_name = 'Stock Sandbox Pro 20261102'
  AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.lower(u.email), 'UTF8')), 'hex')
      = 'f89bad06bbc562993eaf322b3cbc001a5ddc8f8851f96207f7fd5439a02302cc';
