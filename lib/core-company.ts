import 'server-only'

import { z } from 'zod'
import { CORE_E1_ORIGIN } from '@/lib/e1-realm'
import { e1WorkspaceRequestSchema } from '@/lib/e1-workspace'

// Compatibility for the immutable, unwired W1 proposal. Native adapters below
// use CORE_E1_ORIGIN exclusively; this legacy identifier grants no capability.
export const CORE_DEV_REF = 'mcvekinhgcqygfddyifs' as const
export const CORE_DEV_ORIGIN = `https://${CORE_DEV_REF}.supabase.co` as const

// Release fuse, not an implementation dependency. No request or environment
// variable can activate E1. Opening it requires the remaining acceptance gates.
export const CORE_COMPANY_RUNTIME_ENABLED = false as const
export const coreCompanyReviewRequired = Object.freeze([
  'REVIEW_REQUIRED_E1_RUNTIME_RELEASE',
  'REVIEW_REQUIRED_RECIPROCAL_STOCK_ACCEPTANCE',
] as const)

const accessRequest = z.object({
  companyId: z.uuid().transform(value => value.toLowerCase()).optional(),
  operation: z.enum(['read', 'owner_command']),
}).strict()

function denied(status: 'rejected' | 'hold' | 'blocked', code: string) {
  return { enabled: false as const, accessReady: false as const, writesPermitted: false as const,
    status, code, company: null, reviewRequired: coreCompanyReviewRequired }
}

/** Internal DAL facade. A Company ID is a selector, never an authority claim.
 * An Owner check does not execute a command or enable the legacy mutation path. */
export async function getCoreCompanyCandidate(input: unknown) {
  const request = accessRequest.safeParse(input)
  if (!request.success) return denied('rejected', 'invalid_request')
  if (!CORE_COMPANY_RUNTIME_ENABLED) return denied('blocked', 'core_company_runtime_disabled')
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== CORE_E1_ORIGIN) return denied('rejected', 'core_origin_required')
  if (!request.data.companyId) return denied('hold', 'company_selector_required')
  // Lazy loading keeps the gate inert for existing Hub isolation callers and
  // avoids a cycle with the native DAL's shared release constant.
  const { authorizeNativeCompany } = await import('@/lib/core-registry-native')
  return authorizeNativeCompany({ companyId: request.data.companyId,
    ownerOnly: request.data.operation === 'owner_command' })
}

/** New Stock graph only. No existing Company/tenant selector, proof envelope,
 * classification, operator approval or user-supplied identity is accepted. */
export async function requestCoreCompanyBootstrap(input: unknown) {
  const request = e1WorkspaceRequestSchema.safeParse(input)
  if (!request.success) return denied('rejected', 'invalid_request')
  if (!CORE_COMPANY_RUNTIME_ENABLED) return denied('blocked', 'core_company_runtime_disabled')
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== CORE_E1_ORIGIN) return denied('rejected', 'core_origin_required')
  const { executeNativeE1StockCommand } = await import('@/lib/core-registry-native')
  return executeNativeE1StockCommand({ action: 'e1.stock.admit', commandId: request.data.idempotencyKey,
    payload: { companyName: request.data.companyName, product: 'stock' } })
}
