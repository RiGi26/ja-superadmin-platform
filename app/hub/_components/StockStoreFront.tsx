import Link from 'next/link'
import { Box, Check, Plus, ReceiptText, ShieldCheck, UserRound } from 'lucide-react'
import { stockCheckoutPath } from '@/lib/stock-purchase-policy'
import { HubNavigation, type HubNavigationItem } from './HubNavigation'
import styles from './store-front.module.css'

export type StockStoreQuote = { salesEnabled: boolean; plans: readonly {
  id: string; tierDisplayName: string; publicTier: string; priceMonthly: number; features: readonly string[]
}[] }
const help = 'https://wa.me/6281296917963?text=Halo%20Webzoka%2C%20saya%20ingin%20bertanya%20tentang%20paket%20Stock.'
const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const items: HubNavigationItem[] = [
  { id: 'store-main', label: 'Webzoka Stock', href: '#store-main', icon: 'store' },
  { id: 'features', label: 'Fitur Stock', href: '#features', icon: 'systems' },
  { id: 'stock-packages', label: 'Paket & harga', href: '#stock-packages', icon: 'billing' },
  { id: 'stock-faq', label: 'FAQ trial', href: '#stock-faq', icon: 'support' },
]
const workflows = [
  { Icon: ReceiptText, title: 'Saat pesanan masuk', description: 'Kelola pesanan dan katalog, lalu siapkan invoice dan label pengiriman.', tier: 'Termasuk Basic' },
  { Icon: Box, title: 'Saat stok perlu dipantau', description: 'Pantau stok, nomor lot, kedaluwarsa, dan hasil stok opname dalam pencatatan persediaan.', tier: 'Termasuk Basic' },
  { Icon: UserRound, title: 'Saat tim bertambah', description: 'Gunakan tiga akun operator aktif, kelola pemasok dan purchase order, serta pantau laporan keuangan dan arus kas.', tier: 'Termasuk Pro' },
]

