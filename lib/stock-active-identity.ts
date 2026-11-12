import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { ACTIVE_STOCK_REALM, isActiveStockUuid, activeStockSessionMode } from '@/lib/stock-active-protocol'

/** Verified native identity observation. Live Stock database-session and local
 * canonical membership checks remain mandatory at the protected data boundary.
 */
export async function verifyStockIdentityForCoreBridge(token: string, options: { requireLiveOperatorSession?: boolean; signal?: AbortSignal } = {}) {
  const key = process.env.STOCK_SUPABASE_PUBLISHABLE_KEY
  if (!key || options.signal?.aborted || typeof token !== 'string' || token.length > 8192 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error('ACTIVE_STOCK_IDENTITY_DENIED')
  const started = Date.now()
  const client = createClient(ACTIVE_STOCK_REALM, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error',
      signal: AbortSignal.any([AbortSignal.timeout(2500), ...(options.signal ? [options.signal] : []), ...(init?.signal ? [init.signal] : [])]),
    }) },
  })
  const [identity, signed] = await Promise.all([client.auth.getUser(token), client.auth.getClaims(token)])
  const user = identity.data.user, claims = signed.data?.claims
  const now = Date.now()
  if (identity.error || signed.error || !user || !claims || user.is_anonymous !== false ||
      !user.email || !user.email_confirmed_at || !Number.isFinite(Date.parse(user.email_confirmed_at)) ||
      Date.parse(user.email_confirmed_at) > now || !isActiveStockUuid(user.id) ||
      claims.sub !== user.id || claims.iss !== ACTIVE_STOCK_REALM + '/auth/v1' ||
      claims.aud !== 'authenticated' || claims.role !== 'authenticated' ||
      claims.is_anonymous !== false || claims.client_id !== undefined ||
      !isActiveStockUuid(claims.session_id) || activeStockSessionMode(claims.amr) !== 'federated' ||
      !Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.iat) ||
      (claims.iat as number) <= 0 || (claims.iat as number) * 1000 > now ||
      (claims.exp as number) * 1000 <= now || (claims.exp as number) <= (claims.iat as number) ||
      (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || (claims.nbf as number) * 1000 > now))) {
    throw new Error('ACTIVE_STOCK_IDENTITY_DENIED')
  }
  const linked = user.identities?.filter(item => item.provider === 'custom:webzoka') ?? []
  if (linked.length !== 1 || linked[0].user_id !== user.id ||
      !isActiveStockUuid(linked[0].identity_data?.sub)) throw new Error('ACTIVE_STOCK_IDENTITY_DENIED')
  const coreSubject = linked[0].identity_data!.sub as string
  if (options.requireLiveOperatorSession) {
    const live = await client.rpc('stock_operator_native_session_live', { p_core_subject: coreSubject })
      .setHeader('Authorization', `Bearer ${token}`)
      .abortSignal(options.signal ?? AbortSignal.timeout(2500))
    if (live.error || live.data !== true) throw new Error('ACTIVE_STOCK_IDENTITY_DENIED')
  }
  const until = Math.min((claims.exp as number) * 1000, started + 30_000)
  if (until <= Date.now() || options.signal?.aborted) throw new Error('ACTIVE_STOCK_IDENTITY_DENIED')
  return Object.freeze({ stockSubject: user.id, stockSessionId: claims.session_id,
    coreSubject, until })
}
