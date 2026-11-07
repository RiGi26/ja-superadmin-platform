import 'server-only'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTenantPortal } from '@/lib/lms-sync'
import { sendSubscriptionPaidEmail } from '@/lib/billing-email'
import type { MidtransMode } from '@/types/billing'

/** The single service-only RPC commits invoice, subscription, tenant and audit
 * together. An error never falls back to the previous multi-request writer.
 */
export async function markVerifiedInvoicePaid(args: {
  midtransOrderId: string; mode: MidtransMode; amount: number; raw: Record<string, unknown>
}) {
  const db = createAdminClient()
  const { data, error } = await db.rpc('apply_verified_subscription_payment', {
    p_order: args.midtransOrderId, p_mode: args.mode, p_amount: args.amount, p_verified_status: args.raw,
  })
  if (error || !data || typeof data.firstTransition !== 'boolean' ||
      typeof data.tenantId !== 'string' || typeof data.invoiceId !== 'string') {
    throw new Error('PAYMENT_COMMIT_UNAVAILABLE')
  }
  // A verified duplicate may repair delivery after a prior network failure.
  // Receipt delivery is queued only by the first committed transition.
  after(() => syncTenantPortal(data.tenantId, 'subscription_activated'))
  if (data.firstTransition) after(() => sendSubscriptionPaidEmail(data.invoiceId))
  return data as { firstTransition: boolean; tenantId: string; invoiceId: string }
}
