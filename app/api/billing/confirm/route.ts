import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { midtransConfigForMode, normalizeOrderMode } from '@/lib/midtrans'
import { markInvoicePaid, markInvoiceStatus } from '@/lib/billing'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

/**
 * POST /api/billing/confirm — poll status invoice dari Midtrans (cadangan
 * webhook). Body: { invoice_id }. Dipanggil halaman "selesai" setelah redirect
 * Snap. Poll memakai environment tempat invoice DIBUAT (bukan toggle current).
 */
export async function POST(request: Request) {
  try {
    const { invoice_id } = (await request.json().catch(() => ({}))) as { invoice_id?: string }
    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id wajib' }, { status: 400 })
    }

    const rl = rateLimit(`billing:confirm:${invoice_id}`, 12, 5 * 60_000)
    if (!rl.allowed) return tooManyRequests(rl.retryAfter)

    const db = createAdminClient()
    const { data: inv } = await db
      .from('subscription_invoices')
      .select('midtrans_order_id, midtrans_mode, status')
      .eq('id', invoice_id)
      .maybeSingle()
    if (!inv?.midtrans_order_id) {
      return NextResponse.json({ error: 'invoice tidak ditemukan' }, { status: 404 })
    }
    if (inv.status === 'paid') return NextResponse.json({ confirmed: true, status: 'paid' })

    const { serverKey, statusApiUrl } = midtransConfigForMode(normalizeOrderMode(inv.midtrans_mode))
    const auth = Buffer.from(`${serverKey}:`).toString('base64')
    const res = await fetch(`${statusApiUrl}/${inv.midtrans_order_id}/status`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    const data = await res.json()

    const isPaid =
      (data.transaction_status === 'capture' && data.fraud_status === 'accept') ||
      data.transaction_status === 'settlement'
    const isPending = data.transaction_status === 'pending'

    if (isPaid) {
      await markInvoicePaid({
        midtransOrderId: inv.midtrans_order_id,
        paymentType: data.payment_type,
        raw: data,
      })
      return NextResponse.json({ confirmed: true, status: 'paid' })
    }
    if (isPending) {
      await markInvoiceStatus({
        midtransOrderId: inv.midtrans_order_id,
        status: 'awaiting_payment',
        paymentType: data.payment_type,
        raw: data,
      })
      return NextResponse.json({ confirmed: false, status: 'awaiting_payment' })
    }
    return NextResponse.json({ confirmed: false, status: data.transaction_status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('[billing/confirm]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
