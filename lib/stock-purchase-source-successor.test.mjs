import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { historicalStockPurchaseSource, stockPurchaseCandidateSource, stockPurchaseSourceContracts } from './stock-purchase-source-successor.mjs'

const hash = value => createHash('sha256').update(value.replaceAll('\r\n', '\n')).digest('hex')
test('exact Stock source successors recover every frozen baseline; any adjacent edit stays unrecognized', () => {
  const groups = Map.groupBy(stockPurchaseSourceContracts, row => `${row.file}:${row.profile}`)
  for (const rows of groups.values()) {
    const row = rows[0]
    const actual = readFileSync(new URL('../' + row.file, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
    assert.equal(hash(actual), rows.at(-1).afterHash, row.file)
    const before = historicalStockPurchaseSource(row.file, actual, row.profile)
    assert.equal(hash(before), row.beforeHash, row.file)
    assert.equal(stockPurchaseCandidateSource(row.file, before, row.profile), actual, row.file)
    // Verify every historical link, exact anchor and hash; adding a successor
    // cannot erase or loosen any preceding source contract.
    let stage = before
    for (const link of rows) {
      assert.equal(hash(stage), link.beforeHash, link.file)
      for (const edit of [...link.edits].reverse()) {
        assert.equal(stage.slice(edit.beforeOffset, edit.beforeOffset + edit.before.length), edit.before)
        stage = stage.slice(0, edit.beforeOffset) + edit.after + stage.slice(edit.beforeOffset + edit.before.length)
      }
      assert.equal(hash(stage), link.afterHash, link.file)
    }
    assert.equal(stage, actual)
    for (const changed of [actual + '\n// unapproved\n', ' ' + actual, actual.replace(/\w/, 'X')]) {
      assert.equal(historicalStockPurchaseSource(row.file, changed, row.profile), changed)
      assert.notEqual(hash(changed), row.afterHash)
    }
    assert.equal(stockPurchaseCandidateSource(row.file, before + '\n// wrong baseline', row.profile), before + '\n// wrong baseline')
  }
  for (const file of ['lib/core-company.ts', 'lib/core-registry-native.ts', 'lib/e1-quarantine-release.ts', 'lib/billing-link.ts', 'package.json']) {
    assert.ok(!stockPurchaseSourceContracts.some(row => row.file === file), file)
    assert.equal(historicalStockPurchaseSource(file, 'unreviewed'), 'unreviewed')
  }
})
