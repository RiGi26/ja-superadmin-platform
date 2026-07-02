// ============================================================
// lib/rental-sync.ts — push a rental tenant's current subscription state to the
// rental portal's entitlement cache (Core = SoR, portal = reader). Mirror of
// pharmacy-sync.ts / lms-sync.ts / stock-sync.ts.
//
// Reads authoritative state from Core (tenants + tenant_subscriptions + plan), maps
// Core's tier enum to the rental vocabulary, and POSTs it (HMAC-signed with
// BILLING_SYNC_SECRET, same scheme as the rental /api/billing/sync) to RENTAL_URL.
// Call fire-and-forget via after(). Never throws. Server-only.
//
// NOTE: the rental portal runs its own auth Core + operational DB; a rental tenant
// syncs when it also exists in THIS superadmin Core (platform='rental') with the
// SAME id the rental DB uses (SAME-ID model, like Pharmacy/LMS).
// ============================================================
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Core enum tier → rental plan_tier. Rental portal uses starter/growth/pro;
// Core's enterprise → rental pro, Core's pro → rental growth.
const CORE_TO_RENTAL_TIER: Record<string, 'starter' | 'growth' | 'pro'> = {
  starter: 'starter',
  pro: 'growth',
  enterprise: 'pro',
}

// Fleet/unit quota per rental tier — authoritative product spec (matches the
// rental portal's lib/entitlements TIER_SEATS and the /pricing matrix). Sent
// explicitly so the portal enforces 5/25/∞ regardless of Core's plan.max_users.
const RENTAL_TIER_SEATS: Record<'starter' | 'growth' | 'pro', number | null> = {
  starter: 5,
  growth: 25,
  pro: null,
}

function rentalBaseUrl(): string {
  return process.env.RENTAL_URL?.trim().replace(/\/+$/, '') || 'https://rent.webzoka.com'
}

export async function syncRentalTenant(tenantId: string, event = 'core_sync'): Promise<void> {
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret) {
    console.error('[rental-sync] BILLING_SYNC_SECRET belum di-set')
    return
  }

  try {
    const db = createAdminClient()

    const { data: tenant } = await db
      .from('tenants')
      .select('id, slug, platform, status, plan_tier')
      .eq('id', tenantId)
      .maybeSingle()
    if (!tenant || tenant.platform !== 'rental') return // only rental tenants

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

    const rentalTier = CORE_TO_RENTAL_TIER[coreTier] ?? 'starter'
    const maxUnits = RENTAL_TIER_SEATS[rentalTier]
    const status = sub?.status ?? (tenant.status === 'active' ? 'active' : 'trial')
    const expiresAt = sub?.current_period_end ?? sub?.trial_ends_at ?? null

    const body = JSON.stringify({
      // Rental mirror uses the SAME id as Core → resolve by tenant_id; slug +
      // linked_tenant_id sent for parity/fallback.
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      linked_tenant_id: tenant.id,
      plan_tier: rentalTier,
      max_active_users: maxUnits,
      status,
      expires_at: expiresAt,
      event,
    })

    const ts = String(Date.now())
    const nonce = crypto.randomBytes(16).toString('hex')
    const sig = crypto.createHmac('sha256', secret).update(`${ts}\n${nonce}\n${body}`).digest('hex')

    const res = await fetch(`${rentalBaseUrl()}/api/billing/sync`, {
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
      console.error('[rental-sync] sync failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[rental-sync] error:', err instanceof Error ? err.message : err)
  }
}
