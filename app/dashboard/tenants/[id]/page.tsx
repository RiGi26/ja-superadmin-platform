import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, User, CreditCard, Clock, Users } from 'lucide-react'

const PLATFORM_LABEL: Record<string, string> = {
  lms: 'Japan Arena LMS', clinic: 'Japan Arena Clinic',
  pharmacy: 'Japan Arena Pharmacy', jastip: 'Japan Arena Jastip',
}
const STATUS_BADGE: Record<string, string> = {
  active   : 'bg-green-950 text-green-300 border-green-800',
  trial    : 'bg-yellow-950 text-yellow-300 border-yellow-800',
  past_due : 'bg-red-950 text-red-300 border-red-800',
  suspended: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-muted text-muted-foreground border-border',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif', trial: 'Trial', past_due: 'Menunggak',
  suspended: 'Ditangguhkan', cancelled: 'Dibatalkan',
}
const EVENT_LABEL: Record<string, string> = {
  trial_started        : 'Trial dimulai',
  trial_extended       : 'Trial diperpanjang',
  subscription_activated: 'Subscription aktif',
  subscription_cancelled: 'Subscription dibatalkan',
  payment_received     : 'Pembayaran diterima',
  payment_failed       : 'Pembayaran gagal',
  plan_changed         : 'Plan diubah',
  suspended            : 'Ditangguhkan',
  reactivated          : 'Diaktifkan kembali',
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = createAdminClient()

  // Query tenant dulu — jika tidak ada, 404
  const { data: tenant } = await db
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single()

  if (!tenant) notFound()

  // Query sisanya paralel, semua pakai maybeSingle() / tanpa single()
  const [
    { data: owner },
    { data: subscription },
    { data: members },
    { data: events },
  ] = await Promise.all([
    db.from('users')
      .select('full_name, email, phone')
      .eq('id', tenant.owner_user_id)
      .maybeSingle(),
    db.from('tenant_subscriptions')
      .select('status, current_period_start, plan_id')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('tenant_members')
      .select('user_id, role, joined_at')
      .eq('tenant_id', id)
      .order('joined_at', { ascending: false }),
    db.from('subscription_events')
      .select('id, event_type, created_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Query plan terpisah jika ada subscription
  let plan: { tier_display_name: string; price_monthly: number } | null = null
  if (subscription?.plan_id) {
    const { data } = await db
      .from('subscription_plans')
      .select('tier_display_name, price_monthly')
      .eq('id', subscription.plan_id)
      .maybeSingle()
    plan = data
  }

  // Ambil nama semua member
  const memberUserIds = (members ?? []).map((m: Record<string, unknown>) => m.user_id as string)
  let memberUsers: Record<string, { full_name: string; email: string }> = {}
  if (memberUserIds.length > 0) {
    const { data: mu } = await db
      .from('users')
      .select('id, full_name, email')
      .in('id', memberUserIds)
    if (mu) {
      memberUsers = Object.fromEntries(
        (mu as { id: string; full_name: string; email: string }[]).map(u => [u.id, u])
      )
    }
  }

  const trialEndsAt = tenant.trial_ends_at as string | null
  const now = new Date()
  const daysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / 86_400_000)
    : null

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div>
        <Link
          href="/dashboard/tenants"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={14} /> Kembali ke daftar tenant
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{tenant.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono">{tenant.slug}.japanarenacorp.com</p>
          </div>
          <Badge className={`text-xs border flex-shrink-0 ${STATUS_BADGE[tenant.status] ?? 'bg-muted text-muted-foreground'}`}>
            {STATUS_LABEL[tenant.status] ?? tenant.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info Tenant */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Building2 size={14} /> Informasi Tenant
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Platform" value={PLATFORM_LABEL[tenant.platform] ?? tenant.platform} />
            <Row label="Plan"     value={tenant.plan_tier ?? '-'} capitalize />
            <Row label="Dibuat"   value={format(new Date(tenant.created_at), 'd MMM yyyy', { locale: localeId })} />
            {trialEndsAt && (
              <Row
                label="Trial berakhir"
                value={`${format(new Date(trialEndsAt), 'd MMM yyyy', { locale: localeId })}${daysLeft !== null ? ` (${daysLeft > 0 ? `${daysLeft} hari lagi` : 'sudah berakhir'})` : ''}`}
                highlight={daysLeft !== null && daysLeft <= 3}
              />
            )}
            {!!tenant.linked_tenant_id && (
              <Row label="Linked Tenant" value={tenant.linked_tenant_id} mono />
            )}
          </div>
        </div>

        {/* Info Owner */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <User size={14} /> Owner
          </div>
          {owner ? (
            <div className="space-y-3 text-sm">
              <Row label="Nama"  value={owner.full_name} />
              <Row label="Email" value={owner.email} mono />
              <Row label="WA"    value={owner.phone ?? '-'} mono />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Data owner tidak ditemukan.</p>
          )}
        </div>

        {/* Subscription */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <CreditCard size={14} /> Subscription
          </div>
          {subscription ? (
            <div className="space-y-3 text-sm">
              <Row label="Plan"   value={plan?.tier_display_name ?? '-'} />
              <Row label="Harga"  value={plan ? `Rp ${plan.price_monthly.toLocaleString('id-ID')}/bln` : '-'} />
              <Row label="Status" value={STATUS_LABEL[subscription.status] ?? subscription.status} />
              <Row label="Mulai"  value={format(new Date(subscription.current_period_start), 'd MMM yyyy', { locale: localeId })} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada subscription.</p>
          )}
        </div>

        {/* Members */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Users size={14} /> Members ({(members ?? []).length})
          </div>
          <div className="space-y-0">
            {(members ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada members.</p>
            ) : (members ?? []).map((m: Record<string, unknown>) => {
              const u = memberUsers[m.user_id as string]
              return (
                <div key={m.user_id as string} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                  <div>
                    <p className="text-sm text-foreground">{u?.full_name ?? '-'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{u?.email ?? '-'}</p>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{m.role as string}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
          <Clock size={14} /> Riwayat Aktivitas
        </div>
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
        ) : (
          <div>
            {(events ?? []).map((ev: Record<string, unknown>) => (
              <div key={ev.id as string} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-foreground">{EVENT_LABEL[ev.event_type as string] ?? ev.event_type as string}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(ev.created_at as string), 'd MMM yyyy, HH:mm', { locale: localeId })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({
  label, value, capitalize, mono, highlight,
}: {
  label: string; value: string; capitalize?: boolean; mono?: boolean; highlight?: boolean
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span className={`text-right break-all ${capitalize ? 'capitalize' : ''} ${mono ? 'font-mono text-xs' : ''} ${highlight ? 'text-red-400' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}
