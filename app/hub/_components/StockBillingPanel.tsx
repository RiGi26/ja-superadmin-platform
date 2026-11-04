import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import type { StockBillingAccount } from '@/lib/stock-self-payment'
import { STOCK_E1_APP_ORIGIN } from '@/lib/e1-realm'
import { APPROVED_OFFERS } from '@/lib/plan-catalog'
import { stockCheckoutPath } from '@/lib/stock-purchase-policy'
import styles from './stock-billing.module.css'
import { refreshStockInvoiceAction } from '../checkout/stock/actions'
import { StockActivationStatus } from './StockActivationStatus'

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const date = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(value))
const states = { not_started: 'Belum berlangganan', pending: 'Pembayaran diterima, aktivasi diproses', active: 'Stock aktif', suspended: 'Akses Stock belum aktif' }
const invoiceStates = { unpaid: 'Belum dibayar', awaiting_payment: 'Menunggu pembayaran', paid: 'Lunas', failed: 'Pembayaran gagal', expired: 'Tagihan kedaluwarsa' }

export function StockBillingPanel({ billing, systemsOnly = false }: { billing: StockBillingAccount; systemsOnly?: boolean }) {
  if (billing.status !== 'ready') return null
  return <section className={styles.section} aria-label={systemsOnly ? 'Akses Stock' : 'Langganan Stock'}>
    {billing.workspaces.length === 0 ? <div className={styles.panel}><h2>Mulai langganan Stock</h2><p>Pilih paket dan siapkan workspace usaha Anda sebelum pembayaran.</p><Link className={styles.primary} href="/hub/store#stock-packages">Pilih paket Stock</Link></div> : billing.workspaces.map(workspace => {
      const offer = APPROVED_OFFERS.find(item => item.id === workspace.subscription?.planId && item.platform === 'stock')
      return <article key={workspace.companyId} className={styles.panel}>
        <div className={styles.title}><div><h2>{workspace.companyName}</h2><p>Webzoka Stock{offer ? ` · ${offer.name}` : ''}</p></div><span className={styles.status}>{states[workspace.activation]}</span></div>
        {workspace.activation === 'pending' && <><p className={styles.notice} role="status">Pembayaran sudah tercatat. Tidak perlu membayar lagi. Periksa kembali setelah aktivasi Stock selesai.</p>
          {workspace.invoices.find(invoice => invoice.status === 'paid') && <StockActivationStatus invoiceId={workspace.invoices.find(invoice => invoice.status === 'paid')!.id} className={styles.secondary} />}</>}
        {workspace.subscription?.expiresAt && <p>Periode berbayar sampai {date(workspace.subscription.expiresAt)}.</p>}
        <div className={styles.actions}>
          {workspace.activation === 'active' ? <form method="post" action={`${STOCK_E1_APP_ORIGIN}/api/auth/e1/start`}>
            <input type="hidden" name="companyId" value={workspace.companyId} /><input type="hidden" name="reservationId" value={workspace.reservationId} /><input type="hidden" name="commandId" value={randomUUID()} />
            <button className={styles.primary}>Buka Webzoka Stock</button>
          </form> : workspace.activation !== 'pending' && <Link className={styles.primary} href={offer ? stockCheckoutPath(offer.id, workspace.companyId) : '/hub/store#stock-packages'}>{offer ? 'Periksa langganan' : 'Pilih paket Stock'}</Link>}
          <a className={styles.secondary} href="/hub/account?view=billing">Periksa status terbaru</a>
        </div>
        {!systemsOnly && <section aria-label={`Riwayat tagihan ${workspace.companyName}`} className={styles.history}><h3>Riwayat tagihan</h3>
          {workspace.invoices.length === 0 ? <p>Belum ada tagihan untuk usaha ini.</p> : <ul className={styles.invoices}>{workspace.invoices.map(invoice => {
            const invoiceOffer = APPROVED_OFFERS.find(item => item.platform === 'stock' && item.id === invoice.planId)
            return <li key={invoice.id}><div><strong>{invoiceOffer?.name ?? 'Paket Stock'}</strong><span>{date(invoice.createdAt)}</span></div><strong className={styles.amount}>{money(invoice.amount)}</strong><span>{invoiceStates[invoice.status]}</span>
              <div className={styles.invoiceControls}>{['unpaid', 'awaiting_payment'].includes(invoice.status) && invoiceOffer && <Link className={styles.invoiceAction} href={stockCheckoutPath(invoiceOffer.id, workspace.companyId)}>Lanjutkan pembayaran</Link>}
              {['unpaid', 'awaiting_payment', 'paid'].includes(invoice.status) && <form action={refreshStockInvoiceAction}><input type="hidden" name="invoice" value={invoice.id} /><button className={styles.invoiceAction}>Periksa pembayaran</button></form>}
              </div>
            </li>
          })}</ul>}
        </section>}
      </article>
    })}
  </section>
}
