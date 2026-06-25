import { NextResponse } from 'next/server'
import { verifyBillingToken } from '@/lib/billing-link'
import { cancelScheduledChange } from '@/lib/billing'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'

/**
 * POST /api/billing/cancel-schedule — batalkan downgrade terjadwal tenant.
 * Body: { token }. Auth = token HMAC (sama dgn checkout-self). Idempoten.
 */
export async function POST(request: Request) {
  const rl = rateLimit(`billing:cancel-schedule:${clientIp(request)}`, 20, 5 * 60_000)
  if (!rl.allowed) return tooManyRequests(rl.retryAfter)

  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const verified = verifyBillingToken(body.token)
  if (!verified.ok) {
    return NextResponse.json({ error: 'Tautan tidak sah.' }, { status: 401 })
  }

  const res = await cancelScheduledChange(verified.tenantId)
  if (!res.ok) return NextResponse.json({ error: res.error ?? 'Gagal membatalkan.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
