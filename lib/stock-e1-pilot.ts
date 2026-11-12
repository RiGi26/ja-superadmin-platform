import 'server-only'

import { createClient as createSdkClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyNativeCoreProvider } from '@/lib/core-registry-native'
import { verifyStockIdentityForCoreBridge } from '@/lib/stock-active-identity'
import { ACTIVE_CORE_REALM, ACTIVE_STOCK_REALM, ACTIVE_STOCK_CLIENT_ID, isActiveStockUuid } from '@/lib/stock-active-protocol'

export async function readE1PilotStatus(companyId: string, instanceId: string): Promise<boolean> {
  if (process.env.STOCK_SSO_PILOT_ENABLED !== 'true' || !isActiveStockUuid(companyId) || !isActiveStockUuid(instanceId)) return false
  try {
    const client = await createClient()
    const result = await client.rpc('core_stock_e1_pilot_status', { p_company: companyId, p_instance: instanceId })
      .abortSignal(AbortSignal.timeout(2500))
    return !result.error && result.data === true
  } catch { return false }
}

/** Native credentials are supplied by the existing server-to-server envelope.
 * This path accepts no browser-supplied Company, ownership or activation claim.
 */
export async function e1PilotExchange(input: unknown, stockToken: string, coreToken: string) {
  if (process.env.STOCK_SSO_PILOT_ENABLED !== 'true' || process.env.NEXT_PUBLIC_SUPABASE_URL !== ACTIVE_CORE_REALM) {
    return { status: 'blocked' as const }
  }
  let attempted = false
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'nonce,phase') {
      return { status: 'denied' as const }
    }
    const request = input as Record<string, unknown>
    if (!isActiveStockUuid(request.nonce) || !['prepare', 'confirm'].includes(String(request.phase))) return { status: 'denied' as const }
    const coreClient = await createClient()
    const [core, stock] = await Promise.all([
      verifyNativeCoreProvider(coreClient, coreToken, ACTIVE_STOCK_CLIENT_ID),
      verifyStockIdentityForCoreBridge(stockToken),
    ])
    if (!core.customer || core.subject !== stock.coreSubject || Date.parse(core.until) <= Date.now() || stock.until <= Date.now()) {
      return { status: 'denied' as const }
    }
    const until = new Date(Math.min(Date.parse(core.until), stock.until)).toISOString()
    const stockKey = process.env.STOCK_SUPABASE_PUBLISHABLE_KEY
    if (!stockKey) return { status: 'denied' as const }
    const client = createSdkClient(ACTIVE_STOCK_REALM, stockKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${stockToken}` },
        fetch: (url, init) => fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(2500) }) },
    })
    const db = createAdminClient()
    attempted = true
    const prepared = await db.rpc('core_stock_e1_pilot_prepare', { p_actor: core.subject, p_core_session: core.session,
      p_stock_subject: stock.stockSubject, p_stock_session: stock.stockSessionId, p_until: until,
    }).abortSignal(AbortSignal.timeout(2500))
    const a = prepared.data
    if (prepared.error || !a || !isActiveStockUuid(a.bindingId) || a.coreSubject !== core.subject || a.stockSubject !== stock.stockSubject) {
      return { status: 'denied' as const }
    }
    if (request.phase === 'prepare') return { status: 'prepared' as const, nonce: request.nonce, authority: a }
    // Independent native JWT read, never trust the callback's claimed receipt.
    const receipt = await client.rpc('stock_e1_pilot_receipt')
    const expected = ['bindingId', 'companyId', 'instanceId', 'coreTenantId', 'coreSubject', 'stockTenantId',
      'stockSubject', 'profileId', 'stockBirthAudit']
    if (receipt.error || receipt.data?.state !== 'staged' ||
      Object.keys(receipt.data).sort().join(',') !== [...expected, 'state'].sort().join(',') ||
      expected.some(key => receipt.data[key] !== a[key])) return { status: 'denied' as const }
    const signed = await coreClient.auth.getClaims(coreToken)
    const claims = signed.data?.claims
    if (signed.error || claims?.sub !== core.subject || claims.session_id !== core.session ||
      claims.client_id !== ACTIVE_STOCK_CLIENT_ID || !Number.isSafeInteger(claims.exp) || (claims.exp as number) * 1000 <= Date.now() ||
      Date.parse(until) <= Date.now()) return { status: 'denied' as const }
    const confirmed = await db.rpc('core_stock_e1_pilot_confirm', { p_binding: a.bindingId, p_actor: core.subject,
      p_core_session: core.session, p_stock_subject: stock.stockSubject, p_stock_session: stock.stockSessionId,
      p_until: until, p_token_expires: new Date((claims.exp as number) * 1000).toISOString(),
    }).abortSignal(AbortSignal.timeout(2500))
    if (confirmed.error || !confirmed.data || Date.parse(until) <= Date.now()) return { status: 'unconfirmed' as const }
    return { status: 'confirmed' as const, nonce: request.nonce, authority: confirmed.data }
  } catch { return { status: attempted ? 'unconfirmed' as const : 'denied' as const } }
}
