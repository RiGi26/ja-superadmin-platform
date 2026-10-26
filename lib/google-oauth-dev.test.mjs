// Offline source/unit checks. No provider, HTTP server, browser or DB runtime.
import assert from 'node:assert/strict'
import { assertFrozenOrSecurityDependency } from './security-dependency-successor.mjs'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash, webcrypto } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import { createServerClient } from '@supabase/ssr'
import * as jsxRuntime from 'react/jsx-runtime'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { approvedHubSource } from './hub-integration-contract.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'
const ref = 'mcvekinhgcqygfddyifs'
const origin = 'http://localhost:3000'
const prefix = '/api/auth/google'
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
// Explicitly synthetic unsigned fixture; never a connection credential.
const anon = (payload = {}, header = {}) => `${encode({ alg: 'HS256', typ: 'JWT', ...header })}.${encode({ role: 'anon', ref, exp: 4102444800, ...payload })}.synthetic`
const environment = (changes = {}) => ({
  NODE_ENV: 'development', HUB_GOOGLE_DEV_ENABLED: 'true', HUB_GOOGLE_DEV_PROJECT_REF: ref,
  HUB_GOOGLE_DEV_ORIGIN: origin, HUB_GOOGLE_DEV_CALLBACK_URL: `${origin}${prefix}/callback`,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon(),
  ...changes,
})
const source = (path) => readFileSync(join(root, path), 'utf8')
const load = (path, dependencies = {}, env = {}) => {
  const compiled = ts.transpileModule(source(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  const testModule = { exports: {} }
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports, Buffer, URL, URLSearchParams, Headers, Request, Response,
    Date, crypto: webcrypto, process: { env }, console,
    fetch() { throw new Error('NETWORK_FORBIDDEN') },
    require(name) {
      if (!(name in dependencies)) throw new Error(`UNAPPROVED_IMPORT: ${name}`)
      return dependencies[name]
    },
  }, { filename: path })
  return testModule.exports
}
const policy = load('lib/google-oauth-dev.ts')
const request = (path, { method = 'GET', query = '', headers = {}, base = origin } = {}) =>
  new Request(`${base}${prefix}/${path}${query}`, { method, headers: {
    host: 'localhost:3000', ...(method === 'POST' ? { origin } : {}), ...headers,
  } })

test('complete exact local DEV contract enables only an anon-bound candidate', () => {
  const config = policy.googleDevConfig(environment())
  assert.equal(config?.url, `https://${ref}.supabase.co`)
  assert.equal(config?.anonKey, anon())
})

