import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyNativeCoreSession } from '@/lib/core-registry-native'
import { readCatalogPlans } from '@/lib/plan-catalog-server'
import { approvedOffer, purchaseError } from '@/lib/plan-catalog'
import { stockPriceQuotes } from '@/lib/stock-price-quotes'
import { selfServiceChange } from '@/lib/billing'
import { issueStockBillingAuthority } from '@/lib/stock-billing-authority'
import { sandboxPurchaseAllowed } from '@/lib/billing-sandbox-uat'
import { STOCK_PAID_BILLING_RUNTIME_ENABLED, stockPurchaseAvailable, stockPlanId, stockCompanyId, safeStockPaymentRedirect } from '@/lib/stock-purchase-policy'
import { STOCK_MEMBERSHIP_PREPARATION_ENABLED } from '@/lib/stock-membership-protocol'
import { stockMembershipPurchaseReady } from '@/lib/stock-membership-purchase'

const uuid = z.uuid()
const date = z.iso.datetime({ offset: true })
const invoice = z.object({ id: uuid, planId: uuid, amount: z.number().int().positive(),
  status: z.enum(['unpaid', 'awaiting_payment', 'paid', 'failed', 'expired']),
  createdAt: date, paidAt: date.nullable() }).strict()
export const stockBillingWorkspace = z.object({
  companyId: uuid, companyName: z.string().min(2).max(100), reservationId: uuid,
  coreTenantId: uuid, ownerId: uuid, stockTenantId: uuid.nullable(),
  activation: z.enum(['not_started', 'pending', 'active', 'suspended']),
  hasPaidContract: z.boolean(),
  subscription: z.object({ planId: uuid, status: z.string(), expiresAt: date.nullable() }).strict().nullable(),
  invoices: z.array(invoice).max(20),
}).strict()
export type StockBillingWorkspace = z.infer<typeof stockBillingWorkspace>
export type StockBillingAccount = { status: 'ready'; workspaces: StockBillingWorkspace[] }
  | { status: 'unavailable'; workspaces: [] }

const intent = z.object({ planId: uuid, companyId: uuid.nullable(), reservationId: uuid.nullable(), commandId: uuid }).strict()

async function authenticate() {
  const client = await createClient()
  const actor = await verifyNativeCoreSession(client)
  if (!actor.customer || Date.parse(actor.until) <= Date.now()) throw new Error('CURRENT_CUSTOMER_REQUIRED')
  return { client, actor }
}

async function readOwned(client: Awaited<ReturnType<typeof createClient>>, owner: string) {
  const result = await client.rpc('stock_billing_owned_workspaces')
  if (result.error) throw new Error('BILLING_CONTEXT_UNAVAILABLE')
  const rows = z.array(stockBillingWorkspace).max(20).parse(result.data)
  if (rows.some(row => row.ownerId !== owner) || new Set(rows.map(row => row.companyId)).size !== rows.length) {
    throw new Error('BILLING_CONTEXT_MISMATCH')
  }
  return rows
}

export async function readStockBillingAccount(): Promise<StockBillingAccount> {
  if (!STOCK_PAID_BILLING_RUNTIME_ENABLED) return { status: 'unavailable', workspaces: [] }
  try {
    const { client, actor } = await authenticate()
    const workspaces = await readOwned(client, actor.subject)
    const latest = await verifyNativeCoreSession(client)
    if (!latest.customer || latest.subject !== actor.subject || latest.session !== actor.session) throw new Error('AUTH_CHANGED')
    return { status: 'ready', workspaces }
  } catch { return { status: 'unavailable', workspaces: [] } }
}

export async function readStockPurchaseIntent() {
  if (!STOCK_PAID_BILLING_RUNTIME_ENABLED) return null
  try {
    const { client } = await authenticate()
    const result = await client.rpc('stock_billing_read_intent')
    const parsed = intent.safeParse(result.data)
    return !result.error && parsed.success && stockPlanId(parsed.data.planId) ? parsed.data : null
  } catch { return null }
}

