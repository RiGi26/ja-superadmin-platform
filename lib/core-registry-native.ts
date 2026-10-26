import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { CORE_COMPANY_RUNTIME_ENABLED } from '@/lib/core-company'
import { CORE_E1_ORIGIN, STOCK_E1_ORIGIN } from '@/lib/e1-realm'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { E1_STOCK_RUNTIME_ENABLED } from '@/lib/e1-stock-integration'
import { registryMutationBinding, e1StockMutationBinding } from '@/lib/registry-mutation-binding'
import { isSuperadminEmail } from '@/lib/superadmin'

// Dormant DAL, not a Server Action. Never accept identity or authority from input.
const uuid = z.uuid().transform((value) => value.toLowerCase())
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const product = z.enum(['stock', 'lms', 'clinic', 'laundry', 'rental', 'pharmacy'])
const companyName = z.string().trim().min(2).max(100).regex(/\S/)
const command = z.discriminatedUnion('action', [
  z.object({ action: z.literal('company.bootstrap'), commandId: uuid,
    payload: z.object({ companyName, portalType: product }).strict() }).strict(),
  z.object({ action: z.literal('company.rename'), commandId: uuid,
    payload: z.object({ companyId: uuid, expectedRevision: revision, companyName }).strict() }).strict(),
  z.object({ action: z.literal('membership.revoke'), commandId: uuid,
    payload: z.object({ companyId: uuid, expectedRevision: revision, membershipId: uuid }).strict() }).strict(),
  z.object({ action: z.literal('owner.propose'), commandId: uuid,
    payload: z.object({ companyId: uuid, expectedRevision: revision, targetUserId: uuid,
      previousOwnerId: uuid, caseKind: z.enum(['legacy', 'disputed', 'takeover', 'conflict']) }).strict() }).strict(),
  z.object({ action: z.literal('owner.approve'), commandId: uuid,
    payload: z.object({ claimId: uuid }).strict() }).strict(),
])
const readRequest = z.object({ companyId: uuid, ownerOnly: z.boolean() }).strict()
const userSchema = z.object({ id: uuid, email: z.email(), is_anonymous: z.literal(false),
  email_confirmed_at: z.iso.datetime({ offset: true }),
  banned_until: z.string().nullable().optional(), deleted_at: z.string().nullable().optional(),
})
const claimsSchema = z.object({ sub: uuid, session_id: uuid,
  iss: z.literal(`${CORE_E1_ORIGIN}/auth/v1`), aud: z.literal('authenticated'),
  role: z.literal('authenticated'),
  iat: z.number().int().positive(), exp: z.number().int().positive(), nbf: z.number().int().optional(),
  user_role: z.string().optional(),
})
const authorization = z.object({ companyId: uuid, membershipId: uuid,
  role: z.enum(['owner', 'admin', 'member']), revision }).strict()
const receipt = z.object({ companyId: uuid, eventId: uuid, eventHash: z.string().regex(/^[a-f0-9]{64}$/),
  revision, claimId: uuid.optional() }).strict()
const stockSelector = z.object({ companyId: uuid, reservationId: uuid, product: z.literal('stock') }).strict()
const e1StockCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('e1.stock.admit'), commandId: uuid,
    payload: z.object({ companyName, product: z.literal('stock') }).strict() }).strict(),
  z.object({ action: z.literal('e1.stock.checkout'), commandId: uuid, payload: stockSelector }).strict(),
  z.object({ action: z.literal('e1.stock.bind'), commandId: uuid, payload: stockSelector }).strict(),
])
const stockReservation = z.object({ companyId: uuid, reservationId: uuid, coreTenantId: uuid,
  coreSubject: uuid, product: z.literal('stock'), status: z.literal('reserved'),
  stockTenantId: z.null(), stockSubject: z.null(), profileId: z.null(),
}).strict()
const stockReceipt = z.object({ reservation: stockReservation, receipt,
  modeledOnly: z.literal(false) }).strict()

// Token custody stays private. Returned identity observations contain no bearer.
const actorTokens = new WeakMap<object, string>()

function enabled() {
  return Boolean(CORE_COMPANY_RUNTIME_ENABLED) && process.env.NEXT_PUBLIC_SUPABASE_URL === CORE_E1_ORIGIN
}

