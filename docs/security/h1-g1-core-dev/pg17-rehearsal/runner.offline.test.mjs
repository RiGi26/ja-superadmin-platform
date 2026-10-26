// Scripted scheduling/error tests only. No PostgreSQL driver or network import.
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { HOST, PROJECT, PHASES, loadPlan, rehearse, sha256 } from './runner.PROPOSED.mjs'

const approvedHashes = Object.fromEntries(Object.entries({ sql: 'capability.PROPOSED.sql',
  inventory: 'inventory.READ_ONLY.sql', runner: 'runner.PROPOSED.mjs' })
  .map(([key, name]) => [key, sha256(readFileSync(new URL(name, import.meta.url)))]))
const plan = loadPlan(approvedHashes)
const authority = { projectRef: PROJECT, host: HOST, database: 'postgres',
  isolatedSyntheticDev: true, zeroIncrementalCost: true, privateProbeSchemaExcludedFromDataApi: true,
  reviewedNoExternalHooks: true,
  ownerApprovalRef: 'OFFLINE_FIXTURE_NOT_OWNER_AUTHORITY' }
const empty = () => ({ roles: [], memberships: [], schemas: [], relations: [], functions: [],
  default_acls: [], shared_dependencies: [], primary_sessions: [] })

function harness(options = {}) {
  const calls = []
  const clients = []
  let dirty = false
  let phaseFailure = false
  let identities = 0
  class Client extends EventEmitter {
    constructor(config) {
      super()
      this.config = config
      this.id = clients.length + 101
      this.primary = config.application_name === 'h1g1-r17-primary'
      this.closed = false
      clients.push(this)
    }
    async connect() {
      calls.push({ id: this.id, operation: 'connect' })
      if ((this.primary && options.primaryConnectFailure) ||
        (!this.primary && clients.length === 3 && options.observerFailure)) throw new Error('DO_NOT_LOG_SECRET')
    }
    async query(sql) {
      const phase = plan.phases.find((entry) => entry.sql === sql)?.name
      const name = phase ?? (sql === 'ROLLBACK;' ? 'emergency_rollback' :
        sql.includes('pg_current_xact_id()') ? 'identity' :
          sql.includes('AS inventory') ? 'inventory' : 'connection_identity')
      calls.push({ id: this.id, operation: name })
      if (name === 'connection_identity') return { rows: [{ pid: this.id, backend_start: 'FIXTURE_START',
        database: 'postgres', principal: 'postgres', session_principal: 'postgres', version: 170011,
        encoding: 'UTF8', tls: !options.noTls }] }
      if (name === 'inventory') {
        const inventory = empty()
        if (dirty || (clients.length === 3 && options.residual)) inventory.roles = ['FIXTURE_RESIDUE']
        if (options.conflict && clients.length === 1) inventory.roles = ['FIXTURE_CONFLICT']
        if (clients.length === 3 && options.lingeringSession) inventory.primary_sessions = [102]
        return { rows: [{ inventory }] }
      }
      if (name === 'identity') {
        identities++
        return { rows: [{ pid: options.backendSwitch && identities > 1 ? 999 : this.id,
          xid: options.transactionSwitch && identities > 1 ? '901' : '900', principal: 'postgres' }] }
      }
      if ((options.failAt === name && !phaseFailure) ||
        (options.rollbackLoss && (name === 'rollback' || name === 'emergency_rollback'))) {
        phaseFailure = true
        if (options.disconnectRollback) dirty = false // simulated server abort, not PG evidence
        const error = new Error('DO_NOT_LOG_SECRET')
        error.code = '42501'
        throw error
      }
      if (options.disconnectRollback && phaseFailure && name === 'emergency_rollback') throw new Error('disconnected')
      if (name === 'roles') dirty = true
      if (name === 'rollback' || name === 'emergency_rollback') dirty = false
      if (name === options.abortAfter) options.controller.abort()
      if (name === options.emitErrorAfter) this.emit('error', new Error('DO_NOT_LOG_SECRET'))
      return { command: name === 'begin' ? 'BEGIN' :
        name === 'rollback' || name === 'emergency_rollback' ? 'ROLLBACK' : 'DO', rows: [] }
    }
    async end() { this.closed = true; calls.push({ id: this.id, operation: 'end' }) }
  }
  const run = (override = {}) => rehearse({ Client, password: 'DO_NOT_LOG_SECRET', ca: 'OFFLINE_CA',
    approvedHashes, authority, signal: options.controller?.signal, ...override })
  return { run, calls, clients }
}

