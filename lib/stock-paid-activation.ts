import 'server-only'

import { createHmac, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { APPROVED_OFFERS, BASIC_PRO_VERSION } from '@/lib/plan-catalog'
import { STOCK_E1_APP_ORIGIN } from '@/lib/e1-realm'
import { STOCK_PAID_BILLING_RUNTIME_ENABLED } from '@/lib/stock-purchase-policy'

const uuid = z.uuid()
const date = z.iso.datetime({ offset: true })
const payloadSchema = z.object({
  kind: z.literal('stock_paid_activation_v1'), invoiceId: uuid, deliveryId: uuid,
  companyId: uuid, reservationId: uuid, coreTenantId: uuid, coreSubject: uuid,
  stockTenantId: uuid, stockSubject: uuid, profileId: uuid, stockAuditEventId: uuid,
  planId: uuid, offerVersion: z.literal(BASIC_PRO_VERSION), publicTier: z.enum(['basic', 'pro']),
  planDisplayName: z.enum(['Basic', 'Pro']), planTier: z.enum(['starter', 'growth']),
  features: z.array(z.string()), maxActiveUsers: z.number().int().positive(),
  amount: z.number().int().positive(), mode: z.enum(['sandbox', 'production']), expiresAt: date, validUntil: date,
}).strict()
const receiptSchema = z.object({ status: z.literal('active'), invoiceId: uuid, deliveryId: uuid,
  companyId: uuid, stockTenantId: uuid, profileId: uuid }).strict()

export type StockActivationDelivery = 'closed' | 'not_applicable' | 'pending' | 'active'

/** Only committed Core outbox state is signed. No caller supplies an activation
 * tuple, price, recipient URL, or entitlement. Delivery is safe to retry. */
export async function deliverStockPaidActivation(tenantId: string): Promise<StockActivationDelivery> {
  if (!STOCK_PAID_BILLING_RUNTIME_ENABLED) return 'closed'
  if (!uuid.safeParse(tenantId).success) return 'pending'
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret || secret.length < 32) return 'pending'
  try {
    const admin = createAdminClient()
    const claimed = await admin.rpc('stock_billing_claim_activation', { p_tenant: tenantId })
    if (claimed.error) return 'pending'
    if (claimed.data === null) return 'not_applicable'
    const parsed = payloadSchema.safeParse(claimed.data)
    if (!parsed.success) return 'pending'
    const payload = parsed.data
    const identity = await admin.auth.admin.getUserById(payload.coreSubject)
    const user = identity.data.user as (typeof identity.data.user & { deleted_at?: string | null; banned_until?: string | null })
    if (identity.error || !user || user.id !== payload.coreSubject || user.is_anonymous !== false ||
        !user.email_confirmed_at || user.deleted_at || (user.banned_until && !(Date.parse(user.banned_until) <= Date.now()))) return 'pending'
    const offer = APPROVED_OFFERS.find(row => row.platform === 'stock' && row.id === payload.planId)
    if (!offer || payload.coreTenantId !== tenantId || payload.publicTier !== offer.publicTier ||
        payload.planDisplayName !== offer.name || payload.planTier !== offer.contract.portal_tier ||
        payload.amount !== offer.price || payload.maxActiveUsers !== offer.contract.max_active_users ||
        payload.features.length !== offer.contract.features.length ||
        !offer.contract.features.every(feature => payload.features.includes(feature)) ||
        Date.parse(payload.expiresAt) <= Date.now() || Date.parse(payload.validUntil) <= Date.now() ||
        Date.parse(payload.validUntil) > Date.now() + 30_000) return 'pending'
    const body = JSON.stringify(payload)
    const timestamp = String(Date.now())
    const nonce = randomBytes(16).toString('hex')
    const signature = createHmac('sha256', secret).update(`${timestamp}\n${nonce}\n${body}`).digest('hex')
    const response = await fetch(`${STOCK_E1_APP_ORIGIN}/api/billing/activate`, {
      method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8_000),
      headers: { 'Content-Type': 'application/json', 'x-ja-timestamp': timestamp, 'x-ja-nonce': nonce, 'x-ja-signature': signature },
      body,
    })
    if (response.status !== 200 || response.redirected || !response.headers.get('content-type')?.includes('application/json')) {
      await response.body?.cancel().catch(() => {})
      return 'pending'
    }
    const receipt = receiptSchema.safeParse(await response.json())
    if (!receipt.success || receipt.data.invoiceId !== payload.invoiceId || receipt.data.deliveryId !== payload.deliveryId ||
        receipt.data.companyId !== payload.companyId || receipt.data.stockTenantId !== payload.stockTenantId ||
        receipt.data.profileId !== payload.profileId) return 'pending'
    const acknowledged = await admin.rpc('stock_billing_ack_activation', { p_invoice: payload.invoiceId, p_receipt: receipt.data })
    return !acknowledged.error && acknowledged.data === true ? 'active' : 'pending'
  } catch { return 'pending' }
}

/** Reuse the existing authenticated lifecycle cron; no additional scheduler. */
export async function reconcileStockPaidActivations(): Promise<void> {
  if (!STOCK_PAID_BILLING_RUNTIME_ENABLED) return
  try {
    const pending = await createAdminClient().rpc('stock_billing_pending_tenants')
    const rows = z.array(uuid).max(50).safeParse(pending.data)
    if (pending.error || !rows.success) return
    // Keep a bounded number of HTTP/DB operations in flight.
    for (let index = 0; index < rows.data.length; index += 5) {
      await Promise.all(rows.data.slice(index, index + 5).map(deliverStockPaidActivation))
    }
  } catch { /* A later lifecycle run retries the persisted outbox. */ }
}
