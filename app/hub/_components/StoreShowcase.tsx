import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ExternalLink,
  Globe2,
  LayoutTemplate,
  MessageCircle,
  Sparkles,
} from 'lucide-react'
import styles from '../hub.module.css'
import type { StockPlanChoice } from '@/lib/customer-onboarding'
import { PORTFOLIO_CLIENTS, type PortfolioClient } from '../_public/public-content'

type TemplatePreview = {
  name: string
  category: string
  description: string
  visual: 'restaurant' | 'healthcare' | 'education'
}

const TEMPLATE_PREVIEWS: TemplatePreview[] = [
  {
    name: 'Toko & Kuliner',
    category: 'Restaurant / F&B',
    description: 'Menu, pesanan, dan alur operasional yang terasa siap dipakai.',
    visual: 'restaurant',
  },
  {
    name: 'Klinik & Layanan',
    category: 'Healthcare',
    description: 'Struktur layanan yang tenang, jelas, dan membuat calon pasien yakin.',
    visual: 'healthcare',
  },
  {
    name: 'Kelas & Kursus',
    category: 'Education',
    description: 'Landing page, pendaftaran, dan pengalaman belajar yang saling terhubung.',
    visual: 'education',
  },
]

const clientVisualClass: Record<PortfolioClient['visual'], string> = {
  arena: styles.clientShowcaseVisualArena,
  bakso: styles.clientShowcaseVisualBakso,
  kamy: styles.clientShowcaseVisualKamy,
}

const templateVisualClass: Record<TemplatePreview['visual'], string> = {
  restaurant: styles.templatePreviewArtRestaurant,
  healthcare: styles.templatePreviewArtHealthcare,
  education: styles.templatePreviewArtEducation,
}

export function ClientPreviewVisual({ client }: { client: PortfolioClient }) {
  return (
    <div className={`${styles.clientShowcaseVisual} ${clientVisualClass[client.visual]}`} aria-hidden="true">
      <div className={styles.clientShowcaseBrowser}>
        <div className={styles.clientShowcaseBrowserTop}>
          <span />
          <span />
          <span />
          <small>{client.website}</small>
        </div>
        <div className={styles.clientShowcaseWindow}>
          <div className={styles.clientShowcaseWindowMark} />
          <div className={styles.clientShowcaseWindowNav}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.clientShowcaseWindowBody}>
            <div className={styles.clientShowcaseWindowCopy}>
              <i />
              <b />
              <b />
              <em />
            </div>
            <div className={styles.clientShowcaseWindowPanel}>
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
      <span className={styles.clientShowcaseFloat}>{client.industry}</span>
    </div>
  )
}

function TemplatePreviewArt({ template }: { template: TemplatePreview }) {
  return (
    <div className={`${styles.templatePreviewArt} ${templateVisualClass[template.visual]}`} aria-hidden="true">
      <div className={styles.templatePreviewArtGrid}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.templatePreviewArtBadge}>
        <LayoutTemplate aria-hidden="true" />
        Template
      </div>
    </div>
  )
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

const PLAN_FALLBACKS: Record<StockPlanChoice['tier'], string[]> = {
  starter: ['Pencatatan stok & produk', 'Pesanan operasional', 'Laporan inti'],
  pro: ['Semua fitur Starter', 'Produksi & supplier', 'Laporan operasional lengkap'],
  enterprise: ['Semua fitur Growth', 'Tim lebih besar', 'Pendampingan prioritas'],
}

