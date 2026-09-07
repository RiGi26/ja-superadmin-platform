'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  BriefcaseBusiness,
  CircleHelp,
  FileText,
  Menu,
  ShieldCheck,
  ShoppingBag,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PUBLIC_NAV, type PublicNavIcon } from './public-content'
import styles from './public-hub.module.css'

const NAV_ICONS: Record<PublicNavIcon, LucideIcon> = {
  store: ShoppingBag,
  portfolio: BriefcaseBusiness,
  article: FileText,
  faq: CircleHelp,
  commitment: ShieldCheck,
}

function isActive(href: string, pathname: string) {
  return pathname === href || (href === '/hub/artikel' && pathname.startsWith('/hub/artikel/'))
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <>
      {PUBLIC_NAV.map((item) => {
        const Icon = NAV_ICONS[item.icon]
        const active = isActive(item.href, pathname)
        return (
          <Link
            key={item.href}
            className={`${styles.publicNavLink} ${active ? styles.publicNavLinkActive : ''}`}
            href={item.href}
            aria-current={active ? 'page' : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
            {item.badge ? <small>{item.badge}</small> : null}
          </Link>
        )
      })}
    </>
  )
}

export function PublicExploreNav() {
  const pathname = usePathname()

  return (
    <>
      <aside className={styles.publicSidebar} aria-label="Navigasi Explore Webzoka">
        <Link className={styles.publicBrand} href="/hub/store" aria-label="Webzoka Store">
          <Image src="/logo-rocket.png" alt="" width={38} height={35} priority unoptimized />
          <span translate="no"><strong>webzoka</strong><small>Customer Hub</small></span>
        </Link>
        <p className={styles.publicSidebarEyebrow}>Explore Webzoka</p>
        <nav className={styles.publicNav} aria-label="Menu publik">
          <NavLinks pathname={pathname} />
        </nav>
        <div className={styles.publicSidebarFooter}>
          <a href="https://www.webzoka.com">Webzoka.com <ArrowRight aria-hidden="true" /></a>
          <Link className={styles.publicHubButton} href="/hub">
            Buka Customer Hub <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <header className={styles.publicMobileTopbar}>
        <Link className={styles.publicMobileBrand} href="/hub/store" aria-label="Webzoka Store">
          <Image src="/logo-rocket.png" alt="" width={32} height={30} priority unoptimized />
          <span translate="no">webzoka</span>
        </Link>
        <div className={styles.publicMobileActions}>
          <Link className={styles.publicMobileHubLink} href="/hub">Customer Hub</Link>
          <details className={styles.publicMenuDisclosure}>
            <summary aria-label="Buka menu publik">
              <Menu aria-hidden="true" />
              <X aria-hidden="true" />
              <span>Menu</span>
            </summary>
            <div className={styles.publicMobileMenu}>
              <p className={styles.publicMobileMenuLabel}>Explore Webzoka</p>
              <nav aria-label="Menu publik seluler">
                <NavLinks pathname={pathname} />
              </nav>
              <a href="https://www.webzoka.com">Webzoka.com <ArrowRight aria-hidden="true" /></a>
            </div>
          </details>
        </div>
      </header>
    </>
  )
}
