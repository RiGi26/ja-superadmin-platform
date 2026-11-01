import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stockPriceQuotes } from '@/lib/stock-price-quotes'
import { BASIC_PRO_VERSION } from '@/lib/plan-catalog'
import { stockPurchaseAvailable } from '@/lib/stock-purchase-policy'

export const dynamic = 'force-dynamic'
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, s-maxage=300' }

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers })
}

export async function GET() {
  try {
    const db = createAdminClient()
    const { data, error } = await db.from('subscription_plans')
      .select('id,platform,tier,tier_display_name,price_monthly,price_yearly,offer_version,public_tier,allowed_periods,entitlement_contract,is_active,is_for_sale')
      .eq('platform', 'stock').eq('offer_version', BASIC_PRO_VERSION)
    const quote = !error && data ? stockPriceQuotes(data) : null
    if (quote) return NextResponse.json({ ...quote, salesEnabled: stockPurchaseAvailable(quote.salesEnabled) }, { headers })
  } catch { /* A missing or changed contract has no fallback price. */ }
  return NextResponse.json({ plans: [], salesEnabled: false }, {
    status: 503, headers: { ...headers, 'Cache-Control': 'no-store' },
  })
}
