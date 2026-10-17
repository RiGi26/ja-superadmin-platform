import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isSuperadminEmail } from '@/lib/superadmin'
import { e1WorkspaceRequestSchema, encodeE1WorkspaceRequest } from '@/lib/e1-workspace'

export const CORE_DEV_REF = 'mcvekinhgcqygfddyifs' as const
export const CORE_DEV_ORIGIN = `https://${CORE_DEV_REF}.supabase.co` as const

// Source-only candidate. No environment variable or request can activate it.
export const CORE_COMPANY_RUNTIME_ENABLED = false as const
export const coreCompanyReviewRequired = Object.freeze([
  'REVIEW_REQUIRED_FIRST_OWNER_AUTHORITY',
  'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT',
  'REVIEW_REQUIRED_MANAGED_SESSION_REVOCATION',
  'REVIEW_REQUIRED_PROVIDER_ROLE_CLOSURE',
  'REVIEW_REQUIRED_CLEAN_E1_PROVENANCE',
  'REVIEW_REQUIRED_CODEC_INTEGRATION',
] as const)

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  .transform((value) => value.toLowerCase())
const accessRequest = z.object({
  companyId: uuid.optional(), // A selector to compare, never an authority claim.
  operation: z.enum(['read', 'owner_command']),
}).strict()
const authUser = z.object({ error: z.null(), data: z.object({ user: z.object({
  id: uuid, email: z.string().email(), is_anonymous: z.literal(false),
  email_confirmed_at: z.string().datetime({ offset: true }),
}) }) })
const authClaims = z.object({ error: z.null(), data: z.object({ claims: z.object({
  sub: uuid, session_id: uuid, iss: z.literal(`${CORE_DEV_ORIGIN}/auth/v1`),
  aud: z.literal('authenticated'), exp: z.number().int().positive(),
  user_role: z.string().optional(),
}) }) })
const membershipRows = z.array(z.object({
  id: uuid, company_id: uuid, core_auth_user_id: uuid,
  role: z.enum(['owner', 'admin', 'member']), status: z.enum(['active', 'revoked']),
  company: z.object({ id: uuid, status: z.enum(['active', 'inactive', 'retired']) }),
}))

// Denial-only screening of UNTRUSTED claims. Positive classification requires
// the source broker described in SECURITY_DECISION_MATRIX.md; it does not exist.
const firstOwnerClaim = z.object({
  case: z.enum(['new', 'legacy', 'disputed', 'unknown']),
  observedHistory: z.record(z.enum(['onboarding', 'provisioning', 'company', 'legacy',
    'portal', 'financial', 'dispute']), z.number().int().nonnegative().nullable()).nullable(),
}).strict()
type FirstOwnerScreen = Readonly<{
  classification: 'UNKNOWN' | 'E2_E3'
  canBootstrap: false
  manualOperatorMinimum: 2 | null
  reason: string
}>
function screenFirstOwnerClaim(input: unknown): FirstOwnerScreen {
  const claim = firstOwnerClaim.safeParse(input)
  if (!claim.success) return { classification: 'UNKNOWN', canBootstrap: false,
    manualOperatorMinimum: null, reason: 'invalid_or_untrusted_eligibility_claim' }
  if (claim.data.case === 'legacy' || claim.data.case === 'disputed' ||
    Object.values(claim.data.observedHistory ?? {}).some((count) => count !== null && count > 0)) {
    return { classification: 'E2_E3', canBootstrap: false,
      manualOperatorMinimum: 2, reason: 'legacy_or_disputed_requires_independent_s1_command' }
  }
  // Zero claims, empty DEV, email confirmation and operator counts cannot prove
  // authoritative history coverage. There is intentionally no E1 allow result.
  return { classification: 'UNKNOWN', canBootstrap: false,
    manualOperatorMinimum: null, reason: 'REVIEW_REQUIRED_CLEAN_E1_PROVENANCE' }
}

