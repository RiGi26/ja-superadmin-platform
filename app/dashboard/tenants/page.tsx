import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { TenantSearchInput } from '@/components/dashboard/TenantSearchInput'

const PLATFORM_BADGE: Record<string, string> = {
  lms      : 'bg-blue-950 text-blue-300 border-blue-800',
  clinic   : 'bg-green-950 text-green-300 border-green-800',
  pharmacy : 'bg-teal-950 text-teal-300 border-teal-800',
  jastip   : 'bg-orange-950 text-orange-300 border-orange-800',
}
const PLATFORM_LABEL: Record<string, string> = {
  lms: 'LMS', clinic: 'Clinic', pharmacy: 'Pharmacy', jastip: 'Jastip',
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

interface SearchParams { platform?: string; status?: string; q?: string; page?: string }

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const platform = params.platform ?? ''
  const status   = params.status   ?? ''
  const q        = params.q        ?? ''
  const page     = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize = 20

  const db = createAdminClient()
  let query = db
    .from('tenants')
    .select('id, name, slug, platform, status, plan_tier, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (platform) query = query.eq('platform', platform)
  if (status)   query = query.eq('status', status)
  if (q)        query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`)

  const { data: tenants, count } = await query

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  const buildUrl = (overrides: Record<string, string>) => {
    const p = { platform, status, q, page: String(page), ...overrides }
    const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/dashboard/tenants${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Semua Tenant</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{count ?? 0} tenant ditemukan</p>
        </div>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" render={<Link href="/dashboard/tenants/new" />}>
          + Buat Tenant
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <TenantSearchInput
          defaultValue={q}
          buildUrl={(val) => buildUrl({ q: val, page: '1' })}
        />
        {['', 'lms', 'clinic', 'pharmacy', 'jastip'].map(p => (
          <a key={p} href={buildUrl({ platform: p, page: '1' })}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              platform === p
                ? 'bg-primary text-primary-foreground border-primary font-medium'
                : 'bg-card border-border text-muted-foreground hover:border-muted-foreground'
            }`}>
            {p ? PLATFORM_LABEL[p] : 'Semua Platform'}
          </a>
        ))}
        {['', 'active', 'trial', 'past_due', 'suspended'].map(s => (
          <a key={s} href={buildUrl({ status: s, page: '1' })}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              status === s
                ? 'bg-primary text-primary-foreground border-primary font-medium'
                : 'bg-card border-border text-muted-foreground hover:border-muted-foreground'
            }`}>
            {s ? STATUS_LABEL[s] : 'Semua Status'}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-medium">Nama</th>
              <th className="px-4 py-3 text-left font-medium">Platform</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Dibuat</th>
              <th className="px-4 py-3 text-left font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(tenants ?? []).map((t: Record<string, unknown>) => (
              <tr key={t.id as string} className="border-b border-border/60 last:border-0 hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{t.name as string}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.slug as string}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge className={`text-xs border ${PLATFORM_BADGE[t.platform as string] ?? 'bg-muted text-muted-foreground border-border'}`}>
                    {PLATFORM_LABEL[t.platform as string] ?? t.platform as string}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{(t.plan_tier as string) ?? '-'}</td>
                <td className="px-4 py-3">
                  <Badge className={`text-xs border ${STATUS_BADGE[t.status as string] ?? 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABEL[t.status as string] ?? t.status as string}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {format(new Date(t.created_at as string), 'd MMM yyyy', { locale: localeId })}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/tenants/${t.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Detail <ExternalLink size={11} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(tenants ?? []).length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Tidak ada tenant ditemukan.</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 && (
            <a href={buildUrl({ page: String(page - 1) })}
              className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground">
              ← Prev
            </a>
          )}
          <span className="text-sm text-muted-foreground">Halaman {page} dari {totalPages}</span>
          {page < totalPages && (
            <a href={buildUrl({ page: String(page + 1) })}
              className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
