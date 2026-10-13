import { getHubSnapshot, getHubSystemsInventory } from '@/lib/hub-data'
import { redirect } from 'next/navigation'
import { HubShell, type HubView } from './_components/HubShell'

const VIEWS = new Set<HubView>(['home', 'systems', 'billing', 'support'])

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const query = await searchParams
  if (query.view === 'store') redirect('/hub/store')
  const view = VIEWS.has(query.view as HubView) ? (query.view as HubView) : 'home'
  const [snapshot, inventory] = await Promise.all([
    getHubSnapshot(),
    view === 'home' || view === 'systems' ? getHubSystemsInventory() : Promise.resolve(null),
  ])

  return (
    <HubShell
      snapshot={snapshot}
      inventory={inventory}
      view={view}
    />
  )
}
