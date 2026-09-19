import Image from 'next/image'
import { HubAuthStory } from '../_components/HubAuthStory'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import styles from '../hub.module.css'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const query = await searchParams

  return (
    <main className={styles.loginPage}>
      <HubAuthStory
        title="Pulihkan akses tanpa membagikan kata sandi."
        description="Webzoka mengirim tautan pribadi ke email akun Anda. Tautan tersebut hanya berlaku untuk pengaturan kata sandi."
      />
      <section className={styles.loginPanel}>
        <div className={styles.loginCard}>
          <div className={styles.mobileLoginBrand}>
            <Image src="/logo-rocket.png" alt="" width={38} height={35} priority unoptimized />
            <span translate="no">webzoka</span>
          </div>
          <p className={styles.eyebrow}>Keamanan akun</p>
          <h2>Atur kata sandi</h2>
          <p className={styles.loginIntro}>
            Masukkan email Customer Hub. Kami tidak akan menampilkan apakah email terdaftar.
          </p>
          {query.error === 'invalid_link' ? (
            <p className={styles.formError} role="alert">
              Tautan sudah tidak berlaku. Minta tautan baru di bawah ini.
            </p>
          ) : null}
          <ForgotPasswordForm />
        </div>
      </section>
    </main>
  )
}
