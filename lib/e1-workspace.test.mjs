// Local static and mock tests only. No Auth, database, payment or provider calls.
// Run: node --test lib/e1-workspace.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'
import crypto from 'node:crypto'
import * as zod from 'zod'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { approvedHubSource } from './hub-integration-contract.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'
const subject = '11111111-1111-4111-8111-111111111111'
const otherSubject = '44444444-4444-4444-8444-444444444444'
const companyId = '33333333-3333-4333-8333-333333333333'
const request = { companyName: 'New Business', idempotencyKey: '22222222-2222-4222-8222-222222222222' }
const user = { id: subject, email: 'customer@example.test', email_confirmed_at: '2026-10-01T00:00:00Z', is_anonymous: false }
const auth = (overrides = {}) => ({ data: { user: { ...user, ...overrides } }, error: null })
const registry = (overrides = {}) => ({ data: { observedSubject: subject, memberships: [], hasLegacyHistory: false, portalInstanceCount: 0, ...overrides }, error: null })
const membership = (overrides = {}) => ({ core_auth_user_id: subject, company_id: companyId, role: 'owner', status: 'active', company: { id: companyId, status: 'active' }, ...overrides })
const plain = (value) => JSON.parse(JSON.stringify(value))

// BEGIN_SHARED_E1_CODEC_VECTORS
// Read as JSON by the SQL structural suite; fixed expected bytes, not DB evidence.
const codecVectors = {
  "valid": [
    {
      "input": "New Business",
      "subject": "11111111-1111-4111-8111-111111111111",
      "key": "22222222-2222-4222-8222-222222222222",
      "name": "New Business",
      "nameHex": "4e657720427573696e657373",
      "scope": "7b77ee3f302afeb23b718ba36b2057d5e1b275abe713033f8587dc81bdd61627",
      "fingerprint": "2a9f240d6dfd08ed130f5c2da47067644282d00d807aed0262ef68c59e1e8506"
    },
    {
      "input": "  Café  ",
      "subject": "11111111-1111-4111-8111-111111111111",
      "key": "22222222-2222-4222-8222-222222222222",
      "name": "Café",
      "nameHex": "436166c3a9",
      "scope": "7b77ee3f302afeb23b718ba36b2057d5e1b275abe713033f8587dc81bdd61627",
      "fingerprint": "13ed00609fa767008dc67cae7f35ed70b5c69cf822aa7b4c6afe5045bb05fc30"
    },
    {
      "input": " AB ",
      "subject": "11111111-1111-4111-8111-111111111111",
      "key": "22222222-2222-4222-8222-222222222222",
      "name": "AB",
      "nameHex": "4142",
      "scope": "7b77ee3f302afeb23b718ba36b2057d5e1b275abe713033f8587dc81bdd61627",
      "fingerprint": "aad92a11ea379c3a01268990a007856e805d8be8f529b2b6781a12314cae5751"
    },
    {
      "input": "😀😀",
      "subject": "11111111-1111-4111-8111-111111111111",
      "key": "22222222-2222-4222-8222-222222222222",
      "name": "😀😀",
      "nameHex": "f09f9880f09f9880",
      "scope": "7b77ee3f302afeb23b718ba36b2057d5e1b275abe713033f8587dc81bdd61627",
      "fingerprint": "94ea0206caec571dafcd4a3f69b8c2edcb8a023d50fc304b08151c49fd64cf63"
    },
    {
      "input": "A\"\\\u2028B",
      "subject": "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB",
      "key": "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      "name": "A\"\\\u2028B",
      "nameHex": "41225ce280a842",
      "scope": "03fa93a03adeb539c79bd8fef1c952d3d034aa62e9525161c8bbbdbb9b7997d7",
      "fingerprint": "d95926e9202fcb05e5452648dd53e2b9122931a0ed4820cf8485358fced6e75a"
    },
    {
      "input": "😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀",
      "subject": "11111111-1111-4111-8111-111111111111",
      "key": "22222222-2222-4222-8222-222222222222",
      "name": "😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀",
      "nameHex": "f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880f09f9880",
      "scope": "7b77ee3f302afeb23b718ba36b2057d5e1b275abe713033f8587dc81bdd61627",
      "fingerprint": "cd8f21329d640735bb90b3d3991620b1192226aebfddb24745384c13584d7046"
    },
    {
      "input": "\t\n\u000b\f\r              \u2028\u2029  　﻿AB﻿ ",
      "subject": "11111111-1111-4111-8111-111111111111",
      "key": "22222222-2222-4222-8222-222222222222",
      "name": "AB",
      "nameHex": "4142",
      "scope": "7b77ee3f302afeb23b718ba36b2057d5e1b275abe713033f8587dc81bdd61627",
      "fingerprint": "aad92a11ea379c3a01268990a007856e805d8be8f529b2b6781a12314cae5751"
    }
  ],
  "invalidNames": [
    "",
    " ",
    "A",
    "😀",
    "A\tB",
    "A\nB",
    "A\u0000B",
    "AB",
    "AB",
    "😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀",
    null,
    42,
    "  "
  ],
  "invalidKeys": [
    "retry",
    "22222222222242228222222222222222",
    "{22222222-2222-4222-8222-222222222222}",
    "22222222-2222-4222-2222-222222222222",
    "22222222-2222-9222-8222-222222222222",
    "00000000-0000-0000-0000-000000000000",
    null
  ]
}
// END_SHARED_E1_CODEC_VECTORS