export function StockStoreFront({ quote }: { quote: StockStoreQuote | null }) {
  const plans = quote?.plans ?? []
  const salesEnabled = quote?.salesEnabled === true
  const minimum = plans.length ? Math.min(...plans.map(plan => plan.priceMonthly)) : null
  const questions = [
    ['Bagaimana memulai trial 14 hari?', 'Hubungi tim Webzoka untuk memastikan ketersediaan dan cakupan fitur trial. Trial terpisah dari langganan berbayar.'],
    ['Apakah saya langsung ditagih setelah trial?', 'Tidak. Tidak ada tagihan atau debit otomatis setelah trial.'],
    ['Apa bedanya akun Webzoka dan trial Stock?', 'Akun dan workspace Webzoka tidak otomatis memulai trial, langganan, atau pembayaran produk.'],
    ['Bagaimana memilih Basic atau Pro?', 'Pilih Basic untuk pesanan dan persediaan. Pilih Pro untuk menambahkan pembelian, laporan keuangan, dan tiga akun operator aktif.'],
    ['Apakah paket baru sudah dapat dibeli?', salesEnabled ? 'Pilih paket, masuk ke akun, lalu siapkan workspace usaha. Stock diaktifkan setelah pembayaran terverifikasi. Pembayaran dilakukan bulanan secara manual.' : 'Pembelian mandiri paket baru belum dibuka. Harga ditampilkan sebagai informasi; hubungi tim Webzoka untuk konsultasi sebelum aktivasi.'],
  ]
  return <div className={styles.page}>
    <a className={styles.skip} href="#store-main">Lewati ke konten utama</a>
    <HubNavigation label="Webzoka Store" home="/hub/store" items={items} current="store-main" footer={<div><Link className={styles.primary} href="/hub/login"><UserRound aria-hidden="true" />Buka Customer Hub</Link><a className={styles.parentLink} href="https://www.webzoka.com">Tentang Webzoka</a></div>} />
    <div className={styles.canvas}><main id="store-main" tabIndex={-1} className={styles.wrap}>
      <section className={styles.hero} aria-labelledby="store-title">
        <div><p className={styles.eyebrow}>Webzoka Stock</p><h1 id="store-title">Kelola pesanan<br />dan stok dalam<br />satu tempat.</h1><p className={styles.description}>Rapikan pesanan dan persediaan usaha Anda. Tambahkan pembelian dan laporan keuangan saat kebutuhan tim berkembang.</p><div className={styles.actions}><a className={styles.primary} href="#stock-packages">Lihat paket Stock</a><a className={styles.secondary} href="#features">Lihat fitur Stock</a></div><p className={styles.note}>Harga bulanan yang jelas. Tidak ada tagihan otomatis.</p></div>
        <aside className={styles.featured} aria-label="Trial Webzoka Stock"><div className={styles.productTop}><span className={styles.productIcon}><Box aria-hidden="true" /></span><div><strong>Webzoka Stock</strong><p>Trial 14 hari</p></div><small>Sistem operasional</small></div><h2>14 hari.<br />Tanpa tagihan otomatis.</h2><p>Trial terpisah dari paket berbayar. Hubungi tim Webzoka untuk memastikan ketersediaan dan cakupan fitur trial.</p><div className={styles.capabilities}><span><ReceiptText aria-hidden="true" />Pesanan</span><span><Box aria-hidden="true" />Persediaan</span><span><UserRound aria-hidden="true" />Tim</span></div><div className={styles.featuredBottom}><div><p>Paket bulanan mulai dari</p><strong>{minimum === null ? 'Harga belum tersedia' : money(minimum)}{minimum !== null && <small> / bulan</small>}</strong><p>Tidak ada tagihan otomatis</p></div><a href="#stock-packages">Pilih paket</a></div></aside>
      </section>
      <nav className={styles.jumps} aria-label="Jelajahi Webzoka Stock"><a href="#features"><Box aria-hidden="true" /><span><strong>Fitur Stock</strong><small>Yang bisa dikelola</small></span></a><a href="#stock-packages"><ReceiptText aria-hidden="true" /><span><strong>Paket & harga</strong><small>Basic dan Pro</small></span></a><a href="#stock-faq"><ShieldCheck aria-hidden="true" /><span><strong>Tentang trial</strong><small>Jawaban sebelum mulai</small></span></a></nav>
      <section id="features" className={styles.section} aria-labelledby="features-title"><div className={styles.heading}><div><p className={styles.eyebrow}>Fitur Webzoka Stock</p><h2 id="features-title">Dari pesanan masuk<br />sampai persediaan tercatat.</h2></div><p>Pilih Basic untuk pesanan dan stok, atau Pro untuk menambahkan pembelian dan laporan keuangan.</p></div><div className={styles.workflows}>{workflows.map(({ Icon, title, description, tier }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{description}</p><span>{tier}</span></article>)}</div></section>
      <section id="stock-packages" className={styles.section} aria-labelledby="plans-title"><div className={styles.heading}><div><p className={styles.eyebrow}>Paket Webzoka Stock</p><h2 id="plans-title">Pilih paket sesuai<br />kebutuhan tim Anda.</h2></div></div><div className={`${styles.trial} ${styles.purchaseTrial}`}><ShieldCheck aria-hidden="true" /><div><strong>Trial 14 hari terpisah dari paket berbayar.</strong><p>Tanpa kartu kredit dan tanpa tagihan otomatis. Hubungi tim Webzoka untuk memulai.</p></div></div>
        {plans.length === 2 ? <div className={`${styles.plans} ${styles.twoPlans}`}>{plans.map(plan => <article className={`${styles.plan} ${plan.publicTier === 'pro' ? styles.featuredPlan : ''}`} key={plan.id}>
          <p className={styles.purpose}>{plan.publicTier === 'pro' ? 'Pembelian & keuangan' : 'Pesanan & persediaan'}</p><h3>{plan.tierDisplayName}</h3><p className={styles.planIntro}>{plan.publicTier === 'pro' ? 'Untuk tiga akun operator aktif dengan kebutuhan pembelian dan laporan keuangan.' : 'Untuk satu akun operator aktif yang mengelola pesanan, katalog, dan stok.'}</p><p className={styles.price}>{money(plan.priceMonthly)}<small>/ bulan</small></p>
          {salesEnabled ? <><Link className={plan.publicTier === 'pro' ? styles.primary : styles.secondary} href={stockCheckoutPath(plan.id)}>Pilih {plan.tierDisplayName}</Link><a className={styles.consultationLink} href={help} target="_blank" rel="noopener noreferrer">Konsultasi paket {plan.tierDisplayName}<span className={styles.srOnly}> — membuka WhatsApp di tab baru</span></a></> : <a className={plan.publicTier === 'pro' ? styles.primary : styles.secondary} href={help} target="_blank" rel="noopener noreferrer">Konsultasi paket {plan.tierDisplayName}<span className={styles.srOnly}> — membuka WhatsApp di tab baru</span></a>}
          <div className={styles.planFeatures}><p>Yang termasuk:</p><ul>{plan.features.map(feature => <li key={feature}><Check aria-hidden="true" /><span>{feature}</span></li>)}</ul></div>
        </article>)}</div> : <p className={styles.unavailable} role="status">Harga paket belum dapat diverifikasi. Hubungi tim Webzoka untuk informasi paket.</p>}
        <p className={styles.note}><strong>{salesEnabled ? 'Pembayaran bulanan tanpa debit otomatis.' : 'Pembelian mandiri paket baru belum dibuka.'}</strong> Harga di atas berlaku per bulan; pembayaran tahunan tidak tersedia untuk paket ini.</p>
      </section>
      <section id="stock-faq" className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title"><div><p className={styles.eyebrow}>Trial & paket</p><h2 id="faq-title">Sebelum mulai<br />mencoba Stock.</h2><p>Pahami fitur trial dan pilihan paket Anda sebelum melanjutkan.</p></div><div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<Plus aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>
      <section className={styles.consult} aria-labelledby="consult-title"><div><h2 id="consult-title">Pilih paket yang sesuai kebutuhan usaha.</h2><p>Diskusikan kebutuhan operasional dan trial dengan tim Webzoka sebelum aktivasi.</p><a href={help} target="_blank" rel="noopener noreferrer">Butuh bantuan memilih paket?<span className={styles.srOnly}> — membuka WhatsApp di tab baru</span></a></div><a className={styles.secondary} href="#stock-packages">Bandingkan Basic & Pro</a></section>
    </main><footer className={`${styles.footer} ${styles.wrap}`}><p>© {new Date().getFullYear()} Webzoka</p><nav aria-label="Informasi Store"><a href="#stock-faq">Bantuan Stock</a><a href="https://www.webzoka.com/privacy/">Kebijakan privasi</a><a href="https://www.webzoka.com">Webzoka.com</a></nav></footer></div>
  </div>
}
