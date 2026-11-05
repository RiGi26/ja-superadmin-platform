'use client'

import { useActionState } from 'react'
import { changeStockMemberAction, retryStockMemberAction, type StockMemberFormState } from './actions'
import type { StockMemberOwnerView } from '@/lib/stock-member-owner'
import styles from './team.module.css'

const messages={idle:'',closed:'Pengelolaan anggota belum tersedia.',denied:'Akses Owner atau pilihan anggota belum dapat diverifikasi.',
  unconfirmed:'Hasil belum terkonfirmasi. Muat ulang status sebelum mengubah akses lagi.',
  saved:'Perubahan tersimpan. Status pengiriman ke Stock tersedia setelah memuat ulang.',
  unchanged:'Tidak ada perubahan baru. Muat ulang untuk melihat status terbaru.',queued:'Pengiriman ulang dijadwalkan. Muat ulang untuk memeriksa hasilnya.'}
const initial: StockMemberFormState={status:'idle'}
function Notice({state}:{state:StockMemberFormState}) {
  return state.status==='idle'?null:<p className={styles.notice} role="status" aria-live="polite">{messages[state.status]}</p>
}
export function StockMemberControls({companyId,member,canManage,roleCommand,revokeCommand}:{
  companyId:string;member:StockMemberOwnerView['members'][number];canManage:boolean;roleCommand:string;revokeCommand:string;
}) {
  const [roleState,roleAction,rolePending]=useActionState(changeStockMemberAction,initial)
  const [revokeState,revokeAction,revokePending]=useActionState(changeStockMemberAction,initial)
  const [retryState,retryAction,retryPending]=useActionState(retryStockMemberAction,initial)
  const changed=['saved','unchanged','unconfirmed'].includes(roleState.status)||['saved','unchanged','unconfirmed'].includes(revokeState.status)
  const disabled=!canManage||rolePending||revokePending||changed
  const common=<><input type="hidden" name="companyId" value={companyId}/><input type="hidden" name="membershipId" value={member.membershipId}/>
    <input type="hidden" name="expectedRevision" value={member.revision}/></>
  return <>
    {!member.revoked && <><form action={roleAction} className={styles.form}>
      {common}<input type="hidden" name="commandId" value={roleCommand}/><input type="hidden" name="action" value="role"/>
      <label htmlFor={'role-'+member.membershipId}>Peran operasional</label>
      <select id={'role-'+member.membershipId} name="role" defaultValue={member.role} disabled={disabled||!member.canChangeRole}>
        <option value="staff">Staf</option><option value="produksi">Produksi</option><option value="admin">Admin operasional</option>
      </select>
      {!member.canChangeRole && <p>Peran dapat diubah setelah aktivasi anggota dan langganan terkonfirmasi.</p>}
      <Notice state={roleState}/><button className={styles.primary} disabled={disabled||!member.canChangeRole}>
        {rolePending?'Menyimpan…':'Simpan peran'}</button>
    </form><form action={revokeAction} className={styles.form}>
      {common}<input type="hidden" name="commandId" value={revokeCommand}/><input type="hidden" name="action" value="revoke"/>
      <label className={styles.confirm}><input type="checkbox" name="confirm" value="revoke" required disabled={disabled}/>
        <span>Saya ingin mencabut akses anggota ini. Akses lama tidak dapat diaktifkan kembali; penerimaan berikutnya memerlukan undangan baru.</span></label>
      <Notice state={revokeState}/><button className={styles.secondary} disabled={disabled}>{revokePending?'Mencabut akses…':'Cabut akses'}</button>
    </form></>}
    {member.pendingEvents.length>0 && <form action={retryAction} className={styles.form}>
      <p>Perubahan tersimpan di Hub. Pengiriman ke Stock masih menunggu konfirmasi.</p>
      <input type="hidden" name="companyId" value={companyId}/><input type="hidden" name="eventId" value={member.pendingEvents[0]}/>
      <Notice state={retryState}/><button className={styles.secondary} disabled={retryPending}>{retryPending?'Menjadwalkan…':'Coba kirim perubahan'}</button>
    </form>}
    {changed && <a className={styles.secondary} href={'/hub/stock/team?company='+encodeURIComponent(companyId)}>Muat ulang status anggota</a>}
  </>
}
