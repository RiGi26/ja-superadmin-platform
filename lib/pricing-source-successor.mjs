import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { historicalStockPurchaseSource, stockPurchaseCandidateSource } from './stock-purchase-source-successor.mjs'

// Owner authorized local pricing integration and pricing-only source re-review
// in the active task on 27 October 2026. No runtime or release authority follows.
// Exact LF before/after pairs, reviewed after actual billing/sync behavior tests.
// IAM adapters, ownership actions, provisioning, signatures, dependency pins,
// identity gates and release fuses retain their separate existing protections.
// The billing successor was re-reviewed on 30 October for invoice-mode reuse,
// bounded Sandbox purchasing and unchanged legacy/LMS pricing. Offline engine
// and payment regressions passed; this pin grants no runtime/release authority.
const pins = {
  'lib/billing.ts': ['2d163a3116c601e742af4c8dd52cf1088925510e192d8bde9838b5012af1a951', '44529fefcd6d0279eb8f91efaf951b448cfcaf016636db8824f933405f11fa8e'],
  'lib/hub-data.ts': ['9c6ff085afcb96bea95c21534290247b48e3f67ea09a2ee9ac017aed05364d61', '8e33db0dc8db8adb91f7e7c343369bcb6a1c230c98dabd4bcc837477d127f737'],
  'app/hub/_components/HubShell.tsx': ['8b2e5f8a95a211eccc439dd911a25c172104d4b130eb46bb70cd66bf8ee5732d', 'd09130bd02de6240d3bee59f7dc3f00cb42d2efc4ff6430d369ab5bc9cbf5bc9'],
  'lib/customer-onboarding.ts': ['3cb8ec0106f5b9e802bf28b2f18ea4db50e21c6bfb8e6dd939eb0b5e66b7ab9f', '5a414524c784722be264aeae7a06de8ee95b7f231e6e867deb6b9967fecc418a'],
  'lib/stock-sync.ts': ['9b99c926520266ed9a47e568a9ad8b47eb6b96ea1991bc06d114d2ff64cc2319', '5a0e07f71b67ea72d974a0c9ba89af35cb3fdb3cb0a6956561e113fd1444eee3'],
  'lib/lms-sync.ts': ['3c1013e75ebf2ed41044b4da37d2772db9f270cecec0451142731a4bc8804c62', 'a9bbf111e37559ee498ffb0b1b7ec77dfeb49822e648545941010114de6fabf5'],
  'app/api/billing/checkout-self/route.ts': ['a31967f31272f7011e618bed622a6edf3351f50ef6a4c0fe3dd2808b801465ce', '7a17281609ec79bd9be30ab478be7137f25e3b89e90d49a20c7be3d3e46daf5d'],
}
// Composed candidate reviewed after combined behavior checks on 30 October 2026.
// Original pricing pairs above and all historical manifests remain unchanged.
const compositionBaseline = 'ace57932005735bee6a341f46f0e12bd68560a4f'
const composed = {
  // Hub Store price-display successors reviewed after catalog/render checks.
  // Historical Store/navigation pins remain unchanged in their own contracts.
  "app/hub/(public)/store/page.tsx": [
    "771d1ef34176c83652a4e3932cfd63b3c3fd6d25c2ef7cb9653b0a675c8fb24b",
    "1f0d29769e01daf0c5eb38e189ea8af3462a2b1e8c2cde37f598689bb24a17f8"
  ],
  "app/hub/_components/StoreFront.tsx": [
    "87163cddbaf7b40d3d96eccfbab4b36d633502073cfa266ed6916fbd19f8bfc6",
    "5ad0d70cda350cc30ccde9af49a91f5207fc0a4df0a8cff5641d462a24148cca"
  ],
  "app/hub/_components/store-front.module.css": [
    "3f2749d58ee4b231f55afbdc9a4201c2f5063da089be468c501e003b28be9dcc",
    "061bc977ad926232a733fcf643ad6cbd6636781a364dbd71a2b80d0beed7920d"
  ],
  "lib/hub-store-ui.test.mjs": [
    "de7d51e33867855fb16f60f6cfc902d829a6823836e45f191b187b573c1a5e82",
    "7ff0f581f14da05eb78a6f8a2a48814f349c98cb947432d3aab517827bfaeb44"
  ],
  "lib/billing.ts": [
    "2d163a3116c601e742af4c8dd52cf1088925510e192d8bde9838b5012af1a951",
    "44529fefcd6d0279eb8f91efaf951b448cfcaf016636db8824f933405f11fa8e"
  ],
  "lib/hub-data.ts": [
    "9c6ff085afcb96bea95c21534290247b48e3f67ea09a2ee9ac017aed05364d61",
    "8e33db0dc8db8adb91f7e7c343369bcb6a1c230c98dabd4bcc837477d127f737"
  ],
  "app/hub/_components/HubShell.tsx": [
    "f3a532acb48f6bb11b77e112364e32e2e80ba65843fbd73f45f061321d0b21cf",
    "2fa17e9257013f7366b1ae9c18e3e8012b0aeb63b65174ff48a8334e1e58e02d"
  ],
  "lib/customer-onboarding.ts": [
    "3cb8ec0106f5b9e802bf28b2f18ea4db50e21c6bfb8e6dd939eb0b5e66b7ab9f",
    "5a414524c784722be264aeae7a06de8ee95b7f231e6e867deb6b9967fecc418a"
  ],
  "lib/stock-sync.ts": [
    "9b99c926520266ed9a47e568a9ad8b47eb6b96ea1991bc06d114d2ff64cc2319",
    "5a0e07f71b67ea72d974a0c9ba89af35cb3fdb3cb0a6956561e113fd1444eee3"
  ],
  "lib/lms-sync.ts": [
    "3c1013e75ebf2ed41044b4da37d2772db9f270cecec0451142731a4bc8804c62",
    "a9bbf111e37559ee498ffb0b1b7ec77dfeb49822e648545941010114de6fabf5"
  ],
  "app/api/billing/checkout-self/route.ts": [
    "a31967f31272f7011e618bed622a6edf3351f50ef6a4c0fe3dd2808b801465ce",
    "7a17281609ec79bd9be30ab478be7137f25e3b89e90d49a20c7be3d3e46daf5d"
  ],
  "lib/blank-company-isolation.test.mjs": [
    "7ee315e74bbd71d5cc8e7c304abb5425912f18352999c186a8d48d759d10979e",
    "0b120bff28738952cf4051063a221be5fe84d0bb6807817981df965ce3b4b4e1"
  ],
  "lib/core-registry-native.test.mjs": [
    "bc21fd101d03debcab88b752858f2704fcd5a269f31a61712f68c2297ba4d391",
    "06d3420db6b5e5130606df4921605f8b8fe6e35b52b535c2b0d3fc10175bcd9d"
  ],
  "lib/hub-data.test.mjs": [
    "154262034345343f560b24188390790a7519c7765a1a634eae032c170caba702",
    "c4cdf5eacabae90f75f4a2971fa1a572c751b08c6a8b14c9b6f8eeb43166f79e"
  ],
  "lib/hub-integration-contract.mjs": [
    "7d3ac590829d4456a6e223579b19234c250e3ca22809e03d1743bc5a5426426c",
    "f240702b66d3a29f1776a714d2b159c59a28c8fea68366920f7a00fa7f2c32f6"
  ],
  "lib/hub-token-isolation.test.mjs": [
    "f63c85e4282286f1b7b775c548277b0479ffd7a651b5cb275be66639e42ca6e7",
    "bda8f014e60f82a01a7a725c4b7faa7976cbb09762a71755190e2db192382105"
  ],
  "lib/security-dependency-successor.mjs": [
    "64c3ab0177fd1cae96aebe1231ff2fe3574d0f65df6102c76189de9fe4773bcb",
    "986c8d3783ce01c06fec655d980b14c40070c24a4eb24f68c1c90e1da0cdf1b4"
  ]
}
const hash = text => createHash('sha256').update(text.toString().replaceAll('\r\n', '\n')).digest('hex')
// Bounded Sandbox execution successors, reviewed after behavior regressions.
// Original pricing/composition pins and all historical manifests above remain.
// These exact additions cover monthly-only upgrade classification and the
// private-cohort sync replay diagnostic. They grant no general activation.
const executed = {
  'lib/billing.ts': ['44529fefcd6d0279eb8f91efaf951b448cfcaf016636db8824f933405f11fa8e', 'ff70564acf3910315c7edc7eedabc097ac2f9e52e99de28c3bf53cc0c68873a1'],
  'lib/stock-sync.ts': ['5a0e07f71b67ea72d974a0c9ba89af35cb3fdb3cb0a6956561e113fd1444eee3', 'bc2648dceb7795c6e4b816efb2095f0edde837f756411e4c7e82917d0469dff9'],
}
function reviewedOutput(file) {
  const original = composed[file]?.[1] ?? pins[file]?.[1]
  if (!executed[file]) return original
  assert.equal(executed[file][0], original, 'Preserved pre-execution pricing pin: ' + file)
  return executed[file][1]
}
export const hasReviewedPricingSuccessor = file => Object.hasOwn(pins, file)
export const hasPricingComposition = file => Object.hasOwn(composed, file)
export function assertReviewedPricingSource(file, actual, expected) {
  actual = historicalStockPurchaseSource(file, actual)
  assert.ok(hasReviewedPricingSuccessor(file), 'No pricing source exception: ' + file)
  if (expected !== undefined) assert.equal(hash(expected), pins[file][0], 'Reviewed pricing baseline: ' + file)
  assert.equal(hash(actual), reviewedOutput(file), 'Exact reviewed combined pricing successor: ' + file)
}

