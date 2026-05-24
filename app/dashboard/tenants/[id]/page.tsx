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
  suspended: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  cancelled: 'bg-zinc-800 text-zinc-500 border-zinc-700',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif', trial: 'Trial', past_due: 'Menunggak',
  suspended: 'Ditangguhkan', cancelled: 'Dibatalkan',
}
const EVENT_LABEL: Record<string, string> = {
  trial_started   : 'Trial dimulai',
  trial_extended  : 'Trial diperpanjang',
  subscription_activated: 'Subscription aktif',
  subscription_cancelled: 'Subscription dibatalkan',
  payment_received: 'Pembayaran diterima',
  payment_failed  : 'Pembayaran gagal',
  plan_changed    : 'Plan diubah',
  suspended       : 'Ditangguhkan',
  reactivated     : 'Diaktifkan kembali',
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = createAdminClient()

  const [
    { data: tenant },
    { data: subscription },
    { data: members },
    { data: events },
  ] = await Promise.all([
    db.from('tenants')
      .select('*, users!tenants_owner_user_id_fkey(full_name, email, phone)')
      .eq('id', id)
      .single(),
    db.from('tenant_subscriptions')
      .select('*, subscription_plans(tier_display_name, price_monthly)')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    db.from('tenant_members')
      .select('*, users(full_name, email, role)')
      .eq('tenant_id', id)
      .order('joined_at', { ascending: false }),
    db.from('subscription_events')
      .select('*')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!tenant) notFound()

  const owner = (tenant as Record<string, unknown>).users as { full_name: string; email: string; phone?: string } | null
  const sub   = subscription as Record<string, unknown> | null
  const plan  = sub?.subscription_plans as { tier_display_name: string; price_monthly: number } | null

  const trialEndsAt = (tenant as Record<string, unknown>).trial_ends_at as string | null
  const daysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000)
    : null

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div>
        <Link
          href="/dashboard/tenants"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4"
        >
          <ArrowLeft size={14} /> Kembali ke daftar tenant
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{(tenant as Record<string, unknown>).name as string}</h1>
            <p className="text-sm text-zinc-500 mt-0.5 font-mono">{(tenant as Record<string, unknown>).slug as string}.japanarenacorp.com</p>
          </div>
          <Badge className={`text-xs border ${STATUS_BADGE[(tenant as Record<string, unknown>).status as string] ?? 'bg-zinc-800 text-zinc-400'}`}>
            {STATUS_LABEL[(tenant as Record<string, unknown>).status as string] ?? (tenant as Record<string, unknown>).status as string}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info Tenant */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
            <Building2 size={14} /> Informasi Tenant
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Platform" value={PLATFORM_LABEL[(tenant as Record<string, unknown>).platform as string] ?? (tenant as Record<string, unknown>).platform as string} />
            <Row label="Plan"     value={(tenant as Record<string, unknown>).plan_tier as string ?? '-'} capitalize />
            <Row label="Dibuat"   value={format(new Date((tenant as Record<string, unknown>).created_at as string), 'd MMM yyyy', { locale: localeId })} />
            {trialEndsAt && (
              <Row
                label="Trial berakhir"
                value={`${format(new Date(trialEndsAt), 'd MMM yyyy', { locale: localeId })}${daysLeft !== null ? ` (${daysLeft > 0 ? `${daysLeft} hari lagi` : 'sudah berakhir'})` : ''}`}
                highlight={daysLeft !== null && daysLeft <= 3}
              />
            )}
            {!!(tenant as Record<string, unknown>).linked_tenant_id && (
              <Row label="Linked Tenant ID" value={(tenant as Record<string, unknown>).linked_tenant_id as string} mono />
            )}
          </div>
        </div>

        {/* Info Owner */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
            <User size={14} /> Owner
          </div>
          {owner ? (
            <div className="space-y-3 text-sm">
              <Row label="Nama"   value={owner.full_name} />
              <Row label="Email"  value={owner.email} mono />
              <Row label="WA"     value={owner.phone ?? '-'} mono />
            </div>
          ) : (
            <p className="text-sm text-zinc-600">Data owner tidak ditemukan.</p>
          )}
        </div>

        {/* Subscription */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
            <CreditCard size={14} /> Subscription
          </div>
          {sub ? (
            <div className="space-y-3 text-sm">
              <Row label="Plan"   value={plan?.tier_display_name ?? '-'} />
              <Row label="Harga"  value={plan ? `Rp ${plan.price_monthly.toLocaleString('id-ID')}/bln` : '-'} />
              <Row label="Status" value={STATUS_LABEL[sub.status as string] ?? sub.status as string} />
              <Row label="Mulai"  value={format(new Date(sub.current_period_start as string), 'd MMM yyyy', { locale: localeId })} />
            </div>
          ) : (
            <p className="text-sm text-zinc-600">Belum ada subscription.</p>
          )}
        </div>

        {/* Members */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
            <Users size={14} /> Members ({(members ?? []).length})
          </div>
          <div className="space-y-2">
            {(members ?? []).length === 0 ? (
              <p className="text-sm text-zinc-600">Tidak ada members.</p>
            ) : (members ?? []).map((m: Record<string, unknown>) => {
              const u = m.users as { full_name: string; email: string } | null
              return (
                <div key={m.user_id as string} className="flex items-center justify-between py-1.5 border-b border-zinc-800/60 last:border-0">
                  <div>
                    <p className="text-sm text-zinc-200">{u?.full_name ?? '-'}</p>
                    <p className="text-xs text-zinc-600 font-mono">{u?.email ?? '-'}</p>
                  </div>
                  <span className="text-xs text-zinc-500 capitalize">{m.role as string}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
          <Clock size={14} /> Riwayat Aktivitas
        </div>
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-zinc-600">Belum ada aktivitas.</p>
        ) : (
          <div className="space-y-0">
            {(events ?? []).map((ev: Record<string, unknown>) => (
              <div key={ev.id as string} className="flex items-start gap-3 py-3 border-b border-zinc-800/50 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300">{EVENT_LABEL[ev.event_type as string] ?? ev.event_type as string}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
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
      <span className="text-zinc-500 flex-shrink-0">{label}</span>
      <span className={`text-right ${capitalize ? 'capitalize' : ''} ${mono ? 'font-mono text-xs' : ''} ${highlight ? 'text-red-400' : 'text-zinc-200'}`}>
        {value}
      </span>
    </div>
  )
}
