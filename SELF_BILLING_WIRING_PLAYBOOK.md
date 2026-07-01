# Self-Billing Wiring Playbook — langganan mandiri portal → Core

Peta + checklist + jebakan untuk memasang **self-subscribe billing** ke sebuah portal JA.
Pasangan operasional: skill **`/wire-self-billing <portal>`** (urutan eksekusi + gerbang).
Kontrak byte-level webhook entitlement: `ja-stock-platform/BILLING_SYNC_CONTRACT.md`.

**SoR = superadmin Core DB** (`hxhusfkrlafxdnyasmsu`). Portal hanya pembeli + pembaca status.
Core generic: satu kolom `tenants.platform` + `subscription_plans.platform` melayani SEMUA portal.

Referensi kode (tiru, jangan reinvent):
- **Stock** = implementasi **lengkap (Varian B)** — `ja-stock-platform`.
- **LMS** = implementasi **ringan (Varian A)** — `ja-lms-platform`.

---

## 1. Arsitektur (alur)

```
corp /pricing ──"Pilih Growth"──▶ {PORTAL}/register?intent=subscribe&tier=<coreTier>
   │
PORTAL  /api/register ──HMAC──▶ CORE /api/tenants/provision  (buat tenant Core, status trial)
   │  (seed trial lokal + simpan core_tenant_id)                 ◀── balas core_tenant_id
   │  auto-login (signInWithPassword)
   ▼
PORTAL /api/billing/checkout?tier= ──mint token (BILLING_LINK_SECRET)──▶
                         CORE /api/billing/checkout-self ──selfServiceChange──▶ Midtrans Snap
   │                                                                                   │
   ◀───────────────────────────── 302 redirect_url (Snap) ─────────────────────────────┘
   ▼  pembeli bayar
Midtrans ──webhook/confirm──▶ CORE markInvoicePaid (tenant active, plan_tier, invoice paid)
                                   │
                                   └─(Varian B) after() ──HMAC BILLING_SYNC_SECRET──▶
                                              PORTAL /api/billing/sync (update tenant_entitlements)
```

Trial: provision men-set Core `status=trial`,`plan_tier=enterprise`,`trial_ends_at=+14h`. Abandon
checkout → tetap trial (jaring pengaman). Upgrade/downgrade in-portal via `/api/billing/upgrade`
→ picker Core `/billing/langganan` → `selfServiceChange` (upgrade pro-rata seketika · downgrade terjadwal).

## 2. Dua VARIAN — pilih dulu (jangan over-build)

| | **Varian A — Langganan saja** | **Varian B — + Gating fitur per-tier** |
|---|---|---|
| Gating | Status saja (aktif/trial buka, expired/suspended tutup) | Fitur dikunci per paket + status |
| Cache lokal | ❌ baca status dari Core | ✅ `tenant_entitlements` lokal |
| Webhook sync | ❌ tidak perlu | ✅ `/api/billing/sync` + `lib/<portal>-sync.ts` di Core |
| Guards | cek status langganan | `requireEntitlement`/`guardEntitlement` per fitur |
| Contoh | **LMS** | **Stock** |
| Pakai bila | mayoritas portal | owner mau batasi fitur per paket |

Default **A**. Upgrade A→B bisa belakangan (tambah cache+sync+guards tanpa bongkar alur duit).

## 3. Peta file per sisi

**Core (superadmin) — SUDAH ADA, shared, jangan duplikat:**
- `app/api/tenants/provision/route.ts` — provision tenant Core dari portal (HMAC).
- `app/api/billing/checkout-self/route.ts` — checkout token-auth; terima `plan_id` **atau** `tier`.
- `app/api/billing/webhook/route.ts` + `app/api/billing/confirm/route.ts` — Midtrans → `markInvoicePaid`.
- `lib/billing.ts` — `selfServiceChange` (renew/upgrade/downgrade), `markInvoicePaid`.
- `lib/billing-link.ts` — verify token. `lib/<portal>-sync.ts` — **(B)** push entitlement (tiru `stock-sync.ts`).
- DB: `subscription_plans` (baris per `platform`+tier), `tenants`, `tenant_subscriptions`, `subscription_invoices`, `subscription_events`.

**Portal — yang DIBANGUN (tiru stock/lms):**
- `src/app/api/register/route.ts` + `register/page.tsx` — provision + seed trial + auto-login + redaksi dinamis.
- `src/lib/billing-link.ts` — `signBillingToken` (mint).
- `src/app/api/billing/checkout/route.ts` — direct-pay per tier (→ Snap).
- `src/app/api/billing/upgrade/route.ts` — ke picker Core.
- **(B)** `src/lib/entitlements.ts`, migrasi `tenant_entitlements`, `src/app/api/billing/sync/route.ts`, guards di `src/lib/auth.ts`, badge+tombol di `components/dashboard/TopBar.tsx`.

