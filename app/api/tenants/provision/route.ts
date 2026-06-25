import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================
// POST /api/tenants/provision — register an external-platform tenant (Stock) in
// the Core DB so it can be billed. Called by the Stock portal at self-service
// signup. HMAC-SHA256 over `${ts}\n${nonce}\n${rawBody}` with BILLING_SYNC_SECRET
// (same scheme as the Stock /api/billing/sync §8). Idempotent on (linked_tenant_id,
// platform). Grants a 14-day trial = full Pro (enterprise tier). Returns the Core
// tenant id, which the portal stores and later embeds in the checkout token.
// ============================================================
export const dynamic = 'force-dynamic'

const MAX_SKEW_MS = 5 * 60_000
const TRIAL_DAYS = 14

function verifyHmac(rawBody: string, headers: Headers, secret: string): boolean {
  const ts = headers.get('x-ja-timestamp')
  const nonce = headers.get('x-ja-nonce')
  const sig = headers.get('x-ja-signature')
  if (!ts || !nonce || !sig) return false
  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > MAX_SKEW_MS) return false
  const expected = crypto.createHmac('sha256', secret).update(`${ts}\n${nonce}\n${rawBody}`).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function slugify(input: string): string {
  return input.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '').slice(0, 40)
}

export async function POST(request: Request) {
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret) {
    console.error('[tenants/provision] BILLING_SYNC_SECRET belum di-set')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  const rawBody = await request.text()
  if (!verifyHmac(rawBody, request.headers, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const platform = typeof body.platform === 'string' ? body.platform : ''
  const linkedTenantId = typeof body.linked_tenant_id === 'string' ? body.linked_tenant_id : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : null
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null
  let slug = typeof body.slug === 'string' ? slugify(body.slug) : ''

  if (platform !== 'stock') return NextResponse.json({ error: 'unsupported_platform' }, { status: 400 })
  if (!linkedTenantId || !name) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  if (!slug) slug = slugify(name) || 'tenant'

  const db = createAdminClient()

  // Idempotent: already provisioned → return existing Core id.
  const { data: existing } = await db
    .from('tenants')
    .select('id')
    .eq('platform', 'stock')
    .eq('linked_tenant_id', linkedTenantId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ core_tenant_id: existing.id, reused: true })
  }

  // Ensure a globally-unique slug (tenants.slug is unique across platforms).
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle()
    if (!clash) break
    slug = `${slugify(name) || 'stock'}-${Math.random().toString(36).slice(2, 7)}`
  }

  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Trial = full Pro features → enterprise tier in Core.
  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .insert({
      name,
      slug,
      platform: 'stock',
      status: 'trial',
      plan_tier: 'enterprise',
      email,
      phone,
      linked_tenant_id: linkedTenantId,
      trial_ends_at: trialEnds,
      metadata: { source: 'stock-self-signup' },
    })
    .select('id')
    .single()
  if (tErr || !tenant) {
    console.error('[tenants/provision] tenant insert failed:', tErr)
    return NextResponse.json({ error: 'provision_failed' }, { status: 500 })
  }

  // Trial subscription bound to the stock enterprise plan (authoritative tier).
  const { data: plan } = await db
    .from('subscription_plans')
    .select('id')
    .eq('platform', 'stock')
    .eq('tier', 'enterprise')
    .maybeSingle()

  const { error: subErr } = await db.from('tenant_subscriptions').insert({
    tenant_id: tenant.id,
    plan_id: plan?.id ?? null,
    status: 'trial',
    trial_ends_at: trialEnds,
    current_period_end: trialEnds,
  })
  if (subErr) console.error('[tenants/provision] subscription insert failed (non-fatal):', subErr.message)

  await db.from('subscription_events').insert({
    tenant_id: tenant.id,
    event_type: 'trial_started',
    payload: { source: 'stock-self-signup', linked_tenant_id: linkedTenantId },
  })

  return NextResponse.json({ core_tenant_id: tenant.id })
}
