-- PROPOSED READ-ONLY ACCESS. Core hxhusfkrlafxdnyasmsu only.
-- Requires explicit Owner approval. No writes, sends, credentials, tokens,
-- sessions, raw logs, profile contents or other users. Exactly two fixture
-- status aggregates and owner-FK schema metadata for the two new billing tables.
WITH fixtures(label, email_sha256) AS (
  VALUES
    ('Basic', '80054671e626cb4ada79324f6ec1c5667ec5a99981054c38873b553f0efb9e62'),
    ('Pro', 'f89bad06bbc562993eaf322b3cbc001a5ddc8f8851f96207f7fd5439a02302cc')
)
SELECT f.label AS fixture,
       count(u.id)::integer AS auth_records,
       coalesce(bool_and(u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
         AND (u.banned_until IS NULL OR u.banned_until <= statement_timestamp())), false) AS verified_fixture,
       count(p.id)::integer AS legacy_public_profile_records,
       count(i.owner_id)::integer AS saved_package_intents
FROM fixtures f
LEFT JOIN auth.users u ON pg_catalog.encode(pg_catalog.sha256(
  pg_catalog.convert_to(pg_catalog.lower(u.email), 'UTF8')), 'hex') = f.email_sha256
LEFT JOIN public.users p ON p.id = u.id
LEFT JOIN stock_billing_private.intents i ON i.owner_id = u.id
GROUP BY f.label
ORDER BY f.label;

SELECT c.conrelid::regclass::text AS table_name,
       c.conname AS constraint_name,
       pg_catalog.pg_get_constraintdef(c.oid) AS definition,
       c.convalidated AS validated
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND c.conrelid IN ('stock_billing_private.intents'::regclass,
                    'stock_billing_private.accounts'::regclass)
  AND a.attname = 'owner_id'
ORDER BY table_name, constraint_name;
