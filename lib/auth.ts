// lib/auth.ts — verifikasi superadmin terpusat untuk API routes.
// Dipakai oleh route sensitif (billing, tenant). Pola sama dengan inline
// verifySuperadmin di app/api/admin/tenants/route.ts — disatukan agar konsisten.
import { createClient } from '@/lib/supabase/server'
import { isSuperadminEmail } from '@/lib/superadmin'

// Re-export agar pemanggil lama (route/login) tetap impor dari '@/lib/auth'.
export { isSuperadminEmail }

/**
 * true bila pemanggil adalah superadmin: JWT claim user_role === 'superadmin'
 * (saat hook aktif) ATAU email termasuk daftar superadmin (fallback Fase 1).
 */
export async function verifySuperadmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims?.sub) return false
    const role = typeof data.claims.user_role === 'string' ? data.claims.user_role : null
    const email = typeof data.claims.email === 'string' ? data.claims.email : null
    return role === 'superadmin' || isSuperadminEmail(email)
  } catch {
    return false
  }
}
