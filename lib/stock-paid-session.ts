import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { STOCK_PAID_BILLING_RUNTIME_ENABLED } from '@/lib/stock-purchase-policy'

type Identity = { coreSubject: string; stockSubject: string; stockSession: string; until: number }
type Enrollment = { companyId: string | null; instanceId: string | null; coreSession: string; tokenExpires: number }

/** Classify retained paid history before choosing an authorization engine.
 * Unavailable or denied paid authority never falls through to pilot/legacy.
 * Callers must independently verify both native identities before enrollment.
 */
export async function paidStockSessionAuthority(identity: Identity, enrollment?: Enrollment): Promise<
  { kind: 'legacy' } | { kind: 'paid'; data: unknown } | { kind: 'denied' }
> {
  if (!STOCK_PAID_BILLING_RUNTIME_ENABLED) return { kind: 'legacy' }
  try {
    const db = createAdminClient()
    const classified = await db.rpc('stock_billing_active_is_managed', {
      p_core_subject: identity.coreSubject, p_stock_subject: identity.stockSubject,
    }).abortSignal(AbortSignal.timeout(2500))
    if (classified.error || typeof classified.data !== 'boolean' || identity.until <= Date.now()) return { kind: 'denied' }
    if (!classified.data) return { kind: 'legacy' }
    const args = { p_core_subject: identity.coreSubject, p_stock_subject: identity.stockSubject,
      p_stock_session: identity.stockSession, p_verified_until: new Date(identity.until).toISOString() }
    const result = enrollment
      ? await db.rpc('stock_billing_active_enroll', { ...args,
        p_company: enrollment.companyId, p_instance: enrollment.instanceId,
        p_core_session: enrollment.coreSession, p_core_token_expires: new Date(enrollment.tokenExpires).toISOString(),
      }).abortSignal(AbortSignal.timeout(2500))
      : await db.rpc('stock_billing_active_authorize', args).abortSignal(AbortSignal.timeout(2500))
    if (result.error || !result.data || identity.until <= Date.now()) return { kind: 'denied' }
    return { kind: 'paid', data: result.data }
  } catch { return { kind: 'denied' } }
}
