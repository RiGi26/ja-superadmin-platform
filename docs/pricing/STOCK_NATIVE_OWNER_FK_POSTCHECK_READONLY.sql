-- PROPOSED READ-ONLY POSTCHECK. Core hxhusfkrlafxdnyasmsu only.
-- Requires Owner approval with the exact native-identity FK correction.
-- Schema metadata only; no Auth/customer/billing/audit rows or sensitive logs.
SELECT c.conrelid::regclass::text AS table_name,
       c.conname AS constraint_name,
       pg_catalog.pg_get_constraintdef(c.oid) AS definition,
       c.convalidated AS validated,
       EXISTS (SELECT 1 FROM pg_catalog.pg_index i WHERE i.indrelid = c.conrelid
         AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
         AND i.indkey[0] = c.conkey[1]) AS covering_index
FROM pg_catalog.pg_constraint c
WHERE (c.conrelid, c.conname) IN (
  ('stock_billing_private.intents'::regclass, 'intents_owner_id_fkey'),
  ('stock_billing_private.accounts'::regclass, 'accounts_owner_id_fkey'),
  ('stock_billing_private.events'::regclass, 'events_actor_id_fkey'))
ORDER BY table_name;

SELECT c.oid::regclass::text AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(
         coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) a
         WHERE a.grantee <> c.relowner) AS private_table_grants,
       CASE WHEN c.oid = 'stock_billing_private.events'::regclass THEN
         EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
           WHERE t.tgrelid = c.oid AND t.tgname = 'stock_billing_event_immutable'
             AND t.tgenabled = 'O' AND NOT t.tgisinternal)
       ELSE NULL END AS append_only_event_trigger
FROM pg_catalog.pg_class c
WHERE c.oid IN ('stock_billing_private.intents'::regclass,
               'stock_billing_private.accounts'::regclass,
               'stock_billing_private.events'::regclass)
ORDER BY table_name;
