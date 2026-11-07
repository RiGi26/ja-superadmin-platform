import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { verifyNativeCoreProvider } from '@/lib/core-registry-native'
import { ACTIVE_STOCK_RUNTIME_ENABLED, STOCK_SSO_PILOT_ENABLED } from '@/lib/stock-active-release'
import { ACTIVE_CORE_REALM, ACTIVE_STOCK_CLIENT_ID, ACTIVE_REQUEST_MAX_MS, isActiveStockUuid,
  parseActiveStockSelector, parseActiveStockDecision, type ActiveStockDecision } from '@/lib/stock-active-protocol'
import { verifyStockIdentityForCoreBridge } from '@/lib/stock-active-identity'
import { paidStockSessionAuthority } from '@/lib/stock-paid-session'
import { STOCK_PAID_BILLING_RUNTIME_ENABLED } from '@/lib/stock-purchase-policy'

/** Enrolls only a managed-session relationship under a previously approved
 * binding. It does not create authority, users, profiles or product activation.
 * Both native credentials are request-local and are never returned or stored.
 */
export async function enrollActiveStockSession(input: unknown, stockToken: string, coreToken: string): Promise<
  { status: 'enrolled'; decision: ActiveStockDecision } | { status: 'blocked' | 'denied' | 'unconfirmed' }
> {
  if (!(ACTIVE_STOCK_RUNTIME_ENABLED || STOCK_SSO_PILOT_ENABLED || STOCK_PAID_BILLING_RUNTIME_ENABLED) || process.env.NEXT_PUBLIC_SUPABASE_URL !== ACTIVE_CORE_REALM) {
    return { status: 'blocked' }
  }
  let attempted = false
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        !['nonce', 'companyId,instanceId,nonce'].includes(Object.keys(input).sort().join(','))) return { status: 'denied' }
    const raw = input as Record<string, unknown>
    const selected = Object.keys(raw).length === 1 ? null
      : parseActiveStockSelector({ companyId: raw.companyId, instanceId: raw.instanceId })
    if (!isActiveStockUuid(raw.nonce) || typeof coreToken !== 'string' || coreToken.length > 8192 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(coreToken)) return { status: 'denied' }
    const client = await createClient()
    const [core, stock] = await Promise.all([
      verifyNativeCoreProvider(client, coreToken, ACTIVE_STOCK_CLIENT_ID),
      verifyStockIdentityForCoreBridge(stockToken),
    ])
    if (!core.customer || core.subject !== stock.coreSubject || !Number.isFinite(Date.parse(core.until)) ||
        Date.parse(core.until) <= Date.now() || stock.until <= Date.now()) return { status: 'denied' }
    const signed = await client.auth.getClaims(coreToken)
    const claims = signed.data?.claims
    if (signed.error || claims?.sub !== core.subject || claims.session_id !== core.session ||
        claims.client_id !== ACTIVE_STOCK_CLIENT_ID || !Number.isSafeInteger(claims.exp) ||
        (claims.exp as number) * 1000 <= Date.now()) return { status: 'denied' }
    attempted = true
    const paid = await paidStockSessionAuthority({ coreSubject: core.subject, stockSubject: stock.stockSubject,
      stockSession: stock.stockSessionId, until: Math.min(Date.parse(core.until), stock.until) }, {
      companyId: selected?.companyId ?? null, instanceId: selected?.instanceId ?? null,
      coreSession: core.session, tokenExpires: (claims.exp as number) * 1000,
    })
    if (paid.kind === 'denied' || (paid.kind === 'legacy' && !(ACTIVE_STOCK_RUNTIME_ENABLED || STOCK_SSO_PILOT_ENABLED))) return { status: 'denied' }
    const result = paid.kind === 'paid' ? { data: paid.data, error: null } : await createAdminClient().rpc('core_stock_active_enroll_session', {
      p_company: selected?.companyId ?? null, p_instance: selected?.instanceId ?? null,
      p_core_subject: core.subject, p_core_session: core.session,
      p_stock_subject: stock.stockSubject, p_stock_session: stock.stockSessionId,
      p_verified_until: new Date(Math.min(Date.parse(core.until), stock.until)).toISOString(),
      p_core_token_expires: new Date((claims.exp as number) * 1000).toISOString(),
    }).abortSignal(AbortSignal.timeout(2500))
    if (result.error) return { status: /^[0-9A-Z]{5}$/.test(result.error.code ?? '') ? 'denied' : 'unconfirmed' }
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data) ||
        Object.keys(result.data).sort().join(',') !== ['bindingId', 'bindingRevision', 'companyId',
          'companyRevision', 'coreSessionId', 'coreSubject', 'coreTenantId', 'instanceId', 'stockTenantId'].sort().join(',')) {
      return { status: 'unconfirmed' }
    }
    const latest = await verifyNativeCoreProvider(client, coreToken, ACTIVE_STOCK_CLIENT_ID)
    if (!latest.customer || latest.subject !== core.subject || latest.session !== core.session ||
        Date.parse(core.until) <= Date.now() || stock.until <= Date.now()) return { status: 'unconfirmed' }
    const request = { stockSubject: stock.stockSubject, stockSessionId: stock.stockSessionId,
      nonce: raw.nonce, method: 'POST', path: '/rpc/stock_active_confirm_subject' }
    const issuedAt = Date.now()
    const decision = parseActiveStockDecision({ ...result.data, ...request, version: 1, issuedAt,
      expiresAt: Math.min(issuedAt + ACTIVE_REQUEST_MAX_MS, Date.parse(core.until), stock.until),
    }, request, issuedAt)
    if ((selected && (decision.companyId !== selected.companyId || decision.instanceId !== selected.instanceId)) ||
        decision.coreSubject !== core.subject || decision.coreSessionId !== core.session) return { status: 'unconfirmed' }
    return { status: 'enrolled', decision }
  } catch { return { status: attempted ? 'unconfirmed' : 'denied' } }
}
