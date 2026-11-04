import { isActiveStockUuid } from './stock-active-protocol'

export const STOCK_OPERATOR_INVITATION_ENABLED = false

export type StockOperatorProof = Readonly<{ inviteId: string; proof: string }>
export type StockOperatorClaim = Readonly<{
  status: 'claimed'; inviteId: string; commandId: string; companyId: string; instanceId: string;
  stockTenantId: string; ownerMembershipId: string; coreSubject: string; stockSubject: string;
  membershipId: string; profileId: string; role: 'admin' | 'staff' | 'produksi';
  expiresAt: string; accessGranted: false;
}>
type ClosedInvitation = Readonly<{ status: 'canceled' | 'expired' | 'activated'; inviteId: string; accessGranted: false }>

const claimIds = ['inviteId', 'commandId', 'companyId', 'instanceId', 'stockTenantId',
  'ownerMembershipId', 'coreSubject', 'stockSubject', 'membershipId', 'profileId']
const claimKeys = [...claimIds, 'role', 'expiresAt', 'status', 'accessGranted'].sort().join(',')

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function parseStockOperatorProof(value: unknown): StockOperatorProof {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'inviteId,proof' ||
      !isActiveStockUuid(value.inviteId) || typeof value.proof !== 'string' || !/^[0-9a-f]{64}$/.test(value.proof)) {
    throw new Error('STOCK_OPERATOR_PROOF_INVALID')
  }
  return { inviteId: value.inviteId, proof: value.proof }
}

export function parseStockOperatorClaim(value: unknown, inviteId: string): StockOperatorClaim | ClosedInvitation {
  if (!record(value) || !isActiveStockUuid(inviteId) || value.inviteId !== inviteId || value.accessGranted !== false) {
    throw new Error('STOCK_OPERATOR_CLAIM_INVALID')
  }
  const keys = Object.keys(value).sort().join(',')
  if (keys === 'accessGranted,inviteId,status' &&
      (value.status === 'canceled' || value.status === 'expired' || value.status === 'activated')) {
    return { status: value.status, inviteId, accessGranted: false }
  }
  if (value.status !== 'claimed' || keys !== claimKeys || value.commandId !== inviteId ||
      !claimIds.every(key => isActiveStockUuid(value[key])) ||
      (value.role !== 'admin' && value.role !== 'staff' && value.role !== 'produksi') ||
      typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt)) ||
      Date.parse(value.expiresAt) <= Date.now()) throw new Error('STOCK_OPERATOR_CLAIM_INVALID')
  return value as StockOperatorClaim
}

export type StockOperatorStage = Omit<StockOperatorClaim, 'status'> &
  Readonly<{ status: 'staged'; stockAuditEventId: string }>

export function parseStockOperatorStage(value: unknown, claim: StockOperatorClaim): StockOperatorStage {
  if (!record(value) || Object.keys(value).sort().join(',') !== [...claimKeys.split(','), 'stockAuditEventId'].sort().join(',') ||
      value.status !== 'staged' || !isActiveStockUuid(value.stockAuditEventId) ||
      Object.entries(claim).some(([key, expected]) => key !== 'status' && value[key] !== expected)) {
    throw new Error('STOCK_OPERATOR_STAGE_INVALID')
  }
  return value as StockOperatorStage
}
