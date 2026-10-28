import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))
const subject = '00000000-0000-4000-8000-000000000101'

function form(changes = {}) {
  const data = new FormData()
  const fields = { name: 'Synthetic Customer', email: 'customer@example.test', password: 'A unique test password 123!', password_confirmation: 'A unique test password 123!', terms: 'on', ...changes }
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) data.set(key, value)
  return data
}

function harness(options = {}) {
  const calls = []
  const auth = {
    async signUp(input) { calls.push(['signUp', input]); return options.signup ?? { data: { user: { id: subject }, session: null }, error: null } },
    async exchangeCodeForSession(code) { calls.push(['exchange', code]); return options.exchange ?? { data: { user: { id: subject }, session: { user: { id: subject } } }, error: null } },
    async getUser() { calls.push(['getUser']); return options.user ?? { data: { user: { id: subject, email_confirmed_at: '2026-10-27T00:00:00Z', is_anonymous: false } }, error: null } },
    async signOut(input) { calls.push(['signOut', input]); if (options.logoutThrows) throw new Error('Provider unavailable'); return { error: options.logoutError ?? null } },
  }
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read('lib/hub-registration.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: mod, exports: mod.exports, URL, FormData,
    process: { env: options.env ?? {} },
    require(name) {
      if (name === 'server-only') return {}
      if (name === '@/lib/hub-session') return { clearHubSessionCookies: async () => { calls.push(['clearCookies']) } }
      if (name === 'zod') return require('zod')
      if (name === 'node:crypto') return { createHash }
      if (name === '@/lib/hub-app-url') return { hubAppUrl: () => 'https://hub.example.test' }
      if (name === '@/lib/rate-limit') return { rateLimit: (...args) => { calls.push(['rateLimit', ...args]); return { allowed: options.limited !== true } } }
      if (name === '@/lib/supabase/server') return { createClient: async () => { calls.push(['client']); return { auth, from() { throw new Error('Registration must not access business tables') }, rpc() { throw new Error('Registration must not call business RPCs') } } } }
      if (name === 'next/server') return { NextResponse: { redirect: url => ({ status: 307, location: String(url), headers: new Headers() }) } }
      throw new Error('Unexpected import: ' + name)
    },
  })
  return { api: mod.exports, calls }
}

test('public registration sends only identity credentials to the public Auth API', async () => {
  const h = harness()
  const result = await h.api.registerHubAccount(form(), '192.0.2.1')
  assert.equal(result.status, 'success')
  const signup = h.calls.find(call => call[0] === 'signUp')[1]
  assert.deepEqual(plain(signup), {
    email: 'customer@example.test', password: 'A unique test password 123!',
    options: { data: { full_name: 'Synthetic Customer' }, emailRedirectTo: 'https://hub.example.test/auth/callback?flow=signup' },
  })
  assert.ok(!JSON.stringify(result).includes('password'))
  assert.ok(h.calls.filter(call => call[0] === 'rateLimit').every(call => !call[1].includes('customer@example.test')))
})

test('invalid, duplicate and authorization fields never reach Auth', async () => {
  for (const changes of [{ name: 'a' }, { email: 'invalid' }, { password: 'short' }, { password_confirmation: 'different password' }, { terms: undefined }, { role: 'owner' }, { tenant_id: subject }, { next: '//evil.test' }]) {
    const h = harness()
    assert.equal((await h.api.registerHubAccount(form(changes), '192.0.2.1')).status, 'error')
    assert.ok(!h.calls.some(call => call[0] === 'client'))
  }
  const h = harness(), duplicate = form()
  duplicate.append('email', 'other@example.test')
  assert.equal((await h.api.registerHubAccount(duplicate, '192.0.2.1')).status, 'error')
  assert.ok(!h.calls.some(call => call[0] === 'client'))
})