type Actor = Readonly<{ subject: string; sessionId: string; expiresAt: number; checkedAt: number }>
type Db = Awaited<ReturnType<typeof createClient>>
type AccessRequest = z.infer<typeof accessRequest>
type Membership = z.infer<typeof membershipRows>[number]
export type CoreCompanyCandidate = {
  enabled: false
  accessReady: false
  writesPermitted: false
  status: 'rejected' | 'hold' | 'blocked'
  code: string
  company: null
  reviewRequired: typeof coreCompanyReviewRequired
}

const observedActors = new WeakSet<Actor>()
function denied(status: CoreCompanyCandidate['status'], code: string): CoreCompanyCandidate {
  return { enabled: false, accessReady: false, writesPermitted: false, status, code,
    company: null, reviewRequired: coreCompanyReviewRequired }
}

// Private verifier: callers cannot supply Auth responses or a database client.
// getUser + signed claims are observations, not a database/session capability.
async function observeActor(db: Db): Promise<Actor | null> {
  const user = authUser.safeParse(await db.auth.getUser())
  if (!user.success || Date.parse(user.data.data.user.email_confirmed_at) > Date.now() ||
    isSuperadminEmail(user.data.data.user.email)) return null
  const claims = authClaims.safeParse(await db.auth.getClaims())
  if (!claims.success || claims.data.data.claims.sub !== user.data.data.user.id ||
    claims.data.data.claims.user_role === 'superadmin' ||
    claims.data.data.claims.exp * 1000 <= Date.now()) return null
  const actor = Object.freeze({ subject: user.data.data.user.id,
    sessionId: claims.data.data.claims.session_id, expiresAt: claims.data.data.claims.exp * 1000,
    checkedAt: Date.now() })
  observedActors.add(actor)
  return actor
}

function sameActor(before: Actor, after: Actor): boolean {
  return observedActors.has(before) && observedActors.has(after) && before !== after &&
    before.subject === after.subject && before.sessionId === after.sessionId &&
    after.checkedAt >= before.checkedAt && after.expiresAt > Date.now()
}

