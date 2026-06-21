# Japan Arena SaaS — Langganan Tenant (Lapisan 2) — Plan Implementasi

> Dibuat 2026-06-21. Repo: `ja-superadmin-platform` (Next.js 16 + Shadcn). Core DB: `jexpxecxylyeefywdzpd`.
> Tujuan: tenant (sekolah/klinik/dll) **berlangganan & membayar platform ke JapanArena** via Midtrans,
> otomatis aktif/perpanjang — mengganti aktivasi manual superadmin.
> Status: PLAN — belum ada kode. Beberapa keputusan + verifikasi fondasi dibutuhkan dulu.
>
> ⚠️ JANGAN bingung dengan "siswa bayar SPP" (Track A, repo LMS, PR #3) — itu lapisan berbeda.

## Kondisi sekarang (terverifikasi dari kode)

**Sudah ada di superadmin/Core DB:**
- Tabel `tenants`, `subscription_plans` (`price_monthly` + `price_yearly`, `features` jsonb), `tenant_subscriptions`
  (`status`, `current_period_start/end`, `cancel_at_period_end`, `payment_gateway_customer_id/subscription_id` — kosong),
  `subscription_events` (audit), `tenant_members`, `users`, `leads`.
- Dashboard: list/detail/buat tenant, daftar subscription + peringatan expiry, audit log, lead→tenant.
- `POST /api/admin/tenants` — buat tenant + owner + subscription `trial` (14 hari) + welcome email (Resend).
- Auth: `verifySuperadmin()` (JWT `user_role==='superadmin'` atau `email===SUPERADMIN_EMAIL`).

**Belum ada (inti Lapisan 2):**
- ❌ Integrasi Midtrans / pembayaran apa pun (cek `package.json` superadmin: tak ada lib payment).
- ❌ Endpoint lifecycle: aktivasi (trial→active), perpanjang, suspend, cancel, ganti paket. (Event-type
  sudah didefinisikan di UI tapi tak ada yang men-trigger.)
- ❌ Cron renewal / reminder bayar langganan.

## ⚠️ Ketidakpastian fondasi — WAJIB dibereskan dulu (Phase 0)

1. **Core DB tak bisa diverifikasi dari sesi Claude ini** — tak ada MCP untuk `jexpxecxylyeefywdzpd`
   (yang tersedia: lms/portal/rental/websitebuilder). Skema nyata mungkin ≠ `core_schema.sql`.
2. **Drift schema ↔ kode ↔ types:**
   - `users` (core_schema) **tanpa** `tenant_id/role/status`, TAPI `api/admin/tenants` meng-insert kolom itu
     → salah satu tidak akurat. Perlu tahu kolom `users` yang sebenarnya.
   - `types/tenant.ts` punya `midtrans_plan_id`, `tier`, `limits`, `grace_period_ends_at` yang **tak ada**
     di `core_schema.sql`; `features` di types = `string[]` tapi di SQL = jsonb object.
   - Seed plan: `core_schema.sql` = 5 plan (rental+lms); CLAUDE.md klaim 12 (4×3) — ada migrasi seed lain?
3. **Model auth lintas-platform untuk checkout:** tenant login di aplikasinya (LMS pakai Supabase LMS
   `jqypnrwegqyjteparqpv`), tapi langganan ada di Core DB. Bagaimana tenant terautentikasi saat membayar?
   (link bertoken dari app + WA · login di portal superadmin · SSO Core DB). Ini menentukan entry checkout.

→ **Phase 0 = verifikasi skema Core DB nyata + reconcile schema/types/kode + putuskan auth checkout.**
   Tanpa ini, kode payment berisiko dibangun di atas asumsi yang salah.

## Keputusan produk (butuh jawaban owner)

| # | Keputusan | Opsi | Rekomendasi |
|---|---|---|---|
| 1 | **Model billing** | charge-per-period (Snap, bayar per bulan/tahun, perpanjang manual + reminder) · auto-recurring (Midtrans Recurring API, kartu tersimpan) | **charge-per-period** (sederhana, semua channel QRIS/VA/e-wallet, no simpan kartu) |
| 2 | **Entry checkout** | portal terpusat di superadmin · embedded di tiap platform (`/admin/billing` → API pusat) · link bayar manual dari superadmin | **portal terpusat** (lintas-platform, satu tempat logika uang) |
| 3 | **Periode** | bulanan saja · bulanan + tahunan | **bulanan + tahunan** (`price_yearly` sudah ada) |
| 4 | **Scope awal** | LMS dulu · semua platform sekaligus | **LMS dulu**, lalu rambah |
| 5 | **Akun Midtrans** | akun platform JapanArena (1 akun) · per-platform | **akun platform JapanArena** (sama seperti Track A) |

## Rencana bertahap

### Phase 0 — Fondasi (prasyarat, sebelum kode billing)
- Tambah MCP Core DB (atau owner jalankan introspeksi) → dapatkan skema `users`/`subscription_plans`/
  `tenant_subscriptions` yang SEBENARNYA.
- Reconcile `core_schema.sql` ↔ `types/tenant.ts` ↔ kode. Satukan jadi sumber kebenaran.
- Putuskan model auth checkout (keputusan #2) → menentukan arsitektur Phase 2.

### Phase 1 — Billing core (port Midtrans dari Track A)
- **Migration Core DB:**
  - `subscription_invoices` (BARU): `id, tenant_id, subscription_id, plan_id, period ('monthly'|'yearly'),
    amount, midtrans_order_id (unique, nullable), snap_token, redirect_url, status
    (unpaid|awaiting_payment|paid|failed|expired), midtrans_mode, paid_at, raw_notification jsonb, created_at`.
  - `platform_settings` (key-value, mode Midtrans toggle) — sama pola Track A.
  - Tambah kolom Midtrans yang nyata bila perlu (`midtrans_order_id` mapping ke `payment_gateway_subscription_id`).
- **Port `lib/midtrans.ts`** dari LMS (mode toggle + `verifyMidtransSignature` SHA512 timing-safe) — generik, akun platform.
- **Endpoint:**
  - `POST /api/billing/checkout` — buat `subscription_invoices` + Snap token (insert 2-fase) → redirect_url.
  - `POST /api/billing/webhook` — verifikasi per-mode → saat lunas: latch invoice `paid` (idempoten),
    set `tenant_subscriptions.status='active'` + `current_period_end += periode`, `tenants.status='active'`,
    catat `subscription_events` (`payment_received`+`subscription_activated`).
  - `POST /api/billing/confirm` — poll status (cadangan webhook).
- Idempotensi + terminal-state guard — pola `lib/payment.ts` Track A.

### Phase 2 — Lifecycle + UI
- **Superadmin** (`/dashboard/tenants/[id]`): tombol aksi **activate manual · extend · suspend · cancel · ganti plan**
  → endpoint + `subscription_events`. (Berguna independen dari payment — bisa dikerjakan lebih dulu.)
- **Tenant-facing** (sesuai keputusan #2): halaman pilih paket + bayar. Wire tombol "Segera Hadir" di
  `/admin/billing` (LMS) → checkout pusat. Reconcile duplikasi: `/admin/billing` LMS sekarang baca `tenants`
  **lokal LMS**, bukan Core DB → samakan ke Core DB (atau via API status).

### Phase 3 — Renewal & enforcement
- **Cron**: expiry → `past_due` (grace) → `suspended`; reminder bayar (WA/email) H-7/H-3/H-1.
- **Middleware** tiap platform enforce status langganan dari Core DB (LMS sudah ada pola; pastikan sumbernya Core DB).

## Reuse dari Track A (LMS PR #3)
`lib/midtrans` (mode toggle, signature verify), pola insert-2-fase + latch idempoten (`lib/payment`),
admin payment-mode toggle, webhook terminal-state guard. **~60–70% pola payment bisa disalin** — bukan dari nol.

## Catatan build-time
- Repo = **Next.js 16** → baca `node_modules/next/dist/docs/` dulu (per `AGENTS.md`) + **Shadcn/UI** (beda dari LMS).
- **1 sesi Claude per repo** → kerja superadmin idealnya sesi terfokus sendiri (hindari drift index.lock).
- Server key Midtrans di env **superadmin** (akun platform JapanArena), bukan per-tenant.
- Apply migration ke Core DB butuh akses (MCP/CLI) yang owner sediakan.

## Keputusan terkunci (2026-06-21)

1. **Model billing = charge-per-period** (Snap one-time per bulan/tahun; perpanjang = bayar lagi + reminder; tanpa simpan kartu).
2. **Entry checkout = portal terpusat di superadmin** (halaman billing di domain superadmin; app tenant me-link ke sana).
3. Periode = bulanan + tahunan. 4. Scope awal = LMS dulu. 5. Akun Midtrans = akun platform JapanArena (1 akun).

**Implikasi auth checkout (untuk Phase 0):** karena tenant login di app-nya (auth LMS) sementara billing di Core DB,
portal terpusat sebaiknya diakses via **link bertoken** — app tenant (yang tahu `tenant_id` dari JWT claim) mint
token singkat → portal superadmin validasi → tampilkan paket tenant itu → bayar. Perlu dipastikan di Phase 0 bahwa
`tenant_id` di JWT app = `tenants.id` di Core DB (identitas tenant nyambung lintas-DB).

## Phase 0 — SQL introspeksi Core DB (jalankan di SQL Editor `jexpxecxylyeefywdzpd`, tempel hasil)

```sql
-- 1. Kolom tabel kunci (deteksi drift vs core_schema.sql)
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('users','tenants','subscription_plans','tenant_subscriptions',
                     'subscription_events','tenant_members','platform_settings')
order by table_name, ordinal_position;

-- 2. Semua tabel public (cek ada/tidak tabel billing/invoice/platform_settings)
select table_name from information_schema.tables where table_schema='public' order by table_name;

-- 3. Nilai enum
select t.typname, e.enumlabel
from pg_type t join pg_enum e on e.enumtypid=t.oid
where t.typname in ('tenant_status','subscription_status','platform_type','member_role')
order by t.typname, e.enumsortorder;

-- 4. Plan yang ada (jumlah + harga)
select id, name, platform, tier_display_name, price_monthly, price_yearly, is_active
from public.subscription_plans order by platform, price_monthly;

-- 5. Sebaran status langganan
select status, count(*) from public.tenant_subscriptions group by status;
```

Begitu hasil ini ada → Phase 1 bisa dimulai dengan skema yang benar.
