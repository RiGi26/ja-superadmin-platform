import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperadminEmail } from '@/lib/auth'

/**
 * GET /api/auth/superadmin — apakah sesi saat ini superadmin?
 * Sumber kebenaran tunggal (server): JWT user_role ATAU email ∈
 * SUPERADMIN_EMAIL/SUPERADMIN_EMAILS. Dipakai halaman login untuk verifikasi
 * pasca sign-in.
 *
 * Mengembalikan juga sinyal diagnostik AMAN (tanpa membocorkan email/allowlist):
 *   - authenticated      : server melihat user login? (false = masalah sesi/cookie)
 *   - allowlistConfigured: SUPERADMIN_EMAIL(S) terbaca di runtime? (false = env tak efektif)
 *   - emailOk            : email user cocok allowlist?
 *   - jwtRole            : klaim user_role (null bila hook nonaktif)
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  let jwtRole: string | null = null
  try {
    if (session) {
      jwtRole = JSON.parse(atob(session.access_token.split('.')[1]))?.user_role ?? null
    }
  } catch {
    jwtRole = null
  }

  const emailOk = isSuperadminEmail(user?.email)
  const ok = jwtRole === 'superadmin' || emailOk
  const allowlistConfigured = !!(
    process.env.SUPERADMIN_EMAIL?.trim() || process.env.SUPERADMIN_EMAILS?.trim()
  )

  return NextResponse.json({
    ok,
    authenticated: !!user,
    allowlistConfigured,
    emailOk,
    jwtRole,
  })
}
