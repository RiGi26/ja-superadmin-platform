import { NextResponse } from 'next/server'
import { safeHubAuthPath } from '@/lib/hub-return-path'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = safeHubAuthPath(requestUrl.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(
      new URL('/hub/forgot-password?error=invalid_link', requestUrl.origin),
    )
  }

  const db = await createClient()
  const { error } = await db.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      new URL('/hub/forgot-password?error=invalid_link', requestUrl.origin),
    )
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