test('confirmation stays on a server-owned origin; form data cannot select a callback', async () => {
  for (const origin of ['https://evil.test', '//evil.test', 'https://hub.example.test.evil.test']) {
    const h = harness()
    await h.api.registerHubAccount(form(), '192.0.2.1', origin)
    assert.equal(h.calls.find(call => call[0] === 'signUp')[1].options.emailRedirectTo, 'https://hub.example.test/auth/callback?flow=signup')
  }
  const canonical = harness()
  await canonical.api.registerHubAccount(form(), '192.0.2.1', 'https://ja-superadmin-platform.vercel.app')
  assert.equal(canonical.calls.find(call => call[0] === 'signUp')[1].options.emailRedirectTo, 'https://ja-superadmin-platform.vercel.app/auth/callback?flow=signup')
  const preview = harness({ env: { VERCEL_ENV: 'preview', VERCEL_URL: 'trusted-preview.vercel.app' } })
  await preview.api.registerHubAccount(form(), '192.0.2.1', 'https://trusted-preview.vercel.app')
  assert.equal(preview.calls.find(call => call[0] === 'signUp')[1].options.emailRedirectTo, 'https://trusted-preview.vercel.app/auth/callback?flow=signup')
})

test('honeypot and rate limits stop work before creating an Auth client', async () => {
  const bot = harness()
  assert.equal((await bot.api.registerHubAccount(form({ website: 'https://bot.test' }), '192.0.2.1')).status, 'success')
  assert.equal(bot.calls.length, 0)
  const limited = harness({ limited: true })
  assert.equal((await limited.api.registerHubAccount(form(), '192.0.2.1')).status, 'error')
  assert.ok(!limited.calls.some(call => call[0] === 'client'))
})

