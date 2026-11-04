// Offline proxy regression. Hosted HTTP retests are recorded separately.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function harness() {
  const calls = [], module = { exports: {} }
  const navigation = { exports: {} }
  const transpile = source => ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText
  vm.runInNewContext(transpile(readFileSync(new URL('./hub-navigation.ts', import.meta.url), 'utf8')),
    { module: navigation, exports: navigation.exports, URL })
  vm.runInNewContext(transpile(readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')), {
    module, exports: module.exports, URL, process: { env: { NODE_ENV: 'production' } },
    require(name) {
      if (name === 'next/server') return { NextResponse: {
        next: () => ({ kind: 'next', cookies: { set() {} } }),
        redirect: url => ({ kind: 'redirect', url: String(url) }),
      } }
      if (name === '@/lib/superadmin') return { isSuperadminEmail: () => false }
      if (name === '@/lib/hub-navigation') return navigation.exports
      if (name === '@supabase/ssr') return { createServerClient() {
        calls.push('cookie-client')
        return { auth: { getClaims: async () => ({ data: { claims: null } }) } }
      } }
      throw new Error('Unexpected dependency ' + name)
    },
  })
  return { calls, run(path, method = 'POST') {
    const url = new URL(path, 'https://hub.webzoka.com')
    return module.exports.proxy({ url: String(url), nextUrl: url, method,
      cookies: { getAll: () => [], set() {} } })
  } }
}

for (const path of ['/api/stock/active/authorize', '/api/stock/active/enroll']) {
  test('bearer bridge reaches its own authorization handler: ' + path, async () => {
    for (const method of ['POST', 'HEAD']) {
      const h = harness(), response = await h.run(path, method)
      assert.equal(response.kind, 'next')
      assert.deepEqual(h.calls, [])
    }
  })
}
test('adjacent Stock routes and private dashboard retain cookie authorization', async () => {
  for (const path of ['/api/stock/active/authorize/extra', '/api/stock/active/enroll/',
    '/api/stock/active', '/api/stock/active/unapproved', '/dashboard', '/api/billing/checkout']) {
    const h = harness(), response = await h.run(path)
    assert.equal(response.kind, 'redirect', path)
    assert.equal(response.url, 'https://hub.webzoka.com/login')
    assert.deepEqual(h.calls, ['cookie-client'])
  }
})

test('exact v2 membership endpoints on the pinned Hub host reach the bearer handlers', async () => {
  for (const [action, method] of [['authorize', 'HEAD'], ['authorize', 'POST'],
    ['prepare', 'POST'], ['confirm', 'POST'], ['select', 'POST'], ['claim', 'POST'], ['commit', 'POST']]) {
    const h = harness()
    assert.equal((await h.run('/api/stock/membership/' + action, method)).kind, 'next', action)
    assert.deepEqual(h.calls, [])
  }
  for (const path of ['/api/stock/membership', '/api/stock/membership/claim/extra',
    'https://ja-superadmin-platform.vercel.app/api/stock/membership/claim']) {
    const h = harness()
    assert.equal((await h.run(path)).kind, 'redirect')
    assert.deepEqual(h.calls, ['cookie-client'])
  }
})
