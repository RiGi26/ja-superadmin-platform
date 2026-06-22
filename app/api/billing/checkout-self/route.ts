import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBillingToken } from '@/lib/billing-link'
import { createSubscriptionCheckout } from '@/lib/billing'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import type { InvoicePeriod } from '@/types/billing'

/**
 * POST /api/billing/checkout-self — checkout self-service tenant (Slice C).
 * Body: { token, plan_id, period: 'monthly'|'yearly' }.
 *
 * AUTH: BUKAN superadmin — keabsahan dari token bertanda tangan (HMAC stateless)
 * yang di-mint app tenant. Token → tenant_id. Memanggil createSubscriptionCheckout
 * yang sama dengan jalur superadmin (harga otoritatif dihitung server). Guard:
 * plan_id WAJIB milik platform tenant agar tenant tak bisa membayar paket platform
 * lain (mis. tier lebih murah).
 */
export async function POST(request: Request) {
  const rl = rateLimit(`billing:checkout-self:${clientIp(request)}`, 20, 5 * 60_000)
  if (!rl.allowed) return tooManyRequests(rl.retryAfter)

  let body: { token?: string; plan_id?: string; period?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const { token, plan_id, period } = body
  const verified = verifyBillingToken(token)
  if (!verified.ok) {
    const msg =
      verified.reason === 'expired'
        ? 'Tautan pembayaran sudah kedaluwarsa. Minta tautan baru dari aplikasi Anda.'
        : 'Tautan pembayaran tidak sah.'
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  if (!plan_id) {
    return NextResponse.json({ error: 'plan_id wajib.' }, { status: 400 })
  }
  if (period !== 'monthly' && period !== 'yearly') {
    return NextResponse.json({ error: "period harus 'monthly' atau 'yearly'." }, { status: 400 })
  }

  // Guard platform: paket harus untuk platform tenant ini.
  const db = createAdminClient()
  const [{ data: tenant }, { data: plan }] = await Promise.all([
    db.from('tenants').select('id, platform').eq('id', verified.tenantId).maybeSingle(),
    db.from('subscription_plans').select('id, platform').eq('id', plan_id).maybeSingle(),
  ])
  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan.' }, { status: 404 })
  if (!plan) return NextResponse.json({ error: 'Paket tidak ditemukan.' }, { status: 404 })
  if (tenant.platform && plan.platform && tenant.platform !== plan.platform) {
    return NextResponse.json({ error: 'Paket tidak tersedia untuk akun ini.' }, { status: 403 })
  }

  const result = await createSubscriptionCheckout({
    tenantId: verified.tenantId,
    planId: plan_id,
    period: period as InvoicePeriod,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    invoice_id: result.invoiceId,
    redirect_url: result.redirectUrl,
    amount: result.amount,
    reused: result.reused,
  })
}