test('exact approved plan has one begin and terminal rollback', () => {
  assert.deepEqual(plan.phases.map(({ name }) => name), PHASES)
  assert.equal(plan.phases[0].sql.trim(), 'BEGIN ISOLATION LEVEL READ COMMITTED;')
  assert.equal(plan.phases.at(-1).sql.trim(), 'ROLLBACK;')
})
test('source hash mismatch denies before any connection', async () => {
  const h = harness()
  await assert.rejects(h.run({ approvedHashes: { ...approvedHashes, sql: '0'.repeat(64) } }))
  assert.equal(h.clients.length, 0)
})
for (const key of ['projectRef', 'host', 'database', 'isolatedSyntheticDev', 'zeroIncrementalCost',
  'privateProbeSchemaExcludedFromDataApi', 'reviewedNoExternalHooks', 'ownerApprovalRef']) {
  test(`missing ${key} denies before connection`, async () => {
    const h = harness()
    await assert.rejects(h.run({ authority: { ...authority, [key]: undefined } }))
    assert.equal(h.clients.length, 0)
  })
}
test('one primary client, one transaction, fresh independent after observer', async () => {
  const h = harness()
  const report = await h.run()
  assert.equal(report.outcome, 'ROLLBACK_REHEARSAL_PASS_ONLY')
  assert.equal(report.residual, 'ZERO_CATALOG_DELTA')
  assert.equal(h.clients.length, 3)
  assert.ok(h.clients.every(({ closed }) => closed))
  const primary = h.calls.filter(({ id }) => id === 102)
  assert.equal(primary.filter(({ operation }) => operation === 'begin').length, 1)
  assert.equal(primary.filter(({ operation }) => operation === 'rollback').length, 1)
  assert.equal(primary.filter(({ operation }) => operation === 'identity').length, PHASES.length - 1)
  assert.ok(!JSON.stringify(report).includes('DO_NOT_LOG_SECRET'))
  assert.ok(h.clients.every(({ config }) => config.host === HOST && config.port === 5432 &&
    config.ssl.rejectUnauthorized === true && config.ssl.servername === HOST))
})
for (const failAt of PHASES) {
  test(`failure at ${failAt} stops remaining mutations and attempts same-client rollback`, async () => {
    const h = harness({ failAt })
    const report = await h.run()
    assert.equal(report.outcome, 'FAIL_CLOSED')
    assert.equal(report.residual, 'ZERO_CATALOG_DELTA')
    assert.match(report.rollback, /^ACKNOWLEDGED/)
    const primary = h.calls.filter(({ id }) => id === 102)
    const index = primary.findIndex(({ operation }) => operation === failAt)
    assert.deepEqual(primary.slice(index + 1).map(({ operation }) => operation), ['emergency_rollback', 'end'])
    assert.ok(!JSON.stringify(report).includes('DO_NOT_LOG_SECRET'))
  })
}
for (const condition of ['backendSwitch', 'transactionSwitch', 'noTls', 'residual', 'observerFailure', 'lingeringSession']) {
  test(`${condition} cannot return runtime acceptance`, async () => {
    const h = harness({ [condition]: true })
    const report = await h.run()
    assert.equal(report.outcome, 'FAIL_CLOSED')
  })
}
test('pre-existing role stops before primary connection', async () => {
  const h = harness({ conflict: true })
  assert.equal((await h.run()).outcome, 'FAIL_CLOSED')
  assert.ok(!h.clients.some(({ primary }) => primary))
})
test('primary connect failure still uses independent observer', async () => {
  const h = harness({ primaryConnectFailure: true })
  const report = await h.run()
  assert.equal(report.outcome, 'FAIL_CLOSED')
  assert.equal(report.residual, 'ZERO_CATALOG_DELTA')
})
test('lost rollback acknowledgement is never a rollback pass', async () => {
  const h = harness({ failAt: 'denial', disconnectRollback: true })
  const report = await h.run()
  assert.equal(report.outcome, 'FAIL_CLOSED')
  assert.equal(report.rollback, 'UNCONFIRMED_CONNECTION_LOSS')
  assert.equal(report.residual, 'ZERO_CATALOG_DELTA')
})
test('rollback and residual failure preserve unknown recovery state', async () => {
  const h = harness({ rollbackLoss: true })
  const report = await h.run()
  assert.equal(report.outcome, 'FAIL_CLOSED')
  assert.equal(report.rollback, 'UNCONFIRMED_CONNECTION_LOSS')
  assert.equal(report.residual, 'REVIEW_REQUIRED_RESIDUAL_OR_OBSERVER_FAILURE')
})
test('graceful interruption stops before next stage and rolls back', async () => {
  const controller = new AbortController()
  const h = harness({ controller, abortAfter: 'roles' })
  const report = await h.run()
  assert.equal(report.outcome, 'FAIL_CLOSED')
  assert.equal(report.residual, 'ZERO_CATALOG_DELTA')
  assert.ok(!h.calls.some(({ operation }) => operation === 'automatic_membership'))
})
test('asynchronous driver failure prevents subsequent stage', async () => {
  const h = harness({ emitErrorAfter: 'roles' })
  assert.equal((await h.run()).outcome, 'FAIL_CLOSED')
  assert.ok(!h.calls.some(({ operation }) => operation === 'automatic_membership'))
})
