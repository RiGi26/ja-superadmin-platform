// Detached static candidate. No route imports, Server Action or submission handler.
export default function E1WorkspaceCandidate() {
  return (
    <section aria-labelledby="e1-workspace-title" className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 text-foreground md:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Customer Hub Webzoka</p>
        <h1 id="e1-workspace-title" className="text-2xl font-semibold tracking-tight md:text-3xl">Workspace usaha gratis</h1>
        <p className="text-base leading-relaxed">Akun, workspace, dan Customer Hub tidak memerlukan langganan produk.</p>
      </header>

      <section aria-labelledby="e1-registration-title" className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-sm md:p-6">
        <h2 id="e1-registration-title" className="text-lg font-semibold">Buat workspace baru</h2>
        <p id="e1-registration-unavailable" className="text-base leading-relaxed">
          Pendaftaran workspace baru belum tersedia. Anda belum dapat mengirim data melalui halaman ini.
        </p>
        <fieldset disabled aria-describedby="e1-registration-unavailable" className="space-y-4">
          <legend className="sr-only">Pendaftaran workspace belum tersedia</legend>
          <div className="space-y-2">
            <label htmlFor="e1-company-name" className="block text-base font-medium">Nama usaha</label>
            <input id="e1-company-name" name="companyName" type="text" disabled maxLength={100}
              className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-muted px-3 text-base disabled:cursor-not-allowed" />
          </div>
          <button type="button" disabled className="min-h-11 w-full cursor-not-allowed rounded-xl bg-muted px-4 py-3 text-base font-medium text-muted-foreground md:w-auto">
            Buat workspace gratis
          </button>
        </fieldset>
        <p className="text-sm leading-relaxed text-muted-foreground">Pendaftaran workspace tidak memulai trial, tagihan, atau pembayaran produk.</p>
      </section>

      <section aria-labelledby="e1-zero-products-title" className="space-y-4">
        <h2 id="e1-zero-products-title" className="text-lg font-semibold">Workspace tanpa produk</h2>
        <p className="text-base leading-relaxed">Produk dapat dipilih secara terpisah setelah workspace tersedia.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section aria-labelledby="e1-systems-title" className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <h3 id="e1-systems-title" className="text-base font-semibold">Sistem Saya</h3>
            <p className="text-base leading-relaxed">Belum ada produk yang dipilih.</p>
          </section>
          <section aria-labelledby="e1-invoices-title" className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <h3 id="e1-invoices-title" className="text-base font-semibold">Tagihan</h3>
            <p className="text-base leading-relaxed">Tidak ada tagihan workspace atau langganan produk.</p>
          </section>
        </div>
      </section>
    </section>
  )
}
