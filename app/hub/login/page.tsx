import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { GOOGLE_DEV_PATH, googleDevConfig, googleDevLocalHeaders } from '@/lib/google-oauth-dev'
import { createClient } from '@/lib/supabase/server'
import { safeHubReturnPath } from '@/lib/hub-return-path'
import { HubAuthStory } from '../_components/HubAuthStory'
import { HubLoginForm } from './HubLoginForm'
import styles from '../hub.module.css'

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
  if (data?.claims?.sub) redirect(next ?? '/hub')

  return (
    <main className={styles.loginPage}>
      <HubAuthStory
        title="Satu tempat untuk seluruh sistem bisnis Anda."
        description="Lihat sistem aktif, kelola paket, periksa tagihan, dan hubungi tim Webzoka tanpa berpindah portal."
      />

      <section className={styles.loginPanel}>
        <nav className={styles.loginPanelNav} aria-label="Navigasi publik">
          <Link href="/hub/store">Store</Link>
        </nav>
        <div className={styles.loginCard}>
          <div className={styles.mobileLoginBrand}>
            <Image src="/logo-rocket.png" alt="" width={38} height={35} priority unoptimized />
            <span translate="no">webzoka</span>
          </div>
          <p className={styles.eyebrow}>Akun pelanggan</p>
          <h2>Selamat datang kembali</h2>
          <p className={styles.loginIntro}>
            Gunakan satu akun Webzoka untuk Customer Hub dan sistem bisnis Anda.
          </p>
          {query.message === 'password_updated' ? (
            <p className={styles.formSuccess} role="status" aria-live="polite">
              Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.
            </p>
          ) : null}
          <HubLoginForm next={next} />
          {!next && googleDevConfig(process.env) && googleDevLocalHeaders(await headers()) ? (
            <form method="post" action={`${GOOGLE_DEV_PATH}/start`} className="mt-4 grid gap-2">
              <button type="submit" className={`${styles.secondaryButton} w-full text-base!`}>
                Masuk dengan Google (uji lokal)
              </button>
              <p className={styles.loginIntro}>Sesi uji ini belum memberikan akses perusahaan.</p>
            </form>
          ) : null}
          {query.message === 'google_dev_failed' ? (
            <p className={styles.formError} role="alert">
              Sesi Google belum dapat diverifikasi. Mulai kembali melalui tombol Google.
            </p>
          ) : null}
          <p className={styles.loginHelp}>
            Belum menjadi pelanggan?{' '}
            <Link href="/hub/store">Jelajahi Webzoka Store</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
