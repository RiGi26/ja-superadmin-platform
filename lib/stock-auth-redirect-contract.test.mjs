import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const config = JSON.parse(readFileSync(new URL('../docs/pricing/stock-gate-b-auth-redirects-20261105.json', import.meta.url), 'utf8'))
const origin = 'https://webzoka-stock-platform.vercel.app'
const hex = '[0123456789abcdef]'
const uuid = hex.repeat(8) + '-' + hex.repeat(4) + '-4' + hex.repeat(3) + '-[89ab]' + hex.repeat(3) + '-' + hex.repeat(12)
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const execution = JSON.parse(readFileSync(new URL('../docs/pricing/stock-gate-b-auth-execution-20261105.json', import.meta.url), 'utf8'))

test('Studio proposal changes only the redundant legacy row and the approved selection addition', () => {
  const proposal = JSON.parse(readFileSync(new URL('../docs/pricing/stock-gate-b-auth-studio-proposal-20261106.json', import.meta.url), 'utf8'))
  assert.equal(proposal.status, 'PROPOSED_NOT_AUTHORIZED_NOT_EXECUTED')
  assert.equal(proposal.projectRef, 'oyyfcmlquqfrdoffkgsd')
  assert.equal(proposal.removeOnly, 'https://stock.webzoka.com/auth/callback')
  assert.equal(proposal.coveredByUnchanged, 'https://stock.webzoka.com/**')
  assert.ok(!/[?*\[\]{}\\]/.test(proposal.removeOnly))
  assert.deepEqual(proposal.before, execution.baselineStockRedirects.concat(execution.stockExecutionPatterns))
  assert.equal(proposal.before.filter(value => value === proposal.removeOnly).length, 1)
  assert.deepEqual(proposal.after, execution.baselineStockRedirects.filter(value => value !== proposal.removeOnly).concat(config.stockAdditionalRedirectPatterns))
  assert.ok(proposal.before.includes(proposal.coveredByUnchanged))
  assert.ok(proposal.after.includes(proposal.coveredByUnchanged))
  assert.equal(proposal.after.join(',').length, proposal.combinedCharacters)
  assert.equal(proposal.combinedCharacters, 2013)
  assert.ok(proposal.combinedCharacters <= proposal.studioLimit)
  assert.equal(proposal.siteUrlAction, 'RETAIN_UNCHANGED')
  assert.equal(proposal.coreOAuthClientAction, 'RETAIN_UNCHANGED')
})

test('Management API proposal retains all four original entries and both verbatim approved additions', () => {
  const patch = JSON.parse(readFileSync(new URL('../docs/pricing/stock-gate-b-auth-management-patch-20261106.json', import.meta.url), 'utf8'))
  assert.deepEqual(Object.keys(patch), ['uri_allow_list'])
  assert.deepEqual(patch.uri_allow_list.split(','), execution.baselineStockRedirects.concat(config.stockAdditionalRedirectPatterns))
  assert.equal(patch.uri_allow_list.length, 2053)
  assert.ok(!patch.uri_allow_list.includes('[0-9a-f]'))
})

test('original approved selection remains pending because the full allowlist exceeds Studio budget', () => {
  assert.equal(execution.projectRef, config.stockProjectRef)
  assert.equal(execution.studioCombinedCharacterLimit, 2048)
  assert.equal(execution.baselineStockRedirects.length, 4)
  const original = execution.baselineStockRedirects.concat(config.stockAdditionalRedirectPatterns).join(',')
  assert.equal(original.length, 2053)
  assert.ok(original.length > execution.studioCombinedCharacterLimit)
  const current = execution.baselineStockRedirects.concat(execution.stockExecutionPatterns).join(',')
  assert.equal(current.length, 1408)
  assert.deepEqual(execution.stockExecutionPatterns, config.stockAdditionalRedirectPatterns.slice(0, 1))
  assert.deepEqual(execution.pendingStockPatterns, config.stockAdditionalRedirectPatterns.slice(1))
  assert.equal(execution.selectionApplied, false)
})

