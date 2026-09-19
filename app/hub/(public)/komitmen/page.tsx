import type { Metadata } from 'next'
import { CommitmentPageContent } from '../../_public/PublicExploreContent'

export const metadata: Metadata = {
  title: 'Komitmen Kami | Webzoka Customer Hub',
  description: 'Cara Webzoka bekerja sama dengan bisnis Indonesia: jelas, terbuka, dan dapat diperiksa.',
}

export default function CommitmentPage() {
  return <CommitmentPageContent />
}
