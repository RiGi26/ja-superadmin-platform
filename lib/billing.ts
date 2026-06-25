// ============================================================
// lib/billing.ts — Logika langganan tenant terpusat (Lapisan 2).
//   - createSubscriptionCheckout: buat invoice + Snap token (insert 2-fase,
//     idempoten reuse) → redirect_url.
//   - markInvoicePaid / markInvoiceStatus: dipakai webhook & confirm.
// Idempotensi + efek aktivasi langganan (perpanjang periode, set status tenant,
// catat subscription_events) di-satu-tempat-kan di sini.
//
// Diadaptasi dari ja-lms-platform/lib/payment.ts (pembayaran siswa). Subjek di
// sini = langganan tenant (tenant bayar platform ke JapanArena).
// ============================================================

import { after } from 'next/server'
import { addMonths, addYears } from 'date-fns'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlatformMidtrans } from '@/lib/midtrans'
import { syncStockTenant } from '@/lib/stock-sync'
import type { InvoicePeriod } from '@/types/billing'

// ── createSubscriptionCheckout ───────────────────────────────────────────────

export type CreateCheckoutResult =
  | { ok: true; invoiceId: string; redirectUrl: string; amount: number; reused: boolean }
  | { ok: false; status: number; error: string }

/**
 * Buat invoice langganan + Snap token untuk sebuah tenant.
 * Harga OTORITATIF dihitung server dari subscription_plans (price_monthly /
 * price_yearly) — tidak pernah dari input klien. Insert 2-fase (row → Snap →
 * simpan order_id/token). Idempoten: bila invoice hidup untuk kombinasi
 * langganan+paket+periode yang sama sudah punya redirect_url, dipakai ulang.
 */
