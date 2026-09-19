import type { ReactNode } from 'react'
import { PublicExploreShell } from '../_public/PublicExploreShell'

export default function PublicHubLayout({ children }: { children: ReactNode }) {
  return <PublicExploreShell>{children}</PublicExploreShell>
}
