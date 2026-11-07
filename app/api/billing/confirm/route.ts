import { after, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readVerifiedMidtransPayment } from '@/lib/midtrans-payment'
import { markInvoiceStatus } from '@/lib/billing'
import { markVerifiedInvoicePaid } from '@/lib/verified-subscription-payment'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { syncTenantPortal } from '@/lib/lms-sync'

/**
 * POST /api/billing/confirm — poll status invoice dari Midtrans (cadangan
 * webhook). Body: { invoice_id }. Dipanggil halaman "selesai" setelah redirect
 * Snap. Poll memakai environment tempat invoice DIBUAT (bukan toggle current).
 */
export async function POST(request: Request) {
  try {
    const { invoice_id } = (await request.json().catch(() => ({}))) as { invoice_id?: string }
    if (typeof invoice_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice_id)) {
      return NextResponse.json({ error: 'invoice_id wajib' }, { status: 400 })
    }

    const rl = rateLimit(`billing:confirm:${invoice_id}`, 12, 5 * 60_000)
    if (!rl.allowed) return tooManyRequests(rl.retryAfter)

    const db = createAdminClient()
    const { data: inv, error } = await db
      .from('subscription_invoices')
      .select('midtrans_order_id, midtrans_mode, amount, status, tenant_id')
      .eq('id', invoice_id)
      .maybeSingle()
    if (error) throw new Error('PAYMENT_INVOICE_UNAVAILABLE')
    if (!inv?.midtrans_order_id) {
      return NextResponse.json({ error: 'invoice tidak ditemukan' }, { status: 404 })
    }
    if (inv.status === 'paid') {
      // A finish-page retry can repair portal delivery without another payment,
      // period extension or receipt email. The Core ledger remains authoritative.
      after(() => syncTenantPortal(inv.tenant_id, 'payment_reconciled'))
      return NextResponse.json({ confirmed: true, status: 'paid' })
    }

    const verified = await readVerifiedMidtransPayment(inv)

    if (verified.paid) {
      await markVerifiedInvoicePaid({
        midtransOrderId: inv.midtrans_order_id,
        mode: verified.mode, amount: verified.amount, raw: verified.data,
      })
      return NextResponse.json({ confirmed: true, status: 'paid' })
    }
    if (verified.pending) {
      await markInvoiceStatus({
        midtransOrderId: inv.midtrans_order_id,
        status: 'awaiting_payment',
        paymentType: verified.paymentType,
        raw: verified.data,
      })
      return NextResponse.json({ confirmed: false, status: 'awaiting_payment' })
    }
    return NextResponse.json({ confirmed: false, status: verified.status })
  } catch (err) {
    console.error('[billing/confirm] verification unavailable', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'payment_verification_unavailable' }, { status: 503 })
  }
}