test('configured CAPTCHA must be completed and is verified by Auth, not consumed twice', async () => {
  const missing = harness({ env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-key' } })
  assert.equal((await missing.api.registerHubAccount(form(), '192.0.2.1')).status, 'error')
  assert.ok(!missing.calls.some(call => call[0] === 'client'))
  const completed = harness({ env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-key' } })
  assert.equal((await completed.api.registerHubAccount(form({ 'cf-turnstile-response': 'captcha-proof' }), '192.0.2.1')).status, 'success')
  assert.equal(completed.calls.find(call => call[0] === 'signUp')[1].options.captchaToken, 'captcha-proof')
})

test('existing-account response is generic and never changes existing credentials', async () => {
  const normal = harness(), existing = harness({ signup: { data: { user: null, session: null }, error: { code: 'user_already_exists', message: 'private provider error' } } })
  assert.deepEqual(plain(await existing.api.registerHubAccount(form(), '192.0.2.1')), plain(await normal.api.registerHubAccount(form(), '192.0.2.1')))
  assert.ok(!existing.calls.some(call => ['getUser', 'exchange', 'signOut'].includes(call[0])))
})

test('disabled signup and provider failures do not report an email as sent', async () => {
  for (const error of [{ code: 'signup_disabled' }, { code: 'captcha_failed' }, { code: 'over_email_send_rate_limit' }, { code: 'unexpected_failure', message: 'private provider details' }]) {
    const h = harness({ signup: { data: { user: null, session: null }, error } })
    const result = await h.api.registerHubAccount(form(), '192.0.2.1')
    assert.equal(result.status, 'error')
    assert.ok(!JSON.stringify(result).includes('private provider'))
  }
})

test('unexpected auto-confirmation cannot establish an application session', async () => {
  const h = harness({ signup: { data: { user: { id: subject }, session: { user: { id: subject } } }, error: null } })
  assert.equal((await h.api.registerHubAccount(form(), '192.0.2.1')).status, 'error')
  assert.deepEqual(plain(h.calls.find(call => call[0] === 'signOut')), ['signOut', { scope: 'local' }])
})

test('a confirmed PKCE session enters the account page without trusting next or roles', async () => {
  const h = harness()
  const result = await h.api.finishHubRegistration(new Request('https://hub.example.test/auth/callback?flow=signup&code=one-use-code&next=https://evil.test'))
  assert.equal(result.location, 'https://hub.example.test/hub/account')
  assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.equal(result.headers.get('referrer-policy'), 'no-referrer')
  assert.deepEqual(h.calls.map(call => call[0]), ['client', 'exchange', 'getUser'])
})

test('missing or failed PKCE exchange cannot use a pre-existing browser session', async () => {
  const missing = harness()
  assert.match((await missing.api.finishHubRegistration(new Request('https://hub.example.test/auth/callback?flow=signup'))).location, /verification_failed/)
  assert.equal(missing.calls.length, 0)
  const failed = harness({ exchange: { data: { session: null, user: null }, error: { code: 'expired' } } })
  assert.match((await failed.api.finishHubRegistration(new Request('https://hub.example.test/auth/callback?flow=signup&code=expired'))).location, /verification_failed/)
  assert.deepEqual(failed.calls.map(call => call[0]), ['client', 'exchange'])
})

test('unconfirmed, anonymous, swapped and unavailable users cannot enter Hub', async () => {
  for (const user of [
    { data: { user: { id: subject, email_confirmed_at: null, is_anonymous: false } }, error: null },
    { data: { user: { id: subject, email_confirmed_at: 'confirmed', is_anonymous: true } }, error: null },
    { data: { user: { id: subject.replace('101', '102'), email_confirmed_at: 'confirmed' } }, error: null },
    { data: { user: null }, error: { code: 'invalid_token' } },
  ]) {
    const h = harness({ user })
    const result = await h.api.finishHubRegistration(new Request('https://hub.example.test/auth/callback?flow=signup&code=one-use-code'))
    assert.match(result.location, /verification_failed/)
    assert.ok(h.calls.some(call => call[0] === 'signOut'))
  }
})

test('registration has no business, privileged, trial, Company or financial side effects', () => {
  const source = read('lib/hub-registration.ts')
  assert.doesNotMatch(source, /createAdminClient|SERVICE_ROLE|\.from\(|\.rpc\(|\.insert\(|\.upsert\(|\.updateUser\(|\.generateLink\(|signInWithOtp|user_role|tenant_id|app_metadata|finalize_customer_onboarding/)
  assert.ok(source.includes("scope: 'local'"))
})

function loadFile(file, mocks, globals = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module: mod, exports: mod.exports, URL, process: { env: { NODE_ENV: 'production' } },
    require(name) {
      if (name in mocks) return mocks[name]
      if (name === '@/lib/hub-owned-workspace') return { readOwnedHubWorkspace: async () => ({ status: 'empty' }) }
      throw new Error('Unexpected import: ' + name)
    },
    ...globals,
  })
  return mod.exports
}

test('the signup callback is separate from the existing password-recovery callback', async () => {
  const calls = []
  const route = loadFile('app/auth/callback/route.ts', {
    'next/server': { NextResponse: { redirect: url => ({ location: String(url) }) } },
    '@/lib/hub-return-path': { safeHubAuthPath: () => '/hub/update-password' },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { exchangeCodeForSession: async () => { calls.push('recovery'); return { error: null } } } }) },
    '@/lib/hub-registration': { finishHubRegistration: async () => { calls.push('signup'); return { location: 'signup-handler' } } },
  })
  assert.equal((await route.GET(new Request('https://hub.example.test/auth/callback?flow=signup&code=signup-code'))).location, 'signup-handler')
  assert.deepEqual(calls, ['signup'])
  assert.equal((await route.GET(new Request('https://hub.example.test/auth/callback?code=recovery-code&next=https://evil.test'))).location, 'https://hub.example.test/hub/update-password')
  assert.deepEqual(calls, ['signup', 'recovery'])
})

test('only the exact signup page is public; adjacent Hub paths still require authentication', async () => {
  const calls = []
  const proxy = loadFile('proxy.ts', {
    '@supabase/ssr': { createServerClient: () => { calls.push('auth'); return { auth: { getClaims: async () => ({ data: { claims: null } }) } } } },
    'next/server': { NextResponse: { next: () => ({ status: 200 }), redirect: url => ({ status: 307, location: String(url) }) } },
    '@/lib/superadmin': { isSuperadminEmail: () => false },
    '@/lib/hub-navigation': loadFile('lib/hub-navigation.ts', {}),
  })
  const request = path => ({ nextUrl: new URL('https://hub.example.test' + path), url: 'https://hub.example.test' + path, cookies: { getAll: () => [] } })
  assert.equal((await proxy.proxy(request('/hub/signup'))).status, 200)
  assert.equal(calls.length, 0)
  const nested = await proxy.proxy(request('/hub/signup/private'))
  assert.equal(nested.status, 307)
  assert.equal(nested.location, 'https://hub.example.test/hub/login')
  assert.deepEqual(calls, ['auth'])
})

test('the account page reads only its own membership and never manufactures tenant data', async () => {
  for (const error of [null, { code: 'read_failed' }]) {
    const calls = []
    const chain = { select() { return this }, eq(...args) { calls.push(['eq', ...args]); return this }, in() { return this }, limit() { return this }, async maybeSingle() { return { data: null, error } } }
    const api = loadFile('lib/hub-account.ts', {
      'server-only': {}, react: { cache: fn => fn },
      'next/navigation': { redirect: path => { throw new Error('REDIRECT:' + path) } },
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: subject, email: 'customer@example.test', email_confirmed_at: 'confirmed', user_metadata: { full_name: 'Customer', role: 'owner' } } }, error: null }) }, from: table => { calls.push(table); assert.equal(table, 'tenant_members'); return chain } }) },
    })
    assert.deepEqual(plain(await api.getHubAccount()), { email: 'customer@example.test', name: 'Customer', accessReady: !error, workspace: { status: 'empty' } })
    assert.deepEqual(calls, ['tenant_members', ['eq', 'user_id', subject], ['eq', 'is_active', true]])
  }
})

