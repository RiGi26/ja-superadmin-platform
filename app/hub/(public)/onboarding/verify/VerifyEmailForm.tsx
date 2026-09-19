'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { verifyStockEmailAction, type OnboardingActionState } from '../../../onboarding/actions'
import styles from '../../../onboarding/onboarding.module.css'

const initialState: OnboardingActionState = { status: 'idle', message: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button className={styles.submitButton} type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
      {pending ? 'Memverifikasi email…' : 'Verifikasi & Aktifkan Akun'}
    </button>
  )
}

export function VerifyEmailForm({
  requestId,
  tokenHash,
  type,
}: {
  requestId: string
  tokenHash: string
  type: string
}) {
  const [state, action] = useActionState(verifyStockEmailAction, initialState)
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {state.status === 'error' ? (
        <p className={styles.alert} role="alert">{state.message}</p>
      ) : null}
      <SubmitButton />
    </form>
  )
}
