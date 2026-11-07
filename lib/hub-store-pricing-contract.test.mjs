import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { historicalPricingSource, pricingCandidateSource } from './pricing-source-successor.mjs'
for (const file of ['app/hub/(public)/store/page.tsx', 'app/hub/_components/StoreFront.tsx', 'app/hub/_components/store-front.module.css', 'lib/hub-store-ui.test.mjs']) {
  test('Store pricing successor retains the immutable source and rejects adjacent changes: ' + file, () => {
    const before = execFileSync('git', ['show', 'ace57932005735bee6a341f46f0e12bd68560a4f:' + file], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).replaceAll('\r\n','\n')
    const after = readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r\n','\n')
    assert.equal(historicalPricingSource(file, after), before)
    assert.equal(pricingCandidateSource(file, before), after)
    assert.throws(() => historicalPricingSource(file, after + '\n/* unauthorized edit */'))
    assert.throws(() => pricingCandidateSource(file, before + '\n/* unreviewed baseline */'))
  })
}
test('Store desktop price cards use two columns with mobile stacking preserved', () => {
  const css = readFileSync(new URL('../app/hub/_components/store-front.module.css',import.meta.url),'utf8')
  assert.match(css,/\.plans\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(css,/@media\(max-width:900px\)\{\.hero,\.plans,\.workflows,\.faq\{grid-template-columns:1fr\}/)
})
