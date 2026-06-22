import { BillingResult } from './Result'

/**
 * /billing/selesai — halaman tujuan setelah pembayaran Snap (tenant-facing,
 * publik). Membaca ?inv=<invoice_id> dan poll /api/billing/confirm untuk
 * memastikan status (cadangan webhook).
 */
export default async function BillingSelesaiPage({
  searchParams,
}: {
  searchParams: Promise<{ inv?: string }>
}) {
  const { inv } = await searchParams

  return (
    <main className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-sm">
        <BillingResult invoiceId={inv ?? null} />
      </div>
    </main>
  )
}
