// ============================================================
// lib/midtrans.ts — Konfigurasi Midtrans tingkat PLATFORM (akun Japan Arena yang
// menagih TENANT untuk langganan platform). Server-only.
//
// Diadaptasi dari ja-lms-platform/lib/midtrans.ts (Track A pembayaran siswa).
// Perbedaan: subjek di sini = langganan tenant, bukan SPP siswa. Akun Midtrans &
// pola mode-toggle identik.
//
// Mode (sandbox|production) disimpan di DB (platform_settings.midtrans_mode),
// BUKAN env build-time, supaya bisa di-switch dari /admin tanpa redeploy. Server
// key tetap di env (rahasia) — dua key hidup berdampingan, toggle DB memilih key
// + endpoint mana yang dipakai runtime.
// ============================================================

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MidtransMode } from '@/types/billing'

const SNAP_API: Record<MidtransMode, string> = {
  production: 'https://app.midtrans.com/snap/v1/transactions',
  sandbox: 'https://app.sandbox.midtrans.com/snap/v1/transactions',
}
const STATUS_API: Record<MidtransMode, string> = {
  production: 'https://api.midtrans.com/v2',
  sandbox: 'https://api.sandbox.midtrans.com/v2',
}

export type PlatformMidtrans = {
  mode: MidtransMode
  isProduction: boolean
  serverKey: string
  snapApiUrl: string // Snap "create transaction"
  statusApiUrl: string // Core API v2 base (cek status transaksi)
}

// Mode yang dipakai key legacy tunggal (MIDTRANS_SERVER_KEY). Prefix 'SB-' TIDAK
// bisa diandalkan untuk membedakan sandbox vs production; jadi key tunggal hanya
// di-fallback ke mode yang DULU dikonfigurasi untuknya = NEXT_PUBLIC_MIDTRANS_ENV.
function legacyMode(): MidtransMode {
  return process.env.NEXT_PUBLIC_MIDTRANS_ENV === 'production' ? 'production' : 'sandbox'
}

// Resolusi server key untuk sebuah mode. null bila belum dikonfigurasi.
export function serverKeyForMode(mode: MidtransMode): string | null {
  const explicit =
    mode === 'production'
      ? process.env.MIDTRANS_SERVER_KEY_PRODUCTION?.trim()
      : process.env.MIDTRANS_SERVER_KEY_SANDBOX?.trim()
  if (explicit) return explicit

  const legacy = process.env.MIDTRANS_SERVER_KEY?.trim()
  if (legacy && mode === legacyMode()) return legacy
  return null
}

// Mode aktif. Sumber kebenaran = DB. Bila baris belum ada / nilai invalid / DB
// error, fallback ke legacy (NEXT_PUBLIC_MIDTRANS_ENV). Error DB di-LOG.
export async function getMidtransMode(): Promise<MidtransMode> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('platform_settings')
    .select('value')
    .eq('key', 'midtrans_mode')
    .maybeSingle()
  if (error) {
    console.error(
      `[midtrans] gagal baca midtrans_mode, fallback ke ${legacyMode()}: ${error.message}`,
    )
  }
  const v = data?.value
  if (v === 'production' || v === 'sandbox') return v
  return legacyMode()
}

// Normalisasi mode tersimpan di invoice (subscription_invoices.midtrans_mode).
// Null/invalid (invoice legacy) → mode legacy. Dipakai webhook & confirm untuk
// verifikasi/poll terhadap environment tempat invoice DIBUAT.
export function normalizeOrderMode(stored: string | null | undefined): MidtransMode {
  return stored === 'production' || stored === 'sandbox' ? stored : legacyMode()
}

// Konfigurasi penuh untuk SEBUAH mode (murni, tanpa baca DB). Throw bila server
// key untuk mode itu belum di-set (gagal jelas daripada 401 misterius).
export function midtransConfigForMode(mode: MidtransMode): PlatformMidtrans {
  const serverKey = serverKeyForMode(mode)
  if (!serverKey) {
    throw new Error(
      `Midtrans mode '${mode}' dipakai tapi server key-nya belum di-set. ` +
        `Set MIDTRANS_SERVER_KEY_${mode.toUpperCase()} di environment, atau ganti mode di /admin.`,
    )
  }
  return {
    mode,
    isProduction: mode === 'production',
    serverKey,
    snapApiUrl: SNAP_API[mode],
    statusApiUrl: STATUS_API[mode],
  }
}

// Konfigurasi untuk mode AKTIF (dari DB). Dipakai saat MEMBUAT invoice baru.
export async function getPlatformMidtrans(): Promise<PlatformMidtrans> {
  return midtransConfigForMode(await getMidtransMode())
}

// Status konfigurasi key per-mode untuk UI admin (tanpa membuka key). true = siap.
export function getMidtransKeyStatus(): Record<MidtransMode, boolean> {
  return {
    production: !!serverKeyForMode('production'),
    sandbox: !!serverKeyForMode('sandbox'),
  }
}

// Set mode aktif (dipanggil dari route admin). Validasi nilai di caller.
export async function setMidtransMode(mode: MidtransMode): Promise<void> {
  const db = createAdminClient()
  const { error } = await db
    .from('platform_settings')
    .upsert(
      { key: 'midtrans_mode', value: mode, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
  if (error) throw new Error(`setMidtransMode: ${error.message}`)
}

// Semua server key terkonfigurasi (unik). Jaring pengaman terakhir saat mode
// invoice tak bisa ditentukan DAN key mode-nya tak terkonfigurasi.
export function midtransServerKeys(): string[] {
  const keys = [serverKeyForMode('production'), serverKeyForMode('sandbox')].filter(
    (k): k is string => !!k,
  )
  return Array.from(new Set(keys))
}

// Verifikasi tanda tangan webhook Midtrans. MONEY-SAFETY: dicocokkan HANYA
// terhadap key dari `mode` invoice (environment tempat ia DIBUAT) supaya
// notifikasi bertanda tangan key environment LAIN (mis. sandbox untuk invoice
// produksi) DITOLAK. Hanya bila key mode itu tak terkonfigurasi, jatuh ke semua
// key sebagai jaring pengaman. Timing-safe + length-guarded.
export function verifyMidtransSignature(args: {
  orderId: string
  statusCode: string
  grossAmount: string
  signatureKey: string
  mode: MidtransMode
}): boolean {
  const { orderId, statusCode, grossAmount, signatureKey, mode } = args
  const key = serverKeyForMode(mode)
  const candidates = key ? [key] : midtransServerKeys()
  const sigBuf = Buffer.from(signatureKey ?? '')
  return candidates.some((k) => {
    const expected = crypto
      .createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${k}`)
      .digest('hex')
    const expBuf = Buffer.from(expected)
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
  })
}
