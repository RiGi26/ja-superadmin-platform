-- Core hxhusfkrlafxdnyasmsu only. Install reader before its caller.
-- Does not change any payment setting, public offer or issued invoice.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '20s';
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR to_regclass('stock_billing_private.settings') IS NULL
   OR to_regprocedure('public.stock_billing_payment_mode()') IS NOT NULL
 THEN RAISE EXCEPTION 'STOCK_PAYMENT_MODE_BASELINE_DRIFT'; END IF;
END $preflight$;
CREATE FUNCTION public.stock_billing_payment_mode() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'STOCK_PAYMENT_MODE_DENIED'; END IF;
 SELECT payment_mode INTO STRICT result FROM stock_billing_private.settings WHERE singleton AND enabled;
 IF result NOT IN ('sandbox','production') THEN RAISE EXCEPTION 'STOCK_PAYMENT_MODE_DENIED'; END IF;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.stock_billing_payment_mode() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.stock_billing_payment_mode() TO service_role;
COMMIT;
