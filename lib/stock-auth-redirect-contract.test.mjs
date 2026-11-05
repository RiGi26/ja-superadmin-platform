import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const config = JSON.parse(readFileSync(new URL('../docs/pricing/stock-gate-b-auth-redirects-20261105.json', import.meta.url), 'utf8'))
const origin = 'https://webzoka-stock-platform.vercel.app'
const hex = '[0123456789abcdef]'
const uuid = hex.repeat(8) + '-' + hex.repeat(4) + '-4' + hex.repeat(3) + '-[89ab]' + hex.repeat(3) + '-' + hex.repeat(12)
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
    const match = new RegExp('^' + escape(origin + path) + '\\?flow=' + uuid + '$')
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
