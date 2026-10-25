-- Proposal only. Exact target: Core DEV mcvekinhgcqygfddyifs.
-- Requires separate Owner approval before one provider execution.
-- Catalog metadata only: no customer/Auth/settings-value/ledger rows or DDL.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';

SELECT pg_catalog.jsonb_build_object(
  'policy_roles', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema', n.nspname, 'table', c.relname, 'policy', p.polname,
      'roles', (SELECT pg_catalog.jsonb_agg(CASE WHEN role_id = 0 THEN 'PUBLIC' ELSE r.rolname END ORDER BY ordinal)
        FROM pg_catalog.unnest(p.polroles) WITH ORDINALITY AS policy_roles(role_id, ordinal)
        LEFT JOIN pg_catalog.pg_roles r ON r.oid = role_id)
    ) ORDER BY n.nspname, c.relname, p.polname)
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('companies', 'company_memberships', 'company_portal_instances')
  ), '[]'::jsonb),
  'e1_schemas', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', n.nspname, 'owner', pg_catalog.pg_get_userbyid(n.nspowner)
    ) ORDER BY n.nspname)
    FROM pg_catalog.pg_namespace n
    WHERE n.nspname IN ('core_e1_resource_private', 'core_e1_stock_private')
  ), '[]'::jsonb),
  'e1_public_functions', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', p.proname, 'signature', pg_catalog.pg_get_function_identity_arguments(p.oid),
      'owner', pg_catalog.pg_get_userbyid(p.proowner),
      'definition_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(p.oid), 'UTF8')), 'hex')
    ) ORDER BY p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid))
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.proname IN ('core_registry_e1_stock_create', 'core_registry_e1_stock_context',
        'core_registry_e1_stock_bind_stage', 'core_registry_e1_stock_command')
  ), '[]'::jsonb),
  'event_triggers', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', e.evtname, 'event', e.evtevent, 'enabled', e.evtenabled,
      'owner', pg_catalog.pg_get_userbyid(e.evtowner), 'tags', e.evttags,
      'function_schema', n.nspname, 'function_name', p.proname,
      'function_owner', pg_catalog.pg_get_userbyid(p.proowner),
      'function_security_definer', p.prosecdef, 'function_config', p.proconfig,
      'function_definition_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(p.oid), 'UTF8')), 'hex')
    ) ORDER BY e.evtname)
    FROM pg_catalog.pg_event_trigger e
    JOIN pg_catalog.pg_proc p ON p.oid = e.evtfoid
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  ), '[]'::jsonb)
) AS registry_followup_catalog;

ROLLBACK;
