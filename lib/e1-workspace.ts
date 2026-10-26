import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isSuperadminEmail } from '@/lib/superadmin'

// v2 accepts canonical RFC UUIDs (versions 1..8, RFC variant), case-insensitive.
const uuid = z.string().length(36).regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  .transform((value) => value.toLowerCase())
// ECMAScript trim, then NFC. SQL enumerates the same trim code points explicitly.
// Length counts Unicode scalar values,
// not UTF-16 units. Reject C0/C1 controls and unpaired surrogates before UTF-8.
const companyName = z.string().transform((value) => value.trim().normalize('NFC'))
  .refine((value) => [...value].length >= 2 && [...value].length <= 100)
  .refine((value) => [...value].every((character) => {
    const point = character.codePointAt(0)!
    return point >= 32 && !(point >= 127 && point <= 159) && !(point >= 0xd800 && point <= 0xdfff)
  }))

export const e1WorkspaceRequestSchema = z.object({
  companyName,
  idempotencyKey: uuid,
}).strict()

const verifiedUserResponse = z.object({
  error: z.null(),
  data: z.object({
    user: z.object({
      id: uuid,
      email: z.string().email(),
      email_confirmed_at: z.string().datetime({ offset: true }),
      is_anonymous: z.literal(false),
    }),
  }),
})

const verifiedClaimsResponse = z.object({
  error: z.null(),
  data: z.object({ claims: z.object({
    sub: uuid,
    user_role: z.enum(['superadmin', 'owner', 'admin', 'member']).optional(),
  }) }),
})

const countResponse = z.object({ error: z.null(), count: z.number().int().nonnegative() })

export const E1_CODEC_VERSION = 'e1:v2' as const
const reviewRequired = [
  'REVIEW_REQUIRED_IDENTITY_TRANSPORT',
  'REVIEW_REQUIRED_LEGACY_PROVENANCE',
  'REVIEW_REQUIRED_CODEC_INTEGRATION',
] as const

// Logical observations for static contract tests, not a deployed Registry read
// policy or RPC. The production-facing helper below never reads these tables.
const registryObservation = z.object({
  error: z.null(),
  data: z.object({
    observedSubject: uuid,
    hasLegacyHistory: z.boolean(),
    portalInstanceCount: z.number().int().nonnegative(),
    memberships: z.array(z.object({
      core_auth_user_id: uuid,
      company_id: uuid,
      role: z.enum(['owner', 'admin', 'member']),
      status: z.enum(['active', 'revoked']),
      company: z.object({
        id: uuid,
        status: z.enum(['active', 'inactive', 'retired']),
      }),
    })),
  }),
})

export type E1CreationContract = {
  candidateOnly: true
  coreAuthSubject: string
  companyName: string
  initialRole: 'owner'
  source: 'core_e1_new_workspace'
  requestScope: string
  payloadFingerprint: string
  requiresAtomicCompanyOwnerAndAudit: true
  durableIdempotency: 'NOT_IMPLEMENTED'
}

export type E1WorkspaceCandidate = {
  enabled: false
  writesPermitted: false
  status: 'rejected' | 'hold' | 'blocked'
  code: string
  disposition: 'new_company' | 'existing_company' | null
  creationContract: E1CreationContract | null
  reviewRequired: readonly string[]
  hub: {
    accessReady: false
    company: null
    role: null
    workspaceFee: 0
    systems: []
    subscriptions: []
    invoices: []
    payments: []
    trialEndsAt: null
    manageSubscriptionUrl: null
    canSubscribe: false
  }
}

function disabledCandidate(
  status: E1WorkspaceCandidate['status'],
  code: string,
  disposition: E1WorkspaceCandidate['disposition'] = null,
  creationContract: E1CreationContract | null = null,
): E1WorkspaceCandidate {
  return {
    enabled: false, writesPermitted: false, status, code, disposition, creationContract,
    reviewRequired,
    hub: {
      accessReady: false, company: null, role: null, workspaceFee: 0,
      systems: [], subscriptions: [], invoices: [], payments: [],
      trialEndsAt: null, manageSubscriptionUrl: null, canSubscribe: false,
    },
  }
}

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')

// STATIC_DRAFT_ONLY / DO_NOT_APPLY. Requirements, not credentials or approval.
// No current Core source authenticates a request source to a SQL connection,
// proves session continuity/revocation after a lock wait, or grants invocation.
const e1TransportRequirements = Object.freeze({
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
} as const)

type E1CoreActor = Readonly<{
  subject: string
  email: string
  emailConfirmedAt: string
  denialOnlyRole: string | undefined
  checkedAt: number
}>
type E1Correlation = Readonly<{
  sourceRef: string
  origin: 'core_e1_new_workspace'
  kind: 'server_generated_correlation_only'
  independentlyAuthenticated: false
  subject: string
  requestScope: string
  payloadFingerprint: string
}>

