-- PROPOSED READ-ONLY: exact Gate B fixtures only; separate Owner authority required.
-- Native subject IDs and resource selectors only. No raw email, passwords,
-- tokens, sessions, invitation secrets, payment payloads or audit payloads.
BEGIN READ ONLY;
WITH allowed(label,email_sha256) AS (VALUES
    ('existing_basic', '80054671e626cb4ada79324f6ec1c5667ec5a99981054c38873b553f0efb9e62'),
    ('existing_pro', 'f89bad06bbc562993eaf322b3cbc001a5ddc8f8851f96207f7fd5439a02302cc'),
    ('fresh_basic', '55230f2e25367cef3445f6949d6ea8f34c24b5e1d7b03f15de7e7c2140c8172d'),
    ('fresh_pro', '2d850799d13da45446aaa14f23d12c2f04077c87ea3dc36907ca62dd31d3e40f')
)
SELECT a.label,u.id AS core_subject,
       (u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
         AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())) AS verified
FROM allowed a JOIN auth.users u
  ON encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')=a.email_sha256
ORDER BY a.label;
SELECT o.company_id,o.reservation_id,o.core_subject,o.membership_id,
       o.core_tenant_id,o.stock_tenant_id,o.profile_id,o.command_id
FROM stock_workspace_private.origins o
JOIN auth.users u ON u.id=o.core_subject
JOIN public.companies c ON c.id=o.company_id
WHERE encode(sha256(convert_to(lower(u.email),'UTF8')),'hex') IN ('55230f2e25367cef3445f6949d6ea8f34c24b5e1d7b03f15de7e7c2140c8172d','2d850799d13da45446aaa14f23d12c2f04077c87ea3dc36907ca62dd31d3e40f')
  AND c.display_name IN ('Stock Fresh Basic 20261105','Stock Fresh Pro 20261105','Stock Fresh Pro Second Basic 20261105')
ORDER BY o.company_id;
SELECT o.company_id,o.reservation_id,o.core_subject,o.membership_id,o.core_tenant_id
FROM core_e1_resource_private.origins o
WHERE (o.company_id,o.reservation_id) IN (
  ('0c0b5c44-2af7-471e-8685-bd99438db48d'::uuid,'80f34350-cf08-41b4-99b9-fa3012dc37ac'::uuid),
  ('bab486e5-f50e-45ac-8dca-6ae8488104a0'::uuid,'1479f3e8-8e47-4a1e-a465-862260b229cb'::uuid))
ORDER BY o.company_id;
COMMIT;
