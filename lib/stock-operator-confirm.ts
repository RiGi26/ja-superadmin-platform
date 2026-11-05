import 'server-only'

import { createClient as createStockClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { verifyNativeCoreProvider } from '@/lib/core-registry-native'
import { verifyStockIdentityForCoreBridge } from '@/lib/stock-active-identity'
import { ACTIVE_CORE_REALM, ACTIVE_STOCK_REALM, ACTIVE_STOCK_CLIENT_ID, isActiveStockUuid } from '@/lib/stock-active-protocol'
import { STOCK_MEMBERSHIP_RUNTIME_ENABLED } from '@/lib/stock-membership-protocol'
import { parseStockOperatorActivatedContext, parseStockOperatorConfirmation } from '@/lib/stock-operator-protocol'

/** Core observes the recipient's committed Stock activation itself. The caller
 * supplies an invitation selector, never an activation receipt or authority.
 */
export async function confirmStockOperatorActivation(input: unknown, stockToken: string, coreToken: string) {
  if (!STOCK_MEMBERSHIP_RUNTIME_ENABLED || process.env.NEXT_PUBLIC_SUPABASE_URL !== ACTIVE_CORE_REALM) {
    return { status: 'blocked' as const }
  }
  let attempted = false
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'inviteId' ||
        !isActiveStockUuid((input as Record<string,unknown>).inviteId)) return { status: 'denied' as const }
    const inviteId = (input as { inviteId: string }).inviteId
    const key = process.env.STOCK_SUPABASE_PUBLISHABLE_KEY
    if (!key) return { status: 'unconfirmed' as const }
    const client = await createClient()
    const observe = () => Promise.all([
      verifyNativeCoreProvider(client, coreToken, ACTIVE_STOCK_CLIENT_ID),
      verifyStockIdentityForCoreBridge(stockToken, { requireLiveOperatorSession: true }),
    ])
    const [core, stock] = await observe()
    const until = Math.min(Date.parse(core.until), stock.until)
    if (!core.customer || core.subject !== stock.coreSubject || !(until>Date.now())) return { status: 'denied' as const }
    attempted = true
    const reader = createStockClient(ACTIVE_STOCK_REALM,key,{
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${stockToken}` },
        fetch: (url, init) => fetch(url,{...init,redirect:'error',credentials:'omit',signal:AbortSignal.timeout(2500)}) },
    })
    const read = await reader.rpc('stock_operator_activated_context',{p_invite:inviteId}).abortSignal(AbortSignal.timeout(2500))
    if (read.error) return { status: 'unconfirmed' as const }
    if (read.data === null) return { status: 'not_active' as const }
    const context = parseStockOperatorActivatedContext(read.data,{inviteId,coreSubject:core.subject,stockSubject:stock.stockSubject,stockSessionId:stock.stockSessionId})
    const [latestCore, latestStock] = await observe()
    const verifiedUntil = Math.min(until,Date.parse(latestCore.until),latestStock.until)
    if (!latestCore.customer || latestCore.subject!==core.subject || latestCore.session!==core.session ||
        latestStock.coreSubject!==core.subject || latestStock.stockSubject!==stock.stockSubject ||
        latestStock.stockSessionId!==stock.stockSessionId || !(verifiedUntil>Date.now())) return { status: 'unconfirmed' as const }
    const result = await createAdminClient().rpc('core_stock_operator_confirm_activation',{
      p_core:core.subject,p_core_session:core.session,p_stock:stock.stockSubject,p_stock_session:stock.stockSessionId,
      p_until:new Date(verifiedUntil).toISOString(),p_invite:inviteId,p_context:context,
    }).abortSignal(AbortSignal.timeout(2500))
    if (result.error) return { status: 'unconfirmed' as const }
    const confirmation = parseStockOperatorConfirmation(result.data,context)
    const [finalCore,finalStock] = await observe()
    if (confirmation.stockAuditEventId!==context.stockAuditEventId || !finalCore.customer ||
        finalCore.subject!==core.subject || finalCore.session!==core.session || finalStock.coreSubject!==core.subject ||
        finalStock.stockSubject!==stock.stockSubject || finalStock.stockSessionId!==stock.stockSessionId ||
        !(Math.min(verifiedUntil,Date.parse(finalCore.until),finalStock.until)>Date.now())) return { status:'unconfirmed' as const }
    return confirmation
  } catch { return { status: attempted ? 'unconfirmed' as const : 'denied' as const } }
}
