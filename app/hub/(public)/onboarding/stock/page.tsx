import type { Metadata } from 'next'
import { BadgeCheck, Boxes, ShieldCheck } from 'lucide-react'
import { getPublicStockPlans } from '@/lib/customer-onboarding'
import { StockOnboardingForm } from './StockOnboardingForm'
import styles from '../../../onboarding/onboarding.module.css'

export const metadata: Metadata = {
  title: 'Mulai Trial Webzoka Stock | Customer Hub',
  description: 'Buat akun bisnis Webzoka dan mulai trial Stock selama 14 hari tanpa pembayaran.',
}

export default async function StockOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>
}) {
  const [{ tier }, plans] = await Promise.all([searchParams, getPublicStockPlans()])
  const selectedPlan = plans.find((plan) => plan.tier === tier) ?? plans[0]

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.intro} aria-labelledby="onboarding-title">
          <p className={styles.eyebrow}>Webzoka Stock</p>
          <h1 id="onboarding-title">Operasional bisnis siap dalam satu akun.</h1>
          <p>Daftar sekali. Setelah email terverifikasi, Customer Hub dan Webzoka Stock disiapkan untuk bisnis Anda.</p>

          <div className={styles.steps} aria-label="Tahapan aktivasi">
            <div className={styles.step}>
              <span className={styles.stepIcon}><BadgeCheck aria-hidden="true" /></span>
              <div><strong>1. Verifikasi email</strong><span>Pastikan akun memakai email yang Anda kelola.</span></div>
            </div>
            <div className={styles.step}>
              <span className={styles.stepIcon}><Boxes aria-hidden="true" /></span>
              <div><strong>2. Stock disiapkan</strong><span>Bisnis, admin, dan trial dibuat otomatis.</span></div>
            </div>
            <div className={styles.step}>
              <span className={styles.stepIcon}><ShieldCheck aria-hidden="true" /></span>
              <div><strong>3. Masuk dengan SSO</strong><span>Buka Stock dari Hub tanpa akun ganda.</span></div>
            </div>
          </div>

          <div className={styles.trustNote}>
            <ShieldCheck aria-hidden="true" />
            <span>Core menyimpan identitas dan langganan. Stock menyimpan data operasional. Akses antar-sistem memakai token singkat dan ditandatangani.</span>
          </div>
        </section>

        <StockOnboardingForm
          plans={plans}
          selectedPlanId={selectedPlan?.id}
          turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        />
      </div>
    </div>
  )
}
