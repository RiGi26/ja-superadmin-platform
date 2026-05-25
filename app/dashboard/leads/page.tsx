import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { MessageCircle, PlusCircle, Users } from 'lucide-react'
import Link from 'next/link'
import type { Lead } from '@/types/lead'

const STATUS_BADGE: Record<string, string> = {
  new      : 'bg-blue-950 text-blue-300 border-blue-800',
  contacted: 'bg-yellow-950 text-yellow-300 border-yellow-800',
  converted: 'bg-green-950 text-green-300 border-green-800',
  rejected : 'bg-muted text-muted-foreground border-border',
}
const STATUS_LABEL: Record<string, string> = {
  new: 'Baru', contacted: 'Dihubungi', converted: 'Converted', rejected: 'Ditolak',
}
const PLATFORM_LABEL: Record<string, string> = {
  lms: 'LMS', clinic: 'Clinic', pharmacy: 'Pharmacy', jastip: 'Jastip',
}

interface SearchParams { status?: string }

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const statusFilter = params.status ?? ''

  const db = createAdminClient()
  let query = db
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data: leads } = await query

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Leads</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{(leads ?? []).length} leads</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['', 'new', 'contacted', 'converted', 'rejected'].map(s => (
          <a key={s} href={s ? `?status=${s}` : '/dashboard/leads'}
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
              <th className="px-4 py-3 text-left font-medium">Nama / Bisnis</th>
              <th className="px-4 py-3 text-left font-medium">Platform Minat</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Masuk</th>
              <th className="px-4 py-3 text-left font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((lead: Lead) => (
              <tr key={lead.id} className="border-b border-border/60 last:border-0 hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.email}</p>
                  {lead.business_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">{lead.business_name}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(lead.platforms ?? []).map(p => (
                      <Badge key={p} variant="outline" className="text-[10px] border-border text-muted-foreground">
                        {PLATFORM_LABEL[p] ?? p}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={`text-xs border ${STATUS_BADGE[lead.status]}`}>
                    {STATUS_LABEL[lead.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {format(new Date(lead.created_at), 'd MMM yyyy', { locale: localeId })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {lead.phone_wa && (
                      <a
                        href={`https://wa.me/${lead.phone_wa.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-green-500 hover:text-green-400 transition-colors"
                        title="Chat via WhatsApp"
                      >
                        <MessageCircle size={15} />
                      </a>
                    )}
                    {lead.status !== 'converted' && (
                      <Link
                        href={`/dashboard/tenants/new?lead_id=${lead.id}&name=${encodeURIComponent(lead.business_name ?? lead.name)}&email=${encodeURIComponent(lead.email)}`}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        <PlusCircle size={12} /> Convert
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(leads ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users size={28} className="text-muted-foreground/50" />
            </div>
            <p className="text-base font-medium text-foreground">Tidak ada data ditemukan</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">Belum ada data leads yang tersedia saat ini.</p>
          </div>
        )}
      </div>
    </div>
  )
}
