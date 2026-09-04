import 'server-only'

import crypto from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { after } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hubAppUrl } from '@/lib/hub-app-url'

export const STOCK_TRIAL_DAYS = 14

export type OnboardingSource = 'self_service' | 'manual'
export type VerificationType = 'signup' | 'invite' | 'magiclink'
export type OnboardingStatus =
  | 'pending_verification'
  | 'provisioning'
  | 'portal_failed'
  | 'needs_attention'
  | 'ready'
  | 'cancelled'

export type StockPlanChoice = {
  id: string
  tier: 'starter' | 'pro' | 'enterprise'
  name: string
  priceMonthly: number
  priceYearly: number
  features: string[]
}

export type StartOnboardingInput = {
  businessName: string
  ownerName: string
  ownerEmail: string
  ownerPhone?: string | null
  planId: string
}

type OnboardingRow = {
  id: string
  owner_user_id: string
  owner_email: string
  owner_name: string
  business_name: string
  source: OnboardingSource
  status: OnboardingStatus
  invite_type: VerificationType | 'existing_account'
  core_tenant_id: string
}

type AuthLookup = {
  user_id: string
  email_confirmed_at: string | null
}

type ProvisioningRow = {
  id: string
  status: OnboardingStatus
  owner_user_id: string
  owner_email: string
  owner_name: string
  owner_phone: string | null
  business_name: string
  slug: string
  plan_id: string
  core_tenant_id: string
  portal_tenant_id: string | null
  trial_started_at: string | null
  trial_ends_at: string | null
  attempt_count: number
}

export type CustomerOnboardingStatus = {
  id: string
  status: OnboardingStatus
  businessName: string
  ownerEmail: string
  planName: string
  trialEndsAt: string | null
  coreReady: boolean
  portalTenantId: string | null
  canRetry: boolean
  safeError: string | null
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeIndonesianPhone(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('08')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits.slice(0, 16)
}

export function onboardingSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 40) || 'bisnis'
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character)
}

function normalizeFeatures(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 7)
    : []
}

export async function getPublicStockPlans(): Promise<StockPlanChoice[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('subscription_plans')
    .select('id, tier, tier_display_name, name, price_monthly, price_yearly, features')
    .eq('platform', 'stock')
    .eq('is_active', true)
    .order('price_monthly')

  if (error) {
    console.error('[CustomerOnboarding] Failed to load Stock plans', { code: error.code })
    return []
  }

  return (data ?? []).flatMap((plan) => {
    if (plan.tier !== 'starter' && plan.tier !== 'pro' && plan.tier !== 'enterprise') return []
    return [{
      id: plan.id,
      tier: plan.tier,
      name: plan.tier_display_name || plan.name || plan.tier,
      priceMonthly: Number(plan.price_monthly),
      priceYearly: Number(plan.price_yearly),
      features: normalizeFeatures(plan.features),
    }]
  })
}

async function getStockPlan(planId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('subscription_plans')
    .select('id, tier, tier_display_name, name')
    .eq('id', planId)
    .eq('platform', 'stock')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null
  return {
    id: data.id as string,
    tier: data.tier as string,
    name: (data.tier_display_name || data.name || data.tier) as string,
  }
}

async function lookupAuthUser(email: string): Promise<AuthLookup | null> {
  const db = createAdminClient()
  const { data, error } = await db.rpc('lookup_auth_user_by_email', { p_email: email })
  if (error) throw new Error(`auth_lookup_failed:${error.code}`)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.user_id) return null
  return row as AuthLookup
}

async function findActiveOnboarding(email: string): Promise<OnboardingRow | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('customer_onboarding')
    .select('id, owner_user_id, owner_email, owner_name, business_name, source, status, invite_type, core_tenant_id')
    .eq('owner_email', email)
    .eq('platform', 'stock')
    .in('status', ['pending_verification', 'provisioning', 'portal_failed', 'needs_attention', 'ready'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`onboarding_lookup_failed:${error.code}`)
  return (data as OnboardingRow | null) ?? null
}

