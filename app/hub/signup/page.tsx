import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShieldCheck } from 'lucide-react'
import { HubSignupForm } from './HubSignupForm'
import styles from '../login/login.module.css'
import signup from './signup.module.css'

export const metadata = { title: 'Buat Akun | Webzoka Customer Hub', referrer: 'no-referrer' as const, robots: { index: false, follow: false } }

export default async function HubSignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams
  const db = await createClient()
  const { data } = await db.auth.getClaims()
  if (data?.claims?.sub) redirect('/hub/account')

  return (
    <div className={`${styles.page} ${signup.page}`} lang="id">
      <a className={styles.skipLink} href="#signup-name">Langsung ke formulir pendaftaran</a>
      <header className={`${styles.header} ${signup.header}`}>
        <a className={`${styles.brand} ${signup.brand}`} href="https://www.webzoka.com" aria-label="Beranda Webzoka">
          <Image src="/logo-rocket.png" alt="" width={44} height={44} priority unoptimized />
          <span className={`${styles.wordmark} ${signup.wordmark}`} translate="no">webzoka</span>
        </a>
        <nav aria-label="Navigasi publik"><Link className={`${styles.storeLink} ${signup.storeLink}`} href="/hub/store">Jelajahi Store</Link></nav>
      </header>
      <main className={styles.main}>
        <div className={styles.layout}>
          <section className={`${styles.formPanel} ${signup.formPanel}`} aria-labelledby="signup-title">
            <HubSignupForm verificationFailed={query.error === 'verification_failed'} />
          </section>
          <aside className={styles.storyPanel} aria-labelledby="signup-story-title">
            <p className={styles.storyContext}><span aria-hidden="true" />Ruang pelanggan Webzoka</p>
            <h2 className={styles.storyTitle} id="signup-story-title">Mulai dari satu akun,<br />untuk usaha Anda.</h2>
            <p className={styles.storyIntro}>Verifikasi email, lalu buat workspace usaha Anda. Pilih layanan saat Anda membutuhkannya.</p>
            <ol className={signup.journey}>
              <li><span className={signup.stepNumber} aria-hidden="true">01</span><div className={signup.stepCopy}><strong>Buat akun Webzoka</strong><p>Isi nama, email, dan kata sandi untuk akun Anda.</p></div></li>
              <li><span className={signup.stepNumber} aria-hidden="true">02</span><div className={signup.stepCopy}><strong>Verifikasi email Anda</strong><p>Buka tautan yang kami kirim ke email Anda di browser yang sama.</p></div></li>
              <li><span className={signup.stepNumber} aria-hidden="true">03</span><div className={signup.stepCopy}><strong>Siapkan workspace usaha</strong><p>Masuk ke Customer Hub untuk membuat ruang bagi usaha Anda.</p></div></li>
            </ol>
            <div className={signup.planNote}><ShieldCheck aria-hidden="true" /><div><strong>Mulai tanpa langganan produk</strong><p>Akun dan workspace tidak memerlukan langganan produk. Aktivasi layanan dilakukan terpisah sesuai kebutuhan usaha Anda.</p></div></div>
          </aside>
        </div>
        <footer className={styles.footer}><p>© {new Date().getFullYear()} Webzoka</p><a href="https://www.webzoka.com/privacy/">Kebijakan privasi</a></footer>
      </main>
    </div>
  )
}
