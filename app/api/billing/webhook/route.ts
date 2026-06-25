import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyMidtransSignature, normalizeOrderMode } from '@/lib/midtrans'
import { markInvoicePaid, markInvoiceStatus } from '@/lib/billing'
import { syncStockTenant } from '@/lib/stock-sync'

/**
 * POST /api/billing/webhook — notifikasi Midtrans untuk invoice langganan.
 * Selalu return 200 (non-200 memicu retry Midtrans). Signature diverifikasi
 * terhadap environment invoice (money-safety); yang invalid di-log & diabaikan.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
    } = body

    if (!order_id || typeof order_id !== 'string') {
      return NextResponse.json({ received: true, note: 'missing_order_id' })
    }

    const db = createAdminClient()
    const { data: row } = await db
      .from('subscription_invoices')
      .select('midtrans_mode')
      .eq('midtrans_order_id', order_id)
      .maybeSingle()
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
      console.warn('[billing/webhook] invalid signature:', order_id)
      return NextResponse.json({ received: true, note: 'signature_mismatch' })
    }

    const isPaid =
      (transaction_status === 'capture' && fraud_status === 'accept') ||
      transaction_status === 'settlement'
    const isPending = transaction_status === 'pending'
    const isFailed = ['deny', 'cancel', 'expire'].includes(transaction_status)

    if (isPaid) {
      const res = await markInvoicePaid({ midtransOrderId: order_id, paymentType: payment_type, raw: body })
      // Mirror the new entitlement to the Stock portal (skips non-stock tenants),
      // fire-and-forget so the webhook ACKs Midtrans fast. Reconcile = safety net.
      if (res.firstTransition && res.tenantId) {
        const tid = res.tenantId
        after(() => syncStockTenant(tid, 'subscription_activated'))
      }
    } else if (isPending) {
      await markInvoiceStatus({
        midtransOrderId: order_id,
        status: 'awaiting_payment',
        paymentType: payment_type,
        raw: body,
      })
    } else if (isFailed) {
      await markInvoiceStatus({
        midtransOrderId: order_id,
        status: transaction_status === 'expire' ? 'expired' : 'failed',
        paymentType: payment_type,
        raw: body,
      })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('[billing/webhook]', message)
    return NextResponse.json({ received: true, error: message }) // tetap 200
  }
}