function verifiedAccount(value: unknown, expectedId?: string) {
  const account = userSchema.parse(value)
  if ((expectedId && account.id !== expectedId) || account.deleted_at ||
      Date.parse(account.email_confirmed_at) > Date.now() ||
      (account.banned_until && !(Date.parse(account.banned_until) <= Date.now()))) {
    throw new Error('AUTH_REQUIRED')
  }
  return account
}

async function verifyCoreToken(client: Awaited<ReturnType<typeof createClient>>, token: string, expectedClientId?: string) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== CORE_E1_ORIGIN ||
      !token || token.length > 8192 || /[\s,]/.test(token)) throw new Error('AUTH_REQUIRED')
  const started = Date.now()
  // Live account, verified claims and installed managed-session RPC must all
  // observe the SAME bearer. No fallback to stored users or a service credential.
  const userResult = await client.auth.getUser(token)
  if (userResult.error) throw new Error('AUTH_REQUIRED')
  const user = verifiedAccount(userResult.data.user)
  const claimsResult = await client.auth.getClaims(token)
  if (claimsResult.error) throw new Error('AUTH_REQUIRED')
  const claims = claimsSchema.parse(claimsResult.data?.claims)
  if (expectedClientId !== undefined && uuid.parse(claimsResult.data?.claims.client_id) !== expectedClientId) {
    throw new Error('AUTH_REQUIRED')
  }
  const now = Date.now() / 1000
  if (claims.sub !== user.id || claims.exp <= now || claims.iat > now ||
      claims.iat >= claims.exp || (claims.nbf !== undefined && claims.nbf > now)) {
    throw new Error('AUTH_REQUIRED')
  }
  const live = await client.rpc('core_registry_session_is_live')
    .setHeader('Authorization', `Bearer ${token}`)
  const until = Math.min(claims.exp * 1000, started + 30_000)
  if (live.error || live.data !== true || until <= Date.now()) throw new Error('AUTH_REQUIRED')
  const actor = Object.freeze({ subject: user.id, session: claims.session_id,
    customer: claims.user_role !== 'superadmin' && !isSuperadminEmail(user.email),
    until: new Date(until).toISOString() })
  actorTokens.set(actor, token)
  return actor
}

async function authenticate(client: Awaited<ReturnType<typeof createClient>>) {
  // Storage supplies token bytes only; pin them across live verification.
  const snapshot = await client.auth.getSession()
  const token = snapshot.data.session?.access_token
  if (snapshot.error || typeof token !== 'string' || !token) throw new Error('AUTH_REQUIRED')
  const actor = await verifyCoreToken(client, token)
  const final = await client.auth.getSession()
  if (final.error || final.data.session?.access_token !== token) throw new Error('AUTH_CHANGED')
  return actor
}

/** Explicit native provider credential only. Never read or fall back to cookies. */
export async function verifyNativeCoreProvider(client: Awaited<ReturnType<typeof createClient>>, token: string, expectedClientId: string) {
  if (!token || token.length > 8192 || /[\s,]/.test(token)) throw new Error('AUTH_REQUIRED')
  return verifyCoreToken(client, token, uuid.parse(expectedClientId))
}

// Shared only by dormant server-owned adapters; never a Server Action or issuer.
export { authenticate as verifyNativeCoreSession, verifiedAccount as verifyNativeAccount }

/** Read authorization is evaluated using the user's JWT and current Registry RLS. */
export async function authorizeNativeCompany(input: unknown) {
  const parsed = readRequest.safeParse(input)
  if (!parsed.success) return { status: 'denied' as const }
  if (!enabled()) return { status: 'blocked' as const, reason: 'RUNTIME_DISABLED' as const }
  try {
    const client = await createClient()
    const actor = await authenticate(client)
    const result = await client.rpc('core_registry_authorize', {
      p_company: parsed.data.companyId, p_owner_only: parsed.data.ownerOnly,
    }).setHeader('Authorization', `Bearer ${actorTokens.get(actor)!}`)
    if (result.error) return { status: 'denied' as const }
    const access = authorization.parse(result.data)
    if (access.companyId !== parsed.data.companyId || (parsed.data.ownerOnly && access.role !== 'owner')) {
      return { status: 'denied' as const }
    }
    const latest = await authenticate(client)
    if (latest.subject !== actor.subject || latest.session !== actor.session) return { status: 'denied' as const }
    return { status: 'authorized' as const, access }
  } catch {
    return { status: 'denied' as const }
  }
}

