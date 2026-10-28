import type { Metadata } from 'next'
import { StoreShowcase } from '../../_components/StoreShowcase'
import { getPublicStockPlans } from '@/lib/customer-onboarding'

export const metadata: Metadata = {
  title: 'Webzoka Store | Customer Hub',
  description: 'Jelajahi fitur, paket, dan trial 14 hari Webzoka Stock untuk pesanan, persediaan, dan produksi.',
}

export const dynamic = 'force-dynamic'

export default async function StorePage() {
  const plans = await getPublicStockPlans()
  return <StoreShowcase plans={plans} />
}
