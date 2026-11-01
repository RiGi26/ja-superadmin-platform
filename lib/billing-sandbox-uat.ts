import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { approvedOffer, type CatalogPlan } from '@/lib/plan-catalog'
import { STOCK_PAID_BILLING_RUNTIME_ENABLED } from '@/lib/stock-purchase-policy'

/** A finite database-owned test cohort can exercise the normal purchase engine
 * with inactive approved offers. It cannot enable ordinary sales or Production
 * payments; all keys, amounts and ownership still pass the normal server checks.
 */
export async function sandboxPurchaseAllowed(plan: CatalogPlan, tenantId: string): Promise<boolean> {
  if (process.env.BILLING_SANDBOX_UAT_ENABLED !== 'true' ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://hxhusfkrlafxdnyasmsu.supabase.co' ||
      process.env.WEBZOKA_HUB_APP_URL !== 'https://hub.webzoka.com' ||
      plan.platform !== 'stock' || !approvedOffer(plan)) return false
  try {
    const result = await createAdminClient().rpc('billing_sandbox_uat_allowed', {
      p_tenant: tenantId, p_plan: plan.id,
    }).abortSignal(AbortSignal.timeout(1500))
    if (!result.error && result.data === true) return true
    if (!STOCK_PAID_BILLING_RUNTIME_ENABLED) return false
    const company = await createAdminClient().rpc('stock_billing_sandbox_allowed', { p_tenant: tenantId, p_plan: plan.id })
      .abortSignal(AbortSignal.timeout(1500))
    return !company.error && company.data === true
  } catch { return false }
}

export async function prepareSandboxCheckoutPlan<T extends CatalogPlan>(plan: T, tenantId: string) {
  const sandboxUat = await sandboxPurchaseAllowed(plan, tenantId)
  return { plan: sandboxUat ? { ...plan, is_active: true, is_for_sale: true } : plan, sandboxUat }
}

export function sandboxNotificationHeaders(sandboxUat: boolean): Record<string, string> {
  return sandboxUat ? { 'X-Override-Notification': 'https://hub.webzoka.com/api/billing/webhook' } : {}
}

// The original legacy sandbox cohort retains its exact return/replay behavior.
// Company eligibility does not inherit a legacy fixture's redirect or diagnostic.
async function legacySandboxCohortAllowed(tenantId: string): Promise<boolean> {
  if (process.env.BILLING_SANDBOX_UAT_ENABLED !== 'true' ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://hxhusfkrlafxdnyasmsu.supabase.co' ||
      process.env.WEBZOKA_HUB_APP_URL !== 'https://hub.webzoka.com') return false
  try {
    const result = await createAdminClient().rpc('billing_sandbox_uat_allowed', {
      p_tenant: tenantId, p_plan: '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001',
    }).abortSignal(AbortSignal.timeout(1500))
    return !result.error && result.data === true
  } catch { return false }
}

export async function sandboxBillingReturnUrl(tenantId: string, normalUrl: string | null): Promise<string | null> {
  return await legacySandboxCohortAllowed(tenantId) ? 'https://webzoka-stock-platform.vercel.app/dashboard' : normalUrl
}

export async function sandboxSyncReplayProbeAllowed(tenantId: string): Promise<boolean> {
  return process.env.BILLING_SANDBOX_REPLAY_PROBE_ENABLED === 'true' && await legacySandboxCohortAllowed(tenantId)
}