function verificationUrl(requestId: string, tokenHash: string, type: VerificationType) {
  const url = new URL('/hub/onboarding/verify', hubAppUrl())
  url.searchParams.set('request', requestId)
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', type)
  return url.toString()
}

async function sendEmail(input: {
  to: string
  subject: string
  html: string
}) {
  if (!process.env.RESEND_API_KEY) throw new Error('resend_not_configured')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Webzoka <noreply@webzoka.com>',
    to: input.to,
    subject: input.subject,
    html: input.html,
  })
  if (error) throw new Error('email_delivery_failed')
}

async function sendVerificationEmail(input: {
  to: string
  ownerName: string
  businessName: string
  requestId: string
  tokenHash: string
  type: VerificationType
  manual: boolean
}) {
  const name = escapeHtml(input.ownerName)
  const business = escapeHtml(input.businessName)
  const url = verificationUrl(input.requestId, input.tokenHash, input.type)
  const eyebrow = input.manual ? 'UNDANGAN CUSTOMER HUB' : 'VERIFIKASI EMAIL'
  const intro = input.manual
    ? `Tim Webzoka telah menyiapkan akun untuk <strong>${business}</strong>.`
    : `Selesaikan pendaftaran <strong>${business}</strong> dengan memverifikasi email Anda.`

  await sendEmail({
    to: input.to,
    subject: input.manual
      ? `Aktifkan akun Webzoka untuk ${input.businessName}`
      : `Verifikasi email untuk memulai trial Webzoka Stock`,
    html: `
      <div style="background:#f5f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#10213f">
        <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px">
          <p style="margin:0 0 12px;color:#1769e0;font-size:11px;font-weight:700;letter-spacing:.12em">${eyebrow}</p>
          <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2">Halo ${name},</h1>
          <p style="margin:0 0 22px;color:#65748b;line-height:1.65">${intro}</p>
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#1769e0;color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:15px 22px">Verifikasi &amp; Aktifkan Akun</a>
          <p style="margin:22px 0 0;color:#65748b;font-size:13px;line-height:1.6">Trial 14 hari dimulai setelah email terverifikasi. Webzoka tidak pernah mengirim atau meminta kata sandi melalui email.</p>
        </div>
      </div>
    `,
  })
}

