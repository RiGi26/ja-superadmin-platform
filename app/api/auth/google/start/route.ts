import { GOOGLE_DEV_CALLBACK, googleDevAuthorizeUrl, googleDevConfig, googleDevRequest } from '@/lib/google-oauth-dev'
import { clearGoogleDevCookies, createGoogleDevClient } from '@/lib/supabase/google-dev'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const config = googleDevConfig(process.env)
  if (!config || !googleDevRequest(request, 'start', true)) {
    return new Response('Google DEV login is unavailable.', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    await clearGoogleDevCookies()
    const db = await createGoogleDevClient(config)
    const { data, error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: GOOGLE_DEV_CALLBACK, skipBrowserRedirect: true },
    })
    if (error || !data.url || !googleDevAuthorizeUrl(data.url, config)) throw new Error('OAuth start denied')
    return new Response(null, { status: 303, headers: {
      Location: data.url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    } })
  } catch {
    await clearGoogleDevCookies()
    return new Response('Google DEV login could not start. Return to login and try again.', {
      status: 400, headers: { 'Cache-Control': 'no-store' },
    })
  }
}
