import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadStockModule } from './stock-self-payment-unit-harness.mjs'

function polling(check) {
  let now = 0, next, activated = 0
  const calls = []
  const api = loadStockModule('../app/hub/_components/StockActivationStatus.tsx', {
    react: {}, 'react/jsx-runtime': {}, '../checkout/stock/actions': {},
  }, {
    Date: { now: () => now },
    setTimeout(fn, delay) { next = { fn, at: now + delay }; return 1 },
    clearTimeout() { next = undefined },
  })
  const stop = api.pollStockActivation(async () => { calls.push(now); return check?.(calls.length, value => { now = value }) ?? 'pending' }, () => activated++)
  return { calls, stop, get activated() { return activated }, async tick() {
    const timer = next; next = undefined
    if (!timer) return false
    now = timer.at; await timer.fn(); return true
  } }
}

test('pending activation backs off for five minutes then leaves no automatic request', async () => {
  const h = polling()
  while (await h.tick()) { assert.ok(h.calls.length <= 11) }
  assert.deepEqual(h.calls, [5000, 15000, 35000, 65000, 95000, 125000, 155000, 185000, 215000, 245000, 275000])
  assert.equal(h.activated, 0)
})

test('activation, lost authority, unmount and slow responses cannot extend polling', async () => {
  for (const state of ['active', 'unavailable']) {
    const h = polling(() => state); await h.tick()
    assert.equal(await h.tick(), false); assert.equal(h.calls.length, 1)
    assert.equal(h.activated, state === 'active' ? 1 : 0)
  }
  const removed = polling(); removed.stop(); assert.equal(await removed.tick(), false)
  const slow = polling((_, advance) => { advance(300001); return 'active' })
  await slow.tick(); assert.equal(await slow.tick(), false); assert.equal(slow.activated, 0)
  const disconnected = polling(() => { throw new Error('offline') })
  while (await disconnected.tick()) {}
  assert.equal(disconnected.calls.length, 11)
})

test('manual and automatic checks share one request for the mounted invoice', async () => {
  const invoiceId = '60000000-0000-4000-8000-000000000001'
  for (const manualFirst of [false, true]) {
    const requests = []
    let timer, stop, reloads = 0
    const jsx = (type, props) => ({ type, props })
    const { StockActivationStatus } = loadStockModule('../app/hub/_components/StockActivationStatus.tsx', {
      react: {
        useCallback: callback => callback,
        useEffect: effect => { stop = effect() },
        useRef: initial => ({ current: initial }),
        useState: initial => [initial, () => {}],
      },
      'react/jsx-runtime': { jsx, jsxs: jsx },
      '../checkout/stock/actions': { checkStockActivationAction: id => {
        const request = Promise.withResolvers()
        requests.push({ id, ...request })
        return request.promise
      } },
    }, {
      setTimeout(fn) { timer = fn; return 1 },
      clearTimeout() { timer = undefined },
      window: { location: { reload() { reloads++ } } },
    })
    const manual = StockActivationStatus({ invoiceId }).props.children[1].props.onClick
    const automatic = timer
    const checks = manualFirst ? [manual(), automatic()] : [automatic(), manual()]
    assert.deepEqual(requests.map(request => request.id), [invoiceId])
    requests[0].reject(new Error('SYNTHETIC_NETWORK_FAILURE'))
    await Promise.all(checks)

    const retry = [timer(), manual()]
    assert.deepEqual(requests.map(request => request.id), [invoiceId, invoiceId])
    requests[1].resolve('active')
    await Promise.all(retry)
    assert.equal(reloads, 1)
    stop()
  }
})

test('status action rejects foreign and unpaid invoices before repair and never creates payment', async () => {
  const id = '60000000-0000-4000-8000-000000000001'
  const repairs = []
  let account = { status: 'unavailable' }
  const api = loadStockModule('../app/hub/checkout/stock/actions.ts', {
    '@/lib/stock-workspace-create': { STOCK_CHECKOUT_WORKSPACE_CREATION_ENABLED: false },
    'next/navigation': {}, '@/lib/stock-purchase-policy': {}, '@/lib/stock-membership-protocol': {},
    '@/lib/stock-self-payment': { readStockBillingAccount: async () => account },
    '@/lib/stock-invoice-recovery': { refreshStockInvoice: async invoice => repairs.push(invoice) },
  })
  assert.equal(await api.checkStockActivationAction(id), 'unavailable')
  account = { status: 'ready', workspaces: [{ activation: 'pending', invoices: [{ id, status: 'unpaid' }] }] }
  assert.equal(await api.checkStockActivationAction(id), 'unavailable')
  account.workspaces[0].invoices[0].status = 'paid'
  assert.equal(await api.checkStockActivationAction('foreign'), 'unavailable')
  assert.equal(repairs.length, 0)
  assert.equal(await api.checkStockActivationAction(id), 'pending')
  assert.deepEqual(repairs, [id])
  account.workspaces[0].activation = 'active'
  assert.equal(await api.checkStockActivationAction(id), 'active')
  assert.equal(repairs.length, 1)
})