async function sendExistingAccountEmail(input: { to: string; ownerName: string }) {
  const loginUrl = new URL('/hub/login', hubAppUrl()).toString()
  await sendEmail({
    to: input.to,
    subject: 'Gunakan akun Webzoka Anda untuk melanjutkan',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#10213f">
        <h1 style="font-size:24px">Halo ${escapeHtml(input.ownerName)},</h1>
        <p style="color:#65748b;line-height:1.65">Email ini sudah terhubung ke Customer Hub. Masuk dengan akun yang sama untuk melanjutkan atau hubungi tim Webzoka bila Anda membutuhkan bantuan.</p>
        <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#1769e0;color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:14px 20px">Masuk ke Customer Hub</a>
      </div>
    `,
  })
}

async function insertRequest(input: {
  requestId: string
  coreTenantId: string
  userId: string
  source: OnboardingSource
  inviteType: VerificationType | 'existing_account'
  data: StartOnboardingInput
  createdBy?: string | null
}) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('customer_onboarding')
    .insert({
      id: input.requestId,
      platform: 'stock',
      source: input.source,
      status: 'pending_verification',
      owner_user_id: input.userId,
      owner_email: normalizeEmail(input.data.ownerEmail),
      owner_name: input.data.ownerName.trim(),
      owner_phone: normalizeIndonesianPhone(input.data.ownerPhone),
      business_name: input.data.businessName.trim(),
      slug: onboardingSlug(input.data.businessName),
      plan_id: input.data.planId,
      core_tenant_id: input.coreTenantId,
      invite_type: input.inviteType,
      created_by: input.createdBy ?? null,
    })
    .select('id, owner_user_id, owner_email, owner_name, business_name, source, status, invite_type, core_tenant_id')
    .single()

  if (error || !data) throw new Error(`onboarding_insert_failed:${error?.code ?? 'unknown'}`)
  return data as OnboardingRow
}

async function markEmailFailure(requestId: string) {
  const db = createAdminClient()
  await db
    .from('customer_onboarding')
    .update({ last_error_code: 'email_send_failed' })
    .eq('id', requestId)
}

async function resendPendingVerification(existing: OnboardingRow) {
  const db = createAdminClient()
  const linkType: VerificationType = existing.invite_type === 'invite' ? 'invite' : 'magiclink'
  const generated = await db.auth.admin.generateLink({
    type: linkType,
    email: existing.owner_email,
    options: { data: { full_name: existing.owner_name } },
  })
  if (generated.error || !generated.data.properties?.hashed_token) {
    await markEmailFailure(existing.id)
    return false
  }

  try {
    await sendVerificationEmail({
      to: existing.owner_email,
      ownerName: existing.owner_name,
      businessName: existing.business_name,
      requestId: existing.id,
      tokenHash: generated.data.properties.hashed_token,
      type: linkType,
      manual: existing.source === 'manual',
    })
    return true
  } catch {
    await markEmailFailure(existing.id)
    return false
  }
}

export async function resendOnboardingVerification(requestId: string) {
  if (!isUuid(requestId)) return { ok: false as const }
  const db = createAdminClient()
  const { data } = await db
    .from('customer_onboarding')
    .select('id, owner_user_id, owner_email, owner_name, business_name, source, status, invite_type, core_tenant_id')
    .eq('id', requestId)
    .eq('status', 'pending_verification')
    .maybeSingle()
  if (!data) return { ok: false as const }
  return { ok: await resendPendingVerification(data as OnboardingRow) }
}

export async function startSelfServiceStockOnboarding(
  input: StartOnboardingInput & { password: string },
) {
  const normalized: StartOnboardingInput & { password: string } = {
    ...input,
    businessName: input.businessName.trim(),
    ownerName: input.ownerName.trim(),
    ownerEmail: normalizeEmail(input.ownerEmail),
    ownerPhone: normalizeIndonesianPhone(input.ownerPhone),
  }

  const plan = await getStockPlan(normalized.planId)
  if (!plan) return { ok: false as const, error: 'Paket Stock tidak tersedia.' }

  const active = await findActiveOnboarding(normalized.ownerEmail)
  if (active) {
    if (active.status === 'pending_verification') await resendPendingVerification(active)
    else {
      try { await sendExistingAccountEmail({ to: normalized.ownerEmail, ownerName: normalized.ownerName }) }
      catch { /* Generic response prevents account enumeration. */ }
    }
    return { ok: true as const }
  }

  const existingUser = await lookupAuthUser(normalized.ownerEmail)
  if (existingUser) {
    try { await sendExistingAccountEmail({ to: normalized.ownerEmail, ownerName: normalized.ownerName }) }
    catch { /* Generic response prevents account enumeration. */ }
    return { ok: true as const }
  }

  const db = createAdminClient()
  const requestId = randomUUID()
  const generated = await db.auth.admin.generateLink({
    type: 'signup',
    email: normalized.ownerEmail,
    password: normalized.password,
    options: { data: { full_name: normalized.ownerName } },
  })

  if (generated.error || !generated.data.user || !generated.data.properties?.hashed_token) {
    console.warn('[CustomerOnboarding] Signup link generation failed', {
      code: generated.error?.code ?? 'missing_link',
    })
    return { ok: true as const }
  }

  let request: OnboardingRow
  try {
    request = await insertRequest({
      requestId,
      coreTenantId: randomUUID(),
      userId: generated.data.user.id,
      source: 'self_service',
      inviteType: 'signup',
      data: normalized,
    })
  } catch (error) {
    await db.auth.admin.deleteUser(generated.data.user.id)
    console.error('[CustomerOnboarding] Request insert failed', {
      error: error instanceof Error ? error.message.split(':')[0] : 'unknown_error',
    })
    return { ok: false as const, error: 'Pendaftaran belum dapat diproses. Coba kembali.' }
  }

  try {
    await sendVerificationEmail({
      to: normalized.ownerEmail,
      ownerName: normalized.ownerName,
      businessName: normalized.businessName,
      requestId: request.id,
      tokenHash: generated.data.properties.hashed_token,
      type: 'signup',
      manual: false,
    })
  } catch {
    await markEmailFailure(request.id)
  }

  return { ok: true as const }
}

export async function startManualStockOnboarding(
  input: StartOnboardingInput,
  createdBy: string,
) {
  const normalized: StartOnboardingInput = {
    ...input,
    businessName: input.businessName.trim(),
    ownerName: input.ownerName.trim(),
    ownerEmail: normalizeEmail(input.ownerEmail),
    ownerPhone: normalizeIndonesianPhone(input.ownerPhone),
  }

  const plan = await getStockPlan(normalized.planId)
  if (!plan) return { ok: false as const, error: 'Paket Stock tidak tersedia.' }

  const active = await findActiveOnboarding(normalized.ownerEmail)
  if (active) {
    const inviteSent = active.status === 'pending_verification'
      ? await resendPendingVerification(active)
      : true
    return {
      ok: true as const,
      request: active,
      existingAccount: active.status !== 'pending_verification' || active.invite_type === 'existing_account',
      inviteSent,
      needsFinalization: active.status === 'portal_failed' || active.status === 'needs_attention',
    }
  }

  const db = createAdminClient()
  const authUser = await lookupAuthUser(normalized.ownerEmail)
  const requestId = randomUUID()
  const coreTenantId = randomUUID()

  if (authUser?.email_confirmed_at) {
    const request = await insertRequest({
      requestId,
      coreTenantId,
      userId: authUser.user_id,
      source: 'manual',
      inviteType: 'existing_account',
      data: normalized,
      createdBy,
    })
    return {
      ok: true as const,
      request,
      existingAccount: true,
      inviteSent: true,
      needsFinalization: true,
    }
  }

  const linkType: VerificationType = authUser ? 'magiclink' : 'invite'
  const generated = await db.auth.admin.generateLink({
    type: linkType,
    email: normalized.ownerEmail,
    options: { data: { full_name: normalized.ownerName } },
  })

  if (generated.error || !generated.data.user || !generated.data.properties?.hashed_token) {
    return { ok: false as const, error: 'Undangan akun belum dapat dibuat. Periksa email atau coba kembali.' }
  }

  let request: OnboardingRow
  try {
    request = await insertRequest({
      requestId,
      coreTenantId,
      userId: generated.data.user.id,
      source: 'manual',
      inviteType: linkType,
      data: normalized,
      createdBy,
    })
  } catch (error) {
    if (!authUser) await db.auth.admin.deleteUser(generated.data.user.id)
    throw error
  }

  let inviteSent = true
  try {
    await sendVerificationEmail({
      to: normalized.ownerEmail,
      ownerName: normalized.ownerName,
      businessName: normalized.businessName,
      requestId: request.id,
      tokenHash: generated.data.properties.hashed_token,
      type: linkType,
      manual: true,
    })
  } catch {
    inviteSent = false
    await markEmailFailure(request.id)
  }

  return {
    ok: true as const,
    request,
    existingAccount: false,
    inviteSent,
    needsFinalization: false,
  }
}

export async function finalizeCoreOnboarding(requestId: string, ownerUserId: string) {
  const db = createAdminClient()
  const { data, error } = await db.rpc('finalize_customer_onboarding', {
    p_onboarding_id: requestId,
    p_owner_user_id: ownerUserId,
  })

  if (error) {
    console.error('[CustomerOnboarding] Core finalization failed', {
      requestId,
      code: error.code,
    })
    return { ok: false as const, error: 'Akun belum dapat diaktifkan. Coba kembali.' }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.core_tenant_id) return { ok: false as const, error: 'Akun belum dapat diaktifkan. Coba kembali.' }
  return {
    ok: true as const,
    coreTenantId: row.core_tenant_id as string,
    trialEndsAt: row.trial_ends_at as string,
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function stockBaseUrl() {
  const configured = process.env.WEBZOKA_STOCK_PORTAL_URL ?? process.env.STOCK_URL
  if (!configured) return null
  try {
    const url = new URL(configured)
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol !== 'https:' && !local) return null
    return url.origin
  } catch {
    return null
  }
}

function retryAt(attempt: number) {
  const delays = [60, 5 * 60, 30 * 60, 2 * 60 * 60, 6 * 60 * 60, 12 * 60 * 60]
  const delaySeconds = delays[Math.min(Math.max(attempt - 1, 0), delays.length - 1)]
  return new Date(Date.now() + delaySeconds * 1000).toISOString()
}

async function markProvisionFailure(request: ProvisioningRow, code: string) {
  const db = createAdminClient()
  const attempt = request.attempt_count + 1
  const needsAttention = attempt >= 8
  await db
    .from('customer_onboarding')
    .update({
      status: needsAttention ? 'needs_attention' : 'portal_failed',
      attempt_count: attempt,
      next_retry_at: needsAttention ? null : retryAt(attempt),
      last_error_code: code,
    })
    .eq('id', request.id)
}

/**
 * Deliver one idempotent Core -> Stock provisioning request. This function is
 * safe for cron/retry use. User-facing actions should call queueStockProvisioning
 * so the remote portal never delays the response.
 */
export async function provisionStockOnboarding(requestId: string) {
  if (!isUuid(requestId)) return { ok: false as const, error: 'invalid_request' }

  const db = createAdminClient()
  const { data, error } = await db
    .from('customer_onboarding')
    .select([
      'id',
      'status',
      'owner_user_id',
      'owner_email',
      'owner_name',
      'owner_phone',
      'business_name',
      'slug',
      'plan_id',
      'core_tenant_id',
      'portal_tenant_id',
      'trial_started_at',
      'trial_ends_at',
      'attempt_count',
    ].join(','))
    .eq('id', requestId)
    .maybeSingle()

  const request = data as ProvisioningRow | null
  if (error || !request) return { ok: false as const, error: 'request_not_found' }
  if (request.status === 'ready' && request.portal_tenant_id) {
    return { ok: true as const, stockTenantId: request.portal_tenant_id }
  }
  if (
    request.status === 'pending_verification' ||
    request.status === 'cancelled' ||
    !request.trial_started_at ||
    !request.trial_ends_at
  ) {
    return { ok: false as const, error: 'request_not_ready' }
  }

  const [{ data: plan }, secret, baseUrl] = await Promise.all([
    db
      .from('subscription_plans')
      .select('tier')
      .eq('id', request.plan_id)
      .eq('platform', 'stock')
      .eq('is_active', true)
      .maybeSingle(),
    Promise.resolve(process.env.WEBZOKA_PROVISIONING_SECRET),
    Promise.resolve(stockBaseUrl()),
  ])

  if (!plan?.tier || !secret || secret.length < 32 || !baseUrl) {
    await markProvisionFailure(request, 'provisioning_configuration_unavailable')
    return { ok: false as const, error: 'configuration_unavailable' }
  }

  const body = JSON.stringify({
    core_tenant_id: request.core_tenant_id,
    core_user_id: request.owner_user_id,
    business_name: request.business_name,
    slug: request.slug,
    owner_name: request.owner_name,
    owner_email: request.owner_email,
    owner_phone: request.owner_phone,
    email_verified: true,
    selected_plan: plan.tier,
    trial_started_at: request.trial_started_at,
    trial_ends_at: request.trial_ends_at,
  })

  const timestamp = String(Date.now())
  const nonce = crypto.randomBytes(16).toString('hex')
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}\n${nonce}\n${body}`)
    .digest('hex')

  await db
    .from('customer_onboarding')
    .update({ status: 'provisioning', last_error_code: null, next_retry_at: null })
    .eq('id', request.id)
    .neq('status', 'ready')

  try {
    const response = await fetch(`${baseUrl}/api/internal/provision`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ja-timestamp': timestamp,
        'x-ja-nonce': nonce,
        'x-ja-signature': signature,
        'idempotency-key': request.id,
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    const responseData = await response.json().catch(() => null) as {
      ok?: boolean
      tenant_id?: string
      success?: boolean
      data?: { stockTenantId?: string }
    } | null
    const stockTenantId = responseData?.data?.stockTenantId ?? responseData?.tenant_id
    const succeeded = responseData?.success === true || responseData?.ok === true
    if (!response.ok || !succeeded || !stockTenantId || !isUuid(stockTenantId)) {
      await markProvisionFailure(request, `stock_http_${response.status}`)
      return { ok: false as const, error: 'stock_provision_failed' }
    }

    const { error: updateError } = await db
      .from('customer_onboarding')
      .update({
        status: 'ready',
        portal_tenant_id: stockTenantId,
        provisioned_at: new Date().toISOString(),
        attempt_count: request.attempt_count + 1,
        next_retry_at: null,
        last_error_code: null,
      })
      .eq('id', request.id)

    if (updateError) return { ok: false as const, error: 'core_status_update_failed' }
    await sendStockReadyEmail(request.id)
    return { ok: true as const, stockTenantId }
  } catch (error) {
    const errorCode = error instanceof DOMException && error.name === 'TimeoutError'
      ? 'stock_timeout'
      : 'stock_unreachable'
    await markProvisionFailure(request, errorCode)
    return { ok: false as const, error: errorCode }
  }
}

/** Schedule remote provisioning after the current response is committed. */
export async function queueStockProvisioning(requestId: string): Promise<void> {
  after(async () => {
    await provisionStockOnboarding(requestId)
  })
}

export async function completeStockOnboarding(requestId: string, ownerUserId: string) {
  const finalized = await finalizeCoreOnboarding(requestId, ownerUserId)
  if (!finalized.ok) {
    const db = createAdminClient()
    await db
      .from('customer_onboarding')
      .update({ status: 'needs_attention', last_error_code: 'core_finalization_failed', next_retry_at: null })
      .eq('id', requestId)
      .eq('owner_user_id', ownerUserId)
      .neq('status', 'ready')
    return finalized
  }
  await queueStockProvisioning(requestId)
  return { ok: true as const }
}

export async function retryCustomerOnboarding(requestId: string) {
  if (!isUuid(requestId)) return { ok: false as const }
  const db = createAdminClient()
  const { data } = await db
    .from('customer_onboarding')
    .select('owner_user_id')
    .eq('id', requestId)
    .maybeSingle()
  if (!data?.owner_user_id) return { ok: false as const }
  return completeStockOnboarding(requestId, data.owner_user_id)
}

export async function verifyOnboardingToken(
  requestId: string,
  tokenHash: string,
  type: VerificationType,
) {
  if (
    !isUuid(requestId) ||
    tokenHash.length < 20 ||
    !['signup', 'invite', 'magiclink'].includes(type)
  ) {
    return { ok: false as const, error: 'Tautan verifikasi tidak valid.' }
  }

  const admin = createAdminClient()
  const { data: request } = await admin
    .from('customer_onboarding')
    .select('owner_user_id, owner_email, status')
    .eq('id', requestId)
    .maybeSingle()
  if (!request || request.status !== 'pending_verification') {
    return { ok: false as const, error: 'Tautan verifikasi tidak valid atau sudah digunakan.' }
  }

  const db = await createClient()
  const { data, error } = await db.auth.verifyOtp({ token_hash: tokenHash, type })
  const verifiedEmail = normalizeEmail(data.user?.email ?? '')
  if (
    error ||
    !data.user ||
    data.user.id !== request.owner_user_id ||
    verifiedEmail !== request.owner_email
  ) {
    if (data.user) await db.auth.signOut()
    return { ok: false as const, error: 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.' }
  }

  return { ok: true as const, ownerUserId: data.user.id }
}

export async function verifyOnboardingChallenge(token: string, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (process.env.VERCEL_ENV === 'production') {
      return { ok: false as const, error: 'Pendaftaran mandiri sedang tidak tersedia.' }
    }
    return { ok: true as const }
  }
  if (!token) return { ok: false as const, error: 'Selesaikan pemeriksaan keamanan.' }

  try {
    const form = new URLSearchParams({ secret, response: token })
    if (ip && ip !== 'unknown') form.set('remoteip', ip)
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
    const result = await response.json() as {
      success?: boolean
      hostname?: string
    }
    if (!response.ok || !result.success) {
      return { ok: false as const, error: 'Pemeriksaan keamanan gagal. Coba kembali.' }
    }

    const allowed = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
    if (allowed.length > 0 && (!result.hostname || !allowed.includes(result.hostname.toLowerCase()))) {
      return { ok: false as const, error: 'Pemeriksaan keamanan gagal. Coba kembali.' }
    }
    return { ok: true as const }
  } catch {
    return { ok: false as const, error: 'Pemeriksaan keamanan belum dapat diproses.' }
  }
}

function safeProvisioningError(code: string | null) {
  if (!code) return null
  if (code === 'provisioning_configuration_unavailable') {
    return 'Tim Webzoka sedang menyelesaikan konfigurasi portal Anda.'
  }
  if (code === 'core_finalization_failed') {
    return 'Aktivasi akun Core belum selesai. Data verifikasi tetap tersimpan dan proses dapat dicoba kembali.'
  }
  return 'Portal Stock belum berhasil disiapkan. Data akun Anda tetap aman dan proses dapat dicoba kembali.'
}

export async function getOnboardingStatus(
  requestId: string,
  ownerUserId?: string,
): Promise<CustomerOnboardingStatus | null> {
  if (!isUuid(requestId)) return null
  const db = createAdminClient()
  let query = db
    .from('customer_onboarding')
    .select('id, status, business_name, owner_email, plan_id, trial_ends_at, portal_tenant_id, last_error_code, updated_at')
    .eq('id', requestId)
  if (ownerUserId) query = query.eq('owner_user_id', ownerUserId)
  const { data } = await query.maybeSingle()
  if (!data) return null

  const { data: plan } = await db
    .from('subscription_plans')
    .select('tier_display_name, name')
    .eq('id', data.plan_id)
    .maybeSingle()
  const staleProvisioning = data.status === 'provisioning' &&
    Date.now() - new Date(data.updated_at).getTime() > 2 * 60_000
  return {
    id: data.id,
    status: data.status as OnboardingStatus,
    businessName: data.business_name,
    ownerEmail: data.owner_email,
    planName: plan?.tier_display_name || plan?.name || 'Stock',
    trialEndsAt: data.trial_ends_at,
    coreReady: Boolean(data.trial_ends_at),
    portalTenantId: data.portal_tenant_id,
    canRetry: data.status === 'portal_failed' || data.status === 'needs_attention' || staleProvisioning,
    safeError: staleProvisioning
      ? 'Setup memerlukan percobaan ulang. Data akun Anda tetap aman dan tidak akan dibuat ganda.'
      : safeProvisioningError(data.last_error_code),
  }
}

export async function getLatestOnboardingForUser(ownerUserId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('customer_onboarding')
    .select('id')
    .eq('owner_user_id', ownerUserId)
    .eq('platform', 'stock')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ? getOnboardingStatus(data.id, ownerUserId) : null
}

export async function sendStockReadyEmail(requestId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('customer_onboarding')
    .select('owner_email, owner_name, business_name')
    .eq('id', requestId)
    .maybeSingle()

  if (!data) return
  const hubUrl = new URL('/hub', hubAppUrl()).toString()
  try {
    await sendEmail({
      to: data.owner_email,
      subject: `Webzoka Stock untuk ${data.business_name} sudah siap`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#10213f">
          <p style="color:#1769e0;font-size:11px;font-weight:700;letter-spacing:.12em">AKUN SIAP</p>
          <h1 style="font-size:24px">Halo ${escapeHtml(data.owner_name)},</h1>
          <p style="color:#65748b;line-height:1.65">Customer Hub dan Webzoka Stock untuk <strong>${escapeHtml(data.business_name)}</strong> sudah aktif. Masuk ke Hub, lalu pilih “Buka Stock dengan SSO”.</p>
          <a href="${escapeHtml(hubUrl)}" style="display:inline-block;background:#1769e0;color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:14px 20px">Buka Customer Hub</a>
        </div>
      `,
    })
  } catch {
    console.warn('[CustomerOnboarding] Ready email failed', { requestId })
  }
}
