import { NextResponse } from 'next/server'
import { verifySuperadmin } from '@/lib/auth'
import { createSubscriptionCheckout } from '@/lib/billing'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import type { InvoicePeriod } from '@/types/billing'

/**
 * POST /api/billing/checkout — buat invoice langganan + Snap link untuk tenant.
 * Body: { tenant_id, plan_id, period: 'monthly'|'yearly' }.
 *
 * AUTH (Fase 1): superadmin-only. Superadmin men-generate link bayar untuk
 * tenant (lalu dikirim via WA/email). Checkout self-service tenant via link
 * bertoken = Phase 2 (akan memanggil createSubscriptionCheckout yang sama).
 */
export async function POST(request: Request) {
  if (!(await verifySuperadmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit(`billing:checkout:${clientIp(request)}`, 20, 5 * 60_000)
  if (!rl.allowed) return tooManyRequests(rl.retryAfter)

  let body: { tenant_id?: string; plan_id?: string; period?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const { tenant_id, plan_id, period } = body
  if (!tenant_id || !plan_id) {
    return NextResponse.json({ error: 'tenant_id dan plan_id wajib.' }, { status: 400 })
  }
  if (period !== 'monthly' && period !== 'yearly') {
    return NextResponse.json({ error: "period harus 'monthly' atau 'yearly'." }, { status: 400 })
  }

  const result = await createSubscriptionCheckout({
    tenantId: tenant_id,
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
