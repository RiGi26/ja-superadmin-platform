import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { BASIC_PRO_VERSION } from '@/lib/plan-catalog'
import { stockPriceQuotes } from '@/lib/stock-price-quotes'
import type { StockPlanChoice } from '@/lib/customer-onboarding'

/** Public price information only. Inactive offers never become purchase authority. */
export async function getStockStoreCatalog(): Promise<StockPlanChoice[]> {
  try {
    const { data, error } = await createAdminClient().from('subscription_plans')
      .select('id,platform,tier,tier_display_name,price_monthly,price_yearly,offer_version,public_tier,allowed_periods,entitlement_contract')
      .eq('platform', 'stock').eq('offer_version', BASIC_PRO_VERSION)
      .abortSignal(AbortSignal.timeout(3500))
    const quote = !error && data ? stockPriceQuotes(data) : null
    return quote ? quote.plans.map(plan => ({
      id: plan!.id, tier: plan!.tier, name: plan!.tierDisplayName,
      priceMonthly: plan!.priceMonthly, priceYearly: null, features: plan!.features,
    })) : []
  } catch { return [] }
}