test('only the exact account return path is added; recovery and external targets stay closed', () => {
  const paths = loadFile('lib/hub-return-path.ts', {})
  assert.equal(paths.safeHubReturnPath('/hub/account'), '/hub/account')
  for (const value of ['/hub/account/private', '/hub/account?tenant_id=foreign', '/hub/account#fragment', '//evil.test/hub/account', '/\\evil.test/hub/account']) assert.equal(paths.safeHubReturnPath(value), null)
  assert.equal(paths.safeHubAuthPath('/hub/account'), '/hub/update-password')
})

test('account entry denies unverified identities and sends existing members to their dashboard', async () => {
  const verified = { id: subject, email: 'customer@example.test', email_confirmed_at: 'confirmed' }
  for (const [user, member, destination] of [
    [null, null, '/hub/login'],
    [{ ...verified, email_confirmed_at: null }, null, '/hub/login'],
    [{ ...verified, is_anonymous: true }, null, '/hub/login'],
    [verified, { tenant_id: subject }, '/hub'],
  ]) {
    let reads = 0
    const chain = { select() { return this }, eq() { return this }, in() { return this }, limit() { return this }, async maybeSingle() { return { data: member, error: null } } }
    const api = loadFile('lib/hub-account.ts', {
      'server-only': {}, react: { cache: fn => fn },
      'next/navigation': { redirect: path => { throw new Error('REDIRECT:' + path) } },
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) }, from: table => { assert.equal(table, 'tenant_members'); reads++; return chain } }) },
    })
    await assert.rejects(api.getHubAccount(), error => error.message === 'REDIRECT:' + destination)
    assert.equal(reads, member ? 1 : 0)
  }
})

test('account logout is local and returns to the account login entry', async () => {
  const calls = []
  const api = loadFile('app/hub/account/actions.ts', {
    'next/navigation': { redirect: path => { throw new Error('REDIRECT:' + path) } },
    '@/lib/hub-session': { clearHubSessionCookies: async () => { calls.push('clearCookies') } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { signOut: async input => { calls.push(plain(input)) } } }) },
  })
  await assert.rejects(api.logoutHubAccount(), /REDIRECT:\/hub\/login$/)
  assert.deepEqual(calls, [{ scope: 'local' }, 'clearCookies'])
})

test('rejected signup and callback sessions clear browser cookies even when provider logout fails', async () => {
  for (const failure of [{ logoutError: { status: 500 } }, { logoutThrows: true }]) {
    const signup = harness({ ...failure, signup: { data: { session: { user: { id: subject } } }, error: null } })
    assert.equal((await signup.api.registerHubAccount(form(), '192.0.2.1')).status, 'error')
    assert.equal(signup.calls.filter(call => call[0] === 'clearCookies').length, 1)
    const callback = harness({ ...failure, user: { data: { user: null }, error: { status: 500 } } })
    assert.match((await callback.api.finishHubRegistration(new Request('https://hub.example.test/auth/callback?code=rejected'))).location, /verification_failed/)
    assert.equal(callback.calls.filter(call => call[0] === 'clearCookies').length, 1)
  }
})

