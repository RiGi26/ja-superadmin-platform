import 'server-only'

import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, createChunks, isChunkLike, stringFromBase64URL, stringToBase64URL,
  type CookieOptions } from '@supabase/ssr'
import { safeHubReturnPath } from '@/lib/hub-return-path'
import { GOOGLE_SOCIAL_RUNTIME_ENABLED, GOOGLE_SOCIAL_PILOT_ENABLED } from '@/lib/google-social-release'

export const GOOGLE_SOCIAL_ORIGIN = 'https://hub.webzoka.com'
export const GOOGLE_SOCIAL_REALM = 'https://hxhusfkrlafxdnyasmsu.supabase.co'
export const GOOGLE_SOCIAL_PATH = '/api/auth/social/google'
const sessionKey = 'sb-hxhusfkrlafxdnyasmsu-auth-token'
const verifierKey = sessionKey + '-code-verifier'
const flowPrefix = '__Host-webzoka-google-'
const pkcePrefix = '__Host-webzoka-google-pkce-'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const transient = { secure: true, httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 600 }
const privateHeaders = { 'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache', Expires: '0', 'Referrer-Policy': 'no-referrer' }
type Write = { name: string; value: string; options: CookieOptions }
type Flow = { version: 1; id: string; next: string; createdAt: number }

function unavailable() {
  return new NextResponse('Google sign-in is unavailable.', { status: 404, headers: privateHeaders })
}

function configured(request: NextRequest) {
  // An environment value cannot open the release gate or select another realm.
  return (GOOGLE_SOCIAL_RUNTIME_ENABLED || GOOGLE_SOCIAL_PILOT_ENABLED) &&
    new URL(request.url).origin === GOOGLE_SOCIAL_ORIGIN &&
    process.env.WEBZOKA_HUB_APP_URL === GOOGLE_SOCIAL_ORIGIN &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === GOOGLE_SOCIAL_REALM &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function googleSocialReturn(value: string | null): string | null {
  if (value === null || value === '') return '/hub/account'
  if (value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null
  const safe = safeHubReturnPath(value)
  if (!safe) return null
  // The existing helper normalizes consent links; reject extra selectors here.
  const url = new URL(value, GOOGLE_SOCIAL_ORIGIN)
  if (url.pathname === '/oauth/consent' && [...url.searchParams.keys()].join(',') !== 'authorization_id') return null
  return safe
}

export function readGoogleSocialFlow(request: NextRequest, id: string): Flow | null {
  if (!uuid.test(id)) return null
  const cookie = request.cookies.get(flowPrefix + id)?.value
  if (!cookie || cookie.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(cookie)) return null
  try {
    const flow = JSON.parse(Buffer.from(cookie, 'base64url').toString('utf8'))
    if (!flow || Object.keys(flow).sort().join(',') !== 'createdAt,id,next,version' ||
      flow.version !== 1 || flow.id !== id || typeof flow.next !== 'string' ||
      googleSocialReturn(flow.next) !== flow.next || !Number.isSafeInteger(flow.createdAt) ||
      flow.createdAt > Date.now() || Date.now() - flow.createdAt > 600_000) return null
    return flow
  } catch { return null }
}

/** Provider credentials are never written to a browser cookie, including stale chunks. */
export function withoutGoogleCredentials(writes: Write[], existing: { name: string; value: string }[]): Write[] {
  const live = writes.filter(c => isChunkLike(c.name, sessionKey) && c.options.maxAge !== 0 && c.value)
  if (!live.length) return writes
  const parts = new Map(live.map(c => [c.name, c.value]))
  if (parts.size !== live.length || live.reduce((n, c) => n + c.value.length, 0) > 65536) throw new Error('SESSION_DENIED')
  let encoded = parts.get(sessionKey)
  if (encoded && parts.size !== 1) throw new Error('SESSION_DENIED')
  if (!encoded) {
    const chunks: string[] = []
    for (let i = 0; i < parts.size; i++) {
      const chunk = parts.get(sessionKey + '.' + i)
      if (!chunk) throw new Error('SESSION_DENIED')
      chunks.push(chunk)
    }
    encoded = chunks.join('')
  }
  if (!encoded.startsWith('base64-')) throw new Error('SESSION_DENIED')
  const session = JSON.parse(stringFromBase64URL(encoded.slice(7)))
  if (!session || typeof session !== 'object' || Array.isArray(session)) throw new Error('SESSION_DENIED')
  delete session.provider_token
  delete session.provider_refresh_token
  const options = live[0].options
  const result = new Map(writes.filter(c => !isChunkLike(c.name, sessionKey)).map(c => [c.name, c]))
  for (const cookie of [...existing, ...writes]) if (isChunkLike(cookie.name, sessionKey)) {
    result.set(cookie.name, { name: cookie.name, value: '', options: { ...options, maxAge: 0 } })
  }
  for (const chunk of createChunks(sessionKey, 'base64-' + stringToBase64URL(JSON.stringify(session)))) {
    result.set(chunk.name, { ...chunk, options })
  }
  return [...result.values()]
}

function clientForFlow(request: NextRequest, id: string) {
  const scoped = pkcePrefix + id
  const original = request.cookies.getAll()
  // The exchange starts without an old session. Only this flow's verifier is visible.
  const values = new Map(original.filter(c => isChunkLike(c.name, scoped))
    .map(c => [verifierKey + c.name.slice(scoped.length), c.value]))
  const writes = new Map<string, Write>()
  const client = createServerClient(GOOGLE_SOCIAL_REALM, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { secure: true, sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => [...values].map(([name, value]) => ({ name, value })),
      setAll(batch) {
        for (const item of withoutGoogleCredentials(batch, original)) {
          if (!isChunkLike(item.name, sessionKey) && !isChunkLike(item.name, verifierKey)) throw new Error('COOKIE_DENIED')
          if (item.options.maxAge === 0) values.delete(item.name)
          else values.set(item.name, item.value)
          const cookie = isChunkLike(item.name, verifierKey) ? { ...item,
            name: scoped + item.name.slice(verifierKey.length), options: { ...item.options, ...transient,
              maxAge: item.options.maxAge === 0 ? 0 : 600 } } : item
          writes.set(cookie.name, cookie)
        }
      },
    },
  })
  return { client, writes, hasVerifier: original.some(c => isChunkLike(c.name, scoped) && c.value) }
}

function retire(request: NextRequest, response: NextResponse, id: string) {
  response.cookies.set(flowPrefix + id, '', { ...transient, maxAge: 0 })
  for (const cookie of request.cookies.getAll()) if (isChunkLike(cookie.name, pkcePrefix + id)) {
    response.cookies.set(cookie.name, '', { ...transient, maxAge: 0 })
  }
  return response
}

async function readNext(request: NextRequest) {
  if (!/^application\/x-www-form-urlencoded(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '') ||
      Number(request.headers.get('content-length') ?? 0) > 4096 || !request.body) return null
  const reader = request.body.getReader()
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    const signal = AbortSignal.timeout(3000)
    while (true) {
      const part = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
        const abort = () => reject(new Error('BODY_TIMEOUT'))
        if (signal.aborted) { abort(); return }
        signal.addEventListener('abort', abort, { once: true })
        reader.read().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
      })
      if (part.done) break
      size += part.value.byteLength
      if (size > 4096) return null
      chunks.push(part.value)
    }
    const form = new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
    if ([...form.keys()].some(key => key !== 'next') || form.getAll('next').length > 1) return null
    return googleSocialReturn(form.get('next'))
  } catch { return null }
  finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
}

