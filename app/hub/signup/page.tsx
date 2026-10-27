import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HubAuthStory } from '../_components/HubAuthStory'
import { HubSignupForm } from './HubSignupForm'
import styles from '../hub.module.css'
import signup from './signup.module.css'

export const metadata = { title: 'Buat Akun | Webzoka Customer Hub', referrer: 'no-referrer' as const, robots: { index: false, follow: false } }

export default async function HubSignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams
  const db = await createClient()
  const { data } = await db.auth.getClaims()
  if (data?.claims?.sub) redirect('/hub/account')

  return (
    <main className={styles.loginPage}>
      <HubAuthStory title="Mulai dari akun Webzoka Anda." description="Verifikasi email Anda, lalu buat workspace usaha melalui Customer Hub. Akun dan workspace tidak memerlukan langganan produk." />
      <section className={styles.loginPanel}>
        <nav className={styles.loginPanelNav} aria-label="Navigasi publik"><Link href="/hub/store">Store</Link></nav>
        <div className={styles.loginCard}>
          <div className={styles.mobileLoginBrand}><Image src="/logo-rocket.png" alt="" width={38} height={35} priority unoptimized /><span translate="no">webzoka</span></div>
          <p className={styles.eyebrow}>Akun pelanggan</p>
          <h1 className={signup.heading}>Buat akun gratis</h1>
          <p className={styles.loginIntro}>Gunakan email yang Anda kelola. Tautan verifikasi akan dikirim ke email tersebut.</p>
          <HubSignupForm verificationFailed={query.error === 'verification_failed'} />
          <p className={styles.loginHelp}>Sudah punya akun? <Link className={signup.link} href="/hub/login?next=%2Fhub%2Faccount">Masuk ke Customer Hub</Link></p>
        </div>
      </section>
    </main>
  )
}
