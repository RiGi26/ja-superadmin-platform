import type { Metadata } from 'next'
import { ArticlesPageContent } from '../../_public/PublicExploreContent'

export const metadata: Metadata = {
  title: 'Artikel Webzoka | Customer Hub',
  description: 'Panduan praktis tentang website, portal, dan sistem bisnis untuk pemilik usaha Indonesia.',
}

export default function ArticlesPage() {
  return <ArticlesPageContent />
}
