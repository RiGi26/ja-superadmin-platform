/** Approved 26 October 2026. New sales stay disabled until an authorized release. */
export const BASIC_PRO_VERSION = 'basic-pro-2026-10-v1'
// Local source integration is reviewed separately from release authority.
// Keep this source fuse closed until a coordinated release is authorized.
export const BASIC_PRO_RELEASE_AUTHORIZED = false
// Stock can be released independently without changing LMS's legacy catalog.
export const STOCK_BASIC_PRO_RELEASE_AUTHORIZED = false
export type OfferPlatform = 'lms' | 'stock'
export type PublicTier = 'basic' | 'pro'
export type BillingPeriod = 'monthly' | 'yearly'

export type OfferContract = {
  portal_tier: 'starter' | 'growth'
  features: readonly string[]
  max_active_users: number
  storage_bytes: number | null
}

export const APPROVED_OFFERS = [
  { id: '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a1001', platform: 'lms', publicTier: 'basic', tier: 'starter', name: 'Basic', price: 119000,
    contract: { portal_tier: 'starter', features: ['materials', 'quiz', 'flashcard', 'students'], max_active_users: 100, storage_bytes: 200 * 1024 * 1024 },
    features: ['100 siswa aktif', '200 MiB lampiran materi', 'Materi, kuis, dan flashcard', 'Administrasi dan absensi siswa'] },
  { id: '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a1002', platform: 'lms', publicTier: 'pro', tier: 'pro', name: 'Pro', price: 299000,
    contract: { portal_tier: 'growth', features: ['materials', 'quiz', 'flashcard', 'students', 'reports', 'schedule', 'finance', 'review_book', 'leaderboard', 'live_quiz'], max_active_users: 500, storage_bytes: 1024 * 1024 * 1024 },
    features: ['500 siswa aktif', '1 GiB lampiran materi', 'Semua fitur Basic', 'Laporan, jadwal kelas, dan keuangan', 'Buku salah, ranking, dan kuis langsung'] },
  { id: '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001', platform: 'stock', publicTier: 'basic', tier: 'starter', name: 'Basic', price: 149000,
    contract: { portal_tier: 'starter', features: ['orders', 'catalog', 'stock'], max_active_users: 1, storage_bytes: null },
    features: ['1 akun operator aktif', 'Pesanan dan katalog', 'Invoice dan label pengiriman', 'Stok, lot, opname, dan pemantauan kedaluwarsa'] },
  { id: '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002', platform: 'stock', publicTier: 'pro', tier: 'pro', name: 'Pro', price: 359000,
    contract: { portal_tier: 'growth', features: ['orders', 'catalog', 'stock', 'suppliers', 'finance'], max_active_users: 3, storage_bytes: null },
    features: ['3 akun operator aktif', 'Semua fitur Basic', 'Pemasok dan purchase order', 'Laporan keuangan dan arus kas'] },
] as const

export type CatalogPlan = {
  id: string
  platform: string
  tier: string
  is_active?: boolean
  price_monthly?: number | string | null
  price_yearly?: number | string | null
  tier_display_name?: string | null
  offer_version?: string | null
  public_tier?: string | null
  is_for_sale?: boolean
  allowed_periods?: unknown
  entitlement_contract?: unknown
}

export function basicProEnabled(value = process.env.BASIC_PRO_PRICING_ENABLED, platform?: string): boolean {
  const authorized = platform === 'stock' ? STOCK_BASIC_PRO_RELEASE_AUTHORIZED : BASIC_PRO_RELEASE_AUTHORIZED
  const configured = platform === 'stock' ? process.env.STOCK_BASIC_PRO_PRICING_ENABLED : value
  return authorized && configured === 'true'
}

export function isVersionedPlan(plan: CatalogPlan): boolean {
  return typeof plan.offer_version === 'string' && plan.offer_version.length > 0
}

