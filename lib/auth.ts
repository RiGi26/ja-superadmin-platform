// lib/auth.ts — verifikasi superadmin terpusat untuk API routes.
// Dipakai oleh route sensitif (billing, tenant). Pola sama dengan inline
// verifySuperadmin di app/api/admin/tenants/route.ts — disatukan agar konsisten.
import { createClient } from '@/lib/supabase/server'

/**
 * Daftar email superadmin yang diizinkan (fallback sebelum JWT hook aktif).
 * Sumber: SUPERADMIN_EMAIL (tunggal, back-compat) + SUPERADMIN_EMAILS (daftar
 * dipisah koma untuk banyak admin). Case-insensitive, di-trim.
 */
export function isSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const target = email.trim().toLowerCase()
  const allowed = [
    process.env.SUPERADMIN_EMAIL,
    ...(process.env.SUPERADMIN_EMAILS?.split(',') ?? []),
  ]
    .map((e) => e?.trim().toLowerCase())
    .filter((e): e is string => !!e)
  return allowed.includes(target)
}

/**
 * true bila pemanggil adalah superadmin: JWT claim user_role === 'superadmin'
 * (saat hook aktif) ATAU email termasuk daftar superadmin (fallback Fase 1).
 */
export async function verifySuperadmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return false
    const payload = JSON.parse(atob(session.access_token.split('.')[1]))
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return payload?.user_role === 'superadmin' || isSuperadminEmail(user?.email)
  } catch {
    return false
  }
}
