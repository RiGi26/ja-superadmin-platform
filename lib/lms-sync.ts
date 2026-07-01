// ============================================================
// lib/lms-sync.ts — push an LMS tenant's current subscription state to the LMS
// portal's entitlement cache (Core = SoR, portal = reader). Mirror of stock-sync.ts.
//
// Reads authoritative state from Core (tenants + tenant_subscriptions + plan), maps
// Core's tier enum to the LMS vocabulary, and POSTs it (HMAC-signed with
// BILLING_SYNC_SECRET, same scheme as the LMS /api/billing/sync) to LMS_URL.
// Also exports syncTenantPortal() — a dispatcher that routes a change to the right
// portal by tenants.platform. Call fire-and-forget via after(). Never throws.
// Server-only.
// ============================================================
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncStockTenant } from '@/lib/stock-sync'
import { syncPharmacyTenant } from '@/lib/pharmacy-sync'
import { syncTravelTenant } from '@/lib/travel-sync'
import { syncClinicTenant } from '@/lib/clinic-sync'

// Core enum tier → LMS plan_tier. LMS portal uses starter/growth/pro (display
// Starter/Growth/Pro); Core's enterprise → LMS pro, Core's pro → LMS growth.
const CORE_TO_LMS_TIER: Record<string, 'starter' | 'growth' | 'pro'> = {
  starter: 'starter',
  pro: 'growth',
  enterprise: 'pro',
}

// Active-student quota per LMS tier — authoritative product spec (matches the LMS
// portal's lib/entitlements TIER_SEATS and the /pricing matrix). Sent explicitly so
// the portal enforces 100/500/∞ regardless of Core's plan.max_users value.
const LMS_TIER_SEATS: Record<'starter' | 'growth' | 'pro', number | null> = {
  starter: 100,
  growth: 500,
  pro: null,
}

function lmsBaseUrl(): string {
  return process.env.LMS_URL?.trim().replace(/\/+$/, '') || 'https://ja-lms-platform.vercel.app'
}

export async function syncLmsTenant(tenantId: string, event = 'core_sync'): Promise<void> {
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret) {
    console.error('[lms-sync] BILLING_SYNC_SECRET belum di-set')
    return
  }

  try {
    const db = createAdminClient()

    const { data: tenant } = await db
      .from('tenants')
      .select('id, slug, platform, status, plan_tier')
      .eq('id', tenantId)
      .maybeSingle()
    if (!tenant || tenant.platform !== 'lms') return // only LMS tenants

    const { data: sub } = await db
      .from('tenant_subscriptions')
      .select('status, plan_id, current_period_end, trial_ends_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Resolve the authoritative enum tier from the plan when possible.
    let coreTier = tenant.plan_tier as string
    if (sub?.plan_id) {
      const { data: plan } = await db
        .from('subscription_plans')
        .select('tier')
        .eq('id', sub.plan_id)
        .maybeSingle()
      if (plan?.tier) coreTier = plan.tier
    }

    const lmsTier = CORE_TO_LMS_TIER[coreTier] ?? 'starter'
    const maxUsers = LMS_TIER_SEATS[lmsTier]
    const status = sub?.status ?? (tenant.status === 'active' ? 'active' : 'trial')
    const expiresAt = sub?.current_period_end ?? sub?.trial_ends_at ?? null

    const body = JSON.stringify({
      // LMS mirror uses the SAME id as Core (core-provisioning upserts id:t.id) →
      // resolve by tenant_id; slug + linked_tenant_id sent for parity/fallback.
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      linked_tenant_id: tenant.id,
      plan_tier: lmsTier,
      max_active_users: maxUsers,
      status,
      expires_at: expiresAt,
      event,
    })

    const ts = String(Date.now())
    const nonce = crypto.randomBytes(16).toString('hex')
    const sig = crypto.createHmac('sha256', secret).update(`${ts}\n${nonce}\n${body}`).digest('hex')

    const res = await fetch(`${lmsBaseUrl()}/api/billing/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ja-timestamp': ts,
        'x-ja-nonce': nonce,
        'x-ja-signature': sig,
      },
      body,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[lms-sync] sync failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[lms-sync] error:', err instanceof Error ? err.message : err)
  }
}

/**
 * Route a subscription-change sync to the tenant's portal (Core = SoR). No-op for
 * platforms without a portal sync yet (jastip — added later). Each sync also
 * self-filters by platform, so this is defence-in-depth, not the only gate.
 */
export async function syncTenantPortal(tenantId: string, event = 'core_sync'): Promise<void> {
  try {
    const db = createAdminClient()
    const { data: t } = await db
      .from('tenants')
      .select('platform')
      .eq('id', tenantId)
      .maybeSingle()
    if (t?.platform === 'stock') return syncStockTenant(tenantId, event)
    if (t?.platform === 'lms') return syncLmsTenant(tenantId, event)
    if (t?.platform === 'pharmacy') return syncPharmacyTenant(tenantId, event)
    if (t?.platform === 'travel') return syncTravelTenant(tenantId, event)
    if (t?.platform === 'clinic') return syncClinicTenant(tenantId, event)
  } catch (err) {
    console.error('[portal-sync] dispatch error:', err instanceof Error ? err.message : err)
  }
}
