import { NextResponse } from 'next/server'

// ============================================================
// Rate limiting ringan (in-memory, fixed window). Diadaptasi dari ja-lms-platform.
// ------------------------------------------------------------
// CATATAN: Vercel serverless = memori per-instance, BUKAN global. Limiter ini
// "best effort" — menaikkan bar untuk brute force/spam dari satu instance, tapi
// tidak menjamin batas global lintas instance. Untuk penegakan global, ganti
// store ke Upstash Redis saat env tersedia — API publik tetap sama.
// ============================================================

type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()
let lastPrune = 0

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter: number // detik sampai window reset
}

/** Hitung 1 hit untuk `key`. Mengizinkan maksimal `limit` hit per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  if (now - lastPrune > 60_000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k)
    lastPrune = now
  }

  let b = store.get(key)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs }
    store.set(key, b)
  }
  b.count++

  return {
    allowed: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    retryAfter: Math.ceil((b.resetAt - now) / 1000),
  }
}

/** IP klien dari header proxy (Vercel set x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/** Response 429 standar dengan header Retry-After. */
export function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