export function approvedOffer(plan: CatalogPlan) {
  if (plan.offer_version !== BASIC_PRO_VERSION) return null
  const offer = APPROVED_OFFERS.find((item) => item.id === plan.id && item.platform === plan.platform && item.tier === plan.tier && item.publicTier === plan.public_tier)
  if (!offer || Number(plan.price_monthly) !== offer.price || plan.price_yearly !== null ||
      plan.tier_display_name !== offer.name || !Array.isArray(plan.allowed_periods) ||
      plan.allowed_periods.length !== 1 || plan.allowed_periods[0] !== 'monthly') return null
  const contract = plan.entitlement_contract as OfferContract | null
  if (!contract || contract.portal_tier !== offer.contract.portal_tier ||
      contract.max_active_users !== offer.contract.max_active_users || contract.storage_bytes !== offer.contract.storage_bytes ||
      !Array.isArray(contract.features) || contract.features.length !== offer.contract.features.length ||
      !offer.contract.features.every((key) => contract.features.includes(key))) return null
  return offer
}

/** No inferred labels, old-price fallback, incomplete two-tier release, or mixed versions. */
export function saleablePlans<T extends CatalogPlan>(plans: readonly T[], enabled?: boolean): T[] {
  const result: T[] = []
  for (const platform of new Set(plans.map((plan) => plan.platform))) {
    const active = plans.filter((plan) => plan.platform === platform && plan.is_active === true)
    const targeted = platform === 'lms' || platform === 'stock'
    const hasNew = active.some(isVersionedPlan)
    const platformEnabled = enabled ?? basicProEnabled(undefined, platform)
    if (targeted && (platformEnabled || hasNew)) {
      if (!platformEnabled) continue // Rollback stops new sales; existing plan-ID renewals survive.
      const offers = active.filter((plan) => plan.is_for_sale === true && approvedOffer(plan))
      if (offers.length === 2 && new Set(offers.map((plan) => plan.public_tier)).size === 2) result.push(...offers)
    } else {
      result.push(...active.filter((plan) => !isVersionedPlan(plan) && plan.is_for_sale !== false))
    }
  }
  return result
}

export function planPeriods(plan: CatalogPlan): BillingPeriod[] {
  if (isVersionedPlan(plan)) return approvedOffer(plan) ? ['monthly'] : []
  return ['monthly', ...(Number(plan.price_yearly) > 0 ? ['yearly' as const] : [])]
}

export function checkoutPlans<T extends CatalogPlan>(plans: readonly T[], currentPlanId: string | null, enabled?: boolean): T[] {
  const offers = saleablePlans(plans, enabled)
  if (!currentPlanId) return offers
  const current = plans.find((plan) => plan.id === currentPlanId)
  if (!current) return []
  const sameVersion = offers.filter((plan) => plan.platform === current.platform && (plan.offer_version ?? null) === (current.offer_version ?? null))
  return sameVersion.some((plan) => plan.id === current.id) ? sameVersion : [current, ...sameVersion]
}

/** A legacy contract can renew itself; crossing versions requires a future approved transition. */
export function purchaseError(
  plan: CatalogPlan,
  plans: readonly CatalogPlan[],
  currentPlanId: string | null,
  period: BillingPeriod,
  enabled?: boolean,
): string | null {
  if (plan.is_active !== true) return 'Paket tidak aktif.'
  if (!planPeriods(plan).includes(period)) return 'Periode tersebut belum tersedia untuk paket ini.'
  const current = plans.find((item) => item.id === currentPlanId)
  if (currentPlanId && !current) return 'Kontrak berjalan belum dapat diverifikasi.'
  if (current && current.platform !== plan.platform) return 'Paket tidak tersedia untuk akun ini.'
  if (current && (current.offer_version ?? null) !== (plan.offer_version ?? null)) {
    return 'Perubahan kontrak lama ke paket baru perlu dikonfirmasi bersama tim Webzoka.'
  }
  if (plan.id === currentPlanId && (!isVersionedPlan(plan) || approvedOffer(plan))) return null
  if (!saleablePlans(plans, enabled).some((item) => item.id === plan.id)) return 'Paket belum tersedia untuk pembelian baru.'
  return null
}
