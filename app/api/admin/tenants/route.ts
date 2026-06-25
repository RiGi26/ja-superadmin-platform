import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySuperadmin } from '@/lib/auth'
import { Resend } from 'resend'
import { addDays } from 'date-fns'


const PLATFORM_LABEL: Record<string, string> = {
  lms: 'Webzoka LMS', clinic: 'Webzoka Clinic',
  pharmacy: 'Webzoka Pharmacy', jastip: 'Webzoka Jastip',
  travel: 'Webzoka Travel', stock: 'Portal Operasi (Stock)',
}

export async function POST(request: Request) {
  // Re-verify superadmin di API layer
  if (!(await verifySuperadmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    name: string; slug: string; platform: string; plan_id: string
    owner_name: string; owner_email: string; owner_phone?: string
    linked_tenant_id?: string
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 }) }

  const { name, slug, platform, plan_id, owner_name, owner_email, owner_phone, linked_tenant_id } = body

  if (!name || !slug || !platform || !plan_id || !owner_name || !owner_email) {
    return NextResponse.json({ error: 'Field wajib tidak lengkap.' }, { status: 400 })
  }

  const db = createAdminClient()

  // 1. Validasi: slug belum ada
  const { data: existingSlug } = await db.from('tenants').select('id').eq('slug', slug).single()
  if (existingSlug) {
    return NextResponse.json({ error: `Slug "${slug}" sudah dipakai.` }, { status: 409 })
  }

  // 2. Validasi: email belum terdaftar
  const { data: existingUsers } = await db.auth.admin.listUsers()
  const emailTaken = existingUsers?.users?.some(u => u.email === owner_email)
  if (emailTaken) {
    return NextResponse.json({ error: `Email "${owner_email}" sudah terdaftar.` }, { status: 409 })
  }

  // 3. Get plan details
  const { data: plan } = await db.from('subscription_plans')
    .select('id, tier_display_name, price_monthly')
    .eq('id', plan_id).single()
  if (!plan) return NextResponse.json({ error: 'Plan tidak ditemukan.' }, { status: 404 })

  const temporaryPassword = owner_phone || 'JapanarEna2024!'
  const trialEndsAt = addDays(new Date(), 14).toISOString()
  const now = new Date().toISOString()

  // 4. Buat auth user
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email             : owner_email,
    password          : temporaryPassword,
    email_confirm     : true,
    user_metadata     : { full_name: owner_name },
  })
  if (authErr || !authUser.user) {
    return NextResponse.json({ error: authErr?.message ?? 'Gagal buat auth user.' }, { status: 500 })
  }
  const userId = authUser.user.id

  // 5. Insert tenant
  const { data: tenant, error: tenantErr } = await db.from('tenants').insert({
    name, slug, platform,
    status            : 'trial',
    plan_tier         : plan.tier_display_name.toLowerCase(),
    owner_user_id     : userId,
    linked_tenant_id  : linked_tenant_id ?? null,
    trial_ends_at     : trialEndsAt,
    metadata          : {},
    created_at        : now,
    updated_at        : now,
  }).select().single()

  if (tenantErr || !tenant) {
    await db.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: tenantErr?.message ?? 'Gagal buat tenant.' }, { status: 500 })
  }

  // 6. Insert users table
  await db.from('users').insert({
    id        : userId,
    tenant_id : tenant.id,
    full_name : owner_name,
    email     : owner_email,
    phone     : owner_phone ?? null,
    role      : 'admin',
    status    : 'active',
    created_at: now,
  })

  // 7. Insert tenant_members
  await db.from('tenant_members').insert({
    tenant_id    : tenant.id,
    user_id      : userId,
    role         : 'owner',
    platform_role: null,
    invited_by   : null,
    joined_at    : now,
    is_active    : true,
  })

  // 8. Insert tenant_subscriptions
  const { data: subscription } = await db.from('tenant_subscriptions').insert({
    tenant_id           : tenant.id,
    plan_id             : plan_id,
    status              : 'trial',
    trial_ends_at       : trialEndsAt,
    current_period_start: now,
    created_at          : now,
    updated_at          : now,
  }).select().single()

  // 9. Insert subscription_event
  await db.from('subscription_events').insert({
    tenant_id  : tenant.id,
    event_type : 'trial_started',
    payload    : { plan_id, trial_ends_at: trialEndsAt, subscription_id: subscription?.id },
    created_at : now,
  })

  // 10. Kirim welcome email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY)
  const platformLabel = PLATFORM_LABEL[platform] ?? platform
  const trialDate = new Date(trialEndsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  try {
    await resend.emails.send({
      from   : process.env.RESEND_FROM_EMAIL ?? 'noreply@japanarenacorp.com',
      to     : owner_email,
      subject: `Selamat datang di ${platformLabel} — ${name}`,
      html   : `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #111;">Halo ${owner_name},</h2>
          <p>Akun <strong>${platformLabel}</strong> untuk <strong>${name}</strong> sudah siap!</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #555;">Detail akses:</p>
            <table style="font-size: 14px; width: 100%;">
              <tr><td style="padding: 4px 0; color: #555; width: 100px;">Email</td><td><strong>${owner_email}</strong></td></tr>
              <tr><td style="padding: 4px 0; color: #555;">Password</td><td><strong>${temporaryPassword}</strong></td></tr>
              <tr><td style="padding: 4px 0; color: #555;">Trial hingga</td><td><strong>${trialDate}</strong></td></tr>
            </table>
          </div>
          <p style="font-size: 13px; color: #777;">Silakan login dan ganti password setelah masuk pertama kali.</p>
          <p style="font-size: 13px; color: #777;">Butuh bantuan? Hubungi kami via WhatsApp.</p>
          <p style="margin-top: 24px; font-size: 12px; color: #aaa;">Tim Webzoka</p>
        </div>
      `,
    })
  } catch (emailErr) {
    console.warn('[Resend] Welcome email gagal terkirim ke', owner_email, ':', emailErr)
  }

  return NextResponse.json({
    tenant,
    owner            : { email: owner_email, temporaryPassword },
    subscription_id  : subscription?.id,
  })
}
