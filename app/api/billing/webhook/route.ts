import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyMidtransSignature, normalizeOrderMode } from '@/lib/midtrans'
import { readVerifiedMidtransPayment } from '@/lib/midtrans-payment'
import { markInvoiceStatus } from '@/lib/billing'
import { markVerifiedInvoicePaid } from '@/lib/verified-subscription-payment'

/**
 * POST /api/billing/webhook — notifikasi Midtrans untuk invoice langganan.
 * Invalid/unknown notifications are ignored. Transient verification failures
 * return 503 so Midtrans can retry; payment state comes from the Status API.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
    } = body

    if (!order_id || typeof order_id !== 'string' || order_id.length > 100 ||
        typeof status_code !== 'string' || typeof gross_amount !== 'string' ||
        typeof signature_key !== 'string') {
      return NextResponse.json({ received: true, note: 'missing_order_id' })
    }

    const db = createAdminClient()
    const { data: row, error } = await db
      .from('subscription_invoices')
      .select('midtrans_order_id, midtrans_mode, amount')
      .eq('midtrans_order_id', order_id)
      .maybeSingle()
    if (error) throw new Error('MIDTRANS_INVOICE_LOOKUP_FAILED')
    if (!row) return NextResponse.json({ received: true, note: 'unknown_order' })
    const mode = normalizeOrderMode(row?.midtrans_mode)

    if (
      !verifyMidtransSignature({
        orderId: order_id,
        statusCode: status_code,
        grossAmount: gross_amount,
        signatureKey: signature_key,
        mode,
      })
    ) {
      return NextResponse.json({ received: true, note: 'signature_mismatch' })
    }

    const verified = await readVerifiedMidtransPayment(row)

    if (verified.paid) {
      // markInvoicePaid triggers the Stock entitlement sync on first transition
      // (centralized there so the confirm-poll path also covers it).
      await markVerifiedInvoicePaid({ midtransOrderId: order_id, mode: verified.mode, amount: verified.amount, raw: verified.data })
    } else if (verified.pending) {
      await markInvoiceStatus({
        midtransOrderId: order_id,
        status: 'awaiting_payment',
        paymentType: verified.paymentType,
        raw: verified.data,
      })
    } else if (verified.failed) {
      await markInvoiceStatus({
        midtransOrderId: order_id,
        status: verified.status === 'expire' ? 'expired' : 'failed',
        paymentType: verified.paymentType,
        raw: verified.data,
      })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[billing/webhook] verification or persistence unavailable', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ received: false, error: 'payment_verification_unavailable' }, { status: 503 })
  }
}
