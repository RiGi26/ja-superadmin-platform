import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(result) {
  const calls = [], queued = []
  const fixture = { exports: {} }
  const require = name => {
    if (name === 'server-only') return {}
    if (name === 'next/server') return { after: fn => queued.push(fn) }
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => ({
      rpc: async (name, args) => { calls.push({ name, args }); return result },
      from: () => { throw new Error('Non-atomic payment write is forbidden') },
    }) }
    if (name === '@/lib/lms-sync') return { syncTenantPortal: async (...args) => calls.push({ sync: args }) }
    if (name === '@/lib/billing-email') return { sendSubscriptionPaidEmail: async id => calls.push({ email: id }) }
    throw new Error('Unexpected import: ' + name)
  }
  const source = readFileSync(new URL('./verified-subscription-payment.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { module: fixture, exports: fixture.exports, require })
  return { apply: fixture.exports.markVerifiedInvoicePaid, calls, queued }
}
const args = { midtransOrderId: 'SYNTHETIC-ORDER', mode: 'sandbox', amount: 149000, raw: { order_id: 'SYNTHETIC-ORDER' } }

test('payment persistence is one RPC before any portal or receipt delivery', async () => {
  const h = load({ data: { firstTransition: true, tenantId: 'SYNTHETIC-TENANT', invoiceId: 'SYNTHETIC-INVOICE' }, error: null })
  await h.apply(args)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].name, 'apply_verified_subscription_payment')
  assert.equal(h.calls[0].args.p_mode, 'sandbox')
  assert.equal(h.calls[0].args.p_amount, 149000)
  assert.equal(h.queued.length, 2)
  for (const run of h.queued) await run()
  assert.equal(h.calls.filter(call => call.sync).length, 1)
  assert.equal(h.calls.filter(call => call.email).length, 1)
})

test('verified duplicate repairs portal sync without another receipt', async () => {
  const h = load({ data: { firstTransition: false, tenantId: 'SYNTHETIC-TENANT', invoiceId: 'SYNTHETIC-INVOICE' }, error: null })
  await h.apply(args)
  assert.equal(h.queued.length, 1)
  await h.queued[0]()
  assert.equal(h.calls.filter(call => call.sync).length, 1)
  assert.equal(h.calls.filter(call => call.email).length, 0)
})

for (const result of [
  { data: null, error: { message: 'SYNTHETIC_TRANSACTION_ABORT' } },
  { data: null, error: null },
  { data: { firstTransition: true }, error: null },
]) test('an unsuccessful commit never queues side effects or falls back to direct writes: ' + JSON.stringify(result), async () => {
  const h = load(result)
  await assert.rejects(h.apply(args), /PAYMENT_COMMIT_UNAVAILABLE/)
  assert.equal(h.calls.length, 1)
  assert.equal(h.queued.length, 0)
})
