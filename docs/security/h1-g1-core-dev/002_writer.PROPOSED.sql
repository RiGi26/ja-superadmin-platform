-- SOURCE_ONLY / DO_NOT_APPLY. ONLY reviewed clean DEV mcvekinhgcqygfddyifs.
-- Requires 001_registry.PROPOSED.sql; no managed execution authorized now.
-- Private atomic W1 candidate. Identity/provenance/codec guards ALWAYS deny.
-- No credential, login grant, public RPC or application adapter is provisioned.
-- Mandatory continuation of 001 on the same connection and open transaction.
-- ROLLBACK ONLY. No persistent role delegation or objects may be installed.
do $writer_installation_authority$
begin
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY';
end;
$writer_installation_authority$;

set local role wz_core_registry_owner;
grant create on schema wz_core_private to wz_core_writer_owner, wz_core_audit_owner;

create function wz_core_private.assert_current_identity()
returns table (subject uuid, session_id uuid, source_ref uuid)
language plpgsql volatile security invoker set search_path = '' set row_security = on
as $identity$
begin
  -- Must verify request-bound Auth session, issuer, subject, expiry/revocation,
  -- action and source after every wait. Arbitrary JWT/GUC/UUID is not proof.
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT';
end;
$identity$;
create function wz_core_private.assert_clean_provenance(p_subject uuid)
returns void language plpgsql volatile security invoker set search_path = '' set row_security = on
as $provenance$
begin
  -- No false clean inference from missing DEV legacy tables or hidden rows.
  -- Authoritative all-history/cross-writer completeness is not implemented.
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_CLEAN_E1_PROVENANCE';
end;
$provenance$;
create function wz_core_private.assert_codec_integration()
returns void language plpgsql volatile security invoker set search_path = ''
as $codec$
begin
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_CODEC_INTEGRATION';
end;
$codec$;
create function wz_core_private.assert_first_owner_authority(p_subject uuid, p_source_ref uuid)
returns void language plpgsql volatile security invoker set search_path = '' set row_security = on
as $first_owner$
begin
  -- DEC-2026-029: historical S1 dual operators remain mandatory for E2/E3.
  -- Dated 14 Oct E1 amendment permits only proven NEW/clean self-service.
  -- Neither a subject/source UUID nor the empty DEV schema establishes that
  -- classification. No approved classifier/dual-operator proof is installed.
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_FIRST_OWNER_AUTHORITY';
end;
$first_owner$;
revoke all on function wz_core_private.assert_current_identity(), wz_core_private.assert_clean_provenance(uuid),
  wz_core_private.assert_codec_integration(), wz_core_private.assert_first_owner_authority(uuid, uuid)
  from public, anon, authenticated, service_role, wz_core_executor;
grant execute on function wz_core_private.assert_current_identity(), wz_core_private.assert_clean_provenance(uuid),
  wz_core_private.assert_codec_integration(), wz_core_private.assert_first_owner_authority(uuid, uuid)
  to wz_core_writer_owner;
reset role;
set local role wz_core_audit_owner;

create table wz_core_private.creation_events (
  event_id uuid primary key,
  actor_user_id uuid not null,
  company_id uuid not null references public.companies(id) on update restrict on delete restrict,
  membership_id uuid not null,
  idempotency_key uuid not null,
  request_scope text not null check (request_scope ~ '^[0-9a-f]{64}$'),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  fingerprint_codec text not null check (fingerprint_codec = 'e1:v2'),
  source_ref uuid not null,
  action text not null check (action = 'new_company_initial_owner'),
  occurred_at timestamptz not null,
  foreign key (membership_id, company_id, actor_user_id)
    references public.company_memberships(id, company_id, core_auth_user_id) on update restrict on delete restrict,
  unique (actor_user_id, idempotency_key),
  unique (company_id),
  unique (membership_id),
  unique (event_id, actor_user_id, idempotency_key, company_id, membership_id, request_scope, payload_fingerprint, fingerprint_codec)
);
create table wz_core_private.creation_receipts (
  actor_user_id uuid not null,
  idempotency_key uuid not null,
  company_id uuid not null,
  membership_id uuid not null,
  event_id uuid not null unique,
  request_scope text not null,
  payload_fingerprint text not null,
  fingerprint_codec text not null check (fingerprint_codec = 'e1:v2'),
  recorded_at timestamptz not null,
  primary key (actor_user_id, idempotency_key),
  unique (event_id, actor_user_id, idempotency_key, company_id, membership_id, request_scope, payload_fingerprint, fingerprint_codec),
  constraint core_receipt_event_fk
    foreign key (event_id, actor_user_id, idempotency_key, company_id, membership_id, request_scope, payload_fingerprint, fingerprint_codec)
    references wz_core_private.creation_events(event_id, actor_user_id, idempotency_key, company_id, membership_id, request_scope, payload_fingerprint, fingerprint_codec)
    on update restrict on delete restrict deferrable initially deferred
);
alter table wz_core_private.creation_events add constraint core_event_receipt_fk
  foreign key (event_id, actor_user_id, idempotency_key, company_id, membership_id, request_scope, payload_fingerprint, fingerprint_codec)
  references wz_core_private.creation_receipts(event_id, actor_user_id, idempotency_key, company_id, membership_id, request_scope, payload_fingerprint, fingerprint_codec)
  on update restrict on delete restrict deferrable initially deferred;
