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

function stockPortalOrigin() {
  const configured = process.env.WEBZOKA_STOCK_PORTAL_URL
  if (!configured) return 'https://stock.webzoka.com'

  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
      return 'https://stock.webzoka.com'
    }
    return url.origin
  } catch {
    return 'https://stock.webzoka.com'
  }
}

export function usesWebzokaSso(platform: string | null | undefined) {
  // Production cutover must not silently fall back to a direct portal login
  // if a build-time flag was omitted. Preview deployments still require the
  // explicit flag, so preview testing remains opt-in.
  const ssoEnabled =
    process.env.NEXT_PUBLIC_WEBZOKA_SSO_ENABLED === 'true' ||
    (process.env.VERCEL_ENV === 'production' && process.env.HUB_SSO_PREVIEW_MODE !== 'true')

  return (
    platform === 'stock' &&
    ssoEnabled
  )
}

/** Hub launch URL. Stock switches to Webzoka SSO only after the rollout flag is enabled. */
export function portalAccessUrl(platform: string | null | undefined): string | null {
  if (usesWebzokaSso(platform)) {
    return `${stockPortalOrigin()}/auth/webzoka?next=%2Fdashboard`
  }
  return portalDashboardUrl(platform)
}
