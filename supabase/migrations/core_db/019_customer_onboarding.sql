-- 019_customer_onboarding.sql
-- Unified, verification-first onboarding for Webzoka Customer Hub -> Stock.
--
-- Core owns identity, membership, selected plan, trial dates, and retry state.
-- Stock remains the operational database and is provisioned asynchronously.
-- No password, email token, OAuth token, or service secret is stored here.

begin;

create table if not exists public.customer_onboarding (
  id                  uuid primary key default gen_random_uuid(),
  platform            text not null default 'stock'
                        check (platform in ('stock')),
  source              text not null
                        check (source in ('self_service', 'manual')),
  status              text not null default 'pending_verification'
                        check (status in (
                          'pending_verification',
                          'provisioning',
                          'portal_failed',
                          'needs_attention',
                          'ready',
                          'cancelled'
                        )),
  owner_user_id       uuid not null references auth.users(id) on delete restrict,
  owner_email         text not null check (owner_email = lower(owner_email)),
  owner_name          text not null,
  owner_phone         text,
  business_name       text not null,
  slug                text not null,
  plan_id             uuid not null references public.subscription_plans(id),
  core_tenant_id      uuid not null default gen_random_uuid() unique,
  portal_tenant_id    uuid unique,
  invite_type         text not null
                        check (invite_type in ('signup', 'invite', 'magiclink', 'existing_account')),
  created_by          uuid references auth.users(id) on delete set null,
  verified_at         timestamptz,
  trial_started_at    timestamptz,
  trial_ends_at       timestamptz,
  provisioned_at      timestamptz,
  attempt_count       integer not null default 0 check (attempt_count >= 0),
  next_retry_at       timestamptz,
  last_error_code     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists customer_onboarding_owner_idx
  on public.customer_onboarding (owner_user_id, created_at desc);
create index if not exists customer_onboarding_retry_idx
  on public.customer_onboarding (status, next_retry_at)
  where status in ('provisioning', 'portal_failed');

-- Stock currently supports one active tenant context per identity. Enforce that
-- boundary explicitly instead of allowing an ambiguous second Stock profile.
create unique index if not exists customer_onboarding_active_owner_platform_uniq
  on public.customer_onboarding (lower(owner_email), platform)
  where status in ('pending_verification', 'provisioning', 'portal_failed', 'needs_attention', 'ready');

alter table public.customer_onboarding enable row level security;
revoke all on table public.customer_onboarding from anon;
revoke all on table public.customer_onboarding from authenticated;
grant select on table public.customer_onboarding to authenticated;
grant all on table public.customer_onboarding to service_role;

drop policy if exists "customer_read_own_onboarding" on public.customer_onboarding;
create policy "customer_read_own_onboarding"
  on public.customer_onboarding
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

drop trigger if exists customer_onboarding_updated_at on public.customer_onboarding;
create trigger customer_onboarding_updated_at
  before update on public.customer_onboarding
  for each row execute function public.handle_updated_at();

-- Fast, non-enumerating server lookup. Only the service role may call this.
-- Public/anon/authenticated receive no EXECUTE permission.
create or replace function public.lookup_auth_user_by_email(p_email text)
returns table (user_id uuid, email_confirmed_at timestamptz)
language sql
stable
security definer
set search_path = auth, public, pg_temp
as $$
  select u.id, u.email_confirmed_at
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.lookup_auth_user_by_email(text) from public;
revoke all on function public.lookup_auth_user_by_email(text) from anon;
revoke all on function public.lookup_auth_user_by_email(text) from authenticated;
grant execute on function public.lookup_auth_user_by_email(text) to service_role;

-- Atomically creates Core business, membership, selected plan, and 14-day trial.
-- The caller must have already verified the one-time email token. This function
-- independently checks auth.users.email_confirmed_at before activating anything.
create or replace function public.finalize_customer_onboarding(
  p_onboarding_id uuid,
  p_owner_user_id uuid
)
returns table (
  onboarding_id uuid,
  core_tenant_id uuid,
  trial_ends_at timestamptz,
  onboarding_status text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_request public.customer_onboarding%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_auth_email text;
  v_email_confirmed_at timestamptz;
  v_slug text;
  v_trial_started_at timestamptz;
  v_trial_ends_at timestamptz;
  v_created_tenant boolean := false;
  v_subscription_id uuid;
begin
  select * into v_request
  from public.customer_onboarding
  where id = p_onboarding_id
  for update;

  if not found then
    raise exception 'onboarding_not_found' using errcode = 'P0001';
  end if;

  if v_request.owner_user_id <> p_owner_user_id then
    raise exception 'onboarding_owner_mismatch' using errcode = '42501';
  end if;

  if v_request.status = 'cancelled' then
    raise exception 'onboarding_cancelled' using errcode = 'P0001';
  end if;

  select u.email, u.email_confirmed_at
  into v_auth_email, v_email_confirmed_at
  from auth.users u
  where u.id = p_owner_user_id;

  if v_email_confirmed_at is null
     or lower(coalesce(v_auth_email, '')) <> v_request.owner_email then
    raise exception 'email_not_verified' using errcode = '42501';
  end if;

  select * into v_plan
  from public.subscription_plans
  where id = v_request.plan_id
    and platform = 'stock'
    and is_active = true;

  if not found then
    raise exception 'stock_plan_unavailable' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.tenants where id = v_request.core_tenant_id) then
    select t.slug into v_slug
    from public.tenants t
    where t.id = v_request.core_tenant_id
      and t.owner_user_id = p_owner_user_id
      and t.platform = 'stock';

    if v_slug is null then
      raise exception 'core_tenant_conflict' using errcode = '23505';
    end if;
  else
    v_slug := v_request.slug;
    if exists (select 1 from public.tenants where slug = v_slug) then
      v_slug := left(v_slug, 30) || '-' || left(v_request.id::text, 8);
    end if;

    v_trial_started_at := now();
    v_trial_ends_at := v_trial_started_at + interval '14 days';

    insert into public.tenants (
      id,
      name,
      slug,
      platform,
      status,
      plan_tier,
      email,
      phone,
      owner_user_id,
      trial_ends_at,
      metadata,
      created_at,
      updated_at
    ) values (
      v_request.core_tenant_id,
      v_request.business_name,
      v_slug,
      'stock',
      'trial',
      v_plan.tier,
      v_request.owner_email,
      v_request.owner_phone,
      p_owner_user_id,
      v_trial_ends_at,
      jsonb_build_object(
        'source', v_request.source,
        'onboarding_request_id', v_request.id
      ),
      v_trial_started_at,
      v_trial_started_at
    );
    v_created_tenant := true;
  end if;

  if v_trial_started_at is null then
    v_trial_started_at := coalesce(v_request.trial_started_at, now());
    v_trial_ends_at := coalesce(
      v_request.trial_ends_at,
      (select t.trial_ends_at from public.tenants t where t.id = v_request.core_tenant_id),
      v_trial_started_at + interval '14 days'
    );
  end if;

  insert into public.users (
    id,
    tenant_id,
    full_name,
    email,
    phone,
    role,
    status,
    created_at
  ) values (
    p_owner_user_id,
    v_request.core_tenant_id,
    v_request.owner_name,
    v_request.owner_email,
    v_request.owner_phone,
    'admin',
    'active',
    now()
  )
  on conflict (id) do update set
    tenant_id = coalesce(public.users.tenant_id, excluded.tenant_id),
    full_name = excluded.full_name,
    email = excluded.email,
    phone = coalesce(excluded.phone, public.users.phone),
    status = 'active';

  insert into public.tenant_members (
    tenant_id,
    user_id,
    role,
    platform_role,
    invited_by,
    joined_at,
    is_active
  ) values (
    v_request.core_tenant_id,
    p_owner_user_id,
    'owner',
    'admin',
    v_request.created_by,
    now(),
    true
  )
  on conflict (tenant_id, user_id) do update set
    role = 'owner',
    platform_role = 'admin',
    is_active = true;

  select ts.id into v_subscription_id
  from public.tenant_subscriptions ts
  where ts.tenant_id = v_request.core_tenant_id
  order by ts.created_at desc
  limit 1;

  if v_subscription_id is null then
    insert into public.tenant_subscriptions (
      tenant_id,
      plan_id,
      status,
      trial_ends_at,
      current_period_start,
      current_period_end,
      created_at,
      updated_at
    ) values (
      v_request.core_tenant_id,
      v_plan.id,
      'trial',
      v_trial_ends_at,
      v_trial_started_at,
      v_trial_ends_at,
      now(),
      now()
    ) returning id into v_subscription_id;
  end if;

  if v_created_tenant then
    insert into public.subscription_events (
      tenant_id,
      event_type,
      payload,
      created_by,
      created_at
    ) values (
      v_request.core_tenant_id,
      'trial_started',
      jsonb_build_object(
        'onboarding_request_id', v_request.id,
        'plan_id', v_plan.id,
        'trial_ends_at', v_trial_ends_at,
        'source', v_request.source
      ),
      v_request.created_by,
      now()
    );
  end if;

  update public.customer_onboarding
  set status = case when status = 'ready' then 'ready' else 'provisioning' end,
      slug = v_slug,
      verified_at = coalesce(verified_at, now()),
      trial_started_at = v_trial_started_at,
      trial_ends_at = v_trial_ends_at,
      last_error_code = null,
      next_retry_at = case when status = 'ready' then next_retry_at else now() end
  where id = v_request.id;

  return query
  select
    v_request.id,
    v_request.core_tenant_id,
    v_trial_ends_at,
    (select co.status from public.customer_onboarding co where co.id = v_request.id);
end;
$$;

revoke all on function public.finalize_customer_onboarding(uuid, uuid) from public;
revoke all on function public.finalize_customer_onboarding(uuid, uuid) from anon;
revoke all on function public.finalize_customer_onboarding(uuid, uuid) from authenticated;
grant execute on function public.finalize_customer_onboarding(uuid, uuid) to service_role;

commit;
