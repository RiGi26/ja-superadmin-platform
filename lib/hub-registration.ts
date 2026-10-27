import 'server-only'

import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hubAppUrl } from '@/lib/hub-app-url'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { clearHubSessionCookies } from '@/lib/hub-session'

export type HubRegistrationState = {
  status: 'idle' | 'error' | 'success'
  message: string | null
}

const sent: HubRegistrationState = {
  status: 'success',
  message: 'Jika email dapat digunakan, tautan verifikasi telah dikirim. Periksa kotak masuk dan folder spam. Jika Anda sudah memiliki akun, gunakan halaman masuk.',
}
const unavailable: HubRegistrationState = {
  status: 'error', message: 'Pendaftaran belum dapat diproses. Coba lagi nanti atau hubungi tim Webzoka.',
}
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(72),
  confirmation: z.string().min(12).max(72),
  terms: z.literal(true),
}).refine(value => value.password === value.confirmation)
const required = ['name', 'email', 'password', 'password_confirmation', 'terms']
const optional = ['website', 'cf-turnstile-response']

function signupCallbackOrigin(requestOrigin?: string | null) {
  const configured = hubAppUrl()
  // These are server-owned application origins, never a client return URL.
  const allowed = new Set([configured, 'https://ja-superadmin-platform.vercel.app'])
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    const preview = new URL(`https://${process.env.VERCEL_URL}`)
    if (preview.hostname.endsWith('.vercel.app') && !preview.username && !preview.password && !preview.port) allowed.add(preview.origin)
  }
  return requestOrigin && allowed.has(requestOrigin) ? requestOrigin : configured
}

/** Creates only an Auth identity. Provider policies own signup and CAPTCHA. */
export async function registerHubAccount(form: FormData, ip: string, requestOrigin?: string | null): Promise<HubRegistrationState> {
  if (String(form.get('website') ?? '').trim()) return { ...sent }
  if ([...form.keys()].some(key => !required.includes(key) && !optional.includes(key) && !key.startsWith('$ACTION_')) ||
      required.some(key => form.getAll(key).length !== 1 || typeof form.get(key) !== 'string') ||
      optional.some(key => form.getAll(key).length > 1 || (form.has(key) && typeof form.get(key) !== 'string'))) {
    return { status: 'error', message: 'Periksa kembali data pendaftaran Anda.' }
  }
  const parsed = schema.safeParse({
    name: form.get('name'), email: form.get('email'), password: form.get('password'),
    confirmation: form.get('password_confirmation'), terms: form.get('terms') === 'on',
  })
  if (!parsed.success) return { status: 'error', message: 'Isi nama dan email yang valid, setujui pembuatan akun, dan gunakan kata sandi yang sama dengan minimal 12 karakter.' }

  const captchaToken = String(form.get('cf-turnstile-response') ?? '')
  if (captchaToken.length > 4096 || (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken)) {
    return { status: 'error', message: 'Selesaikan pemeriksaan keamanan terlebih dahulu.' }
  }
  const emailKey = createHash('sha256').update(parsed.data.email).digest('hex')
  const ipLimit = rateLimit(`hub-signup:ip:${ip}`, 6, 60 * 60_000)
  const emailLimit = rateLimit(`hub-signup:email:${emailKey}`, 4, 60 * 60_000)
  if (!ipLimit.allowed || !emailLimit.allowed) return { status: 'error', message: 'Terlalu banyak percobaan. Coba kembali nanti.' }

  try {
    const callback = new URL('/auth/callback', signupCallbackOrigin(requestOrigin))
    callback.searchParams.set('flow', 'signup')
    const db = await createClient()
    const { data, error } = await db.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        // Display data only; it never grants application access.
        data: { full_name: parsed.data.name },
        emailRedirectTo: callback.toString(),
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    if (error) {
      if (['user_already_exists', 'email_exists'].includes(error.code ?? '')) return { ...sent }
      return { ...unavailable }
    }
    // This flow requires email confirmation. An auto-confirmed signup must not
    // leave a browser authenticated or enter the workspace automatically.
    if (data.session) {
      try { await db.auth.signOut({ scope: 'local' }) } catch { /* Local cleanup still runs. */ }
      await clearHubSessionCookies()
      return { status: 'error', message: 'Verifikasi email belum tersedia. Hubungi tim Webzoka untuk melanjutkan.' }
    }
    return { ...sent }
  } catch {
    return { ...unavailable }
  }
}

/** PKCE exchange and a fresh provider identity check precede the fixed return. */
export async function finishHubRegistration(request: Request) {
  const url = new URL(request.url)
  const response = (path: string) => {
    const result = NextResponse.redirect(new URL(path, url.origin))
    result.headers.set('cache-control', 'no-store')
    result.headers.set('referrer-policy', 'no-referrer')
    return result
  }
  const failed = () => response('/hub/signup?error=verification_failed')
  const code = url.searchParams.get('code')
  if (!code || code.length > 4096) return failed()

  let db: Awaited<ReturnType<typeof createClient>> | null = null
  let exchanged = false
  try {
    db = await createClient()
    const { data, error } = await db.auth.exchangeCodeForSession(code)
    if (error || !data.session?.user?.id) return failed()
    exchanged = true
    const { data: current, error: identityError } = await db.auth.getUser()
    if (identityError || !current.user?.email_confirmed_at || current.user.is_anonymous === true ||
        current.user.id !== data.session.user.id) {
      exchanged = false
      try { await db.auth.signOut({ scope: 'local' }) } catch { /* Local cleanup still runs. */ }
      await clearHubSessionCookies()
      return failed()
    }
    return response('/hub/account')
  } catch {
    if (exchanged && db) {
      try { await db.auth.signOut({ scope: 'local' }) } catch { /* Local cleanup still runs. */ }
      await clearHubSessionCookies()
    }
    return failed()
  }
}
