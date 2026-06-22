// Helper murni pengecekan allowlist superadmin — HANYA baca process.env, tanpa
// impor server (next/headers) supaya AMAN dipakai di proxy.ts (edge runtime)
// maupun di server components/route handlers. Sumber kebenaran tunggal untuk
// daftar email superadmin.

/**
 * true bila email termasuk allowlist superadmin (fallback sebelum JWT hook aktif).
 * Sumber: SUPERADMIN_EMAIL + SUPERADMIN_EMAILS. KEDUANYA boleh berisi banyak
 * email dipisah koma. Case-insensitive, di-trim, entri kosong diabaikan.
 */
export function isSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const target = email.trim().toLowerCase()
  const allowed = [
    ...(process.env.SUPERADMIN_EMAIL?.split(',') ?? []),
    ...(process.env.SUPERADMIN_EMAILS?.split(',') ?? []),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter((e) => !!e)
  return allowed.includes(target)
}
