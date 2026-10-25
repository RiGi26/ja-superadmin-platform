// SOURCE ONLY. No CLI, driver import, environment reads, or automatic connection.
// This dependency-injected proposal is tested exclusively with scripted clients.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const PROJECT = 'mcvekinhgcqygfddyifs'
export const HOST = 'aws-0-ap-northeast-2.pooler.supabase.com'
export const sha256 = (value) => createHash('sha256').update(value).digest('hex')
export const PHASES = Object.freeze(['begin', 'limits', 'preconditions', 'roles',
  'automatic_membership', 'delegation_and_ownership', 'privilege_assertions',
  'catalog', 'denial', 'revoke', 'remaining_authority', 'rollback'])
const directory = new URL('./', import.meta.url)
const identitySql = `SELECT pg_catalog.pg_backend_pid() AS pid,
  (SELECT backend_start::text FROM pg_catalog.pg_stat_activity WHERE pid = pg_catalog.pg_backend_pid()) AS backend_start,
  current_database() AS database, current_user AS principal, session_user AS session_principal,
  current_setting('server_version_num')::integer AS version,
  current_setting('server_encoding') AS encoding,
  (SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid = pg_catalog.pg_backend_pid()) AS tls`
const transactionSql = `SELECT pg_catalog.pg_backend_pid() AS pid,
  pg_catalog.pg_current_xact_id()::text AS xid, current_user AS principal`

export function loadPlan(approvedHashes) {
  const sql = readFileSync(new URL('capability.PROPOSED.sql', directory))
  const inventory = readFileSync(new URL('inventory.READ_ONLY.sql', directory))
  const runner = readFileSync(new URL('runner.PROPOSED.mjs', directory))
  for (const [name, bytes] of Object.entries({ sql, inventory, runner })) {
    assert.match(approvedHashes?.[name] ?? '', /^[0-9a-f]{64}$/)
    assert.equal(sha256(bytes), approvedHashes[name], `Unapproved ${name} bytes`)
  }
  const chunks = sql.toString('utf8').split(/^-- @phase ([a-z_]+)\r?\n/gm)
  const phases = []
  for (let i = 1; i < chunks.length; i += 2) phases.push({ name: chunks[i], sql: chunks[i + 1] })
  assert.deepEqual(phases.map((phase) => phase.name), PHASES)
  assert.equal(phases[0].sql.trim(), 'BEGIN ISOLATION LEVEL READ COMMITTED;')
  assert.equal(phases.at(-1).sql.trim(), 'ROLLBACK;')
  return Object.freeze({ phases, inventory: inventory.toString('utf8') })
}

function configuration(password, ca, applicationName) {
  assert.equal(typeof password, 'string')
  assert.ok(password.length > 0)
  assert.equal(typeof ca, 'string')
  assert.ok(ca.length > 0)
  return { host: HOST, port: 5432, database: 'postgres', user: 'postgres.mcvekinhgcqygfddyifs', password,
    application_name: applicationName, connectionTimeoutMillis: 10000,
    ssl: { ca, rejectUnauthorized: true, servername: HOST } }
}

function checkedIdentity(row, authority) {
  assert.equal(row.database, 'postgres')
  assert.equal(row.principal, 'postgres')
  assert.equal(row.session_principal, 'postgres')
  assert.equal(row.encoding, 'UTF8')
  assert.ok(row.version >= 170000 && row.version < 180000)
  // DEV-only acceptance of the provider-side backend connection observed as ssl=false.
  // The client-to-Supavisor TLS CA/hostname checks remain mandatory in configuration().
  // This does NOT claim upstream TLS or provide an exception for Production.
  if (row.tls !== true) {
    assert.equal(row.tls, false, 'Unexpected backend TLS catalog value')
    assert.equal(authority?.devOnlyBackendTlsRiskAccepted, true, 'DEV-only TLS risk not authorized')
  }
  assert.ok(Number.isInteger(row.pid) && row.backend_start)
  return row
}

