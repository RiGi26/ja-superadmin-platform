// ============================================================
// lib/portal-urls.ts — Peta platform → URL dashboard portal tenant.
// Dipakai halaman /billing/selesai (tombol "Masuk ke Dashboard") dan email
// konfirmasi pembayaran. Base URL per portal (env var + fallback) HARUS identik
// dengan lib/*-sync.ts agar tidak drift.
// ============================================================

const PORTALS: Record<string, { env: string; fallback: string; path: string }> = {
  stock: { env: 'STOCK_URL', fallback: 'https://stock.webzoka.com', path: '/dashboard' },
  lms: { env: 'LMS_URL', fallback: 'https://ja-lms-platform.vercel.app', path: '/admin' },
  pharmacy: { env: 'PHARMACY_URL', fallback: 'https://ja-pharmacy-platform.vercel.app', path: '/dashboard' },
  rental: { env: 'RENTAL_URL', fallback: 'https://rent.webzoka.com', path: '/admin' },
  clinic: { env: 'CLINIC_URL', fallback: 'https://clinic.webzoka.com', path: '/admin' },
  laundry: { env: 'LAUNDRY_URL', fallback: 'https://laundry.webzoka.com', path: '/dashboard' },
}

/** URL dashboard portal untuk sebuah platform; null bila platform tak dikenal. */
export function portalDashboardUrl(platform: string | null | undefined): string | null {
  if (!platform) return null
  const portal = PORTALS[platform]
  if (!portal) return null
  const base = process.env[portal.env]?.trim().replace(/\/+$/, '') || portal.fallback
  return base + portal.path
}
