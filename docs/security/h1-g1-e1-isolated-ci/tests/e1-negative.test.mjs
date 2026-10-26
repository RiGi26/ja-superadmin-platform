// LOCAL_CANDIDATE_ONLY. Default mode reads files and runs static assertions only.
// Runtime mode requires a separately approved exact GitHub commit and disposable
// Docker identity. It never accepts a URL, service key, remote project or DB DSN.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { before, describe, test } from 'node:test'

const candidate = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(candidate, '../../..')
const project = 'h1-g1-e1-ci-disposable'
const container = `supabase_db_${project}`
const repository = 'RiGi26/ja-superadmin-platform'
const branch = 'refs/heads/feat/h1-g1-e1-core-static'
const imageDigest = 'sha256:4b438c22395a9a2bd19ee0522742cc9a1ff91db4732ff0c1b08fc07e9c767c22'
const promotedPath = '.github/workflows/h1-g1-e1-isolated.yml'
const files = [
  'workflow.CANDIDATE.yml', 'supabase/config.toml',
  'supabase/migrations/00000000000000_e1_ci_fixture.sql',
  'tests/e1-negative.test.mjs', 'vercel.guard.proposed.json', 'RUNBOOK.md',
]
const read = (path) => readFileSync(join(candidate, path), 'utf8')
const workflow = read(files[0])
const config = read(files[1])
const fixture = read(files[2])
const proposed = JSON.parse(read(files[4]))
const baselineVercel = {
  framework: 'nextjs',
  crons: [
    { path: '/api/cron/subscription-lifecycle', schedule: '0 1 * * *' },
    { path: '/api/cron/customer-onboarding', schedule: '15 1 * * *' },
  ],
}
const expectedGuard = { ...baselineVercel, git: { deploymentEnabled: { 'feat/h1-g1-e1-core-static': false } } }
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const sharedTests = readFileSync(join(root, 'lib/e1-workspace.test.mjs'), 'utf8')
const vectors = JSON.parse(sharedTests.match(/const codecVectors = (\{[\s\S]+?\})\r?\n\/\/ END_SHARED_E1_CODEC_VECTORS/)[1])

