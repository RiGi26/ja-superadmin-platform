import { createAdminClient } from '@/lib/supabase/admin'
import { CreateTenantForm } from '@/components/dashboard/CreateTenantForm'
import { readSaleablePlans } from '@/lib/plan-catalog-server'
import type { SubscriptionPlan } from '@/types/tenant'

export default async function NewTenantPage() {
  const db = createAdminClient()
  const plans = (await readSaleablePlans()).filter((plan) => plan.platform !== 'stock' && plan.platform !== 'jastip')
    .map((plan) => ({ ...plan, platform: plan.platform as SubscriptionPlan['platform'], tier: plan.tier as SubscriptionPlan['tier'],
      tier_display_name: plan.tier_display_name ?? plan.name ?? plan.tier }))

  const { data: linkableTenants } = await db
    .from('tenants')
    .select('id, name, platform, slug')
    .in('platform', ['clinic', 'pharmacy'])
    .eq('status', 'active')
    .order('name')

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Buat Tenant Baru</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tenant baru akan langsung mendapat trial 14 hari dan welcome email.
        </p>
      </div>
      <CreateTenantForm plans={plans ?? []} linkableTenants={linkableTenants ?? []} />
    </div>
  )
}
