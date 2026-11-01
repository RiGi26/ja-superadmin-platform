'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react'
import { loginToHub, type HubLoginState } from '../actions'
import styles from './login.module.css'

const initialState: HubLoginState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button className={styles.primaryButton} type="submit" disabled={pending}>
      <span>{pending ? 'Memeriksa akun…' : 'Masuk'}</span>
      {pending ? (
        <LoaderCircle aria-hidden="true" className={styles.spinIcon} />
      ) : (
        <ArrowRight aria-hidden="true" />
      )}
    </button>
  )
}

export function HubLoginForm({ next }: { next?: string | null }) {
  const [state, action] = useActionState(loginToHub, initialState)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (state.error) errorRef.current?.focus()
  }, [state])

  return (
    <form id="hub-login" action={action} className={styles.form} aria-label="Masuk ke Customer Hub">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="hub-email">Email</label>
        <div className={styles.inputWrap}>
          <Mail aria-hidden="true" />
          <input
            id="hub-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            placeholder="nama@bisnis.com"
            spellCheck={false}
            required
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="hub-password">Kata sandi</label>
        <div className={styles.inputWrap}>
          <LockKeyhole aria-hidden="true" />
          <input
            id="hub-password"
            name="password"
            type={passwordVisible ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            className={styles.passwordInput}
            required
          />
          <button
            className={styles.revealButton}
            type="button"
            aria-label={passwordVisible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            aria-pressed={passwordVisible}
            aria-controls="hub-password"
            onClick={() => setPasswordVisible(visible => !visible)}
          >
            {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className={styles.forgotRow}>
        <Link href="/hub/forgot-password">Lupa kata sandi?</Link>
      </div>

      {state.error ? (
        <p ref={errorRef} className={styles.formError} role="alert" aria-live="polite" tabIndex={-1}>
          {state.error} Periksa kembali atau pilih “Lupa kata sandi?”.
        </p>
      ) : null}

      <SubmitButton />
      <p className={styles.accountNote}>
        <LockKeyhole aria-hidden="true" /> Gunakan email yang terdaftar di Webzoka.
      </p>
      {next ? (
        <p className={styles.returnHint}>
          Setelah masuk, Anda akan kembali ke halaman yang dituju.
        </p>
      ) : null}
    </form>
  )
}
