-- ============================================================
-- 000_fresh_bootstrap.sql — BOOTSTRAP project Core DB BARU (sekali jalan)
-- Target: project baru milik akun owner (mis. hxhusfkrlafxdnyasmsu).
--
-- Gabungan idempoten dari: 001 (schema) + 002 (seed plans) + 003 (RLS) +
-- 004 (JWT hook) + 008 (billing). Migrasi 005/006 (export/import dari DB lama)
-- dan 007 (travel seed) SENGAJA dilewati — tak relevan untuk project bersih.
--
-- Cara pakai: paste seluruh file ini ke SQL Editor project baru → Run.
-- Aman diulang (drop ... if exists / if not exists / guard seed).
--
-- SETELAH ini: aktifkan JWT hook di Dashboard → Authentication → Hooks →
-- Custom Access Token → pilih `custom_jwt_claims`. Lalu buat user superadmin
-- (Authentication → Users) dengan email SUPERADMIN_EMAIL.
-- ============================================================


-- ╔════════════════════════════════════════════════════════╗
-- ║ 001 — Core schema                                        ║
-- ╚════════════════════════════════════════════════════════╝

create table if not exists public.tenants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  platform          text not null check (platform in ('lms','clinic','pharmacy','jastip')),
  status            text not null default 'trial'
                    check (status in ('trial','active','suspended','cancelled')),
  plan_tier         text not null default 'starter'
                    check (plan_tier in ('starter','pro','enterprise')),
  email             text,
  phone             text,
  address           text,
  logo_url          text,
  linked_tenant_id  uuid,
  fonnte_token      text,
  suspended_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.subscription_plans (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null check (platform in ('lms','clinic','pharmacy','jastip')),
  tier          text not null check (tier in ('starter','pro','enterprise')),
  name          text not null,
  price_monthly numeric(12,2) not null default 0,
  price_yearly  numeric(12,2) not null default 0,
  features      jsonb not null default '[]',
  max_users     integer,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.tenant_subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  plan_id                  uuid references public.subscription_plans(id),
  status                   text not null default 'trialing'
                           check (status in ('trialing','active','past_due','cancelled','unpaid')),
  trial_ends_at            timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  grace_period_ends_at     timestamptz,
  cancelled_at             timestamptz,
  midtrans_order_id        text,
  midtrans_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists public.tenant_members (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'member'
                check (role in ('superadmin','owner','admin','member')),
  platform_role text,
  created_at    timestamptz not null default now(),
  unique(tenant_id, user_id)
);

create table if not exists public.subscription_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  event_type  text not null,
  payload     jsonb,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_tenants_slug on public.tenants(slug);
create index if not exists idx_tenants_platform on public.tenants(platform);
create index if not exists idx_tenants_status on public.tenants(status);
create index if not exists idx_tenant_members_user_id on public.tenant_members(user_id);
create index if not exists idx_tenant_subscriptions_tenant_id on public.tenant_subscriptions(tenant_id);
create index if not exists idx_subscription_events_tenant_id on public.subscription_events(tenant_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tenants_updated_at on public.tenants;
create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.handle_updated_at();

drop trigger if exists tenant_subscriptions_updated_at on public.tenant_subscriptions;
create trigger tenant_subscriptions_updated_at
  before update on public.tenant_subscriptions
  for each row execute function public.handle_updated_at();


-- ╔════════════════════════════════════════════════════════╗
-- ║ 002 — Seed 12 subscription plans (guard anti-duplikat)   ║
-- ╚════════════════════════════════════════════════════════╝

insert into public.subscription_plans
  (platform, tier, name, price_monthly, price_yearly, max_users, features)
select * from (values
  ('lms','starter','LMS Starter',299000,2990000,50,'["Modul dasar","Absensi","Laporan"]'::jsonb),
  ('lms','pro','LMS Pro',599000,5990000,200,'["Semua Starter","Sertifikat","WhatsApp notif","Ujian online"]'::jsonb),
  ('lms','enterprise','LMS Enterprise',1199000,11990000,null,'["Semua Pro","Custom domain","API access","Priority support"]'::jsonb),
  ('clinic','starter','Clinic Starter',349000,3490000,10,'["Antrian","Rekam medis","Resep digital"]'::jsonb),
  ('clinic','pro','Clinic Pro',699000,6990000,50,'["Semua Starter","Lab hasil","WhatsApp notif","Apotek link"]'::jsonb),
  ('clinic','enterprise','Clinic Enterprise',1399000,13990000,null,'["Semua Pro","Multi cabang","Custom form","Priority support"]'::jsonb),
  ('pharmacy','starter','Pharmacy Starter',249000,2490000,5,'["Kasir POS","Stok obat","Laporan harian"]'::jsonb),
  ('pharmacy','pro','Pharmacy Pro',499000,4990000,20,'["Semua Starter","BPJS integration","Resep dari klinik","WhatsApp"]'::jsonb),
  ('pharmacy','enterprise','Pharmacy Enterprise',999000,9990000,null,'["Semua Pro","Multi cabang","API","Priority support"]'::jsonb),
  ('jastip','starter','Jastip Starter',199000,1990000,3,'["Order tracking","Invoice otomatis","WhatsApp notif"]'::jsonb),
  ('jastip','pro','Jastip Pro',399000,3990000,15,'["Semua Starter","Multi kurir","Dashboard analitik"]'::jsonb),
  ('jastip','enterprise','Jastip Enterprise',799000,7990000,null,'["Semua Pro","Custom domain","API","Priority support"]'::jsonb)
) as v(platform,tier,name,price_monthly,price_yearly,max_users,features)
where not exists (select 1 from public.subscription_plans);


-- ╔════════════════════════════════════════════════════════╗
-- ║ 003 — RLS policies                                       ║
-- ╚════════════════════════════════════════════════════════╝

alter table public.tenants enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.tenant_members enable row level security;
alter table public.subscription_events enable row level security;

create or replace function public.is_superadmin()
returns boolean as $$
begin
  return (auth.jwt() ->> 'user_role') = 'superadmin';
end;
$$ language plpgsql security definer;

create or replace function public.my_tenant_id()
returns uuid as $$
begin
  return (auth.jwt() ->> 'tenant_id')::uuid;
end;
$$ language plpgsql security definer;

drop policy if exists "superadmin_all_tenants" on public.tenants;
create policy "superadmin_all_tenants" on public.tenants for all using (public.is_superadmin());
drop policy if exists "member_read_own_tenant" on public.tenants;
create policy "member_read_own_tenant" on public.tenants for select using (id = public.my_tenant_id());

drop policy if exists "anyone_read_active_plans" on public.subscription_plans;
create policy "anyone_read_active_plans" on public.subscription_plans for select using (is_active = true);
drop policy if exists "superadmin_manage_plans" on public.subscription_plans;
create policy "superadmin_manage_plans" on public.subscription_plans for all using (public.is_superadmin());

drop policy if exists "superadmin_all_subscriptions" on public.tenant_subscriptions;
create policy "superadmin_all_subscriptions" on public.tenant_subscriptions for all using (public.is_superadmin());
drop policy if exists "tenant_read_own_subscription" on public.tenant_subscriptions;
create policy "tenant_read_own_subscription" on public.tenant_subscriptions for select using (tenant_id = public.my_tenant_id());

drop policy if exists "superadmin_all_members" on public.tenant_members;
create policy "superadmin_all_members" on public.tenant_members for all using (public.is_superadmin());
drop policy if exists "member_read_own_tenant_members" on public.tenant_members;
create policy "member_read_own_tenant_members" on public.tenant_members for select using (tenant_id = public.my_tenant_id());
drop policy if exists "user_read_own_membership" on public.tenant_members;
create policy "user_read_own_membership" on public.tenant_members for select using (user_id = auth.uid());

drop policy if exists "superadmin_all_events" on public.subscription_events;
create policy "superadmin_all_events" on public.subscription_events for all using (public.is_superadmin());
drop policy if exists "tenant_read_own_events" on public.subscription_events;
create policy "tenant_read_own_events" on public.subscription_events for select using (tenant_id = public.my_tenant_id());


-- ╔════════════════════════════════════════════════════════╗
-- ║ 004 — Custom JWT claims hook                             ║
-- ╚════════════════════════════════════════════════════════╝

create or replace function public.custom_jwt_claims(event jsonb)
returns jsonb as $$
declare
  v_user_id uuid;
  v_member  record;
  v_claims  jsonb;
begin
  v_user_id := (event ->> 'user_id')::uuid;
  v_claims  := event -> 'claims';

  select tm.role, tm.platform_role, tm.tenant_id, t.slug, t.platform, t.status, t.linked_tenant_id
  into v_member
  from public.tenant_members tm
  join public.tenants t on t.id = tm.tenant_id
  where tm.user_id = v_user_id
  limit 1;

  if v_member is not null then
    v_claims := v_claims
      || jsonb_build_object('user_role',       v_member.role)
      || jsonb_build_object('platform_role',    v_member.platform_role)
      || jsonb_build_object('tenant_id',        v_member.tenant_id)
      || jsonb_build_object('tenant_slug',      v_member.slug)
      || jsonb_build_object('platform',         v_member.platform)
      || jsonb_build_object('tenant_status',    v_member.status)
      || jsonb_build_object('linked_tenant_id', v_member.linked_tenant_id);
  end if;

  return jsonb_build_object('claims', v_claims);
end;
$$ language plpgsql security definer;

grant execute on function public.custom_jwt_claims to supabase_auth_admin;


-- ╔════════════════════════════════════════════════════════╗
-- ║ 008 — Billing: platform_settings + subscription_invoices ║
-- ╚════════════════════════════════════════════════════════╝

create table if not exists public.platform_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
insert into public.platform_settings (key, value) values ('midtrans_mode', 'sandbox')
on conflict (key) do nothing;
drop policy if exists "service_role_bypass" on public.platform_settings;
create policy "service_role_bypass" on public.platform_settings
  for all to service_role using (true) with check (true);

create table if not exists public.subscription_invoices (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  subscription_id   uuid references public.tenant_subscriptions(id) on delete set null,
  plan_id           uuid references public.subscription_plans(id),
  period            text not null check (period in ('monthly','yearly')),
  amount            integer not null check (amount > 0),
  midtrans_order_id text unique,
  snap_token        text,
  redirect_url      text,
  status            text not null default 'unpaid'
                      check (status in ('unpaid','awaiting_payment','paid','failed','expired')),
  midtrans_mode     text check (midtrans_mode is null or midtrans_mode in ('sandbox','production')),
  payment_type      text,
  paid_at           timestamptz,
  raw_notification  jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists subscription_invoices_tenant_idx on public.subscription_invoices (tenant_id);
create index if not exists subscription_invoices_status_idx on public.subscription_invoices (tenant_id, status);
create index if not exists subscription_invoices_subscription_idx on public.subscription_invoices (subscription_id);
create unique index if not exists subscription_invoices_live_uniq
  on public.subscription_invoices (subscription_id, plan_id, period)
  where status in ('unpaid','awaiting_payment');

alter table public.subscription_invoices enable row level security;
drop policy if exists "service_role_bypass" on public.subscription_invoices;
create policy "service_role_bypass" on public.subscription_invoices
  for all to service_role using (true) with check (true);

drop trigger if exists subscription_invoices_updated_at on public.subscription_invoices;
create trigger subscription_invoices_updated_at
  before update on public.subscription_invoices
  for each row execute function public.handle_updated_at();