// Lexical security gates, not a YAML/TOML/SQL parser. Local parser validation is
// separate (existing Python PyYAML and tomllib); GitHub/CLI parsing is unexecuted.
function validateWorkflow(text) {
  const clean = text.replace(/^\s*#.*$/gm, '')
  const events = clean.match(/^"on":\n([\s\S]+?)^permissions:/m)?.[1]
  assert.ok(events)
  assert.match(events, /^  push:\n    branches: \[feat\/h1-g1-e1-core-static\]\n    paths:/)
  assert.deepEqual(events.split('\n').filter((line) => line.startsWith('      - ')).map((line) => line.slice(8)), [
    promotedPath, ...files.map((file) => `docs/security/h1-g1-e1-isolated-ci/${file}`),
  ])
  assert.ok(!/^\s*(schedule|workflow_dispatch|pull_request|pull_request_target|workflow_run|repository_dispatch|services|strategy):/m.test(clean))
  assert.match(clean, /^permissions:\n  contents: read\n/m)
  assert.match(clean, /runs-on: ubuntu-latest\n    timeout-minutes: 25/)
  assert.match(clean, /group: h1-g1-e1-isolated-\$\{\{ github.ref \}\}\n  cancel-in-progress: false/)
  assert.match(clean, /github.repository == 'RiGi26\/ja-superadmin-platform'/)
  assert.match(clean, /github.ref == 'refs\/heads\/feat\/h1-g1-e1-core-static'/)
  assert.match(clean, /github.event_name == 'push' && github.run_attempt == 1/)
  assert.match(clean, /vars.E1_ISOLATED_CI_APPROVED_SHA == github.sha/)
  assert.match(clean, /environment: e1-isolated-ci/)
  assert.deepEqual([...clean.matchAll(/uses: ([^\s]+)/g)].map((match) => match[1]), [
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
  ])
  assert.match(clean, /ref: \$\{\{ github.sha \}\}\n          persist-credentials: false/)
  assert.ok(!/secrets\.|write-all|contents: write|id-token:|upload-artifact|actions\/cache|npm (ci|install)|npx|--db-url|--linked|--ignore-health-check/.test(clean))
  assert.ok(!/supabase\s+(login|link|projects|db push|migration up|functions deploy|status)/.test(clean))
  assert.ok(!clean.includes('supabase/migrations/core_db') && !clean.includes('STATIC_ONLY.sql'))
  assert.match(clean, /E1_FIXTURE_DIR: \$\{\{ runner.temp \}\}\/h1-g1-e1-fixture/)
  assert.match(clean, /SUPABASE_HOME: \$\{\{ runner.temp \}\}\/h1-g1-e1-cli-home/)
  assert.match(clean, /SUPABASE_EXPERIMENTAL_STACK: '0'/)
  assert.match(clean, /SUPABASE_USE_SLIM_IMAGES: 'false'/)
  assert.match(clean, /SUPABASE_INTERNAL_IMAGE_REGISTRY: docker.io/)
  assert.match(clean, /SUPABASE_TELEMETRY_DISABLED: '1'/)
  assert.match(clean, /SUPABASE_NO_KEYRING: '1'/)
  assert.equal([...clean.matchAll(/env -i PATH="\$PATH" HOME="\$SUPABASE_HOME" SUPABASE_HOME="\$SUPABASE_HOME"/g)].length, 2)
  assert.ok(clean.includes('node-v24.21.0-linux-x64.tar.xz'))
  assert.ok(clean.includes('fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6'))
  assert.ok(clean.includes('supabase_2.120.0_linux_amd64.tar.gz'))
  assert.ok(clean.includes('7074584113aa00495beeac661c41fb09f1ddd0a483cd7333894b0d080086dc6e'))
  assert.ok(clean.includes(`supabase/postgres@${imageDigest}`))
  assert.ok(clean.includes('supabase/postgres:17.11.0.004'))
  const workdirs = [...clean.matchAll(/--workdir "([^"\n]+)"/g)].map((match) => match[1])
  assert.deepEqual(workdirs, ['$E1_FIXTURE_DIR', '$E1_FIXTURE_DIR'])
  assert.match(clean, /cp "\$CANDIDATE_DIR\/supabase\/config.toml" "\$E1_FIXTURE_DIR\/supabase\/config.toml"/)
  assert.match(clean, /test "\$\(find "\$E1_FIXTURE_DIR" -type f \| wc -l\)" -eq 2/)
  assert.match(clean, /--exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor/)
  assert.match(clean, /always\(\).*steps.bootstrap.outcome != 'skipped'/)
  assert.match(clean, /--project-id h1-g1-e1-ci-disposable --no-backup/)
  assert.ok(!/stop[^\n]*--all/.test(clean))
  assert.ok(!/cat "\$RUNNER_TEMP\/e1-|set -x|--debug/.test(clean))
}

function validateConfig(text) {
  const clean = text.replace(/^\s*#.*$/gm, '')
  assert.match(clean, /^\s*project_id = "h1-g1-e1-ci-disposable"/)
  assert.ok(!/env\(|https?:|\[remotes|project_ref|password|signing_keys|vault|orioledb|\.\.\//i.test(clean))
  const sections = [...clean.matchAll(/^\[([^\]]+)\]/gm)].map((match) => match[1])
  assert.deepEqual(sections, ['api', 'db', 'db.pooler', 'db.migrations', 'db.seed', 'realtime', 'studio',
    'local_smtp', 'storage', 'storage.s3_protocol', 'storage.analytics', 'storage.vector', 'auth', 'edge_runtime', 'analytics', 'experimental'])
  for (const section of sections.filter((section) => !['db', 'db.migrations', 'experimental'].includes(section))) {
    assert.match(clean, new RegExp(`\\[${section.replaceAll('.', '\\.')}\\]\\nenabled = false`))
  }
  assert.match(clean, /\[db\]\nport = 55432\nshadow_port = 55430\nmajor_version = 17/)
  assert.match(clean, /\[db.migrations\]\nenabled = true\nschema_paths = \[\]/)
  assert.match(clean, /\[db.seed\]\nenabled = false\nsql_paths = \[\]/)
  assert.match(clean, /\[experimental\]\nstack = false/)
}

function validateFixture(text) {
  assert.match(text, /^-- LOCAL_CANDIDATE_ONLY \/ SYNTHETIC_ISOLATED_FIXTURE_ONLY/)
  const clean = text.replace(/--[^\n]*/g, '').toLowerCase()
  assert.deepEqual([...clean.matchAll(/create table ([a-z0-9_.]+)/g)].map((match) => match[1]), [
    'e1_ci.synthetic_identities', 'e1_ci.companies', 'e1_ci.memberships', 'e1_ci.legacy_history',
  ])
  assert.match(clean, /create role e1_ci_reader nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls/)
  assert.ok(!/security definer|auth\.users|auth\.sessions|\b(public\.[a-z_]+)\s*(\(|values)|\bgrant\s+(insert|update|delete|all).*\bto\s+e1_ci_reader/i.test(clean))
  assert.ok(!/\b(create|alter|insert into|update|delete from)\s+(public|auth|wz_e1_private)\./.test(clean))
  assert.equal([...clean.matchAll(/enable row level security/g)].length, 4)
  assert.equal([...clean.matchAll(/force row level security/g)].length, 4)
  assert.equal([...clean.matchAll(/create policy /g)].length, 4)
  assert.ok(clean.includes('and (select count(*) from e1_ci.memberships'))
  assert.ok(clean.includes("and i.kind = 'customer' and i.status = 'active'"))
  assert.ok(clean.includes("m.status = 'active'"))
  assert.ok(clean.includes('and not exists (select 1 from e1_ci.legacy_history'))
  assert.ok(clean.includes('revoke all on all tables in schema e1_ci from public, anon, authenticated, service_role, e1_ci_reader;'))
  assert.ok(clean.includes('revoke all on all functions in schema e1_ci from public, anon, authenticated, service_role, e1_ci_reader;'))
  const disabled = clean.match(/as \$disabled\$([\s\S]+?)\$disabled\$/)?.[1]
  const continuity = clean.match(/as \$continuity\$([\s\S]+?)\$continuity\$/)?.[1]
  assert.ok(disabled && continuity)
  for (const body of [disabled, continuity]) {
    assert.match(body, /raise exception using errcode = '42501', message = 'review_required_identity_transport';\s*end;/)
    assert.ok(!/\breturn\b|\binsert\b|\bupdate\b|\bdelete\b|\bexecute\b/.test(body))
  }
  assert.ok(disabled.includes('p_actor is not null or p_company is not null or p_role is not null or p_source_ref is not null'))
  assert.ok(continuity.includes('p_initial_actor is distinct from p_current_actor or p_initial_source is distinct from p_current_source'))
  assert.ok(continuity.includes('p_initial_source is null or p_current_source is null'))
  assert.ok(clean.includes("comment on table e1_ci.synthetic_identities is 'h1_g1_e1_synthetic_disposable_v1'"))
  assert.ok(!/create table.*(invoice|payment|subscription|portal|trial|tenant)/.test(clean))
}

function validateRuntimeEnvelope(env) {
  assert.equal(env.GITHUB_ACTIONS, 'true', 'Runtime requires approved GitHub-hosted execution')
  assert.equal(env.GITHUB_REPOSITORY, repository)
  assert.equal(env.GITHUB_REF, branch)
  assert.equal(env.GITHUB_EVENT_NAME, 'push')
  assert.equal(env.GITHUB_RUN_ATTEMPT, '1')
  assert.match(env.GITHUB_SHA ?? '', /^[0-9a-f]{40}$/)
  assert.equal(env.E1_ISOLATED_CI_APPROVED_SHA, env.GITHUB_SHA)
  assert.ok(env.RUNNER_TEMP && env.E1_FIXTURE_DIR)
  assert.equal(resolve(env.E1_FIXTURE_DIR), resolve(env.RUNNER_TEMP, 'h1-g1-e1-fixture'))
  for (const key of ['DATABASE_URL', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGSERVICE',
    'SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_ID', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'CORE_SUPABASE_URL']) {
    assert.ok(!env[key], 'Runtime refuses externally supplied connection or credential context')
  }
}

function strictReference(actor, key, name) {
  assert.ok(typeof actor === 'string' && actor.length === 36 && uuidPattern.test(actor))
  assert.ok(typeof key === 'string' && key.length === 36 && uuidPattern.test(key))
  assert.equal(typeof name, 'string')
  const normalized = name.trim().normalize('NFC')
  const points = [...normalized].map((character) => character.codePointAt(0))
  assert.ok(points.length >= 2 && points.length <= 100)
  assert.ok(points.every((point) => point >= 32 && !(point >= 127 && point <= 159) && !(point >= 0xd800 && point <= 0xdfff)))
  const subject = actor.toLowerCase()
  const canonicalKey = key.toLowerCase()
  const nameHex = Buffer.from(normalized, 'utf8').toString('hex')
  return { name: normalized, nameHex,
    scope: sha256(`e1:v2:scope:${subject}:${canonicalKey}`),
    fingerprint: sha256(`e1:v2:payload:${subject}:${nameHex}`) }
}

const runtimeFlag = process.env.E1_ISOLATED_RUNTIME
assert.ok(runtimeFlag === undefined || runtimeFlag === '0' || runtimeFlag === '1', 'Invalid runtime mode')

if (runtimeFlag !== '1') {
  describe('STATIC_ONLY: no SQL, CLI, Docker, network or provider calls', () => {
    test('workflow gates exact branch, paths, commit, human environment and one attempt', () => validateWorkflow(workflow))
    test('configuration isolates one project, migration directory and disabled services', () => validateConfig(config))
    test('synthetic fixture restricts roles and always refuses the writer', () => validateFixture(fixture))
    test('Vercel proposal adds exactly one false branch rule and preserves both crons', () => assert.deepEqual(proposed, expectedGuard))
    test('candidate inventory is exactly six regular files with clean whitespace', () => {
      const inventory = []
      const visit = (directory, prefix = '') => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const path = prefix + entry.name
          assert.equal(lstatSync(join(directory, entry.name)).isSymbolicLink(), false)
          if (entry.isDirectory()) visit(join(directory, entry.name), `${path}/`)
          else inventory.push(path)
        }
      }
      visit(candidate)
      assert.deepEqual(inventory.sort(), [...files].sort())
      for (const file of files) {
        const source = read(file)
        assert.ok(source.endsWith('\n'))
        assert.ok(!source.split(/\r?\n/).some((line) => /[\t ]+$/.test(line)))
      }
    })
    test('no executable workflow or root Vercel change in local candidate preparation', () => {
      const published = existsSync(join(root, promotedPath))
      if (published) {
        // Future CI only: actual workflow must be identical to the approved candidate.
        validateRuntimeEnvelope(process.env)
        assert.equal(readFileSync(join(root, promotedPath), 'utf8'), workflow)
        assert.deepEqual(JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')), expectedGuard)
      } else {
        assert.deepEqual(JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')), baselineVercel)
      }
      const keepalive = readFileSync(join(root, '.github/workflows/supabase-keepalive.yml'))
      assert.equal(sha256(published ? keepalive.toString('utf8').replaceAll('\r\n', '\n') : keepalive),
        published ? '6ec0b6918850ee36be33cb5dbe89e6dca78d53f6289630e14f9805a5a9cfab23' : 'ff003b9025f89dac3c29c2de4ac0df6157ecfece2c704dbae0326d70660f5837')
    })
    test('existing E1 artifacts and gitignore match the prior accepted source hashes', () => {
      for (const [path, hash] of Object.entries({
        // The unrelated local gitignore edit must be preserved, not published.
        '.gitignore': existsSync(join(root, promotedPath)) ? 'fa2121948fe843fd556031b6c1be6556fa8bfb2d2fe8c46d6a78faed1b62948e' : '03c97e7459c7ba733590bfd5c4bf123043768dd069401a40d5789e7a6fa75f51',
        'lib/e1-workspace.ts': 'ae8a6488844500683e45fcb7472c8b44127df43700a3c25da923f27aff0b86d4',
        'lib/e1-workspace.test.mjs': '01a1e62cbbdbdd9ebfc9f53b33df6fb57e3774cade36311b9f0378bf827d363c',
        'docs/security/h1-g1-e1-registry-writer-audit.STATIC_ONLY.sql': 'ffbb0faff2e1d14adcda0217b8ad7b25f91d9b1395e621a4be076a57379ad06a',
        'docs/security/h1-g1-e1-registry-writer-audit.test.mjs': 'f25f1b56f617480a7f8a3118ef52d3a9c3ae908f1012a3382d106b9586704d7e',
      })) assert.equal(sha256(readFileSync(join(root, path))), hash, path)
    })
    for (const [name, mutate] of [
      ['wrong branch', (text) => text.replace('branches: [feat/h1-g1-e1-core-static]', 'branches: [main]')],
      ['unrestricted path', (text) => text.replace('      - .github/workflows/h1-g1-e1-isolated.yml', '      - "**"')],
      ['PR trigger', (text) => text.replace('  push:', '  pull_request:')],
      ['write permission', (text) => text.replace('contents: read', 'contents: write')],
      ['paid runner', (text) => text.replace('ubuntu-latest', 'ubuntu-latest-16-cores')],
      ['mutable action', (text) => text.replace('checkout@3d3c42e5aac5ba805825da76410c181273ba90b1', 'checkout@main')],
      ['root migrations', (text) => text.replaceAll('--workdir "$E1_FIXTURE_DIR"', '--workdir "$GITHUB_WORKSPACE"')],
      ['ambient CLI environment', (text) => text.replaceAll('env -i PATH=', 'env PATH=')],
      ['missing commit gate', (text) => text.replace('vars.E1_ISOLATED_CI_APPROVED_SHA == github.sha', 'true')],
      ['broad cleanup', (text) => text.replace('--project-id h1-g1-e1-ci-disposable --no-backup', '--all --no-backup')],
      ['cache upload', (text) => text + '\n      - uses: actions/cache@main\n'],
      ['Production key', (text) => text + '\n      TOKEN: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}\n'],
    ]) test(`workflow rejects ${name}`, () => assert.throws(() => validateWorkflow(mutate(workflow))))
    for (const [name, mutate] of [
      ['remote', (text) => text + '\n[remotes.main]\nproject_id = "actual-project"\n'],
      ['seed import', (text) => text.replace('sql_paths = []', 'sql_paths = ["../../../seed.sql"]')],
      ['schema import', (text) => text.replace('schema_paths = []', 'schema_paths = ["../../../supabase/migrations/*.sql"]')],
      ['Auth activation', (text) => text.replace('[auth]\nenabled = false', '[auth]\nenabled = true')],
      ['project substitution', (text) => text.replace(project, 'different-project')],
    ]) test(`configuration rejects ${name}`, () => assert.throws(() => validateConfig(mutate(config))))
    for (const [name, mutate] of [
      ['writer activation', (text) => text.replaceAll("raise exception using errcode = '42501', message = 'REVIEW_REQUIRED_IDENTITY_TRANSPORT';", 'return;')],
      ['privileged definer', (text) => text.replace('security invoker', 'security definer')],
      ['BYPASSRLS', (text) => text.replace('nobypassrls;', 'bypassrls;')],
      ['missing FORCE RLS', (text) => text.replace('alter table e1_ci.companies force row level security;', '')],
      ['client actor override', (text) => text.replace('p_actor is not null or p_company is not null or p_role is not null or p_source_ref is not null', 'false')],
      ['lost source continuity', (text) => text.replace('p_initial_source is distinct from p_current_source', 'false')],
      ['table write grant', (text) => text + '\ngrant insert on e1_ci.companies to e1_ci_reader;\n'],
    ]) test(`fixture rejects ${name}`, () => assert.throws(() => validateFixture(mutate(fixture))))
    for (const mutation of [
      { ...expectedGuard, git: { deploymentEnabled: { 'feat/h1-g1-e1-core-static': true } } },
      { ...expectedGuard, git: { deploymentEnabled: { 'feat/h1-g1-e1-core-static': false, '*': true } } },
      { ...expectedGuard, crons: baselineVercel.crons.slice(0, 1) },
    ]) test('Vercel rejects enabling overlap or lost cron', () => assert.throws(() => assert.deepEqual(mutation, expectedGuard)))
    const approvedEnv = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: repository, GITHUB_REF: branch,
      GITHUB_EVENT_NAME: 'push', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: 'a'.repeat(40),
      E1_ISOLATED_CI_APPROVED_SHA: 'a'.repeat(40), RUNNER_TEMP: '/tmp/e1-runner', E1_FIXTURE_DIR: '/tmp/e1-runner/h1-g1-e1-fixture' }
    for (const override of [
      { GITHUB_ACTIONS: 'false' }, { GITHUB_REPOSITORY: 'another/repo' }, { GITHUB_REF: 'refs/heads/main' },
      { GITHUB_RUN_ATTEMPT: '2' }, { E1_ISOLATED_CI_APPROVED_SHA: 'b'.repeat(40) },
      { E1_FIXTURE_DIR: '/actual/project' }, { DATABASE_URL: 'postgres://external.invalid' },
      { SUPABASE_ACCESS_TOKEN: 'untrusted' }, { SUPABASE_PROJECT_ID: 'foreign' },
    ]) test('runtime refuses unapproved or externally connected context without starting Docker', () => {
      assert.throws(() => validateRuntimeEnvelope({ ...approvedEnv, ...override }))
    })
    for (const [index, vector] of vectors.valid.entries()) test(`shared TypeScript codec vector ${index}: static reference bytes only`, () => {
      assert.deepEqual(strictReference(vector.subject, vector.key, vector.input), {
        name: vector.name, nameHex: vector.nameHex, scope: vector.scope, fingerprint: vector.fingerprint,
      })
    })
    for (const key of vectors.invalidKeys) test('strict UUID domain rejects ambiguous key before hypothetical transport', () => {
      assert.throws(() => strictReference(vectors.valid[0].subject, key, 'Synthetic Company'))
    })
    test('Unicode surrogate and control cases remain denied by the strict reference', () => {
      for (const name of [...vectors.invalidNames, `A${String.fromCharCode(0xd800)}B`]) {
        assert.throws(() => strictReference(vectors.valid[0].subject, vectors.valid[0].key, name))
      }
    })
  })
} else {
  validateRuntimeEnvelope(process.env)
  assert.equal(realpathSync(process.env.E1_FIXTURE_DIR), resolve(process.env.E1_FIXTURE_DIR))
  assert.equal(sha256(readFileSync(join(process.env.E1_FIXTURE_DIR, 'supabase/config.toml'))), sha256(config))
  assert.equal(sha256(readFileSync(join(process.env.E1_FIXTURE_DIR, files[2]))), sha256(fixture))
  const docker = (args, input) => spawnSync('docker', args, {
    input, encoding: 'utf8', timeout: 15000, maxBuffer: 65536,
  })
  const inspect = docker(['inspect', container])
  assert.equal(inspect.status, 0, 'Exact disposable container must exist')
  const metadata = JSON.parse(inspect.stdout)[0]
  assert.equal(metadata.Name, `/${container}`)
  assert.equal(metadata.State.Running, true)
  assert.equal(metadata.Config.Labels['com.supabase.cli.project'], project)
  assert.equal(metadata.Config.Labels['com.supabase.cli.workdir'], process.env.E1_FIXTURE_DIR)
  const image = docker(['image', 'inspect', `supabase/postgres@${imageDigest}`])
  assert.equal(image.status, 0)
  assert.equal(metadata.Image, JSON.parse(image.stdout)[0].Id, 'Database must use the reviewed image digest')
  const sql = (query) => docker(['exec', '--user', 'postgres', '-i', container, 'psql',
    '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
    '--host=/var/run/postgresql', '--username=postgres', '--dbname=postgres'], query)
  const query = (text) => {
    const result = sql(text)
    assert.equal(result.status, 0, 'Isolated SQL assertion failed; raw diagnostics are not emitted')
    return result.stdout.trim()
  }
  const actor = (index) => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  const company = (index) => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  const quoted = (text) => `'${text.replaceAll("'", "''")}'`
  const withRole = (role, identity, statement) => {
    assert.ok(['anon', 'authenticated', 'service_role', 'e1_ci_reader'].includes(role))
    assert.ok(identity === '' || uuidPattern.test(identity))
    return `begin; set local role ${role}; set local e1_ci.actor = ${quoted(identity)}; ${statement}; rollback;`
  }
  const denied = (text, marker) => {
    const result = sql(text)
    assert.equal(result.status, 3, 'Expected psql ON_ERROR_STOP permission failure')
    assert.match(result.stderr, /42501/, 'Failure must be an authorization denial, not syntax or unavailable infrastructure')
    if (marker) assert.ok(result.stderr.includes(marker), 'Expected specific fail-closed guard')
  }
  const snapshotSql = "select jsonb_build_object('identities', (select jsonb_agg(t order by id) from e1_ci.synthetic_identities t), 'companies', (select jsonb_agg(t order by id) from e1_ci.companies t), 'memberships', (select jsonb_agg(t order by actor_id, company_id) from e1_ci.memberships t), 'history', (select jsonb_agg(t order by actor_id) from e1_ci.legacy_history t))::text"
  let snapshot
  describe('ISOLATED_SQL_ONLY: synthetic roles/GUCs, not Core Auth or Production', { concurrency: false }, () => {
    before(() => {
      assert.equal(query("select obj_description('e1_ci.synthetic_identities'::regclass)"), 'H1_G1_E1_SYNTHETIC_DISPOSABLE_V1')
      assert.equal(query("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('companies','tenants','customer_onboarding','invoices','subscriptions','payments')"), '0')
      snapshot = query(snapshotSql)
    })
    test('effective reader role lacks login, inheritance, bypass and administrative privileges', () => {
      assert.equal(query("select not rolcanlogin and not rolinherit and not rolbypassrls and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication from pg_roles where rolname='e1_ci_reader'"), 't')
      assert.equal(query("select bool_and(not pg_has_role(oid, 'e1_ci_reader', 'MEMBER')) from pg_roles where rolname in ('anon','authenticated','service_role')"), 't')
    })
    test('all four fixture tables enforce RLS and have no granted client mutation privilege', () => {
      assert.equal(query("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='e1_ci' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity"), '4')
      for (const role of ['anon', 'authenticated', 'service_role', 'e1_ci_reader']) {
        assert.equal(query(`select bool_and(not has_table_privilege(${quoted(role)}, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='e1_ci' and c.relkind='r'`), 't')
      }
    })
    for (const role of ['anon', 'authenticated', 'service_role']) test(`${role}: Company data inaccessible despite a claimed actor`, () => {
      denied(withRole(role, actor(1), 'select id from e1_ci.companies'))
    })
    test('synthetic read predicate isolates Company A and B; this is not authenticated actor proof', () => {
      assert.equal(query(withRole('e1_ci_reader', actor(1), 'select id from e1_ci.companies')), company(1))
      assert.equal(query(withRole('e1_ci_reader', actor(2), 'select id from e1_ci.companies')), company(2))
      assert.equal(query(withRole('e1_ci_reader', actor(1), `select count(*) from e1_ci.companies where id=${quoted(company(2))}`)), '0')
    })
    for (const [index, label] of [[3, 'revoked membership'], [4, 'inactive Company'], [5, 'ambiguous memberships'],
      [6, 'legacy conflict'], [7, 'synthetic anonymous identity'], [8, 'synthetic revoked identity']]) {
      test(`${label}: zero readable Companies`, () => assert.equal(query(withRole('e1_ci_reader', actor(index), 'select count(*) from e1_ci.companies')), '0'))
    }
    test('missing synthetic actor denies reads', () => assert.equal(query(withRole('e1_ci_reader', '', 'select count(*) from e1_ci.companies')), '0'))
    for (const role of ['anon', 'authenticated', 'e1_ci_reader']) {
      test(`${role}: missing trusted transport always refuses workspace creation`, () => {
        denied(withRole(role, actor(1), `select e1_ci.request_workspace_disabled('Synthetic New Company', ${quoted(vectors.valid[0].key)}::uuid)`), 'REVIEW_REQUIRED_IDENTITY_TRANSPORT')
      })
      for (const argument of [`p_actor => ${quoted(actor(2))}::uuid`, `p_company => ${quoted(company(2))}::uuid`, "p_role => 'owner'", `p_source_ref => ${quoted(vectors.valid[0].key)}::uuid`]) {
        test(`${role}: client-controlled actor, Company, role or source cannot grant creation authority`, () => {
          denied(withRole(role, actor(1), `select e1_ci.request_workspace_disabled('Synthetic New Company', ${quoted(vectors.valid[0].key)}::uuid, ${argument})`), 'CLIENT_IDENTITY_DENIED')
        })
      }
    }
    const source = vectors.valid[0].key
    for (const [currentActor, currentSource, marker] of [
      [actor(1), source, 'REVIEW_REQUIRED_IDENTITY_TRANSPORT'],
      [actor(2), source, 'ACTOR_SOURCE_CONTINUITY_DENIED'],
      [actor(1), company(1), 'ACTOR_SOURCE_CONTINUITY_DENIED'],
      [null, source, 'ACTOR_SOURCE_CONTINUITY_DENIED'],
      [actor(1), null, 'ACTOR_SOURCE_CONTINUITY_DENIED'],
    ]) test('UUID continuity contract remains fail-closed without any actual lock or session transport', () => {
      const literal = (value) => value === null ? 'null::uuid' : `${quoted(value)}::uuid`
      denied(withRole('e1_ci_reader', actor(1), `select e1_ci.assert_continuity_disabled(${literal(actor(1))}, ${literal(currentActor)}, ${literal(source)}, ${literal(currentSource)})`), marker)
    })
    for (const [index, vector] of vectors.valid.entries()) test(`PostgreSQL projection versus shared TypeScript codec vector ${index}`, () => {
      const name = `convert_from(decode('${Buffer.from(vector.input, 'utf8').toString('hex')}', 'hex'), 'UTF8')`
      const actual = JSON.parse(query(`select e1_ci.codec_projection(${quoted(vector.subject)}::uuid, ${quoted(vector.key)}::uuid, ${name})::text`))
      assert.deepEqual(actual, strictReference(vector.subject, vector.key, vector.input))
    })
    for (const key of [vectors.valid[0].key.replaceAll('-', ''), `{${vectors.valid[0].key}}`, '00000000-0000-0000-0000-000000000000']) {
      test('typed PostgreSQL UUID domain is broader than the strict TypeScript string gate', () => {
        assert.throws(() => strictReference(vectors.valid[0].subject, key, 'Synthetic Company'))
        assert.ok(query(`select ${quoted(key)}::uuid::text`))
        denied(withRole('e1_ci_reader', actor(1), `select e1_ci.request_workspace_disabled('Synthetic Company', ${quoted(key)}::uuid)`), 'REVIEW_REQUIRED_IDENTITY_TRANSPORT')
      })
    }
    test('PostgreSQL UTF8 rejects NUL and surrogate encoding; JS invalid-scalar rejection is a separate gate', () => {
      for (const bytes of ['410042', '41eda08042']) {
        const result = sql(`select convert_from(decode('${bytes}', 'hex'), 'UTF8')`)
        assert.equal(result.status, 3)
        assert.match(result.stderr, /22021/)
      }
    })
    for (const operation of [
      "insert into e1_ci.companies values ('20000000-0000-4000-8000-000000000009','Synthetic Attempt','active')",
      `update e1_ci.companies set name='Synthetic Attempt' where id=${quoted(company(1))}`,
      `delete from e1_ci.companies where id=${quoted(company(1))}`,
      'truncate e1_ci.companies',
      `update e1_ci.memberships set role='owner' where actor_id=${quoted(actor(2))}`,
    ]) test('fixture client cannot mutate Company or Owner relationships', () => denied(withRole('e1_ci_reader', actor(1), operation)))
    test('fixture contains no financial, subscription, trial or portal table and records remain identical', () => {
      assert.deepEqual(JSON.parse(query("select jsonb_agg(relname order by relname)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='e1_ci' and c.relkind='r'")), [
        'companies', 'legacy_history', 'memberships', 'synthetic_identities',
      ])
      assert.equal(query(snapshotSql), snapshot)
    })
  })
}