create index core_events_actor_idx on wz_core_private.creation_events(actor_user_id);
alter table wz_core_private.creation_events enable row level security;
alter table wz_core_private.creation_events force row level security;
alter table wz_core_private.creation_receipts enable row level security;
alter table wz_core_private.creation_receipts force row level security;
revoke all on wz_core_private.creation_events, wz_core_private.creation_receipts
  from public, anon, authenticated, service_role, wz_core_executor;
grant select, insert on wz_core_private.creation_events, wz_core_private.creation_receipts to wz_core_writer_owner;
-- No UPDATE/DELETE/TRUNCATE/Maintain grant. No UPDATE/DELETE policy.
-- Administrators remain privileged; RESTRICT and append-only need privacy review.

create policy core_writer_events_read on wz_core_private.creation_events for select to wz_core_writer_owner
  using (actor_user_id = (select subject from wz_core_private.assert_current_identity()));
create policy core_writer_events_insert on wz_core_private.creation_events for insert to wz_core_writer_owner
  with check (actor_user_id = (select subject from wz_core_private.assert_current_identity()));
create policy core_writer_receipts_read on wz_core_private.creation_receipts for select to wz_core_writer_owner
  using (actor_user_id = (select subject from wz_core_private.assert_current_identity()));
create policy core_writer_receipts_insert on wz_core_private.creation_receipts for insert to wz_core_writer_owner
  with check (actor_user_id = (select subject from wz_core_private.assert_current_identity()));
reset role;
set local role wz_core_registry_owner;
create policy core_writer_company_read on public.companies for select to wz_core_writer_owner
  using (exists (select 1 from public.company_memberships m where m.company_id = companies.id
    and m.core_auth_user_id = (select subject from wz_core_private.assert_current_identity())));
create policy core_writer_company_insert on public.companies for insert to wz_core_writer_owner with check (true);
-- Non-login/non-delegated definer only; fixed function is its sole insert path.
create policy core_writer_members_read on public.company_memberships for select to wz_core_writer_owner
  using (core_auth_user_id = (select subject from wz_core_private.assert_current_identity()));
create policy core_writer_members_insert on public.company_memberships for insert to wz_core_writer_owner
  with check (core_auth_user_id = (select subject from wz_core_private.assert_current_identity())
    and role = 'owner' and status = 'active');
reset role;
set local role wz_core_writer_owner;

create function wz_core_private.bootstrap_company(p_name text, p_key uuid)
returns uuid language plpgsql volatile security definer set search_path = '' set row_security = on
as $writer$
declare
  v_actor uuid; v_session uuid; v_source uuid;
  v_after_actor uuid; v_after_session uuid; v_after_source uuid;
  v_name text; v_scope text; v_fingerprint text;
  v_company uuid; v_membership uuid; v_event uuid; v_now timestamptz;
  v_receipt wz_core_private.creation_receipts%rowtype;
