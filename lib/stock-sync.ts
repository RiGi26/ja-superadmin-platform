// ============================================================
// lib/stock-sync.ts — push a Stock tenant's current subscription state to the
// Stock portal's entitlement cache (Core = SoR, portal = reader).
//
// Reads the authoritative state from Core (tenants + tenant_subscriptions + plan),
// maps Core's tier enum to the Stock vocabulary, and POSTs it (HMAC-signed with
// BILLING_SYNC_SECRET, same scheme as stock /api/billing/sync §8) to STOCK_URL.
// Call fire-and-forget via after() on subscription change. Never throws.
// Server-only.
// ============================================================
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Core enum tier → Stock plan_tier. Stock REJECTS 'enterprise' (only
// starter/growth/pro), so enterprise → pro and pro → growth.
const CORE_TO_STOCK_TIER: Record<string, 'starter' | 'growth' | 'pro'> = {
  starter: 'starter',
  pro: 'growth',
  enterprise: 'pro',
}

function stockBaseUrl(): string {
  return process.env.STOCK_URL?.trim().replace(/\/+$/, '') || 'https://stock.webzoka.com'
}

export async function syncStockTenant(tenantId: string, event = 'core_sync'): Promise<void> {
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret) {
    console.error('[stock-sync] BILLING_SYNC_SECRET belum di-set')
    return
  }

  try {
    const db = createAdminClient()

    const { data: tenant } = await db
      .from('tenants')
      .select('id, slug, platform, status, plan_tier')
      .eq('id', tenantId)
      .maybeSingle()
    if (!tenant || tenant.platform !== 'stock') return // only stock tenants

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
        .eq('platform', 'stock')
        .eq('tier', coreTier)
        .maybeSingle()
      maxUsers = plan?.max_users ?? null
    }

    const stockTier = CORE_TO_STOCK_TIER[coreTier] ?? 'starter'
    const status = sub?.status ?? (tenant.status === 'active' ? 'active' : 'trial')
    const expiresAt = sub?.current_period_end ?? sub?.trial_ends_at ?? null

    const body = JSON.stringify({
      tenant_slug: tenant.slug,
      linked_tenant_id: tenant.id,
      plan_tier: stockTier,
      max_active_users: maxUsers,
      status,
      expires_at: expiresAt,
      event,
    })

    const ts = String(Date.now())
    const nonce = crypto.randomBytes(16).toString('hex')
    const sig = crypto.createHmac('sha256', secret).update(`${ts}\n${nonce}\n${body}`).digest('hex')

    const res = await fetch(`${stockBaseUrl()}/api/billing/sync`, {
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
      console.error('[stock-sync] sync failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[stock-sync] error:', err instanceof Error ? err.message : err)
  }
}
