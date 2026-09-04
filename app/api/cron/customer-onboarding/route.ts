import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { provisionStockOnboarding } from '@/lib/customer-onboarding'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || !token) return false
  const expected = Buffer.from(secret)
  const provided = Buffer.from(token)
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided)
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('customer_onboarding')
    .select('id')
    .in('status', ['provisioning', 'portal_failed'])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order('updated_at', { ascending: true })
    .limit(20)

  if (error) {
    console.error('[CustomerOnboardingCron] Queue read failed', { code: error.code })
    return NextResponse.json({ ok: false, processed: 0 }, { status: 500 })
  }

  let ready = 0
  let failed = 0
  // Small batches protect both Supabase projects and stay inside function limits.
  for (let index = 0; index < (data ?? []).length; index += 4) {
    const batch = (data ?? []).slice(index, index + 4)
    const results = await Promise.all(batch.map((row) => provisionStockOnboarding(row.id)))
    for (const result of results) {
      if (result.ok) ready++
      else failed++
    }
  }

  return NextResponse.json({ ok: true, processed: (data ?? []).length, ready, failed })
}
