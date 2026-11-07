import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { purchaseError, saleablePlans, type CatalogPlan, type BillingPeriod } from '@/lib/plan-catalog'
import { sandboxPurchaseAllowed } from '@/lib/billing-sandbox-uat'

export type CatalogPlanRow = CatalogPlan & {
  name: string
  tier_display_name: string | null
  price_monthly: number
  price_yearly: number | null
  max_users: number | null
  features: unknown
}

// Reading * tolerates an unapplied additive schema: optional offer fields are
// absent on the legacy schema. Public callers still serialize an explicit list.
export async function readCatalogPlans(platform?: string): Promise<CatalogPlanRow[] | null> {
  let query = createAdminClient().from('subscription_plans').select('*').order('price_monthly')
  if (platform) query = query.eq('platform', platform)
  const { data, error } = await query
  return error || !Array.isArray(data) ? null : data as CatalogPlanRow[]
}

export async function readSaleablePlans(platform?: string): Promise<CatalogPlanRow[]> {
  const rows = await readCatalogPlans(platform)
  return rows ? saleablePlans(rows) : []
}

export async function verifyPlanPurchase(plan: CatalogPlan, tenantId: string, currentPlanId: string | null, period: BillingPeriod): Promise<string | null> {
  const [rows, tenantResult] = await Promise.all([
    readCatalogPlans(plan.platform),
    createAdminClient().from('tenants').select('platform').eq('id', tenantId).maybeSingle(),
  ])
  if (!rows || tenantResult.error || !tenantResult.data) return 'Katalog paket belum dapat diverifikasi.'
  if (tenantResult.data.platform !== plan.platform) return 'Paket tidak tersedia untuk akun ini.'
  if (currentPlanId && !rows.some((item) => item.id === currentPlanId)) return 'Kontrak berjalan belum dapat diverifikasi.'
  const fresh = rows.find((item) => item.id === plan.id)
  if (!fresh || Number(fresh.price_monthly) !== Number(plan.price_monthly) || fresh.price_yearly !== plan.price_yearly) return 'Harga paket berubah. Muat ulang halaman sebelum melanjutkan.'
  if (await sandboxPurchaseAllowed(fresh, tenantId)) {
    const testRows = rows.map(row => row.platform === 'stock' && row.offer_version === fresh.offer_version
      ? { ...row, is_active: true, is_for_sale: true } : row)
    return purchaseError({ ...fresh, is_active: true, is_for_sale: true }, testRows, currentPlanId, period, true)
  }
  return purchaseError(fresh, rows, currentPlanId, period)
}
