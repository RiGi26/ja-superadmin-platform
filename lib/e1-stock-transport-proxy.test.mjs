// Offline routing evidence only; NextResponse and cookie Auth are modeled.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
const endpoint = '/api/auth/e1/stock/quarantine'
function harness() {
  const calls = [], mod = { exports: {} }
  const navigation = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./hub-navigation.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: navigation, exports: navigation.exports, URL })
  const source = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { module: mod, exports: mod.exports, URL, process: { env: {
    NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://mcvekinhgcqygfddyifs.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-key',
  } }, require(name) {
    if (name === 'next/server') return { NextResponse: {
      next: () => ({ kind: 'next', cookies: { set() {} } }),
      redirect: url => ({ kind: 'redirect', url: String(url) }),
      rewrite: url => ({ kind: 'rewrite', url: String(url) }),
    } }
    if (name === '@/lib/superadmin') return { isSuperadminEmail: () => false }
    if (name === '@/lib/hub-navigation') return navigation.exports
    if (name === '@supabase/ssr') return { createServerClient() {
      calls.push('cookie-client')
      return { auth: { getClaims: async () => { calls.push('cookie-claims'); return { data: { claims: null } } } } }
    } }
    throw new Error('Unexpected dependency ' + name)
  } })
  return { calls, run: async path => {
    const url = new URL(path, 'https://core-dev-preview.vercel.app')
    return mod.exports.proxy({ url: String(url), nextUrl: url, cookies: { getAll: () => [], set() {} } })
  } }
}
test('native handoff reaches its own bearer-only handler without dashboard cookie Auth', async () => {
  const h = harness(), response = await h.run(endpoint)
  assert.equal(response.kind, 'next'); assert.deepEqual(h.calls, [])
})
test('private dashboard and billing mutations retain existing cookie guards', async () => {
  for (const path of ['/dashboard', '/api/billing/checkout', '/api/billing/lifecycle',
    '/api/internal/e1/stock/other', '/api/internal/e1/stock/quarantine', '/api/internal/e1/stock/quarantine/extra']) {
    const h = harness(), response = await h.run(path)
    assert.equal(response.kind, 'redirect'); assert.equal(response.url, 'https://core-dev-preview.vercel.app/login')
    assert.deepEqual(h.calls, ['cookie-client', 'cookie-claims'])
  }
})
test('existing auth namespace already delegates authentication to its own handlers', async () => {
  const h = harness(), response = await h.run('/api/auth/existing-native-handler')
  assert.equal(response.kind, 'next'); assert.deepEqual(h.calls, [])
})

