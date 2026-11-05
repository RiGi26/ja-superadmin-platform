/** V2 wire validation only. Parsed values are never native identity, ownership,
 * membership, paid entitlement or an access grant. The Gate B source candidate
 * requires separate deployment and managed-setting authority before use.
 * Its issuer/DB integration must verify current native sessions, retained history,
 * Company/resource mapping, paid contract and both Owner/member revisions.
 */
import { isActiveStockUuid, parseActiveStockDecision, parseActiveStockRequest,
  parseActiveStockSelector, type ActiveStockDecision, type ActiveStockRequest,
  type ActiveStockSelector } from './stock-active-protocol'

export const STOCK_MEMBERSHIP_RUNTIME_ENABLED = true
export const STOCK_MEMBERSHIP_PREPARATION_ENABLED = true

type MemberRole = 'admin' | 'staff' | 'produksi'
export type StockWorkspaceChoice = ActiveStockSelector & Readonly<{ commandId: string }>
export type StockMembershipPreparation = StockWorkspaceChoice & Readonly<{
  version: 2; status: 'prepared'; accessGranted: false; role: 'admin';
  bindingId: string; bindingRevision: 1; companyRevision: number;
  coreSubject: string; coreTenantId: string; stockSubject: string; stockTenantId: string;
  ownerMembershipId: string; profileId: string; membershipRevision: 1;
  originVersion?: 2; companyName?: string; stockAuditEventId?: string;
}>
type Selection = ActiveStockSelector & Readonly<{
  stockTenantId: string; profileId: string; membershipId: string;
  membershipRevision: number; selectionRevision: number; role: MemberRole
}>
export type StockMembershipRequest = ActiveStockRequest & Selection & Readonly<{ version: 2 }>
export type StockMembershipDecision = Omit<ActiveStockDecision, 'version'> & Selection & Readonly<{
  version: 2; ownerMembershipId: string; ownerMembershipRevision: number
}>

const selectionKeys = ['companyId', 'instanceId', 'stockTenantId', 'profileId',
  'membershipId', 'membershipRevision', 'selectionRevision', 'role'] as const
const baseRequestKeys = ['stockSubject', 'stockSessionId', 'method', 'path', 'nonce'] as const
const baseDecisionKeys = ['bindingId', 'bindingRevision', 'companyRevision',
  'coreSubject', 'coreSessionId', 'coreTenantId', 'issuedAt', 'expiresAt'] as const
const requestKeys = [...selectionKeys, ...baseRequestKeys, 'version'].sort().join(',')
const decisionKeys = [...selectionKeys, ...baseRequestKeys, ...baseDecisionKeys,
  'version', 'ownerMembershipId', 'ownerMembershipRevision'].sort().join(',')

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function positiveRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}
function select(value: Record<string, unknown>): Selection {
  const selected = parseActiveStockSelector({ companyId: value.companyId, instanceId: value.instanceId })
  if (!isActiveStockUuid(value.stockTenantId) || !isActiveStockUuid(value.profileId) ||
      !isActiveStockUuid(value.membershipId) || !positiveRevision(value.membershipRevision) ||
      !positiveRevision(value.selectionRevision) || !['admin', 'staff', 'produksi'].includes(value.role as string)) {
    throw new Error('STOCK_MEMBERSHIP_SELECTION_DENIED')
  }
  return Object.freeze({ ...selected, stockTenantId: value.stockTenantId, profileId: value.profileId,
    membershipId: value.membershipId, membershipRevision: value.membershipRevision,
    selectionRevision: value.selectionRevision, role: value.role as MemberRole })
}
function request(value: Record<string, unknown>): ActiveStockRequest {
  return parseActiveStockRequest({ stockSubject: value.stockSubject, stockSessionId: value.stockSessionId,
    method: value.method, path: value.path, nonce: value.nonce })
}

/** A browser may ask for a workspace and an idempotent command. The server must
 * derive the tenant/profile/member/role from the current managed session.
 */
export function parseStockWorkspaceChoice(value: unknown): StockWorkspaceChoice {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'commandId,companyId,instanceId' ||
      !isActiveStockUuid(value.commandId)) throw new Error('STOCK_WORKSPACE_CHOICE_DENIED')
  const selected = parseActiveStockSelector({ companyId: value.companyId, instanceId: value.instanceId })
  return Object.freeze({ ...selected, commandId: value.commandId })
}

/** Inactive admission receipt from the trusted Core transport only. Parsing
 * never authenticates its issuer or authorizes a payment or portal operation.
 */
