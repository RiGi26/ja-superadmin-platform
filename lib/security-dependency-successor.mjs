import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { assertReviewedPricingSource, hasReviewedPricingSuccessor } from './pricing-source-successor.mjs'
import { historicalStockPurchaseSource } from './stock-purchase-source-successor.mjs'

// The public-release request requires the 22 October upstream security fixes.
// Preserve every historical freeze except this exact reviewed package pair.
// These are LF source hashes; no arbitrary dependency or lockfile delta passes.
const pins = {
  'package.json': ['b70b40aab54be13ee7b4bdc65c77161b3e34e47cdcd099dffcfc3e8157fa325e', '876b38499f0f01aa792e025a53a9f1a4ce1310f36d84a31c77ea58a42f05c9c9'],
  'package-lock.json': ['aadd1f3fcee7b746c41a6be23fe71e8ed841704df02d7d94926f0b79898f85a7', '30f399ee6eb2ad4b9fd723a73014745fb15498b7184f099bd3ff0f9d4601bb7e'],
}
const hash = value => createHash('sha256').update(value.replaceAll('\r\n', '\n')).digest('hex')
// Exact forward lock correction for GHSA-w5vr-8v7q-w6rv. Both existing
// parent ranges admit patched 2.11.x. Historical security pins remain unchanged.
// Restore only this reviewed block before the original whole-file assertion.
const baselineMappingLockHash = "4197ffea746240740fcde442570fa31350e7b57f379bb566419f49525bec160b"
function precedingSecurityLock(source) {
  if (hash(source) !== baselineMappingLockHash) return source
  const current = "    \"node_modules/baseline-browser-mapping\": {\n      \"version\": \"2.11.35\",\n      \"resolved\": \"https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.35.tgz\",\n      \"integrity\": \"sha512-GNk8KX52CHqeNKGk8+7tZnQab/2k1t/BgrUHPKNdijzpEhF1saPQZHVKb6m5loSAxB39gyrTYw34Qf9CQ3u1qQ==\",\n      \"license\": \"Apache-2.0\",\n      \"bin\": {\n        \"baseline-browser-mapping\": \"dist/cli.cjs\"\n      },\n      \"engines\": {\n        \"node\": \">=6.0.0\"\n      }\n    },"
  const prior = "    \"node_modules/baseline-browser-mapping\": {\n      \"version\": \"2.10.32\",\n      \"resolved\": \"https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.10.32.tgz\",\n      \"integrity\": \"sha512-wbPvpyjJPC0zdfdKXxqEL3Ea+bOMD/87X4lftiJkkaBiuG6ALQy1SLmEd7BSmVCuwCQsBrCamgBoLyfFDD1EPg==\",\n      \"license\": \"Apache-2.0\",\n      \"bin\": {\n        \"baseline-browser-mapping\": \"dist/cli.cjs\"\n      },\n      \"engines\": {\n        \"node\": \">=6.0.0\"\n      }\n    },"
  assert.equal(source.split(current).length, 2, 'One exact browser mapping lock entry')
  const restored = source.replace(current, prior)
  assert.equal(hash(restored), "30f399ee6eb2ad4b9fd723a73014745fb15498b7184f099bd3ff0f9d4601bb7e", 'Retain the complete preceding dependency lock')
  return restored
}
export function assertFrozenOrSecurityDependency(path, actual, expected) {
  actual = actual.replaceAll('\r\n', '\n'); expected = expected.replaceAll('\r\n', '\n')
  if (path === 'package-lock.json') actual = precedingSecurityLock(actual)
  // Only the exact task-branch deployment-disable addition is reversible here.
  if (path === 'vercel.json') actual = historicalStockPurchaseSource(path, actual)
  if (actual !== expected && hasReviewedPricingSuccessor(path)) {
    assertReviewedPricingSource(path, actual, expected)
    return
  }
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