test('invalid JavaScript-compatible mixed ranges are retained only as rejected provider regression cases', () => {
  assert.equal(execution.rejectedCompactPatterns.length, 2)
  for (const [index, original] of config.stockAdditionalRedirectPatterns.entries()) {
    assert.equal(execution.rejectedCompactPatterns[index], original.replaceAll('[0123456789abcdef]', '[0-9a-f]'))
  }
  for (const pattern of execution.stockExecutionPatterns) assert.ok(!pattern.includes('[0-9a-f]'))
  const workflow = readFileSync(new URL('../.github/workflows/core-stock-source-validation.yml', import.meta.url), 'utf8')
  assert.ok(workflow.includes('go test -C tools/stock-auth-glob -mod=readonly -count=1 -v'))
  assert.ok(readFileSync(new URL('../tools/stock-auth-glob/go.mod', import.meta.url), 'utf8').includes('github.com/gobwas/glob v0.2.3'))
})

test('application redirects use Stock Auth while Core retains its provider callback', () => {
  assert.equal(config.stockProjectRef, 'oyyfcmlquqfrdoffkgsd')
  assert.equal(config.coreProjectRef, 'hxhusfkrlafxdnyasmsu')
  assert.equal(config.coreOAuthClientAction, 'RETAIN_UNCHANGED')
  assert.deepEqual(config.coreOAuthClientRetainedRedirectUris, ['https://oyyfcmlquqfrdoffkgsd.supabase.co/auth/v1/callback'])
  assert.equal(config.coreOAuthClientId, 'fe3e0af9-2d84-4ec2-a750-b26bb4a81caf')
  for (const [index, plan] of ['2001', '2002'].entries()) {
    const url = new URL(config.coreAdditionalRedirectUrls[index])
    assert.equal(url.origin, 'https://ja-superadmin-platform-dkqji4srl-rigi26s-projects.vercel.app')
    assert.equal(url.pathname, '/auth/callback')
    assert.equal(url.searchParams.get('flow'), 'signup')
    assert.equal(url.searchParams.get('next'), '/hub/checkout/stock?plan=5dc6f4d0-6ef8-4b61-9950-7b4b1e8a' + plan)
    assert.deepEqual([...url.searchParams.keys()], ['flow', 'next'])
  }
})

test('Stock redirect patterns admit only the exact two callback paths and a bounded UUID-v4 flow', () => {
  assert.deepEqual(config.stockCallbackPaths, ['/api/auth/stock-membership/callback', '/api/auth/stock-membership/selection/callback'])
  assert.equal(config.stockAdditionalRedirectPatterns.length, 2)
  for (const [index, path] of config.stockCallbackPaths.entries()) {
    const pattern = config.stockAdditionalRedirectPatterns[index]
    assert.equal(pattern, origin + path + '\\?flow=' + uuid)
    assert.ok(!pattern.includes('*'))
    // Character classes have the same bounded matching intent as the provider
    // glob. Hosted Auth compilation/transport remains a separate acceptance.
    const match = new RegExp('^' + escape(origin + path) + '\\?flow=' + uuid + '(?![\\s\\S])')
    const value = '01234567-89ab-4cde-8fab-0123456789ab'
    for (const variant of ['8', '9', 'a', 'b']) {
      assert.ok(match.test(origin + path + '?flow=' + value.replace('8fab', variant + 'fab')))
    }
    for (const input of [
      origin + path, origin + path + '?flow=', origin + path + '?flow=not-a-uuid',
      origin + path + '?flow=' + value.replace('-4cde-', '-1cde-'),
      origin + path + '?flow=' + value.replace('-8fab-', '-7fab-'),
      origin + path + '?flow=' + value.toUpperCase(), origin + path + '?flow=' + value + '&next=https://foreign.test',
      origin + path + '?flow=' + value + '/extra', origin + path + '/other?flow=' + value,
      'https://foreign.test' + path + '?flow=' + value, origin.replace('https:', 'http:') + path + '?flow=' + value,
      origin + config.stockCallbackPaths[1 - index] + '?flow=' + value,
    ]) assert.equal(match.test(input), false, input)
  }
})
