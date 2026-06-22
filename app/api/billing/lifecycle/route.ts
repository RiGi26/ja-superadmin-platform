import { NextResponse } from 'next/server'
import { verifySuperadmin } from '@/lib/auth'
import { applyLifecycleAction, type LifecycleAction } from '@/lib/billing'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import type { InvoicePeriod } from '@/types/billing'

const ACTIONS: LifecycleAction[] = [
  'activate',
  'extend',
  'suspend',
  'reactivate',
  'cancel',
  'change_plan',
]

/**
 * POST /api/billing/lifecycle — aksi siklus-hidup langganan manual (superadmin).
 * Body: { tenant_id, action, period?, plan_id? }.
 *   - activate/extend → period ('monthly'|'yearly') wajib
 *   - change_plan     → plan_id wajib
 * Tanpa Midtrans (jalur uang ada di /api/billing/checkout + webhook).
 */
export async function POST(request: Request) {
  if (!(await verifySuperadmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit(`billing:lifecycle:${clientIp(request)}`, 40, 5 * 60_000)
  if (!rl.allowed) return tooManyRequests(rl.retryAfter)

  let body: { tenant_id?: string; action?: string; period?: string; plan_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const { tenant_id, action, period, plan_id } = body
  if (!tenant_id || !action) {
    return NextResponse.json({ error: 'tenant_id dan action wajib.' }, { status: 400 })
  }
  if (!ACTIONS.includes(action as LifecycleAction)) {
    return NextResponse.json({ error: 'action tidak dikenal.' }, { status: 400 })
  }

  const result = await applyLifecycleAction({
    tenantId: tenant_id,
    action: action as LifecycleAction,
    period: period as InvoicePeriod | undefined,
    planId: plan_id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true, event: result.event })
}