**Corp:** `ja-corp-landing/app/pricing/PricingPageClient.tsx` — `subscribeReady` + CTA `?intent=subscribe&tier=`.

## 4. Env (set di Vercel kedua sisi)

| Env | Sisi | Guna |
|---|---|---|
| `BILLING_LINK_SECRET` | portal **+** core (identik) | tanda-tangan token checkout deep-link |
| `BILLING_SYNC_SECRET` | portal **+** core (identik) | HMAC webhook entitlement (**Varian B**) |
| `SUPERADMIN_BILLING_URL` | portal | base URL Core (checkout-self / picker) |
| `<PORTAL>_URL` (mis. `STOCK_URL`) | core | base URL portal (target webhook sync) |
| `NEXT_PUBLIC_APP_URL` | portal | origin portal (redirect register/login) |

Probe cepat: `POST {portal}/api/billing/sync` tanpa tanda tangan → **401**=secret terset, **500**=belum.

## 5. Checklist wiring

**Wajib (A & B):**
- [ ] `subscription_plans` Core punya baris `platform=<portal>` (tier+harga+max_users+features).
- [ ] Portal `/api/register` → provision Core + simpan `core_tenant_id` + seed trial.
- [ ] `register/page.tsx` auto-login + **redaksi dinamis** (subscribe vs trial).
- [ ] `billing-link.ts` + `/api/billing/checkout` (direct-pay) + `/api/billing/upgrade` (picker).
- [ ] Corp pricing CTA subscribe untuk portal ini (HANYA bila siap).
- [ ] Env (§4) terset 2 sisi + endpoint HMAC di-allowlist proxy/middleware.

**Tambahan (B saja):**
- [ ] `tenant_entitlements` (migrasi) + `entitlements.ts` (kontrak key→fitur).
- [ ] `/api/billing/sync` (verify `BILLING_SYNC_SECRET`).
- [ ] `lib/<portal>-sync.ts` di Core + dipanggil `after()` dari `markInvoicePaid` + suspend.
- [ ] Guards `requireEntitlement`/`guardEntitlement` + badge/tombol Kelola Paket di TopBar.

## 6. Jebakan TERBUKTI (dari UAT Stock/LMS — baca sebelum mulai)

1. **Proxy/middleware blokir endpoint HMAC** → 307 `/login`, provision/sync gagal diam-diam. Allowlist `/api/tenants/provision` & `/api/billing/sync` (Stock: di `proxy.ts` Next16, BUKAN `middleware.ts`).
2. **`BILLING_SYNC_SECRET` belum di-set** di portal → provision bail early. Probe unsigned (401 vs 500).
3. **Sync hanya di webhook** → poll `/api/billing/confirm` (finish Snap) menang balapan, `firstTransition=false` → sync ke-skip. **Taruh `after(syncXTenant)` di DALAM `markInvoicePaid`** (kena semua jalur paid).
4. **Mirror trial set `plan_tier='trial'`** → langgar CHECK (`starter|pro|enterprise`) → "Akun tidak ditemukan". Set tier valid (mis. `starter`/`enterprise`).
5. **Urutan deploy**: portal memanggil Core **produksi** (`SUPERADMIN_BILLING_URL`), bukan preview. **Deploy/merge Core DULU**, baru portal. Perubahan Core backward-compat (mis. `tier` alias di `checkout-self`) aman duluan.
6. **CTA pricing nyasar**: tab portal yang belum di-wire JANGAN diberi CTA `intent=subscribe` — pembeli mendarat di register tanpa handler. Gate CTA hanya ke portal siap.
7. **Redaksi statis "Mulai Trial Gratis"** muncul di alur subscribe → bikin dinamis by `intent`.
8. **`selfServiceChange` untuk tenant trial baru** = jalur `renew` (checkout harga **penuh**), karena `isActiveRunning` butuh `status==='active'`. Itu yang bikin direct-pay menghasilkan Snap penuh — fitur, bukan bug.
9. **Preview branch Vercel terkunci SSO** → tak bisa browser-verify pra-merge. Copy-only = static+tsc; browser-verify di PROD pasca-merge.
10. **Region mismatch** Vercel↔Supabase = +150–250ms/round-trip. Samakan `vercel.json` regions.
11. **Core DB pindah → `CORE_SUPABASE_URL`/`_SERVICE_ROLE_KEY` portal basi** (drift SENYAP). Tiap kali superadmin pindah Core DB (cth. shared-lms→jexp→`hxhu`), TIAP portal yg wire Core WAJIB di-update env-nya + redeploy. Mirror best-effort → kalau salah-arah/skip, tenant tak mendarat di Core yg dibaca `checkout-self` → **404 → checkout_failed**, padahal UX kelihatan jalan sampai serah-terima. Cek cepat: query Core `select max(created_at) from tenants where platform='<portal>'` — kalau jauh ketinggalan, env portal salah-arah. (LMS 2026-06-26.)
12. **Portal pakai custom domain canonical (`<sub>.webzoka.com`)** → UAT di `*.vercel.app` bisa kena cookie cross-domain race (auto-login→checkout via `window.location` → `requireTenant` null → fallback `appOrigin()` custom domain → cert-wall firewall lokal). Workaround UAT: login bersih di vercel.app lalu hit endpoint checkout langsung (sukses → Snap=midtrans). Alur user asli (di custom domain) tak kena. Cert error custom-domain = artefak firewall, BUKAN bug.

