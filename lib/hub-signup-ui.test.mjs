import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))
const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
const jsx = (type, props) => ({ type, props })
function load(path, mocks, env = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    module: mod, exports: mod.exports, process: { env }, window: {},
    require(name) {
      if (name.endsWith('.module.css')) return css
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) })
      if (Object.hasOwn(mocks, name)) return mocks[name]
      throw new Error('Unexpected UI dependency: ' + name)
    },
  })
  return mod.exports
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
const text = tree => nodes(tree).flatMap(node => [node.props?.children].flat().filter(child => typeof child === 'string')).join(' ')
function harness({ state = { status: 'idle', message: null }, pending = false, verificationFailed = false, siteKey } = {}) {
  const refs = [], states = [], effects = []
  let refCursor = 0, stateCursor = 0, tree, capturedAction
  const action = () => { throw new Error('UI tests must not submit registration') }
  const react = {
    useActionState(fn) { capturedAction = fn; return [state, action, pending] },
    useRef(value) { const index = refCursor++; return refs[index] ??= { current: value } },
    useState(value) { const index = stateCursor++; if (!(index in states)) states[index] = value; return [states[index], update => { states[index] = typeof update === 'function' ? update(states[index]) : update }] },
    useEffect(effect) { effects.push(effect) },
  }
  const serverAction = Symbol('existing registration action')
  const api = load('app/hub/signup/HubSignupForm.tsx', {
    react, 'next/link': { __esModule: true, default: 'a' }, 'next/script': { __esModule: true, default: 'script' }, './actions': { signupToHub: serverAction },
  }, siteKey ? { NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey } : {})
  function render() { refCursor = 0; stateCursor = 0; effects.length = 0; tree = api.HubSignupForm({ verificationFailed }); return tree }
  render()
  return { render, refs, effects, get tree() { return tree }, action, get capturedAction() { return capturedAction }, serverAction }
}

test('signup UI preserves the registration action, required credentials, consent and honeypot', () => {
  const h = harness(), all = nodes(h.tree), form = all.find(node => node.type === 'form')
  assert.equal(h.capturedAction, h.serverAction)
  assert.equal(form.props.action, h.action)
  const inputs = all.filter(node => node.type === 'input')
  assert.deepEqual(inputs.map(node => node.props.name), ['website', 'name', 'email', 'password', 'password_confirmation', 'terms'])
  assert.equal(inputs[0].props.tabIndex, -1)
  for (const name of ['password', 'password_confirmation']) {
    const input = inputs.find(node => node.props.name === name)
    assert.equal(input.props.minLength, 12)
    assert.equal(input.props.maxLength, 72)
    assert.equal(input.props.autoComplete, 'new-password')
    assert.equal(input.props.required, true)
  }
  assert.equal(inputs.find(node => node.props.name === 'terms').props.required, true)
  assert.ok(!text(h.tree).includes('Pendaftaran akun tidak memulai'))
  assert.ok(!text(h.tree).includes('Area komponen verifikasi'))
})

test('password visibility is independent and mismatch prevents submission with focus', () => {
  const h = harness()
  nodes(h.tree).find(node => node.props?.['aria-controls'] === 'signup-password').props.onClick()
  h.render()
  const inputs = nodes(h.tree).filter(node => node.type === 'input')
  assert.equal(inputs.find(node => node.props.name === 'password').props.type, 'text')
  assert.equal(inputs.find(node => node.props.name === 'password_confirmation').props.type, 'password')
  let focused = false, prevented = false
  const password = { value: 'A unique password 123' }
  const confirmation = { name: 'password_confirmation', value: 'Different password 123', focus() { focused = true } }
  const form = nodes(h.tree).find(node => node.type === 'form')
  form.props.ref.current = { elements: { namedItem: name => name === 'password' ? password : confirmation } }
  form.props.onSubmit({ currentTarget: form.props.ref.current, preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(focused, true)
  assert.ok(text(h.render()).includes('Kata sandi belum sama'))
  confirmation.value = password.value
  prevented = false
  nodes(h.tree).find(node => node.type === 'form').props.onSubmit({ currentTarget: form.props.ref.current, preventDefault() { prevented = true } })
  assert.equal(prevented, false)
})

test('pending, server error, verification failure and success are separate accessible states', () => {
  const pending = nodes(harness({ pending: true }).tree).find(node => node.type === 'button' && node.props.type === 'submit')
  assert.equal(pending.props.disabled, true)
  assert.ok(text(pending).includes('Memproses pendaftaran'))
  for (const options of [{ state: { status: 'error', message: 'Generic registration failure' } }, { verificationFailed: true }]) {
    const h = harness(options), alert = nodes(h.tree).find(node => node.props?.role === 'alert')
    let focused = false
    alert.props.ref.current = { focus() { focused = true } }
    h.effects.forEach(effect => effect())
    assert.equal(focused, true)
    assert.ok(options.verificationFailed ? text(alert).includes('Tautan verifikasi tidak valid') : text(alert).includes(options.state.message))
  }
  const h = harness({ state: { status: 'success', message: 'Generic server-owned response' } })
  assert.ok(text(h.tree).includes('Generic server-owned response'))
  assert.ok(!nodes(h.tree).some(node => node.type === 'form'))
  assert.equal(nodes(h.tree).find(node => node.type === 'a').props.href, '/hub/login')
  let focused = false
  nodes(h.tree).find(node => node.type === 'h1').props.ref.current = { focus() { focused = true } }
  h.effects.forEach(effect => effect())
  assert.equal(focused, true)
})

test('configured security verification remains present, absent configuration adds no mock', () => {
  const configured = nodes(harness({ siteKey: 'synthetic-public-key' }).tree)
  const script = configured.find(node => node.type === 'script')
  assert.equal(script.props.src, 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')
  assert.ok(configured.some(node => node.props?.className === 'captcha'))
  assert.ok(!nodes(harness().tree).some(node => node.type === 'script'))
})

test('signup page preserves signed-in redirect and renders the approved deletions', async () => {
  const makePage = claims => load('app/hub/signup/page.tsx', {
    'next/image': { __esModule: true, default: 'img' }, 'next/link': { __esModule: true, default: 'a' },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT:' + path) } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims } }) } }) },
    './HubSignupForm': { HubSignupForm: 'signup-form' },
  }).default
  await assert.rejects(makePage({ sub: 'synthetic' })({ searchParams: Promise.resolve({}) }), /REDIRECT:\/hub\/account/)
  const tree = await makePage(null)({ searchParams: Promise.resolve({ error: 'verification_failed' }) })
  assert.equal(nodes(tree).find(node => node.type === 'signup-form').props.verificationFailed, true)
  assert.ok(text(tree).includes('Buat akun'))
  for (const deleted of ['Sudah menjadi pelanggan Webzoka?', 'Pratinjau desain', 'Area komponen verifikasi', 'Pembuatan akun tidak memulai trial']) assert.ok(!text(tree).includes(deleted))
  assert.deepEqual(plain(nodes(tree).filter(node => node.type === 'img').map(node => [node.props.src, node.props.width, node.props.height])), [['/logo-rocket.png', 44, 44]])
})
