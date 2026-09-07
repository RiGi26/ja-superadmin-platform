import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isSuperadminEmail } from '@/lib/superadmin'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.nextUrl.hostname.toLowerCase()

  // Production public-domain routing. Keep the internal superadmin hostname on
  // its existing dashboard surface while the public www hostname opens the
  // unauthenticated Customer Hub Store. Legacy landing URLs continue to work
  // through permanent redirects to the new information hostname.
  const isPublicHubHost = hostname === 'www.webzoka.com'
  const isApexHost = hostname === 'webzoka.com'
  const legacyLandingPaths = new Set([
    '/pricing',
    '/seluruh-layanan',
    '/tentang-kami',
    '/kebijakan-privasi',
    '/syarat-ketentuan',
  ])
  const isLegacyLandingPath = legacyLandingPaths.has(pathname)

  if (isApexHost || (isPublicHubHost && isLegacyLandingPath)) {
    const destination = new URL(
      isLegacyLandingPath
        ? `https://information.webzoka.com${pathname}`
        : `https://www.webzoka.com${pathname === '/' ? '/hub/store' : pathname}`,
    )
    destination.search = request.nextUrl.search
    return NextResponse.redirect(destination, 308)
  }

  if (isPublicHubHost && pathname === '/') {
    // Keep the public URL clean while serving the Store route internally.
    return NextResponse.rewrite(new URL('/hub/store', request.url))
  }

  const isHubRoute = pathname === '/hub' || pathname.startsWith('/hub/')
  const isHubLogin = pathname === '/hub/login' || pathname === '/hub/forgot-password'
  const isOAuthConsent = pathname === '/oauth/consent'
  const isPublicHubExplore =
    (pathname === '/hub' && request.nextUrl.searchParams.get('view') === 'store') ||
    pathname === '/hub/store' ||
    pathname === '/hub/portofolio' ||
    pathname === '/hub/artikel' ||
    pathname.startsWith('/hub/artikel/') ||
    pathname === '/hub/faq' ||
    pathname === '/hub/komitmen' ||
    pathname === '/hub/onboarding/stock' ||
    pathname === '/hub/onboarding/verify'

  // Permukaan billing PUBLIK (tenant-facing / token-auth / webhook) — TIDAK boleh
  // di-gate ke login superadmin. Masing-masing punya otorisasinya sendiri:
  //   - /billing/*                  halaman tenant (selesai, langganan)
  //   - /api/billing/webhook        signature Midtrans
  //   - /api/billing/confirm        dipanggil halaman publik (rate-limited)
  //   - /api/billing/checkout-self  token HMAC bertanda tangan (Slice C)
  //   - /api/tenants/provision      HMAC BILLING_SYNC_SECRET (signup tenant Stock)
  // CATATAN: /api/billing/checkout & /lifecycle TETAP di-gate (dipakai dasbor
  // superadmin yang sudah login; keduanya juga verifySuperadmin sendiri).
  if (
    pathname.startsWith('/billing') ||
    pathname === '/api/billing/webhook' ||
    pathname === '/api/billing/confirm' ||
    pathname === '/api/billing/checkout-self' ||
    pathname === '/api/billing/cancel-schedule' || // token HMAC (batal downgrade terjadwal)
    pathname === '/api/tenants/provision' || // HMAC self-auth (provisioning lintas-repo)
    pathname.startsWith('/api/public') || // read-only public data (e.g. plan prices)
    pathname.startsWith('/api/cron') // self-auth via Bearer CRON_SECRET
  ) {
    return NextResponse.next()
  }

  if (
    pathname.startsWith('/login') ||
    isHubLogin ||
    pathname.startsWith('/unauthorized') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/auth/callback'
  ) {
    return NextResponse.next()
  }

  // Local-only visual preview. Never available in a production build.
  const isLocalHubPreview =
    isHubRoute &&
    process.env.NODE_ENV !== 'production' &&
    process.env.HUB_PREVIEW_MODE === 'true'
  const isSsoVisualPreview =
    isOAuthConsent &&
    process.env.HUB_SSO_PREVIEW_MODE === 'true' &&
    request.nextUrl.searchParams.get('preview') === '1'

  if (isLocalHubPreview || isSsoVisualPreview) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  // getClaims verifies the access token and refreshes the cookie when needed.
  // Detailed tenant authorization remains in the Hub data-access layer.
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims

  if (isHubRoute || isOAuthConsent) {
    if (!claims?.sub && !isPublicHubExplore) {
      const loginUrl = new URL('/hub/login', request.url)
      if (isOAuthConsent) {
        loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
      }
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  if (!claims?.sub) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const userRole = typeof claims.user_role === 'string' ? claims.user_role : null
  const email = typeof claims.email === 'string' ? claims.email : null
  const isSuperadmin = userRole === 'superadmin' || isSuperadminEmail(email)

  if (!isSuperadmin) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
