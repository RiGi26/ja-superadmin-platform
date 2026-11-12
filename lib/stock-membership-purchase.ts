import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { STOCK_MEMBERSHIP_PREPARATION_ENABLED } from '@/lib/stock-membership-protocol'
import { stockCompanyId } from '@/lib/stock-purchase-policy'

/** Read through the current native Core session. The RPC verifies current
 * Company ownership and reciprocal committed preparation; URLs are not proof.
 */
export async function stockMembershipPurchaseReady(client: SupabaseClient, company: string): Promise<boolean> {
  if (!STOCK_MEMBERSHIP_PREPARATION_ENABLED || typeof company !== 'string' || stockCompanyId(company) !== company) return false
  try {
    const result = await client.rpc('core_stock_membership_purchase_readiness', { p_company: company })
      .abortSignal(AbortSignal.timeout(2500))
    const value = result.data
    return !result.error && value !== null && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).sort().join(',') === 'companyId,ready' && value.companyId === company && value.ready === true
  } catch { return false }
}
