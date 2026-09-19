import type { Metadata } from 'next'
import { FaqPageContent } from '../../_public/PublicExploreContent'

export const metadata: Metadata = {
  title: 'FAQ Webzoka | Customer Hub',
  description: 'Jawaban tentang website, portal bisnis, Customer Hub, dan dukungan Webzoka.',
}

export default function FaqPage() {
  return <FaqPageContent />
}
