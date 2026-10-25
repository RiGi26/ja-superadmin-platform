import 'server-only'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { CORE_COMPANY_RUNTIME_ENABLED } from '@/lib/core-company'

// Internal application service, never a Server Action. Dependencies belong to the
// trusted composition root, not request JSON. No production adapter is registered.
export const E1_STOCK_RUNTIME_ENABLED = false as const
const uuid = z.uuid().transform(value => value.toLowerCase())
const admission = z.object({ commandId: uuid,
  companyName: z.string().trim().normalize().min(2).max(100)
    .refine(value => !/[\p{Cc}\p{Cs}]/u.test(value)), product: z.literal('stock'),
}).strict()
const selector = z.object({ commandId: uuid, companyId: uuid,
  reservationId: uuid, product: z.literal('stock'),
}).strict()
export type E1StockRequest = z.infer<typeof admission>
export type E1StockSelector = z.infer<typeof selector>
export type CoreActor = Readonly<{ subject: string; sessionId: string;
  validUntil: number; verifiedAt: number; customer: true; sessionCurrent: true }>
export type StockReservation = Readonly<{ companyId: string; reservationId: string;
  coreTenantId: string; coreSubject: string; product: 'stock';
  status: 'reserved' | 'provisioned' | 'revoked';
  stockTenantId: string | null; stockSubject: string | null; profileId: string | null }>
export type RegistryOwner = Readonly<{ subject: string; companyId: string;
  membershipId: string; role: 'owner' | 'admin' | 'member'; status: 'active' | 'revoked';
  companyStatus: 'active' | 'inactive' | 'retired' }>
// Created with the native Company/Owner/instance in one database transaction.
// Resource provenance never asserts that the person has no legacy history.
export type E1CreationOrigin = Readonly<{ source: 'core.e1.resource.v1';
  subject: string; commandId: string; digest: string; companyId: string;
  membershipId: string; reservationId: string; coreTenantId: string; product: 'stock' }>
export type StockMembershipProof = Readonly<{ companyId: string; reservationId: string;
  coreTenantId: string; coreSubject: string; stockTenantId: string;
  stockSubject: string; profileId: string; product: 'stock'; role: 'admin';
  active: true; currentAuth: true; mappingUnique: true; entitlementActive: true;
  verifiedAt: number; validUntil: number; evidenceRef: string }>
type Event = Readonly<{ commandId: string; actorId: string; sessionId: string;
  companyId: string; action: 'e1.stock.admit' | 'e1.stock.bind' | 'e1.stock.checkout';
  digest: string; evidenceRef: string; reservation: StockReservation }>
type Receipt = Readonly<{ eventId: string; eventHash: string; companyId: string }>
type Replay = Readonly<{ digest: string; reservation: StockReservation; receipt: Receipt }>

/** Implementations MUST lock before invoking callback, serialize relevant native Registry
 * writer, roll back on any thrown error (including appendAudit), and commit once.
 * Native Company tables/writer/audit are reused; this is not a parallel Registry.
 * Every writer touching the protected graph must obey its database guards.
 * Unrelated legacy history is neither imported nor used as authority. Managed
 * Auth is revalidated after waits. Separate HTTP writes are not a transaction. */
export interface E1StockTransaction {
  currentActor(): Promise<CoreActor>
  creationOrigin(companyId: string): Promise<E1CreationOrigin>
  pendingClaims(subject: string): Promise<boolean>
  replay(subject: string, commandId: string): Promise<Replay | null>
  checkoutCommand(reservationId: string): Promise<string | null>
  owners(subject: string): Promise<readonly RegistryOwner[]>
  reservations(companyId: string): Promise<readonly StockReservation[]>
  bootstrap(request: E1StockRequest, actor: CoreActor, digest: string): Promise<StockReservation>
  verifyStock(reservation: StockReservation): Promise<StockMembershipProof>
  bind(reservation: StockReservation, proof: StockMembershipProof): Promise<StockReservation>
  appendAudit(event: Event): Promise<Receipt>
  remember(subject: string, commandId: string, replay: Replay): Promise<void>
  assertIsolation(companyId: string): Promise<void>
}
export interface E1StockBoundary {
  // Must consult current managed Auth/session, not merely a JWT or getUser cache.
  currentActor(): Promise<CoreActor>
  atomic<T>(run: (transaction: E1StockTransaction) => Promise<T>): Promise<T>
}
const fail = (): never => { throw new Error('E1_STOCK_DENIED') }
const validId = (value: unknown) => uuid.safeParse(value).success
const digest = (action: string, request: unknown) => createHash('sha256')
  .update(JSON.stringify([action, request]), 'utf8').digest('hex')