// Test contracts only. Exact current source is verified before reconstructing
// the immutable hosted baseline; this never substitutes source under test.
export function historicalPricingSource(file, candidate) {
  candidate = historicalStockPurchaseSource(file, candidate)
  if (!hasPricingComposition(file)) return candidate
  if (hash(candidate) === composed[file][0]) return candidate
  assert.equal(hash(candidate), reviewedOutput(file), 'Exact reviewed pricing composition: ' + file)
  const original = execFileSync('git', ['show', compositionBaseline + ':' + file], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).replaceAll('\r\n', '\n')
  assert.equal(hash(original), composed[file][0], 'Immutable hosted pricing baseline: ' + file)
  return original
}
export function pricingCandidateSource(file, historical) {
  if (!hasPricingComposition(file)) return historical
  if (hash(historical) === reviewedOutput(file)) return stockPurchaseCandidateSource(file, historical)
  assert.equal(hash(historical), composed[file][0], 'Exact hosted pricing input: ' + file)
  const actual = readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
  assert.equal(hash(historicalStockPurchaseSource(file, actual)), reviewedOutput(file), 'Exact reviewed pricing output: ' + file)
  return actual
}
export function historicalPricingTestBytes(file, bytes) {
  return hasPricingComposition(file) ? Buffer.from(historicalPricingSource(file, bytes.toString('utf8'))) : bytes
}
