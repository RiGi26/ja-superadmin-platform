import Link from 'next/link'
import type { StockBillingWorkspace } from '@/lib/stock-self-payment'
import { createCheckoutStockWorkspace, prepareStockWorkspace, prepareStockMembership, submitStockPayment } from './actions'
import { ACTIVE_STOCK_ORIGIN } from '@/lib/stock-active-protocol'
import type { StockWorkspaceChoice } from '@/lib/stock-membership-protocol'
import { stockCheckoutPath } from '@/lib/stock-purchase-policy'
import styles from './checkout.module.css'
import { StockActivationStatus } from '../../_components/StockActivationStatus'

type Plan = { id: string; tierDisplayName: string; priceMonthly: number; features: readonly string[] }
const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
const errors: Record<string, string> = {
  closed: 'Pembelian paket ini belum dibuka. Hubungi tim Webzoka untuk informasi aktivasi.',
  denied: 'Akses Owner untuk usaha ini belum dapat diverifikasi. Tidak ada pembayaran yang dimulai.',
  preparation_required: 'Selesaikan penyambungan workspace Stock sebelum membayar.',
  pending: 'Tagihan mungkin sudah dibuat. Periksa Tagihan sebelum memulai pembayaran lain.',
  unavailable: 'Pembayaran belum dapat dilanjutkan. Periksa status terbaru atau hubungi bantuan.',
  workspace_denied: 'Workspace belum dapat dibuat. Masuk dengan akun Webzoka yang sudah diverifikasi dan periksa nama usaha.',
  workspace_unconfirmed: 'Pembuatan workspace belum terkonfirmasi. Kirim ulang nama usaha yang sama dari halaman ini untuk memeriksa hasilnya.',
  workspace_reserved: 'Workspace sudah dibuat. Lanjutkan penyambungan workspace Stock dari halaman ini.',
}

