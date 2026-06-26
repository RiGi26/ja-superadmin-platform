import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, User, CreditCard, Clock, Users, AlertTriangle } from 'lucide-react'
import { TenantLifecycleActions, type PlanOption } from '@/components/dashboard/TenantLifecycleActions'

const PLATFORM_LABEL: Record<string, string> = {
  lms: 'Webzoka LMS', clinic: 'Webzoka Clinic',
  pharmacy: 'Webzoka Pharmacy', jastip: 'Webzoka Jastip',
  travel: 'Webzoka Travel', stock: 'Portal Operasi (Stock)',
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
  trial_started         : 'Trial dimulai',
  trial_extended        : 'Trial diperpanjang',
  subscription_activated: 'Subscription aktif',
  subscription_extended : 'Subscription diperpanjang',
  subscription_cancelled: 'Subscription dibatalkan',
  payment_received      : 'Pembayaran diterima',
  payment_failed        : 'Pembayaran gagal',
  plan_changed          : 'Plan diubah',
  suspended             : 'Ditangguhkan',
  reactivated           : 'Diaktifkan kembali',
}

function safeFormat(date: string | null | undefined, fmt: string): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return format(d, fmt, { locale: localeId })
}

type Tenant = {
  id: string; name: string; slug: string
  platform: string | null; status: string; plan_tier: string | null
  owner_user_id: string | null; linked_tenant_id: string | null
  trial_ends_at: string | null; created_at: string
}
type Owner    = { full_name: string; email: string; phone: string | null } | null
type Sub      = { status: string; current_period_start: string | null; plan_id: string | null } | null
type Plan     = { tier_display_name: string; price_monthly: number } | null
type Member   = { user_id: string; role: string; joined_at: string | null }
type Event    = { id: string; event_type: string; created_at: string | null }
type UserRow  = { id: string; full_name: string; email: string }

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = createAdminClient()

  // Tenant dulu — 404 kalau tidak ada, biarkan Next.js handle
  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('id, name, slug, platform, status, plan_tier, owner_user_id, linked_tenant_id, trial_ends_at, created_at')
    .eq('id', id)
    .maybeSingle()

  if (tenantErr) {
    console.error('[TenantDetailPage] Query tenant error:', tenantErr.message)
  }
  if (!tenant) notFound()

  // Query sisanya di dalam try-catch — error di sini tidak boleh crash halaman
  let owner      : Owner   = null
  let subscription: Sub    = null
  let plan       : Plan    = null
  let members    : Member[]                              = []
  let events     : Event[]                               = []
  let memberUsers: Record<string, { full_name: string; email: string }> = {}
  let plansForPlatform: PlanOption[] = []
  let fetchError : string | null = null

  try {
    const [
      { data: ownerData },
      { data: subData },
      { data: membersData },
      { data: eventsData },
    ] = await Promise.all([
      (tenant as Tenant).owner_user_id
        ? db.from('users')
            .select('full_name, email, phone')
            .eq('id', (tenant as Tenant).owner_user_id!)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),

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

    owner        = ownerData as Owner
    subscription = subData   as Sub
    members      = (membersData ?? []) as Member[]
    events       = (eventsData  ?? []) as Event[]

    if (subscription?.plan_id) {
      const { data: planData } = await db
        .from('subscription_plans')
        .select('tier_display_name, price_monthly')
        .eq('id', subscription.plan_id)
        .maybeSingle()
      plan = planData
    }

    // Paket aktif untuk platform tenant — opsi ganti-paket & link bayar.
    if ((tenant as Tenant).platform) {
      const { data: planRows } = await db
        .from('subscription_plans')
        .select('id, tier_display_name, price_monthly, price_yearly')
        .eq('platform', (tenant as Tenant).platform!)
        .eq('is_active', true)
        .order('price_monthly', { ascending: true })
      plansForPlatform = (planRows ?? []) as PlanOption[]
    }

    const memberUserIds = members.map(m => m.user_id).filter(Boolean)
    if (memberUserIds.length > 0) {
      const { data: mu } = await db
        .from('users')
        .select('id, full_name, email')
        .in('id', memberUserIds)
      if (mu) {
        memberUsers = Object.fromEntries(
          (mu as UserRow[]).map(u => [u.id, u])
        )
      }
    }
  } catch (err) {
    console.error('[TenantDetailPage] Data fetch error:', err)
    fetchError = err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data.'
  }

  const t          = tenant as Tenant
  const trialEndsAt = t.trial_ends_at
  const now        = new Date()
  const daysLeft   = trialEndsAt
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
            <h1 className="text-xl font-semibold text-foreground">{t.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono">{t.slug}.webzoka.com</p>
          </div>
          <Badge className={`text-xs border flex-shrink-0 ${STATUS_BADGE[t.status] ?? 'bg-muted text-muted-foreground'}`}>
            {STATUS_LABEL[t.status] ?? t.status}
          </Badge>
        </div>
      </div>

      {/* Error state — secondary data gagal, header tetap tampil */}
      {fetchError && (
        <div className="flex items-start gap-3 bg-red-950/50 border border-red-900 rounded-xl p-4">
          <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">Sebagian data gagal dimuat</p>
            <p className="text-xs text-red-400/70 mt-0.5 font-mono">{fetchError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info Tenant */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Building2 size={14} /> Informasi Tenant
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Platform" value={PLATFORM_LABEL[t.platform ?? ''] ?? t.platform ?? '-'} />
            <Row label="Plan"     value={t.plan_tier ?? '-'} capitalize />
            <Row label="Dibuat"   value={safeFormat(t.created_at, 'd MMM yyyy')} />
            {trialEndsAt && (
              <Row
                label="Trial berakhir"
                value={`${safeFormat(trialEndsAt, 'd MMM yyyy')}${daysLeft !== null ? ` (${daysLeft > 0 ? `${daysLeft} hari lagi` : 'sudah berakhir'})` : ''}`}
                highlight={daysLeft !== null && daysLeft <= 3}
              />
            )}
            {!!t.linked_tenant_id && (
              <Row label="Linked Tenant" value={t.linked_tenant_id} mono />
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
              <Row label="Nama"  value={owner.full_name ?? '-'} />
              <Row label="Email" value={owner.email ?? '-'} mono />
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
              <Row label="Mulai"  value={safeFormat(subscription.current_period_start, 'd MMM yyyy')} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada subscription.</p>
          )}
        </div>

        {/* Members */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Users size={14} /> Members ({members.length})
          </div>
          <div className="space-y-0">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada members.</p>
            ) : members.map(m => {
              const u = memberUsers[m.user_id]
              return (
                <div key={m.user_id} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                  <div>
                    <p className="text-sm text-foreground">{u?.full_name ?? '-'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{u?.email ?? '-'}</p>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Kelola Langganan (aksi manual superadmin) */}
      <TenantLifecycleActions
        tenantId={t.id}
        status={t.status}
        currentPlanId={subscription?.plan_id ?? null}
        plans={plansForPlatform}
      />

      {/* Event Log */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
          <Clock size={14} /> Riwayat Aktivitas
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
        ) : (
          <div>
            {events.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-foreground">{EVENT_LABEL[ev.event_type] ?? ev.event_type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {safeFormat(ev.created_at, 'd MMM yyyy, HH:mm')}
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
