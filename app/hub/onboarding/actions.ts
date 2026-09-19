'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  completeStockOnboarding,
  getOnboardingStatus,
  queueStockProvisioning,
  retryCustomerOnboarding,
  resendOnboardingVerification,
  startManualStockOnboarding,
  startSelfServiceStockOnboarding,
  verifyOnboardingChallenge,
  verifyOnboardingToken,
  type VerificationType,
} from '@/lib/customer-onboarding'
import { verifySuperadmin } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export type OnboardingActionState = {
  status: 'idle' | 'error' | 'success'
  message: string | null
  requestId?: string
}

const publicOnboardingSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().toLowerCase().email().max(254),
  ownerPhone: z.string().trim().min(8).max(24),
  planId: z.string().uuid(),
  password: z.string().min(12).max(72),
  passwordConfirmation: z.string().min(12).max(72),
  terms: z.literal(true),
}).refine((value) => value.password === value.passwordConfirmation, {
  path: ['passwordConfirmation'],
  message: 'password_mismatch',
})

const manualOnboardingSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().toLowerCase().email().max(254),
  ownerPhone: z.string().trim().min(8).max(24),
  planId: z.string().uuid(),
})

async function requestIdentity() {
  const requestHeaders = await headers()
  const forwarded = requestHeaders.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || 'unknown'
}

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24)
}

export async function startStockTrialAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  if (process.env.UNIFIED_ONBOARDING_ENABLED !== 'true') {
    return { status: 'error', message: 'Pendaftaran mandiri sedang disiapkan. Hubungi tim Webzoka.' }
  }
  if (String(formData.get('website') ?? '').trim()) {
    return { status: 'success', message: 'Jika data dapat diproses, tautan verifikasi akan dikirim ke email Anda.' }
  }

  const ownerEmail = String(formData.get('owner_email') ?? '').trim().toLowerCase()
  const ip = await requestIdentity()
  const ipLimit = rateLimit(`onboarding:stock:ip:${ip}`, 6, 60 * 60_000)
  const emailLimit = rateLimit(`onboarding:stock:email:${fingerprint(ownerEmail)}`, 4, 60 * 60_000)
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { status: 'error', message: 'Terlalu banyak percobaan. Coba kembali nanti.' }
  }

  const challenge = await verifyOnboardingChallenge(String(formData.get('cf-turnstile-response') ?? ''), ip)
  if (!challenge.ok) return { status: 'error', message: challenge.error }

  const parsed = publicOnboardingSchema.safeParse({
    businessName: formData.get('business_name'),
    ownerName: formData.get('owner_name'),
    ownerEmail,
    ownerPhone: formData.get('owner_phone'),
    planId: formData.get('plan_id'),
    password: formData.get('password'),
    passwordConfirmation: formData.get('password_confirmation'),
    terms: formData.get('terms') === 'on',
  })
  if (!parsed.success) return { status: 'error', message: 'Periksa kembali data bisnis, email, dan kata sandi Anda.' }

  try {
    const result = await startSelfServiceStockOnboarding({
      businessName: parsed.data.businessName,
      ownerName: parsed.data.ownerName,
      ownerEmail: parsed.data.ownerEmail,
      ownerPhone: parsed.data.ownerPhone,
      planId: parsed.data.planId,
      password: parsed.data.password,
    })
    if (!result.ok) return { status: 'error', message: result.error }
    return { status: 'success', message: 'Jika email dapat digunakan, tautan verifikasi sudah dikirim. Periksa juga folder spam.' }
  } catch (error) {
    console.error('[CustomerOnboarding] Public start failed', {
      error: error instanceof Error ? error.message.split(':')[0] : 'unknown_error',
    })
    return { status: 'error', message: 'Pendaftaran belum dapat diproses. Coba kembali.' }
  }
}