export async function createSubscriptionCheckout(args: {
  tenantId: string
  planId: string
  period: InvoicePeriod
}): Promise<CreateCheckoutResult> {
  const db = createAdminClient()
  const { tenantId, planId, period } = args

  // 1. Tenant harus ada.
  const { data: tenant } = await db
    .from('tenants')
    .select('id, name, email, phone, status')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) return { ok: false, status: 404, error: 'Tenant tidak ditemukan.' }

  // 2. Plan harus ada & aktif. Harga otoritatif dari sini.
  const { data: plan } = await db
    .from('subscription_plans')
    .select('id, name, platform, tier, price_monthly, price_yearly, is_active')
    .eq('id', planId)
    .maybeSingle()
  if (!plan) return { ok: false, status: 404, error: 'Paket tidak ditemukan.' }
  if (!plan.is_active) return { ok: false, status: 400, error: 'Paket tidak aktif.' }

  const rawAmount = period === 'yearly' ? plan.price_yearly : plan.price_monthly
  const amount = Math.round(Number(rawAmount))
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      status: 400,
      error: `Harga paket "${plan.name}" untuk periode ${period} belum diset.`,
    }
  }

  // 3. Get-or-create tenant_subscriptions (invoice mengikat ke satu langganan).
  let subscriptionId: string
  const { data: existingSub } = await db
    .from('tenant_subscriptions')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingSub) {
    subscriptionId = existingSub.id
  } else {
    const { data: newSub, error: subErr } = await db
      .from('tenant_subscriptions')
      .insert({ tenant_id: tenantId, plan_id: planId, status: 'unpaid' })
      .select('id')
      .single()
    if (subErr || !newSub) {
      return { ok: false, status: 500, error: subErr?.message ?? 'Gagal membuat langganan.' }
    }
    subscriptionId = newSub.id
  }

  // 4. Idempotensi: pakai invoice hidup yang sudah punya link.
  const { data: live } = await db
    .from('subscription_invoices')
    .select('id, redirect_url')
    .eq('subscription_id', subscriptionId)
    .eq('plan_id', planId)
    .eq('period', period)
    .in('status', ['unpaid', 'awaiting_payment'])
    .maybeSingle()
  if (live?.redirect_url) {
    return { ok: true, invoiceId: live.id, redirectUrl: live.redirect_url, amount, reused: true }
  }

  const { serverKey, snapApiUrl, mode } = await getPlatformMidtrans()

  // 5. Fase 1: insert (order_id null) untuk dapat id.
  const { data: inv, error: insErr } = await db
    .from('subscription_invoices')
    .insert({
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      plan_id: planId,
      period,
      amount,
      status: 'unpaid',
      midtrans_mode: mode,
    })
    .select('id')
    .single()
  if (insErr || !inv) {
    // 23505 = unique_violation: invoice hidup utk kombinasi ini balapan dgn proses lain.
    if ((insErr as { code?: string } | null)?.code === '23505') {
      const { data: existing } = await db
        .from('subscription_invoices')
        .select('id, redirect_url')
        .eq('subscription_id', subscriptionId)
        .eq('plan_id', planId)
        .eq('period', period)
        .in('status', ['unpaid', 'awaiting_payment'])
        .maybeSingle()
      if (existing?.redirect_url) {
        return {
          ok: true,
          invoiceId: existing.id,
          redirectUrl: existing.redirect_url,
          amount,
          reused: true,
        }
      }
    }
    return { ok: false, status: 500, error: insErr?.message ?? 'Gagal membuat invoice.' }
  }

  const year = new Date().getFullYear()
  const midtransOrderId = `JA-SUB-${year}-${inv.id.slice(0, 8).toUpperCase()}-${
    period === 'yearly' ? 'YR' : 'MON'
  }`
  const periodLabel = period === 'yearly' ? 'Tahunan' : 'Bulanan'
  const finishUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/billing/selesai?inv=${inv.id}`

  const snapPayload = {
    transaction_details: { order_id: midtransOrderId, gross_amount: amount },
    item_details: [
      {
        id: `${plan.platform}-${plan.tier}-${period}`,
        price: amount,
        quantity: 1,
        name: `Langganan ${plan.name} (${periodLabel}) — Japan Arena`.slice(0, 50),
      },
    ],
    customer_details: {
      first_name: tenant.name ?? 'Tenant',
      ...(tenant.email && { email: tenant.email }),
      ...(tenant.phone && { phone: tenant.phone }),
    },
    callbacks: { finish: finishUrl },
    gopay: { enable_callback: true, callback_url: finishUrl },
    shopeepay: { callback_url: finishUrl },
    // Link berlaku 7 hari supaya tagihan langganan yang dikirim via WA tak cepat basi.
    expiry: { unit: 'days', duration: 7 },
  }

  const auth = Buffer.from(`${serverKey}:`).toString('base64')
  const snapRes = await fetch(snapApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify(snapPayload),
  })
  const snapData = await snapRes.json()
  if (!snapRes.ok) {
    await db
      .from('subscription_invoices')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', inv.id)
    return {
      ok: false,
      status: 502,
      error: snapData.error_messages?.join(', ') || `Midtrans error: ${snapRes.status}`,
    }
  }

  await db
    .from('subscription_invoices')
    .update({
      midtrans_order_id: midtransOrderId,
      snap_token: snapData.token,
      redirect_url: snapData.redirect_url,
      status: 'awaiting_payment',
      updated_at: new Date().toISOString(),
    })
    .eq('id', inv.id)

  return { ok: true, invoiceId: inv.id, redirectUrl: snapData.redirect_url, amount, reused: false }
}

// ── Webhook / confirm side ───────────────────────────────────────────────────

/**
 * Latch invoice ke 'paid' secara idempotent + aktifkan langganan. firstTransition
 * = true HANYA pada notifikasi paid pertama. Pada transisi pertama: perpanjang
 * tenant_subscriptions (period_end += periode), set status tenant 'active', dan
 * catat subscription_events. Aman terhadap retry & race (update bersyarat).
 */
export async function markInvoicePaid(args: {
  midtransOrderId: string
  paymentType?: string | null
  raw?: unknown
}): Promise<{ firstTransition: boolean; tenantId?: string }> {
  const db = createAdminClient()
  const nowIso = new Date().toISOString()

  // Latch: hanya transisi pertama (status != paid) yang menghasilkan row.
  const { data: inv, error } = await db
    .from('subscription_invoices')
    .update({
      status: 'paid',
      paid_at: nowIso,
      payment_type: args.paymentType ?? null,
      raw_notification: args.raw ?? null,
      updated_at: nowIso,
    })
    .eq('midtrans_order_id', args.midtransOrderId)
    .neq('status', 'paid')
    .select('id, tenant_id, subscription_id, plan_id, period, amount')
    .maybeSingle()

  if (error) {
    console.error('[billing] markInvoicePaid error:', error.message)
    return { firstTransition: false }
  }
  if (!inv) return { firstTransition: false } // sudah paid sebelumnya / order tak ada

  // Tier paket untuk sinkronisasi tenants.plan_tier.
  let planTier: string | null = null
  if (inv.plan_id) {
    const { data: plan } = await db
      .from('subscription_plans')
      .select('tier')
      .eq('id', inv.plan_id)
      .maybeSingle()
    planTier = plan?.tier ?? null
  }

  // Perpanjang langganan: base = max(now, current_period_end).
  if (inv.subscription_id) {
    const { data: sub } = await db
      .from('tenant_subscriptions')
      .select('current_period_start, current_period_end')
      .eq('id', inv.subscription_id)
      .maybeSingle()

    const now = new Date(nowIso)
    const prevEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null
    const base = prevEnd && prevEnd > now ? prevEnd : now
    const newEnd = inv.period === 'yearly' ? addYears(base, 1) : addMonths(base, 1)

    const { error: subErr } = await db
      .from('tenant_subscriptions')
      .update({
        status: 'active',
        plan_id: inv.plan_id,
        current_period_start: sub?.current_period_start ?? nowIso,
        current_period_end: newEnd.toISOString(),
        grace_period_ends_at: null,
        cancelled_at: null,
        updated_at: nowIso,
      })
      .eq('id', inv.subscription_id)
    if (subErr) console.error('[billing] update subscription error:', subErr.message)
  }

  // Aktifkan tenant + sinkron tier.
  const { error: tenantErr } = await db
    .from('tenants')
    .update({
      status: 'active',
      ...(planTier ? { plan_tier: planTier } : {}),
      updated_at: nowIso,
    })
    .eq('id', inv.tenant_id)
  if (tenantErr) console.error('[billing] update tenant error:', tenantErr.message)

  // Audit trail (append-only).
  const { error: evErr } = await db.from('subscription_events').insert([
    {
      tenant_id: inv.tenant_id,
      event_type: 'payment_received',
      payload: {
        invoice_id: inv.id,
        subscription_id: inv.subscription_id,
        plan_id: inv.plan_id,
        period: inv.period,
        amount: inv.amount,
        midtrans_order_id: args.midtransOrderId,
        payment_type: args.paymentType ?? null,
      },
    },
    {
      tenant_id: inv.tenant_id,
      event_type: 'subscription_activated',
      payload: {
        invoice_id: inv.id,
        subscription_id: inv.subscription_id,
        plan_id: inv.plan_id,
        period: inv.period,
      },
    },
  ])
  if (evErr) console.error('[billing] subscription_events insert error:', evErr.message)

  return { firstTransition: true, tenantId: inv.tenant_id }
}

// ── Lifecycle manual (superadmin) ────────────────────────────────────────────

export type LifecycleAction =
  | 'activate' //     aktifkan manual (mis. bayar offline) — set periode baru dari sekarang
  | 'extend' //       perpanjang 1 siklus di atas periode berjalan
  | 'suspend' //      tangguhkan (akses dimatikan), periode dipertahankan
  | 'reactivate' //   batalkan penangguhan
  | 'cancel' //       batalkan langganan
  | 'change_plan' //  ganti paket (tier) tanpa ubah periode/harga

export type LifecycleResult =
  | { ok: true; event: string }
  | { ok: false; status: number; error: string }

const EVENT_BY_ACTION: Record<LifecycleAction, string> = {
  activate: 'subscription_activated',
  extend: 'subscription_extended',
  suspend: 'suspended',
  reactivate: 'reactivated',
  cancel: 'subscription_cancelled',
  change_plan: 'plan_changed',
}

/**
 * Terapkan aksi siklus-hidup langganan secara manual (tanpa Midtrans). Dipakai
 * superadmin dari /dashboard/tenants/[id]. Menjaga konsistensi tenant_subscriptions
 * + tenants.status + catat subscription_events (append-only). TIDAK menyentuh uang
 * (pembayaran lewat jalur Snap di createSubscriptionCheckout/markInvoicePaid).
 */
export async function applyLifecycleAction(args: {
  tenantId: string
  action: LifecycleAction
  period?: InvoicePeriod // wajib utk activate/extend
  planId?: string //        wajib utk change_plan
}): Promise<LifecycleResult> {
  const db = createAdminClient()
  const { tenantId, action } = args
  const nowIso = new Date().toISOString()
  const now = new Date(nowIso)

  const { data: tenant } = await db
    .from('tenants')
    .select('id, status')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) return { ok: false, status: 404, error: 'Tenant tidak ditemukan.' }

  // Langganan terbaru (boleh belum ada).
  const { data: sub } = await db
    .from('tenant_subscriptions')
    .select('id, plan_id, status, current_period_start, current_period_end')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const subUpdate: Record<string, unknown> = { updated_at: nowIso }
  const tenantUpdate: Record<string, unknown> = { updated_at: nowIso }
  const payload: Record<string, unknown> = { manual: true }

  switch (action) {
    case 'activate':
    case 'extend': {
      const period = args.period
      if (period !== 'monthly' && period !== 'yearly') {
        return { ok: false, status: 400, error: "period harus 'monthly' atau 'yearly'." }
      }
      const prevEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null
      // activate = periode baru dari sekarang; extend = tumpuk di atas periode berjalan.
      const base = action === 'extend' && prevEnd && prevEnd > now ? prevEnd : now
      const newEnd = period === 'yearly' ? addYears(base, 1) : addMonths(base, 1)
      subUpdate.status = 'active'
      subUpdate.current_period_start =
        action === 'activate' ? nowIso : sub?.current_period_start ?? nowIso
      subUpdate.current_period_end = newEnd.toISOString()
      subUpdate.grace_period_ends_at = null
      subUpdate.cancelled_at = null
      tenantUpdate.status = 'active'
      tenantUpdate.suspended_at = null
      tenantUpdate.cancelled_at = null
      payload.period = period
      payload.current_period_end = newEnd.toISOString()
      break
    }
    case 'suspend': {
      subUpdate.status = 'past_due'
      tenantUpdate.status = 'suspended'
      tenantUpdate.suspended_at = nowIso
      break
    }
    case 'reactivate': {
      subUpdate.status = 'active'
      tenantUpdate.status = 'active'
      tenantUpdate.suspended_at = null
      tenantUpdate.cancelled_at = null
      break
    }
    case 'cancel': {
      subUpdate.status = 'cancelled'
      subUpdate.cancelled_at = nowIso
      tenantUpdate.status = 'cancelled'
      tenantUpdate.cancelled_at = nowIso
      break
    }
    case 'change_plan': {
      const planId = args.planId
      if (!planId) return { ok: false, status: 400, error: 'plan_id wajib untuk ganti paket.' }
      const { data: plan } = await db
        .from('subscription_plans')
        .select('id, tier, is_active')
        .eq('id', planId)
        .maybeSingle()
      if (!plan) return { ok: false, status: 404, error: 'Paket tidak ditemukan.' }
      if (!plan.is_active) return { ok: false, status: 400, error: 'Paket tidak aktif.' }
      subUpdate.plan_id = planId
      tenantUpdate.plan_tier = plan.tier
      payload.plan_id = planId
      payload.tier = plan.tier
      break
    }
    default:
      return { ok: false, status: 400, error: 'Aksi tidak dikenal.' }
  }

  // Terapkan ke langganan. Bila belum ada langganan: activate/extend membuatnya
  // baru (agar periode benar-benar tersimpan); change_plan butuh langganan dulu.
  if (sub) {
    const { error: subErr } = await db
      .from('tenant_subscriptions')
      .update(subUpdate)
      .eq('id', sub.id)
    if (subErr) return { ok: false, status: 500, error: subErr.message }
  } else if (action === 'activate' || action === 'extend') {
    const { error: subErr } = await db
      .from('tenant_subscriptions')
      .insert({ tenant_id: tenantId, ...subUpdate })
    if (subErr) return { ok: false, status: 500, error: subErr.message }
  } else if (action === 'change_plan') {
    return { ok: false, status: 400, error: 'Tenant belum punya langganan untuk diganti paketnya.' }
  }

  const { error: tenantErr } = await db.from('tenants').update(tenantUpdate).eq('id', tenantId)
  if (tenantErr) return { ok: false, status: 500, error: tenantErr.message }

  const event = EVENT_BY_ACTION[action]
  const { error: evErr } = await db.from('subscription_events').insert({
    tenant_id: tenantId,
    event_type: event,
    payload: { ...payload, subscription_id: sub?.id ?? null },
  })
  if (evErr) console.error('[billing] lifecycle event insert error:', evErr.message)

  // Propagate to the Stock portal cache (no-op for non-stock tenants).
  try {
    after(() => syncStockTenant(tenantId, event))
  } catch {
    // after() outside a request scope (e.g. a script) — skip; reconcile covers it.
  }

  return { ok: true, event }
}

/**
 * Update status NON-paid (awaiting_payment/failed/expired) — forward-only:
 * tidak menurunkan invoice yang sudah 'paid'.
 */
export async function markInvoiceStatus(args: {
  midtransOrderId: string
  status: 'awaiting_payment' | 'failed' | 'expired'
  paymentType?: string | null
  raw?: unknown
}): Promise<void> {
  const db = createAdminClient()
  const { error } = await db
    .from('subscription_invoices')
    .update({
      status: args.status,
      payment_type: args.paymentType ?? null,
      raw_notification: args.raw ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('midtrans_order_id', args.midtransOrderId)
    .neq('status', 'paid')
  if (error) console.error('[billing] markInvoiceStatus error:', error.message)
}
