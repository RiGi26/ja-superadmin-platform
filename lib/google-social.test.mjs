// Offline application/SDK tests. Provider state, nonce and linking require isolated runtime evidence.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash, randomUUID, webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import * as ssr from '@supabase/ssr'

const require = createRequire(import.meta.url)
const { NextRequest, NextResponse } = require('next/server')
const origin = 'https://hub.webzoka.com'
const realm = 'https://hxhusfkrlafxdnyasmsu.supabase.co'
const path = '/api/auth/social/google'
const key = 'sb-hxhusfkrlafxdnyasmsu-auth-token'
const subject = '11111111-1111-4111-8111-111111111111'
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const jwt = user => `${encode({ alg: 'ES256' })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic`
const user = (changes = {}) => ({ id: subject, email: 'synthetic@example.invalid',
  email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false,
  identities: [{ provider: 'google', id: 'synthetic-google' }], app_metadata: {}, user_metadata: {}, ...changes })

function load(file, dependencies, env = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const sandboxModule = { exports: {} }
  vm.runInNewContext(compiled, { module: sandboxModule, exports: sandboxModule.exports, Buffer, URL, URLSearchParams,
    TextDecoder, AbortSignal, Date, Request, Response, crypto: webcrypto, process: { env },
    require(name) { assert.ok(Object.hasOwn(dependencies, name), 'Unexpected import: ' + name); return dependencies[name] },
  })
  return sandboxModule.exports
}
const catalog = load('./plan-catalog.ts', {})
const purchasePolicy = load('./stock-purchase-policy.ts', { '@/lib/plan-catalog': catalog })
const returns = load('./hub-return-path.ts', { '@/lib/stock-purchase-policy': purchasePolicy })