export async function readStockPurchaseOffers(company?: string) {
  const rows = await readCatalogPlans('stock')
  const quote = rows ? stockPriceQuotes(rows) : null
  if (!quote) return null
  if (stockPurchaseAvailable(quote.salesEnabled)) return { ...quote, salesEnabled: true }
  if (STOCK_PAID_BILLING_RUNTIME_ENABLED && company && stockCompanyId(company)) {
    try {
      const { client, actor } = await authenticate()
      const owned = (await readOwned(client, actor.subject)).find(row => row.companyId === company)
      const approved = rows!.filter(row => approvedOffer(row)?.platform === 'stock')
      if (owned && approved.length === 2 && (await Promise.all(approved.map(row => sandboxPurchaseAllowed(row, owned.coreTenantId)))).every(Boolean)) {
        return { ...quote, salesEnabled: true, sandbox: true }
      }
    } catch { /* Public offers stay closed without exact sandbox scope. */ }
  }
  return { ...quote, salesEnabled: false }
}

/** Store only this authenticated customer's package choice across native SSO.
 * The intent never grants business ownership, payment, or portal access. */
export async function rememberStockPurchase(plan: unknown, company?: unknown) {
  const planId = stockPlanId(plan)
  const companyId = company === undefined || company === '' ? null : stockCompanyId(company)
  if (!STOCK_PAID_BILLING_RUNTIME_ENABLED || !planId || (company != null && company !== '' && !companyId)) return null
  try {
    const { client, actor } = await authenticate()
    const rows = await readCatalogPlans('stock')
    // Remembering a verified price choice is preparation only; it grants no sale.
    if (!rows || !rows.some(row => row.id === planId && approvedOffer(row)?.platform === 'stock')) return null
    if (companyId && !(await readOwned(client, actor.subject)).some(row => row.companyId === companyId)) return null
    const latest = await verifyNativeCoreSession(client)
    if (!latest.customer || latest.subject !== actor.subject || latest.session !== actor.session) return null
    const result = await createAdminClient().rpc('stock_billing_remember_intent', {
      p_actor: latest.subject, p_session: latest.session, p_auth_until: latest.until,
      p_plan: planId, p_company: companyId,
    })
    const parsed = intent.safeParse(result.data)
    return !result.error && parsed.success && parsed.data.planId === planId && parsed.data.companyId === companyId ? parsed.data : null
  } catch { return null }
}

export type StockPurchaseResult = { status: 'checkout'; redirectUrl: string }
  | { status: 'paid' | 'closed' | 'denied' | 'preparation_required' | 'pending' | 'unavailable' }

