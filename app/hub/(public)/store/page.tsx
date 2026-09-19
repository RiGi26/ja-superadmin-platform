import type { Metadata } from 'next'
import { StoreShowcase } from '../../_components/StoreShowcase'
import { getPublicStockPlans } from '@/lib/customer-onboarding'

export const metadata: Metadata = {
  title: 'Webzoka Store | Customer Hub',
  description: 'Lihat proyek Webzoka yang sudah live dan temukan arah digital yang pas untuk bisnis Anda.',
}

export const dynamic = 'force-dynamic'

export default async function StorePage() {
  const plans = await getPublicStockPlans()
  return <StoreShowcase plans={plans} />
}
