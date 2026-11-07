import { isActiveStockUuid } from './stock-active-protocol'

// Gate C source candidate. Managed settings and a separately authorized rollout
// must also permit invitations; this constant grants no paid access or ownership.
export const STOCK_OPERATOR_INVITATION_ENABLED = true

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

export function parseStockOperatorClaim(value: unknown, inviteId: string, requireCurrent = true): StockOperatorClaim | ClosedInvitation {
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
      (requireCurrent && Date.parse(value.expiresAt) <= Date.now())) throw new Error('STOCK_OPERATOR_CLAIM_INVALID')
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

export type StockOperatorAdmission = Readonly<{
  status: 'admitted'; stage: StockOperatorStage; coreTenantId: string; companyRevision: number;
  membershipRevision: 1; coreAuditEventId: string; accessGranted: false;
}>

export function parseStockOperatorAdmission(value: unknown, inviteId: string): StockOperatorAdmission {
  if (!record(value) || Object.keys(value).sort().join(',') !==
      'accessGranted,companyRevision,coreAuditEventId,coreTenantId,membershipRevision,stage,status' ||
      value.status !== 'admitted' || value.accessGranted !== false || !isActiveStockUuid(value.coreTenantId) ||
      !isActiveStockUuid(value.coreAuditEventId) || !Number.isSafeInteger(value.companyRevision) ||
      (value.companyRevision as number) < 0 || value.membershipRevision !== 1 || !record(value.stage)) {
    throw new Error('STOCK_OPERATOR_ADMISSION_INVALID')
  }
  const { stockAuditEventId: auditId, ...fields } = value.stage
  const claim = parseStockOperatorClaim({ ...fields, status: 'claimed' }, inviteId, false)
  if (claim.status !== 'claimed') throw new Error('STOCK_OPERATOR_ADMISSION_INVALID')
  const stage = parseStockOperatorStage({ ...fields, stockAuditEventId: auditId }, claim)
  return { status: 'admitted', stage, coreTenantId: value.coreTenantId, companyRevision: value.companyRevision as number,
    membershipRevision: 1, coreAuditEventId: value.coreAuditEventId, accessGranted: false }
}

export type StockOperatorActivation = Readonly<{
  status: 'activated'; inviteId: string; companyId: string; instanceId: string; membershipId: string;
  profileId: string; membershipRevision: 1; role: 'admin' | 'staff' | 'produksi'; accessGranted: false;
}>

export function parseStockOperatorActivation(value: unknown, admission: StockOperatorAdmission): StockOperatorActivation {
  const stage = admission.stage
  if (!record(value) || Object.keys(value).sort().join(',') !==
      'accessGranted,companyId,instanceId,inviteId,membershipId,membershipRevision,profileId,role,status' ||
      value.status !== 'activated' || value.accessGranted !== false || value.membershipRevision !== 1 ||
      ['inviteId','companyId','instanceId','membershipId','profileId','role'].some(key => value[key] !== stage[key as keyof StockOperatorStage])) {
    throw new Error('STOCK_OPERATOR_ACTIVATION_INVALID')
  }
  return value as StockOperatorActivation
}


/** Initial activation witness, read only by the currently live native recipient.
 * It is evidence of the initial commit, not a selected session or a role grant.
 */
export type StockOperatorActivatedContext = StockOperatorActivation & Readonly<{
  coreSubject: string; stockSubject: string; stockSessionId: string; stockAuditEventId: string;
}>

export function parseStockOperatorActivatedContext(value: unknown, expected: {
  inviteId: string; coreSubject: string; stockSubject: string; stockSessionId: string;
}): StockOperatorActivatedContext {
  const ids = ['inviteId','companyId','instanceId','membershipId','profileId','coreSubject','stockSubject','stockSessionId','stockAuditEventId']
  if (!record(value) || Object.keys(value).sort().join(',') !==
      'accessGranted,companyId,coreSubject,instanceId,inviteId,membershipId,membershipRevision,profileId,role,status,stockAuditEventId,stockSessionId,stockSubject' ||
      value.status !== 'activated' || value.accessGranted !== false || value.membershipRevision !== 1 ||
      !ids.every(key => isActiveStockUuid(value[key])) ||
      (value.role !== 'admin' && value.role !== 'staff' && value.role !== 'produksi') ||
      ['inviteId','coreSubject','stockSubject','stockSessionId'].some(key => value[key] !== expected[key as keyof typeof expected])) {
    throw new Error('STOCK_OPERATOR_ACTIVATED_CONTEXT_INVALID')
  }
  return value as StockOperatorActivatedContext
}

export type StockOperatorConfirmation = Readonly<{
  status: 'confirmed'; inviteId: string; companyId: string; membershipId: string;
  profileId: string; stockAuditEventId: string; accessGranted: false;
}>

export function parseStockOperatorConfirmation(value: unknown, expected: {
  inviteId: string; companyId?: string; membershipId?: string; profileId?: string;
}): StockOperatorConfirmation {
  if (!record(value) || Object.keys(value).sort().join(',') !==
      'accessGranted,companyId,inviteId,membershipId,profileId,status,stockAuditEventId' ||
      value.status !== 'confirmed' || value.accessGranted !== false ||
      !['inviteId','companyId','membershipId','profileId','stockAuditEventId'].every(key => isActiveStockUuid(value[key])) ||
      ['inviteId','companyId','membershipId','profileId'].some(key => {
        const field = expected[key as keyof typeof expected]
        return field !== undefined && value[key] !== field
      })) {
    throw new Error('STOCK_OPERATOR_CONFIRMATION_INVALID')
  }
  return value as StockOperatorConfirmation
}