/** Billing callers must use this fixed Owner check before their existing operation. */
export async function authorizeNativeOwnerBilling(input: unknown) {
  const parsed = z.object({ companyId: uuid }).strict().safeParse(input)
  if (!parsed.success) return { status: 'denied' as const }
  return authorizeNativeCompany({ companyId: parsed.data.companyId, ownerOnly: true })
}

/** Hub selectors confer no authority. Read only the current customer's reserved
 * graph, with the same pinned session checks used by native commands. */
export async function readNativeE1StockContext(input: unknown) {
  const parsed = stockSelector.omit({ product: true }).safeParse(input)
  if (!parsed.success) return { status: 'denied' as const }
  if (!enabled() || !Boolean(E1_STOCK_RUNTIME_ENABLED)) return { status: 'blocked' as const }
  try {
    const client = await createClient()
    const actor = await authenticate(client)
    if (!actor.customer) return { status: 'denied' as const }
    const result = await client.rpc('core_registry_e1_stock_context', {
      p_company: parsed.data.companyId, p_reservation: parsed.data.reservationId,
    }).setHeader('Authorization', `Bearer ${actorTokens.get(actor)!}`)
    if (result.error) return { status: 'unconfirmed' as const }
    const context = stockReservation.extend({
      companyName: z.string().min(2).max(100), stockOrigin: z.literal(STOCK_E1_ORIGIN),
      stockBinding: z.object({ stockTenantId: uuid, stockSubject: uuid, profileId: uuid,
        auditEventId: uuid, status: z.literal('quarantined') }).strict().nullable(),
    }).strict().parse(result.data)
    const latest = await authenticate(client)
    if (!latest.customer || latest.subject !== actor.subject || latest.session !== actor.session ||
        context.coreSubject !== actor.subject || context.companyId !== parsed.data.companyId ||
        context.reservationId !== parsed.data.reservationId) return { status: 'denied' as const }
    return { status: context.stockBinding ? 'quarantined' as const : 'reserved' as const,
      companyName: context.companyName, ...parsed.data, isActive: false as const }
  } catch { return { status: 'denied' as const } }
}

/** A command maps to one atomic writer RPC; the private audit is in that transaction. */
export async function executeNativeCompanyCommand(input: unknown) {
  const parsed = command.safeParse(input)
  if (!parsed.success) return { status: 'denied' as const }
  if (!enabled()) return { status: 'blocked' as const, reason: 'RUNTIME_DISABLED' as const }
  let writeAttempted = false
  try {
    const client = await createClient()
    let actor = await authenticate(client)
    // Applies to every Company/Owner mutation, including legacy two-operator
    // paths. Admin getUserById below is account evidence, never session evidence.
    const binding = registryMutationBinding()
    if (binding.status === 'blocked') return binding
    const admin = createAdminClient()
    const verifiedSubjects: string[] = []
    if (parsed.data.action === 'owner.approve') {
      const context = await admin.rpc('core_registry_owner_claim_context', {
        p_actor: actor.subject, p_claim: parsed.data.payload.claimId,
      })
      if (context.error) throw new Error('DENIED')
      const claim = z.object({ targetUserId: uuid, proposerId: uuid }).strict().parse(context.data)
      if (claim.proposerId === actor.subject || claim.targetUserId === actor.subject ||
          claim.targetUserId === claim.proposerId) throw new Error('INDEPENDENT_OPERATORS_REQUIRED')
      for (const id of [claim.targetUserId, claim.proposerId]) {
        // Supported server Auth Admin API. Never SQL against managed Auth tables.
        const result = await admin.auth.admin.getUserById(id)
        if (result.error) throw new Error('AUTH_REQUIRED')
        verifiedAccount(result.data.user, id)
        verifiedSubjects.push(id)
      }
      const fresh = await authenticate(client)
      if (fresh.subject !== actor.subject || fresh.session !== actor.session) throw new Error('AUTH_CHANGED')
      actor = fresh
    }
    writeAttempted = true
    const result = await admin.rpc('core_registry_mutate', {
      p_actor: actor.subject, p_session: actor.session, p_auth_until: actor.until,
      p_command: parsed.data.commandId, p_action: parsed.data.action,
      p_payload: parsed.data.payload, p_verified_subjects: verifiedSubjects,
    })
    // A returned PostgreSQL error aborts its transaction. Transport/decoding errors
    // can lose a response after commit: reconcile with this SAME command ID.
    if (result.error) {
      if (/^[0-9A-Z]{5}$/.test(result.error.code)) return { status: 'denied' as const }
      throw new Error('WRITE_UNCONFIRMED')
    }
    return { status: 'completed' as const, receipt: receipt.parse(result.data) }
  } catch {
    // Do not expose raw PostgREST errors, SQL, tokens or private provenance.
    return writeAttempted ? { status: 'unconfirmed' as const, commandId: parsed.data.commandId }
      : { status: 'denied' as const }
  }
}

