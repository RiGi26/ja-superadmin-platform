import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { hubE1RewriteQuery } from '@/lib/hub-e1-rewrite-query'
import { createClient } from '@/lib/supabase/server'
import { readStockOperatorOwnerView } from '@/lib/stock-operator-owner'
import { safeStockOperatorReturnPath, stockCompanyId, stockOperatorPath } from '@/lib/stock-purchase-policy'
import { StockInvitationForm } from './StockInvitationForm'
import { cancelStockOperatorAction } from './actions'
import styles from './team.module.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Undangan Tim Stock | Webzoka', referrer: 'strict-origin' as const,
  robots: { index: false, follow: false } }

const roles = { admin: 'Admin operasional', staff: 'Staf', produksi: 'Produksi' }
const states = { reserved: 'Menunggu penerima', claimed: 'Verifikasi diterima', activated: 'Keanggotaan diterima',
  canceled: 'Dibatalkan', expired: 'Kedaluwarsa' }
const results: Record<string, string> = { canceled: 'Undangan dibatalkan.', expired: 'Undangan sudah kedaluwarsa.',
  activated: 'Keanggotaan sudah diterima. Gunakan pengelolaan anggota untuk perubahan akses.',
  denied: 'Akses Owner belum dapat diverifikasi.', unconfirmed: 'Hasil pembatalan belum terkonfirmasi. Periksa status terbaru.',
  closed: 'Pengelolaan undangan belum tersedia.' }

export default async function StockOperatorTeamPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = hubE1RewriteQuery(await searchParams, (await headers()).get('host'))
  if (Object.values(query).some(value => Array.isArray(value))) redirect('/hub/account?view=systems')
  const path = safeStockOperatorReturnPath('/hub/stock/team?' + new URLSearchParams(query as Record<string,string>))
  if (!path) redirect('/hub/account?view=systems')
  const company = stockCompanyId(query.company)!
  const command = stockCompanyId(query.command) ?? randomUUID()
  const returnPath = stockOperatorPath(company, command)
  const client = await createClient()
  const user = await client.auth.getUser().catch(() => null)
  if (user?.error || !user?.data.user?.email_confirmed_at || user.data.user.is_anonymous === true) {
    redirect('/hub/login?next=' + encodeURIComponent(returnPath))
  }
  // Put the durable command in the URL before showing any actionable form.
  if (!query.command) redirect(returnPath + (typeof query.result === 'string' ? '&result=' + query.result : ''))
  const workspace = await readStockOperatorOwnerView(company)
  const pending = workspace?.invitations.find(invite => invite.commandId === command && ['reserved','claimed'].includes(invite.state))
  const notice = typeof query.result === 'string' ? results[query.result] : null
  return <main className={styles.page} lang="id"><div className={styles.container}>
    <nav className={styles.nav} aria-label="Customer Hub"><Link href="/hub/account?view=systems">Sistem Saya</Link><span>Webzoka Stock</span></nav>
    <h1>Undangan tim Stock</h1>
    {!workspace ? <section className={styles.panel}><h2>Undangan belum tersedia</h2><p>Akses Owner dan workspace berlangganan perlu diverifikasi sebelum mengelola undangan.</p></section>
      : <><p>{workspace.companyName}</p>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        <div className={styles.grid}><section className={styles.panel}><h2>Undang anggota</h2>
          <p>{workspace.availableSeats} kursi tersedia. Pro mencakup Owner dan paling banyak dua operator tambahan. Basic mencakup satu kursi Owner.</p>
          <StockInvitationForm companyId={workspace.companyId} instanceId={workspace.instanceId} commandId={command} canInvite={workspace.canInvite || !!pending} initialEmail={pending?.email ?? ''} initialRole={pending?.role} />
          <a className={styles.secondary} href={stockOperatorPath(company)}>Mulai undangan lain</a>
        </section><section className={styles.panel}><h2>Undangan terbaru</h2>
          {workspace.invitations.length === 0 ? <p>Belum ada undangan untuk workspace ini.</p> : <ul className={styles.list}>
            {workspace.invitations.map(invite => <li key={invite.inviteId}>
              <strong>{invite.email ?? 'Undangan belum siap dikirim'}</strong><span>{roles[invite.role]} · {states[invite.state]}</span>
              <span>Berlaku sampai {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(invite.expiresAt))} WIB</span>
              {['reserved','claimed'].includes(invite.state) && <><span>{invite.sent ? 'Email terkirim' : 'Pengiriman email belum terkonfirmasi'}</span>
                {!invite.sent && <Link className={styles.secondary} href={stockOperatorPath(company, invite.commandId)}>Periksa pengiriman</Link>}
                <form action={cancelStockOperatorAction}><input type="hidden" name="companyId" value={company} />
                  <input type="hidden" name="inviteId" value={invite.inviteId} /><input type="hidden" name="commandId" value={randomUUID()} />
                  <button className={styles.secondary}>Batalkan undangan</button></form></>}
            </li>)}</ul>}
        </section></div></>}
  </div></main>
}
