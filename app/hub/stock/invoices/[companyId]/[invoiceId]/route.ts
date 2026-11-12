import { readStockBillingInvoice } from '@/lib/stock-self-payment'
import { stockInvoiceDetailRows, stockInvoiceDisplay } from '@/lib/stock-invoice-display'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ companyId: string; invoiceId: string }> }) {
  const { companyId, invoiceId } = await params
  const record = await readStockBillingInvoice(companyId, invoiceId)
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!record) return new Response(null, { status: 404, headers })

  const display = stockInvoiceDisplay(record.companyName, record.invoice)
  const rows = stockInvoiceDetailRows(display).map(([label, value]) => `${label}: ${value}`)
  const document = ['Rincian tagihan Webzoka Stock', '', ...rows, ''].join('\n')
  return new Response(document, { headers: {
    ...headers,
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': `attachment; filename="webzoka-stock-${record.invoice.id}.txt"`,
  } })
}
