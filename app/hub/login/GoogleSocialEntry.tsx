'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { GOOGLE_SOCIAL_RUNTIME_ENABLED } from '@/lib/google-social-release'
import styles from './login.module.css'

export function GoogleSocialEntry({ next, signup = false, pilotEnabled = false }: { next?: string | null; signup?: boolean; pilotEnabled?: boolean }) {
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const restore = () => setPending(false)
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  if (!(GOOGLE_SOCIAL_RUNTIME_ENABLED || pilotEnabled)) return null

  const noticeId = signup ? 'google-signup-notice' : 'google-login-notice'
  function submit(event: FormEvent<HTMLFormElement>) {
    if (pending) event.preventDefault()
    else setPending(true)
  }

  return (
    <>
      <form method="post" action="/api/auth/social/google/start" className={styles.devForm}
        onSubmit={submit} aria-label="Lanjutkan dengan Google" aria-describedby={noticeId} aria-busy={pending}>
        <input type="hidden" name="next" value={next ?? '/hub/account'} />
        <button type="submit" className={styles.secondaryButton} disabled={pending}>
          {pending ? 'Menghubungkan ke Google…' : 'Lanjutkan dengan Google'}
        </button>
        <p id={noticeId} className={styles.returnHint}>
          Akun Webzoka dibuat jika Anda belum memilikinya. Akses layanan mengikuti izin akun Anda.
        </p>
      </form>
      <p className={styles.returnHint}>{signup ? 'Atau daftar dengan email di bawah.' : 'Atau masuk dengan email di bawah.'}</p>
    </>
  )
}
