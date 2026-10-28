import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

function load(path, dependencies = {}, environment = {}) {
  const testModule = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module: testModule, exports: testModule.exports, URL,
    process: { cwd: () => '/synthetic-workspace', env: { NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic', ...environment } },
    require(name) { if (name in dependencies) return dependencies[name]; throw new Error('Unexpected dependency: ' + name) },
  })
  return testModule.exports
}

const navigation = load('lib/hub-navigation.ts')

test('framework rewrites match only the dedicated host and retain released section renderers', async () => {
  const config = load('next.config.ts', { './lib/hub-navigation': navigation }).default
  const rules = (await config.rewrites()).beforeFiles
  for (const route of navigation.HUB_PUBLIC_ROUTES) {
    const rule = rules.find(candidate => candidate.source === route.publicPath)
    assert.equal(rule.destination, route.internalPath)
    const host = new RegExp('^' + rule.has[0].value + '$')
    assert.equal(host.test('hub.webzoka.com'), true)
    for (const wrong of ['hubXwebzokaYcom', 'hub.webzoka.com.evil.test', 'superadmin.webzoka.com']) assert.equal(host.test(wrong), false)
  }
  for (const route of navigation.HUB_SECTION_ROUTES) {
    const rule = rules.find(candidate => candidate.source === route.path)
    assert.equal(rule.destination, '/hub?view=' + route.view)
    assert.equal(rule.has, undefined)
  }
})

test('public aliases are exact, unique and scoped to the dedicated Hub hostname', () => {
  const { HUB_PUBLIC_ROUTES, HUB_PUBLIC_HOST, internalHubPath, publicHubPath } = navigation
  assert.equal(new Set(HUB_PUBLIC_ROUTES.map(route => route.publicPath)).size, HUB_PUBLIC_ROUTES.length)
  for (const route of HUB_PUBLIC_ROUTES) {
    assert.equal(internalHubPath(route.publicPath, HUB_PUBLIC_HOST), route.internalPath)
    for (const host of ['www.webzoka.com', 'superadmin.webzoka.com', 'preview.vercel.app', 'hub.webzoka.com.evil.test']) {
      assert.equal(internalHubPath(route.publicPath, host), route.publicPath)
      assert.equal(publicHubPath(route.internalPath, host), route.internalPath)
    }
    if (route.publicPath !== '/') assert.equal(publicHubPath(route.internalPath, HUB_PUBLIC_HOST), route.publicPath)
  }
  assert.equal(internalHubPath('/articles/example', HUB_PUBLIC_HOST), '/hub/artikel/example')
  assert.equal(internalHubPath('/articles/example/nested', HUB_PUBLIC_HOST), '/articles/example/nested')
  assert.equal(publicHubPath('/hub/artikel/example', HUB_PUBLIC_HOST), '/articles/example')
  assert.equal(internalHubPath('/dashboard', HUB_PUBLIC_HOST), '/dashboard')
  assert.equal(internalHubPath('/auth/callback', HUB_PUBLIC_HOST), '/auth/callback')
})

test('canonical links remove default account returns and view navigation without losing state', () => {
  const cases = [
    ['https://preview.vercel.app/hub/login?next=%2Fhub%2Faccount&message=password_updated', 'https://preview.vercel.app/hub/login?message=password_updated'],
    ['https://hub.webzoka.com/hub/login?next=%2Fhub%2Faccount', 'https://hub.webzoka.com/login'],
    ['https://preview.vercel.app/hub?view=systems', 'https://preview.vercel.app/hub/systems'],
    ['https://hub.webzoka.com/hub?view=billing&purchase=failed', 'https://hub.webzoka.com/billing?purchase=failed'],
    ['https://hub.webzoka.com/home?view=store', 'https://hub.webzoka.com/store'],
    ['https://hub.webzoka.com/hub/workspace?admissionId=one&commandId=two', 'https://hub.webzoka.com/workspace?admissionId=one&commandId=two'],
    ['https://hub.webzoka.com/hub/artikel/example', 'https://hub.webzoka.com/articles/example'],
  ]
  for (const [input, expected] of cases) {
    assert.equal(navigation.canonicalHubUrl(new URL(input))?.href, expected)
    assert.equal(navigation.canonicalHubUrl(new URL(expected)), null, 'canonical URL must not loop')
  }
  for (const input of [
    'https://preview.vercel.app/hub/login?next=%2Fhub%2Fworkspace%3FcommandId%3Done',
    'https://hub.webzoka.com/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Done',
    'https://hub.webzoka.com/auth/callback?flow=signup&code=synthetic',
    'https://preview.vercel.app/hub?view=unknown',
    'https://preview.vercel.app/hub?view=systems&view=billing',
    'https://preview.vercel.app/hub/login?next=%2Fhub%2Faccount&next=%2Fhub%2Fworkspace',
  ]) assert.equal(navigation.canonicalHubUrl(new URL(input)), null)
})

