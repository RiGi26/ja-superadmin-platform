'use client'

import { useEffect, useState } from 'react'
import { checkStockActivationAction } from '../checkout/stock/actions'

/** One mounted pending view gets five minutes, including slow or failed checks.
 * No overlapping requests and no timer reset after a response or tab switch. */
export function pollStockActivation(check: () => Promise<string>, active: () => void) {
  const deadline = Date.now() + 5 * 60_000
  let stopped = false
  let delay = 5_000
  let timer: ReturnType<typeof setTimeout>
  function schedule() {
    if (stopped || Date.now() + delay >= deadline) return
    timer = setTimeout(async () => {
      if (stopped || Date.now() >= deadline) return
      try {
        const result = await check()
        if (stopped || Date.now() >= deadline) return
        if (result === 'active') { stopped = true; active(); return }
        if (result === 'unavailable') { stopped = true; return }
      } catch { /* Manual status checking remains available after network errors. */ }
      delay = Math.min(delay * 2, 30_000)
      schedule()
    }, delay)
  }
  schedule()
  return () => { stopped = true; clearTimeout(timer) }
}

export function StockActivationStatus({ invoiceId, className }: { invoiceId: string; className: string }) {
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('Status diperiksa otomatis hingga lima menit. Anda tidak perlu membayar lagi.')
  useEffect(() => pollStockActivation(() => checkStockActivationAction(invoiceId), () => window.location.reload()), [invoiceId])
  async function check() {
    if (checking) return
    setChecking(true)
    try {
      const result = await checkStockActivationAction(invoiceId)
      if (result === 'active') window.location.reload()
      else setMessage(result === 'pending' ? 'Aktivasi masih diproses. Anda tidak perlu membayar lagi.' : 'Status belum dapat diperiksa. Masuk kembali atau coba lagi nanti.')
    } catch { setMessage('Koneksi terputus. Coba periksa status kembali.') }
    finally { setChecking(false) }
  }
  return <div><p role="status">{message}</p><button type="button" className={className} onClick={check} disabled={checking}>{checking ? 'Memeriksa status…' : 'Periksa status'}</button></div>
}
