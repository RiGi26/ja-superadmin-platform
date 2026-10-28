import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CalendarDays,
  CreditCard,
  GraduationCap,
  HeartPulse,
  HousePlug,
  LogOut,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Shirt,
  Store,
  Stethoscope,
  Warehouse,
} from 'lucide-react'
import type { HubCustomerSnapshot, HubSystemsInventory } from '@/lib/hub-data'
import type { HubFirstPurchaseTenant } from '@/lib/hub-billing'
import { logoutFromHub, openHubSubscriptionManagement, submitHubFirstPurchase } from '../actions'
import { HubNavigation, type HubNavigationItem } from './HubNavigation'
import styles from './hub-interior.module.css'

export type HubView = 'home' | 'systems' | 'billing' | 'support'

type PlatformMeta = {
  label: string
  shortLabel: string
  description: string
  icon: LucideIcon
  tone: string
}

const PLATFORM_META: Record<string, PlatformMeta> = {
  stock: {
    label: 'Webzoka Stock',
    shortLabel: 'Stock',
    description: 'Stok, penjualan, dan operasi bisnis dalam satu portal.',
    icon: Warehouse,
    tone: 'blue',
  },
  lms: {
    label: 'Webzoka LMS',
    shortLabel: 'LMS',
    description: 'Kelas, siswa, materi, dan progres pembelajaran.',
    icon: GraduationCap,
    tone: 'violet',
  },
  clinic: {
    label: 'Webzoka Clinic',
    shortLabel: 'Clinic',
    description: 'Operasional klinik dan perjalanan pelayanan pasien.',
    icon: Stethoscope,
    tone: 'cyan',
  },
  pharmacy: {
    label: 'Webzoka Pharmacy',
    shortLabel: 'Pharmacy',
    description: 'Penjualan, inventori, dan pengelolaan apotek.',
    icon: HeartPulse,
    tone: 'green',
  },
  jastip: {
    label: 'Webzoka Jastip',
    shortLabel: 'Jastip',
    description: 'Pesanan titip beli, invoice, dan status pengiriman.',
    icon: PackageCheck,
    tone: 'orange',
  },
  rental: {
    label: 'Webzoka Rental',
    shortLabel: 'Rental',
    description: 'Pesanan, jadwal, dan aset bisnis rental.',
    icon: CalendarDays,
    tone: 'orange',
  },
  laundry: {
    label: 'Webzoka Laundry',
    shortLabel: 'Laundry',
    description: 'Pesanan laundry, status proses, dan pembayaran.',
    icon: Shirt,
    tone: 'pink',
  },
}

const NAV: HubNavigationItem[] = [
  { id: 'home', label: 'Beranda', icon: 'home', href: '/hub' },
  { id: 'systems', label: 'Sistem Saya', icon: 'systems', href: '/hub/systems' },
  { id: 'store', label: 'Store', icon: 'store', href: '/hub/store' },
  { id: 'billing', label: 'Tagihan', icon: 'billing', href: '/hub/billing' },
  { id: 'support', label: 'Bantuan', icon: 'support', href: '/hub/support' },
]

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  trial: 'Masa uji coba',
  past_due: 'Perlu pembayaran',
  suspended: 'Ditangguhkan',
  cancelled: 'Dibatalkan',
  expired: 'Berakhir',
  paid: 'Lunas',
  unpaid: 'Belum dibayar',
  awaiting_payment: 'Menunggu pembayaran',
  failed: 'Gagal',
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Belum ditentukan'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function statusLabel(status: string | null | undefined) {
  return STATUS_LABEL[status ?? ''] ?? status ?? 'Belum aktif'
}

function platformMeta(platform: string): PlatformMeta {
  return (
    PLATFORM_META[platform] ?? {
      label: 'Sistem Webzoka',
      shortLabel: platform,
      description: 'Sistem bisnis yang terhubung ke akun Webzoka Anda.',
      icon: HousePlug,
      tone: 'blue',
    }
  )
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className={styles.pageHeading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`${styles.statusPill} ${styles[`status_${status}`] ?? ''}`}>
      <span aria-hidden="true" />
      {statusLabel(status)}
    </span>
  )
}