test('legacy browser links migrate only after exact Production configuration; protocol and Preview origins stay stable', () => {
  const enabled = { production: true, configuredOrigin: 'https://hub.webzoka.com', method: 'GET' }
  const old = 'https://ja-superadmin-platform.vercel.app/hub/workspace?commandId=one&companyId=two&reservationId=three'
  assert.equal(navigation.canonicalHubUrl(new URL(old), enabled)?.href,
    'https://hub.webzoka.com/workspace?commandId=one&companyId=two&reservationId=three')
  assert.equal(navigation.canonicalHubUrl(new URL('https://superadmin.webzoka.com/hub/login?next=%2Fhub%2Faccount'), enabled)?.href,
    'https://hub.webzoka.com/login')
  for (const change of [{ production: false }, { configuredOrigin: undefined }, { configuredOrigin: 'https://evil.test' }, { method: 'POST' }]) {
    assert.equal(navigation.canonicalHubUrl(new URL(old), { ...enabled, ...change }), null)
  }
  assert.equal(navigation.canonicalHubUrl(new URL(old.replace('ja-superadmin-platform.vercel.app', 'preview.vercel.app')), enabled), null)
  for (const path of ['/auth/callback?flow=signup&code=synthetic', '/oauth/consent?authorization_id=one', '/api/auth/e1/stock/quarantine',
    '/billing/langganan?token=synthetic', '/login', '/dashboard', '/hub/signup/private']) {
    assert.equal(navigation.canonicalHubUrl(new URL('https://ja-superadmin-platform.vercel.app' + path), enabled), null)
  }
})

function proxyHarness(claims = null, environment = {}) {
  let authCalls = 0
  const api = load('proxy.ts', {
    '@/lib/hub-navigation': navigation,
    '@/lib/superadmin': { isSuperadminEmail: () => false },
    '@supabase/ssr': { createServerClient: () => ({ auth: { getClaims: async () => { authCalls++; return { data: { claims } } } } }) },
    'next/server': { NextResponse: {
      next: () => ({ status: 200, cookies: { set() {} } }),
      redirect: (url, status = 307) => ({ status, location: url.toString() }),
      rewrite: url => ({ status: 200, rewrite: url.toString() }),
    } },
  }, environment)
  return { authCalls: () => authCalls, request: async (path, hostHeader = null, method = 'GET') => {
    const url = new URL(path)
    return api.proxy({ nextUrl: url, url: url.href, method, headers: { get: name => name === 'host' ? hostHeader : null }, cookies: { getAll: () => [], set() {} } })
  } }
}

test('actual proxy enables the legacy browser migration only in configured Production', async () => {
  const configured = { VERCEL_ENV: 'production', WEBZOKA_HUB_APP_URL: 'https://hub.webzoka.com' }
  const production = proxyHarness(null, configured)
  const target = 'https://ja-superadmin-platform.vercel.app/hub/workspace?commandId=one&companyId=two&reservationId=three'
  assert.equal((await production.request(target)).location,
    'https://hub.webzoka.com/workspace?commandId=one&companyId=two&reservationId=three')
  assert.equal(production.authCalls(), 0)
  for (const env of [{ ...configured, VERCEL_ENV: 'preview' }, { ...configured, WEBZOKA_HUB_APP_URL: undefined }]) {
    const response = await proxyHarness(null, env).request(target)
    assert.equal(new URL(response.location).hostname, 'ja-superadmin-platform.vercel.app')
    assert.equal(new URL(response.location).pathname, '/hub/login')
  }
  const deniedPost = await production.request(target, null, 'POST')
  assert.equal(new URL(deniedPost.location).hostname, 'ja-superadmin-platform.vercel.app')
  assert.equal((await production.request('https://ja-superadmin-platform.vercel.app/auth/callback?flow=signup')).status, 200)
})

