// ============================================================
// lib/billing-link.ts — Token tautan checkout langganan (stateless HMAC).
//
// Slice C (Phase 2). Tenant login di APP-nya (mis. LMS, DB terpisah), tapi
// langganan + pembayaran ada di superadmin/Core DB. Daripada SSO lintas-DB,
// app tenant me-MINT token bertanda tangan singkat (ia tahu tenant_id dari JWT
// claim = tenants.id di Core DB), lalu mengarahkan tenant ke portal superadmin
// `/billing/langganan?token=...`. Superadmin MEM-VERIFIKASI token → tenant_id →
// menampilkan paket tenant itu → bayar via Snap (jalur Phase 1 yang sama).
//
// STATELESS: tak ada baris DB untuk token — keabsahan murni dari HMAC + exp.
// Tak bisa dicabut sebelum exp; karenanya TTL singkat (default 7 hari, sama
// dengan masa berlaku link Snap). Token TIDAK memberi akses dasbor apa pun —
// hanya kemampuan membuat invoice untuk tenant tertentu (harga otoritatif tetap
// dihitung server dari subscription_plans).
//
// ── KONTRAK LINTAS-REPO (sisi MINT di repo app tenant, mis. ja-lms-platform) ──
//   Rahasia bersama: env BILLING_LINK_SECRET (WAJIB identik di kedua repo).
//   Format token:  <base64url(payloadJson)>.<base64url(HMAC_SHA256(payloadB64, secret))>
//   payloadJson :  {"v":1,"t":"<tenant_id>","iat":<unix_s>,"exp":<unix_s>}
//   Catatan      :  HMAC dihitung atas STRING base64url payload (bukan JSON yang
//                   di-serialize ulang) supaya tak ada masalah kanonikalisasi
//                   antar bahasa/repo. Sisi mint cukup tiru `signBillingToken`.
// ============================================================

import crypto from 'crypto'

const TOKEN_VERSION = 1
export const DEFAULT_LINK_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 hari (= masa Snap)

type TokenPayload = { v: number; t: string; iat: number; exp: number }

function secret(): string | null {
  const s = process.env.BILLING_LINK_SECRET?.trim()
  return s && s.length > 0 ? s : null
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlToBuf(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function sign(payloadB64: string, key: string): string {
  return b64url(crypto.createHmac('sha256', key).update(payloadB64).digest())
}

/**
 * Mint token checkout untuk sebuah tenant. Dipakai sisi app tenant (kontrak
 * lintas-repo), disediakan di sini agar simetris dengan verify & bisa dites.
 * Throw bila BILLING_LINK_SECRET belum di-set (gagal jelas, bukan token lemah).
 */
export function signBillingToken(tenantId: string, ttlSeconds = DEFAULT_LINK_TTL_SECONDS): string {
  const key = secret()
  if (!key) throw new Error('BILLING_LINK_SECRET belum di-set.')
  const now = Math.floor(Date.now() / 1000)
  const payload: TokenPayload = { v: TOKEN_VERSION, t: tenantId, iat: now, exp: now + ttlSeconds }
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  return `${payloadB64}.${sign(payloadB64, key)}`
}

export type VerifyResult =
  | { ok: true; tenantId: string }
  | { ok: false; reason: 'no_secret' | 'malformed' | 'bad_signature' | 'expired' | 'unsupported' }

/**
 * Verifikasi token checkout. FAIL-CLOSED: secret tak ada / tanda tangan salah /
 * kedaluwarsa → ditolak. Timing-safe + length-guarded pada perbandingan tanda
 * tangan. Tidak melempar.
 */
export function verifyBillingToken(token: string | null | undefined): VerifyResult {
  const key = secret()
  if (!key) return { ok: false, reason: 'no_secret' }
  if (!token || typeof token !== 'string') return { ok: false, reason: 'malformed' }

  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: 'malformed' }
  const payloadB64 = token.slice(0, dot)
  const sigB64 = token.slice(dot + 1)

  const expected = sign(payloadB64, key)
  const sigBuf = Buffer.from(sigB64)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: 'bad_signature' }
  }

  let payload: TokenPayload
  try {
    payload = JSON.parse(b64urlToBuf(payloadB64).toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (payload?.v !== TOKEN_VERSION) return { ok: false, reason: 'unsupported' }
  if (typeof payload.t !== 'string' || !payload.t) return { ok: false, reason: 'malformed' }
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true, tenantId: payload.t }
}
