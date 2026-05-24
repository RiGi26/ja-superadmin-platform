import { createAdminClient } from '@/lib/supabase/admin'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

export default async function AuditPage() {
  const db = createAdminClient()
  const { data: events } = await db
    .from('subscription_events')
    .select('id, event_type, payload, created_at, tenant:tenants(name, platform)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">50 event terbaru</p>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-medium">Tenant</th>
              <th className="px-4 py-3 text-left font-medium">Event</th>
              <th className="px-4 py-3 text-left font-medium">Waktu</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((ev: Record<string, unknown>) => {
              const tenant = ev.tenant as { name?: string; platform?: string } | null
              return (
                <tr key={ev.id as string} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-foreground">{tenant?.name ?? '-'}</p>
                    <p className="text-xs text-muted-foreground">{tenant?.platform}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ev.event_type as string}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(ev.created_at as string), 'd MMM yyyy HH:mm', { locale: localeId })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
