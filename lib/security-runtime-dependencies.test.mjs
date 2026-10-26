import assert from 'node:assert/strict'
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
  for (const [path, value] of Object.entries(lock.packages)) if (path.endsWith('/sharp')) {
    const [major, minor, patch] = value.version.split('.').map(Number)
    assert.ok(major > 0 || minor > 35 || (minor === 35 && patch >= 5), path)
  }
})

test('security exception does not permit arbitrary package or lockfile drift', () => {
  for (const path of ['package.json', 'package-lock.json', 'lib/customer-onboarding.ts']) {
    assert.throws(() => assertFrozenOrSecurityDependency(path, 'changed', 'baseline'))
  }
})