// Shape/consistency contract only. No issuer/store/connection exists locally;
// even a complete mock envelope can only reach the unconditional refusal below.
const sourceObservation = z.object({
  state: z.enum(['clean', 'history', 'conflict', 'unavailable']), complete: z.boolean(),
  revision: z.string().min(1).max(128), fence: z.string().min(1).max(128),
}).strict()
const sourceCoverage = z.object({
  onboarding: sourceObservation, provisioning: sourceObservation, company: sourceObservation,
  legacy: sourceObservation, portal: sourceObservation, financial: sourceObservation,
  dispute: sourceObservation,
}).strict()
const w1Envelope = z.object({
  issuer: z.literal(`${CORE_DEV_ORIGIN}/auth/v1`), project: z.literal(CORE_DEV_REF),
  audience: z.literal('wz_core_executor'), subject: uuid, sessionId: uuid, assertionId: uuid,
  nonce: uuid, idempotencyKey: uuid, companyId: z.null(),
  managedSessionState: z.enum(['active', 'revoked', 'unknown']),
  action: z.literal('new_company_initial_owner'), sourceRef: uuid, intentRevision: z.string().min(1).max(128),
  classification: z.enum(['E1', 'E2_E3', 'UNKNOWN']),
  codec: z.literal('e1:v2'), requestScope: z.string().regex(/^[0-9a-f]{64}$/),
  payloadFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  issuedAt: z.number().int().nonnegative(), expiresAt: z.number().int().nonnegative(),
  sourcesBeforeWait: sourceCoverage, sourcesAfterWait: sourceCoverage,
}).strict()
function inspectW1Contract(input: unknown, before: Actor, after: Actor,
  canonical: Readonly<{ idempotencyKey: string; requestScope: string; payloadFingerprint: string }>): CoreCompanyCandidate {
  if (!sameActor(before, after)) return denied('rejected', 'actor_or_session_changed')
  const parsed = w1Envelope.safeParse(input)
  if (!parsed.success) return denied('rejected', 'invalid_w1_contract')
  const value = parsed.data
  if (value.managedSessionState !== 'active') return denied('rejected', 'managed_session_not_current')
  if (value.subject !== before.subject || value.sessionId !== before.sessionId ||
    value.idempotencyKey !== canonical.idempotencyKey || value.requestScope !== canonical.requestScope ||
    value.payloadFingerprint !== canonical.payloadFingerprint) {
    return denied('rejected', 'w1_binding_mismatch')
  }
  // Times are not proof. No unapproved TTL is adopted; an actual bounded TTL
  // remains part of the provider-verified issuer/store contract.
  if (value.issuedAt > before.checkedAt || value.expiresAt <= after.checkedAt ||
    value.expiresAt <= Date.now() || value.expiresAt > Math.min(before.expiresAt, after.expiresAt)) {
    return denied('rejected', 'stale_w1_contract')
  }
  for (const name of Object.keys(value.sourcesBeforeWait) as (keyof typeof value.sourcesBeforeWait)[]) {
    const initial = value.sourcesBeforeWait[name]; const current = value.sourcesAfterWait[name]
    if (!initial.complete || !current.complete || initial.state === 'unavailable' || current.state === 'unavailable') {
      return denied('hold', 'incomplete_source_coverage')
    }
    if (initial.state !== 'clean' || current.state !== 'clean' || value.classification === 'E2_E3') {
      return denied('hold', 'legacy_or_disputed_requires_independent_s1_command')
    }
    if (initial.revision !== current.revision || initial.fence !== current.fence) {
      return denied('rejected', 'source_changed_after_wait')
    }
  }
  if (value.classification !== 'E1') return denied('hold', 'REVIEW_REQUIRED_FIRST_OWNER_AUTHORITY')
  // All fields could still be fabricated. Do not mark the observation trusted,
  // consume assertions, connect an executor or mint an Owner capability.
  return denied('blocked', 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT')
}

// Authorization policy only. A matching row never lifts the transport/session fuse.
function matchMembership(actor: Actor, request: AccessRequest, rows: unknown): Membership | null {
  if (!observedActors.has(actor) || actor.expiresAt <= Date.now()) return null
  const parsed = membershipRows.safeParse(rows)
  // No LIMIT 1 or status filter hiding ambiguity/revoked history. Rejoin/transfer
  // needs its own approved lifecycle; this candidate cannot guess that history.
  if (!parsed.success || parsed.data.length !== 1) return null
  const row = parsed.data[0]
  if (row.core_auth_user_id !== actor.subject || row.company_id !== row.company.id ||
    row.status !== 'active' || row.company.status !== 'active' ||
    (request.companyId !== undefined && request.companyId !== row.company_id) ||
    (request.operation === 'owner_command' && row.role !== 'owner')) return null
  return row
}

// Denial-only Owner contract. These fields describe protected-store observations;
// parsing them does not authenticate an issuer, check Auth or consume an assertion.
const ownerObservation = z.object({
  subject: uuid, sessionId: uuid, checkedAt: z.number().int().nonnegative(),
  sessionState: z.enum(['active', 'revoked', 'unknown']),
  accountState: z.enum(['eligible', 'disabled', 'unknown']),
  sessionValidUntil: z.number().int().positive(),
  membershipId: uuid, membershipRevision: z.string().min(1).max(128),
  provenance: z.enum(['verified', 'unknown', 'disputed']),
  provenanceRevision: z.string().min(1).max(128), fence: z.string().min(1).max(128),
}).strict()
const ownerW1Envelope = z.object({
  issuer: z.literal(`${CORE_DEV_ORIGIN}/auth/v1`), project: z.literal(CORE_DEV_REF),
  audience: z.literal('wz_core_executor'), subject: uuid, sessionId: uuid,
  assertionId: uuid, nonce: uuid, state: z.enum(['unused', 'consumed', 'revoked']),
  action: z.literal('owner_command'), companyId: uuid, idempotencyKey: uuid,
  requestScope: z.string().regex(/^[0-9a-f]{64}$/),
  payloadFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  issuedAt: z.number().int().nonnegative(), expiresAt: z.number().int().positive(),
  beforeWait: ownerObservation, afterWait: ownerObservation,
}).strict()
type CommandBinding = Readonly<{
  idempotencyKey: string; requestScope: string; payloadFingerprint: string
}>
function inspectOwnerW1Contract(input: unknown, before: Actor, after: Actor,
  request: AccessRequest, rowsBefore: unknown, rowsAfter: unknown,
  binding: CommandBinding | null): CoreCompanyCandidate {
  if (!sameActor(before, after)) return denied('rejected', 'actor_or_session_changed')
  // The current lane has no protected store or second authoritative observation.
  if (input === null) return denied('blocked', 'REVIEW_REQUIRED_MANAGED_SESSION_REVOCATION')
  const parsed = ownerW1Envelope.safeParse(input)
  if (!parsed.success || !binding || request.operation !== 'owner_command') {
    return denied('rejected', 'invalid_owner_w1_contract')
  }
  const value = parsed.data
  if (value.subject !== before.subject || value.sessionId !== before.sessionId ||
    value.idempotencyKey !== binding.idempotencyKey || value.requestScope !== binding.requestScope ||
    value.payloadFingerprint !== binding.payloadFingerprint) return denied('rejected', 'w1_binding_mismatch')
  if (value.state !== 'unused') return denied('rejected', 'owner_assertion_not_current')
  const initial = matchMembership(before, request, rowsBefore)
  const current = matchMembership(after, request, rowsAfter)
  if (!initial || !current || initial.id !== current.id || initial.company_id !== current.company_id ||
    value.companyId !== current.company_id) return denied('hold', 'owner_membership_not_current')
  for (const [observation, actor, row] of [
    [value.beforeWait, before, initial], [value.afterWait, after, current],
  ] as const) {
    if (observation.subject !== actor.subject || observation.sessionId !== actor.sessionId ||
      observation.membershipId !== row.id || observation.checkedAt !== actor.checkedAt) {
      return denied('rejected', 'owner_observation_binding_mismatch')
    }
    if (observation.sessionState !== 'active' || observation.accountState !== 'eligible') {
      return denied('rejected', 'managed_session_not_current')
    }
    if (observation.provenance !== 'verified') return denied('hold', 'owner_provenance_unproven')
  }
  if (value.beforeWait.membershipRevision !== value.afterWait.membershipRevision ||
    value.beforeWait.provenanceRevision !== value.afterWait.provenanceRevision ||
    value.beforeWait.fence !== value.afterWait.fence) return denied('rejected', 'owner_authority_changed_after_wait')
  if (value.issuedAt > before.checkedAt || value.expiresAt <= after.checkedAt ||
    value.expiresAt <= Date.now() || value.expiresAt > Math.min(before.expiresAt, after.expiresAt,
      value.beforeWait.sessionValidUntil, value.afterWait.sessionValidUntil)) {
    return denied('rejected', 'stale_owner_w1_contract')
  }
  // Even perfectly forged fields cannot produce an authorization capability.
  // Protected issuance, atomic replay consumption and live post-lock revalidation
  // are unimplemented. No connection, credential, callback or writer is invoked.
  return denied('blocked', 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT')
}

function restrictedExecutor(actor: Actor, after: Actor, command: Readonly<{
  subject: string; sessionId: string; sourceRef: null; action: 'new_company_initial_owner'
  classification: 'UNKNOWN'; requestScope: string; payloadFingerprint: string
}>): CoreCompanyCandidate {
  if (!sameActor(actor, after) || command.subject !== actor.subject || command.sessionId !== actor.sessionId) {
    return denied('rejected', 'actor_or_session_changed')
  }
  if (command.sourceRef !== null || command.action !== 'new_company_initial_owner' ||
    command.classification !== 'UNKNOWN') return denied('rejected', 'untrusted_creation_authority')
  // UUID/hash fields are correlations, not verified transport. No database
  // handle, callback, service key, credential or RPC is available in this lane.
  // DEC-2026-029's dated E1 amendment is business authority only. This lane
  // cannot classify clean E1 or bypass S1 dual operators for legacy claims.
  return denied('blocked', 'REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT')
}

async function inspectMembership(request: AccessRequest): Promise<CoreCompanyCandidate> {
  const db = await createClient()
  const actor = await observeActor(db)
  if (!actor) return denied('rejected', 'verified_customer_session_required')
  const response = await db.from('company_memberships')
    .select('id, company_id, core_auth_user_id, role, status, company:companies!inner(id, status)')
    .eq('core_auth_user_id', actor.subject)
  if (response.error || !matchMembership(actor, request, response.data)) {
    return denied('hold', 'company_membership_unavailable_or_not_authorized')
  }
  const refreshed = await observeActor(db)
  if (!refreshed || !sameActor(actor, refreshed)) return denied('rejected', 'actor_or_session_changed')
  if (request.operation === 'owner_command') {
    return inspectOwnerW1Contract(null, actor, refreshed, request, response.data, null, null)
  }
  // Reads alone cannot prove complete history or revocation during SQL locks.
  return denied('blocked', 'REVIEW_REQUIRED_MANAGED_SESSION_REVOCATION')
}

export async function getCoreCompanyCandidate(input: unknown): Promise<CoreCompanyCandidate> {
  const request = accessRequest.safeParse(input)
  if (!request.success) return denied('rejected', 'invalid_request')
  if (!CORE_COMPANY_RUNTIME_ENABLED) return denied('blocked', 'core_company_runtime_disabled')
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== CORE_DEV_ORIGIN) return denied('rejected', 'dev_origin_required')
  try { return await inspectMembership(request.data) } catch { return denied('rejected', 'identity_or_registry_unavailable') }
}

async function inspectBootstrap(input: z.infer<typeof e1WorkspaceRequestSchema>): Promise<CoreCompanyCandidate> {
  const db = await createClient()
  const actor = await observeActor(db)
  if (!actor) return denied('rejected', 'verified_customer_session_required')
  const canonical = encodeE1WorkspaceRequest(actor.subject, input)
  const screening = screenFirstOwnerClaim({ case: 'unknown', observedHistory: null })
  if (screening.canBootstrap) return denied('rejected', 'untrusted_creation_authority')
  const command = Object.freeze({ subject: actor.subject, sessionId: actor.sessionId,
    sourceRef: null, action: 'new_company_initial_owner' as const, classification: 'UNKNOWN' as const,
    requestScope: canonical.requestScope, payloadFingerprint: canonical.payloadFingerprint })
  const after = await observeActor(db)
  if (!after) return denied('rejected', 'verified_customer_session_required')
  // A trusted broker is absent. Passing no envelope fails closed. Private mock
  // tests exercise the proposed bindings; no request can inject this envelope.
  const contract = inspectW1Contract(null, actor, after, canonical)
  if (contract.code !== 'invalid_w1_contract') return contract
  // No clean-history inference or automatic Owner grant. SQL provenance, codec,
  // post-lock session binding and managed executor are still separately gated.
  return restrictedExecutor(actor, after, command)
}

export async function requestCoreCompanyBootstrap(input: unknown): Promise<CoreCompanyCandidate> {
  const request = e1WorkspaceRequestSchema.safeParse(input)
  if (!request.success) return denied('rejected', 'invalid_request')
  if (!CORE_COMPANY_RUNTIME_ENABLED) return denied('blocked', 'core_company_runtime_disabled')
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== CORE_DEV_ORIGIN) return denied('rejected', 'dev_origin_required')
  try { return await inspectBootstrap(request.data) } catch { return denied('rejected', 'identity_or_registry_unavailable') }
}