for (const [name, changes] of [
  ['missing opt-in', { HUB_GOOGLE_DEV_ENABLED: undefined }],
  ['false opt-in', { HUB_GOOGLE_DEV_ENABLED: 'false' }],
  ['ambiguous opt-in', { HUB_GOOGLE_DEV_ENABLED: 'TRUE' }],
  ['missing binding', { HUB_GOOGLE_DEV_PROJECT_REF: undefined }],
  ['wrong binding', { HUB_GOOGLE_DEV_PROJECT_REF: 'hxhusfkrlafxdnyasmsu' }],
  ['production', { NODE_ENV: 'production' }], ['test mode', { NODE_ENV: 'test' }],
  ['missing mode', { NODE_ENV: undefined }], ['hosted deployment', { VERCEL: '1' }],
  ['preview environment', { VERCEL_ENV: 'preview' }], ['empty deployment marker', { VERCEL: '' }],
  ['legacy Hub visual preview', { HUB_PREVIEW_MODE: 'true' }],
  ['legacy consent visual preview', { HUB_SSO_PREVIEW_MODE: 'true' }],
  ['missing URL', { NEXT_PUBLIC_SUPABASE_URL: undefined }],
  ['production project', { NEXT_PUBLIC_SUPABASE_URL: 'https://hxhusfkrlafxdnyasmsu.supabase.co' }],
  ['unknown project', { NEXT_PUBLIC_SUPABASE_URL: 'https://unknown.supabase.co' }],
  ['URL suffix spoof', { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co.evil.test` }],
  ['URL credentials', { NEXT_PUBLIC_SUPABASE_URL: `https://user@${ref}.supabase.co` }],
  ['URL query', { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co?ref=${ref}` }],
  ['missing origin', { HUB_GOOGLE_DEV_ORIGIN: undefined }],
  ['loopback alias', { HUB_GOOGLE_DEV_ORIGIN: 'http://127.0.0.1:3000' }],
  ['custom domain', { HUB_GOOGLE_DEV_ORIGIN: 'https://www.webzoka.com' }],
  ['missing callback', { HUB_GOOGLE_DEV_CALLBACK_URL: undefined }],
  ['recovery callback', { HUB_GOOGLE_DEV_CALLBACK_URL: `${origin}/auth/callback` }],
  ['callback query', { HUB_GOOGLE_DEV_CALLBACK_URL: `${origin}${prefix}/callback?next=/hub` }],
  ['missing key', { NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined }],
  ['placeholder key', { NEXT_PUBLIC_SUPABASE_ANON_KEY: '<DEV_ANON_KEY>' }],
  ['opaque unsupported key', { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_synthetic' }],
  ['service role key', { NEXT_PUBLIC_SUPABASE_ANON_KEY: anon({ role: 'service_role' }) }],
  ['wrong key ref', { NEXT_PUBLIC_SUPABASE_ANON_KEY: anon({ ref: 'hxhusfkrlafxdnyasmsu' }) }],
  ['missing key ref', { NEXT_PUBLIC_SUPABASE_ANON_KEY: anon({ ref: undefined }) }],
  ['expired key', { NEXT_PUBLIC_SUPABASE_ANON_KEY: anon({ exp: 1 }) }],
  ['missing key expiry', { NEXT_PUBLIC_SUPABASE_ANON_KEY: anon({ exp: undefined }) }],
  ['unsupported key algorithm', { NEXT_PUBLIC_SUPABASE_ANON_KEY: anon({}, { alg: 'none' }) }],
]) test(`fail closed: ${name}`, () => assert.equal(policy.googleDevConfig(environment(changes)), null))

test('controlled host and forwarded headers are required', () => {
  assert.equal(policy.googleDevRequest(request('start', { method: 'POST' }), 'start', true), true)
  for (const headers of [
    { host: 'evil.test' }, { host: 'localhost:3001' }, { host: '127.0.0.1:3000' },
    { 'x-forwarded-host': 'evil.test' }, { 'x-forwarded-proto': 'https' },
    { forwarded: 'host=localhost:3000' }, { origin: 'https://evil.test' }, { origin: 'null' },
  ]) assert.equal(policy.googleDevRequest(request('start', { method: 'POST', headers }), 'start', true), false)
  assert.equal(policy.googleDevRequest(request('start'), 'start', true), false)
  assert.equal(policy.googleDevRequest(request('start', { method: 'POST', base: 'https://evil.test' }), 'start', true), false)
})

for (const query of ['', '?error=access_denied', '?code=short', '?code=1234567890123456&code=1234567890123456',
  '?code=1234567890123456&next=https://evil.test', '?code=1234567890123456&next=//evil.test',
  '?code=1234567890123456&authorization_id=h2', '?code=%0d%0a1234567890123456',
]) test(`callback input rejected: ${query || 'missing code'}`, () =>
  assert.equal(policy.googleDevCode(new URL(`${origin}${prefix}/callback${query}`)), null))

function harness({ env = environment(), exchangeError = null, userError = null, user = {
  id: '11111111-1111-4111-8111-111111111111', is_anonymous: false,
  email: 'synthetic@example.test', identities: [{ provider: 'google' }],
}, verifier = true, startError = null, revokeError = null, authorizeUrl } = {}) {
  const calls = []
  let hasVerifier = verifier
  const config = policy.googleDevConfig(environment())
  const goodUrl = `${config?.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${origin}${prefix}/callback`)}&code_challenge_method=s256&code_challenge=${'a'.repeat(43)}`
  const dependencies = {
    '@/lib/google-oauth-dev': policy,
    '@/lib/supabase/google-dev': {
      clearGoogleDevCookies: async () => { calls.push(['clear']); hasVerifier = false },
      hasGoogleDevVerifier: async () => hasVerifier,
      createGoogleDevClient: async (binding) => {
        calls.push(['client', binding.url])
        return { auth: {
          signInWithOAuth: async (args) => { calls.push(['start', args]); return { data: { url: authorizeUrl ?? goodUrl }, error: startError } },
          exchangeCodeForSession: async (code) => { calls.push(['exchange', code]); hasVerifier = false; return { error: exchangeError } },
          getUser: async () => { calls.push(['user']); return { data: { user }, error: userError } },
          signOut: async (args) => { calls.push(['logout', args]); return { error: revokeError } },
        } }
      },
    },
  }
  return { calls, loadRoute: (name) => load(`app/api/auth/google/${name}/route.ts`, dependencies, env) }
}

for (const name of ['start', 'callback', 'pending', 'logout']) {
  test(`${name}: disabled config does not construct a client`, async () => {
    const h = harness({ env: environment({ HUB_GOOGLE_DEV_ENABLED: undefined }) })
    const post = ['start', 'logout'].includes(name)
    const result = await h.loadRoute(name)[post ? 'POST' : 'GET'](request(name, { method: post ? 'POST' : 'GET' }))
    assert.equal(result.status, 404); assert.equal(h.calls.length, 0)
  })
  test(`${name}: foreign host denied before Auth`, async () => {
    const h = harness(); const post = ['start', 'logout'].includes(name)
    const result = await h.loadRoute(name)[post ? 'POST' : 'GET'](request(name, { method: post ? 'POST' : 'GET', headers: { host: 'evil.test' } }))
    assert.equal(result.status, 404); assert.equal(h.calls.length, 0)
  })
}

test('start uses Google SSR PKCE with fixed callback and validates returned destination', async () => {
  const h = harness()
  const result = await h.loadRoute('start').POST(request('start', { method: 'POST' }))
  assert.equal(result.status, 303)
  const url = new URL(result.headers.get('location'))
  assert.equal(url.origin, `https://${ref}.supabase.co`)
  assert.equal(url.searchParams.get('redirect_to'), `${origin}${prefix}/callback`)
  const args = h.calls.find(([name]) => name === 'start')[1]
  assert.equal(args.provider, 'google'); assert.equal(args.options.skipBrowserRedirect, true)
  assert.equal(result.headers.get('cache-control'), 'no-store')
})

for (const options of [{ startError: { message: 'synthetic failure' } }, { authorizeUrl: 'https://evil.test/auth/v1/authorize' }]) {
  test('start errors or foreign authorization destination clear isolated cookies', async () => {
    const h = harness(options); const result = await h.loadRoute('start').POST(request('start', { method: 'POST' }))
    assert.equal(result.status, 400); assert.equal(h.calls.at(-1)[0], 'clear')
  })
}

test('valid callback authenticates and redirects only to nonprivileged pending state', async () => {
  const h = harness(); const result = await h.loadRoute('callback').GET(request('callback', { query: '?code=11111111-1111-4111-8111-111111111111' }))
  assert.equal(result.status, 303)
  assert.equal(result.headers.get('location'), `${origin}${prefix}/pending`)
  assert.deepEqual(h.calls.map(([name]) => name), ['client', 'exchange', 'user'])
})

for (const options of [{ verifier: false }, { exchangeError: { message: 'invalid/expired/replayed' } },
  { userError: { message: 'revoked' } }, { user: null }, { user: { is_anonymous: true } },
  { user: { id: 'synthetic', identities: [{ provider: 'email' }] } }]) {
  test(`callback refuses incomplete or failed Auth: ${JSON.stringify(options)}`, async () => {
    const h = harness(options); const result = await h.loadRoute('callback').GET(request('callback', { query: '?code=11111111-1111-4111-8111-111111111111' }))
    assert.equal(result.headers.get('location'), `${origin}/hub/login?message=google_dev_failed`)
    assert.equal(h.calls.at(-1)[0], 'clear')
    if (options.verifier === false) assert.ok(!h.calls.some(([name]) => name === 'exchange'))
  })
}

test('missing or unsafe callback code never invokes Auth', async () => {
  for (const query of ['', '?code=short', '?error=access_denied', '?code=1234567890123456&next=/hub']) {
    const h = harness(); await h.loadRoute('callback').GET(request('callback', { query }))
    assert.deepEqual(h.calls, [['clear']])
  }
})

test('one mock exchange consumes verifier; replay fails before another exchange', async () => {
  const h = harness(); const route = h.loadRoute('callback')
  const input = request('callback', { query: '?code=11111111-1111-4111-8111-111111111111' })
  assert.equal((await route.GET(input)).headers.get('location'), `${origin}${prefix}/pending`)
  assert.match((await route.GET(input)).headers.get('location'), /google_dev_failed$/)
  assert.equal(h.calls.filter(([name]) => name === 'exchange').length, 1)
})

test('pending has no business data access even for a Google superadmin/email match', async () => {
  const h = harness({ user: { id: 'synthetic', email: 'owner@example.test', app_metadata: { user_role: 'superadmin' }, identities: [{ provider: 'google' }] } })
  const result = await h.loadRoute('pending').GET(request('pending'))
  assert.equal(result.status, 200)
  const html = await result.text()
  assert.match(html, /Keanggotaan perusahaan Anda belum diverifikasi/)
  assert.match(html, /Pembuatan workspace belum tersedia/)
  assert.doesNotMatch(html, /owner@example|synthetic|<script|href=|access_token|refresh_token|provider_token/)
  assert.match(html, /min-height:48px/); assert.match(html, /name="viewport"/)
  assert.match(html, /font-size:16px/); assert.match(html, /prefers-reduced-motion/)
  assert.match(result.headers.get('content-security-policy'), /frame-ancestors 'none'/)
  assert.deepEqual(h.calls.map(([name]) => name), ['client', 'user'])
})

test('unverified pending request clears cookies and cannot render state', async () => {
  const h = harness({ user: null }); const result = await h.loadRoute('pending').GET(request('pending'))
  assert.equal(result.status, 303); assert.match(result.headers.get('location'), /google_dev_failed/)
})

test('logout uses local scope, clears only candidate cookies and returns fixed login', async () => {
  const h = harness(); const result = await h.loadRoute('logout').POST(request('logout', { method: 'POST' }))
  assert.equal(result.status, 303); assert.equal(result.headers.get('location'), `${origin}/hub/login`)
  assert.equal(h.calls.find(([name]) => name === 'logout')[1].scope, 'local')
  assert.equal(h.calls.at(-1)[0], 'clear')
})

test('logout revocation failure is explicit; local deletion does not claim managed revocation', async () => {
  const h = harness({ revokeError: { message: 'synthetic failure' } })
  const result = await h.loadRoute('logout').POST(request('logout', { method: 'POST' }))
  assert.equal(result.status, 503); assert.equal(h.calls.at(-1)[0], 'clear')
  assert.match(await result.text(), /revocation needs owner review/)
})

function cookieStore(initial = []) {
  const jar = new Map(initial.map(({ name, value }) => [name, value])); const writes = []
  return { writes, getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set(name, value, options) { writes.push({ name, value, options }); if (options.maxAge === 0) jar.delete(name); else jar.set(name, value) },
  }
}

test('installed SSR creates PKCE verifier in isolated HttpOnly path without network', async () => {
  const store = cookieStore([{ name: `sb-${ref}-auth-token`, value: 'unrelated-default-session' }])
  const helper = load('lib/supabase/google-dev.ts', {
    'server-only': {}, '@/lib/google-oauth-dev': policy, 'next/headers': { cookies: async () => store },
    '@supabase/ssr': { createServerClient: (url, key, options) => createServerClient(url, key, { ...options, global: {
      fetch: async () => { throw new Error('NETWORK_FORBIDDEN') },
    } }) },
  })
  const client = await helper.createGoogleDevClient(policy.googleDevConfig(environment()))
  const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: {
    redirectTo: `${origin}${prefix}/callback`, skipBrowserRedirect: true,
  } })
  assert.equal(error, null); assert.equal(policy.googleDevAuthorizeUrl(data.url, policy.googleDevConfig(environment())), true)
  assert.equal(await helper.hasGoogleDevVerifier(), true)
  assert.ok(store.writes.some(({ name }) => name === 'wz-h1-google-dev-code-verifier'))
  for (const { name, options } of store.writes) {
    assert.equal(policy.isGoogleDevCookie(name), true); assert.equal(options.path, prefix)
    assert.equal(options.httpOnly, true); assert.equal(options.sameSite, 'lax'); assert.equal(options.secure, false)
  }
  await helper.clearGoogleDevCookies()
  assert.deepEqual(store.getAll(), [{ name: `sb-${ref}-auth-token`, value: 'unrelated-default-session' }])
})

test('cookie adapter rejects foreign writes and filters standard sessions from reads', async () => {
  const store = cookieStore([{ name: 'sb-default-auth-token', value: 'secret-fixture' }, { name: 'wz-h1-google-dev.0', value: 'isolated-fixture' }])
  let adapter
  const helper = load('lib/supabase/google-dev.ts', {
    'server-only': {}, '@/lib/google-oauth-dev': policy, 'next/headers': { cookies: async () => store },
    '@supabase/ssr': { createServerClient: (_url, _key, options) => { adapter = options.cookies; return {} } },
  })
  await helper.createGoogleDevClient(policy.googleDevConfig(environment()))
  assert.equal(adapter.getAll().length, 1); assert.equal(adapter.getAll()[0].name, 'wz-h1-google-dev.0')
  assert.throws(() => adapter.setAll([{ name: 'sb-default-auth-token', value: 'bad', options: {} }]), /Unexpected DEV auth cookie/)
})

test('installed SSR callback exchanges PKCE through mocked DEV Auth and preserves verifier/session isolation', async () => {
  const store = cookieStore()
  const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated',
    app_metadata: { provider: 'google' }, user_metadata: {}, identities: [{ provider: 'google' }],
    created_at: '2026-10-15T00:00:00Z', is_anonymous: false }
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, iss: `https://${ref}.supabase.co/auth/v1`, exp: 4102444800 })}.synthetic`
  const calls = []
  const helper = load('lib/supabase/google-dev.ts', {
    'server-only': {}, '@/lib/google-oauth-dev': policy, 'next/headers': { cookies: async () => store },
    '@supabase/ssr': { createServerClient: (url, key, options) => createServerClient(url, key, { ...options, global: {
      fetch: async (url, options) => {
        const parsed = new URL(url); calls.push(parsed.pathname)
        assert.equal(parsed.origin, `https://${ref}.supabase.co`)
        if (parsed.pathname === '/auth/v1/token') {
          assert.equal(parsed.searchParams.get('grant_type'), 'pkce')
          const body = JSON.parse(options.body)
          assert.equal(body.auth_code, '11111111-1111-4111-8111-111111111111')
          assert.ok(body.code_verifier.length >= 43)
          return Response.json({ access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, user })
        }
        assert.equal(parsed.pathname, '/auth/v1/user')
        return Response.json(user)
      },
    } }) },
  })
  const config = policy.googleDevConfig(environment())
  const start = await helper.createGoogleDevClient(config)
  await start.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}${prefix}/callback`, skipBrowserRedirect: true } })
  const route = load('app/api/auth/google/callback/route.ts', {
    '@/lib/google-oauth-dev': policy, '@/lib/supabase/google-dev': helper,
  }, environment())
  const result = await route.GET(request('callback', { query: '?code=11111111-1111-4111-8111-111111111111' }))
  assert.equal(result.headers.get('location'), `${origin}${prefix}/pending`)
  assert.deepEqual(calls, ['/auth/v1/token', '/auth/v1/user'])
  assert.equal(await helper.hasGoogleDevVerifier(), false)
  assert.ok(store.getAll().some(({ name }) => name === 'wz-h1-google-dev'))
  assert.ok(!store.getAll().some(({ name }) => name.startsWith('sb-')))
})

test('standard proxy cannot use isolated Google cookies for Hub, dashboard or H2 consent', async () => {
  const isolated = [{ name: 'wz-h1-google-dev', value: 'synthetic-isolated-session' }]
  const route = load('proxy.ts', {
    '@supabase/ssr': { createServerClient: (url, key, options) => createServerClient(url, key, { ...options, global: {
      fetch: async () => { throw new Error('STANDARD_AUTH_NETWORK_FORBIDDEN') },
    } }) },
    'next/server': { NextResponse: {
      next: () => ({ cookies: { set() {} } }),
      redirect: (url) => new Response(null, { status: 307, headers: { location: url.toString() } }),
    } },
    '@/lib/superadmin': { isSuperadminEmail: () => false },
  }, environment())
  for (const path of ['/hub', '/dashboard', '/oauth/consent?authorization_id=synthetic']) {
    const url = `${origin}${path}`
    const result = await route.proxy({ url, nextUrl: new URL(url), cookies: { getAll: () => isolated, set() {} } })
    assert.equal(result.status, 307)
    assert.equal(new URL(result.headers.get('location')).pathname, path === '/dashboard' ? '/login' : '/hub/login')
  }
})

test('login page displays Google only for exact DEV and never offers it as portal consent continuation', async () => {
  const paths = load('lib/hub-return-path.ts')
  for (const [env, host, next, enabled] of [
    [environment(), 'localhost:3000', undefined, true],
    [environment({ HUB_GOOGLE_DEV_ENABLED: undefined }), 'localhost:3000', undefined, false],
    [environment({ NODE_ENV: 'production' }), 'localhost:3000', undefined, false],
    [environment(), 'evil.test', undefined, false],
    [environment(), 'localhost:3000', '/oauth/consent?authorization_id=synthetic', false],
  ]) {
    const page = load('app/hub/login/page.tsx', {
      'react/jsx-runtime': jsxRuntime,
      'next/image': { default: (props) => createElement('img', { alt: props.alt, src: props.src }) },
      'next/link': { default: (props) => createElement('a', props) },
      'next/navigation': { redirect() { throw new Error('Unexpected redirect') } },
      'next/headers': { headers: async () => new Headers({ host }) },
      '@/lib/google-oauth-dev': policy, '@/lib/hub-return-path': paths,
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getClaims: async () => ({ data: null }) } }) },
      '../_components/HubAuthStory': { HubAuthStory: () => createElement('aside') },
      './HubLoginForm': { HubLoginForm: () => createElement('form', { 'data-password-login': 'intact' }) },
      '../hub.module.css': { default: {} },
    }, env)
    const html = renderToStaticMarkup(await page.default({ searchParams: Promise.resolve({ next }) }))
    assert.equal(html.includes('Masuk dengan Google'), enabled)
    assert.match(html, /data-password-login="intact"/)
    assert.doesNotMatch(html, /synthetic-refresh|eyJ/)
  }
})

test('password recovery allowlist never becomes a Google or H2 return path', () => {
  const paths = load('lib/hub-return-path.ts')
  for (const value of [null, '/hub', '/oauth/consent?authorization_id=h2', `${prefix}/pending`, '//evil.test', '/\\evil.test', 'https://evil.test', '/hub/update-password?next=//evil.test']) {
    assert.equal(paths.safeHubAuthPath(value), '/hub/update-password')
  }
  assert.equal(paths.safeHubReturnPath('/oauth/consent?authorization_id=fixture'), '/oauth/consent?authorization_id=fixture')
})

test('Core authentication sources stay frozen except approved token-free Hub integration', () => {
  for (const path of ['app/hub/login/HubLoginForm.tsx', 'app/hub/actions.ts', 'app/auth/callback/route.ts',
    'lib/hub-return-path.ts', 'lib/supabase/client.ts', 'lib/supabase/server.ts', 'app/oauth/consent/page.tsx',
    'app/oauth/consent/actions.ts', 'proxy.ts', 'lib/hub-data.ts', 'app/hub/page.tsx', 'package.json', 'package-lock.json']) {
    const expected = ['app/hub/actions.ts', 'lib/hub-data.ts', 'app/hub/page.tsx', 'proxy.ts', 'lib/hub-return-path.ts'].includes(path)
      ? approvedHubSource(path)
      : execFileSync('git', ['-C', root, 'show', `${baseline}:${path}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n')
    assertFrozenOrSecurityDependency(path, source(path), expected)
  }
})

