-- SOURCE_ONLY / DO_NOT_APPLY. Deterministic EMPTY-SCAFFOLD recovery proposal.
-- Not data-fixture cleanup. No usable recovery principal is evidenced yet.
-- COUNTERFACTUAL REFERENCE ONLY: selected design never commits a scaffold.
-- This text ends in ROLLBACK; it cannot be a post-COMMIT cleanup implementation.
-- Preconditions in RUNTIME_PACKAGE.md require a signed revision, exact DEV,
-- quiesced application connections, fresh dependencies and zero application rows.
-- One backend, one transaction, stop-on-error. No DROP CASCADE/IF EXISTS.
begin;
do $recovery_authority$
begin
  -- Unconditional before any teardown. Caller flags cannot waive authority.
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY';
end;
$recovery_authority$;

do $recovery_capabilities$
begin
  -- Proposed recovery session is postgres, but its access to owner roles must
  -- be independently established by a PROVEN authorized ADMIN holder. PG17's
  -- bootstrap-granted creator ADMIN may remain; it cannot be revoked by a
  -- non-superuser. Neither its absence nor safe retained authority is assumed.
  if current_user <> 'postgres' or session_user <> 'postgres' or not exists
    (select 1 from pg_catalog.pg_roles where rolname = current_user and rolcreaterole) or
    (select pg_catalog.count(*) from pg_catalog.pg_roles r where r.rolname in
      ('wz_core_registry_owner', 'wz_core_writer_owner', 'wz_core_audit_owner', 'wz_core_executor')
      and pg_catalog.pg_has_role(session_user, r.oid, 'SET')
      and exists (select 1 from pg_catalog.pg_auth_members m where m.roleid = r.oid
        and m.member = (select oid from pg_catalog.pg_roles where rolname = session_user)
        and m.admin_option)
      and not pg_catalog.pg_has_role(session_user, r.oid, 'USAGE')) <> 4 then
    raise exception using errcode = '42501', message = 'verified_recovery_admin_and_set_required';
  end if;
end;
$recovery_capabilities$;

-- Remove call paths before their tables/policies/guards. No managed Auth object
-- is dropped; removing our FK does not remove the referenced Auth user.
set local role wz_core_writer_owner;
drop function wz_core_private.bootstrap_company(text, uuid);
reset role;
set local role wz_core_registry_owner;
drop policy core_writer_company_read on public.companies;
drop policy core_writer_company_insert on public.companies;
drop policy core_writer_members_read on public.company_memberships;
drop policy core_writer_members_insert on public.company_memberships;
reset role;
set local role wz_core_audit_owner;
drop policy core_writer_events_read on wz_core_private.creation_events;
drop policy core_writer_events_insert on wz_core_private.creation_events;
drop policy core_writer_receipts_read on wz_core_private.creation_receipts;
drop policy core_writer_receipts_insert on wz_core_private.creation_receipts;
alter table wz_core_private.creation_events drop constraint core_event_receipt_fk;
alter table wz_core_private.creation_receipts drop constraint core_receipt_event_fk;
drop table wz_core_private.creation_receipts;
drop table wz_core_private.creation_events;
reset role;
set local role wz_core_registry_owner;
drop table public.company_portal_instances;
drop table public.company_memberships;
drop table public.companies;
drop function wz_core_private.assert_first_owner_authority(uuid, uuid);
drop function wz_core_private.assert_clean_provenance(uuid);
drop function wz_core_private.assert_codec_integration();
drop function wz_core_private.assert_current_identity();
drop schema wz_core_private;
reset role;
-- Revoke only task-owned explicit public grants, retaining ADMIN until DROP
-- ROLE. Remaining default ACL/shared dependencies must have been checked.
revoke usage on schema public from wz_core_registry_owner, wz_core_writer_owner, wz_core_audit_owner;
drop role wz_core_executor;
drop role wz_core_audit_owner;
drop role wz_core_writer_owner;
drop role wz_core_registry_owner;

do $recovery_final_gate$
begin
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY';
end;
$recovery_final_gate$;
rollback;
