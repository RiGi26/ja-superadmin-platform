import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBillingToken } from '@/lib/billing-link'
import { selfServiceChange } from '@/lib/billing'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import type { InvoicePeriod } from '@/types/billing'

/**
 * POST /api/billing/checkout-self — checkout self-service tenant (Slice C).
 * Body: { token, plan_id?, tier?, period: 'monthly'|'yearly' }.
 * Salah satu dari plan_id ATAU tier (starter|pro|enterprise) wajib.
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

  let body: { token?: string; plan_id?: string; tier?: string; period?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const { token, plan_id, tier, period } = body
  const verified = verifyBillingToken(token)
  if (!verified.ok) {
    const msg =
      verified.reason === 'expired'
        ? 'Tautan pembayaran sudah kedaluwarsa. Minta tautan baru dari aplikasi Anda.'
        : 'Tautan pembayaran tidak sah.'
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  if (period !== 'monthly' && period !== 'yearly') {
    return NextResponse.json({ error: "period harus 'monthly' atau 'yearly'." }, { status: 400 })
  }
  // Terima plan_id eksplisit ATAU tier (alias). App tenant dari pricing hanya tahu
  // tier — feed publik /api/public/plans tak ekspos id paket — jadi tier di-resolve
  // ke plan_id milik platform tenant ini di bawah.
  const CORE_TIERS = ['starter', 'pro', 'enterprise']
  if (!plan_id && !(tier && CORE_TIERS.includes(tier))) {
    return NextResponse.json(
      { error: 'plan_id atau tier (starter|pro|enterprise) wajib.' },
      { status: 400 },
    )
  }

  // Guard platform: paket harus untuk platform tenant ini.
  const db = createAdminClient()
  const { data: tenant } = await db
    .from('tenants')
    .select('id, platform')
    .eq('id', verified.tenantId)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan.' }, { status: 404 })

  // Resolve paket via id eksplisit, atau via tier (dibatasi platform tenant + aktif).
  const { data: plan } = plan_id
    ? await db.from('subscription_plans').select('id, platform').eq('id', plan_id).maybeSingle()
    : await db
        .from('subscription_plans')
        .select('id, platform')
        .eq('platform', tenant.platform)
        .eq('tier', tier as string)
        .eq('is_active', true)
        .maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Paket tidak ditemukan.' }, { status: 404 })
  if (tenant.platform && plan.platform && tenant.platform !== plan.platform) {
    return NextResponse.json({ error: 'Paket tidak tersedia untuk akun ini.' }, { status: 403 })
  }

  const result = await selfServiceChange({
    tenantId: verified.tenantId,
    planId: plan.id,
    period: period as InvoicePeriod,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // Downgrade dijadwalkan (tanpa bayar).
  if (result.kind === 'scheduled') {
    return NextResponse.json({
      kind: 'scheduled',
      scheduled_tier: result.scheduledTier,
      effective_at: result.effectiveAt,
    })
  }
  // Upgrade pro-rata Rp0 → langsung berlaku (tanpa bayar).
  if (result.kind === 'applied') {
    return NextResponse.json({ kind: 'applied', tier: result.tier })
  }
  // Checkout (renew / upgrade pro-rata berbayar) → redirect ke Snap.
  return NextResponse.json({
    kind: 'checkout',
    change_type: result.changeType,
    invoice_id: result.invoiceId,
    redirect_url: result.redirectUrl,
    amount: result.amount,
    reused: result.reused,
  })
}
