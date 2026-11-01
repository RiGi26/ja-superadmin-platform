// Exact local successor deltas for the approved Stock purchase implementation.
// This is source evidence only. It grants no runtime, DB or release authority.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const contracts = JSON.parse(readFileSync(new URL('./stock-purchase-source-deltas.json', import.meta.url), 'utf8'))
const lf = value => value.replaceAll('\r\n', '\n')
const hash = value => createHash('sha256').update(lf(value)).digest('hex')
export const stockPurchaseSourceContracts = contracts
export const hasStockPurchaseSuccessor = file => contracts.some(row => row.file === file && row.profile === 'runtime')

function translate(file, value, profile, reverse) {
  const entry = contracts.find(row => row.file === file && row.profile === profile)
  if (!entry) return value
  const text = lf(value)
  // Unrecognized bytes are never substituted, even when the known edits match.
  if (hash(text) !== (reverse ? entry.afterHash : entry.beforeHash)) return value
  let result = text
  const edits = [...entry.edits].reverse()
  for (const edit of edits) {
    const offset = reverse ? edit.afterOffset : edit.beforeOffset
    const from = reverse ? edit.after : edit.before
    const to = reverse ? edit.before : edit.after
    assert.equal(result.slice(offset, offset + from.length), from, 'Exact Stock source anchor: ' + file)
    result = result.slice(0, offset) + to + result.slice(offset + from.length)
  }
  assert.equal(hash(result), reverse ? entry.beforeHash : entry.afterHash, 'Exact Stock source reconstruction: ' + file)
  return result
}
export const historicalStockPurchaseSource = (file, source, profile = 'runtime') => translate(file, source, profile, true)
export const stockPurchaseCandidateSource = (file, source, profile = 'runtime') => translate(file, source, profile, false)
