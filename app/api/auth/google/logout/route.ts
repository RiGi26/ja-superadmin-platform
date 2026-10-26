import { GOOGLE_DEV_ORIGIN, googleDevConfig, googleDevRequest } from '@/lib/google-oauth-dev'
import { clearGoogleDevCookies, createGoogleDevClient } from '@/lib/supabase/google-dev'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const config = googleDevConfig(process.env)
  if (!config || !googleDevRequest(request, 'logout', true)) {
    return new Response('Google DEV login is unavailable.', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  let revoked = false
  try {
    const db = await createGoogleDevClient(config)
    const { error } = await db.auth.signOut({ scope: 'local' })
    revoked = !error
  } catch {
    // Local cookies are cleared even if managed revocation cannot be confirmed.
  }
  await clearGoogleDevCookies()
  if (!revoked) return new Response('Local test cookies cleared. Managed session revocation needs owner review.', {
    status: 503, headers: { 'Cache-Control': 'no-store' },
  })
  return new Response(null, { status: 303, headers: {
    Location: `${GOOGLE_DEV_ORIGIN}/hub/login`, 'Cache-Control': 'no-store',
  } })
}