// Private process-local ownership rejects copied/caller-created observations.
// It proves neither provider session identity nor database invocation authority.
const observedActors = new WeakSet<E1CoreActor>()
const generatedCorrelations = new WeakSet<E1Correlation>()

async function verifyE1CoreActor(db: Awaited<ReturnType<typeof createClient>>): Promise<
  { ok: true; actor: E1CoreActor } | { ok: false; code: string }
> {
  // Deliberately uncached: render-pass memoization cannot reverify after waiting.
  const auth = verifiedUserResponse.safeParse(await db.auth.getUser())
  if (!auth.success || Date.parse(auth.data.data.user.email_confirmed_at) > Date.now()) {
    return { ok: false, code: 'verified_core_account_required' }
  }
  const user = auth.data.data.user
  const claims = verifiedClaimsResponse.safeParse(await db.auth.getClaims())
  if (!claims.success || claims.data.data.claims.sub !== user.id) {
    return { ok: false, code: 'core_session_identity_mismatch' }
  }
  // Existing Core operator exclusions are denial-only, never Owner authority.
  if (claims.data.data.claims.user_role === 'superadmin' || isSuperadminEmail(user.email)) {
    return { ok: false, code: 'customer_identity_required' }
  }
  const actor = Object.freeze({
    subject: user.id, email: user.email, emailConfirmedAt: user.email_confirmed_at,
    denialOnlyRole: claims.data.data.claims.user_role, checkedAt: Date.now(),
  })
  observedActors.add(actor)
  return { ok: true, actor }
}

function createE1Correlation(canonical: ReturnType<typeof encodeE1WorkspaceRequest>): E1Correlation {
  // Generated once per local request, preserved across waits; never a trusted
  // source_ref, session bridge, signer, token, or proof of writer authority.
  const correlation = Object.freeze({
    sourceRef: randomUUID(), origin: 'core_e1_new_workspace',
    kind: 'server_generated_correlation_only',
    independentlyAuthenticated: e1TransportRequirements.correlationIsAuthenticatedProvenance,
    subject: canonical.coreAuthSubject, requestScope: canonical.requestScope,
    payloadFingerprint: canonical.payloadFingerprint,
  } as const)
  generatedCorrelations.add(correlation)
  return correlation
}

function sameE1Actor(initial: E1CoreActor, current: E1CoreActor): boolean {
  return observedActors.has(initial) && observedActors.has(current) && initial !== current &&
    current.checkedAt >= initial.checkedAt && initial.subject === current.subject &&
    initial.email === current.email && initial.emailConfirmedAt === current.emailConfirmedAt &&
    initial.denialOnlyRole === current.denialOnlyRole
}

/** Private hard-disabled boundary; no database handle, callback or activation option. */
function restrictedE1WriterAdapter(
  initial: E1CoreActor,
  afterWait: E1CoreActor,
  source: E1Correlation,
  afterWaitSource: E1Correlation,
  postLock?: { actor: E1CoreActor; source: E1Correlation },
): E1WorkspaceCandidate {
  if (!sameE1Actor(initial, afterWait)) {
    return disabledCandidate('rejected', 'core_session_identity_changed')
  }
  if (!generatedCorrelations.has(source) || !generatedCorrelations.has(afterWaitSource) ||
    source !== afterWaitSource || source.subject !== initial.subject) {
    return disabledCandidate('rejected', 'untrusted_or_changed_source_ref')
  }
  // Hypothetical post-lock observations can only deny. No lock is acquired here,
  // and passing matching observations cannot establish a transactional binding.
  if (postLock && (!sameE1Actor(afterWait, postLock.actor) || postLock.source !== source)) {
    return disabledCandidate('rejected', 'post_lock_actor_or_source_changed')
  }
  // Unconditional refusal, including valid Auth and matching post-lock mocks.
  // No environment/request field, service key, JWT role or UUID can lift this.
  return disabledCandidate('blocked', 'REVIEW_REQUIRED_IDENTITY_TRANSPORT')
}

/** Pure codec only: a caller-supplied subject here is NEVER authentication. */
export function encodeE1WorkspaceRequest(coreAuthSubject: string, input: unknown) {
  const subject = uuid.parse(coreAuthSubject)
  const request = e1WorkspaceRequestSchema.parse(input)
  // ASCII framing plus hex-encoded UTF-8 avoids JSON escaping/spacing ambiguity.
  const nameHex = Buffer.from(request.companyName, 'utf8').toString('hex')
  return {
    codecVersion: E1_CODEC_VERSION,
    coreAuthSubject: subject,
    ...request,
    requestScope: digest(`${E1_CODEC_VERSION}:scope:${subject}:${request.idempotencyKey}`),
    payloadFingerprint: digest(`${E1_CODEC_VERSION}:payload:${subject}:${nameHex}`),
  }
}

