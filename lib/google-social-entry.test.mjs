// Server-rendered form contracts only; hosted navigation and pending UI need browser acceptance.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const sandboxModule = { exports: {} }
  vm.runInNewContext(compiled, { module: sandboxModule, exports: sandboxModule.exports, process: { env: {} }, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), 'Unexpected UI import: ' + name)
    return dependencies[name]
  } })
  return sandboxModule.exports
}

function entry(enabled) {
  return load('../app/hub/login/GoogleSocialEntry.tsx', {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@/lib/google-social-release': { GOOGLE_SOCIAL_RUNTIME_ENABLED: enabled },
    './login.module.css': { __esModule: true, default: {} },
  }).GoogleSocialEntry
}

test('unreviewed release exposes no Google form on login or signup', () => {
  const release = load('./google-social-release.ts', {})
  assert.equal(release.GOOGLE_SOCIAL_RUNTIME_ENABLED, false)
  const Entry = entry(release.GOOGLE_SOCIAL_RUNTIME_ENABLED)
  for (const signup of [false, true]) {
    assert.equal(renderToStaticMarkup(React.createElement(Entry, { signup })), '')
  }
})

test('Google login uses a separate native POST and preserves consent continuation', () => {
  const Entry = entry(true)
  const next = '/oauth/consent?authorization_id=synthetic-authorization'
  const html = renderToStaticMarkup(React.createElement(Entry, { next }))
  const form = html.match(/<form\b[^>]*>/)?.[0] ?? ''
  assert.match(form, /method="post"/)
  assert.match(form, /action="\/api\/auth\/social\/google\/start"/)
  assert.match(html, /name="next" value="\/oauth\/consent\?authorization_id=synthetic-authorization"/)
  assert.match(html, /aria-describedby="google-login-notice"/)
  assert.match(html, /Akun Webzoka dibuat jika Anda belum memilikinya/)
  assert.doesNotMatch(html, /type="password"|provider_token|provider_refresh_token/)
})

test('Google signup returns to account and declares account creation separately from product access', () => {
  const Entry = entry(true)
  const html = renderToStaticMarkup(React.createElement(Entry, { signup: true }))
  assert.match(html, /name="next" value="\/hub\/account"/)
  assert.match(html, /aria-describedby="google-signup-notice"/)
  assert.match(html, /Akses layanan mengikuti izin akun Anda/)
  assert.match(html, /Atau daftar dengan email di bawah/)
})
