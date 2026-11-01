'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Box, CircleHelp, Home, LayoutGrid, Menu, ReceiptText, X } from 'lucide-react'
import styles from './hub-navigation.module.css'

export type HubNavigationItem = { id: string; label: string; href: string; icon: 'home' | 'systems' | 'store' | 'billing' | 'support' }
const icons = { home: Home, systems: LayoutGrid, store: Box, billing: ReceiptText, support: CircleHelp }

export function HubNavigation({ label, home, items, current, footer }: {
  label: string; home: string; items: HubNavigationItem[]; current: string; footer: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const [section, setSection] = useState(current)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function sync() { setSection(window.location.hash.slice(1) || current) }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [current])

  useEffect(() => {
    if (!open) return
    const before = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    const media = window.matchMedia('(min-width: 1001px)')
    function onResize() { if (media.matches) dialog.current?.close() }
    media.addEventListener('change', onResize)
    return () => {
      document.documentElement.style.overflow = before
      media.removeEventListener('change', onResize)
    }
  }, [open])

  function close() { dialog.current?.close() }
  function brand() {
    return <Link href={home} className={styles.brand} aria-label={`Beranda ${label}`} onClick={close}>
      <Image src="/logo-rocket.png" alt="" width={44} height={44} priority unoptimized />
      <span translate="no">webzoka</span>
    </Link>
  }
  function content() {
    return <div className={styles.content}>
      {brand()}<p className={styles.label}>{label}</p>
      <nav className={styles.nav} aria-label={`Navigasi ${label}`}>
        {items.map(item => {
          const Icon = icons[item.icon]
          return <Link key={item.id} href={item.href} aria-current={item.id === section ? 'page' : undefined} onClick={() => { setSection(item.id); close() }}>
            <Icon aria-hidden="true" /><span>{item.label}</span>
          </Link>
        })}
      </nav>
      <div className={styles.footer}>{footer}</div>
    </div>
  }
  return <>
    <aside className={styles.sidebar} aria-label={`Navigasi samping ${label}`}>{content()}</aside>
    <header className={styles.mobile}>{brand()}<button ref={trigger} className={styles.menu} type="button" aria-label="Buka menu navigasi" aria-controls={id} aria-expanded={open} aria-haspopup="dialog" onClick={() => { dialog.current?.showModal(); setOpen(true) }}><Menu aria-hidden="true" /></button></header>
    <dialog ref={dialog} id={id} className={styles.drawer} aria-label={`Menu ${label}`} onClose={() => { setOpen(false); trigger.current?.focus() }} onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX > bounds.right || event.clientX < bounds.left) close()
    }}>
      <div className={styles.toolbar}><button className={styles.menu} type="button" aria-label="Tutup menu navigasi" onClick={close}><X aria-hidden="true" /></button></div>
      {content()}
    </dialog>
  </>
}
