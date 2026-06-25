'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Loader2, ShieldCheck, CalendarClock, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react'

export type CheckoutPlan = {
  id: string
  tier: string
  tier_display_name: string
  price_monthly: number
  price_yearly: number
}

type Period = 'monthly' | 'yearly'
type Kind = 'renew' | 'upgrade' | 'downgrade'

const TIER_RANK: Record<string, number> = { starter: 1, pro: 2, enterprise: 3 }
const rank = (t?: string | null) => TIER_RANK[t ?? ''] ?? 0
const DAY_MS = 86_400_000

function rupiah(n: number) {
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}
function dateLabel(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
}

export function LanggananCheckout({
  token,
  tenantName,
  platformLabel,
  plans,
  currentPlanId,
  currentTier,
  subscriptionStatus,
  currentPeriodStart,
  currentPeriodEnd,
  scheduledPlanId,
}: {
  token: string
  tenantName: string
  platformLabel: string
  plans: CheckoutPlan[]
  currentPlanId: string | null
  currentTier: string | null
  subscriptionStatus: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  scheduledPlanId: string | null
}) {
  const now = Date.now()
  const periodEndMs = currentPeriodEnd ? Date.parse(currentPeriodEnd) : null
  const isActiveRunning =
    subscriptionStatus === 'active' && periodEndMs != null && periodEndMs > now
  const curRank = rank(currentTier)

  // Unit periode berjalan (utk pro-rata upgrade). >60 hari → tahunan.
  const startMs = currentPeriodStart ? Date.parse(currentPeriodStart) : NaN
  const totalMs =
    Number.isFinite(startMs) && periodEndMs != null && periodEndMs > startMs
      ? periodEndMs - startMs
      : null
  const runningYearly = totalMs != null ? totalMs > 60 * DAY_MS : false
  const frac =
    totalMs != null && periodEndMs != null
      ? Math.max(0, Math.min(1, (periodEndMs - now) / totalMs))
      : 0
  const daysLeft = periodEndMs != null ? Math.max(0, Math.ceil((periodEndMs - now) / DAY_MS)) : 0
  const curPlan = plans.find((p) => p.id === currentPlanId) ?? null
  const periodEndLabel = dateLabel(currentPeriodEnd)

  // Saat langganan aktif, perubahan tengah-periode pakai unit periode berjalan
  // (toggle disembunyikan); selain itu tenant bebas pilih bulanan/tahunan.
  const [period, setPeriod] = useState<Period>(runningYearly ? 'yearly' : 'monthly')
  const [planId, setPlanId] = useState<string>(
    (!isActiveRunning && scheduledPlanId) || currentPlanId || plans[0]?.id || '',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [scheduled, setScheduled] = useState<string | null>(scheduledPlanId)
  const [canceling, setCanceling] = useState(false)

  const selected = plans.find((p) => p.id === planId) ?? null
  const scheduledPlan = plans.find((p) => p.id === scheduled) ?? null

  function classify(p: CheckoutPlan): Kind {
    if (!isActiveRunning) return 'renew'
    const r = rank(p.tier)
    if (r > curRank) return 'upgrade'
    if (r < curRank) return 'downgrade'
    return 'renew'
  }
  function proratedFor(p: CheckoutPlan): number {
    const oldP = Number((runningYearly ? curPlan?.price_yearly : curPlan?.price_monthly) ?? 0)
    const newP = Number(runningYearly ? p.price_yearly : p.price_monthly)
    return Math.max(0, Math.round((newP - oldP) * frac))
  }

  const selKind = selected ? classify(selected) : 'renew'
  const fullPrice = selected ? (period === 'yearly' ? selected.price_yearly : selected.price_monthly) : 0
  const upgradeAmount = selected && selKind === 'upgrade' ? proratedFor(selected) : 0

  // Label/CTA footer per jenis perubahan paket terpilih.
  let total = fullPrice
  let cta = 'Bayar Sekarang'
  let hint: string | null =
    isActiveRunning && periodEndLabel
      ? `Langganan aktif hingga ${periodEndLabel}.`
      : null
  if (selKind === 'upgrade') {
    total = upgradeAmount
    cta = upgradeAmount > 0 ? 'Upgrade — Bayar Pro-rata' : 'Terapkan Upgrade'
    hint = `Upgrade berlaku seketika. Ditagih pro-rata sisa ${daysLeft} hari — periode tetap (sampai ${periodEndLabel}).`
  } else if (selKind === 'downgrade') {
    total = 0
    cta = 'Jadwalkan Downgrade'
    hint = `Downgrade dijadwalkan mulai ${periodEndLabel}. Paket & fitur sekarang tetap sampai tanggal itu — tanpa biaya sekarang.`
  } else if (isActiveRunning) {
    hint = `Perpanjang 1 periode di atas masa aktif (hingga ${periodEndLabel}).`
  }

  async function submit() {
    if (!planId) {
      setError('Pilih paket dulu.')
      return
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/billing/checkout-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, plan_id: planId, period }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Gagal memproses. Coba lagi sebentar.')
        return
      }
      if (data.kind === 'scheduled') {
        setScheduled(planId)
        setNotice(
          `Downgrade ke ${selected?.tier_display_name ?? 'paket'} dijadwalkan mulai ${
            dateLabel(data.effective_at) ?? periodEndLabel ?? 'perpanjangan berikutnya'
          }. Paket sekarang tetap aktif sampai tanggal itu.`,
        )
        return
      }
      if (data.kind === 'applied') {
        setNotice('Paket berhasil diubah dan berlaku sekarang.')
        return
      }
      if (data.redirect_url) {
        window.location.href = data.redirect_url as string
        return
      }
      setError('Respons tidak terduga. Coba lagi.')
    } catch {
      setError('Koneksi gagal. Periksa jaringan Anda lalu coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  async function cancelSchedule() {
    setCanceling(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/cancel-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Gagal membatalkan penjadwalan.')
        return
      }
      setScheduled(null)
      setNotice('Penjadwalan downgrade dibatalkan. Paket Anda tetap seperti sekarang.')
    } catch {
      setError('Koneksi gagal. Coba lagi.')
    } finally {
      setCanceling(false)
    }
  }

  const KindBadge = ({ kind, isCurrent }: { kind: Kind; isCurrent: boolean }) => {
    if (isCurrent)
      return (
        <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
          Paket Anda
        </span>
      )
    if (!isActiveRunning) return null
    if (kind === 'upgrade')
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium rounded bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5">
          <ArrowUp className="size-3" /> Upgrade
        </span>
      )
    if (kind === 'downgrade')
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium rounded bg-amber-500/10 text-amber-600 px-1.5 py-0.5">
          <ArrowDown className="size-3" /> Downgrade
        </span>
      )
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
        <RefreshCw className="size-3" /> Perpanjang
      </span>
    )
  }

  return (
    <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">
          {isActiveRunning ? 'Kelola Langganan' : 'Langganan'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tenantName}
          {platformLabel ? ` · ${platformLabel}` : ''}
        </p>
      </header>

      {/* Banner downgrade terjadwal */}
      {scheduled && scheduledPlan && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5">
          <CalendarClock className="size-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1 space-y-1.5">
            <p className="text-sm text-foreground">
              Paket dijadwalkan turun ke <span className="font-medium">{scheduledPlan.tier_display_name}</span>
              {periodEndLabel ? ` mulai ${periodEndLabel}` : ' pada perpanjangan berikutnya'}.
            </p>
            <button
              onClick={cancelSchedule}
              disabled={canceling}
              className="text-xs font-medium text-amber-700 underline underline-offset-2 disabled:opacity-50"
            >
              {canceling ? 'Membatalkan…' : 'Batalkan penjadwalan'}
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p className="text-sm text-emerald-700 bg-emerald-500/10 rounded-lg px-3 py-2.5">{notice}</p>
      )}

      {/* Toggle periode — hanya saat tak ada periode aktif berjalan */}
      {!isActiveRunning && (
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 text-sm">
          {(['monthly', 'yearly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              disabled={loading}
              className={`px-3 h-8 rounded-md transition-colors disabled:opacity-50 ${
                period === p
                  ? 'bg-background shadow-sm font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'monthly' ? 'Bulanan' : 'Tahunan'}
            </button>
          ))}
        </div>
      )}

      {/* Daftar paket */}
      <div className="space-y-2.5">
        {plans.map((p) => {
          const amount = period === 'yearly' ? p.price_yearly : p.price_monthly
          const active = p.id === planId
          const isCurrent = p.id === currentPlanId
          const kind = classify(p)
          return (
            <button
              key={p.id}
              onClick={() => setPlanId(p.id)}
              disabled={loading}
              className={`w-full flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${
                active
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/[0.03]'
                  : 'border-border hover:border-foreground/30'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{p.tier_display_name}</span>
                  <KindBadge kind={kind} isCurrent={isCurrent} />
                </div>
                <div className="text-sm text-muted-foreground">
                  {rupiah(amount)}
                  <span className="text-xs"> / {period === 'yearly' ? 'tahun' : 'bulan'}</span>
                </div>
              </div>
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                }`}
              >
                {active && <Check className="size-3.5" />}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="space-y-3">
        {hint && <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            {selKind === 'downgrade' ? 'Bayar sekarang' : 'Total'}
          </span>
          <span className="text-lg font-semibold text-foreground">{rupiah(total)}</span>
        </div>
        <Button onClick={submit} disabled={loading || !planId} className="w-full" size="lg">
          {loading && <Loader2 className="animate-spin" />} {cta}
        </Button>
        {selKind !== 'downgrade' && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Pembayaran aman via Midtrans
          </p>
        )}
      </div>
    </div>
  )
}