## 7. Matriks status portal (perbarui tiap wiring)

| Portal | Varian | Alur duit (register→bayar→aktif) | Gating fitur per-tier | Status |
|---|---|---|---|---|
| Stock | B | ✅ LIVE | ✅ LIVE | **Penuh** (referensi UI) |
| LMS | A | ✅ LIVE + UX parity (auto-login/direct-pay/redaksi/badge, PR lms#16); billing UI diselaraskan ke biru (PR lms#21) | ➖ (sengaja — status only) | **Penuh (Varian A)** |
| Klinik | B (gating ✅) | ⏳ halaman `/admin/langganan` + upgrade (mint→Snap) LIVE (PR clinic#10); butuh env + `linked_tenant_id` terisi | ✅ LIVE (entitlements+guards) | **Billing page LIVE (UI seragam)** — checkout pending env/linked |
| Farmasi | B (gating ✅) | ⏳ halaman `/billing` + upgrade LIVE (PR pharmacy#7); butuh env; UAT prod render+guard PASS | ✅ LIVE | **Billing page LIVE (UI seragam)** — checkout pending env |
| Jastip | — | ❌ (prototype, no backend) | ❌ | **Belum** |
| Travel/Rental | B (gating ✅) | ⏳ halaman `/admin/langganan` (platform Core=`travel`) + upgrade LIVE (PR rental#6); butuh env; UAT Snap owner | ✅ LIVE | **Billing page LIVE (UI seragam)** — checkout pending env, UAT owner |

> **UI seragam (SOP LANGKAH 2.5 di skill):** semua halaman billing in-app ikut standar kanonik Stock — aksen biru `#0071E3`, kartu `rounded-[20px]`, tombol pil, badge "Paling Populer" biru, warna status semantik dipertahankan. Banner gate (`UpsellBanner`/`ExpiredBanner`) di semua portal Tailwind-only & CTA → halaman billing in-app (bukan WhatsApp-only). **Dikecualikan:** websitebuilder (marketplace add-on) & superadmin (ITU checkout pusat). Rental UpsellBanner dikonversi inline→Tailwind.

## 8. UAT (gerbang "selesai")

1. `tsc` 0 di repo tersentuh.
2. **Deploy Core dulu → deploy portal** (jebakan #5). Tunggu Vercel **Ready** keduanya.
3. UAT **di produksi `*.vercel.app`** (Playwright + verifikasi DB 2 sisi via MCP `supabase-core` + MCP portal, Midtrans **sandbox**):
   - **Trial**: register → auto-login → portal + badge "Trial"; cek tenant Core `trial` + (B) entitlements lokal `trial`.
   - **Subscribe**: pilih paket → register → auto-login → **Snap harga benar** → bayar kartu uji `4811111111111114` → Core `active`/`plan_tier`/invoice `paid` → (B) `after()` sync → portal aktif, fitur kebuka, badge paket.
4. **Bersihkan tenant uji di KEDUA DB** (portal + Core) — minta konsen owner sebelum DELETE produksi (auto-mode classifier blok DELETE produksi tanpa konsen eksplisit).
5. Catat keputusan ke `notes/decisions/` + perbarui matriks §7.

## 9. Tautan
- Skill: `.claude/commands/wire-self-billing.md`
- Kontrak webhook: `ja-stock-platform/BILLING_SYNC_CONTRACT.md`
- Playbook saudara (website↔Portal Operasi): `ja-websitebuilder-platform/PORTAL_INTEGRATION_PLAYBOOK.md`
- Standar performa lintas-repo: root `JapanArena SaaS/CLAUDE.md` + prinsip vault `lintas-repo-tahan-banting`.
