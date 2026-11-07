import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { ACTIVE_STOCK_RUNTIME_ENABLED, STOCK_SSO_PILOT_ENABLED } from '@/lib/stock-active-release'
import { ACTIVE_CORE_REALM, ACTIVE_REQUEST_MAX_MS, parseActiveStockRequest,
  parseActiveStockDecision, type ActiveStockDecision } from '@/lib/stock-active-protocol'
import { verifyStockIdentityForCoreBridge } from '@/lib/stock-active-identity'
import { paidStockSessionAuthority } from '@/lib/stock-paid-session'
import { STOCK_PAID_BILLING_RUNTIME_ENABLED } from '@/lib/stock-purchase-policy'

/** Reads a current binding using the dedicated proposed service-only RPC.
 * Never accepts an authority object or database client supplied by a caller.
 * No Company, membership, profile or activation write occurs here.
 */
export async function authorizeActiveStockRequest(input: unknown, token: string): Promise<
  { status: 'authorized'; decision: ActiveStockDecision } | { status: 'blocked' | 'denied' }
> {
  if (!(ACTIVE_STOCK_RUNTIME_ENABLED || STOCK_SSO_PILOT_ENABLED || STOCK_PAID_BILLING_RUNTIME_ENABLED) || process.env.NEXT_PUBLIC_SUPABASE_URL !== ACTIVE_CORE_REALM) {
    return { status: 'blocked' }
  }
  try {
    const request = parseActiveStockRequest(input)
    const actor = await verifyStockIdentityForCoreBridge(token)
    if (actor.stockSubject !== request.stockSubject || actor.stockSessionId !== request.stockSessionId ||
        actor.until <= Date.now()) {
      return { status: 'denied' }
    }
    const paid = await paidStockSessionAuthority({ coreSubject: actor.coreSubject, stockSubject: actor.stockSubject,
      stockSession: actor.stockSessionId, until: actor.until })
    if (paid.kind === 'denied' || (paid.kind === 'legacy' && !(ACTIVE_STOCK_RUNTIME_ENABLED || STOCK_SSO_PILOT_ENABLED))) return { status: 'denied' }
    const result = paid.kind === 'paid' ? { data: paid.data, error: null } : await createAdminClient().rpc('core_stock_active_authorize_request', {
      p_stock_subject: actor.stockSubject, p_stock_session: actor.stockSessionId,
      p_core_subject: actor.coreSubject, p_verified_until: new Date(actor.until).toISOString(),
    }).abortSignal(AbortSignal.timeout(2500))
    if (result.error || !result.data || actor.until <= Date.now()) return { status: 'denied' }
    const keys = ['bindingId', 'bindingRevision', 'companyId', 'companyRevision', 'coreSessionId',
      'coreSubject', 'coreTenantId', 'instanceId', 'stockTenantId'].sort().join(',')
    if (typeof result.data !== 'object' || Array.isArray(result.data) ||
        Object.keys(result.data).sort().join(',') !== keys) return { status: 'denied' }
    // The RPC returns only current server-owned authority fields. Exact request
    // correlation and a short in-flight deadline are stamped here, not stored.
    const issuedAt = Date.now()
    const decision = parseActiveStockDecision({ ...result.data, ...request, version: 1,
      nonce: request.nonce, issuedAt,
      expiresAt: Math.min(issuedAt + ACTIVE_REQUEST_MAX_MS, actor.until),
    }, request, issuedAt)
    if (decision.coreSubject !== actor.coreSubject) return { status: 'denied' }
    return { status: 'authorized', decision }
  } catch { return { status: 'denied' } }
}
