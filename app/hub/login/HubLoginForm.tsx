'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from 'lucide-react'
import { loginToHub, type HubLoginState } from '../actions'
import styles from '../hub.module.css'

const initialState: HubLoginState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button className={styles.primaryButton} type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle aria-hidden="true" className={styles.spinIcon} />
      ) : (
        <ArrowRight aria-hidden="true" />
      )}
      {pending ? 'Memeriksa akun…' : 'Masuk ke Customer Hub'}
    </button>
  )
}

export function HubLoginForm({ next }: { next?: string | null }) {
  const [state, action] = useActionState(loginToHub, initialState)

  return (
    <form action={action} className={styles.loginForm}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className={styles.fieldLabel} htmlFor="hub-email">
        Email akun
      </label>
      <div className={styles.inputWrap}>
        <Mail aria-hidden="true" />
        <input
          id="hub-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nama@bisnis.com…"
          spellCheck={false}
          required
        />
      </div>

      <label className={styles.fieldLabel} htmlFor="hub-password">
        Kata sandi
      </label>
      <div className={styles.inputWrap}>
        <LockKeyhole aria-hidden="true" />
        <input
          id="hub-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Masukkan kata sandi…"
          required
        />
      </div>

      <Link className={styles.loginSecondaryLink} href="/hub/forgot-password">
        Lupa kata sandi?
      </Link>

      {state.error ? (
        <p className={styles.formError} role="alert" aria-live="polite">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
      {next ? (
        <p className={styles.ssoLoginHint}>
          Setelah masuk, Anda akan kembali ke proses penyambungan sistem.
        </p>
      ) : null}
    </form>
  )
}
