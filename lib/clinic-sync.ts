// ============================================================
// lib/clinic-sync.ts — push a Clinic tenant's current subscription state to the
// Clinic portal's entitlement cache (Core = SoR, portal = reader). Mirror of
// stock-sync.ts / lms-sync.ts.
//
// Reads the authoritative state from Core (tenants + tenant_subscriptions + plan),
// maps Core's tier enum to the Clinic vocabulary (starter/growth/pro), and POSTs it
// (HMAC-signed with BILLING_SYNC_SECRET, same scheme as the clinic /api/billing/sync)
// to CLINIC_URL. Call fire-and-forget via after() on subscription change. Never
// throws. Server-only.
// ============================================================
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Core enum tier → Clinic plan_tier. Clinic portal uses starter/growth/pro (display
// Starter/Growth/Pro); Core's enterprise → clinic pro, Core's pro → clinic growth.
const CORE_TO_CLINIC_TIER: Record<string, 'starter' | 'growth' | 'pro'> = {
  starter: 'starter',
  pro: 'growth',
  enterprise: 'pro',
}

// Active-doctor seat limit per Clinic tier — authoritative product spec (matches the
// clinic portal's lib/entitlements TIER_SEATS and the /pricing matrix). Sent
// explicitly so the portal enforces 1/3/∞ regardless of Core's plan.max_users.
const CLINIC_TIER_SEATS: Record<'starter' | 'growth' | 'pro', number | null> = {
  starter: 1,
  growth: 3,
  pro: null,
}

function clinicBaseUrl(): string {
  return process.env.CLINIC_URL?.trim().replace(/\/+$/, '') || 'https://clinic.webzoka.com'
}

export async function syncClinicTenant(tenantId: string, event = 'core_sync'): Promise<void> {
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret) {
    console.error('[clinic-sync] BILLING_SYNC_SECRET belum di-set')
    return
  }

  try {
    const db = createAdminClient()

    const { data: tenant } = await db
      .from('tenants')
      .select('id, slug, platform, status, plan_tier')
      .eq('id', tenantId)
      .maybeSingle()
    if (!tenant || tenant.platform !== 'clinic') return // only clinic tenants

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

    const clinicTier = CORE_TO_CLINIC_TIER[coreTier] ?? 'starter'
    const maxUsers = CLINIC_TIER_SEATS[clinicTier]
    const status = sub?.status ?? (tenant.status === 'active' ? 'active' : 'trial')
    const expiresAt = sub?.current_period_end ?? sub?.trial_ends_at ?? null

    const body = JSON.stringify({
      // Clinic resolves the local clinic primarily by linked_tenant_id (= Core id,
      // stored at signup); slug is sent as a fallback.
      linked_tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      plan_tier: clinicTier,
      max_active_users: maxUsers,
      status,
      expires_at: expiresAt,
      event,
    })

    const ts = String(Date.now())
    const nonce = crypto.randomBytes(16).toString('hex')
    const sig = crypto.createHmac('sha256', secret).update(`${ts}\n${nonce}\n${body}`).digest('hex')

    const res = await fetch(`${clinicBaseUrl()}/api/billing/sync`, {
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
      console.error('[clinic-sync] sync failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[clinic-sync] error:', err instanceof Error ? err.message : err)
  }
}