export async function verifyStockEmailAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const parsed = z.object({
    requestId: z.string().uuid(),
    tokenHash: z.string().min(20).max(512),
    type: z.enum(['signup', 'invite', 'magiclink']),
  }).safeParse({
    requestId: formData.get('request_id'),
    tokenHash: formData.get('token_hash'),
    type: formData.get('type'),
  })
  if (!parsed.success) return { status: 'error', message: 'Tautan verifikasi tidak valid.' }

  const verified = await verifyOnboardingToken(
    parsed.data.requestId,
    parsed.data.tokenHash,
    parsed.data.type as VerificationType,
  )
  if (!verified.ok) return { status: 'error', message: verified.error }

  const result = await completeStockOnboarding(parsed.data.requestId, verified.ownerUserId)
  if (!result.ok) {
    redirect(`/hub/onboarding/status?request=${encodeURIComponent(parsed.data.requestId)}&activation=failed`)
  }
  if (parsed.data.type === 'invite') {
    redirect(`/hub/update-password?onboarding=${encodeURIComponent(parsed.data.requestId)}`)
  }
  redirect(`/hub/onboarding/status?request=${encodeURIComponent(parsed.data.requestId)}`)
}

export async function createManualStockCustomerAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  if (process.env.UNIFIED_ONBOARDING_ENABLED !== 'true') {
    return { status: 'error', message: 'Onboarding customer belum diaktifkan di environment ini.' }
  }
  if (!(await verifySuperadmin())) return { status: 'error', message: 'Sesi admin tidak valid. Masuk kembali.' }

  const db = await createClient()
  const { data: claimsData } = await db.auth.getClaims()
  const actorUserId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
  if (!actorUserId) return { status: 'error', message: 'Sesi admin tidak valid. Masuk kembali.' }

  const parsed = manualOnboardingSchema.safeParse({
    businessName: formData.get('business_name'),
    ownerName: formData.get('owner_name'),
    ownerEmail: formData.get('owner_email'),
    ownerPhone: formData.get('owner_phone'),
    planId: formData.get('plan_id'),
  })
  if (!parsed.success) return { status: 'error', message: 'Lengkapi data customer dengan email dan WhatsApp yang valid.' }

  try {
    const result = await startManualStockOnboarding(parsed.data, actorUserId)
    if (!result.ok) return { status: 'error', message: result.error }
    if (result.needsFinalization) {
      const finalized = await completeStockOnboarding(result.request.id, result.request.owner_user_id)
      if (!finalized.ok) return { status: 'error', message: finalized.error }
    }
    return {
      status: 'success',
      requestId: result.request.id,
      message: result.existingAccount
        ? 'Akun Core ditemukan. Customer Hub aktif dan Stock sedang disiapkan.'
        : result.inviteSent
          ? 'Undangan aman sudah dikirim. Trial dimulai setelah customer memverifikasi email.'
          : 'Akun dicatat, tetapi email belum terkirim. Gunakan kirim ulang dari status onboarding.',
    }
  } catch (error) {
    console.error('[CustomerOnboarding] Manual start failed', {
      error: error instanceof Error ? error.message.split(':')[0] : 'unknown_error',
    })
    return { status: 'error', message: 'Customer belum dapat didaftarkan. Coba kembali.' }
  }
}

export async function retryStockProvisioningAction(formData: FormData) {
  const requestId = z.string().uuid().safeParse(formData.get('request_id'))
  if (!requestId.success) return
  const db = await createClient()
  const { data } = await db.auth.getClaims()
  const ownerUserId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!ownerUserId) redirect('/hub/login')
  const onboarding = await getOnboardingStatus(requestId.data, ownerUserId)
  if (!onboarding || !onboarding.canRetry) redirect('/hub')
  if (onboarding.status === 'needs_attention') await retryCustomerOnboarding(requestId.data)
  else await queueStockProvisioning(requestId.data)
  redirect(`/hub/onboarding/status?request=${encodeURIComponent(requestId.data)}&retry=1`)
}

export async function retryStockProvisioningAsAdminAction(formData: FormData) {
  if (!(await verifySuperadmin())) redirect('/login')
  const requestId = z.string().uuid().safeParse(formData.get('request_id'))
  if (!requestId.success) redirect('/dashboard/customers/new')
  const onboarding = await getOnboardingStatus(requestId.data)
  if (onboarding?.canRetry) await retryCustomerOnboarding(requestId.data)
  redirect(`/dashboard/customers/onboarding/${encodeURIComponent(requestId.data)}?retry=1`)
}

export async function resendManualStockInviteAction(formData: FormData) {
  if (!(await verifySuperadmin())) redirect('/login')
  const requestId = z.string().uuid().safeParse(formData.get('request_id'))
  if (!requestId.success) redirect('/dashboard/customers/new')
  await resendOnboardingVerification(requestId.data)
  redirect(`/dashboard/customers/onboarding/${encodeURIComponent(requestId.data)}?resent=1`)
}
