-- SOURCE_ONLY / DO_NOT_APPLY. Conditional empty-scaffold recovery proposal.
-- DEV mcvekinhgcqygfddyifs only. Never run as a migration or after W1 admission.
-- No installed independent recovery identity/authority is asserted by this file.
begin;
set transaction isolation level read committed;
set local statement_timeout = '5s';
set local lock_timeout = '1s';
do $recovery_authority$
begin
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_INDEPENDENT_RECOVERY_AUTHORITY';
end;
$recovery_authority$;

-- Proposed independent provider-admin session, not a compromised application login
-- or the original install transaction. These are required capabilities, NOT facts.
do $recovery_preflight$
declare v_role text; v_owner oid;
begin
  if session_user <> 'postgres' or current_user <> 'postgres'
    or pg_catalog.current_setting('server_version_num')::integer not between 170000 and 179999
    or not exists (select 1 from pg_catalog.pg_roles where rolname = session_user and rolcreaterole and rolbypassrls) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_RECOVERY_IDENTITY_AND_VISIBILITY';
  end if;
  foreach v_role in array array['wz_core_registry_owner','wz_w1_store_owner','wz_w1_session_owner',
      'wz_w1_issuer_owner','wz_w1_consumer_owner','wz_w1_issuer','wz_w1_consumer'] loop
    select oid into v_owner from pg_catalog.pg_roles where rolname = v_role and not rolcanlogin and not rolinherit
      and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication;
    if v_owner is null or not pg_catalog.pg_has_role(session_user, v_owner, 'SET')
      or not exists (select 1 from pg_catalog.pg_auth_members
        where roleid = v_owner and member = (select oid from pg_catalog.pg_roles where rolname = session_user)
          and admin_option) then
      raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_RECOVERY_SET_ADMIN_AND_GRANTORS';
    end if;
  end loop;
  -- A connected/admitted installation needs containment and retained-data recovery,
  -- not this empty-scaffold removal. No login or membership is changed implicitly.
  if exists (select 1 from pg_catalog.pg_roles where rolname in ('wz_w1_issuer_login','wz_w1_consumer_login')) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_ADMITTED_CONNECTION_RECOVERY';
  end if;
  if not pg_catalog.pg_has_role(session_user, 'pg_database_owner', 'SET')
    or not exists (select 1 from pg_catalog.pg_namespace n join pg_catalog.pg_roles r on r.oid = n.nspowner
      where n.nspname = 'public' and r.rolname = 'pg_database_owner')
    or not pg_catalog.pg_has_role(session_user, 'supabase_auth_admin', 'SET')
    or not exists (select 1 from pg_catalog.pg_namespace n join pg_catalog.pg_roles r on r.oid = n.nspowner
      where n.nspname = 'auth' and r.rolname = 'supabase_auth_admin')
    or (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join pg_catalog.pg_roles r on r.oid = c.relowner
      where n.nspname = 'auth' and c.relname in ('users','sessions') and r.rolname = 'supabase_auth_admin') <> 2 then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_RECOVERY_PROVIDER_GRANTORS';
  end if;
  if (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join pg_catalog.pg_roles r on r.oid = c.relowner
      where c.relkind = 'r' and c.relrowsecurity and c.relforcerowsecurity
        and ((n.nspname = 'public' and c.relname in ('companies','company_memberships','company_portal_instances')
          and r.rolname = 'wz_core_registry_owner')
        or (n.nspname = 'wz_w1_private' and c.relname in ('provider_contract','company_authority','assertions','receipts')
          and r.rolname = 'wz_w1_store_owner'))) <> 7 then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_RECOVERY_OBJECT_INVENTORY';
  end if;
  if not exists (select 1 from pg_catalog.pg_namespace n join pg_catalog.pg_roles r on r.oid = n.nspowner
      where n.nspname = 'wz_w1_private' and r.rolname = 'wz_w1_store_owner')
    or (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'wz_w1_private') <> 5
    or (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_roles r on r.oid = p.proowner
      where p.prokind = 'f' and (
        (p.oid = pg_catalog.to_regprocedure('wz_w1_private.verify_session(uuid,uuid,bigint)') and r.rolname = 'wz_w1_session_owner' and p.prosecdef)
        or (p.oid = pg_catalog.to_regprocedure('wz_w1_private.check_binding(uuid,uuid,uuid,text,uuid,text,text)') and r.rolname = 'wz_w1_store_owner' and not p.prosecdef)
        or (p.oid = pg_catalog.to_regprocedure('wz_w1_private.lock_company_authority(uuid,uuid,text)') and r.rolname = 'wz_w1_store_owner' and not p.prosecdef)
        or (p.oid = pg_catalog.to_regprocedure('wz_w1_private.issue_assertion(uuid,uuid,bigint,uuid,text,uuid,text,text)') and r.rolname = 'wz_w1_issuer_owner' and p.prosecdef)
        or (p.oid = pg_catalog.to_regprocedure('wz_w1_private.consume_assertion(uuid,uuid,uuid,bigint,uuid,text,uuid,text,text)') and r.rolname = 'wz_w1_consumer_owner' and p.prosecdef))) <> 5 then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_RECOVERY_FUNCTION_INVENTORY';
  end if;
