import { dispatchHubRoute } from '@/lib/hub-context-routing'
import { getHubBillingOwnerTenant, getHubFirstPurchaseOwnerTenant } from '@/lib/hub-billing'
import { getHubSystemsInventory } from '@/lib/hub-data'
import { redirect } from 'next/navigation'
import { HubShell, type HubView } from './_components/HubShell'

const VIEWS = new Set<HubView>(['home', 'systems', 'billing', 'support'])

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; purchase?: string }>
}) {
  const query = await searchParams
  if (query.view === 'store') redirect('/hub/store')
  const view = VIEWS.has(query.view as HubView) ? (query.view as HubView) : 'home'
  const route = await dispatchHubRoute()
  if (route.context !== 'legacy_tenant') redirect('/unauthorized')
  const snapshot = route.snapshot
  const [inventory, billingOwnerTenant, firstPurchaseTenant] = await Promise.all([
    view === 'home' || view === 'systems' ? getHubSystemsInventory() : Promise.resolve(null),
    view === 'billing' && !snapshot.isPreview && snapshot.subscription !== null
      ? getHubBillingOwnerTenant(snapshot.tenant.id) : Promise.resolve(null),
    view === 'billing' && !snapshot.isPreview && snapshot.subscription === null
      ? getHubFirstPurchaseOwnerTenant(snapshot.tenant.id) : Promise.resolve(null),
  ])
  const canManageSubscription = billingOwnerTenant !== null

  return (
    <HubShell
      snapshot={snapshot}
      inventory={inventory}
      view={view}
      canManageSubscription={canManageSubscription}
      firstPurchaseTenant={firstPurchaseTenant}
      purchaseFailed={query.purchase === 'failed'}
    />
  )
}
