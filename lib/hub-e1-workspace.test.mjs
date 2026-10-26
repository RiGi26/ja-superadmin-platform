// Local source-composition and rendered UI checks, with synthetic DAL results.
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import * as crypto from 'node:crypto'
import ts from 'typescript'
import * as zod from 'zod'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

const root = new URL('../', import.meta.url)
const read = p => readFileSync(new URL(p, root), 'utf8')
const id = n => String(n).padStart(8, '0') + '-1111-4111-8111-111111111111'
const keys = { admissionId: id(1), commandId: id(2) }
const selected = { commandId: id(2), companyId: id(3), reservationId: id(4) }
const plain = value => JSON.parse(JSON.stringify(value))
function load(path, require, globals = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
  { module: mod, exports: mod.exports, URL, URLSearchParams, ...globals, require })
  return mod.exports
}
const sharedWorkspace = load('lib/e1-workspace.ts', name => {
  if (name === 'server-only') return {}
  if (name === 'zod') return zod
  if (name === 'node:crypto') return crypto
  if (name === '@/lib/supabase/server') return { createClient() { throw new Error('No historical gateway call') } }
  if (name === '@/lib/superadmin') return { isSuperadminEmail() { throw new Error('No historical gateway call') } }
  throw new Error(name)
}, { Buffer })
function harness(result = { status: 'blocked' }, observation = { status: 'blocked' }) {
  const calls = []
  const api = load('lib/hub-e1-workspace.ts', name => {
    if (name === 'server-only') return {}
    if (name === 'zod') return zod
    if (name === '@/lib/e1-workspace') return sharedWorkspace
    if (name === '@/lib/e1-quarantine-release') return { requestE1QuarantineBootstrap: async input => {
      calls.push(['admit', plain(input)]); if (result instanceof Error) throw result; return result
    } }
    if (name === '@/lib/core-registry-native') return { readNativeE1StockContext: async input => {
      calls.push(['read', plain(input)]); return observation
    } }
    throw new Error(name)
  }, { FormData })
  const actions = load('app/hub/workspace/actions.ts', name => {
    assert.equal(name, '@/lib/hub-e1-workspace'); return api
  })
  return { api, actions, calls }
}
const form = name => { const value = new FormData(); value.set('companyName', name); return value }
test('malformed direct Server Action form arguments reject before admission', async () => {
  for (const data of [null, [], {}, 'not a form', { keys: 1 }]) {
    const h = harness()
    assert.deepEqual(plain(await h.actions.createHubWorkspace(keys, { status: 'quarantined', selected }, data)), { status: 'invalid' })
    assert.equal(h.calls.length, 0)
  }
})
test('forged previous action state cannot establish a workspace or override fresh denial', async () => {
  const h = harness({ status: 'denied' })
  const forged = { status: 'quarantined', companyName: 'Forged Company', selected: { ...selected, companyId: id(99) } }
  const result = await h.actions.createHubWorkspace(keys, forged, form('Business'))
  assert.deepEqual(plain(result), { status: 'denied', companyName: 'Business' })
  assert.deepEqual(h.calls, [['admit', { companyName: 'Business', idempotencyKey: keys.admissionId }]])
})
test('binding keys and result selectors follow the same RFC UUID contract as native SSO', async () => {
  for (const commandId of ['00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff']) {
    const h = harness()
    assert.equal((await h.api.submitHubE1Workspace({ ...keys, commandId }, form('Business'))).status, 'invalid')
    assert.equal((await h.api.readHubE1Workspace({ ...selected, commandId })).status, 'invalid')
    assert.equal(h.calls.length, 0)
  }
})
test('valid uppercase selectors normalize once and retain distinct native command identities', async () => {
  const upper = { admissionId: 'ABCDEFAB-1111-4111-8111-111111111111', commandId: 'FEDCBAFE-1111-4111-8111-111111111111' }
  const h = harness({ status: 'completed', reservation: selected })
  const result = await h.actions.createHubWorkspace(upper, { status: 'new' }, form('Business'))
  assert.equal(result.status, 'reserved'); assert.equal(result.selected.commandId, upper.commandId.toLowerCase())
  assert.deepEqual(h.calls, [['admit', { companyName: 'Business', idempotencyKey: upper.admissionId.toLowerCase() }]])
})
test('admission retains distinct keys, normalized name and returned selectors; no client authority is forwarded', async () => {
  const h = harness({ status: 'completed', reservation: selected })
  const value = await h.api.submitHubE1Workspace(keys, form('  My Business  '))
  assert.deepEqual(plain(value), { status: 'reserved', companyName: 'My Business', selected })
  assert.deepEqual(h.calls, [['admit', { companyName: 'My Business', idempotencyKey: keys.admissionId }]])
  assert.equal(h.api.hubE1ReturnPath(selected), '/hub/workspace?' + new URLSearchParams(selected))
})
for (const result of [{ status: 'unconfirmed' }, new Error('Sensitive lost response')]) {
  test('uncertain admission retries use the same admission key and name', async () => {
    const h = harness(result)
    for (let i = 0; i < 2; i++) assert.deepEqual(plain(await h.api.submitHubE1Workspace(keys, form('Business'))),
      { status: 'unconfirmed', companyName: 'Business' })
    assert.deepEqual(h.calls[0], h.calls[1])
  })
}
test('invalid/duplicate/authority fields and shared command IDs fail before admission', async () => {
  for (const mutate of [f => f.append('companyName', 'Other'), f => f.append('companyId', id(9)),
    f => f.append('isActive', 'true'), f => f.set('companyName', 'A')]) {
    const h = harness(); const data = form('Business'); mutate(data)
    assert.equal((await h.api.submitHubE1Workspace(keys, data)).status, 'invalid'); assert.equal(h.calls.length, 0)
  }
  const h = harness()
  for (const bad of [{ ...keys, commandId: keys.admissionId.toUpperCase() }, { ...keys, actor: id(7) }, null]) {
    assert.equal((await h.api.submitHubE1Workspace(bad, form('Business'))).status, 'invalid')
  }
  assert.equal(h.calls.length, 0)
})
test('query success/activation/status cannot authorize a Hub result; only fresh DAL read does', async () => {
  const h = harness(undefined, { status: 'quarantined', companyName: 'Business', isActive: false })
  for (const extra of ['status', 'isActive', 'outcome', 'subject', 'admissionId']) {
    assert.equal((await h.api.readHubE1Workspace({ ...selected, [extra]: 'quarantined' })).status, 'invalid')
  }
  assert.equal(h.calls.length, 0)
  assert.deepEqual(plain(await h.api.readHubE1Workspace(selected)), { status: 'quarantined', selected, companyName: 'Business' })
  assert.deepEqual(h.calls, [['read', { companyId: selected.companyId, reservationId: selected.reservationId }]])
})
const returnApi = load('lib/hub-return-path.ts', name => { throw new Error(name) })
test('reauth accepts only the fixed workspace route and exact UUID selector sets', () => {
  for (const params of [keys, selected]) {
    const path = '/hub/workspace?' + new URLSearchParams(params)
    assert.equal(returnApi.safeHubReturnPath(path), path)
    for (const suffix of ['&status=quarantined', '&commandId=' + id(8), '#foreign']) assert.equal(returnApi.safeHubReturnPath(path + suffix), null)
  }
  for (const path of ['//foreign/hub/workspace', 'https://foreign/hub/workspace', '/hub/workspace/other',
    '/hub/workspace?admissionId=' + id(1) + '&commandId=' + id(1)]) assert.equal(returnApi.safeHubReturnPath(path), null)
})

