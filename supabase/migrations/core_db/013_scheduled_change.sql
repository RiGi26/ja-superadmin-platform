-- 013_scheduled_change.sql
-- Dukungan upgrade/downgrade tier "scheduled change" (keputusan 2026-06-25):
--   - UPGRADE  = berlaku seketika, ditagih PRO-RATA sisa periode (tak menambah periode).
--   - DOWNGRADE= dijadwalkan; berlaku saat perpanjangan berikutnya (tak mencabut
--                fitur yang sudah dibayar). Disimpan di scheduled_plan_id.
-- Renewal tetap MANUAL (Snap sekali bayar per periode; tak ada auto-charge).

-- Paket tujuan downgrade yang dijadwalkan (NULL = tak ada penjadwalan).
alter table public.tenant_subscriptions
  add column if not exists scheduled_plan_id uuid references public.subscription_plans(id),
  add column if not exists scheduled_plan_set_at timestamptz;

-- Jenis perubahan pada sebuah invoice, dipakai markInvoicePaid untuk memutuskan
-- apakah PERIODE diperpanjang:
--   'renew'   = aktivasi pertama / perpanjangan / pembelian penuh → +1 siklus.
--   'upgrade' = upgrade pro-rata di tengah periode → set tier, periode TIDAK ditambah.
alter table public.subscription_invoices
  add column if not exists change_type text not null default 'renew';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscription_invoices_change_type_check'
  ) then
    alter table public.subscription_invoices
      add constraint subscription_invoices_change_type_check
      check (change_type in ('renew', 'upgrade'));
  end if;
end $$;

-- Covering index untuk FK baru (standar DB hygiene).
create index if not exists idx_tenant_subscriptions_scheduled_plan_id
  on public.tenant_subscriptions(scheduled_plan_id)
  where scheduled_plan_id is not null;

comment on column public.tenant_subscriptions.scheduled_plan_id is
  'Paket downgrade terjadwal; diterapkan saat perpanjangan berikutnya. NULL = tidak ada.';
comment on column public.subscription_invoices.change_type is
  'renew (perpanjang/aktivasi, +1 periode) | upgrade (pro-rata, periode tak ditambah).';
