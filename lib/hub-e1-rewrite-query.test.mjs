import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const module = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./hub-e1-rewrite-query.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports })
const { hubE1RewriteQuery } = module.exports
const keys = { admissionId: 'c1579bce-9f77-4f8b-bf55-61219fde9a2b', commandId: '80658f58-93ce-4dc6-8505-43ba4ca69aa1' }
test('canonical Hub rewrite removes only the framework host and retains both selectors', () => {
  assert.equal(JSON.stringify(hubE1RewriteQuery({ ...keys, host: 'hub.webzoka.com' }, 'hub.webzoka.com')), JSON.stringify(keys))
})
test('foreign hosts, repeated values and adjacent unapproved fields remain rejectable', () => {
  for (const [host, value] of [['foreign.invalid', 'hub.webzoka.com'], [null, 'hub.webzoka.com'],
    ['hub.webzoka.com', 'foreign.invalid'], ['hub.webzoka.com', ['hub.webzoka.com', 'hub.webzoka.com']]]) {
    const query = { ...keys, host: value }
    assert.equal(hubE1RewriteQuery(query, host), query)
  }
  const result = hubE1RewriteQuery({ ...keys, host: 'hub.webzoka.com', owner: 'true' }, 'hub.webzoka.com')
  assert.equal(result.owner, 'true')
  assert.equal(Object.keys(result).sort().join(','), 'admissionId,commandId,owner')
  assert.equal(hubE1RewriteQuery(keys, 'hub.webzoka.com'), keys)
})
test('hosted workspace normalizes the observed rewrite before strict selector parsing', () => {
  const page = readFileSync(new URL('../app/hub/workspace/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /hubE1RewriteQuery\(await searchParams, \(await headers\(\)\)\.get\('host'\)\)/)
  assert.ok(page.indexOf('hubE1RewriteQuery(await') < page.indexOf('hubE1Keys.safeParse(query)'))
})