/** Only server-derived Company/resource identity reaches the existing engine. */
export async function startStockPurchase(input: { plan: unknown; company: unknown }): Promise<StockPurchaseResult> {
  const planId = stockPlanId(input.plan)
  const companyId = stockCompanyId(input.company)
  if (!planId || !companyId) return { status: 'denied' }
  if (!STOCK_PAID_BILLING_RUNTIME_ENABLED) return { status: 'closed' }
  try {
    const { client, actor } = await authenticate()
    const workspaces = await readOwned(client, actor.subject)
    const workspace = workspaces.find(row => row.companyId === companyId)
    if (!workspace) return { status: 'denied' }
    if (!workspace.stockTenantId) return { status: 'preparation_required' }
    // A browser retry after successful payment must not create another charge.
    if (workspace.activation === 'pending' || (workspace.subscription?.expiresAt &&
        Date.parse(workspace.subscription.expiresAt) > Date.now() && workspace.hasPaidContract)) {
      return { status: 'paid' }
    }
    if (workspace.activation === 'suspended' && (!workspace.subscription?.expiresAt ||
        Date.parse(workspace.subscription.expiresAt) > Date.now())) return { status: 'denied' }
    const rows = await readCatalogPlans('stock')
    const plan = rows?.find(row => row.id === planId)
    const offer = plan && approvedOffer(plan)
    const issued = workspace.invoices.some(row => row.planId === planId && ['unpaid', 'awaiting_payment'].includes(row.status))
    const ownedContract = workspace.hasPaidContract || issued ? workspace.subscription?.planId ?? null : null
    if (!plan || !offer || offer.platform !== 'stock') return { status: 'closed' }
    const sandbox = await sandboxPurchaseAllowed(plan, workspace.coreTenantId)
    const purchaseRows = sandbox ? rows!.map(row => approvedOffer(row)?.platform === 'stock' ? { ...row, is_active: true, is_for_sale: true } : row) : rows!
    if (purchaseError(sandbox ? { ...plan, is_active: true, is_for_sale: true } : plan, purchaseRows, ownedContract, 'monthly', sandbox ? true : undefined)) return { status: 'closed' }
    if (workspace.subscription && workspace.subscription.planId !== planId) return { status: 'denied' }
    if (workspace.invoices.some(row => ['unpaid', 'awaiting_payment'].includes(row.status) && row.planId !== planId)) return { status: 'pending' }
    if (STOCK_MEMBERSHIP_PREPARATION_ENABLED && !workspace.hasPaidContract &&
        !(await stockMembershipPurchaseReady(client, companyId))) return { status: 'preparation_required' }

    let latest = await verifyNativeCoreSession(client)
    if (!latest.customer || latest.subject !== actor.subject || latest.session !== actor.session) return { status: 'denied' }
    const admin = createAdminClient()
    const prepared = await admin.rpc('stock_billing_prepare_account', {
      p_actor: latest.subject, p_session: latest.session, p_auth_until: latest.until,
      p_company: workspace.companyId, p_reservation: workspace.reservationId, p_plan: planId,
    })
    if (prepared.error || prepared.data?.tenantId !== workspace.coreTenantId || prepared.data?.planId !== planId) return { status: 'unavailable' }
    latest = await verifyNativeCoreSession(client)
    const fresh = (await readOwned(client, actor.subject)).find(row => row.companyId === companyId)
    if (!latest.customer || latest.subject !== actor.subject || latest.session !== actor.session ||
        !fresh || fresh.reservationId !== workspace.reservationId || fresh.coreTenantId !== workspace.coreTenantId ||
        fresh.stockTenantId !== workspace.stockTenantId) return { status: 'denied' }
    if (fresh.activation === 'pending' || (fresh.activation === 'active' && fresh.subscription?.expiresAt &&
        Date.parse(fresh.subscription.expiresAt) > Date.now())) return { status: 'paid' }

    const authority = await issueStockBillingAuthority({ companyId, tenantId: workspace.coreTenantId, planId })
    if (!authority) return { status: 'denied' }
    const result = await selfServiceChange({ tenantId: workspace.coreTenantId, planId, period: 'monthly', durableCheckout: true, stockAuthority: authority })
    if (!result.ok || result.kind !== 'checkout') return { status: 'pending' }
    const stored = await admin.from('subscription_invoices')
      .select('id,tenant_id,plan_id,period,amount,status,midtrans_mode,redirect_url')
      .eq('id', result.invoiceId).eq('tenant_id', workspace.coreTenantId).maybeSingle()
    if (stored.error || stored.data?.plan_id !== planId || stored.data.period !== 'monthly' ||
        Number(stored.data.amount) !== offer.price || stored.data.redirect_url !== result.redirectUrl ||
        !['unpaid', 'awaiting_payment'].includes(stored.data.status)) return { status: 'unavailable' }
    const redirectUrl = safeStockPaymentRedirect(stored.data.redirect_url, stored.data.midtrans_mode)
    return redirectUrl ? { status: 'checkout', redirectUrl } : { status: 'unavailable' }
  } catch {
    // Checkout may already exist after an uncertain response. Never repeat a
    // financial operation here; invoice/order recovery belongs to the engine.
    return { status: 'unavailable' }
  }
}