export function StockCheckoutView({ plan, salesEnabled, sandbox = false, accessReady, workspaces, selected, result,
  preparationRequired = false, membershipPreparation = null, membershipPreparationEnabled = true, workspaceCreation = null }: {
  plan: Plan | null; salesEnabled: boolean; accessReady: boolean; workspaces: StockBillingWorkspace[];
  selected: StockBillingWorkspace | null; result: string | null;
  sandbox?: boolean;
  preparationRequired?: boolean; membershipPreparation?: StockWorkspaceChoice | null; membershipPreparationEnabled?: boolean;
  workspaceCreation?: { href: string; commandId: string | null } | null;
}) {
  const paid = selected?.activation === 'pending' || selected?.activation === 'active'
  const paidInvoice = selected?.invoices.find(invoice => invoice.status === 'paid')
  const renewing = selected && plan && selected.subscription?.planId === plan.id && (selected.hasPaidContract || selected.invoices.some(invoice => invoice.planId === plan.id && ['unpaid', 'awaiting_payment'].includes(invoice.status)))
  const available = salesEnabled || renewing
  const canPay = available && accessReady && selected?.stockTenantId && !paid && !preparationRequired
  return <main className={styles.page} lang="id"><div className={styles.container}>
    <nav className={styles.nav} aria-label="Customer Hub"><Link href="/hub/account" className={styles.brand}>webzoka</Link><a href="/hub/account?view=billing">Tagihan & paket</a></nav>
    <header className={styles.heading}><h1>Paket Stock untuk usaha Anda</h1><p>Periksa usaha dan paket sebelum melanjutkan pembayaran.</p></header>
    {sandbox && <p className={styles.notice} role="status">Mode uji Sandbox. Pembayaran ini tidak menagih uang nyata.</p>}
    {!plan ? <section className={styles.panel}><h2>Pilih paket Stock</h2><p>Pilih Basic atau Pro melalui Store untuk melanjutkan.</p><Link className={styles.primary} href="/hub/store#stock-packages">Lihat paket Stock</Link></section> : <div className={styles.grid}>
      <section className={styles.panel} aria-labelledby="business-title"><h2 id="business-title">Usaha Anda</h2>
        {result && errors[result] && <p className={styles.notice} role="alert">{errors[result]}</p>}
        {!salesEnabled && !renewing && <p className={styles.notice} role="status">Pembelian mandiri paket baru belum dibuka. Pilihan harga ini belum dapat dibayar.</p>}
        {!accessReady ? <p>Akses usaha belum dapat diperiksa. Muat ulang halaman atau hubungi bantuan.</p> : workspaceCreation?.commandId ? <>
          <p id="workspace-name-help">Gunakan nama usaha baru. Pembuatan workspace belum memulai langganan.</p>
          <form className={styles.selector} action={createCheckoutStockWorkspace}>
            <input type="hidden" name="plan" value={plan.id} />
            <input type="hidden" name="creation" value={workspaceCreation.commandId} />
            <label htmlFor="workspace-name">Nama usaha</label>
            <input id="workspace-name" name="companyName" autoComplete="organization" minLength={2} maxLength={100} required aria-describedby="workspace-name-help" />
            <button className={styles.primary}>Buat workspace</button>
          </form>
          <Link className={styles.secondary} href={stockCheckoutPath(plan.id)}>Kembali ke pilihan usaha</Link>
        </> : workspaces.length === 0 ? <>
          <p>Siapkan workspace baru menggunakan nama usaha Anda. Penyambungan workspace belum memulai trial atau pembayaran.</p>
          {workspaceCreation ? <Link className={styles.primary} href={workspaceCreation.href}>Buat workspace baru</Link>
            : <form action={prepareStockWorkspace}><input type="hidden" name="plan" value={plan.id} /><button className={styles.primary}>Siapkan workspace usaha</button></form>}
          <p className={styles.muted}>Kepemilikan usaha yang sudah ada memerlukan pemeriksaan terpisah.</p>
        </> : <>
          {workspaces.length > 1 && <form method="get" action="/hub/checkout/stock" className={styles.selector}><input type="hidden" name="plan" value={plan.id} /><label htmlFor="stock-company">Pilih usaha</label><select id="stock-company" name="company" required defaultValue={selected?.companyId ?? ''}><option value="" disabled>Pilih usaha milik Anda</option>{workspaces.map(item => <option key={item.companyId} value={item.companyId}>{item.companyName}</option>)}</select><button className={styles.secondary}>Gunakan usaha ini</button></form>}
          {selected && <><p className={styles.business}>{selected.companyName}</p>
            {selected.activation === 'pending' && paidInvoice && <StockActivationStatus invoiceId={paidInvoice.id} className={styles.secondary} />}
            {paid ? <div className={styles.notice} role="status"><h3>{selected.activation === 'active' ? 'Stock sudah aktif' : 'Pembayaran diterima, aktivasi diproses'}</h3><p>{selected.activation === 'active' ? 'Kelola akses dan tagihan melalui Customer Hub.' : 'Tidak perlu membayar lagi. Status akan diperbarui setelah koneksi Stock terkonfirmasi.'}</p><a className={styles.secondary} href="/hub/account?view=billing">Periksa Tagihan</a></div>
            : preparationRequired ? <><p>Konfirmasi workspace dan akun Stock sebelum membuat tagihan. Langkah ini belum mengaktifkan langganan.</p>
              {!membershipPreparationEnabled ? <p role="status">Penyambungan workspace ini belum tersedia.</p>
                : membershipPreparation ? <form method="post" action={ACTIVE_STOCK_ORIGIN + '/api/auth/stock-membership/start'}>
                <input type="hidden" name="commandId" value={membershipPreparation.commandId} />
                <input type="hidden" name="companyId" value={membershipPreparation.companyId} />
                <input type="hidden" name="reservationId" value={membershipPreparation.instanceId} />
                <button className={styles.primary}>Konfirmasi koneksi Stock</button>
              </form> : <form action={prepareStockMembership}><input type="hidden" name="plan" value={plan.id} />
                <input type="hidden" name="company" value={selected.companyId} /><button className={styles.primary}>Verifikasi workspace Stock</button>
              </form>}
            </>
            : !selected.stockTenantId ? <><p>Sambungkan akun Stock untuk menyiapkan workspace sebelum pembayaran.</p><form action={prepareStockWorkspace}><input type="hidden" name="plan" value={plan.id} /><input type="hidden" name="company" value={selected.companyId} /><button className={styles.primary}>Selesaikan penyambungan Stock</button></form></>
            : <><p>Workspace Stock siap menerima aktivasi setelah pembayaran terverifikasi.</p><form action={submitStockPayment}><input type="hidden" name="plan" value={plan.id} /><input type="hidden" name="company" value={selected.companyId} /><button className={styles.primary} disabled={!canPay}>Lanjutkan ke pembayaran</button></form></>}
          </>}
        </>}
        {accessReady && workspaceCreation && !workspaceCreation.commandId && workspaces.length > 0 &&
          <Link className={styles.creationLink} href={workspaceCreation.href}>Buat workspace baru</Link>}
        <a className={styles.help} href="https://wa.me/6281296917963?text=Halo%20Webzoka%2C%20saya%20membutuhkan%20bantuan%20pembayaran%20Stock." target="_blank" rel="noopener noreferrer">Hubungi bantuan Webzoka</a>
      </section>
      <aside className={styles.summary} aria-labelledby="order-title"><h2 id="order-title">Ringkasan paket</h2><p className={styles.package}>Stock {plan.tierDisplayName}</p><p className={styles.price}>{money(plan.priceMonthly)}<span>per bulan</span></p><ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul><dl className={styles.total}><dt>Total pembayaran bulanan</dt><dd>{money(plan.priceMonthly)}</dd></dl><p className={styles.muted}>Pembayaran dilakukan secara manual. Tidak ada debit otomatis. Langganan dimulai setelah pembayaran terverifikasi; trial 14 hari ditangani terpisah oleh tim.</p></aside>
    </div>}
  </div></main>
}
