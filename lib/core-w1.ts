import 'server-only'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { CORE_DEV_ORIGIN } from '@/lib/core-company'
import { createClient } from '@/lib/supabase/server'
import { isSuperadminEmail } from '@/lib/superadmin'

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  .transform((value) => value.toLowerCase())
const command = z.object({
  companyId: uuid,
  operation: z.enum(['company.read', 'company.owner_check']),
  idempotencyKey: uuid,
}).strict()
const consume = command.extend({ assertionId: uuid }).strict()
const actorShape = z.object({ subject: uuid, sessionId: uuid }).strict()
const userResponse = z.object({ error: z.null(), data: z.object({ user: z.object({
  id: uuid, email: z.string().email(), is_anonymous: z.literal(false),
  email_confirmed_at: z.string().datetime({ offset: true }),
}) }) })
const claimsResponse = z.object({ error: z.null(), data: z.object({ claims: z.object({
  sub: uuid, session_id: uuid, iss: z.literal(`${CORE_DEV_ORIGIN}/auth/v1`),
  aud: z.literal('authenticated'), exp: z.number().int().positive().max(Number.MAX_SAFE_INTEGER / 1000),
  iat: z.number().int().nonnegative(), nbf: z.number().int().nonnegative().optional(),
  user_role: z.string().optional(),
}) }) })
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')

/** Pure ASCII codec, not authentication, issuance or Company authorization. */
export function encodeCoreW1Request(actorInput: unknown, requestInput: unknown) {
  const actor = actorShape.parse(actorInput)
  const request = command.parse(requestInput)
  const requestScope = sha256(`w1:v1:scope:${actor.subject}:${actor.sessionId}:${request.companyId}:${request.operation}:${request.idempotencyKey}`)
  const payloadFingerprint = sha256(`w1:v1:payload:${request.companyId}:${request.operation}`)
  return Object.freeze({ ...actor, ...request, requestScope, payloadFingerprint,
    requestDigest: sha256(`w1:v1:request:${requestScope}:${payloadFingerprint}`) })
}

// Deliberately NOT a TrustedPrincipal, capability, receipt or live issuer.
// Only a future dedicated TLS database connection may submit these fixed calls.
// SQL independently checks current sessions, canonical membership and protected
// provenance; knowing every argument cannot satisfy its connection-role ACL.
export type CoreW1PrivateCall = Readonly<{
  authority: 'NOT_ESTABLISHED'
  executionAuthorized: false
  connection: 'w1_issuer' | 'w1_consumer'
  text: string
  values: readonly (string | number)[]
}>

async function observeCurrentCookieActor() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== CORE_DEV_ORIGIN) throw new Error('w1_dev_origin_required')
  const db = await createClient()
  // getUser is a server Auth request; getClaims verifies the token separately.
  // Neither proves current managed-session validity through transaction commit.
  const user = userResponse.parse(await db.auth.getUser()).data.user
  const claims = claimsResponse.parse(await db.auth.getClaims()).data.claims
  const now = Date.now()
  if (user.id !== claims.sub || claims.exp * 1000 <= now || claims.iat * 1000 > now ||
    (claims.nbf !== undefined && claims.nbf * 1000 > now) ||
    Date.parse(user.email_confirmed_at) > now || claims.user_role === 'superadmin' || isSuperadminEmail(user.email)) {
    throw new Error('w1_customer_identity_required')
  }
  return { subject: user.id, sessionId: claims.session_id, tokenExpiresAtMs: claims.exp * 1000 }
}

/** Unwired server-side request preparation. Never executes SQL or returns admission. */
export async function prepareCoreW1Issue(input: unknown): Promise<CoreW1PrivateCall> {
  const request = command.parse(input) // Reject caller authority fields before Auth.
  const actor = await observeCurrentCookieActor()
  const binding = encodeCoreW1Request({ subject: actor.subject, sessionId: actor.sessionId }, request)
  return Object.freeze({ authority: 'NOT_ESTABLISHED', executionAuthorized: false, connection: 'w1_issuer',
    text: 'select wz_w1_private.issue_assertion($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::text,$6::uuid,$7::text,$8::text)',
    values: Object.freeze([actor.subject, actor.sessionId, actor.tokenExpiresAtMs,
      request.companyId, request.operation, request.idempotencyKey, binding.requestScope, binding.requestDigest]),
  })
}

/** A retry must obtain current cookie identity again; an assertion ID is only a selector. */
export async function prepareCoreW1Consume(input: unknown): Promise<CoreW1PrivateCall> {
  const request = consume.parse(input)
  const actor = await observeCurrentCookieActor()
  const binding = encodeCoreW1Request({ subject: actor.subject, sessionId: actor.sessionId }, {
    companyId: request.companyId, operation: request.operation, idempotencyKey: request.idempotencyKey,
  })
  return Object.freeze({ authority: 'NOT_ESTABLISHED', executionAuthorized: false, connection: 'w1_consumer',
    text: 'select wz_w1_private.consume_assertion($1::uuid,$2::uuid,$3::uuid,$4::bigint,$5::uuid,$6::text,$7::uuid,$8::text,$9::text)',
    values: Object.freeze([request.assertionId, actor.subject, actor.sessionId, actor.tokenExpiresAtMs,
      request.companyId, request.operation, request.idempotencyKey, binding.requestScope, binding.requestDigest]),
  })
}