export async function startGoogleSocial(request: NextRequest) {
  if (!configured(request)) return unavailable()
  if (request.method !== 'POST' || request.headers.get('origin') !== GOOGLE_SOCIAL_ORIGIN ||
      new URL(request.url).search) return new NextResponse('Sign-in request denied.', { status: 403, headers: privateHeaders })
  const next = await readNext(request)
  if (!next) return new NextResponse('Sign-in request denied.', { status: 400, headers: privateHeaders })
  // Bound cookie growth without deleting another tab's in-flight verifier.
  const pending = request.cookies.getAll().filter(c => c.name.startsWith(flowPrefix) &&
    readGoogleSocialFlow(request, c.name.slice(flowPrefix.length)))
  if (pending.length >= 4) return new NextResponse('Finish an existing sign-in first.', { status: 409, headers: privateHeaders })
  const id = randomUUID()
  const callback = new URL(GOOGLE_SOCIAL_PATH + '/callback', GOOGLE_SOCIAL_ORIGIN)
  callback.searchParams.set('flow', id)
  try {
    const bridge = clientForFlow(request, id)
    const signed = await bridge.client.auth.signInWithOAuth({ provider: 'google', options: {
      redirectTo: callback.href, scopes: 'openid email profile', skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    } })
    if (signed.error || !signed.data.url) throw new Error('START_DENIED')
    const target = new URL(signed.data.url)
    if (target.origin !== GOOGLE_SOCIAL_REALM || target.pathname !== '/auth/v1/authorize' ||
      target.searchParams.getAll('provider').join(',') !== 'google' ||
      target.searchParams.getAll('redirect_to').join(',') !== callback.href ||
      target.searchParams.get('code_challenge_method') !== 's256' ||
      !/^[A-Za-z0-9_-]{43}$/.test(target.searchParams.get('code_challenge') ?? '')) throw new Error('START_DENIED')
    const response = NextResponse.redirect(target, 303)
    Object.entries(privateHeaders).forEach(([k, v]) => response.headers.set(k, v))
    for (const cookie of bridge.writes.values()) {
      if (!isChunkLike(cookie.name, pkcePrefix + id)) throw new Error('START_SESSION_DENIED')
      response.cookies.set(cookie.name, cookie.value, cookie.options)
    }
    const flow: Flow = { version: 1, id, next, createdAt: Date.now() }
    response.cookies.set(flowPrefix + id, Buffer.from(JSON.stringify(flow)).toString('base64url'), transient)
    return response
  } catch { return new NextResponse('Google sign-in could not start.', { status: 503, headers: privateHeaders }) }
}