function current(actor: CoreActor, initial?: CoreActor) {
  if (!validId(actor.subject) || !validId(actor.sessionId) || actor.customer !== true ||
      actor.sessionCurrent !== true || !Number.isFinite(actor.verifiedAt) ||
      !Number.isFinite(actor.validUntil) || actor.verifiedAt > Date.now() ||
      actor.validUntil <= Date.now() || actor.validUntil > actor.verifiedAt + 30_000 ||
      (initial && (initial.subject !== actor.subject || initial.sessionId !== actor.sessionId))) fail()
  return actor
}
function fresh(proof: { verifiedAt: number; validUntil: number; evidenceRef: string }) {
  if (!Number.isFinite(proof.verifiedAt) || !Number.isFinite(proof.validUntil) ||
      proof.verifiedAt > Date.now() || proof.validUntil <= Date.now() ||
      proof.validUntil > proof.verifiedAt + 30_000 || !validId(proof.evidenceRef)) fail()
}
function exactReservation(value: StockReservation, actor: CoreActor, request?: E1StockSelector) {
  if (![value.companyId, value.reservationId, value.coreTenantId, value.coreSubject].every(validId) ||
      value.coreSubject !== actor.subject || value.product !== 'stock' ||
      !['reserved', 'provisioned'].includes(value.status) ||
      (request && (value.companyId !== request.companyId || value.reservationId !== request.reservationId))) fail()
  if (value.status === 'reserved' &&
      [value.stockTenantId, value.stockSubject, value.profileId].some(id => id !== null)) fail()
  if (value.status === 'provisioned' &&
      ![value.stockTenantId, value.stockSubject, value.profileId].every(validId)) fail()
  return value
}
async function owner(tx: E1StockTransaction, actor: CoreActor, companyId: string) {
  // No active-only query: duplicates and revoked/conflicting history fail closed.
  const rows = await tx.owners(actor.subject)
  if (rows.length !== 1) fail()
  const row = rows[0]
  if (row.subject !== actor.subject || row.companyId !== companyId || !validId(row.membershipId) ||
      row.role !== 'owner' || row.status !== 'active' || row.companyStatus !== 'active') fail()
  return row
}
async function reservation(tx: E1StockTransaction, actor: CoreActor, request: E1StockSelector) {
  const member = await owner(tx, actor, request.companyId)
  const rows = (await tx.reservations(request.companyId)).filter(row => row.product === 'stock')
  if (rows.length !== 1) fail()
  const reserved = exactReservation(rows[0], actor, request)
  const origin = await tx.creationOrigin(reserved.companyId)
  if (origin.source !== 'core.e1.resource.v1' || origin.subject !== actor.subject ||
      origin.companyId !== reserved.companyId || origin.membershipId !== member.membershipId ||
      origin.reservationId !== reserved.reservationId || origin.coreTenantId !== reserved.coreTenantId ||
      origin.product !== 'stock' || !validId(origin.commandId) || !/^[a-f0-9]{64}$/.test(origin.digest)) fail()
  await tx.assertIsolation(reserved.companyId)
  return reserved
}
function stockProof(value: StockMembershipProof, reserved: StockReservation) {
  fresh(value)
  if (value.companyId !== reserved.companyId || value.reservationId !== reserved.reservationId ||
      value.coreTenantId !== reserved.coreTenantId || value.coreSubject !== reserved.coreSubject ||
      value.product !== 'stock' || value.role !== 'admin' || value.active !== true ||
      value.currentAuth !== true || value.mappingUnique !== true || value.entitlementActive !== true ||
      ![value.stockTenantId, value.stockSubject, value.profileId].every(validId) ||
      (reserved.status === 'provisioned' && (value.stockTenantId !== reserved.stockTenantId ||
        value.stockSubject !== reserved.stockSubject || value.profileId !== reserved.profileId))) fail()
}
async function audit(tx: E1StockTransaction, actor: CoreActor, commandId: string,
  action: Event['action'], fingerprint: string, reserved: StockReservation, evidenceRef: string) {
  current(await tx.currentActor(), actor)
  const receipt = await tx.appendAudit({ commandId, actorId: actor.subject, sessionId: actor.sessionId,
    companyId: reserved.companyId, action, digest: fingerprint, evidenceRef, reservation: reserved })
  if (!validId(receipt.eventId) || !/^[a-f0-9]{64}$/.test(receipt.eventHash) ||
      receipt.companyId !== reserved.companyId) fail()
  await tx.remember(actor.subject, commandId, { digest: fingerprint, reservation: reserved, receipt })
  // A slow audit/store must not turn an expired or revoked observation into a
  // committed grant. The adapter must roll all writes back on this final denial.
  await tx.assertIsolation(reserved.companyId)
  current(await tx.currentActor(), actor)
  return { reservation: reserved, receipt }
}

