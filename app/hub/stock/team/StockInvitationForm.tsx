'use client'

import { useActionState } from 'react'
import { inviteStockOperatorAction, type StockOperatorFormState } from './actions'
import styles from './team.module.css'

const messages = {
  idle: '',
  sent: 'Undangan sudah dikirim. Penerima perlu mendaftar atau masuk dengan email yang diundang, lalu memverifikasi akun.',
  closed: 'Pengiriman undangan belum tersedia.',
  denied: 'Periksa alamat email dan akses Owner untuk workspace ini.',
  unconfirmed: 'Hasil belum terkonfirmasi. Kirim ulang dengan email dan peran yang sama untuk memeriksa hasilnya.',
  full: 'Semua kursi sudah digunakan atau dicadangkan. Batalkan undangan yang belum digunakan bila diperlukan.',
  duplicate: 'Alamat email ini sudah memiliki keanggotaan atau undangan yang masih berlaku.',
  activated: 'Undangan ini sudah diterima.',
  canceled: 'Undangan ini sudah dibatalkan. Buat undangan baru jika diperlukan.',
  expired: 'Undangan ini sudah kedaluwarsa. Buat undangan baru jika diperlukan.',
}

export function StockInvitationForm({ companyId, instanceId, commandId, canInvite, initialEmail = '', initialRole = 'staff' }: {
  companyId: string; instanceId: string; commandId: string; canInvite: boolean; initialEmail?: string; initialRole?: 'admin' | 'staff' | 'produksi';
}) {
  const [state, action, pending] = useActionState<StockOperatorFormState, FormData>(inviteStockOperatorAction, { status: 'idle' })
  const disabled = pending || !canInvite || ['sent','activated','canceled','expired'].includes(state.status)
  return <form action={action} className={styles.form}>
    <input type="hidden" name="companyId" value={companyId} />
    <input type="hidden" name="instanceId" value={instanceId} />
    <input type="hidden" name="commandId" value={commandId} />
    <label htmlFor="operator-email">Email anggota</label>
    <input id="operator-email" name="email" type="email" autoComplete="email" defaultValue={initialEmail} maxLength={254} required aria-describedby="invitation-help" />
    <label htmlFor="operator-role">Peran operasional</label>
    <select id="operator-role" name="role" defaultValue={initialRole}>
      <option value="staff">Staf</option><option value="produksi">Produksi</option><option value="admin">Admin operasional</option>
    </select>
    <p id="invitation-help">Undangan berlaku 24 jam dan mencadangkan satu kursi. Owner tetap mengelola tagihan dan langganan.</p>
    {state.status !== 'idle' && <p className={styles.notice} role="status" aria-live="polite">{messages[state.status]}</p>}
    <button className={styles.primary} disabled={disabled}>{pending ? 'Mengirim undangan…' : 'Kirim undangan'}</button>
  </form>
}
