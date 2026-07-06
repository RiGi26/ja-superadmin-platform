import { BillingResult } from './Result'
import { createAdminClient } from '@/lib/supabase/admin'
import { portalDashboardUrl } from '@/lib/portal-urls'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * /billing/selesai — halaman tujuan setelah pembayaran Snap (tenant-facing,
 * publik). Membaca ?inv=<invoice_id> dan poll /api/billing/confirm untuk
 * memastikan status (cadangan webhook). Lookup platform tenant server-side
 * untuk tombol "Masuk ke Dashboard" balik ke portal asal.
 */
export default async function BillingSelesaiPage({
  searchParams,
}: {
  searchParams: Promise<{ inv?: string }>
}) {
  const { inv } = await searchParams

  let portalUrl: string | null = null
  if (inv && UUID_RE.test(inv)) {
    try {
      const db = createAdminClient()
      const { data } = await db
        .from('subscription_invoices')
        .select('tenant_id, tenants(platform)')
        .eq('id', inv)
        .maybeSingle()
      const tenants = data?.tenants as
        | { platform?: string | null }
        | { platform?: string | null }[]
        | null
        | undefined
      const platform = Array.isArray(tenants) ? tenants[0]?.platform : tenants?.platform
      portalUrl = portalDashboardUrl(platform)
    } catch {
      // Lookup gagal → halaman tetap jalan tanpa tombol dashboard.
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-sm">
        <BillingResult invoiceId={inv ?? null} portalUrl={portalUrl} />
      </div>
    </main>
  )
}
