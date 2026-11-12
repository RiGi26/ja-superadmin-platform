import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { assertReviewedPricingSource, historicalPricingTestBytes } from './pricing-source-successor.mjs'
import { createHash } from 'node:crypto'
import { historicalNavigationSource } from './hub-navigation-source-contract.mjs'
import { historicalSignupSource } from './hub-signup-source-contract.mjs'

for (const file of ['lib/billing.ts', 'lib/hub-data.ts', 'app/hub/_components/HubShell.tsx',
  'lib/customer-onboarding.ts', 'lib/stock-sync.ts', 'lib/lms-sync.ts', 'app/api/billing/checkout-self/route.ts']) {
  test(`exact pricing exception rejects arbitrary drift in ${file}`, () => {
    const actual = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    const before = execFileSync('git', ['show', '4e4937ca55fada4856a2c10551a4f3c01e212045:' + file], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
    assertReviewedPricingSource(file, actual, before)
    assert.throws(() => assertReviewedPricingSource(file, actual + '\n// Unreviewed edit', before))
    assert.throws(() => assertReviewedPricingSource(file, actual, before + '\n// Different baseline'))
    assert.throws(() => assertReviewedPricingSource(file, before, before))
  })
}
test('pricing exception grants no IAM, provisioning, dependency or release-gate changes', () => {
  for (const file of ['lib/hub-context-routing.ts', 'lib/hub-billing.ts', 'lib/core-company.ts',
    'app/api/tenants/provision/route.ts', 'lib/billing-link.ts', 'package.json', 'lib/plan-catalog.ts']) {
    assert.throws(() => assertReviewedPricingSource(file, 'changed', 'baseline'))
  }
})

test('historical manifest reconstruction accepts only exact reviewed pricing test adapters', () => {
  const hash = text => createHash('sha256').update(text.toString().replaceAll('\r\n', '\n')).digest('hex')
  for (const [file, expected] of [
    ['lib/blank-company-isolation.test.mjs', '7ee315e74bbd71d5cc8e7c304abb5425912f18352999c186a8d48d759d10979e'],
    ['lib/core-registry-native.test.mjs', 'c5fb4300b8a785c9661a403fc887ca127fe099072edcf8418808428c74d845f7'],
  ]) {
    const actual = readFileSync(new URL('../' + file, import.meta.url))
    assert.equal(hash(historicalSignupSource(file, historicalNavigationSource(file, historicalPricingTestBytes(file, actual).toString()))), expected)
    const drift = Buffer.from(actual.toString() + '\n// Unreviewed test change')
    assert.throws(() => historicalPricingTestBytes(file, drift))
  }
  const arbitrary = Buffer.from('Unreviewed IAM change')
  assert.equal(historicalPricingTestBytes('lib/core-company.ts', arbitrary), arbitrary)
})
