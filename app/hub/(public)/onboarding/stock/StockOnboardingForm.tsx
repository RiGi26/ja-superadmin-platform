'use client'

import Script from 'next/script'
import { useActionState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react'
import type { StockPlanChoice } from '@/lib/customer-onboarding'
import { startStockTrialAction, type OnboardingActionState } from '../../../onboarding/actions'
import styles from '../../../onboarding/onboarding.module.css'

const initialState: OnboardingActionState = { status: 'idle', message: null }

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function StockOnboardingForm({
  plans,
  selectedPlanId,
  turnstileSiteKey,
}: {
  plans: StockPlanChoice[]
  selectedPlanId?: string
  turnstileSiteKey?: string
}) {
  const [state, formAction, pending] = useActionState(startStockTrialAction, initialState)

  if (state.status === 'success') {
    return (
      <section className={styles.formCard} aria-live="polite">
        <div className={styles.success}>
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Langkah pertama selesai.</strong>
            <div>{state.message}</div>
          </div>
        </div>
        <div className={styles.formHeader} style={{ marginTop: 24, marginBottom: 0 }}>
          <h2>Verifikasi email Anda</h2>
          <p>Trial belum dimulai. Setelah email terverifikasi, Webzoka membuat akun Hub dan menyiapkan Stock otomatis.</p>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.formCard} aria-labelledby="stock-form-title">
      <div className={styles.formHeader}>
        <h2 id="stock-form-title">Buat akun bisnis</h2>
        <p>Gunakan email aktif yang akan menjadi akun utama Customer Hub.</p>
      </div>
      <form action={formAction} className={styles.form}>
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div className={styles.field}>
          <label htmlFor="business_name">Nama bisnis</label>
          <input id="business_name" name="business_name" required minLength={2} maxLength={120} autoComplete="organization" placeholder="Contoh: Toko Maju Bersama" />
        </div>

        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="owner_name">Nama admin</label>
            <input id="owner_name" name="owner_name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Nama lengkap" />
          </div>
          <div className={styles.field}>
            <label htmlFor="owner_phone">WhatsApp aktif</label>
            <input id="owner_phone" name="owner_phone" type="tel" inputMode="tel" required minLength={8} maxLength={24} autoComplete="tel" placeholder="08xx xxxx xxxx" />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="owner_email">Email bisnis</label>
          <input id="owner_email" name="owner_email" type="email" required maxLength={254} autoComplete="email" placeholder="nama@bisnis.com" />
          <small>Link verifikasi dan akses Customer Hub dikirim ke email ini.</small>
        </div>

        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="password">Kata sandi Customer Hub</label>
            <input id="password" name="password" type="password" required minLength={12} maxLength={72} autoComplete="new-password" placeholder="Minimal 12 karakter" />
            <small>Gunakan kata sandi unik.</small>
          </div>
          <div className={styles.field}>
            <label htmlFor="password_confirmation">Ulangi kata sandi</label>
            <input id="password_confirmation" name="password_confirmation" type="password" required minLength={12} maxLength={72} autoComplete="new-password" placeholder="Ketik ulang kata sandi" />
            <small>Webzoka tidak pernah meminta kata sandi melalui email.</small>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="plan_id">Paket Stock setelah trial</label>
          <select id="plan_id" name="plan_id" required defaultValue={selectedPlanId ?? plans[0]?.id ?? ''}>
            {plans.map((plan) => (
              <option value={plan.id} key={plan.id}>
                {plan.name} · {formatRupiah(plan.priceMonthly)}/bulan
              </option>
            ))}
          </select>
          <small>Selama trial 14 hari, semua fitur Stock Pro terbuka. Tidak ada pembayaran saat mendaftar.</small>
        </div>

        <label className={styles.terms}>
          <input type="checkbox" name="terms" required />
          <span>Saya menyetujui pembuatan akun Webzoka dan menerima informasi aktivasi melalui email atau WhatsApp.</span>
        </label>

        {turnstileSiteKey ? (
          <>
            <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
            <div className={styles.turnstile}>
              <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="light" />
            </div>
          </>
        ) : null}

        {state.status === 'error' ? (
          <div className={styles.alert} role="alert">
            <AlertCircle aria-hidden="true" /> {state.message}
          </div>
        ) : null}

        <button className={styles.submitButton} type="submit" disabled={pending || plans.length === 0}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {pending ? 'Mengamankan pendaftaran…' : 'Mulai trial Stock gratis'}
        </button>
        <p className={styles.finePrint}>14 hari gratis · Tanpa kartu kredit · Trial dimulai setelah email terverifikasi</p>
      </form>
    </section>
  )
}
