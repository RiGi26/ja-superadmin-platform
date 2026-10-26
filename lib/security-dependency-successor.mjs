import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

// The public-release request requires the 22 October upstream security fixes.
// Preserve every historical freeze except this exact reviewed package pair.
// These are LF source hashes; no arbitrary dependency or lockfile delta passes.
const pins = {
  'package.json': ['b70b40aab54be13ee7b4bdc65c77161b3e34e47cdcd099dffcfc3e8157fa325e', '876b38499f0f01aa792e025a53a9f1a4ce1310f36d84a31c77ea58a42f05c9c9'],
  'package-lock.json': ['aadd1f3fcee7b746c41a6be23fe71e8ed841704df02d7d94926f0b79898f85a7', '30f399ee6eb2ad4b9fd723a73014745fb15498b7184f099bd3ff0f9d4601bb7e'],
}
const hash = value => createHash('sha256').update(value.replaceAll('\r\n', '\n')).digest('hex')
export function assertFrozenOrSecurityDependency(path, actual, expected) {
  actual = actual.replaceAll('\r\n', '\n'); expected = expected.replaceAll('\r\n', '\n')
  if (!pins[path] || actual === expected) { assert.equal(actual, expected, path); return }
  assert.equal(hash(expected), pins[path][0], 'Historical dependency baseline: ' + path)
  assert.equal(hash(actual), pins[path][1], 'Exact security dependency successor: ' + path)
  if (path === 'package.json') {
    const before = JSON.parse(expected), after = JSON.parse(actual)
    assert.equal(after.dependencies.next, '16.4.1')
    assert.equal(after.dependencies.zod, '4.6.6')
    assert.equal(after.devDependencies['eslint-config-next'], '16.4.1')
    after.dependencies.next = before.dependencies.next
    after.dependencies.zod = before.dependencies.zod
    after.devDependencies['eslint-config-next'] = before.devDependencies['eslint-config-next']
    assert.equal(after.devDependencies.shadcn, before.dependencies.shadcn)
    after.dependencies.shadcn = after.devDependencies.shadcn
    delete after.devDependencies.shadcn
    assert.deepEqual(after, before, 'Only patched existing versions and build-only CLI classification may change')
  }
}
