// Local H1 authentication candidate only. This is not Company authorization.
export const GOOGLE_DEV_PROJECT = 'mcvekinhgcqygfddyifs'
export const GOOGLE_DEV_ORIGIN = 'http://localhost:3000'
export const GOOGLE_DEV_PATH = '/api/auth/google'
export const GOOGLE_DEV_CALLBACK = `${GOOGLE_DEV_ORIGIN}${GOOGLE_DEV_PATH}/callback`
export const GOOGLE_DEV_PENDING = `${GOOGLE_DEV_PATH}/pending`
export const GOOGLE_DEV_COOKIE = 'wz-h1-google-dev'

export type GoogleDevConfig = { url: string; anonKey: string }

export function googleDevConfig(env: Record<string, string | undefined>): GoogleDevConfig | null {
  if (
    env.NODE_ENV !== 'development' || env.VERCEL !== undefined || env.VERCEL_ENV !== undefined ||
    env.HUB_PREVIEW_MODE === 'true' || env.HUB_SSO_PREVIEW_MODE === 'true' ||
    env.HUB_GOOGLE_DEV_ENABLED !== 'true' ||
    env.HUB_GOOGLE_DEV_PROJECT_REF !== GOOGLE_DEV_PROJECT ||
    env.HUB_GOOGLE_DEV_ORIGIN !== GOOGLE_DEV_ORIGIN ||
    env.HUB_GOOGLE_DEV_CALLBACK_URL !== GOOGLE_DEV_CALLBACK ||
    env.NEXT_PUBLIC_SUPABASE_URL !== `https://${GOOGLE_DEV_PROJECT}.supabase.co`
  ) return null

  // Accept only a public legacy anon JWT with matching project metadata.
  // Decoding is a configuration check, not signature or runtime binding proof.
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key || key.length > 4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) return null
  try {
    const [header, payload] = key.split('.').slice(0, 2).map((part) =>
      JSON.parse(Buffer.from(part, 'base64url').toString('utf8')),
    )
    if (
      header.alg !== 'HS256' || header.typ !== 'JWT' || payload.role !== 'anon' ||
      payload.ref !== GOOGLE_DEV_PROJECT || !Number.isSafeInteger(payload.exp) ||
      payload.exp <= Date.now() / 1000
    ) return null
  } catch {
    return null
  }
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: key }
}

export function googleDevLocalHeaders(headers: Headers): boolean {
  return headers.get('host') === 'localhost:3000' &&
    (!headers.has('x-forwarded-host') || headers.get('x-forwarded-host') === 'localhost:3000') &&
    (!headers.has('x-forwarded-proto') || headers.get('x-forwarded-proto') === 'http') &&
    !headers.has('forwarded')
}

export function googleDevRequest(request: Request, path: string, post = false): boolean {
  const url = new URL(request.url)
  return googleDevLocalHeaders(request.headers) && url.origin === GOOGLE_DEV_ORIGIN &&
    url.pathname === `${GOOGLE_DEV_PATH}/${path}` && !url.username && !url.password && !url.hash &&
    (post ? request.method === 'POST' && request.headers.get('origin') === GOOGLE_DEV_ORIGIN && !url.search
      : request.method === 'GET' && (!request.headers.has('origin') || request.headers.get('origin') === GOOGLE_DEV_ORIGIN))
}

export function googleDevCode(url: URL): string | null {
  // No caller-controlled destination, H2 authorization ID, or provider error passthrough.
  if ([...url.searchParams.keys()].some((key) => key !== 'code')) return null
  const codes = url.searchParams.getAll('code')
  return codes.length === 1 && /^[A-Za-z0-9_-]{16,2048}$/.test(codes[0]) ? codes[0] : null
}

export function googleDevAuthorizeUrl(value: string, config: GoogleDevConfig): boolean {
  try {
    const url = new URL(value)
    return url.origin === config.url && url.pathname === '/auth/v1/authorize' &&
      !url.username && !url.password && !url.hash &&
      url.searchParams.getAll('provider').length === 1 && url.searchParams.get('provider') === 'google' &&
      url.searchParams.getAll('redirect_to').length === 1 && url.searchParams.get('redirect_to') === GOOGLE_DEV_CALLBACK &&
      url.searchParams.get('code_challenge_method') === 's256' &&
      /^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('code_challenge') ?? '')
  } catch {
    return false
  }
}

export function isGoogleDevCookie(name: string): boolean {
  return name === GOOGLE_DEV_COOKIE || name === `${GOOGLE_DEV_COOKIE}-code-verifier` ||
    new RegExp(`^${GOOGLE_DEV_COOKIE}(?:-code-verifier)?\\.\\d+$`).test(name)
}