test('clean Hub aliases pass through the same anonymous and authenticated guards', async () => {
  const anonymous = proxyHarness()
  for (const path of ['/login', '/signup', '/forgot-password']) assert.equal((await anonymous.request('https://hub.webzoka.com' + path)).status, 200)
  assert.equal(anonymous.authCalls(), 0)
  for (const path of ['/', '/account', '/workspace', '/systems', '/billing', '/support', '/update-password', '/onboarding/status']) {
    const response = await anonymous.request('https://hub.webzoka.com' + path)
    assert.equal(response.status, 307, path)
    assert.equal(new URL(response.location).pathname, '/login', path)
    if (['/', '/account'].includes(path)) assert.equal(new URL(response.location).search, '', 'default account return must stay clean')
    if (['/workspace', '/systems', '/billing', '/support'].includes(path)) {
      assert.equal(new URL(response.location).searchParams.get('next'), '/hub' + path)
    }
  }
  const customer = proxyHarness({ sub: 'synthetic-user', user_role: 'customer' })
  for (const path of ['/account', '/workspace', '/systems', '/billing', '/support']) assert.equal((await customer.request('https://hub.webzoka.com' + path)).status, 200)
  assert.equal(new URL((await customer.request('https://hub.webzoka.com/dashboard')).location).pathname, '/unauthorized')
  assert.equal((await anonymous.request('https://superadmin.webzoka.com/login')).status, 200)
  assert.equal(new URL((await anonymous.request('https://superadmin.webzoka.com/account')).location).pathname, '/login')
})

test('proxy and framework aliases use the same exact HTTP host behind an internal origin', async () => {
  const anonymous = proxyHarness()
  for (const host of ['hub.webzoka.com', 'HUB.WEBZOKA.COM', 'hub.webzoka.com:3084']) {
    assert.equal(navigation.hubRequestHostname('127.0.0.1', host), 'hub.webzoka.com')
    for (const path of ['/login', '/signup', '/forgot-password']) {
      assert.equal((await anonymous.request('http://127.0.0.1:3084' + path, host)).status, 200)
    }
    const denied = await anonymous.request('http://127.0.0.1:3084/account', host)
    assert.equal(denied.location, 'http://hub.webzoka.com:3084/login')
    const canonical = await anonymous.request('http://127.0.0.1:3084/hub/signup', host)
    assert.equal(canonical.location, 'http://hub.webzoka.com:3084/signup')
  }
  for (const host of ['hub.webzoka.com.evil.test', 'hubXwebzokaYcom', 'hub.webzoka.com@evil.test', 'hub.webzoka.com/extra', 'hub.webzoka.com,evil.test']) {
    assert.equal(navigation.hubRequestHostname('127.0.0.1', host), '127.0.0.1')
    assert.equal((await anonymous.request('http://127.0.0.1:3084/signup', host)).status, 307)
  }
})

test('section return paths remain a closed allowlist', () => {
  const { safeHubReturnPath } = load('lib/hub-return-path.ts')
  for (const path of ['/hub/systems', '/hub/billing', '/hub/support', '/hub/billing?purchase=failed']) assert.equal(safeHubReturnPath(path), path)
  for (const path of ['https://evil.test/hub/systems', '//evil.test/hub/systems', '/hub/systems?tenant_id=foreign', '/hub/billing?purchase=paid', '/hub/support#fragment', '/hub/systems/private', '/systems']) assert.equal(safeHubReturnPath(path), null)
})
