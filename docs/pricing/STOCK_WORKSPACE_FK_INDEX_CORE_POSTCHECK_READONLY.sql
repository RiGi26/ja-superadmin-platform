-- Additional exact Owner approval required. Core hxhusfkrlafxdnyasmsu only.
-- Schema metadata and feature booleans only; no customer or financial rows.
BEGIN READ ONLY;
SELECT c.conname,c.convalidated,
 EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid
   AND i.indisvalid AND i.indisready AND i.indpred IS NULL
   AND (i.indkey::smallint[])[0:cardinality(c.conkey)-1]=c.conkey) AS covering_index
FROM pg_constraint c
WHERE (c.conrelid='stock_membership_private.memberships'::regclass
   AND c.conname='memberships_id_company_id_core_subject_fkey')
 OR (c.conrelid='stock_workspace_private.origins'::regclass
   AND c.conname='origins_membership_id_company_id_core_subject_fkey')
ORDER BY c.conname;
SELECT n.nspname AS schema_name,c.relname AS index_name,i.indisvalid,i.indisready,
 pg_get_indexdef(i.indexrelid) AS definition
FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='stock_membership_private' AND c.relname='stock_member_registry_fk_idx')
 OR (n.nspname='stock_workspace_private' AND c.relname='stock_workspace_registry_fk_idx')
ORDER BY n.nspname,c.relname;
SELECT 'membership' AS feature,enabled FROM stock_membership_private.settings WHERE singleton
UNION ALL SELECT 'workspace',enabled FROM stock_workspace_private.settings WHERE singleton;
COMMIT;
