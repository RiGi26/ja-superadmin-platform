import assert from 'node:assert/strict'
import { historicalStockPurchaseSource } from './stock-purchase-source-successor.mjs'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { historicalPricingSource, pricingCandidateSource } from './pricing-source-successor.mjs'
const root = new URL('..', import.meta.url)
const source = file => readFileSync(new URL(file, root), 'utf8').replaceAll('\r\n', '\n')
const hash = text => createHash('sha256').update(text).digest('hex')

for (const file of ['lib/billing.ts', 'lib/hub-data.ts', 'app/hub/_components/HubShell.tsx',
  'lib/customer-onboarding.ts', 'lib/stock-sync.ts', 'lib/lms-sync.ts', 'app/api/billing/checkout-self/route.ts',
  'lib/blank-company-isolation.test.mjs', 'lib/core-registry-native.test.mjs', 'lib/hub-data.test.mjs',
  'lib/hub-integration-contract.mjs', 'lib/hub-token-isolation.test.mjs', 'lib/security-dependency-successor.mjs']) {
  test('combined source reconstructs the exact hosted baseline and rejects drift: ' + file, () => {
    const before = execFileSync('git', ['show', 'ace57932005735bee6a341f46f0e12bd68560a4f:' + file], { cwd: root, encoding: 'utf8' }).replaceAll('\r\n', '\n')
    const after = source(file)
    assert.equal(historicalPricingSource(file, after), before)
    assert.equal(pricingCandidateSource(file, before), after)
    assert.throws(() => historicalPricingSource(file, after + '\n// unreviewed mutation'))
    assert.throws(() => pricingCandidateSource(file, before + '\n// different baseline'))
  })
}

test('merged registry checks undo pricing before navigation and signup', () => {
  const text = source('lib/core-registry-native.test.mjs')
  assert.match(text, /historicalStockPurchaseSource\(path, current.toString\('utf8'\)\)/)
  assert.match(text, /signupHistoricalBytes\(path, historicalNavigationBytes\(path, historicalPricingTestBytes\(path, bytes\)\)\)/)
})

test('composition has no normalization exception for IAM or release fuses', () => {
  for (const file of ['lib/core-company.ts', 'lib/e1-realm.ts', 'lib/core-registry-native.ts', 'lib/plan-catalog.ts']) {
    const text = source(file) + '\n// unreviewed mutation'
    assert.equal(historicalPricingSource(file, text), text)
  }
  assert.match(source('lib/plan-catalog.ts'), /BASIC_PRO_RELEASE_AUTHORIZED = false/)
  assert.match(source('lib/core-company.ts'), /CORE_COMPANY_RUNTIME_ENABLED = false/)
})

// These checks pin the entire pre-existing SSO contract after undoing only the
// few exact composition hooks. Original SSO hashes and rules are not redefined.
test('navigation verification retains its complete hosted source outside composition hooks', () => {
  const text = historicalStockPurchaseSource('lib/hub-navigation-source-contract.mjs', source('lib/hub-navigation-source-contract.mjs'))
    .replace("import { historicalPricingSource, pricingCandidateSource } from './pricing-source-successor.mjs'\n", '')
    .replace('  candidate = historicalPricingSource(file, candidate)\n', '')
    .replace("return pricingCandidateSource(file, file === 'proxy.ts' ? replaceOnce(result, stockBridgeBefore, stockBridgeAfter, file) : result)", "return file === 'proxy.ts' ? replaceOnce(result, stockBridgeBefore, stockBridgeAfter, file) : result")
  assert.equal(hash(text), '640374be6b1f44765bec5bc61648970e4ae52a860161e3a9d0be939eb2b00e1d')
})
test('Store UI verification retains its complete hosted source outside composition hooks', () => {
  const text = historicalStockPurchaseSource('lib/hub-store-ui-source-contract.mjs', source('lib/hub-store-ui-source-contract.mjs'))
    .replace("import { historicalPricingSource, pricingCandidateSource } from './pricing-source-successor.mjs'\n", '')
    .replace("historicalPricingSource(file, lf(readFileSync(join(root, file), 'utf8')))", "lf(readFileSync(join(root, file), 'utf8'))")
    .replace('pricingCandidateSource(file, replaceOnce(lf(source), change.before, change.after, file))', 'replaceOnce(lf(source), change.before, change.after, file)')
    .replace('  source = historicalPricingSource(file, source)\n', '')
  assert.equal(hash(text), '459275a2f5614b0be0a1cb6a399d6a63f64f863e38330dd175afe37d0114aa1a')
})
