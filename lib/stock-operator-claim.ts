import 'server-only'

import { createClient as createStockClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { verifyNativeCoreProvider } from '@/lib/core-registry-native'
import { verifyStockIdentityForCoreBridge } from '@/lib/stock-active-identity'
import { ACTIVE_CORE_REALM, ACTIVE_STOCK_REALM, ACTIVE_STOCK_CLIENT_ID } from '@/lib/stock-active-protocol'
import { STOCK_OPERATOR_INVITATION_ENABLED, parseStockOperatorClaim, parseStockOperatorProof,
  parseStockOperatorStage, parseStockOperatorAdmission } from '@/lib/stock-operator-protocol'
import { STOCK_MEMBERSHIP_RUNTIME_ENABLED } from '@/lib/stock-membership-protocol'

/** A verified claim reserves stable IDs. Stock admission and activation require
 * separate commits. The recipient's native sessions authorize this call.
 */
export async function claimStockOperatorInvitation(input: unknown, stockToken: string, coreToken: string) {
  if (!STOCK_OPERATOR_INVITATION_ENABLED || !STOCK_MEMBERSHIP_RUNTIME_ENABLED ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== ACTIVE_CORE_REALM) return { status: 'blocked' as const }
  let attempted = false
  try {
    const { inviteId, proof } = parseStockOperatorProof(input)
    const client = await createClient()
    const observe = () => Promise.all([
      verifyNativeCoreProvider(client, coreToken, ACTIVE_STOCK_CLIENT_ID),
      verifyStockIdentityForCoreBridge(stockToken, { requireLiveOperatorSession: true }),
    ])
    const [core, stock] = await observe()
    const until = Math.min(Date.parse(core.until), stock.until)
    if (!core.customer || core.subject !== stock.coreSubject || !Number.isFinite(until) || until <= Date.now()) {
      return { status: 'denied' as const }
    }

    attempted = true
    const result = await createAdminClient().rpc('core_stock_operator_claim', {
      p_core_subject: core.subject, p_core_session: core.session,
      p_stock_subject: stock.stockSubject, p_stock_session: stock.stockSessionId,
      p_until: new Date(until).toISOString(), p_invite: inviteId, p_command: inviteId, p_secret_hash: proof,
    }).abortSignal(AbortSignal.timeout(2500))
    if (result.error) {
      return { status: result.error.code === 'P0001' ? 'denied' as const : 'unconfirmed' as const }
    }
    const claim = parseStockOperatorClaim(result.data, inviteId)
    if (claim.status === 'claimed' && (claim.coreSubject !== core.subject || claim.stockSubject !== stock.stockSubject)) {
      return { status: 'unconfirmed' as const }
    }
    const [latestCore, latestStock] = await observe()
    if (!latestCore.customer || latestCore.subject !== core.subject || latestCore.session !== core.session ||
        latestStock.coreSubject !== core.subject || latestStock.stockSubject !== stock.stockSubject ||
        latestStock.stockSessionId !== stock.stockSessionId ||
        !(Math.min(until, Date.parse(latestCore.until), latestStock.until) > Date.now()) ||
        (claim.status === 'claimed' && Date.parse(claim.expiresAt) <= Date.now())) {
      return { status: 'unconfirmed' as const }
    }
    if (claim.status === 'activated') {
      const resumed = await createAdminClient().rpc('core_stock_operator_commit', {
        p_core: core.subject, p_core_session: core.session, p_stock: stock.stockSubject,
        p_stock_session: stock.stockSessionId, p_until: new Date(Math.min(until,Date.parse(latestCore.until),latestStock.until)).toISOString(),
        p_invite: inviteId, p_stage: null,
      }).abortSignal(AbortSignal.timeout(2500))
      if (resumed.error) return { status: 'unconfirmed' as const }
      const admission = parseStockOperatorAdmission(resumed.data, inviteId)
      if (admission.stage.coreSubject !== core.subject || admission.stage.stockSubject !== stock.stockSubject ||
          until <= Date.now()) return { status: 'unconfirmed' as const }
      return admission
    }
    return claim
  } catch {
    return { status: attempted ? 'unconfirmed' as const : 'denied' as const }
  }
}


/** Core independently reads the exact inactive Stock profile using the recipient's
 * token. Only that receipt reaches the Registry commit.
 */
export async function commitStockOperatorInvitation(input: unknown, stockToken: string, coreToken: string) {
  const claimed = await claimStockOperatorInvitation(input, stockToken, coreToken)
  if (claimed.status !== 'claimed') return claimed
  try {
    const key = process.env.STOCK_SUPABASE_PUBLISHABLE_KEY
    if (!key) return { status: 'unconfirmed' as const }
    const client = await createClient()
    const observe = () => Promise.all([
      verifyNativeCoreProvider(client, coreToken, ACTIVE_STOCK_CLIENT_ID),
      verifyStockIdentityForCoreBridge(stockToken, { requireLiveOperatorSession: true }),
    ])
    const [core, stock] = await observe()
    const until = Math.min(Date.parse(core.until), stock.until)
    if (!core.customer || core.subject !== claimed.coreSubject || stock.coreSubject !== core.subject ||
        stock.stockSubject !== claimed.stockSubject || !(until > Date.now())) return { status: 'unconfirmed' as const }
    const stockClient = createStockClient(ACTIVE_STOCK_REALM, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${stockToken}` },
        fetch: (url, init) => fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(2500) }) },
    })
    const read = await stockClient.rpc('stock_operator_staged_context', { p_invite: claimed.inviteId })
      .abortSignal(AbortSignal.timeout(2500))
    if (read.error) return { status: 'unconfirmed' as const }
    const stage = parseStockOperatorStage(read.data, claimed)
    const [latestCore, latestStock] = await observe()
    const verifiedUntil = Math.min(until, Date.parse(latestCore.until), latestStock.until)
    if (!latestCore.customer || latestCore.subject !== core.subject || latestCore.session !== core.session ||
        latestStock.coreSubject !== core.subject || latestStock.stockSubject !== stock.stockSubject ||
        latestStock.stockSessionId !== stock.stockSessionId || !(verifiedUntil > Date.now()) ||
        Date.parse(stage.expiresAt) <= Date.now()) return { status: 'unconfirmed' as const }
    const committed = await createAdminClient().rpc('core_stock_operator_commit', {
      p_core: core.subject, p_core_session: core.session, p_stock: stock.stockSubject,
      p_stock_session: stock.stockSessionId, p_until: new Date(verifiedUntil).toISOString(),
      p_invite: claimed.inviteId, p_stage: stage,
    }).abortSignal(AbortSignal.timeout(2500))
    if (committed.error) return { status: 'unconfirmed' as const }
    const result = parseStockOperatorAdmission(committed.data, claimed.inviteId)
    if (Object.keys(stage).some(key => result.stage[key as keyof typeof stage] !== stage[key as keyof typeof stage]) || verifiedUntil <= Date.now()) {
      return { status: 'unconfirmed' as const }
    }
    return result
  } catch { return { status: 'unconfirmed' as const } }
}
