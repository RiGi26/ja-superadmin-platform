import 'server-only'

import { createClient as createSdkClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { verifyNativeCoreProvider } from '@/lib/core-registry-native'
import { verifyStockIdentityForCoreBridge } from '@/lib/stock-active-identity'
import { ACTIVE_CORE_REALM, ACTIVE_STOCK_REALM, ACTIVE_STOCK_CLIENT_ID, isActiveStockUuid } from '@/lib/stock-active-protocol'
import { stockPlanId } from '@/lib/stock-purchase-policy'
import { stockPreparationDiagnostics } from '@/lib/stock-membership-preparation-diagnostics'
import { STOCK_MEMBERSHIP_PREPARATION_ENABLED, parseStockWorkspaceChoice,
  parseStockMembershipPreparation, type StockMembershipPreparation } from '@/lib/stock-membership-protocol'

/** Trusted dual-native callback receiver. Only the saved, authenticated package
 * intent reaches the existing billing account preparer. It creates no invoice,
 * subscription or access. A partial result must retry the same command.
 */
export async function prepareStockMembershipOwner(input: unknown, stockToken: string, coreToken: string): Promise<
  { status: 'prepared'; receipt: StockMembershipPreparation } | { status: 'blocked' | 'denied' | 'unconfirmed' }
> {
  const diagnostic = stockPreparationDiagnostics('core_prepare')
  if (!STOCK_MEMBERSHIP_PREPARATION_ENABLED || process.env.NEXT_PUBLIC_SUPABASE_URL !== ACTIVE_CORE_REALM) {
    return diagnostic.result({ status: 'blocked' })
  }
  let attempted = false
  try {
    const selected = parseStockWorkspaceChoice(input)
    if (typeof coreToken !== 'string' || coreToken.length > 8192 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(coreToken)) return diagnostic.result({ status: 'denied' })
    const client = await createClient()
    async function observe() {
      const [core, stock] = await Promise.all([
        verifyNativeCoreProvider(client, coreToken, ACTIVE_STOCK_CLIENT_ID),
        verifyStockIdentityForCoreBridge(stockToken),
      ])
      const until = Math.min(Date.parse(core.until), stock.until)
      if (!core.customer || core.subject !== stock.coreSubject || !Number.isFinite(until) || until <= Date.now()) {
        throw new Error('STOCK_MEMBERSHIP_PREPARATION_DENIED')
      }
      return { core, stock, until }
    }
    diagnostic.at('native_identity')
    const first = await observe()
    // Explicit provider token: a pre-existing browser session must not select
    // another customer's saved intent in this server-to-server request.
    diagnostic.at('saved_intent')
    const saved = await client.rpc('stock_billing_read_workspace_intent', { p_company: selected.companyId }).setHeader('Authorization', `Bearer ${coreToken}`)
      .abortSignal(AbortSignal.timeout(2500))
    diagnostic.error(saved.error)
    const intent: unknown = saved.data
    if (saved.error || !intent || typeof intent !== 'object' || Array.isArray(intent) ||
        Object.keys(intent).sort().join(',') !== 'commandId,companyId,planId,reservationId') return diagnostic.result({ status: 'denied' })
    const choice = intent as Record<string, unknown>
    const planId = stockPlanId(choice.planId)
    if (!planId || choice.commandId !== selected.commandId ||
        (choice.companyId !== null && choice.companyId !== selected.companyId) ||
        (choice.reservationId !== null && choice.reservationId !== selected.instanceId) ||
        (choice.companyId === null && choice.reservationId !== null)) return diagnostic.result({ status: 'denied' })
    async function current() {
      const latest = await observe()
      if (latest.core.subject !== first.core.subject || latest.core.session !== first.core.session ||
          latest.stock.stockSubject !== first.stock.stockSubject || latest.stock.stockSessionId !== first.stock.stockSessionId ||
          first.until <= Date.now()) throw new Error('STOCK_MEMBERSHIP_PREPARATION_DENIED')
      return Math.min(first.until, latest.until)
    }
    diagnostic.at('native_recheck')
    const until = await current()
    const db = createAdminClient()
    // Exact origin lookup, independently of browser selectors or cached tenant
    // metadata. Missing/unknown reader results cannot fall through to v1.
    diagnostic.at('origin_read')
    const origin = await db.rpc('core_stock_workspace_is_v2', {
      p_company: selected.companyId, p_instance: selected.instanceId,
    }).abortSignal(AbortSignal.timeout(2500))
    diagnostic.error(origin.error)
    if (origin.error || typeof origin.data !== 'boolean') return diagnostic.result({ status: 'denied' })
    if (origin.data) {
      diagnostic.at('native_recheck')
      const verifiedUntil = await current()
      attempted = true
      diagnostic.at('membership_prepare')
      const prepared = await db.rpc('core_stock_workspace_prepare_owner', {
        p_core_subject: first.core.subject, p_core_session: first.core.session,
        p_stock_subject: first.stock.stockSubject, p_stock_session: first.stock.stockSessionId,
        p_verified_until: new Date(verifiedUntil).toISOString(),
        p_company: selected.companyId, p_instance: selected.instanceId, p_command: selected.commandId,
      }).abortSignal(AbortSignal.timeout(2500))
      diagnostic.error(prepared.error)
      if (prepared.error) return diagnostic.result({ status: 'unconfirmed' })
      diagnostic.at('receipt_parse')
      const receipt = parseStockMembershipPreparation(prepared.data)
      if (receipt.originVersion !== 2 || receipt.commandId !== selected.commandId || receipt.companyId !== selected.companyId ||
          receipt.instanceId !== selected.instanceId || receipt.coreSubject !== first.core.subject || receipt.stockSubject !== first.stock.stockSubject) {
        return diagnostic.result({ status: 'unconfirmed' })
      }
      diagnostic.at('final_native_recheck')
      await current()
      return diagnostic.result({ status: 'prepared', receipt })
    }
    attempted = true
    diagnostic.at('account_prepare')
    const account = await db.rpc('stock_billing_prepare_account', {
      p_actor: first.core.subject, p_session: first.core.session, p_auth_until: new Date(until).toISOString(),
      p_company: selected.companyId, p_reservation: selected.instanceId, p_plan: planId,
    }).abortSignal(AbortSignal.timeout(2500))
    diagnostic.error(account.error)
    if (account.error || !account.data || typeof account.data !== 'object' || Array.isArray(account.data) ||
        Object.keys(account.data).sort().join(',') !== 'planId,tenantId' || !isActiveStockUuid(account.data.tenantId) ||
        account.data.planId !== planId) return diagnostic.result({ status: 'unconfirmed' })
    diagnostic.at('native_recheck')
    const verifiedUntil = await current()
    diagnostic.at('membership_prepare')
    const prepared = await db.rpc('core_stock_membership_prepare_owner', {
      p_core_subject: first.core.subject, p_core_session: first.core.session,
      p_stock_subject: first.stock.stockSubject, p_stock_session: first.stock.stockSessionId,
      p_verified_until: new Date(verifiedUntil).toISOString(),
      p_company: selected.companyId, p_instance: selected.instanceId, p_command: selected.commandId,
    }).abortSignal(AbortSignal.timeout(2500))
    diagnostic.error(prepared.error)
    if (prepared.error) return diagnostic.result({ status: 'unconfirmed' })
    diagnostic.at('receipt_parse')
    const receipt = parseStockMembershipPreparation(prepared.data)
    if (receipt.originVersion !== undefined || receipt.commandId !== selected.commandId || receipt.companyId !== selected.companyId ||
        receipt.instanceId !== selected.instanceId || receipt.coreSubject !== first.core.subject ||
        receipt.stockSubject !== first.stock.stockSubject || receipt.coreTenantId !== account.data.tenantId) {
      return diagnostic.result({ status: 'unconfirmed' })
    }
    diagnostic.at('final_native_recheck')
    await current()
    return diagnostic.result({ status: 'prepared', receipt })
  } catch (error) {
    diagnostic.error(error)
    return diagnostic.result({ status: attempted ? 'unconfirmed' : 'denied' })
  }
}

/** Confirm only after an independent authenticated Stock read. Neither a
 * callback URL nor a browser/peer-supplied success flag can open checkout.
 */
export async function confirmStockMembershipOwner(input: unknown, stockToken: string, coreToken: string) {
  const diagnostic = stockPreparationDiagnostics('core_confirm')
  diagnostic.at('repeat_prepare')
  const prepared = await prepareStockMembershipOwner(input, stockToken, coreToken)
  if (prepared.status !== 'prepared') return diagnostic.result(prepared)
  try {
    const key = process.env.STOCK_SUPABASE_PUBLISHABLE_KEY
    if (!key) return diagnostic.result({ status: 'unconfirmed' as const })
    const receipt = prepared.receipt
    const stock = createSdkClient(ACTIVE_STOCK_REALM, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${stockToken}` },
        fetch: (url, init) => fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(2500) }) },
    })
    diagnostic.at('stock_context_read')
    const observed = await stock.rpc('stock_membership_prepared_owner_context', {
      p_company: receipt.companyId, p_instance: receipt.instanceId, p_command: receipt.commandId,
    }).abortSignal(AbortSignal.timeout(2500))
    diagnostic.error(observed.error)
    if (observed.error) return diagnostic.result({ status: 'unconfirmed' as const })
    diagnostic.at('receipt_match')
    if (JSON.stringify(parseStockMembershipPreparation(observed.data)) !== JSON.stringify(receipt)) {
      return diagnostic.result({ status: 'unconfirmed' as const })
    }
    diagnostic.at('native_identity')
    const client = await createClient()
    const [core, nativeStock] = await Promise.all([
      verifyNativeCoreProvider(client, coreToken, ACTIVE_STOCK_CLIENT_ID), verifyStockIdentityForCoreBridge(stockToken),
    ])
    const until = Math.min(Date.parse(core.until), nativeStock.until)
    if (!core.customer || core.subject !== receipt.coreSubject || nativeStock.coreSubject !== receipt.coreSubject ||
        nativeStock.stockSubject !== receipt.stockSubject || !Number.isFinite(until) || until <= Date.now()) {
      return diagnostic.result({ status: 'unconfirmed' as const })
    }
    diagnostic.at('core_acknowledge')
    const saved = await createAdminClient().rpc(receipt.originVersion === 2 ? 'core_stock_workspace_confirm_owner' : 'core_stock_membership_confirm_owner', {
      p_core_subject: core.subject, p_core_session: core.session,
      p_stock_subject: nativeStock.stockSubject, p_stock_session: nativeStock.stockSessionId,
      p_verified_until: new Date(until).toISOString(), p_company: receipt.companyId,
      p_instance: receipt.instanceId, p_command: receipt.commandId, p_stock_receipt: receipt,
    }).abortSignal(AbortSignal.timeout(2500))
    diagnostic.error(saved.error)
    if (saved.error) return diagnostic.result({ status: 'unconfirmed' as const })
    diagnostic.at('acknowledgement_result')
    const value = saved.data
    if (saved.error || !value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== 'accessGranted,commandId,companyId,instanceId,status' ||
        value.status !== 'confirmed' || value.accessGranted !== false || value.companyId !== receipt.companyId ||
        value.instanceId !== receipt.instanceId || value.commandId !== receipt.commandId || until <= Date.now()) {
      return diagnostic.result({ status: 'unconfirmed' as const })
    }
    return diagnostic.result({ status: 'confirmed' as const, companyId: receipt.companyId, instanceId: receipt.instanceId,
      commandId: receipt.commandId, accessGranted: false as const })
  } catch (error) {
    diagnostic.error(error)
    return diagnostic.result({ status: 'unconfirmed' as const })
  }
}