function harness({ enabled = true, pilot = false, verified = user(), exchanged = user(), previous = user(), live = true, environment = {}, tokenError = false } = {}) {
  const calls = [], codes = new Map()
  const fetch = async (url, options) => {
    calls.push({ url, method: options.method })
    assert.ok(url.startsWith(realm + '/auth/v1/') || url === realm + '/rest/v1/rpc/core_registry_session_is_live', 'Realm escape')
    if (url === realm + '/rest/v1/rpc/core_registry_session_is_live') {
      return live === 'unavailable' ? Response.json({ message: 'Unavailable' }, { status: 503 }) : Response.json(live)
    }
    if (url.endsWith('/token?grant_type=pkce')) {
      const body = JSON.parse(options.body)
      const entry = codes.get(body.auth_code)
      const challenge = createHash('sha256').update(body.code_verifier).digest('base64url')
      if (tokenError || !entry || entry.used || entry.challenge !== challenge) {
        return Response.json({ code: 'bad_code_verifier', msg: 'Denied' }, { status: 400 })
      }
      entry.used = true
      return Response.json({ access_token: jwt(exchanged), refresh_token: 'synthetic-refresh',
        expires_in: 3600, token_type: 'bearer', user: exchanged,
        provider_token: 'synthetic-upstream-token', provider_refresh_token: 'synthetic-upstream-refresh' })
    }
    if (url.endsWith('/user')) {
      const headers = new Headers(options.headers)
      return Response.json(headers.get('authorization') === 'Bearer synthetic-previous-access' ? previous : verified)
    }
    if (url.includes('/logout')) return new Response(null, { status: 204 })
    throw new Error('Unexpected offline Auth call: ' + url)
  }
  const env = { WEBZOKA_HUB_APP_URL: origin, NEXT_PUBLIC_SUPABASE_URL: realm,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_synthetic', ...environment }
  const policy = load('./google-social.ts', {
    'server-only': {}, 'node:crypto': { randomUUID }, 'next/server': { NextResponse },
    '@supabase/ssr': { ...ssr, createServerClient(url, key, options) {
      return ssr.createServerClient(url, key, { ...options, global: { fetch } })
    } }, '@/lib/hub-return-path': returns,
    '@/lib/google-social-release': { GOOGLE_SOCIAL_RUNTIME_ENABLED: enabled, GOOGLE_SOCIAL_PILOT_ENABLED: pilot },
  }, env)
  const cookieHeader = jar => [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
  const apply = (jar, response) => {
    for (const cookie of response.cookies.getAll()) {
      if (cookie.maxAge === 0) jar.delete(cookie.name)
      else jar.set(cookie.name, cookie.value)
    }
  }
  const request = (suffix, jar = new Map(), options = {}) => new NextRequest(origin + path + suffix, {
    ...options, headers: { cookie: cookieHeader(jar), ...options.headers },
  })
  async function start(next = '/hub/account', jar = new Map(), options = {}) {
    const response = await policy.startGoogleSocial(request('/start', jar, { method: 'POST',
      body: new URLSearchParams({ next }).toString(), headers: { origin,
        'content-type': 'application/x-www-form-urlencoded', ...options.headers }, ...options }))
    apply(jar, response)
    if (response.status !== 303) return { response, jar }
    const target = new URL(response.headers.get('location'))
    const callback = new URL(target.searchParams.get('redirect_to'))
    const code = randomUUID()
    codes.set(code, { challenge: target.searchParams.get('code_challenge'), used: false })
    return { response, jar, target, id: callback.searchParams.get('flow'), code }
  }
  async function complete(flow, query, jar = flow.jar) {
    const response = await policy.completeGoogleSocial(request('/callback?' + (query ??
      new URLSearchParams({ flow: flow.id, code: flow.code })), jar))
    apply(jar, response)
    return response
  }
  return { policy, calls, codes, request, start, complete, apply }
}

test('fixed release gate remains closed in the actual source', async () => {
  const release = load('./google-social-release.ts', {})
  assert.equal(release.GOOGLE_SOCIAL_RUNTIME_ENABLED, false)
  const h = harness({ enabled: release.GOOGLE_SOCIAL_RUNTIME_ENABLED })
  assert.equal((await h.start()).response.status, 404)
  assert.equal((await h.policy.completeGoogleSocial(h.request('/callback'))).status, 404)
  assert.equal(h.calls.length, 0)
})

test('recorded pilot Google identity can complete with general release closed', async () => {
  const h=harness({enabled:false,pilot:true,environment:{STOCK_SSO_PILOT_EMAIL:'synthetic@example.invalid'}})
  const flow=await h.start(),response=await h.complete(flow)
  assert.equal(response.headers.get('location'),origin+'/hub/account')
  assert.ok(flow.jar.has(key))
})
for(const email of ['', 'another@example.invalid'])
test('unrecorded Google identity cannot publish pilot session '+email, async () => {
  const h=harness({enabled:false,pilot:true,environment:{STOCK_SSO_PILOT_EMAIL:email}})
  const flow=await h.start(),response=await h.complete(flow)
  assert.equal(response.headers.get('location'),origin+'/login?message=google_failed')
  assert.equal(flow.jar.has(key),false)
})

for (const next of ['/hub/account', '/hub/systems', '/hub/workspace', '/oauth/consent?authorization_id=synthetic-request']) {
  test('native PKCE exchanges into verified normal Core session: ' + next, async () => {
    const h = harness(), flow = await h.start(next)
    assert.equal(flow.response.status, 303)
    assert.equal(flow.target.searchParams.get('provider'), 'google')
    assert.equal(flow.target.searchParams.get('scopes'), 'openid email profile')
    assert.equal(flow.target.searchParams.get('access_type'), null)
    assert.equal(flow.target.searchParams.get('code_challenge_method'), 's256')
    assert.equal(h.calls.length, 0)
    const response = await h.complete(flow)
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('location'), origin + next)
    assert.match(response.headers.get('cache-control'), /no-store/)
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
    const session = JSON.parse(ssr.stringFromBase64URL(flow.jar.get(key).slice(7)))
    assert.equal(session.user.id, subject)
    assert.equal(session.provider_token, undefined)
    assert.equal(session.provider_refresh_token, undefined)
    assert.equal([...flow.jar.keys()].some(k => k.startsWith('__Host-webzoka-google-')), false)
    assert.deepEqual(h.calls.map(c => c.method), ['POST', 'GET', 'POST'])
  })
}

for (const next of ['//evil.invalid', 'https://evil.invalid', '/\\evil.invalid', '/auth/callback',
  '/hub/update-password', '/dashboard', '/oauth/consent?authorization_id=a&authorization_id=b',
  '/oauth/consent?authorization_id=a&next=https://evil.invalid', '/hub/account\n', '/hub/account#x']) {
  test('unsafe continuation denied: ' + JSON.stringify(next), async () => {
    const h = harness()
    assert.equal((await h.start(next)).response.status, 400)
    assert.equal(h.calls.length, 0)
  })
}

for (const [label, options] of [
  ['foreign origin', { headers: { origin: 'https://evil.invalid' } }],
  ['null origin', { headers: { origin: 'null' } }],
  ['duplicate next', { body: 'next=%2Fhub%2Faccount&next=%2Fhub%2Fsystems', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' } }],
  ['unexpected selector', { body: 'tenant_id=synthetic', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' } }],
  ['oversize body', { body: 'next=' + 'a'.repeat(5000), headers: { origin, 'content-type': 'application/x-www-form-urlencoded' } }],
]) test(label + ' denied without provider calls', async () => {
  const h = harness(), flow = await h.start('/hub/account', new Map(), options)
  assert.ok([400, 403].includes(flow.response.status))
  assert.equal(h.calls.length, 0)
})

for (const environment of [ { NEXT_PUBLIC_SUPABASE_URL: 'https://mcvekinhgcqygfddyifs.supabase.co' },
  { WEBZOKA_HUB_APP_URL: 'https://evil.invalid' }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: '' } ]) {
  test('wrong configuration fails closed: ' + JSON.stringify(environment), async () => {
    const h = harness({ environment })
    assert.equal((await h.start()).response.status, 404)
    assert.equal(h.calls.length, 0)
  })
}

test('callback selector, missing verifier, cancellation and replay are denied', async () => {
  for (const invalid of ['duplicate', 'extra', 'cancel', 'verifier', 'expired', 'future', 'malformed']) {
    const h = harness(), flow = await h.start()
    let query
    if (invalid === 'duplicate') query = `flow=${flow.id}&code=${flow.code}&code=${flow.code}`
    if (invalid === 'extra') query = `flow=${flow.id}&code=${flow.code}&next=/dashboard`
    if (invalid === 'cancel') query = `flow=${flow.id}&error=access_denied&error_description=never-echo-this`
    if (invalid === 'verifier') flow.jar.delete('__Host-webzoka-google-pkce-' + flow.id)
    if (['expired', 'future', 'malformed'].includes(invalid)) {
      const name = '__Host-webzoka-google-' + flow.id
      const record = JSON.parse(Buffer.from(flow.jar.get(name), 'base64url'))
      record.createdAt = invalid === 'future' ? Date.now() + 60000 : Date.now() - 700000
      flow.jar.set(name, invalid === 'malformed' ? 'invalid' : encode(record))
    }
    const response = await h.complete(flow, query)
    assert.ok([303, 400].includes(response.status))
    assert.notEqual(response.headers.get('location'), origin + '/hub/account')
    assert.equal(flow.jar.has(key), false)
    assert.equal(h.calls.length, 0)
    assert.doesNotMatch(response.headers.get('location') ?? '', /never-echo-this/)
  }
  const h = harness(), flow = await h.start()
  const snapshot = new Map(flow.jar)
  assert.equal((await h.complete(flow)).headers.get('location'), origin + '/hub/account')
  const replay = await h.complete(flow, undefined, snapshot)
  assert.equal(replay.headers.get('location'), origin + '/login?message=google_failed')
  assert.equal(snapshot.has(key), false)
})

test('parallel tabs retain separate PKCE and bound continuation', async () => {
  const h = harness(), jar = new Map(), a = await h.start('/hub/account', jar)
  const b = await h.start('/hub/systems', jar)
  assert.notEqual(a.id, b.id)
  assert.equal((await h.complete(a)).headers.get('location'), origin + '/hub/account')
  assert.ok(jar.has('__Host-webzoka-google-' + b.id))
  assert.ok(jar.has('__Host-webzoka-google-pkce-' + b.id))
  assert.equal((await h.complete(b)).headers.get('location'), origin + '/hub/systems')
  const c = await h.start('/hub/account'), d = await h.start('/hub/systems', c.jar)
  const swapped = await h.complete(d, `flow=${d.id}&code=${c.code}`)
  assert.equal(swapped.headers.get('location'), origin + '/login?message=google_failed')
  assert.ok(c.jar.has('__Host-webzoka-google-' + c.id))
  assert.equal(c.jar.has('__Host-webzoka-google-' + d.id), false)
})

test('four pending flows bound cookie growth without deleting another tab', async () => {
  const h = harness(), jar = new Map()
  for (let i = 0; i < 4; i++) assert.equal((await h.start('/hub/account', jar)).response.status, 303)
  assert.equal((await h.start('/hub/account', jar)).response.status, 409)
})

for (const verified of [user({ email_confirmed_at: null }), user({ is_anonymous: true }),
  user({ identities: [{ provider: 'email' }] }), user({ id: '22222222-2222-4222-8222-222222222222' })]) {
  test('fresh incompatible identity cannot persist a session: ' + JSON.stringify(verified), async () => {
    const h = harness({ verified }), flow = await h.start()
    assert.equal((await h.complete(flow)).headers.get('location'), origin + '/login?message=google_failed')
    assert.equal(flow.jar.has(key), false)
  })
}

test('provider credentials removed from chunked writes and stale browser chunks', () => {
  const h = harness()
  const session = { access_token: 'synthetic', provider_token: 'a'.repeat(9000), provider_refresh_token: 'b'.repeat(9000) }
  const writes = ssr.createChunks(key, 'base64-' + ssr.stringToBase64URL(JSON.stringify(session)))
    .map(c => ({ ...c, options: { path: '/', maxAge: 3600 } }))
  const safe = h.policy.withoutGoogleCredentials(writes, [{ name: key + '.99', value: 'stale-upstream-token' }])
  assert.ok(safe.some(c => c.name === key + '.99' && c.options.maxAge === 0))
  const live = safe.filter(c => c.options.maxAge !== 0)
  assert.equal(live.length, 1)
  assert.deepEqual(JSON.parse(ssr.stringFromBase64URL(live[0].value.slice(7))), { access_token: 'synthetic' })
  assert.throws(() => h.policy.withoutGoogleCredentials([writes[0], writes[0]], []))
  assert.throws(() => h.policy.withoutGoogleCredentials(writes.slice(1), []))
})

test('existing verified password account keeps its Core subject in the callback adapter', async () => {
  const h = harness({ previous: user({ identities: [{ provider: 'email' }] }) })
  const jar = new Map([[key, 'base64-' + ssr.stringToBase64URL(JSON.stringify({
    access_token: 'synthetic-previous-access', refresh_token: 'synthetic-previous-refresh', user: user(),
  }))]])
  const flow = await h.start('/hub/account', jar)
  assert.equal((await h.complete(flow)).headers.get('location'), origin + '/hub/account')
  assert.equal(JSON.parse(ssr.stringFromBase64URL(jar.get(key).slice(7))).user.id, subject)
  assert.deepEqual(h.calls.map(c => c.method), ['POST', 'GET', 'GET', 'POST'])
  // This tests the application subject guard. It does not claim managed identity linking passed.
})

test('different existing account is preserved and only the rejected issued session is signed out', async () => {
  const h = harness({ previous: user({ id: '22222222-2222-4222-8222-222222222222' }) })
  const before = 'base64-' + ssr.stringToBase64URL(JSON.stringify({
    access_token: 'synthetic-previous-access', refresh_token: 'synthetic-previous-refresh', user: user(),
  }))
  const jar = new Map([[key, before]])
  const first = await h.start('/hub/account', jar)
  const second = await h.start('/hub/systems', jar)
  assert.equal((await h.complete(first)).headers.get('location'), origin + '/login?message=google_failed')
  assert.equal(jar.get(key), before)
  assert.ok(jar.has('__Host-webzoka-google-' + second.id))
  assert.ok(h.calls.some(c => c.url === realm + '/auth/v1/logout?scope=local'))
  assert.equal(h.calls.some(c => c.url.includes('/token?grant_type=refresh_token')), false)
})

test('identity denial revokes only the newly issued local session and never grants business access', async () => {
  const h = harness({ verified: user({ email_confirmed_at: null }) }), flow = await h.start()
  await h.complete(flow)
  assert.ok(h.calls.some(c => c.url.endsWith('/logout?scope=local')))
  assert.equal(h.calls.some(c => /rest\/v1|admin|identities|link|signup/.test(c.url)), false)
})

for (const live of [false, null, 'true', 'unavailable']) {
  test('removed/revoked/unavailable managed session denies cookie persistence: ' + JSON.stringify(live), async () => {
    const h = harness({ live }), flow = await h.start()
    assert.equal((await h.complete(flow)).headers.get('location'), origin + '/login?message=google_failed')
    assert.equal(flow.jar.has(key), false)
    assert.ok(h.calls.some(c => c.url.endsWith('/logout?scope=local')))
  })
}
