import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../lib/portal-urls.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText

// Execute the real module with isolated environment values for every scenario.
function loadPortalUrls(values = {}) {
  const exports = {}
  const env = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
  runInNewContext(compiled, { exports, process: { env }, URL })
  return exports
}

const dashboards = {
  stock: 'https://stock.webzoka.com/dashboard',
  lms: 'https://lms.webzoka.com/admin',
  pharmacy: 'https://pharmacy.webzoka.com/dashboard',
  rental: 'https://rent.webzoka.com/admin',
  clinic: 'https://clinic.webzoka.com/admin',
  laundry: 'https://laundry.webzoka.com/dashboard',
}
const stockSsoUrl = 'https://stock.webzoka.com/auth/webzoka?next=%2Fdashboard'
const flags = [undefined, 'false', 'true', '', 'TRUE', 'True', ' true', 'true ', '1']

for (const vercelEnv of [undefined, 'production', 'preview', 'development']) {
  for (const previewMode of [undefined, 'false', 'true']) {
    test(`Stock requires exact opt-in: VERCEL_ENV=${vercelEnv}, HUB_SSO_PREVIEW_MODE=${previewMode}`, () => {
      for (const flag of flags) {
        const { usesWebzokaSso, portalAccessUrl } = loadPortalUrls({
          NEXT_PUBLIC_WEBZOKA_SSO_ENABLED: flag,
          VERCEL_ENV: vercelEnv,
          HUB_SSO_PREVIEW_MODE: previewMode,
        })
        const enabled = flag === 'true'
        const message = `NEXT_PUBLIC_WEBZOKA_SSO_ENABLED=${JSON.stringify(flag)}`
        assert.equal(usesWebzokaSso('stock'), enabled, message)
        assert.equal(portalAccessUrl('stock'), enabled ? stockSsoUrl : dashboards.stock, message)
      }
    })
  }
}

test('Non-Stock platforms and unknown inputs never use SSO', () => {
  for (const flag of [undefined, 'false', 'true']) {
    const { usesWebzokaSso, portalAccessUrl } = loadPortalUrls({
      NEXT_PUBLIC_WEBZOKA_SSO_ENABLED: flag,
      VERCEL_ENV: 'production',
      WEBZOKA_STOCK_PORTAL_URL: 'https://stock-preview.example.test',
    })
    for (const platform of ['lms', 'pharmacy', 'rental', 'clinic', 'laundry', 'unknown', '', null, undefined]) {
      assert.equal(usesWebzokaSso(platform), false, String(platform))
      assert.equal(portalAccessUrl(platform), dashboards[platform] ?? null, String(platform))
    }
  }
})

test('portalDashboardUrl remains unchanged regardless of SSO and origin configuration', () => {
  for (const flag of [undefined, 'false', 'true']) {
    const { portalDashboardUrl } = loadPortalUrls({
      NEXT_PUBLIC_WEBZOKA_SSO_ENABLED: flag,
      VERCEL_ENV: 'production',
      WEBZOKA_STOCK_PORTAL_URL: 'https://stock-preview.example.test/path',
    })
    for (const [platform, expected] of Object.entries(dashboards)) {
      assert.equal(portalDashboardUrl(platform), expected, platform)
    }
    for (const platform of ['unknown', '', null, undefined]) {
      assert.equal(portalDashboardUrl(platform), null, String(platform))
    }
  }
})

for (const [configured, origin] of [
  [undefined, 'https://stock.webzoka.com'],
  ['', 'https://stock.webzoka.com'],
  ['https://stock-preview.example.test:8443/path?query=1#fragment', 'https://stock-preview.example.test:8443'],
  ['http://localhost:3000/path', 'http://localhost:3000'],
  ['http://stock-preview.example.test/path', 'https://stock.webzoka.com'],
  ['ftp://stock-preview.example.test/path', 'https://stock.webzoka.com'],
  ['not a URL', 'https://stock.webzoka.com'],
  ['/relative/path', 'https://stock.webzoka.com'],
]) {
  test(`Explicit SSO preserves Stock origin validation: ${JSON.stringify(configured)}`, () => {
    const { portalAccessUrl } = loadPortalUrls({
      NEXT_PUBLIC_WEBZOKA_SSO_ENABLED: 'true',
      WEBZOKA_STOCK_PORTAL_URL: configured,
    })
    assert.equal(portalAccessUrl('stock'), `${origin}/auth/webzoka?next=%2Fdashboard`)
  })
}

test('Configured Stock origin does not override the direct dashboard when SSO is off', () => {
  for (const flag of [undefined, 'false']) {
    const { portalAccessUrl } = loadPortalUrls({
      NEXT_PUBLIC_WEBZOKA_SSO_ENABLED: flag,
      VERCEL_ENV: 'production',
      WEBZOKA_STOCK_PORTAL_URL: 'https://stock-preview.example.test/path',
    })
    assert.equal(portalAccessUrl('stock'), dashboards.stock)
  }
})
