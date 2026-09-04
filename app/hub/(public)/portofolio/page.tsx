import type { Metadata } from 'next'
import { PortfolioPageContent } from '../../_public/PublicExploreContent'

export const metadata: Metadata = {
  title: 'Portofolio Webzoka | Customer Hub',
  description: 'Lihat contoh website dan sistem Webzoka yang sudah dipakai bisnis nyata.',
}

export default function PortfolioPage() {
  return <PortfolioPageContent />
}
