import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ExternalLink,
  Globe2,
  HandCoins,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import { ClientPreviewVisual } from '../_components/StoreShowcase'
import {
  COMMITMENTS,
  FAQ_ITEMS,
  PORTFOLIO_CLIENTS,
  PUBLIC_ARTICLES,
  type Commitment,
  type PublicArticle,
} from './public-content'
import styles from './public-hub.module.css'
import hubStyles from '../hub.module.css'

const COMMITMENT_ICONS: Record<Commitment['visual'], typeof ShieldCheck> = {
  honest: HandCoins,
  proof: BadgeCheck,
  local: MapPin,
  care: ShieldCheck,
}

export function PublicPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <header className={styles.publicPageHeader}>
      <p className={styles.publicEyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}

function PublicCta({ title, description }: { title: string; description: string }) {
  return (
    <section className={styles.publicCta} aria-label="Mulai bersama Webzoka">
      <div>
        <p className={styles.publicEyebrow}>Langkah berikutnya</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <Link className={styles.publicPrimaryButton} href="/hub">
        Buka Customer Hub <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  )
}

export function PortfolioPageContent() {
  return (
    <>
      <PublicPageHeader
        eyebrow="Portofolio Webzoka"
        title="Sistem digital yang sudah dipakai bisnis nyata."
        description="Lihat bagaimana fondasi website dan portal disusun mengikuti cara kerja bisnis, bukan dipaksa masuk ke template yang sama."
      />
      <section className={styles.portfolioGrid} aria-label="Portofolio klien Webzoka">
        {PORTFOLIO_CLIENTS.map((client) => (
          <article
            className={`${hubStyles.clientShowcaseCard} ${client.featured ? hubStyles.clientShowcaseCardFeatured : ''} ${styles.portfolioCard}`}
            key={client.name}
          >
            <ClientPreviewVisual client={client} />
            <div className={hubStyles.clientShowcaseCardBody}>
              <div className={hubStyles.clientShowcaseMeta}>
                <span>{client.industry}</span>
                <ArrowRight aria-hidden="true" />
              </div>
              <h2>{client.name}</h2>
              <p>{client.description}</p>
              <p className={styles.portfolioDetail}>{client.detail}</p>
              <div className={hubStyles.clientShowcaseTags} aria-label={`Produk Webzoka untuk ${client.name}`}>
                {client.products.map((product) => <span key={product}>{product}</span>)}
              </div>
              <a className={hubStyles.clientShowcaseLink} href={client.href} target="_blank" rel="noreferrer">
                Lihat {client.website} <ExternalLink aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </section>
      <PublicCta
        title="Punya kebutuhan yang mirip?"
        description="Ceritakan alur bisnis Anda. Kami bantu memilih website, portal, atau kombinasi yang paling masuk akal."
      />
    </>
  )
}

export function ArticlesPageContent() {
  return (
    <>
      <PublicPageHeader
        eyebrow="Artikel Webzoka"
        title="Panduan singkat untuk mengambil keputusan digital."
        description="Bacaan praktis tentang website, portal, dan cara membangun sistem bisnis secara bertahap."
      />
      <section className={styles.articleGrid} aria-label="Daftar artikel Webzoka">
        {PUBLIC_ARTICLES.map((article) => (
          <article className={styles.articleCard} key={article.slug}>
            <div className={styles.articleCardTop}>
              <span>{article.category}</span>
              <span className={styles.articleReadLabel}>Bacaan Webzoka</span>
            </div>
            <h2>{article.title}</h2>
            <p>{article.excerpt}</p>
            <Link className={styles.publicTextLink} href={`/hub/artikel/${article.slug}`}>
              Baca artikel <ArrowRight aria-hidden="true" />
            </Link>
          </article>
        ))}
      </section>
      <PublicCta
        title="Masih memetakan kebutuhan?"
        description="Gunakan artikel sebagai titik awal, lalu bawa pertanyaan yang paling penting ke tim Webzoka."
      />
    </>
  )
}

export function ArticlePageContent({ article }: { article: PublicArticle }) {
  return (
    <article className={styles.articleDetail}>
      <Link className={styles.publicBackLink} href="/hub/artikel">
        <ArrowLeft aria-hidden="true" /> Kembali ke Artikel
      </Link>
      <header className={styles.articleDetailHeader}>
        <p className={styles.publicEyebrow}>{article.category}</p>
        <h1>{article.title}</h1>
        <p>{article.intro}</p>
      </header>
      <div className={styles.articleDetailBody}>
        {article.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.bullets ? (
              <ul>
                {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      <PublicCta
        title="Ingin membahas kebutuhan Anda?"
        description="Tim Webzoka dapat membantu menerjemahkan kebutuhan bisnis menjadi langkah digital yang jelas."
      />
    </article>
  )
}

export function FaqPageContent() {
  return (
    <>
      <PublicPageHeader
        eyebrow="Pusat Jawaban"
        title="Pertanyaan penting, dijawab dengan jelas."
        description="Ringkasan cara kerja website, portal, Customer Hub, dan dukungan Webzoka."
      />
      <section className={styles.faqList} aria-label="Pertanyaan yang sering ditanya">
        {FAQ_ITEMS.map((item) => (
          <details className={styles.faqItem} key={item.question}>
            <summary>
              <span>{item.question}</span>
              <ArrowRight aria-hidden="true" />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
      <PublicCta
        title="Belum menemukan jawaban?"
        description="Sampaikan konteks bisnis Anda lewat WhatsApp supaya tim kami dapat menjawab dengan tepat."
      />
    </>
  )
}

export function CommitmentPageContent() {
  return (
    <>
      <PublicPageHeader
        eyebrow="Komitmen Kami"
        title="Cara kami bekerja sama dengan bisnis Anda."
        description="Webzoka dibangun untuk membantu bisnis Indonesia bertumbuh dengan fondasi digital yang jelas, terukur, dan dapat diperiksa."
      />
      <section className={styles.commitmentGrid} aria-label="Komitmen Webzoka">
        {COMMITMENTS.map((commitment, index) => {
          const Icon = COMMITMENT_ICONS[commitment.visual]
          return (
            <article className={`${styles.commitmentCard} ${index === 0 ? styles.commitmentCardFeatured : ''}`} key={commitment.title}>
              <span className={styles.commitmentIcon}><Icon aria-hidden="true" /></span>
              <p className={styles.publicEyebrow}>0{index + 1}</p>
              <h2>{commitment.title}</h2>
              <p>{commitment.description}</p>
              <ul>
                {commitment.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </article>
          )
        })}
      </section>
      <section className={styles.commitmentNote}>
        <div className={styles.commitmentNoteIcon}><Globe2 aria-hidden="true" /></div>
        <div>
          <p className={styles.publicEyebrow}>Ekspektasi kerja yang jelas</p>
          <h2>Mulai dari kebutuhan hari ini, bangun tahap berikutnya saat siap.</h2>
          <p>Ruang lingkup, bahan, timeline, dan perubahan besar dibicarakan bersama sebelum pekerjaan berjalan.</p>
        </div>
      </section>
      <PublicCta
        title="Mari mulai dari percakapan yang konkret."
        description="Ceritakan bisnis Anda dan bagian yang paling ingin dirapikan."
      />
    </>
  )
}
