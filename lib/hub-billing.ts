import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { CORE_COMPANY_RUNTIME_ENABLED } from '@/lib/core-company'

export type HubFirstPurchaseTenant = { tenantId: string; platform: string }

const LEGACY_PLATFORMS = ['stock', 'lms', 'clinic', 'pharmacy', 'rental', 'laundry', 'jastip']

// PR #50's live Auth, exact active Owner membership and Owner FK checks.
// This returns only a tenant ID, never a billing capability. Do not cache it:
// the Billing display and the subsequent form submission need separate checks.
async function readHubOwnerBillingContext(input: unknown) {
  if (process.env.NODE_ENV !== 'production' && process.env.HUB_PREVIEW_MODE === 'true') return null
  if (typeof input !== 'string') return null
  const tenantId = input.trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(tenantId)) return null

  try {
    const db = await createClient()
    const { data: claimsData, error: claimsError } = await db.auth.getClaims()
    const userId = claimsData?.claims?.sub
    if (claimsError || typeof userId !== 'string' || !userId) return null

    const { data: authData, error: authError } = await db.auth.getUser()
    if (authError || authData?.user?.id !== userId || authData.user.is_anonymous === true) return null

    const { data: membership, error: membershipError } = await db
      .from('tenant_members')
      .select('tenant_id, user_id, role, is_active')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('role', 'owner')
      .maybeSingle()

    if (membershipError || membership?.user_id !== userId ||
        membership.tenant_id !== tenantId || membership.role !== 'owner' ||
        membership.is_active !== true) return null

    const admin = createAdminClient()
    const [tenant, subscription] = await Promise.all([
      admin.from('tenants').select('id, owner_user_id, platform, status').eq('id', tenantId).maybeSingle(),
      admin.from('tenant_subscriptions').select('id, tenant_id')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    if (tenant.error || tenant.data?.id !== tenantId || tenant.data.owner_user_id !== userId ||
        subscription.error || (subscription.data !== null &&
          (typeof subscription.data?.id !== 'string' || !subscription.data.id ||
           subscription.data.tenant_id !== tenantId))) return null

    return { tenantId, tenant: tenant.data, subscription: subscription.data, user: authData.user }
  } catch {
    return null
  }
}

export async function getHubBillingOwnerTenant(input: unknown): Promise<string | null> {
  const context = await readHubOwnerBillingContext(input)
  // Existing suspended subscribers retain their separate management/recovery flow.
  return context?.subscription ? context.tenantId : null
}

// This proves only the existing legacy Core Owner/tenant relationship. It never
// resolves a Company selector, creates a mapping, or falls back from Registry.
export async function getHubFirstPurchaseOwnerTenant(input: unknown): Promise<HubFirstPurchaseTenant | null> {
  if (CORE_COMPANY_RUNTIME_ENABLED) return null
  const context = await readHubOwnerBillingContext(input)
  if (!context || context.subscription !== null || context.tenant.status !== 'active' ||
      !LEGACY_PLATFORMS.includes(context.tenant.platform) || context.user.is_anonymous !== false ||
      !context.user.email_confirmed_at) return null
  return { tenantId: context.tenantId, platform: context.tenant.platform }
}
