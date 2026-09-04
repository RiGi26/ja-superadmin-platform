import type { Metadata } from 'next'
import Link from 'next/link'
import { MailCheck, ShieldCheck } from 'lucide-react'
import { VerifyEmailForm } from './VerifyEmailForm'
import styles from '../../../onboarding/onboarding.module.css'

export const metadata: Metadata = {
  title: 'Verifikasi Akun | Webzoka Customer Hub',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function VerifyOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; token_hash?: string; type?: string }>
}) {
  const params = await searchParams
  const valid = Boolean(params.request && params.token_hash && ['signup', 'invite', 'magiclink'].includes(params.type ?? ''))

  return (
    <main className={styles.centerPage}>
      <section className={styles.centerCard} aria-labelledby="verify-title">
        <span className={styles.statusIcon}>
          {valid ? <MailCheck aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
        </span>
        <p className={styles.eyebrow}>Verifikasi aman</p>
        <h1 id="verify-title">{valid ? 'Konfirmasi aktivasi akun Anda' : 'Tautan tidak lengkap'}</h1>
        <p>
          {valid
            ? 'Klik tombol di bawah untuk memverifikasi email. Trial 14 hari baru dimulai setelah langkah ini selesai.'
            : 'Buka kembali tautan lengkap dari email Webzoka atau minta tim kami mengirim ulang undangan.'}
        </p>
        {valid ? (
          <div className={styles.verifyAction}>
            <VerifyEmailForm requestId={params.request!} tokenHash={params.token_hash!} type={params.type!} />
          </div>
        ) : (
          <div className={styles.buttonRow}>
            <Link className={styles.secondaryLink} href="/hub/store">Kembali ke Webzoka Store</Link>
          </div>
        )}
        <p className={styles.finePrint}>Tombol ini mencegah pemindai email mengaktifkan akun tanpa persetujuan Anda.</p>
      </section>
    </main>
  )
}