export async function completeGoogleSocial(request: NextRequest) {
  if (!configured(request)) return unavailable()
  const url = new URL(request.url)
  const id = url.searchParams.get('flow') ?? ''
  const flow = readGoogleSocialFlow(request, id)
  const failure = () => NextResponse.redirect(GOOGLE_SOCIAL_ORIGIN + '/login?message=google_failed', 303)
  if (request.method !== 'GET' || url.href.length > 6144 || !flow) {
    return new NextResponse('Sign-in request denied.', { status: 400, headers: privateHeaders })
  }
  let issuedClient: ReturnType<typeof clientForFlow>['client'] | undefined
  try {
    if ([...url.searchParams.keys()].sort().join(',') !== 'code,flow' ||
      !/^[A-Za-z0-9._~-]{1,4096}$/.test(url.searchParams.get('code') ?? '')) throw new Error('CALLBACK_DENIED')
    const bridge = clientForFlow(request, id)
    if (!bridge.hasVerifier) throw new Error('PKCE_REQUIRED')
    const exchanged = await bridge.client.auth.exchangeCodeForSession(url.searchParams.get('code')!)
    if (exchanged.error || !exchanged.data.session) throw new Error('EXCHANGE_DENIED')
    issuedClient = bridge.client
    const identity = await bridge.client.auth.getUser()
    const user = identity.data.user
    if (identity.error || !user || user.id !== exchanged.data.session.user.id || user.is_anonymous !== false ||
      !user.email || !user.email_confirmed_at || !user.identities?.some(i => i.provider === 'google')) throw new Error('IDENTITY_DENIED')
    if (GOOGLE_SOCIAL_PILOT_ENABLED && (!process.env.STOCK_SSO_PILOT_EMAIL ||
        user.email.toLowerCase() !== process.env.STOCK_SSO_PILOT_EMAIL.toLowerCase())) throw new Error('PILOT_DENIED')
    // A parallel sign-in cannot silently replace another verified Core account.
    if (request.cookies.getAll().some(c => isChunkLike(c.name, sessionKey) && c.value)) {
      const parts = new Map(request.cookies.getAll().filter(c => isChunkLike(c.name, sessionKey))
        .map(c => [c.name, c.value]))
      if (parts.size > 32 || [...parts.values()].reduce((n, v) => n + v.length, 0) > 65536) throw new Error('SESSION_DENIED')
      let encoded = parts.get(sessionKey)
      if (encoded && parts.size !== 1) throw new Error('SESSION_DENIED')
      if (!encoded) {
        const chunks: string[] = []
        for (let i = 0; i < parts.size; i++) {
          const chunk = parts.get(sessionKey + '.' + i)
          if (!chunk) throw new Error('SESSION_DENIED')
          chunks.push(chunk)
        }
        encoded = chunks.join('')
      }
      if (!encoded.startsWith('base64-')) throw new Error('SESSION_DENIED')
      const token = JSON.parse(stringFromBase64URL(encoded.slice(7)))?.access_token
      if (typeof token !== 'string' || !token || token.length > 16384) throw new Error('SESSION_DENIED')
      const existing = createServerClient(GOOGLE_SOCIAL_REALM, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: { getAll: () => [], setAll() {} },
      })
      // Explicit token verification avoids rotating an old refresh token whose
      // writes would otherwise be discarded during this staged callback.
      const previous = await existing.auth.getUser(token)
      if (previous.error || previous.data.user?.id !== user.id) throw new Error('ACCOUNT_CHANGED')
    }
    // Reuse the installed managed-session kernel after all identity reads.
    // A still-unexpired JWT cannot revive a removed, banned or revoked session.
    const live = await bridge.client.rpc('core_registry_session_is_live')
    if (live.error || live.data !== true) throw new Error('SESSION_NOT_CURRENT')
    const response = NextResponse.redirect(new URL(flow.next, GOOGLE_SOCIAL_ORIGIN), 303)
    Object.entries(privateHeaders).forEach(([k, v]) => response.headers.set(k, v))
    for (const cookie of bridge.writes.values()) response.cookies.set(cookie.name, cookie.value, cookie.options)
    return retire(request, response, id)
  } catch {
    // Revoke only a newly issued rejected session. Never sign out the browser's
    // existing session, the Google provider, or another portal.
    if (issuedClient) await issuedClient.auth.signOut({ scope: 'local' }).catch(() => {})
    // Discard staged session writes. Leave existing Core and other flow cookies intact.
    const response = failure()
    Object.entries(privateHeaders).forEach(([k, v]) => response.headers.set(k, v))
    return retire(request, response, id)
  }
}
