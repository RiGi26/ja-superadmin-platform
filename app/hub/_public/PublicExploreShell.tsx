'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { PublicExploreNav } from './PublicExploreNav'
import styles from './public-hub.module.css'

export function PublicExploreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // Store owns the approved product sidebar; other public pages retain their navigation.
  if (pathname === '/hub/store' || pathname === '/store') return children
  return (
    <div className={styles.publicHubShell}>
      <a className={styles.publicSkipLink} href="#public-main">Lewati ke konten utama</a>
      <PublicExploreNav />
      <main className={styles.publicMain} id="public-main">
        <div className={styles.publicContent}>{children}</div>
      </main>
    </div>
  )
}
