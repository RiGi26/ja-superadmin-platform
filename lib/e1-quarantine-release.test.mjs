import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import * as crypto from 'node:crypto'
import * as zod from 'zod'
import ts from 'typescript'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const origin = 'https://hxhusfkrlafxdnyasmsu.supabase.co'
const command = '11111111-1111-4111-8111-111111111111'
function harness({ enabled = true, realm = origin } = {}) {
  const calls = []
  function load(file) {
    const mod = { exports: {} }
    const text = file === 'e1-quarantine-release.ts' && !enabled
      ? read(file).replace('E1_QUARANTINE_RUNTIME_ENABLED = true', 'E1_QUARANTINE_RUNTIME_ENABLED = false') : read(file)
    vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { module: mod, exports: mod.exports, Buffer, process: { env: { NEXT_PUBLIC_SUPABASE_URL: realm, E1_QUARANTINE_RUNTIME_ENABLED: 'true' } }, require(name) {
        if (name === 'server-only') return {}
        if (name === 'zod') return zod
        if (name === 'node:crypto') return crypto
        if (name === '@/lib/e1-realm') return load('e1-realm.ts')
        if (name === '@/lib/e1-workspace') return load('e1-workspace.ts')
        if (name === '@/lib/core-registry-native') return { executeNativeE1StockCommand: async input => {
          calls.push(JSON.parse(JSON.stringify(input))); return { status: 'completed' }
        } }
        if (name === '@/lib/supabase/server' || name === '@/lib/superadmin') return {}
        throw new Error(name)
      } })
    return mod.exports
  }
  return { api: load('e1-quarantine-release.ts'), calls }
}

test('released bootstrap normalizes the canonical request and delegates only native Stock admission', async () => {
  const h = harness()
  assert.equal((await h.api.requestE1QuarantineBootstrap({ companyName: '  Cafe\u0301  ', idempotencyKey: command })).status, 'completed')
  assert.deepEqual(h.calls, [{ action: 'e1.stock.admit', commandId: command, payload: { companyName: 'Café', product: 'stock' } }])
})

test('closed release or foreign realm cannot call native admission even with an environment activation value', async () => {
  for (const options of [{ enabled: false }, { realm: 'https://foreign.supabase.co' }]) {
    const h = harness(options)
    assert.equal((await h.api.requestE1QuarantineBootstrap({ companyName: 'Business', idempotencyKey: command })).status, 'blocked')
    assert.deepEqual(h.calls, [])
  }
})

test('release facade rejects authority injection and special UUIDs before native calls', async () => {
  for (const input of [
    { companyName: 'Business', idempotencyKey: command, coreSubject: command },
    { companyName: 'Business', idempotencyKey: '00000000-0000-0000-0000-000000000000' },
    { companyName: 'Business', idempotencyKey: command, product: 'clinic' },
  ]) {
    const h = harness()
    assert.equal((await h.api.requestE1QuarantineBootstrap(input)).status, 'rejected')
    assert.deepEqual(h.calls, [])
  }
})

test('quarantine release leaves legacy Company and generic Registry paths closed before any client', async () => {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read('core-registry-native.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_SUPABASE_URL: origin } }, require(name) {
      if (name === 'server-only') return {}
      if (name === 'zod') return zod
      if (name === 'node:crypto') return crypto
      if (name === '@/lib/e1-realm') return { CORE_E1_ORIGIN: origin, STOCK_E1_ORIGIN: 'https://oyyfcmlquqfrdoffkgsd.supabase.co' }
      if (name === '@/lib/core-company') return { CORE_COMPANY_RUNTIME_ENABLED: false }
      if (name === '@/lib/e1-quarantine-release') return { E1_QUARANTINE_RUNTIME_ENABLED: true }
      return new Proxy({}, { get() { throw new Error('Legacy release reached a client or writer') } })
    } })
  assert.equal((await mod.exports.authorizeNativeCompany({ companyId: command, ownerOnly: true })).status, 'blocked')
  assert.equal((await mod.exports.executeNativeCompanyCommand({ action: 'company.bootstrap', commandId: command,
    payload: { companyName: 'Business', portalType: 'stock' } })).status, 'blocked')
  assert.match(read('core-company.ts'), /CORE_COMPANY_RUNTIME_ENABLED = false as const/)
  assert.match(read('e1-stock-integration.ts'), /E1_STOCK_RUNTIME_ENABLED = false as const/)
})
