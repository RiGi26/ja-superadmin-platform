import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, Building2, LogOut, Store } from 'lucide-react'
import { getHubAccount } from '@/lib/hub-account'
import { logoutHubAccount } from './actions'
import styles from './account.module.css'

export const metadata = { title: 'Akun Saya | Webzoka Customer Hub', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function HubAccountPage() {
  const account = await getHubAccount()
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/hub/account" aria-label="Webzoka Customer Hub"><Image src="/logo-rocket.png" alt="" width={35} height={32} unoptimized /><span>webzoka<small>Customer Hub</small></span></Link>
          <nav aria-label="Navigasi akun"><Link href="/hub/store">Store</Link><Link href="/hub/faq">Bantuan</Link><form action={logoutHubAccount}><button type="submit"><LogOut aria-hidden="true" />Keluar</button></form></nav>
        </header>
        <section className={styles.welcome} aria-labelledby="account-title">
          <p className={styles.eyebrow}>AKUN SAYA</p>
          <h1 id="account-title">Selamat datang{account.name ? `, ${account.name}` : ''}.</h1>
          <p>{account.workspace.status === 'ready' ? 'Kelola akses workspace usaha Anda melalui akun Webzoka.' : 'Mulai dengan workspace usaha Anda. Akun dan workspace gratis, tanpa langganan produk.'}</p>
          <div className={styles.identity}><BadgeCheck aria-hidden="true" /><span><strong>Email terverifikasi</strong><span>{account.email}</span></span></div>
        </section>
        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="workspace-title">
            <div className={styles.icon}><Building2 aria-hidden="true" /></div>
            <h2 id="workspace-title">{account.workspace.status === 'ready' ? account.workspace.companyName : 'Siapkan workspace usaha'}</h2>
            {account.workspace.status === 'ready' ? <>
              <p><strong>Peran Anda: Owner</strong></p>
              <p>{account.workspace.stockStatus === 'quarantined' ? 'Koneksi Stock tercatat dalam karantina. Stock belum aktif.' : 'Workspace tersedia. Stock belum aktif.'}</p>
              <a className={styles.secondary} href="/hub/account">Periksa status terbaru</a>
            </> : <>
              <p>Gunakan nama usaha Anda untuk membuat workspace baru. Pembuatan workspace tidak memulai trial, tagihan, atau pembayaran produk.</p>
              {account.accessReady && account.workspace.status === 'empty' ? <Link className={styles.primary} href="/hub/workspace">Buat workspace gratis<ArrowRight aria-hidden="true" /></Link> : <div className={styles.notice} role="status"><p>Akses workspace belum dapat diperiksa. Muat ulang halaman untuk mencoba kembali.</p><a className={styles.secondary} href="/hub/account">Periksa kembali</a></div>}
            </>}
            <p className={styles.footnote}>Kepemilikan usaha yang sudah ada memerlukan pemeriksaan terpisah.</p>
          </section>
          <section className={styles.card} aria-labelledby="products-title">
            <div className={styles.icon}><Store aria-hidden="true" /></div>
            <h2 id="products-title">Kenali layanan Webzoka</h2>
            <p>Lihat sistem bisnis dan layanan yang sesuai dengan kebutuhan usaha Anda. Akses produk diberikan melalui proses aktivasi masing-masing layanan.</p>
            <Link className={styles.secondary} href="/hub/store">Jelajahi Webzoka Store<ArrowRight aria-hidden="true" /></Link>
          </section>
        </div>
      </div>
    </main>
  )
}
