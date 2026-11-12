import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { approvedOffer, planPeriods, saleablePlans, type CatalogPlan } from '@/lib/plan-catalog'

// Public, read-only price source of truth for marketing sites (corp-landing).
// Returns only active plans and only non-sensitive columns. No auth — carved out
// of the superadmin gate in proxy.ts. Cached at the edge; consumers should also
// cache (ISR) so this is never hit on a user's critical path.
export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)

    if (error) {
      return NextResponse.json({ plans: [] }, { status: 500, headers: CORS })
    }

    const plans = saleablePlans((data ?? []) as (CatalogPlan & { price_monthly: number; price_yearly: number | null; features?: unknown })[]).map((p) => ({
      id: p.id,
      platform: p.platform,
      tier: p.tier,
      tierDisplayName: p.tier_display_name ?? null,
      priceMonthly: Number(p.price_monthly),
      priceYearly: p.price_yearly == null ? null : Number(p.price_yearly),
      offerVersion: p.offer_version ?? null,
      publicTier: p.public_tier ?? null,
      periods: planPeriods(p),
      features: approvedOffer(p)?.features ?? (Array.isArray(p.features) ? p.features.filter((item): item is string => typeof item === 'string') : []),
      maxActiveUsers: approvedOffer(p)?.contract.max_active_users ?? null,
      storageBytes: approvedOffer(p)?.contract.storage_bytes ?? null,
    }))

    return NextResponse.json({ plans }, { headers: CORS })
  } catch {
    return NextResponse.json({ plans: [] }, { status: 500, headers: CORS })
  }
}
