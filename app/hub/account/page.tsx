import { getHubAccount } from '@/lib/hub-account'
import { AccountHub, type AccountHubView } from '../_components/AccountHub'

export const metadata = { title: 'Akun Saya | Webzoka Customer Hub', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function HubAccountPage({ searchParams }: {
  searchParams?: Promise<{ view?: string }>
} = {}) {
  const account = await getHubAccount()
  const query = await searchParams
  const view: AccountHubView = ['systems', 'billing', 'support'].includes(query?.view ?? '') ? query?.view as AccountHubView : 'home'
  return <AccountHub account={account} view={view} />
}
