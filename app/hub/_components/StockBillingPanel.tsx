import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import type { StockBillingAccount } from '@/lib/stock-self-payment'
import { STOCK_E1_APP_ORIGIN } from '@/lib/e1-realm'
import { APPROVED_OFFERS } from '@/lib/plan-catalog'
import { STOCK_OPERATOR_INVITATION_ENABLED } from '@/lib/stock-operator-protocol'
import { STOCK_MEMBER_LIFECYCLE_ENABLED } from '@/lib/stock-member-protocol'
import { STOCK_MEMBERSHIP_RUNTIME_ENABLED } from '@/lib/stock-membership-protocol'
import { stockCheckoutPath, stockOperatorPath } from '@/lib/stock-purchase-policy'
import { formatStockBillingDate, stockInvoiceDetailRows, stockInvoiceDisplay } from '@/lib/stock-invoice-display'
import styles from './stock-billing.module.css'
import { refreshStockInvoiceAction } from '../checkout/stock/actions'
import { StockActivationStatus } from './StockActivationStatus'

const states = { not_started: 'Belum berlangganan', pending: 'Pembayaran diterima, aktivasi diproses', active: 'Stock aktif', suspended: 'Akses Stock belum aktif' }

export function StockBillingPanel({ billing, systemsOnly = false }: { billing: StockBillingAccount; systemsOnly?: boolean }) {
  if (billing.status !== 'ready') return null
  return <section className={styles.section} aria-label={systemsOnly ? 'Akses Stock' : 'Langganan Stock'}>
    {billing.workspaces.length === 0 ? <div className={styles.panel}><h2>Mulai langganan Stock</h2><p>Pilih paket dan siapkan workspace usaha Anda sebelum pembayaran.</p><Link className={styles.primary} href="/hub/store#stock-packages">Pilih paket Stock</Link></div> : billing.workspaces.map(workspace => {
      const offer = APPROVED_OFFERS.find(item => item.id === workspace.subscription?.planId && item.platform === 'stock')
      const membership = workspace.accessProtocol === 'membership'
      const entryPath = membership ? '/api/auth/stock-membership/selection/start' : '/api/auth/e1/start'
      const canEnter = workspace.activation === 'active' && (!membership || STOCK_MEMBERSHIP_RUNTIME_ENABLED)
      return <article id={`stock-${workspace.companyId}`} key={workspace.companyId} className={styles.panel}>
        <div className={styles.title}><div><h2>{workspace.companyName}</h2><p>Webzoka Stock{offer ? ` · ${offer.name}` : ''}</p></div><span className={styles.status}>{states[workspace.activation]}</span></div>
        {workspace.activation === 'pending' && <><p className={styles.notice} role="status">Pembayaran sudah tercatat. Tidak perlu membayar lagi. Periksa kembali setelah aktivasi Stock selesai.</p>
          {workspace.invoices.find(invoice => invoice.status === 'paid') && <StockActivationStatus invoiceId={workspace.invoices.find(invoice => invoice.status === 'paid')!.id} className={styles.secondary} />}</>}
        {workspace.subscription?.expiresAt && <p>Periode berbayar sampai {formatStockBillingDate(workspace.subscription.expiresAt)}.</p>}
        <div className={styles.actions}>
          {canEnter ? <form method="post" action={`${STOCK_E1_APP_ORIGIN}${entryPath}`}>
            <input type="hidden" name="companyId" value={workspace.companyId} /><input type="hidden" name="reservationId" value={workspace.reservationId} /><input type="hidden" name="commandId" value={randomUUID()} />
            <button className={styles.primary}>Buka Webzoka Stock</button>
          </form> : ['not_started', 'suspended'].includes(workspace.activation) && <Link className={styles.primary} href={offer ? stockCheckoutPath(offer.id, workspace.companyId) : '/hub/store#stock-packages'}>{offer ? 'Periksa langganan' : 'Pilih paket Stock'}</Link>}
          {membership && STOCK_MEMBERSHIP_RUNTIME_ENABLED && (STOCK_MEMBER_LIFECYCLE_ENABLED || (canEnter && STOCK_OPERATOR_INVITATION_ENABLED)) &&
            <Link className={styles.secondary} href={stockOperatorPath(workspace.companyId)}>Kelola tim Stock</Link>}
          <a className={styles.secondary} href="/hub/account?view=billing">Periksa status terbaru</a>
        </div>
        {!systemsOnly && <section aria-label={`Riwayat tagihan ${workspace.companyName}`} className={styles.history}><h3>Riwayat tagihan</h3>
          {workspace.invoices.length === 0 ? <p>Belum ada tagihan untuk usaha ini.</p> : <ul className={styles.invoices}>{workspace.invoices.map(invoice => {
            const display = stockInvoiceDisplay(workspace.companyName, invoice)
            return <li key={invoice.id}><div><strong>{display.plan}</strong><span>{display.createdAt}</span></div><strong className={styles.amount}>{display.amount}</strong><span>{display.status}</span>
              <div className={styles.invoiceControls}>{['unpaid', 'awaiting_payment'].includes(invoice.status) && display.offer && <Link className={styles.invoiceAction} href={stockCheckoutPath(display.offer.id, workspace.companyId)}>Lanjutkan pembayaran</Link>}
              {['unpaid', 'awaiting_payment', 'paid'].includes(invoice.status) && <form action={refreshStockInvoiceAction}><input type="hidden" name="invoice" value={invoice.id} /><button className={styles.invoiceAction}>Periksa pembayaran</button></form>}
              </div>
              <details className={styles.invoiceDetails}>
                <summary>Lihat rincian tagihan</summary>
                <dl>{stockInvoiceDetailRows(display).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                <a className={styles.invoiceAction} href={`/hub/stock/invoices/${workspace.companyId}/${invoice.id}`}>Unduh rincian (.txt)</a>
              </details>
            </li>
          })}</ul>}
        </section>}
      </article>
    })}
  </section>
}
