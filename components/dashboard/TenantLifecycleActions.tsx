'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  CalendarPlus,
  PauseCircle,
  PlayCircle,
  XCircle,
  Repeat,
  Link2,
  Copy,
  Loader2,
} from 'lucide-react'

export type PlanOption = {
  id: string
  tier_display_name: string
  price_monthly: number
  price_yearly: number
}

type Period = 'monthly' | 'yearly'
type Kind = 'activate' | 'extend' | 'suspend' | 'reactivate' | 'cancel' | 'change_plan' | 'link'

const KIND_TITLE: Record<Kind, string> = {
  activate: 'Aktifkan Langganan',
  extend: 'Perpanjang Langganan',
  suspend: 'Tangguhkan Tenant',
  reactivate: 'Aktifkan Kembali',
  cancel: 'Batalkan Langganan',
  change_plan: 'Ganti Paket',
  link: 'Buat Link Pembayaran',
}

function rupiah(n: number) {
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}

export function TenantLifecycleActions({
  tenantId,
  status,
  currentPlanId,
  plans,
}: {
  tenantId: string
  status: string
  currentPlanId: string | null
  plans: PlanOption[]
}) {
  const router = useRouter()
  const [kind, setKind] = useState<Kind | null>(null)
  const [period, setPeriod] = useState<Period>('monthly')
  const [planId, setPlanId] = useState<string>(currentPlanId ?? plans[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState<string | null>(null)

  const selectedPlan = plans.find((p) => p.id === planId)
  const needsPeriod = kind === 'activate' || kind === 'extend' || kind === 'link'
  const needsPlan = kind === 'change_plan' || kind === 'link'

  function open(k: Kind) {
    setKind(k)
    setLink(null)
    if (k === 'change_plan') setPlanId(currentPlanId ?? plans[0]?.id ?? '')
  }

  function close() {
    if (loading) return
    setKind(null)
    setLink(null)
  }

  async function runLifecycle() {
    if (!kind || kind === 'link') return
    setLoading(true)
    try {
      const res = await fetch('/api/billing/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          action: kind,
          ...(needsPeriod ? { period } : {}),
          ...(needsPlan ? { plan_id: planId } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Gagal memproses aksi.')
        return
      }
      toast.success('Berhasil diperbarui.')
      setKind(null)
      router.refresh()
    } catch {
      toast.error('Koneksi gagal.')
    } finally {
      setLoading(false)
    }
  }

  async function generateLink() {
    if (!planId) {
      toast.error('Pilih paket dulu.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, plan_id: planId, period }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Gagal membuat link.')
        return
      }
      setLink(data.redirect_url as string)
    } catch {
      toast.error('Koneksi gagal.')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link disalin.')
    } catch {
      toast.error('Gagal menyalin.')
    }
  }

  const isActive = status === 'active'
  const isSuspended = status === 'suspended'
  const isCancelled = status === 'cancelled'

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
        <Repeat size={14} /> Kelola Langganan
      </div>

      <div className="flex flex-wrap gap-2">
        {!isActive && (
          <Button size="sm" variant="default" onClick={() => open('activate')}>
            <CheckCircle2 /> Aktifkan
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => open('extend')}>
          <CalendarPlus /> Perpanjang
        </Button>
        {plans.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => open('change_plan')}>
            <Repeat /> Ganti Paket
          </Button>
        )}
        {isSuspended ? (
          <Button size="sm" variant="outline" onClick={() => open('reactivate')}>
            <PlayCircle /> Aktifkan Kembali
          </Button>
        ) : (
          !isCancelled && (
            <Button size="sm" variant="outline" onClick={() => open('suspend')}>
              <PauseCircle /> Tangguhkan
            </Button>
          )
        )}
        {!isCancelled && (
          <Button size="sm" variant="destructive" onClick={() => open('cancel')}>
            <XCircle /> Batalkan
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => open('link')}>
          <Link2 /> Buat Link Bayar
        </Button>
      </div>

      <Dialog open={kind !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{kind ? KIND_TITLE[kind] : ''}</DialogTitle>
            <DialogDescription>
              {kind === 'cancel'
                ? 'Langganan akan dibatalkan dan status tenant menjadi Dibatalkan.'
                : kind === 'suspend'
                  ? 'Akses tenant dimatikan; periode langganan tetap dipertahankan.'
                  : kind === 'activate'
                    ? 'Aktifkan manual (mis. pembayaran offline). Periode baru dihitung dari sekarang.'
                    : kind === 'extend'
                      ? 'Tambah satu siklus di atas periode yang berjalan.'
                      : kind === 'link'
                        ? 'Buat tautan pembayaran Midtrans untuk dikirim ke tenant via WhatsApp/email.'
                        : kind === 'change_plan'
                          ? 'Ganti paket langganan. Tidak menarik pembayaran — gunakan link bayar bila berbayar.'
                          : 'Aktifkan kembali tenant yang ditangguhkan.'}
            </DialogDescription>
          </DialogHeader>

          {needsPlan && (
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">Paket</span>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                disabled={loading}
                className="w-full h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.tier_display_name} — {rupiah(p.price_monthly)}/bln
                  </option>
                ))}
              </select>
            </label>
          )}

          {needsPeriod && (
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">Periode</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                disabled={loading}
                className="w-full h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="monthly">
                  Bulanan{selectedPlan ? ` — ${rupiah(selectedPlan.price_monthly)}` : ''}
                </option>
                <option value="yearly">
                  Tahunan{selectedPlan ? ` — ${rupiah(selectedPlan.price_yearly)}` : ''}
                </option>
              </select>
            </label>
          )}

          {link && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Link pembayaran (berlaku 7 hari)</span>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link}
                  className="w-full h-9 rounded-lg border border-input bg-muted/40 px-2.5 text-xs font-mono outline-none"
                />
                <Button size="icon-sm" variant="outline" onClick={copyLink} aria-label="Salin link">
                  <Copy />
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={loading}>
              {link ? 'Tutup' : 'Batal'}
            </Button>
            {kind === 'link'
              ? !link && (
                  <Button onClick={generateLink} disabled={loading || !planId}>
                    {loading && <Loader2 className="animate-spin" />} Buat Link
                  </Button>
                )
              : kind && (
                  <Button
                    variant={kind === 'cancel' ? 'destructive' : 'default'}
                    onClick={runLifecycle}
                    disabled={loading || (needsPlan && !planId)}
                  >
                    {loading && <Loader2 className="animate-spin" />} Konfirmasi
                  </Button>
                )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
