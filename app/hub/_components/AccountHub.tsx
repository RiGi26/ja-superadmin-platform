import Link from 'next/link'
import { BadgeCheck, Box, Building2, Check, LayoutGrid, LogOut, MessageCircle, ReceiptText } from 'lucide-react'
import type { HubAccount } from '@/lib/hub-account'
import { logoutHubAccount } from '../account/actions'
import { HubNavigation, type HubNavigationItem } from './HubNavigation'
import styles from './hub-interior.module.css'

export type AccountHubView = 'home' | 'systems' | 'billing' | 'support'
const items: HubNavigationItem[] = [
  { id: 'home', label: 'Beranda', href: '/hub/account', icon: 'home' },
  { id: 'systems', label: 'Sistem Saya', href: '/hub/account?view=systems', icon: 'systems' },
  { id: 'store', label: 'Store', href: '/hub/store', icon: 'store' },
  { id: 'billing', label: 'Tagihan', href: '/hub/account?view=billing', icon: 'billing' },
  { id: 'support', label: 'Bantuan', href: '/hub/account?view=support', icon: 'support' },
]

export function AccountHub({ account, view }: { account: HubAccount; view: AccountHubView }) {
  const ready = account.workspace.status === 'ready'
  const title = ready ? account.workspace.companyName : 'Siapkan workspace usaha'
  const initials = account.name.trim().charAt(0).toUpperCase() || 'W'
  const help = '/hub/account?view=support'
  const workspaceDescription = ready
    ? account.workspace.stockStatus === 'quarantined' ? 'Koneksi Stock tercatat dalam karantina. Stock belum aktif.' : 'Workspace tersedia. Stock belum aktif.'
    : 'Gunakan nama usaha Anda untuk membuat workspace baru. Pembuatan workspace tidak memulai trial, tagihan, atau pembayaran produk.'
  return <div className={styles.hubShell}>
    <a className={styles.skipLink} href="#hub-main">Lewati ke konten utama</a>
    <HubNavigation label="Customer Hub" home="/hub/account" items={items} current={view} footer={<div><div className={styles.sidebarAccount}><span className={styles.avatar}>{initials}</span><span><strong>{account.name || 'Akun Webzoka'}</strong><small>{account.email}</small></span></div><form action={logoutHubAccount}><button className={styles.logoutButton} type="submit"><LogOut aria-hidden="true" />Keluar</button></form></div>} />
    <header className={styles.topbar}><p>Customer Hub <strong>{items.find(item => item.id === view)?.label}</strong></p><span className={styles.avatar}>{initials}</span></header>
    <main className={styles.hubMain} id="hub-main" tabIndex={-1}><div className={styles.contentWrap}>
      <header className={styles.pageHeading}><p className={styles.eyebrow}>{view === 'home' ? 'Customer Hub' : view === 'systems' ? 'Workspace' : view === 'billing' ? 'Langganan' : 'Bantuan'}</p><h1>{view === 'home' ? `Selamat datang${account.name ? `, ${account.name}` : ' kembali'}.` : view === 'systems' ? 'Sistem Saya' : view === 'billing' ? 'Tagihan & paket' : 'Kami siap membantu.'}</h1><p>{view === 'home' ? 'Kelola workspace dan layanan Webzoka Anda.' : view === 'systems' ? 'Akses produk mengikuti proses aktivasi masing-masing layanan.' : view === 'billing' ? 'Informasi paket dan transaksi yang tersedia untuk akun Anda.' : 'Untuk kendala akses sistem, akun, atau langganan Webzoka Anda.'}</p>{view === 'home' && <p className={styles.verified}><BadgeCheck aria-hidden="true" />Email terverifikasi</p>}</header>
      {view === 'home' && <>
        <div className={styles.overviewGrid}><article className={styles.workspaceCard}><div className={styles.workspaceHeading}><span className={styles.systemMark}><Building2 aria-hidden="true" /></span><div><p className={styles.sectionKicker}>Workspace usaha</p><h2>{title}</h2></div></div><p>Ruang untuk layanan usaha Anda.</p><p className={styles.muted}>{workspaceDescription}</p>
          <ul className={styles.checklist}><li><Check aria-hidden="true" /><span><strong>Email akun terverifikasi</strong><br />Akun siap digunakan untuk Customer Hub.</span></li>{ready && <li><Check aria-hidden="true" /><span><strong>Peran Anda: Owner</strong><br />Workspace usaha tersedia. Akses produk diaktifkan terpisah.</span></li>}</ul>
          <div className={styles.buttonRow}>{ready ? <Link className={styles.primaryButton} href="/hub/account?view=systems">Lihat sistem saya</Link> : account.accessReady && account.workspace.status === 'empty' ? <Link className={styles.primaryButton} href="/hub/workspace">Buat workspace gratis</Link> : null}<Link className={styles.secondaryButton} href={help}>Bantuan akun</Link></div>
          {!ready && !(account.accessReady && account.workspace.status === 'empty') && <div className={styles.notice} role="status"><p>Akses workspace belum dapat diperiksa. Muat ulang halaman untuk mencoba kembali.</p><a className={styles.textLink} href="/hub/account">Periksa kembali</a></div>}
          {ready && <a className={styles.textLink} href="/hub/account">Periksa status terbaru</a>}
          <p className={styles.guideNote}>Kepemilikan usaha yang sudah ada memerlukan pemeriksaan terpisah.</p>
        </article><aside className={styles.nextCard}><span className={styles.systemMark}><Box aria-hidden="true" /></span><p className={styles.sectionKicker}>Langkah berikutnya</p><h2>Kenali Webzoka Stock.</h2><p>Lihat fitur untuk pesanan, persediaan, dan produksi. Pilih paket sesuai kebutuhan operasional tim Anda.</p><Link className={styles.secondaryButton} href="/hub/store">Jelajahi Store</Link><small>Akses produk mengikuti proses aktivasi masing-masing layanan.</small></aside></div>
        <section className={styles.sectionBlock}><div className={styles.sectionTitleRow}><h2>Akses cepat</h2></div><div className={styles.actionGrid}><Link className={styles.actionRow} href="/hub/account?view=systems"><LayoutGrid aria-hidden="true" /><span><strong>Sistem Saya</strong><small>Periksa status akses produk</small></span></Link><Link className={styles.actionRow} href="/hub/account?view=billing"><ReceiptText aria-hidden="true" /><span><strong>Tagihan & paket</strong><small>Informasi yang tersedia untuk akun Anda</small></span></Link><Link className={styles.actionRow} href={help}><MessageCircle aria-hidden="true" /><span><strong>Bantuan Webzoka</strong><small>Bantuan akses dan akun</small></span></Link></div></section>
      </>}
      {view === 'systems' && <section className={`${styles.honestEmptyState} ${styles.inventoryState}`}><LayoutGrid aria-hidden="true" /><div><h2>{account.accessReady ? 'Belum ada keanggotaan sistem aktif' : 'Daftar sistem belum tersedia'}</h2><p>{account.accessReady ? workspaceDescription : 'Akses keanggotaan belum dapat diperiksa. Muat ulang halaman atau hubungi bantuan.'}</p></div><Link className={styles.primaryButton} href="/hub/store">Jelajahi Store</Link><Link className={styles.textLink} href={help}>Bantuan aktivasi</Link></section>}
      {view === 'billing' && <><section className={styles.workspaceCard}><div className={styles.workspaceHeading}><span className={styles.systemMark}><ReceiptText aria-hidden="true" /></span><h2>Akses tagihan belum tersedia</h2></div><p className={styles.muted}>Akun dan workspace tidak otomatis memberikan akses mengelola langganan atau melihat tagihan produk.</p><div className={styles.buttonRow}><Link className={styles.primaryButton} href="/hub/store#stock-packages">Lihat paket di Store</Link><Link className={styles.secondaryButton} href={help}>Bantuan akses tagihan</Link></div></section><section className={styles.sectionBlock}><h2>Riwayat tagihan</h2><div className={styles.inlineNotice}><ReceiptText aria-hidden="true" /><span>Riwayat belum dapat ditampilkan untuk akun ini. Hubungi bantuan bila Anda memerlukan pemeriksaan.</span></div></section></>}
      {view === 'support' && <><section className={styles.supportGrid}><article className={styles.supportPrimary}><span className={styles.supportIcon}><MessageCircle aria-hidden="true" /></span><h2>WhatsApp Webzoka</h2><p>Sertakan nama usaha, sistem terkait, dan ringkasan kendala agar tim dapat memahami kebutuhan Anda.</p><a className={styles.secondaryButton} href="https://wa.me/6281296917963?text=Halo%20Webzoka%2C%20saya%20membutuhkan%20bantuan%20Customer%20Hub." target="_blank" rel="noopener noreferrer">Buka WhatsApp<span className={styles.srOnly}> — membuka tab baru</span></a></article><article className={styles.supportSecondary}><h2>Informasi untuk disertakan</h2><dl className={styles.supportFacts}><div><dt>Workspace</dt><dd>{ready ? account.workspace.companyName : 'Belum tersedia'}</dd></div><div><dt>Status sistem</dt><dd>{account.accessReady ? 'Belum ada keanggotaan sistem aktif' : 'Belum dapat diperiksa'}</dd></div><div><dt>Email akun</dt><dd>{account.email}</dd></div></dl><p>Jangan membagikan kata sandi atau kode verifikasi melalui percakapan.</p></article></section><section className={styles.sectionBlock}><h2>Pertanyaan umum</h2><div className={styles.faq}><details><summary>Apakah workspace berarti sudah berlangganan?</summary><p>Tidak. Pembuatan workspace tidak otomatis memulai trial, tagihan, atau pembayaran produk.</p></details><details><summary>Bagaimana bila sistem saya belum muncul?</summary><p>Hubungi bantuan untuk pemeriksaan akun dan keanggotaan sistem Anda.</p></details></div><p className={styles.guideNote}>Panduan terpusat dan pelacakan tiket belum tersedia.</p></section></>}
      <p className={styles.guideNote}><Link className={styles.textLink} href="/hub/faq">FAQ Webzoka</Link></p>
    </div></main>
  </div>
}