/** Locally testable trusted service. It grants no HTTP route, credentials,
 * deployment, financial operation or activation. E2/E3 use the existing native
 * owner.propose/owner.approve contract, never this admission entry point. */
export function createE1StockService(boundary: E1StockBoundary) {
  return {
    async admit(input: unknown) {
      const request = admission.parse(input)
      const initial = current(await boundary.currentActor())
      const fingerprint = digest('e1.stock.admit', request)
      return boundary.atomic(async tx => {
        const actor = current(await tx.currentActor(), initial)
        const replay = await tx.replay(actor.subject, request.commandId)
        if (replay) {
          if (replay.digest !== fingerprint) fail()
          await owner(tx, actor, replay.reservation.companyId)
          const active = await reservation(tx, actor, { commandId: request.commandId,
            companyId: replay.reservation.companyId, reservationId: replay.reservation.reservationId, product: 'stock' })
          if (active.status === 'provisioned') stockProof(await tx.verifyStock(active), active)
          current(await tx.currentActor(), actor)
          return { reservation: active, receipt: replay.receipt }
        }
        if ((await tx.owners(actor.subject)).length !== 0 || await tx.pendingClaims(actor.subject)) fail()
        current(await tx.currentActor(), actor)
        const reserved = exactReservation(await tx.bootstrap(request, actor, fingerprint), actor)
        if (reserved.status !== 'reserved') fail()
        await owner(tx, actor, reserved.companyId)
        await reservation(tx, actor, { commandId: request.commandId, companyId: reserved.companyId,
          reservationId: reserved.reservationId, product: 'stock' })
        const origin = await tx.creationOrigin(reserved.companyId)
        if (origin.commandId !== request.commandId || origin.digest !== fingerprint) fail()
        return audit(tx, actor, request.commandId, 'e1.stock.admit', fingerprint, reserved, reserved.reservationId)
      })
    },
    async confirmProvisioning(input: unknown) {
      const request = selector.parse(input)
      const initial = current(await boundary.currentActor())
      return boundary.atomic(async tx => {
        const actor = current(await tx.currentActor(), initial)
        const reserved = await reservation(tx, actor, request)
        const proof = await tx.verifyStock(reserved)
        stockProof(proof, reserved)
        const fingerprint = digest('e1.stock.bind', request)
        const replay = await tx.replay(actor.subject, request.commandId)
        if (replay) {
          if (replay.digest !== fingerprint || reserved.status !== 'provisioned') fail()
          current(await tx.currentActor(), actor)
          return { reservation: reserved, receipt: replay.receipt }
        }
        // A second command cannot silently rebind or append another grant event.
        if (reserved.status !== 'reserved') fail()
        const bound = exactReservation(await tx.bind(reserved, proof), actor, request)
        if (bound.status !== 'provisioned') fail()
        stockProof(proof, bound)
        fresh(proof)
        stockProof(await tx.verifyStock(bound), bound)
        return audit(tx, actor, request.commandId, 'e1.stock.bind', fingerprint, bound, proof.evidenceRef)
      })
    },
    async authorizeFirstCheckout(input: unknown) {
      const request = selector.parse(input)
      const initial = current(await boundary.currentActor())
      return boundary.atomic(async tx => {
        const actor = current(await tx.currentActor(), initial)
        const reserved = await reservation(tx, actor, request)
        // Initial checkout precedes local Stock Auth/profile. No subscription,
        // invoice, provider token, charge or general billing capability is issued.
        if (reserved.status !== 'reserved') fail()
        const previousCommand = await tx.checkoutCommand(reserved.reservationId)
        if (previousCommand !== null && previousCommand !== request.commandId) fail()
        const fingerprint = digest('e1.stock.checkout', request)
        const replay = await tx.replay(actor.subject, request.commandId)
        if (replay) {
          if (replay.digest !== fingerprint || replay.reservation.reservationId !== reserved.reservationId) fail()
          current(await tx.currentActor(), actor)
          return { modeledOnly: true as const, reservation: reserved, receipt: replay.receipt }
        }
        return { modeledOnly: true as const, ...await audit(tx, actor, request.commandId,
          'e1.stock.checkout', fingerprint, reserved, reserved.reservationId) }
      })
    },
  }
}

/** Runtime composition remains deliberately unavailable until independently
 * approved managed adapters meet this service's atomic/fence/Auth contracts. */
export function getE1StockRuntimeService(): never {
  void CORE_COMPANY_RUNTIME_ENABLED
  throw new Error('E1_STOCK_RUNTIME_DISABLED')
}