function SystemMark({ platform, size = 'normal' }: { platform: string; size?: 'normal' | 'large' }) {
  const meta = platformMeta(platform)
  const Icon = meta.icon
  return (
    <span className={`${styles.systemMark} ${styles[`tone_${meta.tone}`]} ${size === 'large' ? styles.systemMarkLarge : ''}`}>
      <Icon aria-hidden="true" />
    </span>
  )
}

function PreviewNotice() {
  return (
    <div className={styles.previewNotice} role="status">
      <BadgeCheck aria-hidden="true" />
      <div>
        <strong>Mode pratinjau</strong>
        <span>Data akun bersifat contoh. Harga paket dimuat langsung dari Webzoka Core.</span>
      </div>
    </div>
  )
}

function SystemInventory({ inventory, nested = false }: { inventory: HubSystemsInventory | null; nested?: boolean }) {
  const Heading = nested ? 'h3' : 'h2'
  if (!inventory?.accessReady || inventory.systems.length === 0) {
    return (
      <section className={`${styles.honestEmptyState} ${styles.inventoryState}`}>
        <Boxes aria-hidden="true" />
        <div>
          <Heading>{inventory?.accessReady ? 'Belum ada keanggotaan sistem aktif' : 'Daftar sistem belum tersedia'}</Heading>
          <p>{inventory?.accessReady
            ? 'Akun Anda belum memiliki keanggotaan aktif untuk sistem yang terdaftar.'
            : 'Kami belum dapat memverifikasi keanggotaan Anda. Muat ulang halaman atau hubungi bantuan.'}</p>
        </div>
        <Link className={styles.secondaryButton} href="/hub/support">Hubungi bantuan</Link>
      </section>
    )
  }

  return (
    <section className={styles.inventoryList} aria-label="Keanggotaan sistem Anda">
      {inventory.systems.map((system) => (
        <article key={system.tenant.id} className={`${styles.systemDetailPanel} ${styles.inventoryCard}`}>
          <div className={styles.systemHeroRow}>
            <div className={styles.systemIdentity}>
              <SystemMark platform={system.tenant.platform} size="large" />
              <div>
                <Heading>{platformMeta(system.tenant.platform).label}</Heading>
                <p>{system.tenant.name}</p>
              </div>
            </div>
            <StatusPill status={system.tenant.status} />
          </div>
          <div className={styles.detailFacts}>
            <div><span>Akun bisnis</span><strong>{system.tenant.slug}</strong></div>
            <div><span>Platform</span><strong translate="no">{system.tenant.platform}</strong></div>
            <div><span>Peran keanggotaan</span><strong>{system.role}</strong></div>
          </div>
          <p className={styles.inventoryNotice}>Keanggotaan akun aktif. Akses masuk ke portal belum diverifikasi.</p>
        </article>
      ))}
    </section>
  )
}

