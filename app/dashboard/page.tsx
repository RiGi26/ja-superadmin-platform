import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, TrendingUp, CalendarClock, AlertTriangle } from 'lucide-react'
import { format, startOfMonth, addDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const PLATFORM_LABEL: Record<string, string> = {
  lms: 'LMS', clinic: 'Clinic', pharmacy: 'Pharmacy', jastip: 'Jastip',
}

export default async function DashboardPage() {
  const db = createAdminClient()
  const now = new Date()

  const [
    { data: tenants },
    { data: expiringSoon },
    { data: recentEvents },
  ] = await Promise.all([
    db.from('tenants').select('id, platform, status, created_at'),
    db.from('tenant_subscriptions')
      .select('id, tenant_id, status, trial_ends_at, current_period_end, tenant:tenants(name, platform)')
      .in('status', ['trial', 'active'])
      .or(`trial_ends_at.lte.${addDays(now, 7).toISOString()},current_period_end.lte.${addDays(now, 7).toISOString()}`),
    db.from('subscription_events')
      .select('id, tenant_id, event_type, created_at, tenant:tenants(name, platform)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const allTenants = tenants ?? []
  const active    = allTenants.filter(t => t.status === 'active').length
  const trial     = allTenants.filter(t => t.status === 'trial').length
  const monthStart = startOfMonth(now).toISOString()
  const newThisMonth = allTenants.filter(t => t.created_at >= monthStart).length

  const platforms = ['lms', 'clinic', 'pharmacy', 'jastip']
  const breakdown = platforms.map(p => ({
    platform  : p,
    trial     : allTenants.filter(t => t.platform === p && t.status === 'trial').length,
    active    : allTenants.filter(t => t.platform === p && t.status === 'active').length,
    suspended : allTenants.filter(t => t.platform === p && t.status === 'suspended').length,
    total     : allTenants.filter(t => t.platform === p).length,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Overview semua platform JapanarEna Corp</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Tenant Aktif',        value: active,        icon: Building2,     color: 'text-green-400' },
          { label: 'Sedang Trial',         value: trial,         icon: TrendingUp,    color: 'text-blue-400' },
          { label: 'Baru Bulan Ini',       value: newThisMonth,  icon: CalendarClock, color: 'text-purple-400' },
          { label: 'Segera Expire (7hr)',  value: (expiringSoon ?? []).length, icon: AlertTriangle, color: 'text-yellow-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</p>
                <Icon size={15} className={color} />
              </div>
              <p className="text-3xl font-bold text-zinc-100">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Breakdown per Platform */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-zinc-300">Breakdown per Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="pb-2 text-left font-medium">Platform</th>
                <th className="pb-2 text-right font-medium">Trial</th>
                <th className="pb-2 text-right font-medium">Aktif</th>
                <th className="pb-2 text-right font-medium">Suspended</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map(row => (
                <tr key={row.platform} className="border-b border-zinc-800/50 last:border-0">
                  <td className="py-3 font-medium text-zinc-200">{PLATFORM_LABEL[row.platform]}</td>
                  <td className="py-3 text-right text-blue-400">{row.trial}</td>
                  <td className="py-3 text-right text-green-400">{row.active}</td>
                  <td className="py-3 text-right text-zinc-500">{row.suspended}</td>
                  <td className="py-3 text-right font-semibold text-zinc-200">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-zinc-300">Aktivitas Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {(recentEvents ?? []).length === 0 ? (
            <p className="text-sm text-zinc-600">Belum ada aktivitas.</p>
          ) : (
            <div className="space-y-3">
              {(recentEvents ?? []).map((ev: Record<string, unknown>) => {
                const tenant = ev.tenant as { name?: string; platform?: string } | null
                return (
                  <div key={ev.id as string} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-200 font-medium">
                        {tenant?.name ?? 'Unknown'}
                        <Badge variant="outline" className="ml-2 text-[10px] border-zinc-700 text-zinc-500">
                          {PLATFORM_LABEL[tenant?.platform ?? ''] ?? tenant?.platform}
                        </Badge>
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{ev.event_type as string}</p>
                    </div>
                    <p className="text-xs text-zinc-600">
                      {format(new Date(ev.created_at as string), 'd MMM HH:mm', { locale: localeId })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
