'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'

type View = 'checking' | 'paid' | 'pending' | 'failed' | 'missing'

const MAX_POLLS = 5
const POLL_DELAY_MS = 3000

export function BillingResult({ invoiceId }: { invoiceId: string | null }) {
  const [view, setView] = useState<View>(invoiceId ? 'checking' : 'missing')
  const [busy, setBusy] = useState(false)
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
        desc="Langganan Anda sudah aktif. Terima kasih telah berlangganan Japan Arena."
      />
    )
  }

  if (view === 'failed') {
    return (
      <Shell
        icon={<XCircle className="size-12 text-destructive" />}
        title="Pembayaran tidak selesai"
        desc="Transaksi gagal atau kedaluwarsa. Silakan minta tautan pembayaran baru."
      />
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
