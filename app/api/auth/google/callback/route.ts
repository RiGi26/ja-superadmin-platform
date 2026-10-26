import { GOOGLE_DEV_ORIGIN, GOOGLE_DEV_PENDING, googleDevCode, googleDevConfig, googleDevRequest } from '@/lib/google-oauth-dev'
import { clearGoogleDevCookies, createGoogleDevClient, hasGoogleDevVerifier } from '@/lib/supabase/google-dev'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const config = googleDevConfig(process.env)
  if (!config || !googleDevRequest(request, 'callback')) {
    return new Response('Google DEV login is unavailable.', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const code = googleDevCode(new URL(request.url))
    if (!code || !await hasGoogleDevVerifier()) throw new Error('Missing DEV PKCE flow')
    const db = await createGoogleDevClient(config)
    const { error } = await db.auth.exchangeCodeForSession(code)
    if (error) throw new Error('DEV exchange denied')
    // Authentication is independently checked; role/email never grants membership.
    const { data, error: userError } = await db.auth.getUser()
    if (userError || !data.user || data.user.is_anonymous ||
      !data.user.identities?.some((identity) => identity.provider === 'google')) {
      throw new Error('DEV Google identity unavailable')
    }
    return new Response(null, { status: 303, headers: {
      Location: `${GOOGLE_DEV_ORIGIN}${GOOGLE_DEV_PENDING}`,
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    } })
  } catch {
    await clearGoogleDevCookies()
    return new Response(null, { status: 303, headers: {
      Location: `${GOOGLE_DEV_ORIGIN}/hub/login?message=google_dev_failed`,
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    } })
  }
}