// `authority` records an independently checked human envelope; these values are
// NOT cryptographic authorization or project evidence derived from a caller.
// Future Owner must first approve the exact package and separately enable access.
export async function rehearse({ Client, password, ca, approvedHashes, authority, signal }) {
  assert.equal(authority?.projectRef, PROJECT)
  assert.equal(authority?.host, HOST)
  assert.equal(authority?.database, 'postgres')
  assert.equal(authority?.isolatedSyntheticDev, true)
  assert.equal(authority?.zeroIncrementalCost, true)
  assert.equal(authority?.privateProbeSchemaExcludedFromDataApi, true)
  assert.equal(authority?.reviewedNoExternalHooks, true)
  assert.ok(typeof authority?.ownerApprovalRef === 'string' && authority.ownerApprovalRef.length > 0)
  const plan = loadPlan(approvedHashes)
  const primaryConfig = configuration(password, ca, 'h1g1-r17-primary')
  const observerConfig = configuration(password, ca, 'h1g1-r17-observer')
  assert.equal(typeof Client, 'function', 'No verified client implementation is installed')
  const report = { level: 'DATABASE_RUNTIME_ONLY_IF_SEPARATELY_EXECUTED', events: [],
    outcome: 'FAIL_CLOSED', rollback: 'NOT_CONFIRMED', residual: 'UNKNOWN', stage: 'before' }
  let primary
  let before
  let attemptedBegin = false
  let asynchronousFailure = false
  const checkAbort = () => {
    assert.ok(!signal?.aborted && !asynchronousFailure, 'Interrupted; do not continue')
  }
  async function observe() {
    const client = new Client(observerConfig)
    client.on('error', () => { asynchronousFailure = true })
    try {
      await client.connect()
      const identity = checkedIdentity((await client.query(identitySql)).rows[0], authority)
      const inventory = (await client.query(plan.inventory)).rows[0].inventory
      assert.deepEqual(inventory.primary_sessions, [], 'Primary session still active')
      return { identity, inventory }
    } finally {
      await client.end()
    }
  }
  try {
    checkAbort()
    before = await observe()
    assert.deepEqual(before.inventory.roles, [], 'Conflicting candidate or probe role')
    assert.deepEqual(before.inventory.memberships, [], 'Conflicting candidate membership')
    report.events.push({ phase: 'before', ...before })
    checkAbort()
    primary = new Client(primaryConfig)
    primary.on('error', () => { asynchronousFailure = true })
    await primary.connect()
    const identity = checkedIdentity((await primary.query(identitySql)).rows[0], authority)
    let xid
    for (const phase of plan.phases) {
      report.stage = phase.name
      checkAbort()
      // A single constructed Client is retained; no pool, retry, reconnect or
      // replacement connection exists inside this transaction.
      if (phase.name === 'begin') attemptedBegin = true
      const result = await primary.query(phase.sql)
      const results = Array.isArray(result) ? result : [result]
      assert.ok(results.every((item) => item.command !== 'COMMIT'), 'Unexpected transaction end')
      report.events.push({ phase: phase.name, results: results.map(({ command, rows }) => ({ command, rows })) })
      if (phase.name === 'rollback') {
        assert.equal(results.at(-1).command, 'ROLLBACK')
        report.rollback = 'ACKNOWLEDGED'
      } else {
        if (phase.name === 'begin') assert.equal(results.at(-1).command, 'BEGIN')
        const current = (await primary.query(transactionSql)).rows[0]
        assert.equal(current.pid, identity.pid, 'Backend switched')
        assert.equal(current.principal, 'postgres', 'Role was not reset')
        assert.ok(typeof current.xid === 'string' && /^\d+$/.test(current.xid))
        if (xid === undefined) xid = current.xid
        assert.equal(current.xid, xid, 'Transaction switched')
        report.events.push({ phase: `${phase.name}:identity`, ...current })
      }
    }
    report.outcome = 'REHEARSAL_STATEMENTS_ACCEPTED'
  } catch (error) {
    // Do not log raw driver errors, connection configuration or credentials.
    report.failureCode = /^[A-Z0-9]{5}$/.test(error?.code ?? '') ? error.code : 'RUNNER_ASSERTION_OR_CONNECTION_FAILURE'
    if (primary && attemptedBegin && report.rollback !== 'ACKNOWLEDGED') {
      try {
        const result = await primary.query('ROLLBACK;')
        assert.equal(result.command, 'ROLLBACK')
        report.rollback = 'ACKNOWLEDGED_AFTER_FAILURE'
      } catch {
        report.rollback = 'UNCONFIRMED_CONNECTION_LOSS'
      }
    }
  } finally {
    if (primary) {
      try { await primary.end() } catch { report.closeFailure = true }
    }
    if (before) {
      // Fresh independently authenticated observer; no transaction state is
      // reused. Failure never grants cleanup authority or a zero-residue claim.
      try {
        const after = await observe()
        report.events.push({ phase: 'after', ...after })
        assert.deepEqual(after.inventory, before.inventory)
        report.residual = 'ZERO_CATALOG_DELTA'
      } catch {
        report.residual = 'REVIEW_REQUIRED_RESIDUAL_OR_OBSERVER_FAILURE'
      }
    }
  }
  if (report.outcome === 'REHEARSAL_STATEMENTS_ACCEPTED' && report.rollback === 'ACKNOWLEDGED'
    && report.residual === 'ZERO_CATALOG_DELTA' && !report.closeFailure && !asynchronousFailure) {
    report.outcome = 'ROLLBACK_REHEARSAL_PASS_ONLY'
  } else {
    report.outcome = 'FAIL_CLOSED'
  }
  return report
}