function render(initial, enabled = false, pending = false) {
  const view = load('app/hub/workspace/WorkspaceView.tsx', name => {
    if (name === 'react') return { useActionState: (_action, state) => [state, () => {}, pending], useEffect: () => {} }
    if (name === 'react/jsx-runtime') return jsx
    if (name === './actions') return { createHubWorkspace: () => {} }
    if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) }
    throw new Error(name)
  })
  return renderToStaticMarkup(jsx.jsx(view.WorkspaceView, { initial, keys: initial.selected ? null : keys, enabled,
    stockStart: 'https://webzoka-stock-platform.vercel.app/api/auth/e1/start', returnPath: '/hub/workspace?' + new URLSearchParams(keys) }))
}
for (const status of ['new', 'invalid', 'reserved', 'quarantined', 'unconfirmed', 'denied', 'blocked']) {
  test(`render ${status}: honest inactive copy and accessible form/status`, () => {
    const html = render({ status, ...(['reserved', 'quarantined'].includes(status) ? { selected, companyName: 'Business <script>bad</script>' } : {}) }, status !== 'blocked')
    assert.match(html, /Stock belum aktif/); assert.match(html, /role="status"/)
    assert.match(html, /Tidak memulai trial/); assert.ok(!html.includes('<script>bad</script>'))
    if (status === 'blocked') assert.match(html, /<button[^>]+disabled/)
    if (status === 'reserved') {
      assert.match(html, /method="post"/); assert.match(html, /name="commandId" value="00000002/)
      assert.ok(!html.includes('name="admissionId"'))
    }
    if (status === 'quarantined') assert.ok(!html.includes('method="post"'))
  })
}
test('pending disables admission; uncertain admission preserves name and retry IDs', () => {
  assert.match(render({ status: 'new' }, true, true), /Memeriksa permintaan/)
  const html = render({ status: 'unconfirmed', companyName: 'Business' }, true)
  assert.match(html, /readOnly=""/); assert.match(html, /Periksa permintaan yang sama/)
})
test('dedicated caller avoids legacy tenant and financial adapters; all write authority stays in the DAL', () => {
  for (const p of ['app/hub/workspace/page.tsx', 'app/hub/workspace/actions.ts', 'lib/hub-e1-workspace.ts']) {
    assert.doesNotMatch(read(p), /hub-data|hub-billing|billing-link|createAdminClient|\.from\(|\.rpc\(/)
  }
  assert.match(read('app/hub/workspace/page.tsx'), /hubE1Selectors.safeParse\(query\)/)
  assert.match(read('app/hub/workspace/WorkspaceView.tsx'), /history.replaceState/)
})

test('cross-origin native form preserves Origin without disclosing workspace path or selectors', () => {
  assert.match(read('app/hub/workspace/page.tsx'), /referrer: 'strict-origin'/)
})

// Optional task-owned static rendering for visual inspection. No app Auth,
// providers, enabled runtime or networked form submissions are involved.
if (process.env.E1_VISUAL_DIR) {
  mkdirSync(process.env.E1_VISUAL_DIR, { recursive: true })
  const css = read('app/hub/workspace/workspace.module.css')
  for (const status of ['new', 'invalid', 'reserved', 'quarantined', 'unconfirmed', 'denied', 'blocked']) {
    const html = render({ status, ...(['reserved', 'quarantined'].includes(status) ? { selected, companyName: 'Usaha Contoh Nusantara' } : {}) }, status !== 'blocked')
    writeFileSync(`${process.env.E1_VISUAL_DIR}/${status}.html`, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local synthetic ${status}</title><style>body{margin:0}*{box-sizing:border-box}${css}</style></head><body>${html}</body></html>`)
  }
}
