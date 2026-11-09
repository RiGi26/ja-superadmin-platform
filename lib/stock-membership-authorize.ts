import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { verifyStockIdentityForCoreBridge } from '@/lib/stock-active-identity'
import { ACTIVE_CORE_REALM, ACTIVE_REQUEST_MAX_MS } from '@/lib/stock-active-protocol'
import { STOCK_MEMBERSHIP_RUNTIME_ENABLED, parseStockMembershipRequest,
  parseStockMembershipDecision, type StockMembershipDecision } from '@/lib/stock-membership-protocol'

const authorityKeys = ['bindingId', 'bindingRevision', 'companyId', 'companyRevision',
  'coreSessionId', 'coreSubject', 'coreTenantId', 'instanceId', 'stockTenantId',
  'profileId', 'membershipId', 'membershipRevision', 'selectionRevision', 'role',
  'ownerMembershipId', 'ownerMembershipRevision'].sort().join(',')

/** Resolve the exact current v2 selection through Core's authoritative RPC. */
export async function authorizeStockMembershipRequest(input: unknown, token: string): Promise<
  { status: 'authorized'; decision: StockMembershipDecision } | { status: 'blocked' | 'denied' }
> {
  if (!STOCK_MEMBERSHIP_RUNTIME_ENABLED || process.env.NEXT_PUBLIC_SUPABASE_URL !== ACTIVE_CORE_REALM) {
    return { status: 'blocked' }
  }
  try {
    const request = parseStockMembershipRequest(input)
    const actor = await verifyStockIdentityForCoreBridge(token)
    if (actor.stockSubject !== request.stockSubject || actor.stockSessionId !== request.stockSessionId ||
        actor.until <= Date.now()) return { status: 'denied' }
    // The authority query requires the exact active identity pair and selection.
    const result = await createAdminClient().rpc('core_stock_membership_authorize_request', {
      p_company: request.companyId, p_instance: request.instanceId,
      p_profile: request.profileId, p_membership: request.membershipId,
      p_membership_revision: request.membershipRevision,
      p_selection_revision: request.selectionRevision,
      p_stock_subject: actor.stockSubject, p_stock_session: actor.stockSessionId,
      p_core_subject: actor.coreSubject, p_verified_until: new Date(actor.until).toISOString(),
    }).abortSignal(AbortSignal.timeout(2500))
    if (result.error || !result.data || typeof result.data !== 'object' || Array.isArray(result.data) ||
        Object.keys(result.data).sort().join(',') !== authorityKeys || actor.until <= Date.now()) {
      return { status: 'denied' }
    }
    const issuedAt = Date.now()
    const decision = parseStockMembershipDecision({
      ...result.data, version: 2, stockSubject: actor.stockSubject, stockSessionId: actor.stockSessionId,
      method: request.method, path: request.path, nonce: request.nonce,
      // Core returns its current selection revision. Stock must independently
      // compare the matching local selection before admitting the operation.
      issuedAt, expiresAt: Math.min(issuedAt + ACTIVE_REQUEST_MAX_MS, actor.until),
    }, request, issuedAt)
    if (decision.coreSubject !== actor.coreSubject) return { status: 'denied' }
    return { status: 'authorized', decision }
  } catch { return { status: 'denied' } }
}
