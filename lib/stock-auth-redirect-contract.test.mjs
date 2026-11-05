import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const config = JSON.parse(readFileSync(new URL('../docs/pricing/stock-gate-b-auth-redirects-20261105.json', import.meta.url), 'utf8'))
const origin = 'https://webzoka-stock-platform.vercel.app'
const hex = '[0123456789abcdef]'
const uuid = hex.repeat(8) + '-' + hex.repeat(4) + '-4' + hex.repeat(3) + '-[89ab]' + hex.repeat(3) + '-' + hex.repeat(12)
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const execution = JSON.parse(readFileSync(new URL('../docs/pricing/stock-gate-b-auth-execution-20261105.json', import.meta.url), 'utf8'))

test('Stock additions fit the actual Studio combined allowlist character limit', () => {
  assert.equal(execution.projectRef, config.stockProjectRef)
  assert.equal(execution.studioCombinedCharacterLimit, 2048)
  assert.equal(execution.baselineStockRedirects.length, 4)
  const original = execution.baselineStockRedirects.concat(config.stockAdditionalRedirectPatterns).join(',')
  assert.equal(original.length, 2053)
  assert.ok(original.length > execution.studioCombinedCharacterLimit)
  const encoded = execution.baselineStockRedirects.concat(execution.stockExecutionPatterns).join(',')
  assert.ok(encoded.length <= execution.studioCombinedCharacterLimit, `Studio rejects ${encoded.length} characters`)
})

test('compact encoding preserves the approved character set and every other URI byte', () => {
  const explicit = [...'0123456789abcdef'].map(char => char.codePointAt(0))
  const ranges = [...Array.from({ length: 10 }, (_, i) => 48 + i), ...Array.from({ length: 6 }, (_, i) => 97 + i)]
  assert.deepEqual(ranges, explicit)
  assert.equal(execution.stockExecutionPatterns.length, 2)
  for (const [index, original] of config.stockAdditionalRedirectPatterns.entries()) {
    const compact = execution.stockExecutionPatterns[index]
    assert.equal(compact, original.replaceAll('[0123456789abcdef]', '[0-9a-f]'))
    assert.equal(compact.replaceAll('[0-9a-f]', '[0123456789abcdef]'), original)
    assert.equal((compact.match(/\[0-9a-f\]/g) ?? []).length, 30)
    assert.ok(!compact.includes('*'))
    // Thirty identical finite rune sets are substituted; literal host/path,
    // version 4, variant, separators, query fence and end of string stay fixed.
    const match = new RegExp('^' + escape(origin + config.stockCallbackPaths[index]) + '\\?flow=' + uuid.replaceAll(hex, '[0-9a-f]') + '(?![\\s\\S])')
    assert.ok(match.test(origin + config.stockCallbackPaths[index] + '?flow=01234567-89ab-4cde-8fab-0123456789ab'))
    for (const suffix of ['&next=https://foreign.test', '/', '0', '\n']) {
      assert.equal(match.test(origin + config.stockCallbackPaths[index] + '?flow=01234567-89ab-4cde-8fab-0123456789ab' + suffix), false)
    }
  }
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