export function parseStockMembershipPreparation(value: unknown): StockMembershipPreparation {
  const fields = ['accessGranted','bindingId','bindingRevision','commandId','companyId','companyRevision',
    'coreSubject','coreTenantId','instanceId','membershipRevision','ownerMembershipId','profileId',
    'role','status','stockSubject','stockTenantId','version']
  const fresh = record(value) && value.originVersion === 2
  if (fresh) fields.push('originVersion','companyName','stockAuditEventId')
  const keys = fields.sort().join(',')
  if (!record(value) || Object.keys(value).sort().join(',') !== keys || value.version !== 2 ||
      value.status !== 'prepared' || value.accessGranted !== false || value.role !== 'admin' ||
      value.bindingRevision !== 1 || value.membershipRevision !== 1 || value.bindingId !== value.instanceId ||
      !Number.isSafeInteger(value.companyRevision) || (value.companyRevision as number) < 0 ||
      !['bindingId','coreSubject','coreTenantId','stockSubject','stockTenantId','ownerMembershipId','profileId']
        .every(key => isActiveStockUuid(value[key]))) throw new Error('STOCK_MEMBERSHIP_PREPARATION_DENIED')
  if (fresh && (typeof value.companyName !== 'string' || value.companyName.length < 2 || value.companyName.length > 100 ||
      value.companyName.trim() !== value.companyName || /\p{Cc}/u.test(value.companyName) || !isActiveStockUuid(value.stockAuditEventId))) {
    throw new Error('STOCK_MEMBERSHIP_PREPARATION_DENIED')
  }
  const selected = parseStockWorkspaceChoice({ commandId: value.commandId, companyId: value.companyId, instanceId: value.instanceId })
  return Object.freeze({ ...selected, version: 2, status: 'prepared', accessGranted: false, role: 'admin',
    bindingId: value.bindingId as string, bindingRevision: 1, companyRevision: value.companyRevision as number,
    coreSubject: value.coreSubject as string, coreTenantId: value.coreTenantId as string,
    stockSubject: value.stockSubject as string, stockTenantId: value.stockTenantId as string,
    ownerMembershipId: value.ownerMembershipId as string, profileId: value.profileId as string, membershipRevision: 1,
    ...(fresh ? { originVersion: 2 as const, companyName: value.companyName as string, stockAuditEventId: value.stockAuditEventId as string } : {}) })
}

/** This request is assembled at the protected data boundary from its selected
 * session context. Parsing it does not make browser-supplied membership trusted.
 */
export function parseStockMembershipRequest(value: unknown): StockMembershipRequest {
  if (!record(value) || Object.keys(value).sort().join(',') !== requestKeys || value.version !== 2) {
    throw new Error('STOCK_MEMBERSHIP_REQUEST_DENIED')
  }
  return Object.freeze({ ...request(value), ...select(value), version: 2 })
}

/** Compare the exact online decision with this in-flight selected membership.
 * The existing v1 parser supplies the same strict path, nonce/session and clock
 * limits. Constructing its projection here never admits a v1 response as v2.
 * Operational role carries no permission to pay or manage subscriptions.
 */
export function parseStockMembershipDecision(value: unknown, expected: StockMembershipRequest,
  now = Date.now()): StockMembershipDecision {
  expected = parseStockMembershipRequest(expected)
  if (!record(value) || Object.keys(value).sort().join(',') !== decisionKeys || value.version !== 2 ||
      !isActiveStockUuid(value.ownerMembershipId) || !positiveRevision(value.ownerMembershipRevision)) {
    throw new Error('STOCK_MEMBERSHIP_DECISION_DENIED')
  }
  const selected = select(value)
  if (selectionKeys.some(key => selected[key] !== expected[key])) {
    throw new Error('STOCK_MEMBERSHIP_DECISION_DENIED')
  }
  const observed = parseActiveStockDecision({
    ...request(value), version: 1, companyId: selected.companyId, instanceId: selected.instanceId,
    stockTenantId: selected.stockTenantId, bindingId: value.bindingId,
    bindingRevision: value.bindingRevision, companyRevision: value.companyRevision,
    coreSubject: value.coreSubject, coreSessionId: value.coreSessionId, coreTenantId: value.coreTenantId,
    issuedAt: value.issuedAt, expiresAt: value.expiresAt,
  }, request(expected), now)
  return Object.freeze({ ...observed, ...selected, version: 2,
    ownerMembershipId: value.ownerMembershipId, ownerMembershipRevision: value.ownerMembershipRevision })
}

/** Input must be the exact result of an authoritative retained-history lookup,
 * including revoked/inactive history. Errors or missing/malformed results deny.
 * A disabled successor cannot send its existing subjects to an older engine.
 */
export function stockMembershipRoute(retainedHistory: unknown,
  enabled = STOCK_MEMBERSHIP_RUNTIME_ENABLED): 'legacy' | 'membership' | 'denied' {
  if (retainedHistory === false) return 'legacy'
  return retainedHistory === true && enabled === true ? 'membership' : 'denied'
}
