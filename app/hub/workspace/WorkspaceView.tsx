'use client'

import { useActionState, useEffect } from 'react'
import { createHubWorkspace } from './actions'
import type { HubE1State } from '@/lib/hub-e1-workspace'
import styles from './workspace.module.css'

const messages: Record<HubE1State['status'], [string, string]> = {
  new: ['Buat workspace baru', 'Gunakan nama usaha Anda untuk menyiapkan workspace Stock baru.'],
  invalid: ['Periksa data workspace', 'Nama usaha harus berisi 2–100 karakter. Buka kembali tautan asli jika referensi permintaan tidak lengkap.'],
  reserved: ['Workspace tersedia, Stock belum aktif', 'Lanjutkan dengan akun Webzoka yang sama untuk menyiapkan koneksi Stock.'],
  quarantined: ['Koneksi tercatat, Stock belum aktif', 'Core telah mencatat koneksi Stock dalam karantina. Status ini belum memberikan akses portal atau langganan produk.'],
  unconfirmed: ['Hasil belum dapat dipastikan', 'Proses mungkin sudah tersimpan. Periksa kembali atau ulangi dengan referensi yang sama; jangan membuat workspace pengganti.'],
  denied: ['Permintaan tidak diizinkan', 'Akun atau akses workspace tidak dapat diverifikasi. Masuk dengan akun Webzoka yang membuat workspace, lalu periksa kembali.'],
  blocked: ['Pendaftaran belum tersedia', 'Pembuatan workspace dan koneksi Stock belum dibuka. Tidak ada aktivasi produk melalui halaman ini.'],
}

export function WorkspaceView({ initial, keys, enabled, stockStart, returnPath }: {
  initial: HubE1State; keys: { admissionId: string; commandId: string } | null;
  enabled: boolean; stockStart: string; returnPath: string;
}) {
  const [state, action, pending] = useActionState(createHubWorkspace.bind(null, keys), initial)
  const [title, description] = messages[state.status]
  const selected = state.selected
  const resultPath = selected ? `/hub/workspace?${new URLSearchParams(selected)}` : returnPath
  useEffect(() => {
    // Persist only non-secret selectors in the current URL after admission.
    // Reloading independently reads Core instead of trusting client state.
    if (selected) window.history.replaceState(null, '', resultPath)
  }, [selected, resultPath])
  const retry = state.status === 'unconfirmed'
  const canCreate = enabled && keys !== null && !selected && ['new', 'invalid', 'unconfirmed'].includes(state.status)
  const canConnect = enabled && selected && ['reserved', 'unconfirmed'].includes(state.status)
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.nav} aria-label="Customer Hub"><a href="/hub/store" className={styles.brand}>Webzoka <span>Customer Hub</span></a><a href={`/hub/login?next=${encodeURIComponent(resultPath)}`}>Masuk ke akun</a></nav>
        <header className={styles.heading}><p>WORKSPACE USAHA</p><h1>Tempat awal usaha Anda.</h1><p>Akun, workspace, dan Customer Hub tidak memerlukan langganan produk.</p></header>
        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="workspace-status">
            <span className={styles.badge}>Stock belum aktif</span>
            <div role="status" aria-live="polite" aria-atomic="true"><h2 id="workspace-status">{title}</h2><p>{description}</p></div>
            {state.companyName && selected && <p className={styles.company}>{state.companyName}</p>}
            {!selected && keys && <form action={action}>
              <label htmlFor="company-name">Nama usaha</label>
              <input id="company-name" name="companyName" type="text" required minLength={2} maxLength={100} autoComplete="organization"
                defaultValue={state.companyName ?? ''} readOnly={retry} disabled={!canCreate || pending} aria-describedby="workspace-help" />
              <p id="workspace-help" className={styles.help}>{retry ? 'Nama usaha dan referensi permintaan dipertahankan saat mengulangi proses.' : 'Khusus workspace baru. Kepemilikan usaha yang sudah ada perlu pemeriksaan terpisah.'}</p>
              <button type="submit" disabled={!canCreate || pending}>{pending ? 'Memeriksa permintaan…' : retry ? 'Periksa permintaan yang sama' : 'Buat workspace gratis'}</button>
            </form>}
            {canConnect && <form action={stockStart} method="post">
              <input type="hidden" name="commandId" value={selected.commandId} /><input type="hidden" name="companyId" value={selected.companyId} /><input type="hidden" name="reservationId" value={selected.reservationId} />
              <button type="submit">Lanjutkan dengan akun Webzoka</button>
              <p className={styles.help}>Anda akan diminta mengonfirmasi akun. Proses ini tidak mengaktifkan Stock.</p>
            </form>}
            {selected && <a className={styles.secondary} href={resultPath}>Periksa status terbaru</a>}
            <p className={styles.footnote}>Tidak memulai trial, tagihan, atau pembayaran produk.</p>
          </section>
          <aside className={styles.aside} aria-label="Tahapan workspace">
            <h2>Satu langkah setiap kali.</h2>
            <ol><li><strong>Workspace gratis</strong><p>Simpan identitas usaha melalui akun Webzoka.</p></li><li><strong>Hubungkan akun Stock</strong><p>Koneksi yang tercatat tetap belum aktif.</p></li><li><strong>Aktivasi terpisah</strong><p>Akses produk memerlukan proses aktivasi berikutnya.</p></li></ol>
            <a href="/hub/store">Jelajahi produk Webzoka <span aria-hidden="true">↗</span></a>
          </aside>
        </div>
      </div>
    </main>
  )
}