/** Static evaluation only. Even valid observations cannot authorize a write or Hub access. */
export function assessE1WorkspaceContract(
  input: unknown,
  currentAuthResponse: unknown,
  registryResponse?: unknown,
): E1WorkspaceCandidate {
  const request = e1WorkspaceRequestSchema.safeParse(input)
  if (!request.success) return disabledCandidate('rejected', 'invalid_request')

  const auth = verifiedUserResponse.safeParse(currentAuthResponse)
  if (!auth.success || Date.parse(auth.data.data.user.email_confirmed_at) > Date.now()) {
    return disabledCandidate('rejected', 'verified_core_account_required')
  }
  const subject = auth.data.data.user.id

  // No environment flag, client field, JWT role or mock approval can activate E1.
  if (registryResponse === undefined) {
    return disabledCandidate('blocked', 'registry_writer_audit_review_required')
  }
  const registry = registryObservation.safeParse(registryResponse)
  if (!registry.success) return disabledCandidate('hold', 'registry_observation_unavailable')
  if (registry.data.data.observedSubject !== subject) {
    return disabledCandidate('hold', 'registry_subject_mismatch')
  }
  const { memberships, hasLegacyHistory, portalInstanceCount } = registry.data.data
  if (hasLegacyHistory) return disabledCandidate('hold', 'legacy_or_conflicting_history')
  if (memberships.length > 1) return disabledCandidate('hold', 'ambiguous_company_membership')

  if (memberships.length === 1) {
    const membership = memberships[0]
    if (
      membership.core_auth_user_id !== subject ||
      membership.company_id !== membership.company.id ||
      membership.status !== 'active' || membership.company.status !== 'active'
    ) return disabledCandidate('hold', 'company_membership_not_eligible')
    // Existing membership never proposes a new Company or promotes a staff role.
    return disabledCandidate('blocked', 'registry_writer_audit_review_required', 'existing_company')
  }
  if (portalInstanceCount !== 0) return disabledCandidate('hold', 'existing_product_history')

  // Negative Registry observations do not establish complete Stock/LMS/financial
  // or pending/disputed claim history, nor coordination with other writers.
  // Never turn test observations or a caller's "no history" into E1 eligibility.
  return disabledCandidate('blocked', 'REVIEW_REQUIRED_LEGACY_PROVENANCE')
}

/** Internal, unwired gateway. Uses the cookie-bound anon client, never admin/RPC. */
export async function getE1WorkspaceCandidate(input: unknown): Promise<E1WorkspaceCandidate> {
  const request = e1WorkspaceRequestSchema.safeParse(input)
  if (!request.success) {
    return disabledCandidate('rejected', 'invalid_request')
  }
  try {
    const db = await createClient()
    const initial = await verifyE1CoreActor(db)
    if (!initial.ok) return disabledCandidate('rejected', initial.code)
    // Bind canonical scope/fingerprint to the verified server subject and parsed
    // request snapshot. This local codec context is never SQL transport or proof
    // of clean eligibility, and is never passed to a writer or returned as Owner.
    const canonical = encodeE1WorkspaceRequest(initial.actor.subject, request.data)
    const correlation = createE1Correlation(canonical)

    // Source-backed denial-only observations. No active/status filter: revoked,
    // cancelled, manual/imported and pending onboarding history all exclude E1.
    // RLS can hide rows. Even three exact zero counts are NOT clean provenance.
    // PR47 supplies no customer Registry read policy; do not invent one here.
    const observations = await Promise.all([
      db.from('tenant_members').select('user_id', { count: 'exact', head: true }).eq('user_id', canonical.coreAuthSubject),
      db.from('tenants').select('owner_user_id', { count: 'exact', head: true }).eq('owner_user_id', canonical.coreAuthSubject),
      db.from('customer_onboarding').select('owner_user_id', { count: 'exact', head: true }).eq('owner_user_id', canonical.coreAuthSubject),
    ])
    // Recheck the current Auth identity after reads. This does not supply the SQL
    // connection's source_ref or close revocation/impersonation/lock-wait gaps.
    const refreshed = await verifyE1CoreActor(db)
    if (!refreshed.ok || !sameE1Actor(initial.actor, refreshed.actor)) {
      return disabledCandidate('rejected', 'core_session_identity_changed')
    }
    const transport = restrictedE1WriterAdapter(initial.actor, refreshed.actor, correlation, correlation)
    if (transport.status === 'rejected') return transport
    const counts = observations.map((response) => countResponse.safeParse(response))
    if (counts.some((response) => !response.success)) {
      return disabledCandidate('hold', 'core_history_observation_unavailable')
    }
    if (counts.some((response) => response.success && response.data.count > 0)) {
      return disabledCandidate('hold', 'legacy_or_conflicting_history')
    }
    // Identity refusal never clears the independent legacy/codec blockers.
    // Keep the existing denial-only legacy result and all review dependencies.
    return disabledCandidate('blocked', 'REVIEW_REQUIRED_LEGACY_PROVENANCE')
  } catch {
    return disabledCandidate('rejected', 'core_auth_verification_failed')
  }
}
