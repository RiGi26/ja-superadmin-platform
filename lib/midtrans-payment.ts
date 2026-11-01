import 'server-only'
import { midtransConfigForMode, normalizeOrderMode } from '@/lib/midtrans'

type InvoicePayment = {
  midtrans_order_id: string
  midtrans_mode: string | null
  amount: number | string
}

/** Both webhook and finish-page polling verify the original invoice environment.
 * Notification fields alone never establish the current payment state.
 */
export async function readVerifiedMidtransPayment(invoice: InvoicePayment) {
  const amount = Number(invoice.amount)
  if (!invoice.midtrans_order_id || invoice.midtrans_order_id.length > 100 ||
      !Number.isSafeInteger(amount) || amount < 0 ||
      (invoice.midtrans_mode !== null && !['sandbox', 'production'].includes(invoice.midtrans_mode))) {
    throw new Error('MIDTRANS_INVOICE_INVALID')
  }
  const { serverKey, statusApiUrl, mode } = midtransConfigForMode(normalizeOrderMode(invoice.midtrans_mode))
  const response = await fetch(`${statusApiUrl}/${encodeURIComponent(invoice.midtrans_order_id)}/status`, {
    headers: { Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}` },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000),
  })
  if (!response.ok) throw new Error('MIDTRANS_STATUS_UNAVAILABLE')
  const data = await response.json()
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.order_id !== invoice.midtrans_order_id || data.currency !== 'IDR' ||
      typeof data.gross_amount !== 'string' || !/^\d+(?:\.00)?$/.test(data.gross_amount) ||
      Number(data.gross_amount) !== amount ||
      !['200', '201', '202', '407'].includes(data.status_code) ||
      typeof data.transaction_status !== 'string') {
    throw new Error('MIDTRANS_STATUS_MISMATCH')
  }
  const paid = data.status_code === '200' &&
    ['capture', 'settlement'].includes(data.transaction_status) &&
    (data.fraud_status === undefined || data.fraud_status === 'accept')
  return { data: data as Record<string, unknown>, paid, mode, amount,
    pending: data.transaction_status === 'pending',
    failed: ['deny', 'cancel', 'expire'].includes(data.transaction_status),
    status: data.transaction_status as string,
    paymentType: typeof data.payment_type === 'string' ? data.payment_type : null }
}
