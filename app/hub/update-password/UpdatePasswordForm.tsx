'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { updateHubPassword, type HubRecoveryState } from '../actions'
import styles from '../hub.module.css'

const initialState: HubRecoveryState = { status: 'idle', message: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button className={styles.primaryButton} type="submit" disabled={pending}>
      {pending ? <LoaderCircle aria-hidden="true" className={styles.spinIcon} /> : <ShieldCheck aria-hidden="true" />}
      {pending ? 'Menyimpan kata sandi…' : 'Simpan Kata Sandi Baru'}
    </button>
  )
}

export function UpdatePasswordForm({ onboarding }: { onboarding?: string }) {
  const [state, action] = useActionState(updateHubPassword, initialState)

  return (
    <form action={action} className={styles.loginForm}>
      {onboarding ? <input type="hidden" name="onboarding" value={onboarding} /> : null}
      <label className={styles.fieldLabel} htmlFor="new-password">Kata sandi baru</label>
      <div className={styles.inputWrap}>
        <KeyRound aria-hidden="true" />
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          placeholder="Minimal 12 karakter…"
          required
        />
      </div>

      <label className={styles.fieldLabel} htmlFor="password-confirmation">Ulangi kata sandi baru</label>
      <div className={styles.inputWrap}>
        <KeyRound aria-hidden="true" />
        <input
          id="password-confirmation"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          placeholder="Ketik ulang kata sandi…"
          required
        />
      </div>

      <p className={styles.passwordHint}>Gunakan kata sandi unik yang tidak dipakai di layanan lain.</p>
      {state.message ? (
        <p className={styles.formError} role="alert" aria-live="polite">{state.message}</p>
      ) : null}
      <SubmitButton />
    </form>
  )
}
