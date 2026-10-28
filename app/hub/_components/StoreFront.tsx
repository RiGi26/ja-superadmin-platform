import Link from 'next/link'
import { Box, Check, Factory, Plus, ReceiptText, ShieldCheck, UserRound } from 'lucide-react'
import type { StockPlanChoice } from '@/lib/customer-onboarding'
import { HubNavigation, type HubNavigationItem } from './HubNavigation'
import styles from './store-front.module.css'

const items: HubNavigationItem[] = [
  { id: 'store-main', label: 'Webzoka Stock', href: '#store-main', icon: 'store' },
  { id: 'features', label: 'Fitur Stock', href: '#features', icon: 'systems' },
  { id: 'stock-packages', label: 'Paket & harga', href: '#stock-packages', icon: 'billing' },
  { id: 'stock-faq', label: 'FAQ trial', href: '#stock-faq', icon: 'support' },
]
const workflows = [
  { Icon: ReceiptText, title: 'Saat pesanan masuk', description: 'Pantau status pesanan, siapkan invoice dan label pengiriman, lalu dukung komunikasi pelanggan dengan notifikasi WhatsApp.', tier: 'Mulai paket Starter' },
  { Icon: Box, title: 'Saat stok perlu dipantau', description: 'Kelola lot, kedaluwarsa, dan stok opname. Lengkapi pencatatan dengan pengelolaan pemasok dan purchase order.', tier: 'Mulai paket Growth' },
  { Icon: Factory, title: 'Saat usaha berproduksi', description: 'Kelola resep/BOM dan perencanaan produksi. Dukung kebutuhan tim melalui modul SDM, penggajian, dan hak akses.', tier: 'Tersedia di paket Pro' },
]
const questions = [
  ['Fitur apa yang saya dapatkan selama trial?', 'Selama trial 14 hari, Anda dapat mencoba semua fitur Pro di Webzoka Stock. Paket yang dipilih disimpan sebagai pilihan billing setelah trial.'],
  ['Apakah saya langsung ditagih setelah trial?', 'Tidak. Anda tidak ditagih otomatis. Tidak ada pembayaran atau kartu kredit yang diperlukan saat mendaftar trial.'],
  ['Apa bedanya akun Webzoka dan trial Stock?', 'Akun Webzoka memberi Anda akses ke Customer Hub. Membuat akun tidak otomatis memulai trial atau pembayaran produk. Gunakan alur pendaftaran Stock untuk mulai mencoba produknya.'],
  ['Bagaimana memilih Starter, Growth, atau Pro?', 'Starter berfokus pada pesanan dan katalog. Growth menambahkan pengelolaan stok dan pembelian. Pro mencakup kebutuhan produksi dan tim. Selama trial, Anda dapat mencoba semua fitur Pro.'],
]
const currency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const planCopy: Record<StockPlanChoice['tier'], [string, string]> = {
  starter: ['Pesanan & katalog', 'Untuk mulai menata pesanan dan produk usaha Anda.'],
  pro: ['Stok & pembelian', 'Saat persediaan dan pembelian perlu dikelola lebih rinci.'],
  enterprise: ['Produksi & tim', 'Untuk usaha dengan alur produksi dan kebutuhan tim.'],
}

