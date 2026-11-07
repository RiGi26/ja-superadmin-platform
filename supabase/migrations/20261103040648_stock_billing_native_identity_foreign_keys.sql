-- PROPOSED ONLY. Exact-object Owner approval required before managed execution.
-- Core hxhusfkrlafxdnyasmsu only. Correct three new billing identity FKs to native
-- Core Auth identities. No row, permission, function, RLS, price or mode changes.
-- Retain ON DELETE RESTRICT and existing Owner/session/mapping checks.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '20s';
DO $preflight$
DECLARE target record; subject_column smallint; legacy_id smallint;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'STOCK_NATIVE_OWNER_OPERATOR_REQUIRED'; END IF;
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('core_registry_writes', 0))
    THEN RAISE EXCEPTION 'STOCK_NATIVE_OWNER_BUSY'; END IF;
  LOCK TABLE stock_billing_private.intents, stock_billing_private.accounts, stock_billing_private.events IN ACCESS EXCLUSIVE MODE NOWAIT;
  IF NOT EXISTS (SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode = 'sandbox')
    OR (SELECT count(*) FROM public.platform_settings WHERE key = 'midtrans_mode') <> 1
    OR (SELECT to_jsonb(s)->>'value' FROM public.platform_settings s WHERE key = 'midtrans_mode') IS DISTINCT FROM 'sandbox'
    OR EXISTS (SELECT 1 FROM stock_billing_private.accounts)
    OR EXISTS (SELECT 1 FROM stock_billing_private.sandbox_cohort)
    OR (SELECT count(*) FROM public.subscription_plans WHERE id IN
      ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid, '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid)
      AND NOT is_active AND NOT is_for_sale AND stock_billing_private.approved_plan(id)) <> 2
    THEN RAISE EXCEPTION 'STOCK_NATIVE_OWNER_RELEASE_DRIFT'; END IF;
  SELECT attnum INTO STRICT legacy_id FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.users'::regclass AND attname = 'id' AND NOT attisdropped;
  FOR target IN SELECT * FROM (VALUES
    ('stock_billing_private.intents'::regclass, 'intents_owner_id_fkey', 'owner_id'),
    ('stock_billing_private.accounts'::regclass, 'accounts_owner_id_fkey', 'owner_id'),
    ('stock_billing_private.events'::regclass, 'events_actor_id_fkey', 'actor_id')) AS targets(table_id, constraint_name, column_name)
  LOOP
    SELECT attnum INTO STRICT subject_column FROM pg_catalog.pg_attribute
      WHERE attrelid = target.table_id AND attname = target.column_name AND NOT attisdropped;
    IF (SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.conrelid = target.table_id
        AND c.contype = 'f' AND subject_column = ANY(c.conkey)) <> 1
      OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid = target.table_id
        AND c.conname = target.constraint_name AND c.contype = 'f' AND c.convalidated
        AND c.conkey = ARRAY[subject_column] AND c.confkey = ARRAY[legacy_id]
        AND c.confrelid = 'public.users'::regclass AND c.confdeltype = 'r'
        AND c.confupdtype = 'a' AND NOT c.condeferrable)
      OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_index i WHERE i.indrelid = target.table_id
        AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
        AND i.indkey[0] = subject_column)
      THEN RAISE EXCEPTION 'STOCK_NATIVE_OWNER_FK_BASELINE_DRIFT'; END IF;
  END LOOP;
END
$preflight$;

ALTER TABLE stock_billing_private.intents
  DROP CONSTRAINT intents_owner_id_fkey,
  ADD CONSTRAINT intents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE stock_billing_private.accounts
  DROP CONSTRAINT accounts_owner_id_fkey,
  ADD CONSTRAINT accounts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE stock_billing_private.events
  DROP CONSTRAINT events_actor_id_fkey,
  ADD CONSTRAINT events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
COMMIT;
