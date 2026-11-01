import { approvedOffer, BASIC_PRO_VERSION, saleablePlans, type CatalogPlan } from '@/lib/plan-catalog'

/** Publishing an approved price does not enable a checkout or sellable plan. */
export function stockPriceQuotes(rows: readonly CatalogPlan[]) {
  const plans = rows.filter(row => row.platform === 'stock' && row.offer_version === BASIC_PRO_VERSION)
  if (plans.length !== 2 || new Set(plans.map(plan => plan.public_tier)).size !== 2) return null
  const offers = plans.map(plan => {
    const offer = approvedOffer(plan)
    if (!offer || offer.platform !== 'stock') return null
    return { id: offer.id, platform: 'stock' as const, tier: offer.tier,
      tierDisplayName: offer.name, priceMonthly: offer.price, priceYearly: null,
      offerVersion: BASIC_PRO_VERSION, publicTier: offer.publicTier,
      periods: ['monthly'], features: [...offer.features] }
  })
  if (offers.some(offer => offer === null)) return null
  return { offerVersion: BASIC_PRO_VERSION, salesEnabled: saleablePlans(plans).length === 2,
    plans: offers.filter(offer => offer !== null).sort((a, b) => a.priceMonthly - b.priceMonthly) }
}
