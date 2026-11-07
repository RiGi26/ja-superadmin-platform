-- Core hxhusfkrlafxdnyasmsu only. Additional Owner approval required.
-- Add covering indexes for the two composite membership foreign keys reported
-- by the post-install advisor. No row, constraint, function, grant or gate changes.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres'
   OR to_regclass('stock_membership_private.memberships') IS NULL
   OR to_regclass('stock_workspace_private.origins') IS NULL
   OR to_regclass('stock_membership_private.stock_member_registry_fk_idx') IS NOT NULL
   OR to_regclass('stock_workspace_private.stock_workspace_registry_fk_idx') IS NOT NULL
   OR (SELECT enabled FROM stock_membership_private.settings WHERE singleton) IS DISTINCT FROM false
   OR (SELECT enabled FROM stock_workspace_private.settings WHERE singleton) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_FK_INDEX_BASELINE_DENIED'; END IF;
 IF (SELECT count(*) FROM pg_constraint c WHERE c.contype='f' AND c.convalidated
   AND c.confrelid='public.company_memberships'::regclass AND c.confdeltype='r'
   AND ((c.conrelid='stock_membership_private.memberships'::regclass
     AND c.conname='memberships_id_company_id_core_subject_fkey'
     AND c.conkey=ARRAY[1,2,3]::smallint[])
   OR (c.conrelid='stock_workspace_private.origins'::regclass
     AND c.conname='origins_membership_id_company_id_core_subject_fkey'
     AND c.conkey=ARRAY[2,1,3]::smallint[])))<>2
 THEN RAISE EXCEPTION 'STOCK_WORKSPACE_FK_INDEX_CONSTRAINT_DRIFT'; END IF;
END $preflight$;
CREATE INDEX stock_member_registry_fk_idx
 ON stock_membership_private.memberships(id,company_id,core_subject);
CREATE INDEX stock_workspace_registry_fk_idx
 ON stock_workspace_private.origins(membership_id,company_id,core_subject);
COMMIT;
