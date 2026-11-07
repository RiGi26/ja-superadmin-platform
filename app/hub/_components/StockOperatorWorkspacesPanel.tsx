import { randomUUID } from 'node:crypto'
import type { StockOperatorWorkspaceList } from '@/lib/stock-operator-workspaces'
import { STOCK_E1_APP_ORIGIN } from '@/lib/e1-realm'
import styles from './stock-billing.module.css'

const roles = { admin: 'Admin operasional', staff: 'Staf', produksi: 'Produksi' }

export function StockOperatorWorkspacesPanel({ list }: { list: StockOperatorWorkspaceList | null }) {
  if (!list || list.status==='closed') return null
  if (list.status==='unavailable') return <section className={styles.panel} role="status">
    <h2>Akses tim Stock belum dapat diperiksa</h2><p>Muat ulang Sistem Saya untuk memeriksa keanggotaan terbaru.</p>
    <a className={styles.secondary} href="/hub/account?view=systems">Periksa keanggotaan</a>
  </section>
  if (list.workspaces.length===0) return null
  return <section className={styles.section} aria-label="Workspace tim Stock">
    {list.workspaces.map(workspace=><article id={`stock-${workspace.companyId}`} key={workspace.companyId} className={styles.panel}>
      <div className={styles.title}><div><h2>{workspace.companyName}</h2><p>Webzoka Stock · {roles[workspace.role]}</p></div></div>
      <p>Pilih workspace untuk bekerja. Akses diperiksa kembali saat masuk. Owner mengelola langganan dan tagihan.</p>
      <div className={styles.actions}><form method="post" action={STOCK_E1_APP_ORIGIN+'/api/auth/stock-membership/selection/start'}>
        <input type="hidden" name="companyId" value={workspace.companyId} />
        <input type="hidden" name="reservationId" value={workspace.instanceId} />
        <input type="hidden" name="commandId" value={randomUUID()} />
        <button className={styles.primary}>Buka Webzoka Stock</button>
      </form></div>
    </article>)}
  </section>
}
