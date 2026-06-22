import { createWebsiteBuilderClient } from '@/lib/supabase/websitebuilder'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { MessageCircle, Globe, Sparkles, CheckCircle2 } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  pending   : 'bg-blue-950 text-blue-300 border-blue-800',
  active    : 'bg-green-950 text-green-300 border-green-800',
  completed : 'bg-zinc-900 text-zinc-400 border-zinc-700',
  cancelled : 'bg-red-950 text-red-300 border-red-800',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Baru / Antre', active: 'Pengerjaan', completed: 'Selesai', cancelled: 'Dibatalkan',
}

interface Order {
  id: string
  created_at: string
  nama_usaha: string
  nama_perusahaan: string
  nomor_wa: string
  domain: string
  type: 'new' | 'upgrade'
  selected_addons: string[]
  total_estimasi: number
  status: string
}

export default async function WebsiteOrdersPage() {
  // Orders ada di project Website Builder (DB terpisah), bukan Core DB.
  const db = createWebsiteBuilderClient()
  const notConfigured = !db
  const { data: orders } = db
    ? await db.from('orders').select('*').order('created_at', { ascending: false })
    : { data: null }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Website Builder Orders</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{(orders ?? []).length} pesanan website & upgrade fitur</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-medium">Customer / Domain</th>
              <th className="px-4 py-3 text-left font-medium">Tipe</th>
              <th className="px-4 py-3 text-left font-medium">Fitur / Add-ons</th>
              <th className="px-4 py-3 text-right font-medium">Nilai</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Masuk</th>
              <th className="px-4 py-3 text-left font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(orders as Order[] ?? []).map((order) => (
              <tr key={order.id} className="border-b border-border/60 last:border-0 hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{order.nama_perusahaan || order.nama_usaha || 'Individual'}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Globe size={10} /> {order.domain || 'Belum ada domain'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {order.type === 'upgrade' ? (
                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 gap-1">
                      <Sparkles size={10} /> Upgrade
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                      New Project
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {(order.selected_addons ?? []).map((addon) => (
                      <span key={addon} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border/50">
                        {addon}
                      </span>
                    ))}
                    {(order.selected_addons ?? []).length === 0 && <span className="text-xs text-muted-foreground italic">Basic Only</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                   Rp {order.total_estimasi?.toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3">
                  <Badge className={`text-[10px] border px-2 py-0 h-5 ${STATUS_BADGE[order.status] || ''}`}>
                    {STATUS_LABEL[order.status] || order.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {format(new Date(order.created_at), 'd MMM HH:mm', { locale: localeId })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {order.nomor_wa && (
                      <a
                        href={`https://wa.me/${order.nomor_wa.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 rounded-md bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500/20 transition-colors"
                        title="Chat via WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}
                    <button className="w-8 h-8 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500/20 transition-colors">
                        <CheckCircle2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(orders ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Globe size={32} className="text-muted-foreground/50" />
            </div>
            {notConfigured ? (
              <>
                <p className="text-base font-medium text-foreground">Koneksi Website Builder belum dikonfigurasi</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Set <code className="text-xs">WB_SUPABASE_URL</code> dan <code className="text-xs">WB_SUPABASE_SERVICE_ROLE_KEY</code> di environment.
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-medium text-foreground">Tidak ada pesanan website</p>
                <p className="text-sm text-muted-foreground mt-1">Data pesanan dari website builder akan muncul di sini.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
