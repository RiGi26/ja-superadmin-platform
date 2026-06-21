/**
 * types/billing.ts
 * Lapisan 2 — Langganan Tenant (Midtrans)
 *
 * Tipe untuk invoice langganan tenant via Midtrans Snap.
 * Mirror enum & kolom dari migration core_db/008_billing_invoices.sql.
 * Dipakai oleh lib/midtrans, lib/billing, route /api/billing/*.
 */

/** Environment Midtrans — disimpan di platform_settings.midtrans_mode */
export type MidtransMode = 'sandbox' | 'production'

/** Periode tagihan langganan */
export type InvoicePeriod = 'monthly' | 'yearly'

/** Status siklus hidup invoice */
export type InvoiceStatus =
  | 'unpaid' //            dibuat, belum ada upaya bayar
  | 'awaiting_payment' //  pending di Midtrans (VA terbit, QRIS menunggu, dll.)
  | 'paid' //              settlement/capture sukses
  | 'failed' //            deny/cancel
  | 'expired' //           kedaluwarsa

export interface SubscriptionInvoice {
  id: string
  tenant_id: string
  subscription_id: string | null
  plan_id: string | null
  period: InvoicePeriod
  amount: number
  midtrans_order_id: string | null
  snap_token: string | null
  redirect_url: string | null
  status: InvoiceStatus
  midtrans_mode: MidtransMode | null
  payment_type: string | null
  paid_at: string | null
  raw_notification: unknown | null
  created_at: string
  updated_at: string
}

// ── Display helpers ──────────────────────────────────────────────────────────

export const INVOICE_PERIOD_LABEL: Record<InvoicePeriod, string> = {
  monthly: 'Bulanan',
  yearly: 'Tahunan',
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  unpaid: 'Belum Bayar',
  awaiting_payment: 'Menunggu Pembayaran',
  paid: 'Lunas',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
}
