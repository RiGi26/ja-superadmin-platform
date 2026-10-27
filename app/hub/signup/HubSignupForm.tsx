'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useActionState, useEffect, useRef } from 'react'
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, MailCheck, UserRound } from 'lucide-react'
import { signupToHub } from './actions'
import type { HubRegistrationState } from '@/lib/hub-registration'
import styles from '../hub.module.css'
import signup from './signup.module.css'

type Turnstile = { render: (element: HTMLElement, options: { sitekey: string; size: 'compact' }) => string; reset: (id: string) => void; remove: (id: string) => void }
const initial: HubRegistrationState = { status: 'idle', message: null }

export function HubSignupForm({ verificationFailed = false }: { verificationFailed?: boolean }) {
  const [state, action, pending] = useActionState(signupToHub, initial)
  const captcha = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const turnstile = () => (window as Window & { turnstile?: Turnstile }).turnstile
  useEffect(() => {
    if (state.status === 'error' && widget.current !== null) turnstile()?.reset(widget.current)
  }, [state])
  useEffect(() => () => {
    if (widget.current !== null) turnstile()?.remove(widget.current)
  }, [])

  if (state.status === 'success') return (
    <div className={signup.success} role="status" aria-live="polite">
      <MailCheck aria-hidden="true" />
      <h3>Periksa email Anda</h3>
      <p>{state.message}</p>
      <p>Buka tautan verifikasi di browser yang Anda gunakan untuk mendaftar.</p>
      <Link className={styles.primaryButton} href="/hub/login?next=%2Fhub%2Faccount">Masuk setelah verifikasi <ArrowRight aria-hidden="true" /></Link>
      <a className={signup.link} href="/hub/signup">Gunakan email lain</a>
    </div>
  )

  return (
    <form action={action} className={`${styles.loginForm} ${signup.form}`}>
      <div className={signup.honeypot} aria-hidden="true">
        <label htmlFor="signup-website">Website</label>
        <input id="signup-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <label className={styles.fieldLabel} htmlFor="signup-name">Nama lengkap</label>
      <div className={styles.inputWrap}><UserRound aria-hidden="true" /><input id="signup-name" name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Nama Anda" /></div>
      <label className={styles.fieldLabel} htmlFor="signup-email">Email akun</label>
      <div className={styles.inputWrap}><Mail aria-hidden="true" /><input id="signup-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="nama@email.com" /></div>
      <label className={styles.fieldLabel} htmlFor="signup-password">Kata sandi</label>
      <div className={styles.inputWrap}><LockKeyhole aria-hidden="true" /><input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} aria-describedby="signup-password-help" placeholder="Minimal 12 karakter" /></div>
      <p id="signup-password-help" className={`${signup.help} ${signup.passwordHelp}`}>Gunakan kata sandi unik. Webzoka tidak pernah meminta kata sandi melalui email.</p>
      <label className={styles.fieldLabel} htmlFor="signup-confirmation">Ulangi kata sandi</label>
      <div className={styles.inputWrap}><LockKeyhole aria-hidden="true" /><input id="signup-confirmation" name="password_confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={72} placeholder="Ketik ulang kata sandi" /></div>
      <label className={signup.terms}><input name="terms" type="checkbox" required /><span>Saya menyetujui pembuatan akun Webzoka dan pengiriman email verifikasi akun.</span></label>
      {siteKey && <><div ref={captcha} className={signup.captcha} /><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => { if (captcha.current && widget.current === null) widget.current = turnstile()?.render(captcha.current, { sitekey: siteKey, size: 'compact' }) ?? null }} /></>}
      {(state.status === 'error' || verificationFailed) && <p className={styles.formError} role="alert">{state.message ?? 'Tautan verifikasi tidak valid, sudah digunakan, atau dibuka di browser lain. Daftar kembali dengan email yang sama untuk meminta tautan baru.'}</p>}
      <button className={styles.primaryButton} type="submit" disabled={pending}>{pending ? <LoaderCircle className={styles.spinIcon} aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}{pending ? 'Memproses pendaftaran…' : 'Buat akun gratis'}</button>
      <p className={`${signup.help} ${signup.footnote}`}>Pendaftaran akun tidak memulai trial, tagihan, atau pembayaran produk.</p>
    </form>
  )
}