end;
$recovery_preflight$;

-- Containment comes first. Each function owner removes only its outer entry grant.
set local role wz_w1_issuer_owner;
revoke execute on function wz_w1_private.issue_assertion(uuid,uuid,bigint,uuid,text,uuid,text,text) from wz_w1_issuer;
set local role none;
set local role wz_w1_consumer_owner;
revoke execute on function wz_w1_private.consume_assertion(uuid,uuid,uuid,bigint,uuid,text,uuid,text,text) from wz_w1_consumer;
set local role none;

-- Lock exact objects under their actual owners. Fail on concurrent use, no retries.
-- Temporary SELECT is needed in addition to the existing provider-admin BYPASSRLS
-- for reliable emptiness checks; BYPASSRLS alone supplies no table ACL privileges.
set local role wz_core_registry_owner;
lock table public.companies, public.company_memberships, public.company_portal_instances in access exclusive mode nowait;
grant select on public.companies, public.company_memberships, public.company_portal_instances to postgres;
set local role none;
set local role wz_w1_store_owner;
lock table wz_w1_private.provider_contract, wz_w1_private.company_authority,
  wz_w1_private.assertions, wz_w1_private.receipts in access exclusive mode nowait;
grant select on wz_w1_private.provider_contract, wz_w1_private.company_authority,
  wz_w1_private.assertions, wz_w1_private.receipts to postgres;
grant usage on schema wz_w1_private to postgres;
set local role none;
do $empty_scaffold_only$
begin
  if exists (select 1 from public.companies) or exists (select 1 from public.company_memberships)
    or exists (select 1 from public.company_portal_instances) or exists (select 1 from wz_w1_private.provider_contract)
    or exists (select 1 from wz_w1_private.company_authority) or exists (select 1 from wz_w1_private.assertions)
    or exists (select 1 from wz_w1_private.receipts) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_POPULATED_HISTORY_RECOVERY';
  end if;
end;
$empty_scaffold_only$;

-- Exact reverse dependencies, all RESTRICT. Any unexpected dependency aborts.
set local role wz_w1_consumer_owner;
drop function wz_w1_private.consume_assertion(uuid,uuid,uuid,bigint,uuid,text,uuid,text,text) restrict;
set local role none;
set local role wz_w1_issuer_owner;
drop function wz_w1_private.issue_assertion(uuid,uuid,bigint,uuid,text,uuid,text,text) restrict;
set local role none;
set local role wz_w1_session_owner;
drop function wz_w1_private.verify_session(uuid,uuid,bigint) restrict;
set local role none;
set local role wz_w1_store_owner;
drop function wz_w1_private.lock_company_authority(uuid,uuid,text) restrict;
drop function wz_w1_private.check_binding(uuid,uuid,uuid,text,uuid,text,text) restrict;
drop table wz_w1_private.receipts restrict;
drop table wz_w1_private.assertions restrict;
drop table wz_w1_private.company_authority restrict;
drop table wz_w1_private.provider_contract restrict;
drop schema wz_w1_private restrict;
set local role none;
set local role wz_core_registry_owner;
drop table public.company_portal_instances restrict;
drop table public.company_memberships restrict;
drop table public.companies restrict;
set local role none;

-- Remove exactly the new grants on pre-existing provider objects, as their owner.
-- Roles must have been absent at install preflight; no pre-existing ACL is erased.
set local role supabase_auth_admin;
revoke select (id,email_confirmed_at,is_anonymous,banned_until,deleted_at) on auth.users from wz_w1_session_owner;
revoke select (id,user_id,not_after) on auth.sessions from wz_w1_session_owner;
revoke references (id) on auth.users from wz_core_registry_owner;
revoke usage on schema auth from wz_w1_session_owner, wz_core_registry_owner;
set local role none;
set local role pg_database_owner;
revoke usage, create on schema public from wz_core_registry_owner, wz_w1_store_owner, wz_w1_issuer_owner, wz_w1_consumer_owner;
set local role none;

-- DROP ROLE removes memberships in each removed role automatically. Do not try
-- to revoke the bootstrap-granted creator ADMIN tuple as a non-superuser.
-- This requires independently proved CREATEROLE + ADMIN for every exact new role,
-- all cluster/database dependencies and full grantor/options inventory before use.
drop role wz_w1_issuer, wz_w1_consumer, wz_w1_consumer_owner, wz_w1_issuer_owner,
  wz_w1_session_owner, wz_w1_store_owner, wz_core_registry_owner;
set local role none;
-- Independent metadata comparison to the complete pre-install snapshot is mandatory.
-- This file remains rollback-only. It grants neither COMMIT nor provider execution.
rollback;
