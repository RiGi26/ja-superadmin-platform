// Exact UI-only successors over the released Store and Customer Hub source.
// Original security pins remain unchanged; adjacent mutations are not normalized.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = 'a5b8915d758eba9b5917cf5b0a9a8380eaef919a'
const pins = Object.freeze({
  "app/hub/_components/HubShell.tsx": "f3a532acb48f6bb11b77e112364e32e2e80ba65843fbd73f45f061321d0b21cf",
  "app/hub/_components/StoreShowcase.tsx": "c6206aaa714357d194d91acf470911521206c25eb9f2ddc341e4d20a2599bae8",
  "app/hub/_public/PublicExploreShell.tsx": "2aa84d9557c6900173e9955adfe3bbbd1997ddcca35744df7179710884be6472",
  "app/hub/(public)/store/page.tsx": "771d1ef34176c83652a4e3932cfd63b3c3fd6d25c2ef7cb9653b0a675c8fb24b",
  "app/hub/account/page.tsx": "540dbf0fed36868ff90161376b4dec78dc41d78b216b7a62da9dc32dc24e90a3",
  "lib/hub-data.test.mjs": "154262034345343f560b24188390790a7519c7765a1a634eae032c170caba702",
  "lib/hub-token-isolation.test.mjs": "f63c85e4282286f1b7b775c548277b0479ffd7a651b5cb275be66639e42ca6e7",
  "lib/hub-owned-workspace.test.mjs": "74bf850f422ba7d69b2b70cf3e27e05bc3c456cf165f7db66c422e64d9bbc130"
})
const lf = text => text.replaceAll('\r\n', '\n')
export const storeHubUiSourcePaths = Object.freeze(Object.keys(pins))
function delta(file) {
  if (!Object.hasOwn(pins, file)) return null
  const before = lf(execFileSync('git', ['-C', root, 'show', `${baseline}:${file}`], { encoding: 'utf8' }))
  const after = lf(readFileSync(join(root, file), 'utf8'))
  assert.equal(createHash('sha256').update(after).digest('hex'), pins[file], 'Exact approved Store/Hub UI source: ' + file)
  return { before, after }
}
function replaceOnce(text, before, after, file) {
  assert.equal(text.split(before).length, 2, 'Exact Store/Hub UI anchor: ' + file)
  return text.replace(before, after)
}
export function storeHubUiCandidateSource(file, source) {
  const change = delta(file)
  return change ? replaceOnce(lf(source), change.before, change.after, file) : source
}
export function historicalStoreHubUiSource(file, source) {
  const change = delta(file)
  return change ? replaceOnce(lf(source), change.after, change.before, file) : source
}
