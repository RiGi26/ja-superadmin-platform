'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'

type View = 'checking' | 'paid' | 'pending' | 'failed' | 'missing'

const MAX_POLLS = 5
const POLL_DELAY_MS = 3000
const REDIRECT_SECONDS = 5

export function BillingResult({
  invoiceId,
  portalUrl,
}: {
  invoiceId: string | null
  portalUrl: string | null
}) {
  const [view, setView] = useState<View>(invoiceId ? 'checking' : 'missing')
  const [busy, setBusy] = useState(false)
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS)
  const polls = useRef(0)

  async function checkOnce(): Promise<boolean> {
    if (!invoiceId) return true
    try {
      const res = await fetch('/api/billing/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.status === 'paid') {
        setView('paid')
        return true
      }
      // Status terminal-gagal dari Midtrans (raw transaction_status diteruskan apa adanya).
      const FAILED = ['failed', 'expire', 'expired', 'deny', 'cancel']
      if (typeof data.status === 'string' && FAILED.includes(data.status)) {
        setView('failed')
        return true
      }
      setView('pending')
      return false
    } catch {
      setView('pending')
      return false
    }
  }

  useEffect(() => {
    if (!invoiceId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function loop() {
      if (cancelled) return
      polls.current += 1
      const done = await checkOnce()
      if (cancelled) return
      if (!done && polls.current < MAX_POLLS) {
        timer = setTimeout(loop, POLL_DELAY_MS)
      }
    }
    loop()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  // Auto-redirect ke dashboard portal HANYA saat paid (pending/failed tidak —
  // pembayaran VA bisa lunas belakangan, user harus tetap bisa baca status).
  useEffect(() => {
    if (view !== 'paid' || !portalUrl) return
    setCountdown(REDIRECT_SECONDS)
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          window.location.assign(portalUrl)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [view, portalUrl])

  async function recheck() {
    setBusy(true)
    setView('checking')
    await checkOnce()
    setBusy(false)
  }

  if (view === 'paid') {
    return (
      <Shell
        icon={<CheckCircle2 className="size-12 text-green-500" />}
        title="Pembayaran berhasil"
        desc="Langganan Anda sudah aktif. Terima kasih telah berlangganan Webzoka."
      >
        {portalUrl && (
          <div className="flex flex-col items-center gap-2">
            <a
              href={portalUrl}
              className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Masuk ke Dashboard
            </a>
            <p className="text-xs text-muted-foreground">
              Anda akan diarahkan otomatis dalam {countdown} detik…
            </p>
          </div>
        )}
      </Shell>
    )
  }

  if (view === 'failed') {
    return (
      <Shell
        icon={<XCircle className="size-12 text-destructive" />}
        title="Pembayaran tidak selesai"
        desc="Transaksi gagal atau kedaluwarsa. Silakan minta tautan pembayaran baru."
      >
        {portalUrl && <DashboardLink portalUrl={portalUrl} />}
      </Shell>
    )
  }

  if (view === 'missing') {
    return (
      <Shell
        icon={<XCircle className="size-12 text-muted-foreground" />}
        title="Tautan tidak lengkap"
        desc="Nomor invoice tidak ditemukan pada tautan ini."
      />
    )
  }

  if (view === 'pending') {
    return (
      <Shell
        icon={<Clock className="size-12 text-amber-500" />}
        title="Menunggu konfirmasi"
        desc="Pembayaran Anda sedang diproses. Status akan diperbarui otomatis setelah lunas — ini bisa memakan beberapa menit untuk transfer bank/VA."
      >
        <button
          onClick={recheck}
          disabled={busy}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-background text-sm hover:bg-muted disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />} Cek status lagi
        </button>
        {portalUrl && <DashboardLink portalUrl={portalUrl} />}
      </Shell>
    )
  }

  return (
    <Shell
      icon={<Loader2 className="size-12 text-muted-foreground animate-spin" />}
      title="Memeriksa pembayaran…"
      desc="Mohon tunggu sebentar."
    />
  )
}

function DashboardLink({ portalUrl }: { portalUrl: string }) {
  return (
    <a href={portalUrl} className="text-sm text-muted-foreground underline hover:text-foreground">
      Kembali ke Dashboard
    </a>
  )
}

function Shell({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      {icon}
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{desc}</p>
      </div>
      {children}
    </div>
  )
}
