import 'server-only'

import { createClient as createSdkClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { z } from 'zod'
import { CORE_COMPANY_RUNTIME_ENABLED } from '@/lib/core-company'
import { CORE_E1_ORIGIN, STOCK_E1_ORIGIN } from '@/lib/e1-realm'
import { E1_STOCK_RUNTIME_ENABLED } from '@/lib/e1-stock-integration'
import { e1StockMutationBinding } from '@/lib/registry-mutation-binding'
import { verifyNativeCoreSession, verifyNativeCoreProvider, verifyNativeAccount } from '@/lib/core-registry-native'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const uuid = z.uuid().transform(value => value.toLowerCase())
const selector = z.object({ commandId: uuid, companyId: uuid, reservationId: uuid }).strict()
const staged = z.object({ companyId: uuid, reservationId: uuid, coreTenantId: uuid, coreSubject: uuid,
  stockTenantId: uuid, stockSubject: uuid, profileId: uuid, auditEventId: uuid,
  product: z.literal('stock'), status: z.literal('quarantined'), isActive: z.literal(false) }).strict()
const tuple = staged.pick({ stockTenantId: true, stockSubject: true, profileId: true, auditEventId: true, status: true })
const coreContext = z.object({ companyId: uuid, reservationId: uuid, coreTenantId: uuid, coreSubject: uuid,
  product: z.literal('stock'), status: z.literal('reserved'), stockTenantId: z.null(), stockSubject: z.null(),
  profileId: z.null(), companyName: z.string().min(2).max(100), stockOrigin: z.string(), stockBinding: tuple.nullable() }).strict()
const receipt = z.object({ companyId: uuid, eventId: uuid, eventHash: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict()
const same = (a: z.infer<typeof staged>, b: z.infer<typeof staged>) =>
  (Object.keys(a) as (keyof typeof a)[]).every(key => a[key] === b[key])
const sameTuple = (a: z.infer<typeof tuple> | null, b: z.infer<typeof staged>) => a === null ||
  (Object.keys(a) as (keyof typeof a)[]).every(key => a[key] === b[key])

export function e1StockTransportGate() {
  if (!CORE_COMPANY_RUNTIME_ENABLED || !E1_STOCK_RUNTIME_ENABLED ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== CORE_E1_ORIGIN) {
    return { status: 'blocked' as const, reason: 'RUNTIME_DISABLED' as const }
  }
  // Select the reciprocal adapter explicitly; release constants remain closed.
  return e1StockMutationBinding('e1.stock.bind')
}

type NativeCredentials = Readonly<{ coreToken: string; stockToken: string }>

/** Existing internal cookie-based entry point. */
export async function bindCurrentE1StockQuarantine(input: unknown) {
  return bindQuarantine(input)
}

/** Native transport entry point; credentials come from server headers, not JSON. */
export async function bindNativeE1StockQuarantine(input: unknown, credentials: NativeCredentials) {
  if (!credentials || typeof credentials !== 'object') return { status: 'denied' as const }
  return bindQuarantine(input, credentials)
}

/** Records only a reciprocal QUARANTINED tuple. No active membership, entitlement,
 * billing or access grant. Both sessions are verified independently;
 * Stock must also have exactly one native Core identity linked to this actor.
 * Matching emails/UUIDs and input proof flags never pair the accounts.
 */
async function bindQuarantine(input: unknown, credentials?: NativeCredentials) {
  const parsed = selector.safeParse(input)
  if (!parsed.success) return { status: 'denied' as const }
  const bindingGate = e1StockTransportGate()
  if (bindingGate.status === 'blocked') return bindingGate
  const request = parsed.data
  let attempted = false
  try {
    const clientId = process.env.STOCK_SSO_CLIENT_ID
    const coreKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (credentials && (!uuid.safeParse(clientId).success || !coreKey ||
        ![credentials.coreToken, credentials.stockToken].every(token =>
          typeof token === 'string' && token.length > 0 && token.length <= 8192 && !/[\s,]/.test(token)))) {
      throw new Error('AUTH_REQUIRED')
    }
    const core = credentials ? createSdkClient(CORE_E1_ORIGIN, coreKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${credentials.coreToken}` } },
    }) : await createClient()
    const liveCore = () => credentials
      ? verifyNativeCoreProvider(core, credentials.coreToken, clientId!) : verifyNativeCoreSession(core)
    const actor = await liveCore()
    if (!actor.customer) throw new Error('CUSTOMER_REQUIRED')
    const readCore = async () => {
      const result = await core.rpc('core_registry_e1_stock_context', {
        p_company: request.companyId, p_reservation: request.reservationId,
      })
      if (result.error) throw new Error('DENIED')
      const context = coreContext.parse(result.data)
      if (context.companyId !== request.companyId || context.reservationId !== request.reservationId ||
          context.coreSubject !== actor.subject || context.stockOrigin !== STOCK_E1_ORIGIN) {
        throw new Error('DENIED')
      }
      return context
    }
    const context = await readCore()
    const stockKey = process.env.STOCK_SUPABASE_PUBLISHABLE_KEY
    const token = credentials ? credentials.stockToken :
      (await headers()).get('x-webzoka-stock-authorization')?.match(/^Bearer ([^\s,]+)$/i)?.[1]
    if (!token || !stockKey) throw new Error('AUTH_REQUIRED')
    // The database origin selects the realm. Input cannot supply a URL or client.
    const stock = createSdkClient(context.stockOrigin, stockKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const liveStock = async () => {
      const started = Date.now()
      const user = await stock.auth.getUser(token)
      if (user.error) throw new Error('AUTH_REQUIRED')
      const account = verifyNativeAccount(user.data.user)
      const identities = user.data.user?.identities?.filter(identity => identity.provider === 'custom:webzoka')
      if (identities?.length !== 1 || identities[0].identity_data?.sub !== actor.subject) {
        throw new Error('NATIVE_IDENTITY_LINK_REQUIRED')
      }
      const verified = await stock.auth.getClaims(token)
      if (verified.error) throw new Error('AUTH_REQUIRED')
      const claims = z.object({ sub: uuid, session_id: uuid, iss: z.literal(`${context.stockOrigin}/auth/v1`),
        aud: z.literal('authenticated'), role: z.literal('authenticated'), iat: z.number().int(),
        exp: z.number().int(), nbf: z.number().int().optional(), user_role: z.string().optional() }).parse(verified.data?.claims)
      const now = Date.now() / 1000
      if (claims.sub !== account.id || claims.iat > now || claims.exp <= now || claims.iat >= claims.exp ||
          (claims.nbf !== undefined && claims.nbf > now) || claims.user_role === 'superadmin') throw new Error('AUTH_REQUIRED')
      const until = Math.min(claims.exp * 1000, started + 30_000)
      if (until <= Date.now()) throw new Error('AUTH_REQUIRED')
      return { subject: account.id, session: claims.session_id, until }
    }
    const stockActor = await liveStock()
    const readStock = async () => {
      const result = await stock.rpc('stock_e1_resource_context', {
        p_company: request.companyId, p_reservation: request.reservationId,
      })
      if (result.error) throw new Error('DENIED')
      const value = staged.parse(result.data)
      if (value.companyId !== context.companyId || value.reservationId !== context.reservationId ||
          value.coreTenantId !== context.coreTenantId || value.coreSubject !== actor.subject ||
          value.stockSubject !== stockActor.subject || !sameTuple(context.stockBinding, value)) throw new Error('DENIED')
      return value
    }
    const value = await readStock()
    const [freshCore, freshStock, freshContext, freshValue] = await Promise.all([
      liveCore(), liveStock(), readCore(), readStock(),
    ])
    // Parallel context reads may finish after the identity observations. Their
    // original deadlines must still hold when used; waiting never renews them.
    if (Date.parse(freshCore.until) <= Date.now() || freshStock.until <= Date.now() ||
        !freshCore.customer || freshCore.subject !== actor.subject || freshCore.session !== actor.session ||
        freshStock.subject !== stockActor.subject || freshStock.session !== stockActor.session ||
        freshContext.stockOrigin !== context.stockOrigin || freshContext.coreTenantId !== context.coreTenantId ||
        !sameTuple(freshContext.stockBinding, value) || !same(freshValue, value)) throw new Error('AUTH_CHANGED')
    const admin = createAdminClient()
    attempted = true
    const result = await admin.rpc(bindingGate.rpc, {
      p_actor: actor.subject, p_session: actor.session, p_command: request.commandId,
      p_company: request.companyId, p_reservation: request.reservationId,
      p_stock_subject: stockActor.subject, p_stock_session: stockActor.session,
      p_stock_tenant: value.stockTenantId, p_profile: value.profileId, p_stock_audit_event: value.auditEventId,
      p_auth_until: new Date(Math.min(Date.parse(freshCore.until), freshStock.until)).toISOString(),
    })
    if (result.error) {
      if (result.error.code === 'PGRST202') return { status: 'blocked' as const, reason: 'E1_BIND_RPC_UNAVAILABLE' as const }
      if (result.error.code === '55P03') return { status: 'unconfirmed' as const, ...request }
      if (/^[0-9A-Z]{5}$/.test(result.error.code)) return { status: 'denied' as const }
      throw new Error('UNCONFIRMED')
    }
    const response = z.object({ binding: staged.extend({ stockOrigin: z.literal(context.stockOrigin) }).strict(), receipt }).strict().parse(result.data)
    if (!same(value, response.binding) || response.receipt.companyId !== request.companyId) throw new Error('UNCONFIRMED')
    const [lastCore, lastStock, lastValue, lastContext] = await Promise.all([
      liveCore(), liveStock(), readStock(), readCore(),
    ])
    if (Date.parse(lastCore.until) <= Date.now() || lastStock.until <= Date.now() ||
        !lastCore.customer || lastCore.subject !== actor.subject || lastCore.session !== actor.session ||
        lastStock.subject !== stockActor.subject || lastStock.session !== stockActor.session || !same(lastValue, value) ||
        lastContext.stockOrigin !== context.stockOrigin || lastContext.coreTenantId !== context.coreTenantId ||
        lastContext.stockBinding === null || !sameTuple(lastContext.stockBinding, value)) throw new Error('UNCONFIRMED')
    return { status: 'quarantined' as const, ...response }
  } catch {
    // A remote check cannot undo a committed RPC. Reconcile this SAME key and
    // reservation; both profiles/access gates remain inactive on uncertainty.
    return attempted ? { status: 'unconfirmed' as const, ...request } : { status: 'denied' as const }
  }
}
