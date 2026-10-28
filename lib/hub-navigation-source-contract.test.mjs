import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { historicalNavigationBytes, historicalNavigationSource, navigationCandidateSource, navigationSourcePaths } from './hub-navigation-source-contract.mjs'

const root = new URL('../', import.meta.url)
const baseline = '51a1c84e57625c38d0b9e12bd514412e7de3590c'
const paths = [
  'app/hub/_components/HubShell.tsx', 'app/hub/_public/PublicExploreContent.tsx',
  'app/hub/_public/PublicExploreNav.tsx', 'app/hub/account/actions.ts',
  'app/hub/actions.ts', 'app/hub/login/page.tsx', 'app/hub/onboarding/status/page.tsx',
  'app/hub/signup/HubSignupForm.tsx', 'app/hub/signup/page.tsx',
  'app/oauth/consent/actions.ts', 'app/oauth/consent/page.tsx',
  'lib/core-registry-native.test.mjs', 'lib/e1-stock-transport-proxy.test.mjs', 'lib/e1-workspace.test.mjs',
  'lib/google-oauth-dev.test.mjs', 'lib/hub-account.ts',
  'lib/hub-integration-contract.mjs', 'lib/hub-login-ui-source-contract.mjs', 'lib/hub-registration.test.mjs',
  'lib/hub-return-path.ts', 'lib/hub-signup-source-contract.test.mjs', 'lib/hub-token-isolation.test.mjs',
  'next.config.ts', 'proxy.ts',
]

test('navigation source changes have a closed scope and never normalize unrelated bytes', () => {
  assert.deepEqual(navigationSourcePaths, paths)
  const bytes = Buffer.from([0, 255, 13, 10])
  assert.equal(historicalNavigationBytes('unrelated-protected.sql', bytes), bytes)
})

for (const file of paths) test('exact navigation changes preserve released source: ' + file, () => {
  const historical = execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' }).replaceAll('\r\n', '\n')
  const candidate = readFileSync(new URL(file, root), 'utf8').replaceAll('\r\n', '\n')
  assert.equal(navigationCandidateSource(file, historical), candidate)
  assert.equal(historicalNavigationSource(file, candidate), historical)
  assert.equal(historicalNavigationBytes(file, Buffer.from(candidate)).toString(), historical)
  assert.notEqual(historicalNavigationSource(file, candidate + '\n// unauthorized adjacent mutation\n'), historical)
  assert.throws(() => navigationCandidateSource(file, 'wrong baseline'))
})
