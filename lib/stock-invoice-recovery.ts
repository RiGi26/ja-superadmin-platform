import 'server-only'
import { z } from 'zod'
import { readStockBillingAccount } from '@/lib/stock-self-payment'
import { STOCK_PAID_BILLING_RUNTIME_ENABLED } from '@/lib/stock-purchase-policy'
import { createAdminClient } from '@/lib/supabase/admin'
import { readVerifiedMidtransPayment } from '@/lib/midtrans-payment'
import { markVerifiedInvoicePaid } from '@/lib/verified-subscription-payment'
import { markInvoiceStatus } from '@/lib/billing'
import { deliverStockPaidActivation } from '@/lib/stock-paid-activation'
import { after } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

/** Recheck an already issued invoice. This path cannot create a charge. */
export async function refreshStockInvoice(invoiceId: unknown): Promise<void> {
  if (!STOCK_PAID_BILLING_RUNTIME_ENABLED || !z.uuid().safeParse(invoiceId).success) return
  try {
    const account = await readStockBillingAccount()
    if (account.status !== 'ready') return
    const workspace = account.workspaces.find(row => row.invoices.some(invoice => invoice.id === invoiceId))
    const own = workspace?.invoices.find(invoice => invoice.id === invoiceId)
    if (!workspace || !own) return
    if (!rateLimit(`stock:invoice:${own.id}`, 12, 5 * 60_000).allowed) return
    const stored = await createAdminClient().from('subscription_invoices')
      .select('id,tenant_id,plan_id,period,amount,status,midtrans_order_id,midtrans_mode')
      .eq('id', own.id).eq('tenant_id', workspace.coreTenantId).maybeSingle()
    const invoice = stored.data
    if (stored.error || !invoice || invoice.id !== own.id || invoice.tenant_id !== workspace.coreTenantId ||
        invoice.plan_id !== own.planId || invoice.period !== 'monthly' || Number(invoice.amount) !== own.amount ||
        !invoice.midtrans_order_id || !['sandbox', 'production'].includes(invoice.midtrans_mode)) return
    // Recheck current native Owner after the privileged invoice read.
    const fresh = await readStockBillingAccount()
    if (fresh.status !== 'ready' || !fresh.workspaces.some(row => row.companyId === workspace.companyId &&
        row.coreTenantId === workspace.coreTenantId && row.invoices.some(item => item.id === own.id))) return
    if (invoice.status === 'paid') {
      after(() => deliverStockPaidActivation(workspace.coreTenantId, own.id).then(() => {}))
      return
    }
    if (!['unpaid', 'awaiting_payment'].includes(invoice.status)) return
    const verified = await readVerifiedMidtransPayment(invoice)
    if (verified.paid) {
      await markVerifiedInvoicePaid({ midtransOrderId: invoice.midtrans_order_id, mode: verified.mode,
        amount: verified.amount, raw: verified.data })
    } else if (verified.failed) {
      await markInvoiceStatus({ midtransOrderId: invoice.midtrans_order_id,
        status: verified.status === 'expire' ? 'expired' : 'failed', paymentType: verified.paymentType, raw: verified.data })
    }
  } catch { /* Unknown provider results stay pending; never issue another charge. */ }
}