export function StoreFront({ plans }: { plans: StockPlanChoice[] }) {
  const minimum = plans.length ? Math.min(...plans.map(plan => plan.priceMonthly)) : null
  return <div className={styles.page}>
    <a className={styles.skip} href="#store-main">Lewati ke konten utama</a>
    <HubNavigation label="Webzoka Store" home="/hub/store" items={items} current="store-main" footer={<div>
      <Link className={styles.primary} href="/hub/login"><UserRound aria-hidden="true" />Buka Customer Hub</Link>
      <a className={styles.parentLink} href="https://www.webzoka.com">Tentang Webzoka</a>
    </div>} />
    <div className={styles.canvas}>
      <main id="store-main" tabIndex={-1} className={styles.wrap}>
        <section className={styles.hero} aria-labelledby="store-title">
          <div><p className={styles.eyebrow}>Webzoka Stock</p><h1 id="store-title">Kelola pesanan,<br />stok, dan produksi<br />di satu tempat.</h1>
            <p className={styles.description}>Untuk usaha yang ingin menata pesanan, memantau persediaan, dan mengelola produksi. Pilih fitur sesuai kebutuhan operasional tim Anda.</p>
            <div className={styles.actions}><a className={styles.primary} href="#stock-packages">Coba Stock 14 hari</a><a className={styles.secondary} href="#features">Lihat fitur Stock</a></div>
            <p className={styles.note}>Tanpa kartu kredit. Tidak ada pembayaran saat mendaftar.</p>
          </div>
          <aside className={styles.featured} aria-label="Trial Webzoka Stock"><div className={styles.productTop}><span className={styles.productIcon}><Box aria-hidden="true" /></span><div><strong>Webzoka Stock</strong><p>Trial 14 hari</p></div><small>Sistem operasional</small></div>
            <h2>14 hari.<br />Semua fitur Pro.</h2><p>Coba fitur pesanan, stok, pembelian, produksi, dan pengelolaan tim selama masa trial.</p>
            <div className={styles.capabilities}><span><ReceiptText aria-hidden="true" />Pesanan</span><span><Box aria-hidden="true" />Persediaan</span><span><Factory aria-hidden="true" />Produksi</span></div>
            <div className={styles.featuredBottom}><div><p>Setelah trial, mulai dari</p><strong>{minimum === null ? 'Harga belum tersedia' : currency(minimum)} {minimum !== null && <small>/ bulan</small>}</strong><p>Tidak ada tagihan otomatis</p></div><a href="#stock-packages">Pilih paket</a></div>
          </aside>
        </section>
        <nav className={styles.jumps} aria-label="Jelajahi Webzoka Stock"><a href="#features"><Box aria-hidden="true" /><span><strong>Fitur Stock</strong><small>Yang bisa dikelola</small></span></a><a href="#stock-packages"><ReceiptText aria-hidden="true" /><span><strong>Paket & harga</strong><small>Starter, Growth, Pro</small></span></a><a href="#stock-faq"><ShieldCheck aria-hidden="true" /><span><strong>Tentang trial</strong><small>Jawaban sebelum mulai</small></span></a></nav>
        <section id="features" className={styles.section} aria-labelledby="features-title"><div className={styles.heading}><div><p className={styles.eyebrow}>Fitur Webzoka Stock</p><h2 id="features-title">Dari pesanan masuk<br />sampai kebutuhan produksi.</h2></div><p>Mulai dari pekerjaan yang ingin Anda rapikan. Cakupan fitur berbeda sesuai paket; semua fitur Pro dapat dicoba selama trial.</p></div>
          <div className={styles.workflows}>{workflows.map(({ Icon, title, description, tier }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{description}</p><span>{tier}</span></article>)}</div>
        </section>
        <section id="stock-packages" className={styles.section} aria-labelledby="plans-title"><div className={styles.heading}><div><p className={styles.eyebrow}>Paket Webzoka Stock</p><h2 id="plans-title">Pilih paket sesuai<br />kebutuhan tim Anda.</h2></div></div>
          <div className={styles.trial}><ShieldCheck aria-hidden="true" /><div><strong>Coba 14 hari dengan semua fitur Pro.</strong><p>Tanpa kartu kredit. Tidak ada pembayaran saat mendaftar.</p></div></div>
          {plans.length ? <div className={styles.plans}>{plans.map(plan => <article className={`${styles.plan} ${plan.tier === 'pro' ? styles.featuredPlan : ''}`} key={plan.id}>
            <p className={styles.purpose}>{planCopy[plan.tier][0]}</p><h3>{plan.name}</h3>
            <p className={styles.planIntro}>{planCopy[plan.tier][1]}</p>
            <p className={styles.price}>{currency(plan.priceMonthly)}<small>/ bulan setelah trial</small></p>
            <Link className={plan.tier === 'pro' ? styles.primary : styles.secondary} href={`/hub/onboarding/stock?tier=${plan.tier}`}>Coba 14 hari<span className={styles.srOnly}> — paket {plan.name}</span></Link>
            <div className={styles.planFeatures}><p>Yang termasuk:</p>{plan.features.length ? <ul>{plan.features.slice(0, 5).map(feature => <li key={feature}><Check aria-hidden="true" /><span>{feature}</span></li>)}</ul> : <p>Rincian fitur belum tersedia. Hubungi tim Webzoka untuk informasi paket.</p>}</div>
          </article>)}</div> : <p className={styles.unavailable} role="status">Paket belum dapat dimuat. Hubungi tim Webzoka untuk memulai trial Stock.</p>}
          <p className={styles.note}><strong>Tidak ada tagihan otomatis.</strong> Paket yang Anda pilih disimpan untuk billing setelah trial. Harga di atas adalah biaya per bulan setelah masa trial.</p>
        </section>
        <section id="stock-faq" className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title"><div><p className={styles.eyebrow}>Trial & paket</p><h2 id="faq-title">Sebelum mulai<br />mencoba Stock.</h2><p>Pahami fitur trial dan pilihan paket Anda sebelum melanjutkan.</p></div><div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<Plus aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>
        <section className={styles.consult} aria-labelledby="consult-title"><div><h2 id="consult-title">Siap mencoba Webzoka Stock?</h2><p>Pilih paket Anda dan coba seluruh fitur Pro selama 14 hari.</p><a href="https://wa.me/6281296917963?text=Halo%20Webzoka%2C%20saya%20ingin%20bertanya%20tentang%20paket%20Stock." target="_blank" rel="noopener noreferrer">Butuh bantuan memilih paket?<span className={styles.srOnly}> — membuka WhatsApp di tab baru</span></a></div><a className={styles.secondary} href="#stock-packages">Pilih paket & mulai trial</a></section>
      </main>
      <footer className={`${styles.footer} ${styles.wrap}`}><p>© {new Date().getFullYear()} Webzoka</p><nav aria-label="Informasi Store"><a href="#stock-faq">Bantuan Stock</a><a href="https://www.webzoka.com/privacy/">Kebijakan privasi</a><a href="https://www.webzoka.com">Webzoka.com</a></nav></footer>
    </div>
  </div>
}