function harness(options = {}) {
  const calls = []
  const digests = []
  const correlations = []
  const testModule = { exports: {} }
  const source = options.source ?? readFileSync(join(root, 'lib/e1-workspace.ts'), 'utf8')
  // Test-only access to private internals; production exports remain unchanged.
  // These mocks prove local refusal, not provider revocation or real SQL locks.
  const testSource = source + `\nmodule.exports.transportTests = {
    requirements: e1TransportRequirements,
    verify: async () => verifyE1CoreActor(await createClient()),
    correlate: createE1Correlation,
    adapter: restrictedE1WriterAdapter,
  };`
  const compiled = ts.transpileModule(testSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const unexpected = (operation) => {
    calls.push(operation)
    throw new Error(`Forbidden operation: ${operation}`)
  }
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports, Buffer,
    process: { env: { E1_ENABLED: 'true', E1_WRITER_APPROVED: 'true', HUB_PREVIEW_MODE: 'true', NODE_ENV: 'development' } },
    require: (name) => {
      if (name === 'server-only') return {}
      if (name === 'node:crypto') return { ...crypto,
        randomUUID: () => { const value = crypto.randomUUID(); correlations.push(value); return value },
        sign: () => unexpected('crypto.sign'), createSign: () => unexpected('crypto.createSign'),
        createHmac: () => unexpected('crypto.createHmac'), createHash: (...args) => {
        const hash = crypto.createHash(...args)
        const update = hash.update.bind(hash)
        hash.update = (value, encoding) => { digests.push(value); return update(value, encoding) }
        return hash
      } }
      if (name === 'zod') return zod
      if (name === '@/lib/superadmin') return { isSuperadminEmail: (email) => email === options.operatorEmail }
      if (name === '@/lib/supabase/server') return { createClient: async () => {
        calls.push('createClient')
        if (options.throwClient) throw new Error('Sensitive client error must not escape')
        return {
          auth: {
            getUser: async () => {
              calls.push('getUser')
              if (options.throwAuth) throw new Error('Sensitive Auth error must not escape')
              if (options.authResults) return options.authResults.shift()
              return Object.hasOwn(options, 'authResult') ? options.authResult : auth()
            },
            getClaims: async () => {
              calls.push('getClaims')
              if (options.throwClaims) throw new Error('Sensitive claims error must not escape')
              if (options.claimsResults) return options.claimsResults.shift()
              return Object.hasOwn(options, 'claimsResult') ? options.claimsResult : { data: { claims: { sub: subject, user_role: 'member' } }, error: null }
            },
            signUp: () => unexpected('signUp'),
            admin: new Proxy({}, { get: () => unexpected('auth.admin') }),
          },
          from: (table) => {
            assert.ok(['tenant_members', 'tenants', 'customer_onboarding'].includes(table))
            return { insert: () => unexpected(`insert:${table}`),
              update: () => unexpected(`update:${table}`), delete: () => unexpected(`delete:${table}`),
              upsert: () => unexpected(`upsert:${table}`), select: (columns, config) => {
              assert.equal(columns, table === 'tenant_members' ? 'user_id' : 'owner_user_id')
              assert.deepEqual(plain(config), { count: 'exact', head: true })
              return { eq: (column, value) => {
                calls.push(`read:${table}:${column}:${value}`)
                assert.equal(column, columns)
                assert.equal(value, subject)
                if (options.throwHistory) throw new Error('Sensitive history error')
                return Promise.resolve(Object.hasOwn(options.countResults ?? {}, table) ? options.countResults[table] : { error: null, count: 0 })
              } }
            } }
          },
          rpc: () => unexpected('database.rpc'),
        }
      } }
      return unexpected(`import:${name}`)
    },
  }, { filename: 'e1-workspace.ts' })
  return { api: testModule.exports, calls, digests, correlations }
}

function failClosed(result) {
  assert.equal(result.enabled, false)
  assert.equal(result.writesPermitted, false)
  assert.deepEqual(plain(result.hub), {
    accessReady: false, company: null, role: null, workspaceFee: 0,
    systems: [], subscriptions: [], invoices: [], payments: [], trialEndsAt: null,
    manageSubscriptionUrl: null, canSubscribe: false,
  })
  assert.ok(!JSON.stringify(result).includes(user.email))
  assert.equal(result.creationContract, null)
  assert.deepEqual(plain(result.reviewRequired), ['REVIEW_REQUIRED_IDENTITY_TRANSPORT', 'REVIEW_REQUIRED_LEGACY_PROVENANCE', 'REVIEW_REQUIRED_CODEC_INTEGRATION'])
}

test('partial negative observations cannot propose a new Company or prove clean E1 eligibility', () => {
  const { api } = harness()
  const result = api.assessE1WorkspaceContract(request, auth(), registry())
  failClosed(result)
  assert.equal(result.status, 'blocked')
  assert.equal(result.code, 'REVIEW_REQUIRED_LEGACY_PROVENANCE')
  assert.equal(result.disposition, null)
})

test('duplicate requests have stable subject-scoped identity and fingerprint, with no persistence', () => {
  const { api, calls } = harness()
  const first = plain(api.encodeE1WorkspaceRequest(subject, request))
  const second = plain(api.encodeE1WorkspaceRequest(subject, request))
  assert.deepEqual(first, second)
  assert.deepEqual(calls, [])
})

test('changed-payload retry keeps request scope and changes fingerprint for future conflict rejection', () => {
  const { api } = harness()
  const first = api.encodeE1WorkspaceRequest(subject, request)
  const changed = api.encodeE1WorkspaceRequest(subject, { ...request, companyName: 'Another Business' })
  assert.equal(first.requestScope, changed.requestScope)
  assert.notEqual(first.payloadFingerprint, changed.payloadFingerprint)
  assert.equal(Object.hasOwn(changed, 'writesPermitted'), false)
})

test('same client key across different verified subjects cannot share request scope', () => {
  const { api } = harness()
  const first = api.encodeE1WorkspaceRequest(subject, request)
  const foreign = api.encodeE1WorkspaceRequest(otherSubject, request)
  assert.notEqual(first.requestScope, foreign.requestScope)
  assert.notEqual(first.payloadFingerprint, foreign.payloadFingerprint)
  assert.equal(foreign.coreAuthSubject, otherSubject)
})