function HomeView({ snapshot, inventory }: { snapshot: HubCustomerSnapshot | null; inventory: HubSystemsInventory | null }) {
  const plan = snapshot?.subscription?.plan
  return <>
    <PageHeading eyebrow="Customer Hub" title={snapshot ? `Selamat datang, ${snapshot.tenant.name}` : 'Akun Webzoka Anda'} description="Kelola keanggotaan sistem dan layanan Webzoka Anda dari satu tempat." />
    {snapshot?.isPreview ? <PreviewNotice /> : null}
    <div className={styles.overviewGrid}>
      <article className={styles.workspaceCard}>
        <div className={styles.workspaceHeading}><SystemMark platform={snapshot?.tenant.platform ?? 'unknown'} size="large" /><div><p className={styles.sectionKicker}>Akun bisnis</p><h2>{snapshot?.tenant.name ?? 'Keanggotaan sistem Anda'}</h2></div></div>
        <p>Ruang untuk layanan usaha Anda.</p>
        <p className={styles.muted}>Periksa sistem yang terhubung ke akun Anda. Keanggotaan tidak otomatis memverifikasi akses masuk ke portal.</p>
        {snapshot ? <section className={styles.summaryStrip} aria-label="Ringkasan akun"><div><span>Status akun</span><strong>{statusLabel(snapshot.tenant.status)}</strong></div><div><span>Paket aktif</span><strong>{plan?.name ?? snapshot.tenant.planTier ?? 'Belum ada paket'}</strong></div><div><span>Periode berikutnya</span><strong>{formatDate(snapshot.subscription?.currentPeriodEnd)}</strong></div></section> : null}
        <div className={styles.buttonRow}><Link href="/hub/systems" className={styles.primaryButton}>Lihat sistem saya</Link><Link href="/hub/support" className={styles.secondaryButton}>Bantuan akun</Link></div>
      </article>
      <aside className={styles.nextCard}><SystemMark platform="stock" size="large" /><p className={styles.sectionKicker}>Langkah berikutnya</p><h2>Kenali Webzoka Stock.</h2><p>Lihat fitur untuk pesanan, persediaan, dan produksi. Pilih paket sesuai kebutuhan operasional tim Anda.</p><Link href="/hub/store" className={styles.secondaryButton}>Jelajahi Store</Link><small>Akses produk mengikuti proses aktivasi masing-masing layanan.</small></aside>
    </div>
    <section className={styles.sectionBlock}><div className={styles.sectionTitleRow}><h2>Sistem Saya</h2><Link href="/hub/systems" className={styles.textLink}>Lihat detail</Link></div><SystemInventory inventory={inventory} nested /></section>
    <section className={styles.actionGrid} aria-label="Akses cepat"><Link href="/hub/systems" className={styles.actionRow}><Boxes aria-hidden="true" /><span><strong>Sistem Saya</strong><small>Keanggotaan sistem akun Anda</small></span></Link><Link href="/hub/billing" className={styles.actionRow}><CreditCard aria-hidden="true" /><span><strong>Tagihan & paket</strong><small>Informasi yang tersedia untuk akun Anda</small></span></Link><Link href="/hub/support" className={styles.actionRow}><MessageCircle aria-hidden="true" /><span><strong>Bantuan Webzoka</strong><small>Bantuan akses, akun, dan langganan</small></span></Link></section>
  </>
}

function SystemsView({ inventory }: { inventory: HubSystemsInventory | null }) {
  return (
    <>
      <PageHeading
        eyebrow="Workspace"
        title="Sistem Saya"
        description="Daftar sistem berdasarkan keanggotaan aktif akun Anda."
      />
      <SystemInventory inventory={inventory} />

      <section className={styles.honestEmptyState}>
        <Boxes aria-hidden="true" />
        <div>
          <h2>Butuh sistem lain?</h2>
          <p>Tambahkan solusi baru dari Store. Tim Webzoka akan membantu aktivasi dan penyambungan akun.</p>
        </div>
        <Link href="/hub/store" className={styles.textLink}>Buka Store <ArrowRight aria-hidden="true" /></Link>
      </section>
    </>
  )
}

