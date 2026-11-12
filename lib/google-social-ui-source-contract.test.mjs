import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { googleSocialUiCandidateSource, historicalGoogleSocialUiSource, googleSocialUiSourcePaths } from './google-social-ui-source-contract.mjs'

const root = new URL('../', import.meta.url)
// Independently captured before edits from verified Core main ace57932005735bee6a341f46f0e12bd68560a4f.
// Keep these pins unchanged; do not generate expected hashes from the candidate.
const pins = Object.freeze({
  'app/hub/login/page.tsx': '7cbfd08f3e07045c045df2d3cc30f2ae0df5cba4c38c60d305ae9a87fe1ced4a',
  'app/hub/signup/HubSignupForm.tsx': 'a856676692ea884512db91c6fc295e62205eec96bc2b8f8d7beba72ec5bba109',
  'lib/google-oauth-dev.test.mjs': 'ab3e2673f80c559102733bf2ee7db0c7d6ee76a55edaec561a9823643aaacb3b',
  'lib/hub-registration.test.mjs': '3b589d587f775b1b062278477c09ffe615eac145998ca3a688ddc444a9e551c8',
  'lib/hub-signup-ui.test.mjs': '7b32094f12250d9a8a724bae463dcf58a2265b97495ee6429482ddaff1263d8d',
})
const hash = text => createHash('sha256').update(text).digest('hex')
const paths = ['app/hub/login/page.tsx', 'app/hub/signup/HubSignupForm.tsx',
  'lib/google-oauth-dev.test.mjs', 'lib/hub-registration.test.mjs', 'lib/hub-signup-ui.test.mjs']

test('Google UI source normalization is limited to five exact integration files', () => {
  assert.deepEqual(googleSocialUiSourcePaths, paths)
  const sentinel = 'protected content remains intact'
  assert.equal(historicalGoogleSocialUiSource('lib/core-company.ts', sentinel), sentinel)
  assert.equal(googleSocialUiCandidateSource('lib/core-company.ts', sentinel), sentinel)
})

for (const file of paths) test('Google UI delta preserves historical source and exposes adjacent mutations: ' + file, () => {
  const current = readFileSync(new URL(file, root), 'utf8').replaceAll('\r\n', '\n')
  const previous = historicalGoogleSocialUiSource(file, current)
  assert.equal(hash(previous), pins[file])
  assert.equal(googleSocialUiCandidateSource(file, previous), current)
  assert.equal(historicalGoogleSocialUiSource(file, current), previous)
  let mutated = null
  try { mutated = hash(historicalGoogleSocialUiSource(file, current + '\n// unrelated mutation\n')) } catch { /* Rejected unknown bytes cannot satisfy the historical pin. */ }
  assert.notEqual(mutated, pins[file])
  assert.throws(() => googleSocialUiCandidateSource(file, 'incorrect baseline'))
})
