// ============================================================
// lib/portal-urls.ts — Peta platform → URL dashboard portal tenant.
// Dipakai halaman /billing/selesai (tombol "Masuk ke Dashboard") dan email
// konfirmasi pembayaran. SENGAJA hardcode custom domain (bukan env *_URL
// milik lib/*-sync.ts): env sync boleh menunjuk *.vercel.app untuk HMAC
// server-to-server, tapi URL user-facing HARUS custom domain — customer
// register via <sub>.webzoka.com (CTA pricing corp), jadi session cookie
// mereka hidup di domain itu, bukan di *.vercel.app.
// ============================================================

const PORTAL_DASHBOARD_URLS: Record<string, string> = {
  stock: 'https://stock.webzoka.com/dashboard',
  lms: 'https://lms.webzoka.com/admin',
  pharmacy: 'https://pharmacy.webzoka.com/dashboard',
  rental: 'https://rent.webzoka.com/admin',
  clinic: 'https://clinic.webzoka.com/admin',
  laundry: 'https://laundry.webzoka.com/dashboard',
}

/** URL dashboard portal untuk sebuah platform; null bila platform tak dikenal. */
export function portalDashboardUrl(platform: string | null | undefined): string | null {
  if (!platform) return null
  return PORTAL_DASHBOARD_URLS[platform] ?? null
}
