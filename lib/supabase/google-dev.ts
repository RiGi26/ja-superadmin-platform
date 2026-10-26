import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { GOOGLE_DEV_COOKIE, GOOGLE_DEV_PATH, isGoogleDevCookie, type GoogleDevConfig } from '@/lib/google-oauth-dev'

const cookieOptions = { path: GOOGLE_DEV_PATH, httpOnly: true, sameSite: 'lax' as const, secure: false }

export async function clearGoogleDevCookies() {
  const store = await cookies()
  for (const { name } of store.getAll().filter(({ name }) => isGoogleDevCookie(name))) {
    store.set(name, '', { ...cookieOptions, maxAge: 0 })
  }
}

// Deliberately separate from default Core password/recovery/consent cookies.
// Used only by guarded Route Handlers, where cookie writes are supported.
export async function createGoogleDevClient(config: GoogleDevConfig) {
  const store = await cookies()
  return createServerClient(config.url, config.anonKey, {
    cookieOptions: { ...cookieOptions, name: GOOGLE_DEV_COOKIE },
    cookies: {
      getAll: () => store.getAll().filter(({ name }) => isGoogleDevCookie(name)),
      setAll(values) {
        for (const { name, value, options } of values) {
          if (!isGoogleDevCookie(name)) throw new Error('Unexpected DEV auth cookie')
          store.set(name, value, { ...options, ...cookieOptions })
        }
      },
    },
  })
}

export async function hasGoogleDevVerifier() {
  const store = await cookies()
  return store.getAll().some(({ name, value }) =>
    isGoogleDevCookie(name) && name.startsWith(`${GOOGLE_DEV_COOKIE}-code-verifier`) && Boolean(value),
  )
}
