import { NextResponse } from 'next/server'
import { verifySuperadmin } from '@/lib/auth'

/**
 * GET /api/auth/superadmin — apakah sesi saat ini superadmin?
 * Sumber kebenaran tunggal (server): verifySuperadmin (JWT user_role ATAU
 * email ∈ SUPERADMIN_EMAIL/SUPERADMIN_EMAILS). Dipakai halaman login untuk
 * verifikasi pasca sign-in tanpa menduplikasi logika/ env di sisi client.
 */
export async function GET() {
  return NextResponse.json({ ok: await verifySuperadmin() })
}
