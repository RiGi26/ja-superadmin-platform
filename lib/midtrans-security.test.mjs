import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import * as crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const sandboxKey = 'SYNTHETIC_SANDBOX_KEY'
const productionKey = 'SYNTHETIC_PRODUCTION_KEY'
const order = 'SYNTHETIC-UAT-ORDER'
const signature = (key, status = '200', amount = '149000.00') => createHash('sha512').update(order + status + amount + key).digest('hex')

function harness({ env = { MIDTRANS_SERVER_KEY_SANDBOX: sandboxKey }, invoice = { midtrans_order_id: order, midtrans_mode: 'sandbox', amount: 149000, status: 'unpaid', tenant_id: 'SYNTHETIC-TENANT' }, databaseError = null, provider = {}, providerStatus = 200, providerError = false } = {}) {
  const calls = []
  const cache = new Map()
  const database = { from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: invoice, error: databaseError }) }; return query } }
  const payment = { markInvoicePaid: async args => { calls.push({ method: 'paid', args }); return { firstTransition: true } }, markInvoiceStatus: async args => { calls.push({ method: 'status', args }) } }
  const fetch = async (url, options) => {
    calls.push({ method: 'provider', url: String(url), options })
    if (providerError) throw new Error('SYNTHETIC_PROVIDER_OUTAGE')
    return new Response(JSON.stringify({ order_id: order, gross_amount: '149000.00', currency: 'IDR', status_code: '200', transaction_status: 'settlement', ...provider }), { status: providerStatus })
  }
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative)
    const fixtureModule = { exports: {} }
    const source = readFileSync(new URL(relative, import.meta.url), 'utf8')
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const require = name => {
      if (name === 'crypto' || name === 'node:crypto') return crypto
      if (name === 'server-only') return {}
      if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) }, after: callback => callback() }
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => database }
      if (name === '@/lib/midtrans') return load('./midtrans.ts')
      if (name === '@/lib/midtrans-payment') return load('./midtrans-payment.ts')
      if (name === '@/lib/billing') return payment
      if (name === '@/lib/verified-subscription-payment') return { markVerifiedInvoicePaid: payment.markInvoicePaid }
      if (name === '@/lib/lms-sync') return { syncTenantPortal: async (tenantId, reason) => calls.push({ method: 'sync', tenantId, reason }) }
      if (name === '@/lib/rate-limit') return { rateLimit: () => ({ allowed: true }), tooManyRequests: () => Response.json({}, { status: 429 }) }
      throw new Error('Unexpected import: ' + name)
    }
    vm.runInNewContext(compiled, { module: fixtureModule, exports: fixtureModule.exports, require,
      process: { env }, fetch, Response, Request, Buffer, URL, AbortSignal,
      console: { warn() {}, error() {}, log() {} } }, { filename: relative })
    cache.set(relative, fixtureModule.exports)
    return fixtureModule.exports
  }
  return { calls, load }
}

test('an invoice cannot verify with another environment key when its own key is absent', () => {
  const h = harness({ env: { MIDTRANS_SERVER_KEY_SANDBOX: sandboxKey } })
  assert.equal(h.load('./midtrans.ts').verifyMidtransSignature({ orderId: order, statusCode: '200', grossAmount: '149000.00', signatureKey: signature(sandboxKey), mode: 'production' }), false)
})

test('configured invoice keys stay isolated across both environments', () => {
  const h = harness({ env: { MIDTRANS_SERVER_KEY_SANDBOX: sandboxKey, MIDTRANS_SERVER_KEY_PRODUCTION: productionKey } })
  const api = h.load('./midtrans.ts')
  for (const [mode, own, other] of [['sandbox', sandboxKey, productionKey], ['production', productionKey, sandboxKey]]) {
    assert.equal(api.verifyMidtransSignature({ orderId: order, statusCode: '200', grossAmount: '149000.00', signatureKey: signature(own), mode }), true)
    assert.equal(api.verifyMidtransSignature({ orderId: order, statusCode: '200', grossAmount: '149000.00', signatureKey: signature(other), mode }), false)
  }
})