begin
  if current_user <> 'wz_core_writer_owner' or not exists (
    select 1 from pg_catalog.pg_roles r where r.rolname = current_user
      and not r.rolsuper and not r.rolbypassrls and not r.rolcanlogin and not r.rolinherit
      and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication
  ) or exists (select 1 from pg_catalog.pg_auth_members a
    join pg_catalog.pg_roles r on r.oid in (a.roleid, a.member) where r.rolname = current_user) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_PROVIDER_ROLE_CLOSURE';
  end if;
  -- Prevent ambient CREATE through PUBLIC or another ACL, even after explicit
  -- owner CREATE revocation. Do not "fix" public defaults globally here.
  if exists (select 1 from pg_catalog.pg_roles r where r.rolname in
    ('wz_core_registry_owner', 'wz_core_writer_owner', 'wz_core_audit_owner', 'wz_core_executor')
    and pg_catalog.has_schema_privilege(r.oid, 'public', 'CREATE')) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_EFFECTIVE_SCHEMA_ACL';
  end if;
  -- Effective privilege checks include PUBLIC, inherited ACLs and column ACLs;
  -- ACL text/revoking named grants alone is insufficient. UUID tables need no
  -- sequences: any candidate sequence is drift, not a reason for global REVOKE.
  if exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join pg_catalog.pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role', 'wz_core_executor')
    and c.relkind = 'r' and ((n.nspname = 'public' and c.relname in
      ('companies', 'company_memberships', 'company_portal_instances')) or n.nspname = 'wz_core_private')
    and (pg_catalog.has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      or pg_catalog.has_any_column_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_EFFECTIVE_TABLE_ACL';
  end if;
  if exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'S' and (n.nspname = 'wz_core_private' or
      (n.nspname = 'public' and c.relname like 'wz_core_%'))) then
    raise exception using errcode = '42501', message = 'unexpected_candidate_sequence';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join pg_catalog.pg_roles r where n.nspname = 'wz_core_private'
    and r.rolname in ('anon', 'authenticated', 'service_role')
    and pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE')) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_EFFECTIVE_FUNCTION_ACL';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed'
    or pg_catalog.current_setting('server_encoding') <> 'UTF8' then
    raise exception using errcode = '42501', message = 'core_transaction_contract_required';
  end if;
  if p_name is null or p_key is null or p_key::text !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;
  v_name := normalize(pg_catalog.btrim(p_name,
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'), NFC);
  if pg_catalog.char_length(v_name) < 2 or pg_catalog.char_length(v_name) > 100 or exists (
    select 1 from pg_catalog.generate_series(1, pg_catalog.char_length(v_name)) points(n)
    where pg_catalog.ascii(pg_catalog.substr(v_name, points.n, 1)) between 0 and 31
      or pg_catalog.ascii(pg_catalog.substr(v_name, points.n, 1)) between 127 and 159
  ) then raise exception using errcode = '22023', message = 'invalid_request'; end if;

  perform wz_core_private.assert_codec_integration();
  select subject, session_id, source_ref into strict v_actor, v_session, v_source
    from wz_core_private.assert_current_identity();
  if v_actor is null or v_session is null or v_source is null then
    raise exception using errcode = '42501', message = 'verified_actor_required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(77102, pg_catalog.hashtext(v_actor::text));
  select subject, session_id, source_ref into strict v_after_actor, v_after_session, v_after_source
    from wz_core_private.assert_current_identity();
  if v_after_actor is distinct from v_actor or v_after_session is distinct from v_session
    or v_after_source is distinct from v_source then
    raise exception using errcode = '42501', message = 'actor_or_session_changed';
  end if;
  v_scope := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to('e1:v2:scope:' || v_actor::text || ':' || p_key::text, 'UTF8')), 'hex');
  v_fingerprint := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to('e1:v2:payload:' || v_actor::text || ':' ||
    pg_catalog.encode(pg_catalog.convert_to(v_name, 'UTF8'), 'hex'), 'UTF8')), 'hex');
  select * into v_receipt from wz_core_private.creation_receipts where actor_user_id = v_actor and idempotency_key = p_key;
  if found then
    if v_receipt.request_scope is distinct from v_scope or v_receipt.payload_fingerprint is distinct from v_fingerprint
      or v_receipt.fingerprint_codec <> 'e1:v2' then
      raise exception using errcode = '22023', message = 'idempotency_payload_conflict';
    end if;
    if (select pg_catalog.count(*) from public.company_memberships where core_auth_user_id = v_actor and status = 'active') <> 1
      or not exists (select 1 from public.company_memberships m join public.companies c on c.id = m.company_id
        where m.id = v_receipt.membership_id and m.company_id = v_receipt.company_id and m.core_auth_user_id = v_actor
          and m.role = 'owner' and m.status = 'active' and c.status = 'active') then
      raise exception using errcode = '42501', message = 'replay_no_longer_authorized';
    end if;
    return v_receipt.company_id;
  end if;
  if exists (select 1 from public.company_memberships where core_auth_user_id = v_actor) then
    raise exception using errcode = '42501', message = 'existing_or_revoked_company_hold';
  end if;
  perform wz_core_private.assert_clean_provenance(v_actor);
  perform wz_core_private.assert_first_owner_authority(v_actor, v_source);
  v_company := pg_catalog.gen_random_uuid(); v_membership := pg_catalog.gen_random_uuid();
  v_event := pg_catalog.gen_random_uuid(); v_now := pg_catalog.transaction_timestamp();
  insert into public.companies(id, display_name, status, created_at, updated_at) values (v_company, v_name, 'active', v_now, v_now);
  insert into public.company_memberships(id, company_id, core_auth_user_id, role, status, created_at, updated_at)
    values (v_membership, v_company, v_actor, 'owner', 'active', v_now, v_now);
  insert into wz_core_private.creation_events(event_id, actor_user_id, company_id, membership_id, idempotency_key,
    request_scope, payload_fingerprint, fingerprint_codec, source_ref, action, occurred_at)
    values (v_event, v_actor, v_company, v_membership, p_key, v_scope, v_fingerprint, 'e1:v2', v_source, 'new_company_initial_owner', v_now);
  insert into wz_core_private.creation_receipts(actor_user_id, idempotency_key, company_id, membership_id, event_id,
    request_scope, payload_fingerprint, fingerprint_codec, recorded_at)
    values (v_actor, p_key, v_company, v_membership, v_event, v_scope, v_fingerprint, 'e1:v2', v_now);
  set constraints wz_core_private.core_receipt_event_fk, wz_core_private.core_event_receipt_fk immediate;
  -- No handler swallowing errors, internal COMMIT, or success before caller COMMIT.
  return v_company;
