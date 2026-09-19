-- Customer Hub: tenant may read only its own invoices.
-- Identity comes from the signed tenant_id claim issued by the Core custom JWT hook.

grant select on table public.subscription_invoices to authenticated;

drop policy if exists "tenant_read_own_invoices" on public.subscription_invoices;
create policy "tenant_read_own_invoices"
  on public.subscription_invoices
  for select
  to authenticated
  using (
    tenant_id = nullif((select auth.jwt()) ->> 'tenant_id', '')::uuid
  );
