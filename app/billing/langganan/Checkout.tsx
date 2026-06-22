'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Loader2, ShieldCheck } from 'lucide-react'

export type CheckoutPlan = {
  id: string
  tier_display_name: string
  price_monthly: number
  price_yearly: number
}

type Period = 'monthly' | 'yearly'

function rupiah(n: number) {
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}

export function LanggananCheckout({
  token,
  tenantName,
  platformLabel,
  plans,
  currentPlanId,
  subscriptionStatus,
  currentPeriodEnd,
}: {
  token: string
  tenantName: string
  platformLabel: string
  plans: CheckoutPlan[]
  currentPlanId: string | null
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
}) {
  const [period, setPeriod] = useState<Period>('monthly')
  const [planId, setPlanId] = useState<string>(currentPlanId ?? plans[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = plans.find((p) => p.id === planId)
  const price = selected ? (period === 'yearly' ? selected.price_yearly : selected.price_monthly) : 0

  const periodEndLabel = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  async function pay() {
    if (!planId) {
      setError('Pilih paket dulu.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, plan_id: planId, period }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.redirect_url) {
        setError(data.error ?? 'Gagal membuat pembayaran. Coba lagi sebentar.')
        return
      }
      window.location.href = data.redirect_url as string
    } catch {
      setError('Koneksi gagal. Periksa jaringan Anda lalu coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Perpanjang Langganan</h1>
        <p className="text-sm text-muted-foreground">
          {tenantName}
          {platformLabel ? ` · ${platformLabel}` : ''}
        </p>
        {subscriptionStatus === 'active' && periodEndLabel && (
          <p className="text-xs text-muted-foreground">
            Langganan aktif hingga <span className="font-medium">{periodEndLabel}</span>. Bayar
            sekarang untuk menambah satu periode.
          </p>
        )}
      </header>

      {/* Toggle periode */}
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

      {/* Daftar paket */}
      <div className="space-y-2.5">
        {plans.map((p) => {
          const amount = period === 'yearly' ? p.price_yearly : p.price_monthly
          const active = p.id === planId
          const isCurrent = p.id === currentPlanId
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
                  {isCurrent && (
                    <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      Paket Anda
                    </span>
                  )}
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
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-semibold text-foreground">{rupiah(price)}</span>
        </div>
        <Button onClick={pay} disabled={loading || !planId} className="w-full" size="lg">
          {loading && <Loader2 className="animate-spin" />} Bayar Sekarang
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Pembayaran aman via Midtrans
        </p>
      </div>
    </div>
  )
}
