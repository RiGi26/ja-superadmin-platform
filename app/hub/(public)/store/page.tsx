import type { Metadata } from 'next'
import { StoreShowcase } from '../../_components/StoreShowcase'
import { readStockPurchaseOffers } from '@/lib/stock-self-payment'

export const metadata: Metadata = {
  title: 'Webzoka Store | Customer Hub',
  description: 'Jelajahi fitur, paket, dan trial 14 hari Webzoka Stock untuk pesanan, persediaan, dan produksi.',
}

export const dynamic = 'force-dynamic'

export default async function StorePage() {
  const quote = await readStockPurchaseOffers()
  return <StoreShowcase quote={quote} />
}