test('new routes never use privileged queries, Company creation, custom account linking, H2 or secret configuration', () => {
  for (const path of ['lib/google-oauth-dev.ts', 'lib/supabase/google-dev.ts', ...['start', 'callback', 'pending', 'logout'].map((name) => `app/api/auth/google/${name}/route.ts`)]) {
    assert.doesNotMatch(source(path), /createAdminClient|SUPABASE_SERVICE_ROLE_KEY|GOOGLE_CLIENT_SECRET|VERCEL_OIDC_TOKEN|SUPABASE_DB_PASSWORD|(?<!Buffer)\.from\(|\.rpc\(|\.insert\(|\.upsert\(|\.linkIdentity\(|core-company|e1-workspace|customer-onboarding|hub-data|\/oauth\/consent/)
    assert.doesNotMatch(source(path), /['"]use client['"]|console\.log|console\.error/)
  }
})

test('all declared dependencies already resolve locally; no package changes required', () => {
  const pkg = JSON.parse(source('package.json'))
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  assert.equal(names.length, 27)
  for (const name of names) assert.ok(readFileSync(join(root, 'node_modules', name, 'package.json')).length, name)
})

test('historical H1 W1/PG17 artifacts and current disabled runtime guards are preserved', () => {
  // Core facade and its tests are authorized Step 1 successors, pinned by the
  // native manifest. These historical SQL/proposal artifacts remain immutable.
  const hashes = {
    'lib/e1-workspace.ts': 'ae8a6488844500683e45fcb7472c8b44127df43700a3c25da923f27aff0b86d4',
    'docs/security/h1-g1-core-dev/001_registry.PROPOSED.sql': 'b242b4eb188ddadd0ffc7e3d99849bec119ed336a20cf6283a817c53ac384c11',
    'docs/security/h1-g1-core-dev/002_writer.PROPOSED.sql': 'b4e2cbc6d72b817a2806793f86fd571f5e95ff83a966adf4ae2a750ccdb5e859',
    'docs/security/h1-g1-core-dev/003_catalog_checks.READ_ONLY.sql': 'b2b144f92e65b7c6164c9ca38772b5f3718b6f09244ea79bc960c360455d5044',
    'docs/security/h1-g1-core-dev/004_recovery.PROPOSED.sql': '3b8a8b3fe1f6c07d101da10700d856f449af4281b5ef57d9c3d95ba7cf4c6f8a',
    'docs/security/h1-g1-core-dev/RUNTIME_APPROVAL_PROPOSAL.md': 'c4567b1b3385f23e2ad83975ce42906815dc0b978b5cb4b4d0299dcd07b69cc7',
    'docs/security/h1-g1-core-dev/codec-vectors.json': 'cefe4c4a36944d89c940311d856e0c0503dbb9cd77d1adab9cd29753e2e7087f',
    'docs/security/h1-g1-core-dev/RUNTIME_PACKAGE.md': 'a237c824d843c7dcf0ee31dbc6633c02a7959d348582c86d6cf1880856bc7ba3',
    'docs/security/h1-g1-core-dev/SECURITY_DECISION_MATRIX.md': '23193848a9c4fb9d25bb331f2c08247533b5e51291da32d25a5bfd836ba8c52e',
  }
  for (const [path, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(readFileSync(join(root, path))).digest('hex'), hash, path)
  }
  assert.match(source('lib/core-company.ts'), /CORE_COMPANY_RUNTIME_ENABLED = false/)
})
