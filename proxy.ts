import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isSuperadminEmail } from '@/lib/superadmin'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Permukaan billing PUBLIK (tenant-facing / token-auth / webhook) — TIDAK boleh
  // di-gate ke login superadmin. Masing-masing punya otorisasinya sendiri:
  //   - /billing/*                  halaman tenant (selesai, langganan)
  //   - /api/billing/webhook        signature Midtrans
  //   - /api/billing/confirm        dipanggil halaman publik (rate-limited)
  //   - /api/billing/checkout-self  token HMAC bertanda tangan (Slice C)
  // CATATAN: /api/billing/checkout & /lifecycle TETAP di-gate (dipakai dasbor
  // superadmin yang sudah login; keduanya juga verifySuperadmin sendiri).
  if (
    pathname.startsWith('/billing') ||
    pathname === '/api/billing/webhook' ||
    pathname === '/api/billing/confirm' ||
    pathname === '/api/billing/checkout-self'
  ) {
    return NextResponse.next()
  }

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/unauthorized') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Cek superadmin via JWT claims, fallback ke email check
  const { data: sessionData } = await supabase.auth.getSession()
  let userRole: string | null = null

  if (sessionData.session) {
    try {
      const payload = JSON.parse(
        atob(sessionData.session.access_token.split('.')[1])
      )
      userRole = payload?.user_role ?? null
    } catch {
      userRole = null
    }
  }

  const isSuperadmin = userRole === 'superadmin' || isSuperadminEmail(user.email)

  if (!isSuperadmin) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
