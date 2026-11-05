import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { assertFrozenOrSecurityDependency } from './security-dependency-successor.mjs'

test('public runtime lock selects patched Next.js, matching lint configuration and constrained-schema fix', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)))
  assert.equal(pkg.dependencies.next, '16.4.1')
  assert.equal(pkg.dependencies.zod, '4.6.6')
  assert.equal(pkg.devDependencies['eslint-config-next'], '16.4.1')
  assert.equal(pkg.devDependencies.shadcn, '^4.8.0')
  assert.equal(pkg.dependencies.shadcn, undefined)
  assert.equal(lock.packages['node_modules/next'].version, '16.4.1')
  assert.equal(lock.packages['node_modules/zod'].version, '4.6.6')
  const browserMapping = lock.packages['node_modules/baseline-browser-mapping'].version.split('.').map(Number)
  assert.ok(browserMapping[0] > 2 || (browserMapping[0] === 2 && browserMapping[1] >= 11))
  for (const [path, value] of Object.entries(lock.packages)) if (path.endsWith('/sharp')) {
    const [major, minor, patch] = value.version.split('.').map(Number)
    assert.ok(major > 0 || minor > 35 || (minor === 35 && patch >= 5), path)
  }
})

test('browser mapping patch retains the historical lock and rejects adjacent dependency changes', () => {
  const actual = readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')
  const original = execFileSync('git', ['show', '8a9ae5e7d61b706c3bd87f5516d759560876bad5:package-lock.json'], { encoding: 'utf8' })
  assert.doesNotThrow(() => assertFrozenOrSecurityDependency('package-lock.json', actual, original))
  for (const changed of [actual.replace('2.11.35', '2.10.32'), actual.replace('19.2.4', '19.2.5')]) {
    assert.notEqual(changed, actual)
    assert.throws(() => assertFrozenOrSecurityDependency('package-lock.json', changed, original))
  }
})

test('security exception does not permit arbitrary package or lockfile drift', () => {
  for (const path of ['package.json', 'package-lock.json', 'lib/customer-onboarding.ts']) {
    assert.throws(() => assertFrozenOrSecurityDependency(path, 'changed', 'baseline'))
  }
})
