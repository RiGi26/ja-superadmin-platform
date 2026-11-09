'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { inviteStockOperatorAction, type StockOperatorFormState } from './actions'
import styles from './team.module.css'

const messages = {
  idle: '',
  sent: 'Undangan sudah dikirim. Penerima perlu mendaftar atau masuk dengan email yang diundang, lalu memverifikasi akun.',
  closed: 'Pengiriman undangan belum tersedia.',
  denied: 'Periksa alamat email dan akses Owner untuk workspace ini.',
  unconfirmed: 'Hasil pengiriman belum terkonfirmasi. Coba lagi dengan undangan yang sama.',
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
  const [submitted, setSubmitted] = useState<{ email: string; role: string } | null>(null)
  const retry = state.status === 'unconfirmed' ? submitted : null
  const disabled = pending || !canInvite || ['sent','activated','canceled','expired'].includes(state.status)

  function rememberSubmission(event: FormEvent<HTMLFormElement>) {
    if (retry) return
    const form = new FormData(event.currentTarget)
    const email = form.get('email')
    const role = form.get('role')
    if (typeof email === 'string' && typeof role === 'string') setSubmitted({ email, role })
  }

  return <form key={retry ? 'retry' : 'invite'} action={action} onSubmit={rememberSubmission} className={styles.form}>
    <input type="hidden" name="companyId" value={companyId} />
    <input type="hidden" name="instanceId" value={instanceId} />
    <input type="hidden" name="commandId" value={commandId} />
    <label htmlFor="operator-email">Email anggota</label>
    <input id="operator-email" name="email" type="email" autoComplete="email" defaultValue={retry?.email ?? initialEmail} readOnly={pending || !!retry} maxLength={254} required aria-describedby="invitation-help" />
    <label htmlFor="operator-role">Peran operasional</label>
    {retry && <input type="hidden" name="role" value={retry.role} />}
    <select id="operator-role" name={retry ? undefined : 'role'} defaultValue={retry?.role ?? initialRole} disabled={pending || !!retry}>
      <option value="staff">Staf</option><option value="produksi">Produksi</option><option value="admin">Admin operasional</option>
    </select>
    <p id="invitation-help">Undangan berlaku 24 jam dan mencadangkan satu kursi. Owner tetap mengelola tagihan dan langganan.</p>
    {state.status !== 'idle' && <p className={styles.notice} role="status" aria-live="polite">{messages[state.status]}</p>}
    <button className={styles.primary} disabled={disabled}>{pending ? 'Mengirim undangan…' : retry ? 'Coba lagi' : 'Kirim undangan'}</button>
  </form>
}
