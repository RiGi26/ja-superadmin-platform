import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock3, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getLatestOnboardingForUser, getOnboardingStatus } from '@/lib/customer-onboarding'
import { retryStockProvisioningAction } from '../actions'
import { StatusAutoRefresh } from './StatusAutoRefresh'
import styles from '../onboarding.module.css'

const STATUS_COPY = {
  pending_verification: { label: 'Menunggu verifikasi email', title: 'Periksa email Anda', description: 'Akun belum aktif dan trial belum dimulai.', icon: Clock3 },
  provisioning: { label: 'Sedang disiapkan', title: 'Stock sedang kami siapkan', description: 'Akun Core sudah aktif. Workspace Stock diproses aman di belakang layar.', icon: Clock3 },
  portal_failed: { label: 'Perlu dicoba kembali', title: 'Setup Stock tertunda', description: 'Akun Hub tetap aman. Anda dapat menjalankan ulang setup tanpa membuat akun ganda.', icon: ShieldAlert },
  needs_attention: { label: 'Tim Webzoka memeriksa', title: 'Setup membutuhkan bantuan', description: 'Data Core tetap tersimpan dan tidak akan dibuat ulang.', icon: ShieldAlert },
  ready: { label: 'Siap digunakan', title: 'Webzoka Stock sudah aktif', description: 'Buka Stock dari Customer Hub dengan satu login Webzoka.', icon: CheckCircle2 },
  cancelled: { label: 'Dibatalkan', title: 'Pendaftaran tidak dilanjutkan', description: 'Hubungi tim Webzoka jika Anda ingin memulai kembali.', icon: ShieldAlert },
} as const

export const dynamic = 'force-dynamic'

export default async function OnboardingStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; retry?: string; activation?: string }>
}) {
  const db = await createClient()
  const { data } = await db.auth.getClaims()
  const ownerUserId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!ownerUserId) redirect('/hub/login')

  const params = await searchParams
  const onboarding = params.request
    ? await getOnboardingStatus(params.request, ownerUserId)
    : await getLatestOnboardingForUser(ownerUserId)
  if (!onboarding) redirect('/hub')

  const copy = STATUS_COPY[onboarding.status]
  const Icon = copy.icon
  const processing = onboarding.status === 'provisioning'
  const progressIndex = onboarding.status === 'pending_verification'
    ? 0
    : !onboarding.coreReady
      ? 1
      : onboarding.status === 'ready'
        ? 3
        : 2

  return (
    <main className={styles.statusPage}>
      <StatusAutoRefresh active={processing} />
      <div className={styles.statusWrap}>
        <header className={styles.statusHeader}>
          <p className={styles.eyebrow}>Aktivasi Webzoka Stock</p>
          <h1>Status setup bisnis Anda</h1>
          <p>Proses ini aman untuk ditutup dan dibuka kembali. Kami menyimpan setiap tahap agar tidak ada akun ganda.</p>
        </header>

        <section className={styles.statusCard} aria-live="polite">
          <div className={styles.statusTop}>
            <span className={styles.statusIcon}><Icon aria-hidden="true" /></span>
            <div>
              <h2>{copy.title}</h2>
              <p>{copy.description}</p>
              <span className={styles.statusBadge}>{copy.label}</span>
            </div>
          </div>

          <dl className={styles.statusDetails}>
            <div><dt>Bisnis</dt><dd>{onboarding.businessName}</dd></div>
            <div><dt>Paket setelah trial</dt><dd>{onboarding.planName}</dd></div>
            <div><dt>Email akun</dt><dd>{onboarding.ownerEmail}</dd></div>
          </dl>

          <div className={styles.progress} aria-label="Progres aktivasi">
            {['Email terverifikasi', 'Akun Core aktif', 'Stock disiapkan'].map((label, index) => (
              <div className={`${styles.progressItem} ${progressIndex > index ? styles.progressDone : progressIndex === index ? styles.progressActive : ''}`} key={label}>
                <strong>{index + 1}. {label}</strong>
                {progressIndex > index ? 'Selesai' : progressIndex === index ? 'Sedang berjalan' : 'Menunggu'}
              </div>
            ))}
          </div>

          {onboarding.safeError ? <p className={styles.alert}>{onboarding.safeError}</p> : null}
          {params.activation === 'failed' ? <p className={styles.alert}>Email sudah terverifikasi, tetapi aktivasi perlu dicoba kembali. Akun Anda tidak hilang.</p> : null}
          {params.retry === '1' ? <p className={styles.success}>Permintaan ulang diterima. Status akan diperbarui otomatis.</p> : null}

          <div className={styles.buttonRow}>
            {onboarding.status === 'ready' ? (
              <Link className={styles.primaryLink} href="/hub?view=systems">
                Buka Customer Hub <ExternalLink aria-hidden="true" />
              </Link>
            ) : null}
            {onboarding.canRetry ? (
              <form action={retryStockProvisioningAction}>
                <input type="hidden" name="request_id" value={onboarding.id} />
                <button className={styles.submitButton} type="submit"><RefreshCw aria-hidden="true" /> Coba setup Stock lagi</button>
              </form>
            ) : null}
            <Link className={styles.secondaryLink} href={`/hub/onboarding/status?request=${encodeURIComponent(onboarding.id)}`}>
              Perbarui status
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
