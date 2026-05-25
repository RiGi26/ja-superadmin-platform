import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { format, differenceInDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { CreditCard } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  active  : 'bg-green-950 text-green-300 border-green-800',
  trial   : 'bg-blue-950 text-blue-300 border-blue-800',
  past_due: 'bg-red-950 text-red-300 border-red-800',
  cancelled: 'bg-muted text-muted-foreground border-border',
  expired : 'bg-muted text-muted-foreground border-border',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif', trial: 'Trial', past_due: 'Menunggak',
  cancelled: 'Dibatalkan', expired: 'Kedaluwarsa',
}

interface SearchParams { status?: string }

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const statusFilter = params.status ?? ''

  const db = createAdminClient()
  let query = db
    .from('tenant_subscriptions')
    .select(`
      id, tenant_id, status, trial_ends_at,
      current_period_end, grace_period_ends_at, cancelled_at,
      tenant:tenants(name, platform, slug),
      plan:subscription_plans(tier_display_name, price_monthly)
    `)
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data: subscriptions } = await query

  const now = new Date()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{(subscriptions ?? []).length} subscription</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['', 'active', 'trial', 'past_due', 'cancelled'].map(s => (
          <a key={s} href={s ? `?status=${s}` : '/dashboard/subscriptions'}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground border-primary font-medium'
                : 'bg-card border-border text-muted-foreground hover:border-muted-foreground'
            }`}>
            {s ? STATUS_LABEL[s] : 'Semua'}
          </a>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-medium">Tenant</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Berakhir</th>
              <th className="px-4 py-3 text-left font-medium">Sisa Hari</th>
            </tr>
          </thead>
          <tbody>
            {(subscriptions ?? []).map((s: Record<string, unknown>) => {
              const tenant = s.tenant as { name?: string; platform?: string; slug?: string } | null
              const plan   = s.plan   as { tier_display_name?: string; price_monthly?: number } | null
              const endDate = (s.trial_ends_at ?? s.current_period_end) as string | null
              const daysLeft = endDate ? differenceInDays(new Date(endDate), now) : null
              const isUrgent = daysLeft !== null && daysLeft <= 3 && ['trial', 'active'].includes(s.status as string)

              return (
                <tr key={s.id as string}
                  className={`border-b border-border/60 last:border-0 ${isUrgent ? 'bg-red-950/20' : 'hover:bg-muted/50'} transition-colors`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{tenant?.name}</p>
                    <p className="text-xs text-muted-foreground">{tenant?.slug} · {tenant?.platform}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{plan?.tier_display_name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs border ${STATUS_BADGE[s.status as string] ?? ''}`}>
                      {STATUS_LABEL[s.status as string] ?? s.status as string}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {endDate ? format(new Date(endDate), 'd MMM yyyy', { locale: localeId }) : '-'}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${
                    daysLeft !== null && daysLeft <= 3 ? 'text-red-400' :
                    daysLeft !== null && daysLeft <= 7 ? 'text-yellow-400' : 'text-muted-foreground'
                  }`}>
                    {daysLeft !== null ? `${daysLeft} hari` : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {(subscriptions ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <CreditCard size={28} className="text-muted-foreground/50" />
            </div>
            <p className="text-base font-medium text-foreground">Tidak ada data ditemukan</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">Belum ada data subscription yang tersedia saat ini.</p>
          </div>
        )}
      </div>
    </div>
  )
}
