import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPromoCampaign, isCampaignActive } from '@/lib/platform-settings'

// Public, read-only status kampanye promo untuk marketing site (corp-landing).
// `active` sudah dihitung server terhadap window tanggal → konsumen tinggal pakai.
// Tanpa auth (data non-sensitif), sejajar /api/public/plans. Cache pendek supaya
// toggle owner cepat terlihat.
export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  try {
    const db = createAdminClient()
    const c = await getPromoCampaign(db)
    return NextResponse.json(
      { active: isCampaignActive(c), discountPct: c.discountPct, tier: c.tier, months: c.months },
      { headers: CORS },
    )
  } catch {
    return NextResponse.json(
      { active: false, discountPct: 0, tier: null, months: 0 },
      { status: 200, headers: CORS },
    )
  }
}
