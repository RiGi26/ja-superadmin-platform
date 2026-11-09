import { APPROVED_OFFERS } from '@/lib/plan-catalog'
import type { StockBillingWorkspace } from '@/lib/stock-self-payment'

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
const statusLabels = {
  unpaid: 'Belum dibayar',
  awaiting_payment: 'Menunggu pembayaran',
  paid: 'Lunas',
  failed: 'Pembayaran gagal',
  expired: 'Tagihan kedaluwarsa',
}

export function formatStockBillingDate(value: string) {
  return date.format(new Date(value))
}

export function stockInvoiceDisplay(companyName: string, invoice: StockBillingWorkspace['invoices'][number]) {
  const offer = APPROVED_OFFERS.find(item => item.platform === 'stock' && item.id === invoice.planId)
  return {
    company: companyName.replace(/\s+/gu, ' ').trim(),
    reference: invoice.id,
    offer,
    plan: offer?.name ?? 'Paket Stock',
    createdAt: formatStockBillingDate(invoice.createdAt),
    paidAt: invoice.paidAt ? formatStockBillingDate(invoice.paidAt) : '—',
    amount: money.format(invoice.amount),
    status: statusLabels[invoice.status],
  }
}

export function stockInvoiceDetailRows(display: ReturnType<typeof stockInvoiceDisplay>) {
  return [
    ['Usaha', display.company],
    ['Referensi tagihan', display.reference],
    ['Paket', display.plan],
    ['Tanggal tagihan', display.createdAt],
    ['Tanggal bayar', display.paidAt],
    ['Jumlah', display.amount],
    ['Status', display.status],
  ] as const
}
