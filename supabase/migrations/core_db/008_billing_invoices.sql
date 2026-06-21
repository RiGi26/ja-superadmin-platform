-- ============================================================
-- 008_billing_invoices.sql
-- Core DB: jexpxecxylyeefywdzpd
-- Lapisan 2 — Langganan Tenant (tenant membayar platform ke JapanArena)
--
-- Menambah:
--   1. platform_settings (singleton key-value) — simpan mode Midtrans
--      (sandbox|production) supaya bisa di-switch dari /admin tanpa redeploy.
--      Pola identik dengan ja-lms-platform / ja-websitebuilder-platform.
--   2. subscription_invoices — siklus hidup transaksi Snap Midtrans untuk
--      pembayaran LANGGANAN tenant (monthly|yearly). Tiap invoice diikat ke
--      environment pembuatannya (midtrans_mode) untuk money-safety saat
--      verifikasi webhook (cegah notif sandbox melunaskan invoice produksi).
--
-- Idempotent: create ... if not exists, drop policy if exists.
-- RLS: service-role-only (data uang lintas-tenant; superadmin pakai service_role).
-- CATATAN: file ini di-apply ke Core DB via MCP/CLI/SQL Editor (akses owner).
-- ============================================================


-- ── 1. platform_settings ─────────────────────────────────────────────────────
create table if not exists public.platform_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

comment on table public.platform_settings is
  'Setelan tingkat platform (key-value singleton). Service-role-only. Mis. midtrans_mode = sandbox|production untuk switch endpoint Midtrans dari UI tanpa redeploy.';

-- Default mode = sandbox: superadmin belum pernah memakai Midtrans, jadi mulai
-- aman di sandbox sampai owner men-set key production lalu flip dari /admin.
insert into public.platform_settings (key, value)
values ('midtrans_mode', 'sandbox')
on conflict (key) do nothing;

drop policy if exists "service_role_bypass" on public.platform_settings;
create policy "service_role_bypass" on public.platform_settings
  for all to service_role using (true) with check (true);


-- ── 2. subscription_invoices ─────────────────────────────────────────────────
create table if not exists public.subscription_invoices (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  subscription_id   uuid references public.tenant_subscriptions(id) on delete set null,
  plan_id           uuid references public.subscription_plans(id),
  period            text not null check (period in ('monthly','yearly')),
  amount            integer not null check (amount > 0),

  midtrans_order_id text unique,          -- diisi setelah Snap dibuat (insert 2-fase); null sementara diperbolehkan
  snap_token        text,
  redirect_url      text,
  status            text not null default 'unpaid'
                      check (status in ('unpaid','awaiting_payment','paid','failed','expired')),
  midtrans_mode     text check (midtrans_mode is null or midtrans_mode in ('sandbox','production')),
  payment_type      text,                 -- qris|bank_transfer|gopay|... (dari notifikasi Midtrans)
  paid_at           timestamptz,
  raw_notification  jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.subscription_invoices is
  'Siklus hidup transaksi Snap Midtrans untuk langganan tenant (monthly|yearly). midtrans_mode mengikat invoice ke environment pembuatannya untuk verifikasi webhook yang benar.';
comment on column public.subscription_invoices.midtrans_mode is
  'Environment Midtrans saat invoice dibuat (sandbox|production). Webhook/confirm verifikasi pakai mode INI, bukan toggle current. Null = legacy.';
comment on column public.subscription_invoices.period is
  'Periode tagihan langganan: monthly (+1 bulan) atau yearly (+1 tahun).';

-- Index lookup webhook & listing per tenant.
create index if not exists subscription_invoices_tenant_idx
  on public.subscription_invoices (tenant_id);
create index if not exists subscription_invoices_status_idx
  on public.subscription_invoices (tenant_id, status);
create index if not exists subscription_invoices_subscription_idx
  on public.subscription_invoices (subscription_id);

-- Money-safety + idempotensi: cegah dua invoice "hidup" (belum lunas/gagal) untuk
-- kombinasi langganan+paket+periode yang sama. Checkout memakai-ulang invoice
-- hidup yang sudah punya redirect_url alih-alih membuat duplikat.
create unique index if not exists subscription_invoices_live_uniq
  on public.subscription_invoices (subscription_id, plan_id, period)
  where status in ('unpaid','awaiting_payment');

alter table public.subscription_invoices enable row level security;

-- service_role: server route create + webhook update (bypass penuh). Akses
-- superadmin selalu lewat service_role (createAdminClient), jadi tak perlu policy
-- per-tenant di sini — data uang lintas-tenant tidak boleh terbaca anon/authenticated.
drop policy if exists "service_role_bypass" on public.subscription_invoices;
create policy "service_role_bypass" on public.subscription_invoices
  for all to service_role using (true) with check (true);


-- ── 3. updated_at trigger (reuse fungsi 001) ─────────────────────────────────
drop trigger if exists subscription_invoices_updated_at on public.subscription_invoices;
create trigger subscription_invoices_updated_at
  before update on public.subscription_invoices
  for each row execute function public.handle_updated_at();