export function StoreShowcase({ plans = [] }: { plans?: StockPlanChoice[] }) {
  return (
    <>
      <section className={styles.showcaseHero} aria-labelledby="store-title">
        <div className={styles.showcaseHeroCopy}>
          <p className={styles.eyebrow}>Webzoka Store</p>
          <h1 id="store-title">Temukan bentuk digital yang pas untuk bisnis Anda.</h1>
          <p>
            Lihat proyek nyata Webzoka, lalu temukan template yang bisa menjadi titik awal untuk membangun pengalaman bisnis Anda.
          </p>
          <div className={styles.showcaseActionRow}>
            <a className={styles.showcasePrimaryButton} href="#stock-packages">
              Mulai trial Stock <ArrowRight aria-hidden="true" />
            </a>
            <a
              className={styles.showcaseSecondaryButton}
              href="#client-showcase"
            >
              Lihat proyek klien <ArrowRight aria-hidden="true" />
            </a>
          </div>
          <div className={styles.showcaseHeroSignals} aria-label="Keunggulan Webzoka">
            <span><Check aria-hidden="true" /> Proyek nyata</span>
            <span><Check aria-hidden="true" /> Sistem terhubung</span>
            <span><Check aria-hidden="true" /> Dibangun bertahap</span>
          </div>
        </div>
        <div className={styles.showcaseHeroVisual} aria-hidden="true">
          <div className={styles.showcaseHeroOrb} />
          <div className={styles.showcaseHeroPanel}>
            <div className={styles.showcaseHeroPanelTop}>
              <span className={styles.showcaseHeroPanelIcon}><Sparkles /></span>
              <span><small>Webzoka ecosystem</small><strong>One clear digital home</strong></span>
            </div>
            <div className={styles.showcaseHeroStack}>
              <span><Globe2 /> Website</span>
              <span><Boxes /> Operations</span>
              <span><LayoutTemplate /> Templates</span>
            </div>
            <div className={styles.showcaseHeroPulse}><i /><span>Built for your next chapter</span></div>
          </div>
          <span className={styles.showcaseHeroLabel}>Preview catalog</span>
        </div>
      </section>

      <section className={styles.stockPlansSection} id="stock-packages" aria-labelledby="stock-packages-title">
        <div className={styles.stockPlansHeading}>
          <div>
            <p className={styles.sectionKicker}>Webzoka Stock</p>
            <h2 id="stock-packages-title">Mulai 14 hari. Pilih paket untuk langkah berikutnya.</h2>
          </div>
          <div className={styles.stockTrialNote}>
            <Sparkles aria-hidden="true" />
            <span><strong>Semua fitur Pro selama trial</strong><small>Tanpa kartu kredit. Tidak ada pembayaran saat mendaftar.</small></span>
          </div>
        </div>
        {plans.length > 0 ? (
          <div className={styles.stockPlanGrid}>
            {plans.map((plan) => {
              const featured = plan.tier === 'pro'
              const features = plan.features.length > 0 ? plan.features.slice(0, 5) : PLAN_FALLBACKS[plan.tier]
              return (
                <article className={`${styles.stockPlanCard} ${featured ? styles.stockPlanCardFeatured : ''}`} key={plan.id}>
                  <div className={styles.stockPlanTop}>
                    <span>{featured ? 'Paling populer' : 'Webzoka Stock'}</span>
                    <h3>{plan.name}</h3>
                    <p><strong>{formatRupiah(plan.priceMonthly)}</strong><small>/bulan setelah trial</small></p>
                  </div>
                  <ul>
                    {features.map((feature) => <li key={feature}><Check aria-hidden="true" /> {feature}</li>)}
                  </ul>
                  <Link className={featured ? styles.stockPlanPrimary : styles.stockPlanSecondary} href={`/hub/onboarding/stock?tier=${plan.tier}`}>
                    Mulai trial gratis <ArrowRight aria-hidden="true" />
                  </Link>
                </article>
              )
            })}
          </div>
        ) : (
          <div className={styles.stockPlansUnavailable}>
            Paket belum dapat dimuat. Hubungi tim Webzoka untuk memulai trial Stock.
          </div>
        )}
        <p className={styles.stockPlansFootnote}>Paket yang dipilih disimpan untuk billing setelah trial. Anda tidak ditagih otomatis.</p>
      </section>

      <section className={styles.showcaseSection} id="client-showcase" aria-labelledby="client-showcase-title">
        <div className={styles.showcaseSectionHeading}>
          <div>
            <p className={styles.sectionKicker}>Built with Webzoka</p>
            <h2 id="client-showcase-title">Dipakai bisnis nyata</h2>
          </div>
          <div className={styles.showcaseSectionAside}>
            <p>Dari kelas bahasa Jepang sampai operasi restoran, setiap bisnis mendapat fondasi digital yang sesuai kebutuhannya.</p>
            <Link className={styles.showcaseInlineLink} href="/hub/portofolio">
              Lihat portofolio lengkap <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className={styles.clientShowcaseGrid}>
          {PORTFOLIO_CLIENTS.map((client) => (
            <article
              className={`${styles.clientShowcaseCard} ${client.featured ? styles.clientShowcaseCardFeatured : ''}`}
              key={client.name}
            >
              <ClientPreviewVisual client={client} />
              <div className={styles.clientShowcaseCardBody}>
                <div className={styles.clientShowcaseMeta}>
                  <span>{client.industry}</span>
                  <ArrowUpRight aria-hidden="true" />
                </div>
                <h3>{client.name}</h3>
                <p>{client.description}</p>
                <div className={styles.clientShowcaseTags} aria-label={`Produk Webzoka untuk ${client.name}`}>
                  {client.products.map((product) => <span key={product}>{product}</span>)}
                </div>
                <a className={styles.clientShowcaseLink} href={client.href} target="_blank" rel="noreferrer">
                  Lihat {client.website} <ExternalLink aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.templatePreview} aria-labelledby="template-preview-title">
        <div className={styles.showcaseSectionHeading}>
          <div>
            <p className={styles.sectionKicker}>Store berikutnya</p>
            <h2 id="template-preview-title">Pilih arah. Kami bantu membangunnya.</h2>
          </div>
          <span className={styles.templateStatus}><Sparkles aria-hidden="true" /> Segera hadir</span>
        </div>
        <p className={styles.templatePreviewIntro}>
          Koleksi template Webzoka sedang disiapkan. Anda akan dapat melihat struktur, gaya, dan sistem yang paling dekat dengan bisnis Anda sebelum mulai.
        </p>
        <div className={styles.templateGrid}>
          {TEMPLATE_PREVIEWS.map((template) => (
            <article className={styles.templateCard} key={template.name}>
              <TemplatePreviewArt template={template} />
              <div className={styles.templateCardBody}>
                <span>{template.category}</span>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
                <span className={styles.templateCardStatus}>Preview segera tersedia</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.storeCtaPanel} aria-label="Mulai bersama Webzoka">
        <div>
          <p className={styles.sectionKicker}>Langkah berikutnya</p>
          <h2>Siap melihat versi bisnis Anda?</h2>
          <p>Bagikan kebutuhan Anda. Kami bantu memilih fondasi yang paling masuk akal untuk mulai.</p>
        </div>
        <a
          className={styles.showcasePrimaryButton}
          href="https://wa.me/6281296917963?text=Halo%20Webzoka%2C%20saya%20ingin%20membahas%20kebutuhan%20bisnis%20saya."
          target="_blank"
          rel="noreferrer"
        >
          Konsultasi dengan tim <MessageCircle aria-hidden="true" />
        </a>
      </section>
    </>
  )
}
