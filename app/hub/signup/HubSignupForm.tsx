'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, MailCheck, UserRound } from 'lucide-react'
import { signupToHub } from './actions'
import type { HubRegistrationState } from '@/lib/hub-registration'
import styles from '../login/login.module.css'
import signup from './signup.module.css'

type Turnstile = { render: (element: HTMLElement, options: { sitekey: string; size: 'compact' }) => string; reset: (id: string) => void; remove: (id: string) => void }
const initial: HubRegistrationState = { status: 'idle', message: null }
type FieldName = 'name' | 'email' | 'password' | 'password_confirmation'

export function HubSignupForm({ verificationFailed = false }: { verificationFailed?: boolean }) {
  const [state, action, pending] = useActionState(signupToHub, initial)
  const captcha = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const successRef = useRef<HTMLHeadingElement>(null)
  const [visible, setVisible] = useState({ password: false, password_confirmation: false })
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const turnstile = () => (window as Window & { turnstile?: Turnstile }).turnstile
  useEffect(() => {
    if (state.status === 'error' && widget.current !== null) turnstile()?.reset(widget.current)
  }, [state])
  useEffect(() => () => {
    if (widget.current !== null) turnstile()?.remove(widget.current)
  }, [])
  useEffect(() => {
    if (state.status === 'error' || verificationFailed) errorRef.current?.focus()
    if (state.status === 'success') successRef.current?.focus()
  }, [state, verificationFailed])

  function validate(input: HTMLInputElement) {
    const field = input.name as FieldName
    let message = ''
    if (!input.value.trim()) message = 'Lengkapi bidang ini.'
    else if (field === 'name' && input.value.trim().length < 2) message = 'Nama minimal 2 karakter.'
    else if (field === 'email' && input.validity.typeMismatch) message = 'Periksa format alamat email Anda.'
    else if (field === 'password' && input.value.length < 12) message = 'Kata sandi minimal 12 karakter.'
    else if (field === 'password_confirmation') {
      const password = formRef.current?.elements.namedItem('password') as HTMLInputElement | null
      if (input.value !== password?.value) message = 'Kata sandi belum sama. Periksa kembali.'
    }
    setErrors(previous => ({ ...previous, [field]: message }))
    return !message
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const confirmation = event.currentTarget.elements.namedItem('password_confirmation') as HTMLInputElement
    if (!validate(confirmation)) {
      event.preventDefault()
      confirmation.focus()
    }
  }

  function fieldError(field: FieldName) {
    return <p className={signup.fieldError} id={`signup-${field}-error`} aria-live="polite">{errors[field] || ''}</p>
  }

  function revealButton(field: 'password' | 'password_confirmation', label: string) {
    return <button type="button" className={styles.revealButton} aria-controls={field === 'password' ? 'signup-password' : 'signup-confirmation'} aria-label={`${visible[field] ? 'Sembunyikan' : 'Tampilkan'} ${label}`} aria-pressed={visible[field]} onClick={() => setVisible(previous => ({ ...previous, [field]: !previous[field] }))}>
      {visible[field] ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </button>
  }

  if (state.status === 'success') return (
    <div className={signup.success} role="status" aria-live="polite">
      <div className={signup.successIcon}><MailCheck aria-hidden="true" /></div>
      <h1 id="signup-title" ref={successRef} tabIndex={-1}>Periksa email Anda</h1>
      <p>{state.message}</p>
      <div className={signup.emailGuide}><p>Gunakan browser yang sama dengan saat mendaftar. Setelah email terverifikasi, masuk untuk melanjutkan.</p></div>
      <Link className={styles.primaryButton} href="/hub/login">Masuk setelah verifikasi</Link>
      <a className={signup.link} href="/hub/signup">Gunakan email lain</a>
    </div>
  )

  return (
    <>
      <p className={styles.context}><UserRound aria-hidden="true" /> Akun Webzoka</p>
      <h1 className={styles.title} id="signup-title">Buat akun<br />Webzoka</h1>
      <p className={`${styles.intro} ${signup.intro}`}>Gunakan email yang Anda kelola. Kami akan mengirimkan tautan verifikasi ke email tersebut.</p>
    <form ref={formRef} action={action} onSubmit={handleSubmit} className={styles.form} aria-label="Buat akun Webzoka">
      <div className={signup.honeypot} aria-hidden="true">
        <label htmlFor="signup-website">Website</label>
        <input id="signup-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className={`${styles.field} ${signup.field}`}>
        <label className={styles.fieldLabel} htmlFor="signup-name">Nama lengkap</label>
        <div className={styles.inputWrap}><UserRound aria-hidden="true" /><input id="signup-name" name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Nama lengkap Anda" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'signup-name-error' : undefined} onBlur={event => validate(event.currentTarget)} onChange={() => setErrors(previous => ({ ...previous, name: '' }))} /></div>
        {fieldError('name')}
      </div>
      <div className={`${styles.field} ${signup.field}`}>
        <label className={styles.fieldLabel} htmlFor="signup-email">Email</label>
        <div className={styles.inputWrap}><Mail aria-hidden="true" /><input id="signup-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="nama@bisnis.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'signup-email-error' : undefined} onBlur={event => validate(event.currentTarget)} onChange={() => setErrors(previous => ({ ...previous, email: '' }))} /></div>
        {fieldError('email')}
      </div>
      <div className={`${styles.field} ${signup.field}`}>
        <label className={styles.fieldLabel} htmlFor="signup-password">Kata sandi</label>
        <div className={styles.inputWrap}><LockKeyhole aria-hidden="true" /><input id="signup-password" name="password" type={visible.password ? 'text' : 'password'} className={styles.passwordInput} autoComplete="new-password" required minLength={12} maxLength={72} aria-invalid={!!errors.password} aria-describedby={`signup-password-help${errors.password ? ' signup-password-error' : ''}`} placeholder="Minimal 12 karakter" onBlur={event => validate(event.currentTarget)} onChange={() => setErrors(previous => ({ ...previous, password: '' }))} />{revealButton('password', 'kata sandi')}</div>
        <p id="signup-password-help" className={signup.passwordHelp}>Minimal 12 karakter. Gunakan kata sandi yang unik.</p>
        {fieldError('password')}
      </div>
      <div className={`${styles.field} ${signup.field}`}>
        <label className={styles.fieldLabel} htmlFor="signup-confirmation">Ulangi kata sandi</label>
        <div className={styles.inputWrap}><LockKeyhole aria-hidden="true" /><input id="signup-confirmation" name="password_confirmation" type={visible.password_confirmation ? 'text' : 'password'} className={styles.passwordInput} autoComplete="new-password" required minLength={12} maxLength={72} placeholder="Ketik ulang kata sandi" aria-invalid={!!errors.password_confirmation} aria-describedby={errors.password_confirmation ? 'signup-password_confirmation-error' : undefined} onBlur={event => validate(event.currentTarget)} onChange={() => setErrors(previous => ({ ...previous, password_confirmation: '' }))} />{revealButton('password_confirmation', 'ulangi kata sandi')}</div>
        {fieldError('password_confirmation')}
      </div>
      <label className={signup.terms}><input name="terms" type="checkbox" required /><span>Saya menyetujui pembuatan akun Webzoka dan pengiriman email verifikasi akun.</span></label>
      {siteKey && <><div ref={captcha} className={signup.captcha} /><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => { if (captcha.current && widget.current === null) widget.current = turnstile()?.render(captcha.current, { sitekey: siteKey, size: 'compact' }) ?? null }} /></>}
      {(state.status === 'error' || verificationFailed) && <p ref={errorRef} tabIndex={-1} className={styles.formError} role="alert">{state.message ?? 'Tautan verifikasi tidak valid, sudah digunakan, atau dibuka di browser lain. Daftar kembali dengan email yang sama untuk meminta tautan baru.'}</p>}
      <button className={`${styles.primaryButton} ${signup.submitButton}`} type="submit" disabled={pending} aria-busy={pending}>{pending && <LoaderCircle className={styles.spinIcon} aria-hidden="true" />}{pending ? 'Memproses pendaftaran…' : 'Buat akun Webzoka'}</button>
    </form>
      <p className={`${styles.signup} ${signup.loginLink}`}>Sudah punya akun? <Link href="/hub/login">Masuk</Link></p>
    </>
  )
}
