import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HubAuthStory } from '../_components/HubAuthStory'
import { UpdatePasswordForm } from './UpdatePasswordForm'
import styles from '../hub.module.css'

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>
}) {
  const { onboarding } = await searchParams
  const db = await createClient()
  const { data } = await db.auth.getClaims()
  if (!data?.claims?.sub) redirect('/hub/forgot-password?error=invalid_link')

  return (
    <main className={styles.loginPage}>
      <HubAuthStory
        title="Satu akun yang aman untuk setiap sistem Webzoka."
        description="Kata sandi baru disimpan oleh Webzoka Core. Portal Stock hanya menerima identitas terverifikasi, bukan kata sandi Anda."
      />
      <section className={styles.loginPanel}>
        <div className={styles.loginCard}>
          <div className={styles.mobileLoginBrand}>
            <Image src="/logo-rocket.png" alt="" width={38} height={35} priority unoptimized />
            <span translate="no">webzoka</span>
          </div>
          <p className={styles.eyebrow}>Keamanan akun</p>
          <h2>Buat kata sandi baru</h2>
          <p className={styles.loginIntro}>Setelah tersimpan, gunakan kata sandi ini untuk masuk ke Customer Hub.</p>
          <UpdatePasswordForm onboarding={onboarding} />
        </div>
      </section>
    </main>
  )
}
