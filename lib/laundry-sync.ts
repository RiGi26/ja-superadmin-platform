// ============================================================
// lib/laundry-sync.ts — push a Laundry tenant's current subscription state to the
// Laundry portal's entitlement cache (Core = SoR, portal = reader). Mirror of
// stock-sync.ts (the Laundry portal is a fork of Stock and shares its vocabulary).
//
// Reads the authoritative state from Core (tenants + tenant_subscriptions + plan),
// maps Core's tier enum to the Laundry vocabulary, and POSTs it (HMAC-signed with
// BILLING_SYNC_SECRET, same scheme as laundry /api/billing/sync) to LAUNDRY_URL.
// Call fire-and-forget via after() on subscription change. Never throws.
// Server-only.
// ============================================================
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Core enum tier → Laundry plan_tier. Laundry portal accepts only
// starter/growth/pro (display Starter/Growth/Pro), so Core's enterprise → pro and
// Core's pro → growth (same mapping as Stock).
const CORE_TO_LAUNDRY_TIER: Record<string, 'starter' | 'growth' | 'pro'> = {
  starter: 'starter',
  pro: 'growth',
  enterprise: 'pro',
}

function laundryBaseUrl(): string {
  return process.env.LAUNDRY_URL?.trim().replace(/\/+$/, '') || 'https://laundry.webzoka.com'
}

export async function syncLaundryTenant(tenantId: string, event = 'core_sync'): Promise<void> {
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret) {
    console.error('[laundry-sync] BILLING_SYNC_SECRET belum di-set')
    return
  }

  try {
    const db = createAdminClient()

    const { data: tenant } = await db
      .from('tenants')
      .select('id, slug, platform, status, plan_tier')
      .eq('id', tenantId)
      .maybeSingle()
    if (!tenant || tenant.platform !== 'laundry') return // only laundry tenants

    const { data: sub } = await db
      .from('tenant_subscriptions')
      .select('status, plan_id, current_period_end, trial_ends_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Resolve the authoritative enum tier + seat limit from the plan when possible.
    let coreTier = tenant.plan_tier as string
    let maxUsers: number | null = null
    if (sub?.plan_id) {
      const { data: plan } = await db
        .from('subscription_plans')
        .select('tier, max_users')
        .eq('id', sub.plan_id)
        .maybeSingle()
      if (plan?.tier) coreTier = plan.tier
      maxUsers = plan?.max_users ?? null
    } else {
      const { data: plan } = await db
        .from('subscription_plans')
        .select('max_users')
        .eq('platform', 'laundry')
        .eq('tier', coreTier)
        .maybeSingle()
      maxUsers = plan?.max_users ?? null
    }

    const laundryTier = CORE_TO_LAUNDRY_TIER[coreTier] ?? 'starter'
    const status = sub?.status ?? (tenant.status === 'active' ? 'active' : 'trial')
    const expiresAt = sub?.current_period_end ?? sub?.trial_ends_at ?? null

    const body = JSON.stringify({
      // Laundry portal resolves the local tenant by slug (new-id model, mirror of
      // Stock); linked_tenant_id sent for reference.
      tenant_slug: tenant.slug,
      linked_tenant_id: tenant.id,
      plan_tier: laundryTier,
      max_active_users: maxUsers,
      status,
      expires_at: expiresAt,
      event,
    })

    const ts = String(Date.now())
    const nonce = crypto.randomBytes(16).toString('hex')
    const sig = crypto.createHmac('sha256', secret).update(`${ts}\n${nonce}\n${body}`).digest('hex')

    const res = await fetch(`${laundryBaseUrl()}/api/billing/sync`, {
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
      console.error('[laundry-sync] sync failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[laundry-sync] error:', err instanceof Error ? err.message : err)
  }
}
