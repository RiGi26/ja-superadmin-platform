import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { loadPricingPolicy } from './pricing-unit-harness.mjs'

const policy = loadPricingPolicy()
const offer = policy.APPROVED_OFFERS.find(item => item.platform === 'stock' && item.publicTier === 'basic')
const plan = { id: offer.id, platform: offer.platform, tier: offer.tier, public_tier: offer.publicTier,
  tier_display_name: offer.name, price_monthly: offer.price, price_yearly: null, offer_version: policy.BASIC_PRO_VERSION,
  allowed_periods: ['monthly'], entitlement_contract: offer.contract, is_active: false, is_for_sale: false }
const env = { BILLING_SANDBOX_UAT_ENABLED: 'true', NEXT_PUBLIC_SUPABASE_URL: 'https://hxhusfkrlafxdnyasmsu.supabase.co', WEBZOKA_HUB_APP_URL: 'https://hub.webzoka.com' }

function load(environment = env, answer = true, error = null, company = false) {
  const calls = [], fixture = { exports: {} }
  const require = name => {
    if (name === 'server-only') return {}
    if (name === '@/lib/plan-catalog') return policy
    if (name === '@/lib/stock-purchase-policy') return { STOCK_PAID_BILLING_RUNTIME_ENABLED: company }
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => ({ rpc: (name, args) => {
      calls.push({ name, args }); return { abortSignal: async () => ({ data: name === 'stock_billing_sandbox_allowed' ? company : answer, error }) }
    } }) }
    throw new Error('Unexpected import: ' + name)
  }
  const code = ts.transpileModule(readFileSync(new URL('./billing-sandbox-uat.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { module: fixture, exports: fixture.exports, require, AbortSignal, process: { env: environment } })
  return { ...fixture.exports, calls }
}

test('an environment flag alone never authorizes a Sandbox purchase', async () => {
  for (const [answer, error] of [[false, null], [null, null], [true, { message: 'Denied' }]]) {
    const h = load(env, answer, error)
    const value = await h.prepareSandboxCheckoutPlan(plan, 'SYNTHETIC-TENANT')
    assert.equal(value.sandboxUat, false)
    assert.equal(value.plan.is_active, false)
    assert.equal(policy.basicProEnabled('true'), false)
  }
})

test('only the exact realm, application and approved Stock contract reach the private gate', async () => {
  for (const environment of [{}, { ...env, BILLING_SANDBOX_UAT_ENABLED: 'false' }, { ...env, NEXT_PUBLIC_SUPABASE_URL: 'https://foreign.invalid' }, { ...env, WEBZOKA_HUB_APP_URL: 'https://foreign.invalid' }]) {
    const h = load(environment)
    assert.equal(await h.sandboxPurchaseAllowed(plan, 'SYNTHETIC-TENANT'), false)
    assert.equal(h.calls.length, 0)
  }
  for (const changed of [{ ...plan, platform: 'lms' }, { ...plan, price_monthly: 1 }, { ...plan, id: 'foreign' }]) {
    const h = load()
    assert.equal(await h.sandboxPurchaseAllowed(changed, 'SYNTHETIC-TENANT'), false)
    assert.equal(h.calls.length, 0)
  }
})

test('a fresh database permission produces a request-local view without changing the plan or release fuse', async () => {
  const h = load()
  const before = JSON.stringify(plan)
  const value = await h.prepareSandboxCheckoutPlan(plan, 'SYNTHETIC-TENANT')
  assert.equal(value.sandboxUat, true)
  assert.equal(value.plan.is_active, true)
  assert.equal(value.plan.is_for_sale, true)
  assert.equal(JSON.stringify(plan), before)
  assert.equal(h.calls[0].name, 'billing_sandbox_uat_allowed')
  assert.equal(h.calls[0].args.p_tenant, 'SYNTHETIC-TENANT')
  assert.equal(policy.basicProEnabled('true'), false)
  assert.equal(h.sandboxNotificationHeaders(true)['X-Override-Notification'], 'https://hub.webzoka.com/api/billing/webhook')
  assert.equal(Object.keys(h.sandboxNotificationHeaders(false)).length, 0)
})

test('Company sandbox uses its separate finite DB cohort while the legacy cohort stays unchanged', async () => {
  const company = load(env, false, null, true)
  assert.equal(await company.sandboxPurchaseAllowed(plan, 'SYNTHETIC-COMPANY-TENANT'), true)
  assert.deepEqual(company.calls.map(call => call.name), ['billing_sandbox_uat_allowed', 'stock_billing_sandbox_allowed'])
  assert.equal(policy.basicProEnabled('true'), false)
  assert.equal(await load(env, false, { message: 'Unavailable' }, true).sandboxPurchaseAllowed(plan, 'SYNTHETIC-COMPANY-TENANT'), false)
})
