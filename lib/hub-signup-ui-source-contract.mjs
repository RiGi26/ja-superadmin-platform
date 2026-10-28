// Exact presentation successors for the approved signup design.
// Historical navigation/security comparisons retain their immutable baselines.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = 'dcbe8da4e7e341b25b3d3367826bc5b7b8b7974f'
const pins = Object.freeze({
  "app/hub/signup/page.tsx": "e15460a045125c6e5b7669f4a9b5cb15f0c5df702588d66b5fc1394069ebd1d5",
  "app/hub/signup/HubSignupForm.tsx": "a856676692ea884512db91c6fc295e62205eec96bc2b8f8d7beba72ec5bba109",
  "app/hub/signup/signup.module.css": "73d49a224f0e6404e2b799d93b35351b6e9a969b2fc2c29b4fe5f63bd1d0141e"
})
const lf = value => value.replaceAll('\r\n', '\n')

function delta(file) {
  if (!Object.hasOwn(pins, file)) return null
  const before = lf(execFileSync('git', ['-C', root, 'show', `${baseline}:${file}`], { encoding: 'utf8' }))
  const after = lf(readFileSync(join(root, file), 'utf8'))
  assert.equal(createHash('sha256').update(after).digest('hex'), pins[file], 'Exact approved signup UI source: ' + file)
  return { before, after }
}
function replaceOnce(text, before, after, file) {
  assert.equal(text.split(before).length, 2, 'Exact signup UI source anchor: ' + file)
  return text.replace(before, after)
}
export function signupUiCandidateSource(file, historical) {
  const change = delta(file)
  return change ? replaceOnce(lf(historical), change.before, change.after, file) : historical
}
export function historicalSignupUiSource(file, candidate) {
  const change = delta(file)
  return change ? replaceOnce(lf(candidate), change.after, change.before, file) : candidate
}
