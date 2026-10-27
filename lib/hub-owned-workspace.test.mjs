import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import * as z from 'zod'
import * as jsx from 'react/jsx-runtime'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const subject = '00000000-0000-4000-8000-000000000101'
const company = '00000000-0000-4000-8000-000000000102'
const reservation = '00000000-0000-4000-8000-000000000103'
function harness(options = {}) {
  const calls = []
  const mod = { exports: {} }
  const result = options.context ?? { status: 'reserved', companyId: company, reservationId: reservation, companyName: 'Synthetic Company', isActive: false }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./hub-owned-workspace.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://core.example.test' } }, require(name) {
    if (name === 'server-only') return {}
    if (name === 'zod') return z
    if (name === '@/lib/e1-realm') return { CORE_E1_ORIGIN: 'https://core.example.test' }
    if (name === '@/lib/e1-quarantine-release') return { E1_QUARANTINE_RUNTIME_ENABLED: true }
    if (name === '@/lib/core-registry-native') return { readNativeE1StockContext: async input => { calls.push(['context', input]); return result } }
    throw new Error(name)
  } })
  const db = { from(table) {
    calls.push(['table', table])
    return {
      select() { return this }, eq(...args) { calls.push(['eq', ...args]); return this }, is() { return this },
      async limit() {
        if (options.throws) throw new Error('Unavailable')
        return table === 'company_memberships'
          ? options.memberships ?? { data: [{ company_id: company }], error: null }
          : options.instances ?? { data: [{ id: reservation, company_id: company }], error: null }
      },
    }
  } }
  return { read: () => mod.exports.readOwnedHubWorkspace(db, subject), calls }
}

test('own selectors alone never grant Owner display; authoritative E1 context must confirm', async () => {
  for (const status of ['reserved', 'quarantined']) {
    const h = harness({ context: { status, companyId: company, reservationId: reservation, companyName: 'Synthetic Company', isActive: false } })
    assert.deepEqual(JSON.parse(JSON.stringify(await h.read())), { status: 'ready', companyId: company, companyName: 'Synthetic Company', role: 'owner', stockStatus: status })
    assert.ok(h.calls.some(call => call[0] === 'eq' && call[1] === 'core_auth_user_id' && call[2] === subject))
    assert.deepEqual(JSON.parse(JSON.stringify(h.calls.at(-1))), ['context', { companyId: company, reservationId: reservation }])
  }
})

test('a new account has no workspace and makes no context request', async () => {
  const h = harness({ memberships: { data: [], error: null } })
  assert.equal((await h.read()).status, 'empty')
  assert.equal(h.calls.filter(call => call[0] === 'context').length, 0)
})

test('ambiguous, malformed, foreign, unavailable and revoked scope never displays Owner', async () => {
  for (const options of [
    { throws: true }, { memberships: { data: null, error: { status: 500 } } },
    { memberships: { data: [{ company_id: company }, { company_id: company }], error: null } },
    { memberships: { data: [{ company_id: 'invalid' }], error: null } },
    { instances: { data: [{ id: reservation, company_id: subject }], error: null } },
    { instances: { data: [], error: null } },
    ...['denied', 'blocked', 'unconfirmed'].map(status => ({ context: { status } })),
    { context: { status: 'reserved', companyId: subject, reservationId: reservation, companyName: 'Foreign', isActive: false } },
    { context: { status: 'reserved', companyId: company, reservationId: reservation, companyName: 'Company', isActive: true } },
  ]) assert.equal((await harness(options).read()).status, 'unavailable')
})

test('Hub renders verified ownership and offers creation only for confirmed empty scope', async () => {
  for (const [workspace, accessReady, canCreate] of [
    [{ status: 'ready', companyId: company, companyName: 'Synthetic Company', role: 'owner', stockStatus: 'reserved' }, true, false],
    [{ status: 'ready', companyId: company, companyName: 'Synthetic Company', role: 'owner', stockStatus: 'quarantined' }, true, false],
    [{ status: 'empty' }, true, true], [{ status: 'empty' }, false, false], [{ status: 'unavailable' }, false, false],
  ]) {
    const mod = { exports: {} }
    const defaultExport = value => ({ __esModule: true, default: value })
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/hub/account/page.tsx', import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, { module: mod, exports: mod.exports, require(name) {
      if (name === 'react/jsx-runtime') return jsx
      if (name === 'next/link') return defaultExport(props => createElement('a', props))
      if (name === 'next/image') return defaultExport(() => null)
      if (name === 'lucide-react') return new Proxy({}, { get: () => () => null })
      if (name === '@/lib/hub-account') return { getHubAccount: async () => ({ email: 'customer@example.test', name: 'Customer', workspace, accessReady }) }
      if (name === './actions') return { logoutHubAccount() {} }
      if (name === './account.module.css') return defaultExport({})
      throw new Error(name)
    } })
    const html = renderToStaticMarkup(await mod.exports.default())
    assert.equal(html.includes('Buat workspace gratis'), canCreate)
    assert.equal(html.includes('Peran Anda: Owner'), workspace.status === 'ready')
    if (workspace.status === 'ready') {
      assert.match(html, /Synthetic Company/)
      assert.match(html, /Stock belum aktif/)
      assert.doesNotMatch(html, /href="\/hub\/workspace"/)
    }
    assert.match(html, /href="\/hub\/store"/)
    assert.match(html, /href="\/hub\/faq"/)
  }
})