end;
$writer$;
revoke all on function wz_core_private.bootstrap_company(text, uuid) from public, anon, authenticated, service_role, wz_core_executor;
grant execute on function wz_core_private.bootstrap_company(text, uuid) to wz_core_executor;
reset role;
set local role wz_core_registry_owner;
revoke create on schema wz_core_private from wz_core_writer_owner, wz_core_audit_owner;
reset role;
-- Revoke ONLY postgres's own explicit SET grant, not the bootstrap-superuser
-- creator ADMIN grant that a non-superuser cannot remove. Actual managed
-- grantor behavior is NOT_EXECUTED. ROLLBACK, never COMMIT, is selected.
revoke wz_core_registry_owner, wz_core_writer_owner, wz_core_audit_owner, wz_core_executor
  from postgres granted by postgres restrict;
do $installation_gate$
begin
  -- This durable-closure assertion intentionally still DENIES creator ADMIN.
  -- A rollback rehearsal may observe that failure, not weaken it to claim a
  -- deployable role closure. It is not expected to pass on standard PG17.
  if exists (select 1 from pg_catalog.pg_auth_members a join pg_catalog.pg_roles r
    on r.oid in (a.roleid, a.member) where r.rolname in
    ('wz_core_registry_owner', 'wz_core_writer_owner', 'wz_core_audit_owner', 'wz_core_executor')) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_PROVIDER_ROLE_CLOSURE';
  end if;
  -- Prevent ambient CREATE through PUBLIC or another ACL, even after explicit
  -- owner CREATE revocation. Do not "fix" public defaults globally here.
  if exists (select 1 from pg_catalog.pg_roles r where r.rolname in
    ('wz_core_registry_owner', 'wz_core_writer_owner', 'wz_core_audit_owner', 'wz_core_executor')
    and pg_catalog.has_schema_privilege(r.oid, 'public', 'CREATE')) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_EFFECTIVE_SCHEMA_ACL';
  end if;
  -- Effective privilege checks include PUBLIC, inherited ACLs and column ACLs;
  -- ACL text/revoking named grants alone is insufficient. UUID tables need no
  -- sequences: any candidate sequence is drift, not a reason for global REVOKE.
  if exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join pg_catalog.pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role', 'wz_core_executor')
    and c.relkind = 'r' and ((n.nspname = 'public' and c.relname in
      ('companies', 'company_memberships', 'company_portal_instances')) or n.nspname = 'wz_core_private')
    and (pg_catalog.has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      or pg_catalog.has_any_column_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_EFFECTIVE_TABLE_ACL';
  end if;
  if exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'S' and (n.nspname = 'wz_core_private' or
      (n.nspname = 'public' and c.relname like 'wz_core_%'))) then
    raise exception using errcode = '42501', message = 'unexpected_candidate_sequence';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join pg_catalog.pg_roles r where n.nspname = 'wz_core_private'
    and r.rolname in ('anon', 'authenticated', 'service_role')
    and pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE')) then
    raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_EFFECTIVE_FUNCTION_ACL';
  end if;
  -- A signed source revision and verified provider recovery plan are required
  -- before a durable install. No GUC/environment/UUID can waive this refusal.
  raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY';
end;
$installation_gate$;
rollback;
