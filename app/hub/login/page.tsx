import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Headset, LayoutGrid, ReceiptText, UserRound } from 'lucide-react'
import { GOOGLE_DEV_PATH, googleDevConfig, googleDevLocalHeaders } from '@/lib/google-oauth-dev'
import { createClient } from '@/lib/supabase/server'
import { safeHubReturnPath } from '@/lib/hub-return-path'
import { HubLoginForm } from './HubLoginForm'
import styles from './login.module.css'

export default async function HubLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string }>
}) {
  const query = await searchParams
  const next = safeHubReturnPath(query.next)

  if (process.env.NODE_ENV !== 'production' && process.env.HUB_PREVIEW_MODE === 'true') {
    redirect('/hub')
  }

  const db = await createClient()
  const { data } = await db.auth.getClaims()
  let invalidSession = false
  if (data?.claims?.sub) {
    const identity = await db.auth.getUser().catch(() => null)
    const user = identity?.data.user
    if (!identity?.error && user?.email && user.email_confirmed_at && !user.is_anonymous && user.id === data.claims.sub) {
      redirect(next ?? (data.claims.user_role === 'superadmin' ? '/dashboard' : '/hub/account'))
    }
    invalidSession = true
  }

  return (
    <div className={styles.page} lang="id">
      <a className={styles.skipLink} href="#hub-login">Langsung ke formulir masuk</a>
      <header className={styles.header}>
        <a className={styles.brand} href="https://www.webzoka.com" aria-label="Beranda Webzoka">
          <Image src="/logo-rocket.png" alt="" width={44} height={44} priority unoptimized />
          <span className={styles.wordmark} translate="no">webzoka</span>
        </a>
        <nav aria-label="Navigasi publik">
          <Link className={styles.storeLink} href="/hub/store">
            Jelajahi Store
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.layout}>
          <section className={styles.formPanel} aria-labelledby="hub-login-title">
            <p className={styles.context}><UserRound aria-hidden="true" /> Akun Webzoka</p>
            <h1 id="hub-login-title" className={styles.title}>Masuk ke<br />Customer Hub</h1>
            <p className={styles.intro}>
              Gunakan akun Webzoka Anda untuk mengakses layanan bisnis yang terhubung.
            </p>
            {query.message === 'password_updated' ? (
              <p className={styles.formSuccess} role="status" aria-live="polite">
                Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.
              </p>
            ) : null}
            {invalidSession ? (
              <p className={styles.formError} role="alert">
                Sesi belum dapat diverifikasi. Verifikasi email Anda atau masuk kembali.
              </p>
            ) : null}
            <HubLoginForm next={next} />
            {!next && googleDevConfig(process.env) && googleDevLocalHeaders(await headers()) ? (
              <form method="post" action={`${GOOGLE_DEV_PATH}/start`} className={styles.devForm}>
                <button type="submit" className={styles.secondaryButton}>
                  Masuk dengan Google (uji lokal)
                </button>
                <p className={styles.returnHint}>Sesi uji ini belum memberikan akses perusahaan.</p>
              </form>
            ) : null}
            {query.message === 'google_dev_failed' ? (
              <p className={styles.formError} role="alert">
                Sesi Google belum dapat diverifikasi. Mulai kembali melalui tombol Google.
              </p>
            ) : null}
            <p className={styles.signup}>
              Belum punya akun? <Link href="/hub/signup">Buat akun</Link>
            </p>
          </section>

          <aside className={styles.storyPanel} aria-labelledby="hub-story-title">
            <p className={styles.storyContext}><span aria-hidden="true" />Ruang pelanggan Webzoka</p>
            <h2 id="hub-story-title" className={styles.storyTitle}>Urus layanan bisnis,<br />dari satu tempat.</h2>
            <p className={styles.storyIntro}>
              Buka sistem Anda, periksa langganan, dan dapatkan bantuan lewat Customer Hub.
            </p>
            <div className={styles.hubMap} role="img" aria-label="Satu akun Webzoka menghubungkan sistem bisnis, tagihan, dan bantuan.">
              <div className={styles.mapAccount}><UserRound aria-hidden="true" />Akun Webzoka Anda</div>
              <div className={styles.mapStructure}>
                <svg className={styles.mapConnectors} viewBox="0 0 360 32" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M180 0v14M57.33 14h245.34M57.33 14v18M180 14v18M302.67 14v18" />
                </svg>
                <div className={styles.mapDestinations}>
                  <span>Sistem bisnis</span><span>Tagihan</span><span>Bantuan</span>
                </div>
              </div>
            </div>
            <ul className={styles.benefits}>
              <li><LayoutGrid aria-hidden="true" /><div><strong>Sistem bisnis Anda</strong><p>Buka layanan yang terhubung ke akun Anda.</p></div></li>
              <li><ReceiptText aria-hidden="true" /><div><strong>Tagihan &amp; langganan</strong><p>Lihat paket dan status pembayaran Anda.</p></div></li>
              <li><Headset aria-hidden="true" /><div><strong>Bantuan Webzoka</strong><p>Hubungi tim kami saat membutuhkan bantuan.</p></div></li>
            </ul>
          </aside>
        </div>
        <footer className={styles.footer}>
          <p>© {new Date().getFullYear()} Webzoka</p>
          <a href="https://www.webzoka.com/privacy/">Kebijakan privasi</a>
        </footer>
      </main>
    </div>
  )
}
