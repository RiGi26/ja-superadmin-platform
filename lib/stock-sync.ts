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
import { approvedOffer, isVersionedPlan } from '@/lib/plan-catalog'
import { deliverStockPaidActivation } from '@/lib/stock-paid-activation'
import { sandboxSyncReplayProbeAllowed } from '@/lib/billing-sandbox-uat'

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
  // Payment delivery has its own persisted retry state and cannot depend on the
  // availability of the legacy entitlement mirror request below.
  await deliverStockPaidActivation(tenantId)
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret) {
    console.error('[stock-sync] BILLING_SYNC_SECRET belum di-set')
    return
  }

  try {
    const db = createAdminClient()

    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .select('id, slug, platform, status, plan_tier')
      .eq('id', tenantId)
      .maybeSingle()
    if (tenantError || !tenant || tenant.id !== tenantId || tenant.platform !== 'stock') return

    const { data: sub, error: subscriptionError } = await db
      .from('tenant_subscriptions')
      .select('status, plan_id, current_period_end, trial_ends_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (subscriptionError) return

    // Resolve the authoritative enum tier + seat limit from the plan when possible.
    let coreTier = tenant.plan_tier as string
    let maxUsers: number | null = null
    let offer: ReturnType<typeof approvedOffer> = null
    if (sub?.plan_id) {
      const { data: plan, error: planError } = await db
        .from('subscription_plans')
        .select('*')
        .eq('id', sub.plan_id)
        .maybeSingle()
      if (planError || !plan || plan.id !== sub.plan_id || plan.platform !== 'stock') return
      if (plan?.tier) coreTier = plan.tier
      maxUsers = plan?.max_users ?? null
      if (plan && isVersionedPlan(plan)) {
        offer = approvedOffer(plan)
        if (!offer) return
        maxUsers = offer.contract.max_active_users
      }
    } else {
      const { data: candidates, error: planError } = await db
        .from('subscription_plans')
        .select('*')
        .eq('platform', 'stock')
        .eq('tier', coreTier)
        .eq('is_active', true)
      // No plan ID means a legacy contract. Never infer a version from row order.
      const legacyPlans = (candidates ?? []).filter((plan) => plan.platform === 'stock' && plan.tier === coreTier && plan.is_active === true && !isVersionedPlan(plan))
      if (planError || legacyPlans.length !== 1) return
      maxUsers = legacyPlans[0].max_users ?? null
    }

    const stockTier = offer?.contract.portal_tier ?? CORE_TO_STOCK_TIER[coreTier] ?? 'starter'
    const status = sub?.status ?? (tenant.status === 'active' ? 'active' : 'trial')
    const expiresAt = sub?.current_period_end ?? sub?.trial_ends_at ?? null

    const body = JSON.stringify({
      tenant_slug: tenant.slug,
      linked_tenant_id: tenant.id,
      plan_tier: stockTier,
      max_active_users: maxUsers,
      ...(offer ? { offer_version: 'basic-pro-2026-10-v1', plan_id: offer.id, public_tier: offer.publicTier,
        plan_display_name: offer.name, entitlements: offer.contract.features } : {}),
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
    if (event === 'payment_reconciled' && await sandboxSyncReplayProbeAllowed(tenantId)) {
      const replay = await fetch(`${stockBaseUrl()}/api/billing/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ja-timestamp': ts, 'x-ja-nonce': nonce, 'x-ja-signature': sig },
        body, signal: AbortSignal.timeout(8000),
      })
      // Status codes only: signed envelopes and shared credentials stay on the servers.
      console.info(`[billing-uat-replay] first=${res.status} replay=${replay.status}`)
      await db.from('subscription_events').insert({
        tenant_id: tenantId, event_type: 'billing_uat_sync_replay_check',
        payload: { first_status: res.status, replay_status: replay.status },
      })
    }
  } catch (err) {
    console.error('[stock-sync] error:', err instanceof Error ? err.message : err)
  }
}