function BillingView({ snapshot, canManageSubscription, firstPurchaseTenant, purchaseFailed }: {
  snapshot: HubCustomerSnapshot
  canManageSubscription: boolean
  firstPurchaseTenant: HubFirstPurchaseTenant | null
  purchaseFailed: boolean
}) {
  const plan = snapshot.subscription?.plan
  const purchasePlans = !snapshot.isPreview && snapshot.subscription === null &&
    firstPurchaseTenant?.tenantId === snapshot.tenant.id && firstPurchaseTenant.platform === snapshot.tenant.platform
    ? snapshot.plans.filter((item) => item.platform === firstPurchaseTenant.platform) : []

  return (
    <>
      <PageHeading
        eyebrow="Langganan"
        title="Tagihan & Paket"
        description="Lihat paket berjalan, periode aktif, dan transaksi akun Anda."
      />
      {snapshot.isPreview ? <PreviewNotice /> : null}

      {purchaseFailed ? (
        <p className={styles.inlineNotice} role="alert">Pembayaran belum dapat dimulai. Muat ulang halaman Tagihan dan coba kembali.</p>
      ) : null}

      <form action={openHubSubscriptionManagement} className={styles.billingOverview}>
        <div className={styles.billingPlanIdentity}>
          <SystemMark platform={snapshot.tenant.platform} size="large" />
          <div>
            <p className={styles.sectionKicker}>Paket saat ini</p>
            <h2>{plan?.name ?? 'Belum ada paket aktif'}</h2>
            <p>{platformMeta(snapshot.tenant.platform).label}</p>
          </div>
        </div>
        <div className={styles.billingAmount}>
          <span>Mulai dari</span>
          <strong>{plan ? formatRupiah(plan.priceMonthly) : '—'}</strong>
          <small>{plan ? '/ bulan' : 'Pilih paket dari Store'}</small>
        </div>
        <div className={styles.billingDates}>
          <div><span>Status</span><StatusPill status={snapshot.subscription?.status ?? snapshot.tenant.status} /></div>
          <div><span>Periode berakhir</span><strong>{formatDate(snapshot.subscription?.currentPeriodEnd)}</strong></div>
        </div>
        <div className={styles.buttonRow}>
          {canManageSubscription && !snapshot.isPreview ? (
            <button className={styles.primaryButton} type="submit" name="tenant_id" value={snapshot.tenant.id}>
              <CreditCard aria-hidden="true" /> Kelola langganan
            </button>
          ) : (
            <Link className={styles.primaryButton} href="/hub/store">
              <Store aria-hidden="true" /> Lihat paket
            </Link>
          )}
        </div>
      </form>

      {purchasePlans.length > 0 ? (
        <form action={submitHubFirstPurchase} className={styles.firstPurchaseForm} aria-labelledby="first-purchase-title">
          <h2 id="first-purchase-title">Mulai langganan</h2>
          <p>Pilih paket dan periode untuk akun {snapshot.tenant.name}. Harga diperiksa kembali sebelum pembayaran.</p>
          <input type="hidden" name="tenant_id" value={snapshot.tenant.id} />
          <label htmlFor="first-purchase-plan">Paket</label>
          <select id="first-purchase-plan" name="plan_id" required defaultValue={purchasePlans[0].id}>
            {purchasePlans.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {formatRupiah(item.priceMonthly)}/bulan · {formatRupiah(item.priceYearly)}/tahun
              </option>
            ))}
          </select>
          <label htmlFor="first-purchase-period">Periode</label>
          <select id="first-purchase-period" name="period" defaultValue="monthly">
            <option value="monthly">Bulanan</option>
            <option value="yearly">Tahunan</option>
          </select>
          <button className={styles.primaryButton} type="submit">Lanjutkan ke pembayaran</button>
        </form>
      ) : null}

      <section className={styles.sectionBlock}>
        <div className={styles.sectionTitleRow}>
          <div><p className={styles.sectionKicker}>Transaksi</p><h2>Riwayat tagihan</h2></div>
        </div>
        {!snapshot.invoiceAccessReady ? (
          <div className={styles.inlineNotice}><ShieldCheck aria-hidden="true" /><span>Riwayat tagihan sedang disiapkan untuk akses pelanggan.</span></div>
        ) : snapshot.invoices.length === 0 ? (
          <div className={styles.honestEmptyState}>
            <ReceiptText aria-hidden="true" />
            <div><h3>Belum ada tagihan</h3><p>Transaksi pembayaran Anda akan muncul di sini.</p></div>
          </div>
        ) : (
          <div className={styles.invoiceList}>
            <table className={styles.invoiceTable}>
              <thead>
                <tr><th>Tanggal</th><th>Nomor</th><th>Periode</th><th>Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {snapshot.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td data-label="Tanggal">{formatDate(invoice.paidAt ?? invoice.createdAt)}</td>
                    <td data-label="Nomor">{invoice.orderId ?? invoice.id.slice(0, 8)}</td>
                    <td data-label="Periode">{invoice.period === 'yearly' ? 'Tahunan' : 'Bulanan'}</td>
                    <td data-label="Total"><strong>{formatRupiah(invoice.amount)}</strong></td>
                    <td data-label="Status"><StatusPill status={invoice.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function SupportView({ snapshot }: { snapshot: HubCustomerSnapshot }) {
  const whatsapp = `https://wa.me/6281296917963?text=${encodeURIComponent(`Halo Webzoka, saya butuh bantuan untuk akun ${snapshot.tenant.name}.`)}`
  return <>
    <PageHeading eyebrow="Bantuan" title="Kami siap membantu." description="Untuk kendala akses sistem, akun, atau langganan Webzoka Anda." />
    {snapshot.isPreview ? <PreviewNotice /> : null}
    <section className={styles.supportGrid}>
      <article className={styles.supportPrimary}><span className={styles.supportIcon}><MessageCircle aria-hidden="true" /></span><h2>WhatsApp Webzoka</h2><p>Sertakan nama usaha, sistem terkait, dan ringkasan kendala agar tim dapat memahami kebutuhan Anda.</p><a className={styles.secondaryButton} href={whatsapp} target="_blank" rel="noopener noreferrer">Buka WhatsApp<span className={styles.srOnly}> — membuka tab baru</span></a></article>
      <article className={styles.supportSecondary}><h2>Informasi untuk disertakan</h2><dl className={styles.supportFacts}><div><dt>Akun bisnis</dt><dd>{snapshot.tenant.name}</dd></div><div><dt>Sistem terkait</dt><dd>{platformMeta(snapshot.tenant.platform).label}</dd></div><div><dt>ID pelanggan</dt><dd>{snapshot.tenant.slug}</dd></div><div><dt>Email akun</dt><dd>{snapshot.user.email || 'Belum tersedia'}</dd></div></dl><p>Jangan membagikan kata sandi atau kode verifikasi melalui percakapan.</p></article>
    </section>
    <section className={styles.sectionBlock}><h2>Pertanyaan umum</h2><div className={styles.faq}><details><summary>Mengapa sistem saya belum muncul?</summary><p>Sistem ditampilkan berdasarkan keanggotaan akun. Hubungi bantuan bila akun belum terhubung sebagaimana mestinya.</p></details><details><summary>Apakah workspace berarti sudah berlangganan?</summary><p>Tidak. Pembuatan workspace tidak otomatis memulai trial, tagihan, atau pembayaran produk.</p></details><details><summary>Di mana saya melihat transaksi layanan?</summary><p>Buka menu Tagihan untuk melihat paket dan riwayat yang tersedia bagi akun Anda. Jika akses belum tersedia, hubungi tim Webzoka.</p></details></div><p className={styles.guideNote}>Panduan terpusat dan pelacakan tiket belum tersedia.</p></section>
  </>
}

export function HubShell({
  snapshot,
  inventory,
  view,
  canManageSubscription = false,
  firstPurchaseTenant = null,
  purchaseFailed = false,
}: {
  snapshot: HubCustomerSnapshot
  inventory: HubSystemsInventory | null
  view: HubView
  canManageSubscription?: boolean
  firstPurchaseTenant?: HubFirstPurchaseTenant | null
  purchaseFailed?: boolean
}) {
  const inventoryView = view === 'home' || view === 'systems'
  const snapshotMatchesInventory = inventory?.accessReady === true &&
    inventory.systems.some((system) => system.tenant.id === snapshot.tenant.id)
  const accountTenant = inventoryView && !snapshotMatchesInventory ? null : snapshot.tenant
  const accountName = accountTenant?.name ?? 'Akun Webzoka'
  const initials = accountTenant?.name.trim().charAt(0).toUpperCase() || 'W'

  return (
    <div className={styles.hubShell}>
      <a className={styles.skipLink} href="#hub-main">Lewati ke konten utama</a>
      <HubNavigation label="Customer Hub" home="/hub" items={NAV} current={view} footer={<div><div className={styles.sidebarAccount}><span className={styles.avatar}>{initials}</span><span><strong>{accountName}</strong><small>{snapshot.user.email || 'Akun pelanggan'}</small></span></div><form action={logoutFromHub}><button className={styles.logoutButton} type="submit"><LogOut aria-hidden="true" /> Keluar</button></form></div>} />
      <header className={styles.topbar}><p>Customer Hub <strong>{NAV.find(item => item.id === view)?.label}</strong></p><span className={styles.avatar} aria-label={accountName}>{initials}</span></header>

      <main className={styles.hubMain} id="hub-main" tabIndex={-1}>
        <div className={styles.contentWrap}>
          {view === 'home' ? <HomeView snapshot={snapshotMatchesInventory ? snapshot : null} inventory={inventory} /> : null}
          {view === 'systems' ? <SystemsView inventory={inventory} /> : null}
          {view === 'billing' ? <BillingView snapshot={snapshot} canManageSubscription={canManageSubscription} firstPurchaseTenant={firstPurchaseTenant} purchaseFailed={purchaseFailed} /> : null}
          {view === 'support' ? <SupportView snapshot={snapshot} /> : null}
        </div>
      </main>


    </div>
  )
}
