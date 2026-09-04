'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowLeft, LoaderCircle, Mail, Send } from 'lucide-react'
import {
  requestHubPasswordReset,
  type HubRecoveryState,
} from '../actions'
import styles from '../hub.module.css'

const initialState: HubRecoveryState = { status: 'idle', message: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button className={styles.primaryButton} type="submit" disabled={pending}>
      {pending ? <LoaderCircle aria-hidden="true" className={styles.spinIcon} /> : <Send aria-hidden="true" />}
      {pending ? 'Mengirim tautan…' : 'Kirim Tautan Aman'}
    </button>
  )
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestHubPasswordReset, initialState)

  return (
    <form action={action} className={styles.loginForm}>
      <label className={styles.fieldLabel} htmlFor="recovery-email">Email akun</label>
      <div className={styles.inputWrap}>
        <Mail aria-hidden="true" />
        <input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nama@bisnis.com…"
          spellCheck={false}
          required
        />
      </div>

      {state.message ? (
        <p
          className={state.status === 'success' ? styles.formSuccess : styles.formError}
          role={state.status === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
      <Link className={styles.loginBackLink} href="/hub/login">
        <ArrowLeft aria-hidden="true" /> Kembali ke halaman masuk
      </Link>
    </form>
  )
}