test('normalized whitespace, Unicode and UUID case give a stable canonical retry', () => {
  const { api } = harness()
  const canonical = { companyName: 'Café', idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
  const equivalent = { companyName: '  Cafe\u0301  ', idempotencyKey: canonical.idempotencyKey.toUpperCase() }
  assert.deepEqual(plain(api.encodeE1WorkspaceRequest(subject, canonical)), plain(api.encodeE1WorkspaceRequest(subject, equivalent)))
})

const invalidRequests = [
  ['missing fields', {}], ['null input', null], ['array input', [request]],
  ['blank name', { ...request, companyName: '   ' }],
  ['short name', { ...request, companyName: 'A' }],
  ['oversized name', { ...request, companyName: 'A'.repeat(101) }],
  ['control characters', { ...request, companyName: 'Business\u0000Name' }],
  ['invalid idempotency key', { ...request, idempotencyKey: 'retry' }],
]
for (const field of ['owner_user_id', 'actorId', 'coreAuthSubject', 'company_id', 'companyId', 'tenant_id', 'role', 'plan_id', 'product', 'email', 'email_confirmed_at', 'is_anonymous', 'password', 'document', 'writerApproved', 'privilegedContext', 'source_ref', 'requestScope', 'payloadFingerprint', 'registryResponse', 'subject', 'proofFlag', 'operatorContext', 'authorizationOverride', 'activateTransport', 'transport', 'postLock', 'session_id', 'sourceRef', 'provenance', 'independentlyAuthenticated']) {
  invalidRequests.push([`forbidden client field ${field}`, { ...request, [field]: 'untrusted' }])
}
for (const [name, input] of invalidRequests) {
  test(`${name}: rejected before Auth or any database operation`, async () => {
    const { api, calls } = harness()
    const result = await api.getE1WorkspaceCandidate(input)
    failClosed(result)
    assert.equal(result.code, 'invalid_request')
    assert.equal(result.creationContract, null)
    assert.deepEqual(calls, [])
  })
}

const invalidAuth = [
  ['missing user', { data: { user: null }, error: null }],
  ['claims-only identity', { data: { claims: { sub: subject, email: user.email, user_role: 'owner' } }, error: null }],
  ['Auth error with partial user', { ...auth(), error: { message: 'Session revoked' } }],
  ['missing Auth error field', { data: { user } }],
  ['missing confirmed email', auth({ email_confirmed_at: null })],
  ['invalid confirmation timestamp', auth({ email_confirmed_at: 'confirmed' })],
  ['future confirmation timestamp', auth({ email_confirmed_at: '2999-01-01T00:00:00Z' })],
  ['anonymous user', auth({ is_anonymous: true })],
  ['ambiguous anonymous status', auth({ is_anonymous: undefined })],
  ['invalid subject', auth({ id: 'same-email' })],
  ['empty subject', auth({ id: '' })],
  ['missing email', auth({ email: undefined })],
  ['malformed email', auth({ email: 'not-an-email' })],
]
for (const [name, response] of invalidAuth) {
  test(`${name}: no Company proposal or live write`, async () => {
    const { api, calls } = harness({ authResult: response })
    const result = await api.getE1WorkspaceCandidate(request)
    failClosed(result)
    assert.equal(result.status, 'rejected')
    assert.equal(result.creationContract, null)
    assert.deepEqual(calls, ['createClient', 'getUser'])
    assert.equal(api.assessE1WorkspaceContract(request, response, registry()).creationContract, null)
  })
}

for (const option of ['throwClient', 'throwAuth']) {
  test(`${option}: generic fail-closed error, no privileged operations`, async () => {
    const { api, calls } = harness({ [option]: true })
    const result = await api.getE1WorkspaceCandidate(request)
    failClosed(result)
    assert.equal(result.code, 'core_auth_verification_failed')
    assert.ok(!JSON.stringify(result).includes('Sensitive'))
    assert.ok(calls.every((call) => ['createClient', 'getUser'].includes(call)))
  })
}

const unsafeRegistry = [
  ['foreign observation subject', registry({ observedSubject: otherSubject })],
  ['unbound observation', registry({ observedSubject: undefined })],
  ['missing observation', null],
  ['query error with partial data', { ...registry(), error: { message: 'Denied' } }],
  ['missing query error field', { data: registry().data }],
  ['duplicate memberships', registry({ memberships: [membership(), membership()] })],
  ['multiple Companies', registry({ memberships: [membership(), membership({ company_id: otherSubject, company: { id: otherSubject, status: 'active' } })] })],
  ['foreign Auth membership', registry({ memberships: [membership({ core_auth_user_id: otherSubject })] })],
  ['mismatched Company join', registry({ memberships: [membership({ company: { id: otherSubject, status: 'active' } })] })],
  ['revoked membership', registry({ memberships: [membership({ status: 'revoked' })] })],
  ['inactive Company', registry({ memberships: [membership({ company: { id: companyId, status: 'inactive' } })] })],
  ['retired Company', registry({ memberships: [membership({ company: { id: companyId, status: 'retired' } })] })],
  ['operator role', registry({ memberships: [membership({ role: 'superadmin' })] })],
  ['missing Company', registry({ memberships: [membership({ company: null })] })],
  ['legacy history', registry({ hasLegacyHistory: true })],
  ['existing portal history without membership', registry({ portalInstanceCount: 1 })],
  ['unknown portal history', registry({ portalInstanceCount: undefined })],
]
for (const [name, response] of unsafeRegistry) {
  test(`${name}: HOLD with no Company identity, Owner proposal or token`, () => {
    const { api } = harness()
    const result = api.assessE1WorkspaceContract(request, auth(), response)
    failClosed(result)
    assert.equal(result.status, 'hold')
    assert.equal(result.disposition, null)
    assert.equal(result.creationContract, null)
  })
}

for (const role of ['owner', 'admin', 'member']) {
  test(`one exact existing ${role} membership never creates another Company or promotes Owner`, () => {
    const { api } = harness()
    const result = api.assessE1WorkspaceContract(request, auth(), registry({ memberships: [membership({ role })] }))
    failClosed(result)
    assert.equal(result.status, 'blocked')
    assert.equal(result.disposition, 'existing_company')
    assert.equal(result.creationContract, null)
  })
}

test('current verified Core account remains blocked without an approved Registry read/writer/audit', async () => {
  const { api, calls } = harness({ authResult: auth({ user_metadata: { role: 'owner' }, app_metadata: { role: 'superadmin' } }) })
  const result = await api.getE1WorkspaceCandidate(request)
  failClosed(result)
  assert.equal(result.code, 'REVIEW_REQUIRED_LEGACY_PROVENANCE')
  assert.equal(result.creationContract, null)
  assert.deepEqual(calls, ['createClient', 'getUser', 'getClaims',
    `read:tenant_members:user_id:${subject}`, `read:tenants:owner_user_id:${subject}`,
    `read:customer_onboarding:owner_user_id:${subject}`, 'getUser', 'getClaims'])
})

test('concurrent repeated requests remain blocked with zero records or product side effects', async () => {
  const { api, calls } = harness()
  const results = await Promise.all([api.getE1WorkspaceCandidate(request), api.getE1WorkspaceCandidate(request)])
  results.forEach(failClosed)
  assert.deepEqual(plain(results[0]), plain(results[1]))
  assert.equal(calls.filter((call) => call === 'createClient').length, 2)
  assert.equal(calls.filter((call) => call === 'getUser').length, 4)
  assert.equal(calls.filter((call) => call.startsWith('read:')).length, 6)
})

for (const [index, vector] of codecVectors.valid.entries()) {
  test(`shared codec vector ${index}: normalized scalars, UUID case and fixed UTF-8 digests`, () => {
    const { api, calls } = harness()
    const actual = api.encodeE1WorkspaceRequest(vector.subject, { companyName: vector.input, idempotencyKey: vector.key })
    assert.equal(actual.codecVersion, 'e1:v2')
    assert.equal(actual.companyName, vector.name)
    assert.equal(Buffer.from(actual.companyName, 'utf8').toString('hex'), vector.nameHex)
    assert.equal(actual.requestScope, vector.scope)
    assert.equal(actual.payloadFingerprint, vector.fingerprint)
    assert.deepEqual(calls, [])
  })
}

for (const [index, name] of [...codecVectors.invalidNames, `A${String.fromCharCode(0xd800)}B`, `A${String.fromCharCode(0xdfff)}B`].entries()) {
  test(`shared invalid name ${index}: reject before Auth, including unpaired surrogates`, async () => {
    const { api, calls } = harness()
    assert.throws(() => api.encodeE1WorkspaceRequest(subject, { ...request, companyName: name }))
    const result = await api.getE1WorkspaceCandidate({ ...request, companyName: name })
    failClosed(result)
    assert.equal(result.code, 'invalid_request')
    assert.deepEqual(calls, [])
  })
}

for (const [index, key] of codecVectors.invalidKeys.entries()) {
  test(`shared invalid key ${index}: reject noncanonical UUID syntax/version/variant`, () => {
    const { api } = harness()
    assert.throws(() => api.encodeE1WorkspaceRequest(subject, { ...request, idempotencyKey: key }))
  })
}

test('UUID terminator whitespace cannot exploit the regular-expression end anchor', () => {
  const { api } = harness()
  for (const ending of ['\n', '\r\n', ' ', '\u00a0']) {
    assert.throws(() => api.encodeE1WorkspaceRequest(subject, { ...request, idempotencyKey: request.idempotencyKey + ending }))
    assert.throws(() => api.encodeE1WorkspaceRequest(subject + ending, request))
  }
})

test('caller completeness flags cannot close cross-writer or pending-claim uncertainty', () => {
  const { api } = harness()
  const result = api.assessE1WorkspaceContract(request, auth(), registry({
    legacyComplete: true, crossWriterLocked: true, pendingClaimsClear: true, writerApproved: true,
  }))
  failClosed(result)
  assert.equal(result.code, 'REVIEW_REQUIRED_LEGACY_PROVENANCE')
  assert.equal(result.disposition, null)
})

for (const table of ['tenant_members', 'tenants', 'customer_onboarding']) {
  test(`${table}: any historical association excludes E1 regardless of active or pending status`, async () => {
    const { api, calls } = harness({ countResults: { [table]: { error: null, count: 1 } } })
    const result = await api.getE1WorkspaceCandidate(request)
    failClosed(result)
    assert.equal(result.status, 'hold')
    assert.equal(result.code, 'legacy_or_conflicting_history')
    assert.ok(calls.includes(`read:${table}:${table === 'tenant_members' ? 'user_id' : 'owner_user_id'}:${subject}`))
  })
  for (const [name, response] of [
    ['RLS/query error with zero count', { error: { message: 'Denied' }, count: 0 }],
    ['unknown count', { error: null, count: null }],
    ['missing error', { count: 0 }], ['partial count', { error: null }],
  ]) {
    test(`${table} ${name}: never interpreted as clean provenance`, async () => {
      const { api } = harness({ countResults: { [table]: response } })
      const result = await api.getE1WorkspaceCandidate(request)
      failClosed(result)
      assert.equal(result.code, 'core_history_observation_unavailable')
    })
  }
}

for (const [name, options] of [
  ['internal operator claim', { claimsResult: { data: { claims: { sub: subject, user_role: 'superadmin' } }, error: null } }],
  ['internal operator email', { operatorEmail: user.email }],
  ['foreign claims subject', { claimsResult: { data: { claims: { sub: otherSubject } }, error: null } }],
  ['unverified claims', { claimsResult: { data: { claims: { sub: subject } }, error: { message: 'Denied' } } }],
  ['missing claims', { claimsResult: { data: null, error: null } }],
]) {
  test(`${name}: gateway denies before history lookups`, async () => {
    const { api, calls } = harness(options)
    const result = await api.getE1WorkspaceCandidate(request)
    failClosed(result)
    assert.equal(result.status, 'rejected')
    assert.ok(!calls.some((call) => call.startsWith('read:')))
  })
}

for (const changed of [auth({ id: otherSubject }), auth({ email_confirmed_at: null }), auth({ email_confirmed_at: '2026-09-30T00:00:00Z' }), auth({ is_anonymous: true }), auth({ email: 'changed@example.test' }), { data: { user: null }, error: null }, { ...auth(), error: { message: 'Session revoked' } }]) {
  test('revoked or changed post-read Auth identity denies before any Company proposal', async () => {
    const { api } = harness({ authResults: [auth(), changed] })
    const result = await api.getE1WorkspaceCandidate(request)
    failClosed(result)
    assert.equal(result.code, 'core_session_identity_changed')
  })
}

test('history exception is generic and cannot leak data or invoke privileged operations', async () => {
  const { api } = harness({ throwHistory: true })
  const result = await api.getE1WorkspaceCandidate(request)
  failClosed(result)
  assert.equal(result.code, 'core_auth_verification_failed')
  assert.ok(!JSON.stringify(result).includes('Sensitive'))
})

test('extra function arguments cannot inject another actor, Registry proof or clean eligibility', async () => {
  const { api, calls } = harness({ authResult: { data: { user: null }, error: null } })
  const result = await api.getE1WorkspaceCandidate(request, auth(), registry())
  failClosed(result)
  assert.equal(result.code, 'verified_core_account_required')
  assert.deepEqual(calls, ['createClient', 'getUser'])
})

test('gateway binds canonical bytes to fresh server identity while returning no creation authority', async () => {
  const { api, digests } = harness()
  const result = await api.getE1WorkspaceCandidate({ ...request, companyName: '  Cafe\u0301  ' })
  failClosed(result)
  assert.deepEqual(digests, [
    `e1:v2:scope:${subject}:${request.idempotencyKey}`,
    `e1:v2:payload:${subject}:436166c3a9`,
  ])
  assert.equal(Object.hasOwn(result, 'canonical'), false)
  assert.equal(result.code, 'REVIEW_REQUIRED_LEGACY_PROVENANCE')
})

async function transportFixture(options = {}) {
  const fixture = harness(options)
  const transport = fixture.api.transportTests
  const initial = await transport.verify()
  const afterWait = await transport.verify()
  assert.equal(initial.ok, true)
  assert.equal(afterWait.ok, true)
  const canonical = fixture.api.encodeE1WorkspaceRequest(subject, request)
  const source = transport.correlate(canonical)
  return { ...fixture, transport, initial: initial.actor, afterWait: afterWait.actor, source }
}

test('private transport requirements distinguish fresh Auth, correlation, revocation and invocation authority', () => {
  const { api } = harness()
  const requirements = api.transportTests.requirements
  assert.equal(Object.isFrozen(requirements), true)
  assert.deepEqual(plain(requirements), {
    actorVerification: 'fresh_cookie_bound_auth.getUser',
    confirmedNonAnonymousCustomerRequired: true,
    correlationIsAuthenticatedProvenance: false,
    authenticatedRequestToConnectionBinding: 'NOT_IMPLEMENTED',
    sameActorAndSourceRequired: 'initial_after_wait_and_post_lock',
    freshAuthAndOperatorRecheckRequired: 'after_every_wait_and_after_lock',
    sessionContinuityAndRevocation: 'NOT_PROVEN',
    maximumSessionAgePolicy: 'NOT_APPROVED',
    postLockRevalidation: 'NOT_IMPLEMENTED',
    postgresContinuityEnforcement: 'NOT_PROVEN',
    restrictedWriterInvocationAuthority: 'NOT_APPROVED',
    writerEnabled: false,
  })
})

test('fresh valid Core Auth and server UUID correlation cannot activate the restricted adapter', async () => {
  const { transport, initial, afterWait, source, calls } = await transportFixture()
  const result = transport.adapter(initial, afterWait, source, source,
    undefined, { writerApproved: true, activateTransport: true, serviceKey: 'untrusted' })
  failClosed(result)
  assert.equal(result.code, 'REVIEW_REQUIRED_IDENTITY_TRANSPORT')
  assert.equal(source.kind, 'server_generated_correlation_only')
  assert.equal(source.independentlyAuthenticated, false)
  assert.equal(Object.isFrozen(source), true)
  assert.equal(Object.isFrozen(initial), true)
  assert.deepEqual(calls, ['createClient', 'getUser', 'getClaims', 'createClient', 'getUser', 'getClaims'])
  for (const sensitive of ['sourceRef', source.sourceRef, subject, user.email, 'serviceKey']) {
    assert.ok(!JSON.stringify(result).includes(sensitive))
  }
})

for (const [name, response] of invalidAuth) {
  test(`transport ${name}: no privately verified actor is issued (mock Auth only)`, async () => {
    const { api, calls } = harness({ authResult: response })
    assert.deepEqual(plain(await api.transportTests.verify()), { ok: false, code: 'verified_core_account_required' })
    assert.deepEqual(calls, ['createClient', 'getUser'])
  })
}

for (const [name, alter] of [
  ['missing initial actor', (fixture) => [undefined, fixture.afterWait]],
  ['missing current actor', (fixture) => [fixture.initial, undefined]],
  ['copied actor with asserted verification', (fixture) => [{ ...fixture.initial, verified: true }, fixture.afterWait]],
  ['reused initial check instead of fresh verification', (fixture) => [fixture.initial, fixture.initial]],
]) {
  test(`${name}: private adapter rejects forged or absent identity`, async () => {
    const fixture = await transportFixture()
    const result = fixture.transport.adapter(...alter(fixture), fixture.source, fixture.source)
    failClosed(result)
    assert.equal(result.code, 'core_session_identity_changed')
  })
}

for (const [name, replaceSource] of [
  ['missing source', () => undefined],
  ['client UUID and proof flags', (fixture) => ({ ...fixture.source, independentlyAuthenticated: true, writerApproved: true })],
  ['copied correlation', (fixture) => ({ ...fixture.source })],
  ['changed source reference', (fixture) => ({ ...fixture.source, sourceRef: companyId })],
  ['new server correlation after waiting', (fixture) => fixture.transport.correlate(fixture.api.encodeE1WorkspaceRequest(subject, request))],
]) {
  test(`${name}: untrusted or discontinuous source_ref denies transport`, async () => {
    const fixture = await transportFixture()
    const result = fixture.transport.adapter(fixture.initial, fixture.afterWait, fixture.source, replaceSource(fixture))
    failClosed(result)
    assert.equal(result.code, 'untrusted_or_changed_source_ref')
  })
}

test('server correlation for another actor cannot substitute for request provenance', async () => {
  const fixture = await transportFixture()
  const foreign = fixture.transport.correlate(fixture.api.encodeE1WorkspaceRequest(otherSubject, request))
  const result = fixture.transport.adapter(fixture.initial, fixture.afterWait, foreign, foreign)
  failClosed(result)
  assert.equal(result.code, 'untrusted_or_changed_source_ref')
})

for (const [name, postLock] of [
  ['matching hypothetical post-lock check', async (fixture) => ({ actor: (await fixture.transport.verify()).actor, source: fixture.source })],
  ['changed post-lock source', async (fixture) => ({ actor: (await fixture.transport.verify()).actor, source: { ...fixture.source, sourceRef: companyId } })],
  ['replayed pre-lock actor', async (fixture) => ({ actor: fixture.afterWait, source: fixture.source })],
  ['missing post-lock actor', async (fixture) => ({ source: fixture.source })],
]) {
  test(`${name}: local post-lock contract cannot authorize or claim a real lock`, async () => {
    const fixture = await transportFixture()
    const result = fixture.transport.adapter(fixture.initial, fixture.afterWait, fixture.source, fixture.source, await postLock(fixture))
    failClosed(result)
    assert.equal(result.code, name.startsWith('matching') ? 'REVIEW_REQUIRED_IDENTITY_TRANSPORT' : 'post_lock_actor_or_source_changed')
    assert.ok(fixture.calls.every((call) => ['createClient', 'getUser', 'getClaims'].includes(call)))
  })
}

test('inconsistent privately observed post-lock actor denies (mock continuity, no provider lock)', async () => {
  const fixture = await transportFixture({ authResults: [auth(), auth(), auth({ email: 'changed@example.test' })] })
  const postLock = { actor: (await fixture.transport.verify()).actor, source: fixture.source }
  const result = fixture.transport.adapter(fixture.initial, fixture.afterWait, fixture.source, fixture.source, postLock)
  failClosed(result)
  assert.equal(result.code, 'post_lock_actor_or_source_changed')
})

for (const claims of [
  { data: { claims: { sub: subject, user_role: 'superadmin' } }, error: null },
  { data: { claims: { sub: subject, user_role: 'admin' } }, error: null },
  { data: { claims: { sub: otherSubject, user_role: 'member' } }, error: null },
  { data: { claims: { sub: subject } }, error: { message: 'Session revoked' } },
]) {
  test('post-wait claims or operator change denies transport before any writer (mock Auth only)', async () => {
    const { api, calls } = harness({ claimsResults: [{ data: { claims: { sub: subject, user_role: 'member' } }, error: null }, claims] })
    const result = await api.getE1WorkspaceCandidate(request)
    failClosed(result)
    assert.equal(result.code, 'core_session_identity_changed')
    assert.equal(calls.filter((call) => call === 'getClaims').length, 2)
    assert.ok(!calls.some((call) => /rpc|sign|insert|update|delete|upsert/.test(call)))
  })
}

test('claims exception fails closed without exposing provider errors or secrets', async () => {
  const { api, calls } = harness({ throwClaims: true })
  const result = await api.getE1WorkspaceCandidate(request)
  failClosed(result)
  assert.equal(result.code, 'core_auth_verification_failed')
  assert.deepEqual(calls, ['createClient', 'getUser', 'getClaims'])
})

test('same actor with ambiguous session continuity remains blocked, never inferred from matching UUIDs', async () => {
  const fixture = await transportFixture({ claimsResults: [
    { data: { claims: { sub: subject, user_role: 'member', session_id: request.idempotencyKey } }, error: null },
    { data: { claims: { sub: subject, user_role: 'member', session_id: companyId } }, error: null },
  ] })
  const result = fixture.transport.adapter(fixture.initial, fixture.afterWait, fixture.source, fixture.source)
  failClosed(result)
  assert.equal(result.code, 'REVIEW_REQUIRED_IDENTITY_TRANSPORT')
  assert.equal(fixture.transport.requirements.sessionContinuityAndRevocation, 'NOT_PROVEN')
  // Hypothetical claims are mock inputs only; no session bridge consumes them.
  assert.equal(Object.hasOwn(fixture.initial, 'session_id'), false)
})

test('request correlation generated once and never returned, with no signer/RPC/mutation', async () => {
  const { api, calls, correlations } = harness()
  const result = await api.getE1WorkspaceCandidate(request)
  failClosed(result)
  assert.equal(correlations.length, 1)
  assert.ok(!JSON.stringify(result).includes(correlations[0]))
  assert.equal(calls.filter((call) => call === 'getUser').length, 2)
  assert.equal(calls.filter((call) => call === 'getClaims').length, 2)
  assert.ok(!calls.some((call) => /rpc|sign|insert|update|delete|upsert/.test(call)))
})

function assertDisabledTransportSource(source) {
  assert.match(source, /^import 'server-only'/)
  assert.ok(!source.includes('process.env'))
  assert.ok(!/['"]use server['"]/.test(source))
  const tree = ts.createSourceFile('e1-workspace.ts', source, ts.ScriptTarget.Latest, true)
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      assert.ok([
        'server-only', 'node:crypto', 'zod', '@/lib/supabase/server', '@/lib/superadmin',
      ].includes(node.moduleSpecifier.text))
      if (node.moduleSpecifier.text === 'node:crypto') {
        assert.ok(ts.isNamedImports(node.importClause.namedBindings))
        for (const binding of node.importClause.namedBindings.elements) {
          assert.ok(['createHash', 'randomUUID'].includes((binding.propertyName ?? binding.name).text))
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression
      // SHA-256 byte updates are not database mutations. Only this exact
      // imported hash constructor is exempt; arbitrary .update() still denies.
      const hashUpdate = node.expression.name.text === 'update' && ts.isCallExpression(receiver) &&
        ts.isIdentifier(receiver.expression) && receiver.expression.text === 'createHash' &&
        receiver.arguments.length === 1 && ts.isStringLiteral(receiver.arguments[0]) &&
        receiver.arguments[0].text === 'sha256'
      assert.ok(hashUpdate || !['rpc', 'insert', 'update', 'delete', 'upsert', 'sign', 'signUp'].includes(node.expression.name.text))
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
}

test('adapter remains private, server-only, unwired and has no activation/privileged import', () => {
  const source = readFileSync(join(root, 'lib/e1-workspace.ts'), 'utf8')
  const { api } = harness()
  assert.deepEqual(Object.keys(api).filter((key) => key !== 'transportTests').sort(), [
    'E1_CODEC_VERSION', 'assessE1WorkspaceContract', 'e1WorkspaceRequestSchema',
    'encodeE1WorkspaceRequest', 'getE1WorkspaceCandidate',
  ])
  assertDisabledTransportSource(source)
})

for (const operation of ["db.rpc('writer')", "db.from('companies').insert({})", "db.from('companies').update({})", "db.from('companies').delete()", "db.from('companies').upsert({})", "crypto.sign('sha256', Buffer.from('data'), 'key')"]) {
  test(`source scanner rejects ${operation} while allowing SHA-256 byte updates`, () => {
    const source = readFileSync(join(root, 'lib/e1-workspace.ts'), 'utf8')
    assert.throws(() => assertDisabledTransportSource(source + `\n${operation};`))
  })
}

test('detached UI has accessible disabled controls and neutral zero-product states, with no submission path', () => {
  const source = readFileSync(join(root, 'app/hub/_components/E1WorkspaceCandidate.tsx'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const testModule = { exports: {} }
  vm.runInNewContext(compiled, { module: testModule, exports: testModule.exports, require: (name) => {
    assert.equal(name, 'react/jsx-runtime')
    return jsxRuntime
  } })
  const html = renderToStaticMarkup(testModule.exports.default())
  assert.match(html, /Pendaftaran workspace baru belum tersedia/)
  assert.match(html, /<fieldset[^>]*disabled=""/)
  assert.match(html, /<label for="e1-company-name"/)
  assert.match(html, /<input[^>]*disabled=""/)
  assert.match(html, /<button[^>]*type="button"[^>]*disabled=""/)
  assert.match(html, /Sistem Saya/)
  assert.match(html, /Tidak ada tagihan workspace atau langganan produk/)
  assert.match(html, /grid-cols-1.*md:grid-cols-2/)
  assert.ok(!/<form|href=|action=|type="file"|type="password"|token=/i.test(html))
})

const frozenLegacyFiles = ['supabase/migrations/core_db/019_customer_onboarding.sql', 'lib/customer-onboarding.ts', 'vercel.json', 'lib/billing-link.ts', 'package.json', 'package-lock.json']
const gitText = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).replaceAll('\r\n', '\n')
const readSource = (file) => readFileSync(join(root, file), 'utf8').replaceAll('\r\n', '\n')
const baselineSources = new Map()
function baselineSource(file) {
  if (!baselineSources.has(file)) baselineSources.set(file, gitText('show', `${baseline}:${file}`))
  return baselineSources.get(file)
}

function assertPreservedHubContract(read) {
  for (const file of frozenLegacyFiles) assert.equal(read(file), baselineSource(file), file)
  // Step 3 allows only preservation of the workspace return path on login.
  assert.equal(read('proxy.ts'), baselineSource('proxy.ts').replace('if (isOAuthConsent) {',
    "if (isOAuthConsent || pathname === '/hub/workspace') {"))
  for (const file of ['app/hub/page.tsx', 'app/hub/actions.ts', 'lib/hub-data.ts', 'lib/billing.ts']) {
    assert.equal(read(file), approvedHubSource(file), file)
  }
  // Independently reviewed LF source hashes from the IAM Charter, not snapshots
  // captured by this test. Adapter or denial changes require separate approval.
  for (const [file, hash] of [
    ['lib/hub-context-routing.ts', 'fc586642f77b7838118a36f86ae5dff1daca10bb5e9855db113450081df842d8'],
    ['lib/blank-company-isolation.ts', '8bd7295a45dca7b3dac02c5c231b2a1ec016095669f920e10d7f9b79879c012b'],
  ]) assert.equal(crypto.createHash('sha256').update(read(file)).digest('hex'), hash, file)

  const tree = ts.createSourceFile('core-company.ts', read('lib/core-company.ts'), ts.ScriptTarget.Latest, true)
  const gates = tree.statements.filter(ts.isVariableStatement).flatMap((statement) =>
    statement.declarationList.declarations.filter((declaration) => declaration.name.getText(tree) === 'CORE_COMPANY_RUNTIME_ENABLED')
      .map((declaration) => ({ statement, declaration })))
  const message = 'Core runtime must stay an exported false constant'
  assert.equal(gates.length, 1, message)
  const { statement, declaration } = gates[0]
  assert.ok(statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword), message)
  assert.ok(statement.declarationList.flags & ts.NodeFlags.Const, message)
  assert.ok(declaration.initializer && ts.isAsExpression(declaration.initializer), message)
  assert.equal(declaration.initializer.expression.kind, ts.SyntaxKind.FalseKeyword, message)
  assert.equal(declaration.initializer.type.getText(tree), 'const', message)
}

test('H1-UC-06: only approved Hub integration changes; H1 denial and disabled E1 stay intact', () => {
  assertPreservedHubContract(readSource)
  for (const file of execFileSync('git', ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', 'app'], { encoding: 'utf8' }).trim().split('\n').filter((file) => /\.tsx?$/.test(file))) {
    if (file.startsWith('app/hub/workspace/')) continue // Dedicated Step 3 route; separate caller tests below.
    assertNoE1Caller(file, readFileSync(join(root, file), 'utf8'))
  }
})

function assertNoE1Caller(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const visit = node => {
    const moduleSpecifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
      : ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        ts.isIdentifier(node.expression) && node.expression.text === 'require') ? node.arguments[0] : null
    if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
      assert.ok(!/e1-workspace|E1WorkspaceCandidate|core-company|core-registry-native/.test(moduleSpecifier.text),
        `${file} must not activate E1`)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
}
test('Hub activation scanner rejects static, dynamic and re-exported callers without rejecting a component declaration', () => {
  assertNoE1Caller('candidate.tsx', 'export function E1WorkspaceCandidate() { return null }')
  for (const source of ["import Candidate from './E1WorkspaceCandidate'", "export * from '@/lib/core-company'",
    "const x = import('@/lib/core-registry-native')", "const x = require('@/lib/e1-workspace')"]) {
    assert.throws(() => assertNoE1Caller('app/hub/page.tsx', source), /must not activate E1/)
  }
})

// Mutate strings in memory only. Each control must reach and fail the same
// assertion used above, with an actual changed input and the expected reason.
for (const [label, file, before, after] of [
  ['fallback import', 'app/hub/page.tsx', "import { dispatchHubRoute } from '@/lib/hub-context-routing'", "import { getHubSnapshot } from '@/lib/hub-data'"],
  ['removed denial', 'app/hub/page.tsx', "  if (route.context !== 'legacy_tenant') redirect('/unauthorized')\n", ''],
  ['reversed denial', 'app/hub/page.tsx', "route.context !== 'legacy_tenant'", "route.context === 'legacy_tenant'"],
  ['wrong denial target', 'app/hub/page.tsx', "redirect('/unauthorized')", "redirect('/hub/store')"],
  ['request-controlled dispatch', 'app/hub/page.tsx', 'dispatchHubRoute()', 'dispatchHubRoute(query)'],
  ['unrelated JSX change', 'app/hub/page.tsx', 'view={view}', 'view="billing"'],
  ['unrelated default view change', 'app/hub/page.tsx', ": 'home'", ": 'billing'"],
  ['E1 activation import', 'app/hub/page.tsx', "import { redirect }", "import { getE1WorkspaceCandidate } from '@/lib/e1-workspace'\nimport { redirect }"],
  ['removed explicit-context guard', 'lib/hub-context-routing.ts', 'untrustedContext.length !== 0 || CORE_COMPANY_RUNTIME_ENABLED', 'CORE_COMPANY_RUNTIME_ENABLED'],
  ['removed runtime guard', 'lib/hub-context-routing.ts', 'untrustedContext.length !== 0 || CORE_COMPANY_RUNTIME_ENABLED', 'untrustedContext.length !== 0'],
  ['legacy fallback on denial', 'lib/hub-context-routing.ts', 'return getBlankCompanyHubSnapshot(untrustedContext[0])', 'return getHubSnapshot()'],
  ['manufactured authority', 'lib/blank-company-isolation.ts', 'authorityReady: false,', 'authorityReady: true,'],
  ['inherited tenant', 'lib/blank-company-isolation.ts', 'tenant: null,', "tenant: '22222222-2222-4222-8222-222222222222',"],
  ['runtime enablement hidden by a false comment', 'lib/core-company.ts', 'export const CORE_COMPANY_RUNTIME_ENABLED = false as const', '// CORE_COMPANY_RUNTIME_ENABLED = false as const\nexport const CORE_COMPANY_RUNTIME_ENABLED = true as const'],
  ['environment-controlled activation', 'lib/core-company.ts', 'export const CORE_COMPANY_RUNTIME_ENABLED = false as const', "export const CORE_COMPANY_RUNTIME_ENABLED = (process.env.CORE_COMPANY_RUNTIME_ENABLED === 'true') as const"],
  ['unrelated frozen Hub data change', 'lib/hub-data.ts', "import 'server-only'", "import 'server-only'\nexport const unapprovedTenantFallback = true"],
  ['removed first-purchase-only engine guard', 'lib/billing.ts', 'args.firstPurchaseOnly && (subError || sub !== null)', 'false'],
]) {
  test(`H1-UC-06 negative source control rejects ${label}`, () => {
    const current = readSource(file)
    assert.equal(current.split(before).length, 2, `${label}: mutation must have one target`)
    const mutated = current.replace(before, after)
    assert.notEqual(mutated, current)
    const reason = file === 'lib/core-company.ts' ? 'Core runtime must stay an exported false constant' : file
    assert.throws(() => assertPreservedHubContract((path) => path === file ? mutated : readSource(path)),
      (error) => error.code === 'ERR_ASSERTION' && error.message.includes(reason))
  })
}

const integrationBranch = 'integrate/hub-inventory-owner-billing-static'
const integrationParent = 'cd3ee875713bed9ca0e0cdc2ba5b37c8f97a1783'
const integrationHead = '265bdb507d92264a0abc8e640e683bafa363b13c'
function integrationEvidence() {
  const head = gitText('rev-parse', `refs/heads/${integrationBranch}`).trim()
  return {
    head,
    parents: gitText('show', '-s', '--format=%P', head).trim().split(' '),
    paths: gitText('diff', '--no-ext-diff', '--name-only', integrationParent, head).trim().split('\n'),
    previousConfig: JSON.parse(gitText('show', `${integrationParent}:vercel.json`)),
    currentConfig: JSON.parse(gitText('show', `${head}:vercel.json`)),
  }
}

function assertIntegrationProvenance(evidence) {
  // Separate 15 October Owner authorization and Git evidence: the exact sole
  // child adds deployment suppression only. No arbitrary descendant is allowed.
  assert.equal(evidence.head, integrationHead, 'integration head')
  assert.deepEqual(evidence.parents, [integrationParent], 'integration sole parent')
  assert.deepEqual(evidence.paths, ['vercel.json'], 'integration changed paths')
  const expected = structuredClone(evidence.previousConfig)
  assert.equal(Object.hasOwn(expected.git.deploymentEnabled, integrationBranch), false, 'integration guard must be new')
  expected.git.deploymentEnabled[integrationBranch] = false
  assert.deepEqual(evidence.currentConfig, expected, 'integration config-only deployment guard')
}

test('H1-UC-06: preserved integration has the exact authorized config-only child and parent', () => {
  assertIntegrationProvenance(integrationEvidence())
})

for (const [label, mutate, reason] of [
  ['unapproved descendant', (e) => { e.head = 'f'.repeat(40) }, 'integration head'],
  ['different parent', (e) => { e.parents = [baseline] }, 'integration sole parent'],
  ['merge parent', (e) => { e.parents.push(baseline) }, 'integration sole parent'],
  ['application source delta', (e) => { e.paths.push('app/hub/page.tsx') }, 'integration changed paths'],
  ['missing config delta', (e) => { e.paths = [] }, 'integration changed paths'],
  ['missing deployment guard', (e) => { delete e.currentConfig.git.deploymentEnabled[integrationBranch] }, 'integration config-only deployment guard'],
  ['enabled deployment guard', (e) => { e.currentConfig.git.deploymentEnabled[integrationBranch] = true }, 'integration config-only deployment guard'],
  ['lost prior deployment guard', (e) => { delete e.currentConfig.git.deploymentEnabled['feat/hub-1-authorized-inventory'] }, 'integration config-only deployment guard'],
  ['changed cron', (e) => { e.currentConfig.crons[0].schedule = '* * * * *' }, 'integration config-only deployment guard'],
  ['unrelated config change', (e) => { e.currentConfig.framework = 'other' }, 'integration config-only deployment guard'],
]) {
  test(`H1-UC-06 negative provenance control rejects ${label}`, () => {
    const evidence = integrationEvidence()
    const before = JSON.stringify(evidence)
    mutate(evidence)
    assert.notEqual(JSON.stringify(evidence), before)
    assert.throws(() => assertIntegrationProvenance(evidence),
      (error) => error.code === 'ERR_ASSERTION' && error.message.includes(reason))
  })
}
