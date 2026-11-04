import { getHubAccount } from '@/lib/hub-account'
import { AccountHub, type AccountHubView } from '../_components/AccountHub'
import { readStockBillingAccount } from '@/lib/stock-self-payment'
import { readStockOperatorWorkspaces } from '@/lib/stock-operator-workspaces'

export const metadata = { title: 'Akun Saya | Webzoka Customer Hub', referrer: 'strict-origin' as const, robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function HubAccountPage({ searchParams }: {
  searchParams: Promise<{ view?: string | string[] }>
}) {
  const query = await searchParams
  const requested = typeof query.view === 'string' ? query.view : ''
  const view: AccountHubView = ['systems', 'billing', 'support'].includes(requested) ? requested as AccountHubView : 'home'
  const [account, billing, operatorWorkspaces] = await Promise.all([
    getHubAccount(), view === 'support' ? Promise.resolve(null) : readStockBillingAccount(),
    view === 'systems' ? readStockOperatorWorkspaces() : Promise.resolve(null),
  ])
  return <AccountHub account={account} view={view} billing={billing} operatorWorkspaces={operatorWorkspaces} />
}