/** Release-gated E1 transport. Only admission has a resource-isolation adapter; other
 * commands are explicitly blocked before client construction or Auth calls.
 * Creation provenance is produced with native rows, not issued by a fake broker.
 * No direct table writes, payments, provisioning calls or E2/E3 shortcut.
 * Uses the installed Core resource command and accepted checkpoint semantics.
 * No instantaneous cross-system revocation or Production acceptance is implied. */
export async function executeNativeE1StockCommand(input: unknown) {
  const parsed = e1StockCommand.safeParse(input)
  if (!parsed.success) return { status: 'denied' as const }
  if (!enabled() || !Boolean(E1_STOCK_RUNTIME_ENABLED)) return { status: 'blocked' as const, reason: 'RUNTIME_DISABLED' as const }
  if (parsed.data.action !== 'e1.stock.admit') return { status: 'blocked' as const, reason: 'E1_COMMAND_ADAPTER_UNBOUND' as const }
  const binding = e1StockMutationBinding(parsed.data.action)
  if (binding.status === 'blocked') return binding
  let writeAttempted = false
  try {
    const client = await createClient()
    const initial = await authenticate(client)
    // The SQL command never waits on the Registry fence; retries must enter
    // here and reauthenticate. Client construction below performs no I/O.
    const actor = await authenticate(client)
    if (!initial.customer || !actor.customer || initial.subject !== actor.subject || initial.session !== actor.session) throw new Error('AUTH_CHANGED')
    const admin = createAdminClient()
    writeAttempted = true
    const result = await admin.rpc(binding.rpc, {
      p_actor: actor.subject, p_session: actor.session, p_auth_until: actor.until,
      p_command: parsed.data.commandId, p_company_name: parsed.data.payload.companyName,
    })
    if (result.error) {
      if (result.error.code === 'PGRST202') return { status: 'blocked' as const, reason: 'E1_ADMISSION_RPC_UNAVAILABLE' as const }
      if (result.error.code === '55P03') return { status: 'unconfirmed' as const, commandId: parsed.data.commandId }
      if (/^[0-9A-Z]{5}$/.test(result.error.code)) return { status: 'denied' as const }
      throw new Error('WRITE_UNCONFIRMED')
    }
    // This is a response/access check, not a claim that HTTP can roll back a
    // committed RPC. A lost/revoked session leaves an unconfirmed command.
    const latest = await authenticate(client)
    if (!latest.customer || latest.subject !== actor.subject || latest.session !== actor.session) throw new Error('AUTH_CHANGED')
    const value = stockReceipt.parse(result.data)
    if (value.reservation.coreSubject !== actor.subject || value.receipt.companyId !== value.reservation.companyId) {
      throw new Error('UNCONFIRMED_BINDING')
    }
    return { status: 'completed' as const, ...value }
  } catch {
    return writeAttempted ? { status: 'unconfirmed' as const, commandId: parsed.data.commandId }
      : { status: 'denied' as const }
  }
}

/** Verify an ordered export against an independently retained head, not its own head. */
export function verifyNativeAudit(input: unknown): boolean {
  const hash = z.string().regex(/^[a-f0-9]{64}$/)
  const parsed = z.object({ companyId: uuid, initialHash: hash, trustedHead: hash,
    events: z.array(z.object({ previous_hash: hash, event_hash: hash, canonical_payload: z.string() }).strict()),
  }).strict().safeParse(input)
  if (!parsed.success) return false
  let previous = parsed.data.initialHash
  try {
    for (const event of parsed.data.events) {
      const payload = JSON.parse(event.canonical_payload)
      if (payload.companyId !== parsed.data.companyId || event.previous_hash !== previous) return false
      const expected = createHash('sha256').update(`${previous}:${event.canonical_payload}`, 'utf8').digest('hex')
      if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(event.event_hash, 'hex'))) return false
      previous = event.event_hash
    }
    return timingSafeEqual(Buffer.from(previous, 'hex'), Buffer.from(parsed.data.trustedHead, 'hex'))
  } catch {
    return false
  }
}