async function notify(h, body = {}) {
  return h.load('../app/api/billing/webhook/route.ts').POST(new Request('https://core.example.invalid/api/billing/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: order, status_code: '200', gross_amount: '149000.00', signature_key: signature(sandboxKey), transaction_status: 'settlement', ...body }),
  }))
}

test('a changed notification status cannot activate a pending provider transaction', async () => {
  const h = harness({ provider: { status_code: '201', transaction_status: 'pending' } })
  await notify(h, { status_code: '201', signature_key: signature(sandboxKey, '201'), transaction_status: 'settlement' })
  assert.equal(h.calls.filter(c => c.method === 'paid').length, 0)
})

for (const [name, provider, providerStatus] of [
  ['foreign provider order', { order_id: 'OTHER-ORDER' }, 200],
  ['different provider amount', { gross_amount: '359000.00' }, 200],
  ['foreign currency', { currency: 'USD' }, 200],
  ['provider error response', { status_code: '401' }, 401],
]) test(name + ' cannot mark an invoice paid', async () => {
  const h = harness({ provider, providerStatus })
  await notify(h)
  assert.equal(h.calls.filter(c => c.method === 'paid').length, 0)
})

test('unknown invoice notification causes no payment or provider operation', async () => {
  const h = harness({ invoice: null })
  await notify(h)
  assert.equal(h.calls.length, 0)
})

test('transient verification failure requests a provider retry without payment mutation', async () => {
  const h = harness({ providerError: true })
  const response = await notify(h)
  assert.equal(response.status, 503)
  assert.equal(h.calls.filter(c => c.method === 'paid').length, 0)
})

test('a verified matching payment uses the invoice environment after the global switch', async () => {
  const h = harness({ env: { MIDTRANS_SERVER_KEY_SANDBOX: sandboxKey, MIDTRANS_SERVER_KEY_PRODUCTION: productionKey, NEXT_PUBLIC_MIDTRANS_ENV: 'production' } })
  const response = await notify(h)
  assert.equal(response.status, 200)
  assert.equal(h.calls.filter(c => c.method === 'paid').length, 1)
  assert.equal(h.calls.find(c => c.method === 'provider')?.url, 'https://api.sandbox.midtrans.com/v2/' + order + '/status')
})

const invoiceId = '11111111-1111-4111-8111-111111111111'
const confirm = (h, id = invoiceId) => h.load('../app/api/billing/confirm/route.ts').POST(new Request('https://core.example.invalid/api/billing/confirm', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_id: id }),
}))
test('finish-page polling commits only a matching native paid status', async () => {
  const h = harness()
  const response = await confirm(h)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).confirmed, true)
  assert.equal(h.calls.filter(call => call.method === 'paid').length, 1)
})
test('finish-page polling refuses malformed identifiers before provider or payment work', async () => {
  for (const id of [null, {}, [], 'foreign']) {
    const h = harness()
    assert.equal((await confirm(h, id)).status, 400)
    assert.equal(h.calls.length, 0)
  }
})
test('finish-page polling fails closed on database or provider failure', async () => {
  for (const options of [{ databaseError: { message: 'Unavailable' } }, { providerError: true }, { provider: { gross_amount: '1.00' } }]) {
    const h = harness(options)
    assert.equal((await confirm(h)).status, 503)
    assert.equal(h.calls.filter(call => call.method === 'paid').length, 0)
  }
})
test('an already committed finish-page retry repairs sync without another settlement', async () => {
  const h = harness({ invoice: { status: 'paid', midtrans_order_id: order, tenant_id: 'SYNTHETIC-TENANT' } })
  assert.equal((await confirm(h)).status, 200)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].method, 'sync')
})
test('a challenged capture never grants paid access', async () => {
  const h = harness({ provider: { transaction_status: 'capture', fraud_status: 'challenge' } })
  await notify(h)
  assert.equal(h.calls.filter(call => call.method === 'paid').length, 0)
})
