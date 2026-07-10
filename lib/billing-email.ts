// ============================================================
// lib/billing-email.ts — Email konfirmasi pembayaran langganan (Resend).
// Dipanggil fire-and-forget via after() dari markInvoicePaid — HANYA pada
// transisi pertama ke paid (latch idempoten di markInvoicePaid), jadi webhook
// dan /api/billing/confirm yang balapan tidak menghasilkan email dobel.
// Tidak pernah throw: kegagalan email tidak boleh mengganggu aktivasi.
// ============================================================

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { portalDashboardUrl } from '@/lib/portal-urls'

function fmtDateId(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export async function sendSubscriptionPaidEmail(invoiceId: string): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[billing-email] RESEND_API_KEY kosong — email konfirmasi dilewati')
      return
    }

    const db = createAdminClient()
    const { data: inv } = await db
      .from('subscription_invoices')
      .select(
        'id, tenant_id, subscription_id, plan_id, period, amount, status, paid_at, change_type, promo_discount_percent'
      )
      .eq('id', invoiceId)
      .maybeSingle()
    if (!inv || inv.status !== 'paid') return

    const [{ data: tenant }, { data: plan }, { data: sub }] = await Promise.all([
      db
        .from('tenants')
        .select('name, email, platform, owner_user_id')
        .eq('id', inv.tenant_id)
        .maybeSingle(),
      inv.plan_id
        ? db
            .from('subscription_plans')
            .select('name, tier_display_name')
            .eq('id', inv.plan_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      inv.subscription_id
        ? db
            .from('tenant_subscriptions')
            .select('current_period_end')
            .eq('id', inv.subscription_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    if (!tenant) return

    let to: string | null = tenant.email ?? null
    if (!to && tenant.owner_user_id) {
      const { data: owner } = await db
        .from('users')
        .select('email')
        .eq('id', tenant.owner_user_id)
        .maybeSingle()
      to = owner?.email ?? null
    }
    if (!to) {
      console.warn('[billing-email] tenant tanpa email, konfirmasi dilewati:', inv.tenant_id)
      return
    }

    const isUpgrade = inv.change_type === 'upgrade'
    const planName = plan?.tier_display_name || plan?.name || 'Langganan'
    const periodLabel = inv.period === 'yearly' ? 'Tahunan' : 'Bulanan'
    const amountLabel = `Rp${Number(inv.amount ?? 0).toLocaleString('id-ID')}`
    const promoPct = Number(inv.promo_discount_percent ?? 0)
    const paidDate = inv.paid_at ? fmtDateId(inv.paid_at) : fmtDateId(new Date().toISOString())
    const activeUntil = sub?.current_period_end ? fmtDateId(sub.current_period_end) : null
    const dashboardUrl = portalDashboardUrl(tenant.platform)

    const subject = isUpgrade
      ? `Upgrade paket berhasil — ${planName}`
      : `Pembayaran berhasil — Langganan ${planName} aktif`

    const rows: string[] = [
      row('Paket', `${planName} (${periodLabel})`),
      ...(promoPct > 0 ? [row('Diskon promo', `${promoPct}%`)] : []),
      row('Total dibayar', amountLabel),
      row('Tanggal bayar', paidDate),
      ...(activeUntil ? [row('Aktif hingga', activeUntil)] : []),
    ]

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@webzoka.com',
      to,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #111;">Halo ${tenant.name},</h2>
          <p>${
            isUpgrade
              ? `Upgrade paket Anda ke <strong>${planName}</strong> sudah berhasil dan langsung aktif.`
              : `Pembayaran langganan <strong>${planName}</strong> Anda sudah kami terima. Langganan Anda kini aktif.`
          }</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #555;">Rincian pembayaran:</p>
            <table style="font-size: 14px; width: 100%;">${rows.join('')}</table>
          </div>
          ${
            dashboardUrl
              ? `<p style="margin: 24px 0;"><a href="${dashboardUrl}" style="background: #0071E3; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; display: inline-block;">Masuk ke Dashboard</a></p>`
              : ''
          }
          <p style="font-size: 13px; color: #777;">Butuh bantuan? Hubungi kami via WhatsApp.</p>
          <p style="margin-top: 24px; font-size: 12px; color: #aaa;">Tim Webzoka</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[billing-email] gagal kirim email konfirmasi:', err)
  }
}

function row(label: string, value: string): string {
  return `<tr><td style="padding: 4px 0; color: #555; width: 130px;">${label}</td><td><strong>${value}</strong></td></tr>`
}
