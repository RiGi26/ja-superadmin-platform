import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================
// POST /api/tenants/provision — register an external-platform tenant in the Core
// DB so it can be billed. Called by a portal at self-service signup (Stock, Clinic,
// Pharmacy, Rental). HMAC-SHA256 over `${ts}\n${nonce}\n${rawBody}` with
// BILLING_SYNC_SECRET (same scheme as each portal's /api/billing/sync). Idempotent
// on (platform, linked_tenant_id). Grants a 14-day trial = full Pro (enterprise
// tier). Returns the Core tenant id, which the portal stores and later embeds in
// the checkout token.
// ============================================================
export const dynamic = 'force-dynamic'

const MAX_SKEW_MS = 5 * 60_000
const TRIAL_DAYS = 14

// Portals wired for self-subscribe provisioning. Core is generic (one `platform`
// column); this allowlist is the only per-portal gate. Add a portal here once its
// register→provision flow ships. (LMS mirrors via a direct Core client, not this
// endpoint, so it is intentionally absent.)
const SUPPORTED_PLATFORMS = new Set(['stock', 'clinic', 'pharmacy', 'rental'])

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
  // Optional caller-provided Core id. When present, the Core tenant is created with
  // this exact id (SAME-ID model, e.g. Pharmacy/LMS where portal id == Core id);
  // when absent, Core generates its own id (NEW-ID model, e.g. Stock/Clinic which
  // store the returned id as linked_tenant_id). Both flow through this one endpoint.
  const providedId = typeof body.tenant_id === 'string' && body.tenant_id.trim() ? body.tenant_id.trim() : null
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : null
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null
  let slug = typeof body.slug === 'string' ? slugify(body.slug) : ''

  if (!SUPPORTED_PLATFORMS.has(platform)) return NextResponse.json({ error: 'unsupported_platform' }, { status: 400 })
  if (!linkedTenantId || !name) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  if (!slug) slug = slugify(name) || 'tenant'

  const db = createAdminClient()

  // Idempotent: already provisioned → return existing Core id.
  const { data: existing } = await db
    .from('tenants')
    .select('id')
    .eq('platform', platform)
    .eq('linked_tenant_id', linkedTenantId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ core_tenant_id: existing.id, reused: true })
  }

  // Ensure a globally-unique slug (tenants.slug is unique across platforms).
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle()
    if (!clash) break
    slug = `${slugify(name) || platform}-${Math.random().toString(36).slice(2, 7)}`
  }

  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Trial = full Pro features → enterprise tier in Core.
  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .insert({
      ...(providedId ? { id: providedId } : {}),
      name,
      slug,
      platform,
      status: 'trial',
      plan_tier: 'enterprise',
      email,
      phone,
      linked_tenant_id: linkedTenantId,
      trial_ends_at: trialEnds,
      metadata: { source: `${platform}-self-signup` },
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
    .eq('platform', platform)
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
    payload: { source: `${platform}-self-signup`, linked_tenant_id: linkedTenantId },
  })

  return NextResponse.json({ core_tenant_id: tenant.id })
}