test('login does not redirect stale claims into the account rejection loop', async () => {
  const verified = { id: subject, email: 'customer@example.test', email_confirmed_at: 'confirmed', is_anonymous: false }
  for (const user of [null, { ...verified, email_confirmed_at: null }, { ...verified, is_anonymous: true }, { ...verified, id: 'different-subject' }, verified]) {
    const jsx = (type, props) => ({ type, props })
    const page = loadFile('app/hub/login/page.tsx', {
      'react/jsx-runtime': { jsx, jsxs: jsx },
      'next/image': { default: 'img' }, 'next/link': { default: 'a' },
      'next/navigation': { redirect: path => { throw new Error('REDIRECT:' + path) } },
      'next/headers': { headers: async () => ({}) },
      '@/lib/google-oauth-dev': { googleDevConfig: () => false },
      '@/lib/supabase/server': { createClient: async () => ({ auth: {
        getClaims: async () => ({ data: { claims: { sub: subject } } }),
        getUser: async () => ({ data: { user }, error: user ? null : { status: 500 } }),
      } }) },
      '@/lib/hub-return-path': { safeHubReturnPath: () => '/hub/account' },
      '../_components/HubAuthStory': { HubAuthStory: 'story' },
      './HubLoginForm': { HubLoginForm: 'form' }, './login.module.css': { default: {} },
      'lucide-react': Object.fromEntries(['ArrowRight', 'Headset', 'LayoutGrid', 'ReceiptText', 'UserRound'].map(name => [name, name])),
    })
    const render = () => page.default({ searchParams: Promise.resolve({ next: '/hub/account' }) })
    if (user === verified) {
      await assert.rejects(render(), /REDIRECT:\/hub\/account/)
      continue
    }
    const result = await render()
    assert.equal(result.type, 'div')
    assert.match(JSON.stringify(result), /Sesi belum dapat diverifikasi/)
  }
})

test('cookie cleanup expires only this project session and PKCE cookie chunks', async () => {
  const prefix = 'sb-core-auth-token'
  const owned = [prefix, `${prefix}.0`, `${prefix}.11`, `${prefix}-code-verifier`, `${prefix}-code-verifier.0`]
  const other = ['theme', 'sb-other-auth-token', `${prefix}-unrelated`, `${prefix}.not-a-chunk`]
  const writes = []
  const api = loadFile('lib/hub-session.ts', {
    'server-only': {}, '@supabase/ssr': { DEFAULT_COOKIE_OPTIONS: { path: '/', sameSite: 'lax' } },
    'next/headers': { cookies: async () => ({ getAll: () => [...owned, ...other].map(name => ({ name, value: 'sensitive' })), set: (...args) => writes.push(args) }) },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://core.supabase.co' } } })
  await api.clearHubSessionCookies()
  assert.deepEqual(writes.map(([name]) => name), owned)
  for (const [, value, options] of writes) {
    assert.equal(value, '')
    assert.equal(options.maxAge, 0)
    assert.equal(options.expires.getTime(), 0)
    assert.equal(options.path, '/')
  }
})

test('explicit logout clears cookies on returned and thrown provider errors', async () => {
  for (const throws of [false, true]) {
    let cleared = 0
    const api = loadFile('app/hub/account/actions.ts', {
      'next/navigation': { redirect: path => { throw new Error('REDIRECT:' + path) } },
      '@/lib/hub-session': { clearHubSessionCookies: async () => { cleared++ } },
      '@/lib/supabase/server': { createClient: async () => ({ auth: { signOut: async () => { if (throws) throw new Error('Unavailable'); return { error: { status: 500 } } } } }) },
    })
    await assert.rejects(api.logoutHubAccount(), /REDIRECT:\/hub\/login/)
    assert.equal(cleared, 1)
  }
})
