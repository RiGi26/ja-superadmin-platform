// ⚠️ SERVER ONLY — client read-only ke project Website Builder (DB terpisah dari Core DB).
// Dipakai dashboard /dashboard/website-orders untuk menampilkan pesanan website lintas-project.
import { createClient } from '@supabase/supabase-js'

/**
 * Client service_role ke Supabase project Website Builder.
 * Mengembalikan null bila env belum diset (mis. di preview/lokal tanpa kredensial WB),
 * agar halaman bisa menampilkan empty-state yang jujur, bukan crash.
 */
export function createWebsiteBuilderClient() {
  const url = process.env.WB_SUPABASE_URL
  const key = process.env.WB_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
