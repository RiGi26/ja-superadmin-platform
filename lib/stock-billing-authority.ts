import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyNativeCoreSession } from '@/lib/core-registry-native'
import { STOCK_PAID_BILLING_RUNTIME_ENABLED, stockPlanId } from '@/lib/stock-purchase-policy'

export type StockBillingAuthority = Readonly<{ kind: 'stock_company_purchase' }>
type Proof = { companyId: string; tenantId: string; planId: string; subject: string; session: string; until: number }
const proofs = new WeakMap<StockBillingAuthority, Proof>()
const selectors = z.object({ companyId: z.uuid(), tenantId: z.uuid(), planId: z.uuid() }).strict()
const context = z.array(z.object({ companyId: z.uuid(), coreTenantId: z.uuid(), ownerId: z.uuid(), stockTenantId: z.uuid().nullable() }).passthrough()).max(20)

/** A legacy HMAC billing link is never sufficient Company Owner authority. */
export async function managedStockBilling(tenantId: string): Promise<'managed' | 'legacy' | 'unavailable'> {
  if (!STOCK_PAID_BILLING_RUNTIME_ENABLED) return 'legacy'
  try {
    const result = await createAdminClient().rpc('stock_billing_is_managed', { p_tenant: tenantId })
    return result.error || typeof result.data !== 'boolean' ? 'unavailable' : result.data ? 'managed' : 'legacy'
  } catch { return 'unavailable' }
}

/** This server-only issuer independently verifies current ownership. The opaque
 * reference never crosses a browser/JSON boundary and is not a bearer token. */
export async function issueStockBillingAuthority(input: unknown): Promise<StockBillingAuthority | null> {
  const parsed = selectors.safeParse(input)
  if (!STOCK_PAID_BILLING_RUNTIME_ENABLED || !parsed.success || !stockPlanId(parsed.data.planId)) return null
  try {
    const client = await createClient()
    const actor = await verifyNativeCoreSession(client)
    if (!actor.customer) return null
    const owned = await client.rpc('stock_billing_owned_workspaces')
    const rows = context.safeParse(owned.data)
    if (owned.error || !rows.success || !rows.data.some(row => row.companyId === parsed.data.companyId &&
        row.coreTenantId === parsed.data.tenantId && row.ownerId === actor.subject && row.stockTenantId !== null)) return null
    const latest = await verifyNativeCoreSession(client)
    if (!latest.customer || latest.subject !== actor.subject || latest.session !== actor.session || Date.parse(latest.until) <= Date.now()) return null
    const authority: StockBillingAuthority = Object.freeze({ kind: 'stock_company_purchase' })
    proofs.set(authority, { ...parsed.data, subject: latest.subject, session: latest.session, until: Date.parse(latest.until) })
    return authority
  } catch { return null }
}

/** Every existing financial entrypoint shares this guard. A serialized lookalike,
 * another request's context, or a portal-admin link cannot manufacture a proof. */
export async function stockBillingOperationError(tenantId: string, planId?: string | null, period?: string | null, authority?: StockBillingAuthority) {
  const managed = await managedStockBilling(tenantId)
  if (managed === 'legacy') {
    if (!STOCK_PAID_BILLING_RUNTIME_ENABLED || !stockPlanId(planId)) return null
    // A legacy token cannot start a new Company offer on an unmapped business.
    // Preserve only a previously paid exact contract's monthly renewal.
    if (period !== 'monthly') return { ok: false as const, status: 403, error: 'Pilih paket Stock melalui Customer Hub sebagai Owner usaha.' }
    try {
      const admin = createAdminClient()
      const [subscription, paid] = await Promise.all([
        admin.from('tenant_subscriptions').select('plan_id').eq('tenant_id', tenantId).eq('plan_id', planId!).limit(1).maybeSingle(),
        admin.from('subscription_invoices').select('id').eq('tenant_id', tenantId).eq('plan_id', planId!).eq('status', 'paid').limit(1).maybeSingle(),
      ])
      if (subscription.error || paid.error) return { ok: false as const, status: 503, error: 'Kontrak berjalan belum dapat diverifikasi.' }
      if (subscription.data?.plan_id === planId && paid.data?.id) return null
    } catch { return { ok: false as const, status: 503, error: 'Kontrak berjalan belum dapat diverifikasi.' } }
    return { ok: false as const, status: 403, error: 'Pilih paket Stock melalui Customer Hub sebagai Owner usaha.' }
  }
  if (managed === 'unavailable') return { ok: false as const, status: 503, error: 'Akses pembayaran belum dapat diverifikasi.' }
  const proof = authority && proofs.get(authority)
  if (!proof || proof.tenantId !== tenantId || proof.planId !== planId || period !== 'monthly' || proof.until <= Date.now()) {
    return { ok: false as const, status: 403, error: 'Masuk sebagai Owner usaha melalui Customer Hub untuk mengelola pembayaran Stock.' }
  }
  try {
    const client = await createClient()
    const latest = await verifyNativeCoreSession(client)
    if (!latest.customer || latest.subject !== proof.subject || latest.session !== proof.session || Date.parse(latest.until) <= Date.now()) {
      return { ok: false as const, status: 403, error: 'Sesi Owner berubah. Masuk kembali melalui Customer Hub.' }
    }
    const owned = await client.rpc('stock_billing_owned_workspaces')
    const rows = context.safeParse(owned.data)
    if (!owned.error && rows.success && rows.data.some(row => row.companyId === proof.companyId &&
        row.coreTenantId === tenantId && row.ownerId === proof.subject && row.stockTenantId !== null)) return null
  } catch { /* Revocation or an unavailable provider never grants billing access. */ }
  return { ok: false as const, status: 403, error: 'Sesi Owner berubah. Masuk kembali melalui Customer Hub.' }
}
