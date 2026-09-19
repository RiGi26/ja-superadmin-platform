'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { hubAppUrl } from '@/lib/hub-app-url'
import { getOnboardingStatus } from '@/lib/customer-onboarding'
import { createClient } from '@/lib/supabase/server'
import { safeHubReturnPath } from '@/lib/hub-return-path'

export type HubLoginState = { error: string | null }
export type HubRecoveryState = {
  status: 'idle' | 'error' | 'success'
  message: string | null
}

const emailSchema = z.string().trim().email().max(254)
const passwordSchema = z.string().min(12).max(72)

export async function loginToHub(
  _previousState: HubLoginState,
  formData: FormData,
): Promise<HubLoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeHubReturnPath(String(formData.get('next') ?? ''))

  if (!email || !password) {
    return { error: 'Masukkan email dan kata sandi Anda.' }
  }

  const db = await createClient()
  const { error } = await db.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email atau kata sandi tidak sesuai.' }
  }

  const { data: claimsData } = await db.auth.getClaims()
  const claims = claimsData?.claims
  if (!claims?.sub) {
    await db.auth.signOut()
    return { error: 'Sesi tidak dapat diverifikasi. Silakan coba lagi.' }
  }

  if (next) redirect(next)
  if (claims.user_role === 'superadmin') redirect('/dashboard')
  redirect('/hub')
}

export async function logoutFromHub() {
  const db = await createClient()
  await db.auth.signOut()
  redirect('/hub/login')
}

export async function requestHubPasswordReset(
  _previousState: HubRecoveryState,
  formData: FormData,
): Promise<HubRecoveryState> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) {
    return { status: 'error', message: 'Masukkan alamat email yang valid.' }
  }

  try {
    const db = await createClient()
    const redirectTo = `${hubAppUrl()}/auth/callback?next=%2Fhub%2Fupdate-password`
    await db.auth.resetPasswordForEmail(parsed.data, { redirectTo })
  } catch (error) {
    console.warn('[HubAuth] Password reset request failed', {
      error: error instanceof Error ? error.name : 'unknown_error',
    })
  }

  return {
    status: 'success',
    message: 'Jika email terdaftar, Webzoka telah mengirim tautan pengaturan kata sandi.',
  }
}

export async function updateHubPassword(
  _previousState: HubRecoveryState,
  formData: FormData,
): Promise<HubRecoveryState> {
  const password = String(formData.get('password') ?? '')
  const confirmation = String(formData.get('password_confirmation') ?? '')
  const onboardingId = String(formData.get('onboarding') ?? '')
  const parsed = passwordSchema.safeParse(password)

  if (!parsed.success) {
    return { status: 'error', message: 'Gunakan minimal 12 karakter untuk kata sandi baru.' }
  }
  if (password !== confirmation) {
    return { status: 'error', message: 'Konfirmasi kata sandi belum sama.' }
  }

  const db = await createClient()
  const { data: claimsData } = await db.auth.getClaims()
  if (!claimsData?.claims?.sub) {
    return { status: 'error', message: 'Tautan sudah tidak berlaku. Minta tautan baru.' }
  }

  const { error } = await db.auth.updateUser({ password: parsed.data })
  if (error) {
    return { status: 'error', message: 'Kata sandi belum dapat diperbarui. Coba kembali.' }
  }

  const ownerUserId = typeof claimsData.claims.sub === 'string' ? claimsData.claims.sub : null
  if (ownerUserId && /^[0-9a-f-]{36}$/i.test(onboardingId)) {
    const onboarding = await getOnboardingStatus(onboardingId, ownerUserId)
    if (onboarding) redirect(`/hub/onboarding/status?request=${encodeURIComponent(onboardingId)}`)
  }

  await db.auth.signOut()
  redirect('/hub/login?message=password_updated')
}
