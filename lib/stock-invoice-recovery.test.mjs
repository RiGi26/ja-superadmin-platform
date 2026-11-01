import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadStockModule } from './stock-self-payment-unit-harness.mjs'

const id = n => `60000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const own = { id: id(1), planId: id(2), amount: 149000 }
const workspace = { companyId: id(3), coreTenantId: id(4), invoices: [own] }
function harness(options = {}) {
  const calls = []; let reads = 0
  const account = { status: 'ready', workspaces: [workspace] }
  const stored = { id: own.id, tenant_id: workspace.coreTenantId, plan_id: own.planId, amount: own.amount,
    period: 'monthly', status: 'awaiting_payment', midtrans_order_id: 'SYNTHETIC_ISSUED_ORDER', midtrans_mode: 'sandbox', ...options.invoice }
  const query = { select() { return this }, eq() { return this }, async maybeSingle() { return { data: stored, error: null } } }
  const api = loadStockModule('./stock-invoice-recovery.ts', {
    '@/lib/stock-purchase-policy': { STOCK_PAID_BILLING_RUNTIME_ENABLED: options.enabled !== false },
    '@/lib/stock-self-payment': { readStockBillingAccount: async () => { calls.push('own'); return options.accounts?.[reads++] ?? account } },
    '@/lib/supabase/admin': { createAdminClient: () => { calls.push('admin'); return { from: () => query } } },
    '@/lib/midtrans-payment': { readVerifiedMidtransPayment: async () => { calls.push('verify'); if (options.unknown) throw Error('Provider unavailable'); return options.verified ?? { paid: false, failed: false } } },
    '@/lib/verified-subscription-payment': { markVerifiedInvoicePaid: async input => { calls.push(['commit', input]) } },
    '@/lib/billing': { markInvoiceStatus: async input => { calls.push(['terminal', input]) } },
    '@/lib/stock-paid-activation': { deliverStockPaidActivation: async tenant => { calls.push(['repair', tenant]) } },
    'next/server': { after: work => work() },
    '@/lib/rate-limit': { rateLimit: () => ({ allowed: options.limited !== true }) },
  })
  return { calls, refresh: value => api.refreshStockInvoice(value ?? own.id) }
}
test('only a current Owner can reconcile an exactly matching issued monthly invoice', async () => {
  for (const options of [
    { enabled: false }, { limited: true }, { accounts: [{ status: 'unavailable' }] }, { accounts: [{ status: 'ready', workspaces: [] }] },
    { accounts: [undefined, { status: 'ready', workspaces: [] }] },
    ...[{ amount: 1 }, { tenant_id: id(9) }, { plan_id: id(9) }, { period: 'yearly' }, { midtrans_mode: null }].map(invoice => ({ invoice })),
  ]) {
    const h = harness(options); await h.refresh()
    assert.ok(!h.calls.includes('verify'))
    assert.ok(!h.calls.some(row => Array.isArray(row)))
  }
  const foreign = harness(); await foreign.refresh(id(99)); assert.deepEqual(foreign.calls, ['own'])
})
test('lost responses remain pending; verified cancellations and expiry release only that issued invoice', async () => {
  for (const options of [{ unknown: true }, { verified: { paid: false, failed: false, pending: true } }]) {
    const h = harness(options); await h.refresh(); assert.ok(!h.calls.some(row => Array.isArray(row)))
  }
  for (const status of ['cancel', 'deny', 'expire']) {
    const h = harness({ verified: { paid: false, failed: true, status, paymentType: 'bank_transfer', data: { verified: true } } })
    await h.refresh()
    const mutation = h.calls.find(row => Array.isArray(row))
    assert.equal(mutation[0], 'terminal'); assert.equal(mutation[1].status, status === 'expire' ? 'expired' : 'failed')
    assert.equal(mutation[1].midtransOrderId, 'SYNTHETIC_ISSUED_ORDER')
  }
})
test('verified payment reuses the atomic engine; a paid retry only repairs activation', async () => {
  const verified = { paid: true, mode: 'sandbox', amount: 149000, data: { verified: true } }
  const h = harness({ verified }); await h.refresh()
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.find(row => Array.isArray(row)))), ['commit', { midtransOrderId: 'SYNTHETIC_ISSUED_ORDER', mode: 'sandbox', amount: 149000, raw: verified.data }])
  const paid = harness({ invoice: { status: 'paid' } }); await paid.refresh()
  assert.ok(!paid.calls.includes('verify'))
  assert.deepEqual(paid.calls.find(row => Array.isArray(row)), ['repair', workspace.coreTenantId])
})
