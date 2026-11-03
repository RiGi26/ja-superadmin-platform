import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { verifyNativeCoreProvider } from '@/lib/core-registry-native'
import { verifyStockIdentityForCoreBridge } from '@/lib/stock-active-identity'
import { ACTIVE_CORE_REALM, ACTIVE_STOCK_CLIENT_ID, ACTIVE_REQUEST_MAX_MS } from '@/lib/stock-active-protocol'
import { STOCK_MEMBERSHIP_RUNTIME_ENABLED, parseStockWorkspaceChoice, parseStockMembershipRequest,
  parseStockMembershipDecision, type StockMembershipDecision } from '@/lib/stock-membership-protocol'

const authorityKeys = ['bindingId','bindingRevision','companyId','companyRevision','coreSessionId',
  'coreSubject','coreTenantId','instanceId','stockTenantId','profileId','membershipId',
  'membershipRevision','selectionRevision','role','ownerMembershipId','ownerMembershipRevision'].sort().join(',')

/** Selects an already admitted membership using both current native credentials.
 * No Company, member, profile, paid entitlement or operational access is created.
 * Stock must commit and independently verify the matching local selection.
 * An unconfirmed result is recovered using the same command and expected revision.
 */
export async function selectStockMembershipSession(input: unknown, stockToken: string, coreToken: string): Promise<
  { status: 'selected'; decision: StockMembershipDecision } | { status: 'blocked' | 'denied' | 'unconfirmed' }
> {
  if (!STOCK_MEMBERSHIP_RUNTIME_ENABLED || process.env.NEXT_PUBLIC_SUPABASE_URL !== ACTIVE_CORE_REALM) {
    return { status: 'blocked' }
  }
  let attempted = false
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).sort().join(',') !== 'commandId,companyId,expectedRevision,instanceId') return { status: 'denied' }
    const raw = input as Record<string, unknown>
    const selected = parseStockWorkspaceChoice({ commandId: raw.commandId, companyId: raw.companyId, instanceId: raw.instanceId })
    const expectedRevision = raw.expectedRevision
    if (!Number.isSafeInteger(expectedRevision) || (expectedRevision as number) < 0 ||
        (expectedRevision as number) >= Number.MAX_SAFE_INTEGER || typeof coreToken !== 'string' || coreToken.length > 8192 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(coreToken)) return { status: 'denied' }
    const client = await createClient()
    const [core, stock] = await Promise.all([
      verifyNativeCoreProvider(client, coreToken, ACTIVE_STOCK_CLIENT_ID),
      verifyStockIdentityForCoreBridge(stockToken),
    ])
    const until = Math.min(Date.parse(core.until), stock.until)
    if (!core.customer || core.subject !== stock.coreSubject || !Number.isFinite(until) || until <= Date.now()) {
      return { status: 'denied' }
    }
    const signed = await client.auth.getClaims(coreToken)
    const claims = signed.data?.claims
    if (signed.error || claims?.sub !== core.subject || claims.session_id !== core.session ||
        claims.client_id !== ACTIVE_STOCK_CLIENT_ID || !Number.isSafeInteger(claims.exp) ||
        (claims.exp as number) * 1000 <= Date.now() || until <= Date.now()) return { status: 'denied' }
    attempted = true
    const response = await createAdminClient().rpc('core_stock_membership_select_session', {
      p_core_subject: core.subject, p_core_session: core.session,
      p_stock_subject: stock.stockSubject, p_stock_session: stock.stockSessionId,
      p_verified_until: new Date(until).toISOString(),
      p_core_token_expires: new Date((claims.exp as number) * 1000).toISOString(),
      p_company: selected.companyId, p_instance: selected.instanceId,
      p_command: selected.commandId, p_expected_revision: expectedRevision,
    }).abortSignal(AbortSignal.timeout(2500))
    if (response.error) return { status: /^[0-9A-Z]{5}$/.test(response.error.code ?? '') ? 'denied' : 'unconfirmed' }
    const authority = response.data
    if (!authority || typeof authority !== 'object' || Array.isArray(authority) ||
        Object.keys(authority).sort().join(',') !== authorityKeys ||
        authority.companyId !== selected.companyId || authority.instanceId !== selected.instanceId ||
        authority.coreSubject !== core.subject || authority.coreSessionId !== core.session ||
        authority.selectionRevision !== (expectedRevision as number) + 1) return { status: 'unconfirmed' }
    const latest = await verifyNativeCoreProvider(client, coreToken, ACTIVE_STOCK_CLIENT_ID)
    const latestStock = await verifyStockIdentityForCoreBridge(stockToken)
    const issuedAt = Date.now()
    const expiresAt = Math.min(issuedAt + ACTIVE_REQUEST_MAX_MS, until, Date.parse(latest.until), latestStock.until)
    if (!latest.customer || latest.subject !== core.subject || latest.session !== core.session ||
        latestStock.coreSubject !== stock.coreSubject || latestStock.stockSubject !== stock.stockSubject ||
        latestStock.stockSessionId !== stock.stockSessionId || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) {
      return { status: 'unconfirmed' }
    }
    const request = parseStockMembershipRequest({
      version: 2, companyId: selected.companyId, instanceId: selected.instanceId,
      stockTenantId: authority.stockTenantId, profileId: authority.profileId, membershipId: authority.membershipId,
      membershipRevision: authority.membershipRevision, selectionRevision: authority.selectionRevision, role: authority.role,
      stockSubject: stock.stockSubject, stockSessionId: stock.stockSessionId, nonce: selected.commandId,
      method: 'POST', path: '/rpc/stock_membership_select',
    })
    const decision = parseStockMembershipDecision({ ...request, ...authority, version: 2, issuedAt, expiresAt }, request, issuedAt)
    return { status: 'selected', decision }
  } catch { return { status: attempted ? 'unconfirmed' : 'denied' } }
}
