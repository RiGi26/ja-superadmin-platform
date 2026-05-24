import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { MessageCircle, PlusCircle } from 'lucide-react'
import Link from 'next/link'
import type { Lead } from '@/types/lead'

const STATUS_BADGE: Record<string, string> = {
  new      : 'bg-blue-950 text-blue-300 border-blue-800',
  contacted: 'bg-yellow-950 text-yellow-300 border-yellow-800',
  converted: 'bg-green-950 text-green-300 border-green-800',
  rejected : 'bg-zinc-800 text-zinc-500 border-zinc-700',
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
        <h1 className="text-xl font-semibold text-zinc-100">Leads</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{(leads ?? []).length} leads</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['', 'new', 'contacted', 'converted', 'rejected'].map(s => (
          <a key={s} href={s ? `?status=${s}` : '/dashboard/leads'}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              statusFilter === s
                ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-medium'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}>
            {s ? STATUS_LABEL[s] : 'Semua'}
          </a>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-medium">Nama / Bisnis</th>
              <th className="px-4 py-3 text-left font-medium">Platform Minat</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Masuk</th>
              <th className="px-4 py-3 text-left font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((lead: Lead) => (
              <tr key={lead.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-100">{lead.name}</p>
                  <p className="text-xs text-zinc-600">{lead.email}</p>
                  {lead.business_name && (
                    <p className="text-xs text-zinc-500 mt-0.5">{lead.business_name}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(lead.platforms ?? []).map(p => (
                      <Badge key={p} variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
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
                <td className="px-4 py-3 text-xs text-zinc-500">
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
                        className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
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
          <div className="text-center py-12 text-zinc-600 text-sm">Belum ada leads.</div>
        )}
      </div>
    </div>
  )
}
