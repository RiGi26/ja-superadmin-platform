import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { historicalSignupSource, signupCandidateSource, signupHistoricalBytes, signupSourcePaths } from './hub-signup-source-contract.mjs'
import { historicalNavigationSource } from './hub-navigation-source-contract.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = '4e4937ca55fada4856a2c10551a4f3c01e212045'
const hash = source => createHash('sha256').update(source).digest('hex')
const paths = [
  'proxy.ts', 'app/auth/callback/route.ts', 'app/hub/actions.ts',
  'app/hub/login/HubLoginForm.tsx', 'app/hub/login/page.tsx', 'lib/hub-return-path.ts',
  'app/hub/_public/PublicExploreNav.tsx', 'app/hub/_public/PublicExploreContent.tsx',
  'lib/hub-integration-contract.mjs', 'lib/e1-workspace.test.mjs',
  'lib/google-oauth-dev.test.mjs', 'lib/core-registry-native.test.mjs',
]

test('signup source scope is closed and cannot modify an unrelated protected dependency', () => {
  assert.deepEqual(signupSourcePaths, paths)
  const bytes = Buffer.from([0, 255, 13, 10])
  assert.equal(signupHistoricalBytes('unrelated-protected-file.sql', bytes), bytes)
})

for (const file of paths) test('exact signup delta retains the historical baseline: ' + file, () => {
  const historical = execFileSync('git', ['-C', root, 'show', `${baseline}:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n')
  const candidate = historicalNavigationSource(file, readFileSync(join(root, file), 'utf8').replaceAll('\r\n', '\n'))
  assert.equal(candidate, signupCandidateSource(file, historical))
  assert.equal(historicalSignupSource(file, candidate), historical)
  assert.equal(hash(signupHistoricalBytes(file, Buffer.from(candidate))), hash(historical))
  // A literal allowed addition must not conceal any adjacent source mutation.
  const altered = candidate + '\n// unrelated source mutation\n'
  assert.notEqual(hash(signupHistoricalBytes(file, Buffer.from(altered))), hash(historical))
  assert.throws(() => signupCandidateSource(file, 'wrong historical baseline'))
})
