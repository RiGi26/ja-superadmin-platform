import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signBillingToken } from '@/lib/billing-link'

export type HubPlan = {
  id: string
  platform: string
  tier: string
  name: string
  priceMonthly: number
  priceYearly: number
  features: string[]
}

export type HubInvoice = {
  id: string
  orderId: string | null
  amount: number
  status: string
  period: string
  paidAt: string | null
  createdAt: string
}

export type HubCustomerSnapshot = {
  isGuest: false
  isPreview: boolean
  user: { id: string; email: string; role: string }
  tenant: {
    id: string
    name: string
    slug: string
    platform: string
    status: string
    planTier: string | null
    trialEndsAt: string | null
  }
  subscription: {
    id: string
    status: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    trialEndsAt: string | null
    plan: HubPlan | null
  } | null
  invoices: HubInvoice[]
  invoiceAccessReady: boolean
  plans: HubPlan[]
  manageSubscriptionUrl: string | null
}

type PlanRow = {
  id: string
  platform: string
  tier: string
  tier_display_name: string | null
  name?: string | null
  price_monthly: number | string
  price_yearly: number | string
  features: unknown
}

function normalizeFeatures(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').slice(0, 5)
  }
  return []
}

function normalizePlan(row: PlanRow): HubPlan {
  return {
    id: row.id,
    platform: row.platform,
    tier: row.tier,
    name: row.tier_display_name || row.name || row.tier,
    priceMonthly: Number(row.price_monthly),
    priceYearly: Number(row.price_yearly),
    features: normalizeFeatures(row.features),
  }
}

function previewEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.HUB_PREVIEW_MODE === 'true'
}

async function readActivePlans() {
  const db = await createClient()
  const { data, error } = await db
    .from('subscription_plans')
    .select('id, platform, tier, tier_display_name, price_monthly, price_yearly, features')
    .eq('is_active', true)
    .order('platform')
    .order('price_monthly')

  if (error) return []
  return ((data ?? []) as PlanRow[]).map(normalizePlan)
}

async function previewSnapshot(): Promise<HubCustomerSnapshot> {
  const plans = await readActivePlans()
  const starter = plans.find((plan) => plan.platform === 'stock' && plan.tier === 'starter') ?? null

  return {
    isGuest: false,
    isPreview: true,
    user: { id: 'preview-user', email: 'demo@webzoka.com', role: 'owner' },
    tenant: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Webzoka Demo Studio',
      slug: 'webzoka-demo',
      platform: 'stock',
      status: 'active',
      planTier: starter?.tier ?? 'starter',
      trialEndsAt: null,
    },
    subscription: starter
      ? {
          id: 'preview-subscription',
          status: 'active',
          currentPeriodStart: '2026-08-01T00:00:00.000Z',
          currentPeriodEnd: '2026-09-01T00:00:00.000Z',
          trialEndsAt: null,
          plan: starter,
        }
      : null,
    invoices: [],
    invoiceAccessReady: true,
    plans,
    manageSubscriptionUrl: null,
  }
}

export const getHubSnapshot = cache(async (): Promise<HubCustomerSnapshot> => {
  if (previewEnabled()) return previewSnapshot()

  const db = await createClient()
  const { data: claimsData } = await db.auth.getClaims()
  const claims = claimsData?.claims

  if (!claims?.sub) redirect('/hub/login')

  const userId = claims.sub
  const claimTenantId = typeof claims.tenant_id === 'string' ? claims.tenant_id : null

  const membershipResult = claimTenantId
    ? null
    : await db
        .from('tenant_members')
        .select('tenant_id, role')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

  const tenantId = claimTenantId ?? membershipResult?.data?.tenant_id ?? null
  if (!tenantId) redirect('/unauthorized')

  const [tenantResult, subscriptionResult, invoicesResult, plans] = await Promise.all([
    db
      .from('tenants')
      .select('id, name, slug, platform, status, plan_tier, trial_ends_at')
      .eq('id', tenantId)
      .maybeSingle(),
    db
      .from('tenant_subscriptions')
      .select(
        'id, status, current_period_start, current_period_end, trial_ends_at, plan:subscription_plans(id, platform, tier, tier_display_name, price_monthly, price_yearly, features)',
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('subscription_invoices')
      .select('id, midtrans_order_id, amount, status, period, paid_at, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(12),
    readActivePlans(),
  ])

  if (tenantResult.error || !tenantResult.data) redirect('/unauthorized')

  const tenant = tenantResult.data
  const rawSubscription = subscriptionResult.data as
    | {
        id: string
        status: string
        current_period_start: string | null
        current_period_end: string | null
        trial_ends_at: string | null
        plan: PlanRow | PlanRow[] | null
      }
    | null

  const rawPlan = Array.isArray(rawSubscription?.plan)
    ? rawSubscription.plan[0] ?? null
    : rawSubscription?.plan ?? null

  let manageSubscriptionUrl: string | null = null
  try {
    manageSubscriptionUrl = `/billing/langganan?token=${encodeURIComponent(signBillingToken(tenantId))}`
  } catch {
    manageSubscriptionUrl = null
  }

  return {
    isGuest: false,
    isPreview: false,
    user: {
      id: userId,
      email: typeof claims.email === 'string' ? claims.email : '',
      role:
        typeof claims.user_role === 'string'
          ? claims.user_role
          : membershipResult?.data?.role ?? 'member',
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      platform: tenant.platform ?? 'unknown',
      status: tenant.status,
      planTier: tenant.plan_tier ?? null,
      trialEndsAt: tenant.trial_ends_at ?? null,
    },
    subscription: rawSubscription
      ? {
          id: rawSubscription.id,
          status: rawSubscription.status,
          currentPeriodStart: rawSubscription.current_period_start,
          currentPeriodEnd: rawSubscription.current_period_end,
          trialEndsAt: rawSubscription.trial_ends_at,
          plan: rawPlan ? normalizePlan(rawPlan) : null,
        }
      : null,
    invoices: ((invoicesResult.data ?? []) as Array<{
      id: string
      midtrans_order_id: string | null
      amount: number | string
      status: string
      period: string
      paid_at: string | null
      created_at: string
    }>).map((invoice) => ({
      id: invoice.id,
      orderId: invoice.midtrans_order_id,
      amount: Number(invoice.amount),
      status: invoice.status,
      period: invoice.period,
      paidAt: invoice.paid_at,
      createdAt: invoice.created_at,
    })),
    invoiceAccessReady: !invoicesResult.error,
    plans,
    manageSubscriptionUrl,
  }
})
