// Exact presentation-only successors for the Owner-approved Customer Hub login.
// Authentication actions, routing, historical manifests, and source pins stay intact.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = '56d9edc899060b9c794d72a21092ea24dce8f878'
const candidates = Object.freeze({
  'app/hub/login/HubLoginForm.tsx': 'e0d21106d2ca94f6ed44b8ae89ec5ba0b996a695f6c4e7e55fac6af0fd602a94',
  'app/hub/login/page.tsx': '69671366f177a3ac10d4a75a68fbd309284bae864f54c99402969eb54d9fae41',
  'lib/google-oauth-dev.test.mjs': '5568ce163e61c3b24fb01e2f13f5fa2fcc77345f8b53bb78588d8449df697c64',
})
const normalized = text => text.replaceAll('\r\n', '\n')
const hash = text => createHash('sha256').update(text).digest('hex')

function delta(file) {
  if (!Object.hasOwn(candidates, file)) return null
  const before = normalized(execFileSync('git', ['-C', root, 'show', `${baseline}:${file}`], { encoding: 'utf8' }))
  const after = normalized(readFileSync(join(root, file), 'utf8'))
  assert.equal(hash(after), candidates[file], 'Exact approved login UI source: ' + file)
  return { before, after }
}

function replaceOnce(text, before, after, file) {
  assert.equal(text.split(before).length, 2, 'Exact login UI source anchor: ' + file)
  return text.replace(before, after)
}

export function loginUiCandidateSource(file, source) {
  const change = delta(file)
  return change ? replaceOnce(normalized(source), change.before, change.after, file) : source
}

export function historicalLoginUiSource(file, source) {
  const change = delta(file)
  return change ? replaceOnce(normalized(source), change.after, change.before, file) : source
}
