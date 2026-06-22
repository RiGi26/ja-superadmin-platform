import { NextResponse } from 'next/server'
import { addDays } from 'date-fns'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { signBillingToken } from '@/lib/billing-link'

/**
 * GET /api/cron/subscription-lifecycle — Phase 3 (Workstream D). Dijalankan
 * harian (Vercel Cron). Beroperasi pada Core DB (SSOT langganan):
 *
 *  1. REMINDER bayar H-7/H-3/H-1 sebelum kedaluwarsa (active+trial) via email
 *     (Resend) — idempoten per (period_end, days_before) lewat subscription_events.
 *  2. active lewat current_period_end → past_due + grace (GRACE_DAYS).
 *  3. past_due lewat grace → suspended (+ tenants.status='suspended').
 *
 * Enforcement otomatis ikut karena gate LMS membaca status ini dari Core DB
 * (Workstream B). Auth: Vercel Cron menyertakan `Authorization: Bearer <CRON_SECRET>`.
 */

const GRACE_DAYS = 7
const REMINDER_BUCKETS = [7, 3, 1]
const DAY_MS = 86_400_000

type TenantRel = { name: string | null; email: string | null }
type SubRow = {
  id: string
  tenant_id: string
  status: string
  plan_id: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  grace_period_ends_at: string | null
  tenants: TenantRel | null
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()

  const { data, error } = await db
    .from('tenant_subscriptions')
    .select(
      'id, tenant_id, status, plan_id, trial_ends_at, current_period_end, grace_period_ends_at, tenants(name, email)',
    )
    .in('status', ['active', 'trial', 'past_due'])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const subs = (data ?? []) as unknown as SubRow[]
  const events: { tenant_id: string; event_type: string; payload: Record<string, unknown> }[] = []
  let reminders = 0
  let pastDue = 0
  let suspended = 0

  for (const s of subs) {
    const tenant = s.tenants
    // Akhir periode yang relevan: trial → trial_ends_at, selain itu → current_period_end.
    const endIso = s.status === 'trial' ? s.trial_ends_at : s.current_period_end
    const end = endIso ? new Date(endIso) : null

    // 1. Reminder sebelum kedaluwarsa (active/trial yang belum lewat).
    if ((s.status === 'active' || s.status === 'trial') && end && end > now && tenant?.email) {
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / DAY_MS)
      if (REMINDER_BUCKETS.includes(daysLeft)) {
        const { data: sent } = await db
          .from('subscription_events')
          .select('id')
          .eq('tenant_id', s.tenant_id)
          .eq('event_type', 'payment_reminder')
          .eq('payload->>period_end', endIso as string)
          .eq('payload->>days_before', String(daysLeft))
          .maybeSingle()
        if (!sent) {
          const ok = await sendReminderEmail(tenant.email, tenant.name, s.tenant_id, daysLeft, end)
          if (ok) {
            reminders++
            events.push({
              tenant_id: s.tenant_id,
              event_type: 'payment_reminder',
              payload: { period_end: endIso, days_before: daysLeft, channel: 'email' },
            })
          }
        }
      }
    }

    // 2. active lewat periode → past_due + grace.
    if (s.status === 'active' && s.current_period_end && new Date(s.current_period_end) < now) {
      const graceEnds = addDays(now, GRACE_DAYS).toISOString()
      await db
        .from('tenant_subscriptions')
        .update({ status: 'past_due', grace_period_ends_at: graceEnds, updated_at: nowIso })
        .eq('id', s.id)
      pastDue++
      events.push({
        tenant_id: s.tenant_id,
        event_type: 'subscription_past_due',
        payload: { current_period_end: s.current_period_end, grace_period_ends_at: graceEnds },
      })
    }
    // 3. past_due lewat grace → suspended (status terminal; tak diproses lagi).
    else if (
      s.status === 'past_due' &&
      s.grace_period_ends_at &&
      new Date(s.grace_period_ends_at) < now
    ) {
      await db
        .from('tenant_subscriptions')
        .update({ status: 'suspended', updated_at: nowIso })
        .eq('id', s.id)
      await db
        .from('tenants')
        .update({ status: 'suspended', suspended_at: nowIso, updated_at: nowIso })
        .eq('id', s.tenant_id)
      suspended++
      events.push({
        tenant_id: s.tenant_id,
        event_type: 'suspended',
        payload: { reason: 'grace_elapsed', grace_period_ends_at: s.grace_period_ends_at },
      })
    }
  }

  if (events.length) {
    const { error: evErr } = await db.from('subscription_events').insert(events)
    if (evErr) console.error('[cron/lifecycle] insert events:', evErr.message)
  }

  return NextResponse.json({ checked: subs.length, reminders, past_due: pastDue, suspended })
}

async function sendReminderEmail(
  email: string,
  name: string | null,
  tenantId: string,
  daysLeft: number,
  end: Date,
): Promise<boolean> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? ''
    let payUrl = `${base}/billing/langganan`
    try {
      payUrl += `?token=${encodeURIComponent(signBillingToken(tenantId))}`
    } catch {
      // BILLING_LINK_SECRET belum di-set → kirim tanpa tautan langsung.
      payUrl = ''
    }
    const endLabel = end.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const cta = payUrl
      ? `<a href="${payUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Perpanjang Sekarang</a>`
      : `<p style="font-size:14px;color:#555;">Buka menu <strong>Billing &amp; Paket</strong> di aplikasi Anda untuk memperpanjang.</p>`

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@japanarenacorp.com',
      to: email,
      subject: `Langganan Anda berakhir dalam ${daysLeft} hari`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
          <h2 style="color:#111;">Halo${name ? ` ${name}` : ''},</h2>
          <p>Langganan Japan Arena untuk lembaga Anda akan <strong>berakhir pada ${endLabel}</strong>
             (${daysLeft} hari lagi). Perpanjang sekarang agar akses tidak terputus.</p>
          <div style="margin:22px 0;">${cta}</div>
          <p style="font-size:12px;color:#aaa;margin-top:24px;">Tim Japan Arena</p>
        </div>
      `,
    })
    return true
  } catch (e) {
    console.error('[cron/lifecycle] reminder email gagal:', e instanceof Error ? e.message : e)
    return false
  }
}
