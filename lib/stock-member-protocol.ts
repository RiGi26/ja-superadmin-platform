import { isActiveStockUuid } from './stock-active-protocol'

export const STOCK_MEMBER_LIFECYCLE_ENABLED = false

export type StockMemberEvent = Readonly<{
  kind: 'stock_member_event_v2'; eventId: string; commandId: string; companyId: string; companyRevision: number;
  instanceId: string; coreTenantId: string; stockTenantId: string; bindingId: string; bindingRevision: number;
  ownerMembershipId: string; membershipId: string; profileId: string; coreSubject: string; stockSubject: string;
  previousRevision: number; revision: number; previousRole: 'admin' | 'staff' | 'produksi'; role: 'admin' | 'staff' | 'produksi';
  action: 'role' | 'revoke'; occurredAt: string; coreAuditEventId: string;
}>
export type StockMemberReceipt = Readonly<{
  status: 'applied' | 'revoked' | 'superseded'; eventId: string; companyId: string; membershipId: string;
  revision: number; currentRevision: number; stockAuditEventId: string;
}>
const ids = ['eventId','commandId','companyId','instanceId','coreTenantId','stockTenantId','bindingId',
  'ownerMembershipId','membershipId','profileId','coreSubject','stockSubject','coreAuditEventId']
const keys = [...ids,'kind','companyRevision','bindingRevision','previousRevision','revision','previousRole','role','action','occurredAt'].sort().join(',')
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function revision(value: unknown, minimum = 1): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
}
function role(value: unknown) { return value === 'admin' || value === 'staff' || value === 'produksi' }

export function parseStockMemberEvent(value: unknown): StockMemberEvent {
  if (!record(value) || Object.keys(value).sort().join(',') !== keys || value.kind !== 'stock_member_event_v2' ||
      !ids.every(key => isActiveStockUuid(value[key])) || !revision(value.companyRevision,0) || !revision(value.bindingRevision) ||
      !revision(value.previousRevision) || !revision(value.revision) || value.revision !== value.previousRevision + 1 ||
      !role(value.role) || !role(value.previousRole) || (value.action !== 'role' && value.action !== 'revoke') ||
      (value.action === 'revoke' && value.role !== value.previousRole) || value.membershipId === value.ownerMembershipId ||
      typeof value.occurredAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value.occurredAt) ||
      !Number.isFinite(Date.parse(value.occurredAt)) || Date.parse(value.occurredAt) > Date.now() + 5000) {
    throw new Error('STOCK_MEMBER_EVENT_INVALID')
  }
  return value as StockMemberEvent
}

export function parseStockMemberReceipt(value: unknown, event: StockMemberEvent): StockMemberReceipt {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'companyId,currentRevision,eventId,membershipId,revision,status,stockAuditEventId' ||
      value.eventId !== event.eventId || value.companyId !== event.companyId || value.membershipId !== event.membershipId ||
      value.revision !== event.revision || !revision(value.currentRevision) || !isActiveStockUuid(value.stockAuditEventId) ||
      (value.status === 'superseded' ? value.currentRevision <= event.revision :
        value.status !== (event.action === 'role' ? 'applied' : 'revoked') || value.currentRevision !== event.revision)) {
    throw new Error('STOCK_MEMBER_RECEIPT_INVALID')
  }
  return value as StockMemberReceipt
}

const closureIds = ['inviteId', 'companyId', 'instanceId', 'stockTenantId', 'ownerMembershipId',
  'membershipId', 'profileId', 'coreSubject', 'stockSubject'] as const
type StockOperatorClosure = Readonly<Record<(typeof closureIds)[number], string> & {
  kind: 'stock_operator_closure_v2'
  state: 'canceled' | 'expired'
  closedAt: string
}>
const closureKeys = [...closureIds, 'kind', 'state', 'closedAt'].sort().join(',')

export function parseStockOperatorClosure(value: unknown): StockOperatorClosure {
  if (!record(value) || Object.keys(value).sort().join(',') !== closureKeys ||
      value.kind !== 'stock_operator_closure_v2' || !closureIds.every(key => isActiveStockUuid(value[key])) ||
      value.membershipId === value.ownerMembershipId || (value.state !== 'canceled' && value.state !== 'expired') ||
      typeof value.closedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value.closedAt) ||
      !Number.isFinite(Date.parse(value.closedAt)) || Date.parse(value.closedAt) > Date.now() + 5000) {
    throw new Error('STOCK_OPERATOR_CLOSURE_INVALID')
  }
  return value as StockOperatorClosure
}

export function parseStockOperatorClosureReceipt(value: unknown, closure: StockOperatorClosure) {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'companyId,inviteId,profileId,status,stockAuditEventId' ||
      value.status !== 'retired' || value.inviteId !== closure.inviteId || value.companyId !== closure.companyId ||
      value.profileId !== closure.profileId || !isActiveStockUuid(value.stockAuditEventId)) {
    throw new Error('STOCK_OPERATOR_CLOSURE_RECEIPT_INVALID')
  }
  return value
}
