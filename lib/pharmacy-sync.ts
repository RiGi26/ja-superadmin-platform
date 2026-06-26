// ============================================================
// lib/pharmacy-sync.ts — push a pharmacy tenant's current subscription state to
// the pharmacy portal's entitlement cache (Core = SoR, portal = reader). Mirror
// of lms-sync.ts / stock-sync.ts.
//
// Reads authoritative state from Core (tenants + tenant_subscriptions + plan), maps
// Core's tier enum to the pharmacy vocabulary, and POSTs it (HMAC-signed with
// BILLING_SYNC_SECRET, same scheme as the pharmacy /api/billing/sync) to
// PHARMACY_URL. Call fire-and-forget via after(). Never throws. Server-only.
// ============================================================
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Core enum tier → pharmacy plan_tier. Pharmacy portal uses starter/growth/pro;
// Core's enterprise → pharmacy pro, Core's pro → pharmacy growth.
const CORE_TO_PHARMACY_TIER: Record<string, 'starter' | 'growth' | 'pro'> = {
  starter: 'starter',
  pro: 'growth',
  enterprise: 'pro',
}

// Staff/kasir quota per pharmacy tier — authoritative product spec (matches the
// pharmacy portal's lib/entitlements TIER_SEATS and the /pricing matrix). Sent
// explicitly so the portal enforces 1/3/∞ regardless of Core's plan.max_users.
const PHARMACY_TIER_SEATS: Record<'starter' | 'growth' | 'pro', number | null> = {
  starter: 1,
  growth: 3,
  pro: null,
}

function pharmacyBaseUrl(): string {
  return process.env.PHARMACY_URL?.trim().replace(/\/+$/, '') || 'https://ja-pharmacy-platform.vercel.app'
}

export async function syncPharmacyTenant(tenantId: string, event = 'core_sync'): Promise<void> {
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret) {
    console.error('[pharmacy-sync] BILLING_SYNC_SECRET belum di-set')
    return
  }

  try {
    const db = createAdminClient()

    const { data: tenant } = await db
      .from('tenants')
      .select('id, slug, platform, status, plan_tier')
      .eq('id', tenantId)
      .maybeSingle()
    if (!tenant || tenant.platform !== 'pharmacy') return // only pharmacy tenants

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

    const pharmacyTier = CORE_TO_PHARMACY_TIER[coreTier] ?? 'starter'
    const maxUsers = PHARMACY_TIER_SEATS[pharmacyTier]
    const status = sub?.status ?? (tenant.status === 'active' ? 'active' : 'trial')
    const expiresAt = sub?.current_period_end ?? sub?.trial_ends_at ?? null

    const body = JSON.stringify({
      // Pharmacy mirror uses the SAME id as Core (core-provisioning upserts id:t.id)
      // → resolve by tenant_id; slug + linked_tenant_id sent for parity/fallback.
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      linked_tenant_id: tenant.id,
      plan_tier: pharmacyTier,
      max_active_users: maxUsers,
      status,
      expires_at: expiresAt,
      event,
    })

    const ts = String(Date.now())
    const nonce = crypto.randomBytes(16).toString('hex')
    const sig = crypto.createHmac('sha256', secret).update(`${ts}\n${nonce}\n${body}`).digest('hex')

    const res = await fetch(`${pharmacyBaseUrl()}/api/billing/sync`, {
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
      console.error('[pharmacy-sync] sync failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[pharmacy-sync] error:', err instanceof Error ? err.message : err)
  }
}
