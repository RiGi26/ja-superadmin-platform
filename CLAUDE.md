@AGENTS.md

# Claude Code — Developer Reference
## ja-superadmin-platform | JapanarEna Corp

---

## 🏗️ Project Context

```
Platform  : ja-superadmin-platform (internal tool)
Stack     : Next.js 16 (App Router) · TypeScript · Supabase · Tailwind · Shadcn/UI
Database  : PostgreSQL via Supabase — SHARED project dengan ja-lms-platform
Auth      : Supabase Auth + Custom JWT Claims (user_role = 'superadmin')
Akses     : HANYA superadmin@japanarenacorp.com
Deploy    : Vercel → admin.japanarenacorp.com (target)
Email     : Resend (welcome email saat create tenant)
```

---

## 🔐 Auth Pattern

Superadmin diverifikasi di **dua tempat**:

### 1. middleware.ts (semua route)
- Decode JWT → cek `user_role === 'superadmin'`
- Fallback: `user.email === SUPERADMIN_EMAIL` (Fase 1, sebelum JWT hook aktif)
- Non-superadmin → redirect `/unauthorized`

### 2. API routes (setiap action sensitif)
- Re-verify sebelum INSERT/UPDATE/DELETE
- Gunakan pattern `verifySuperadmin()` di setiap route handler

```typescript
// Pattern verifikasi di API route:
const supabase = await createClient()
const { data: { session } } = await supabase.auth.getSession()
const payload = JSON.parse(atob(session.access_token.split('.')[1]))
const isSuperadmin = payload?.user_role === 'superadmin' || user?.email === SUPERADMIN_EMAIL
if (!isSuperadmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

---

## 🗄️ Database — Shared Supabase Project

Semua platform (lms, clinic, pharmacy, jastip, superadmin) pakai **satu Supabase project**.

**createAdminClient()** (service_role) HANYA boleh dipakai di:
- `app/api/admin/*/route.ts`
- Server components di dashboard (data fetching read-only)

**JANGAN PERNAH** import `createAdminClient` dari:
- Client components (`'use client'`)
- `lib/` files yang bisa di-import client-side

```typescript
// ✅ BENAR — di server component atau API route
import { createAdminClient } from '@/lib/supabase/admin'
const db = createAdminClient()

// ❌ SALAH — di client component
'use client'
import { createAdminClient } from '@/lib/supabase/admin' // JANGAN
```

---

## 📋 Schema Tabel Kunci

| Tabel                  | Deskripsi                                    |
|------------------------|----------------------------------------------|
| `tenants`              | Satu row per bisnis/institusi per platform   |
| `subscription_plans`   | 12 plans (4 platform × 3 tier)               |
| `tenant_subscriptions` | Status subscription aktif per tenant         |
| `tenant_members`       | Mapping user ↔ tenant + role                 |
| `subscription_events`  | Audit trail billing (append-only)            |
| `leads`                | Form interest dari landing page              |
| `users`                | Profile user (di-join dari auth.users)       |

**JWT claims** yang di-inject hook (Sprint 1):
- `user_role` — bukan `role` (reserved PostgREST)
- `tenant_id`, `tenant_slug`, `platform`, `linked_tenant_id`

---

## 🚨 Common Bug Patterns

### 1. Superadmin Tidak Dikenali Middleware

```
Symptom  : Superadmin di-redirect ke /unauthorized setelah login
Penyebab : JWT hook (Sprint 1) belum aktif → user_role null di JWT
           Email fallback tidak aktif karena SUPERADMIN_EMAIL env tidak di-set

Cek:
  // Di browser console setelah login:
  const s = (await supabase.auth.getSession()).data.session
  JSON.parse(atob(s.access_token.split('.')[1]))
  // Cek: apakah ada key 'user_role'?

Fix:
  1. Aktifkan hook di Supabase Dashboard → Authentication → Hooks
  2. Pastikan SUPERADMIN_EMAIL ter-set di Vercel env vars
  3. Pastikan superadmin ada di tenant_members dengan role='superadmin'
```

### 2. Superadmin Tidak Ada di tenant_members

```
Symptom  : user_role null di JWT — hook tidak inject claims
Penyebab : Superadmin global tidak punya row di tenant_members
           Hook membaca dari tenant_members — jika tidak ada, skip inject

Catatan  : INI EXPECTED BEHAVIOR untuk superadmin global di Sprint 2.
           Middleware pakai email fallback sebagai workaround.
           Sprint 3: buat tenant khusus 'corp' untuk superadmin.

Debug SQL:
  SELECT * FROM tenant_members WHERE user_id = 'superadmin-uuid';
  -- Jika kosong → normal untuk Sprint 2, email fallback aktif
```

### 3. service_role Key di Client Component

```
Symptom  : Build error: "SUPABASE_SERVICE_ROLE_KEY tidak terdefinisi"
           Atau lebih buruk: key ter-expose ke browser (security hole!)
Penyebab : createAdminClient() di-import di komponen client-side

Fix:
  - Pindahkan semua data fetch ke server component atau API route
  - Gunakan createClient() (anon key) di client components untuk auth saja
  - SUPABASE_SERVICE_ROLE_KEY tidak punya prefix NEXT_PUBLIC_ → sengaja
```

### 4. Create Tenant Gagal Sebagian (Partial Failure)

```
Symptom  : Auth user terbuat tapi tenant tidak ada di database
           Atau sebaliknya
Penyebab : Supabase tidak support multi-table transaction via REST API
           Error di step tengah menyebabkan state inkonsisten

Fix yang sudah diterapkan:
  - Jika tenant insert gagal → delete auth user (cleanup)
  - Email gagal TIDAK block tenant creation (try/catch terpisah)

Deteksi orphan:
  SELECT u.id, u.email FROM auth.users u
  LEFT JOIN public.users pu ON pu.id = u.id
  WHERE pu.id IS NULL
    AND u.email NOT LIKE 'demo_%';
  -- Jika ada → cleanup manual atau jalankan re-seed
```

### 5. JWT claim 'role' Conflict dengan PostgREST

```
Symptom  : Error 22023 "role X does not exist" saat login
Penyebab : PostgREST membaca 'role' dari JWT dan SET LOCAL ROLE
           'admin'/'member' bukan PostgreSQL role

Fix      : Sudah diterapkan di Sprint 1 — gunakan 'user_role' bukan 'role'
           Semua RLS policy dan hook sudah pakai 'user_role'
```

---

## 📁 File-File Kritis

```
middleware.ts                     → Auth guard semua route
lib/supabase/admin.ts             → Service role client (SERVER ONLY)
lib/supabase/server.ts            → Server client (cookies-based)
lib/supabase/client.ts            → Browser client (auth only)
app/api/admin/tenants/route.ts    → Create tenant + owner + subscription
app/dashboard/layout.tsx          → Dashboard shell (Sidebar + Header)
components/dashboard/Sidebar.tsx  → Navigasi utama
supabase/migrations/              → SQL migrations (jalankan di SQL Editor)
```

---

## 🔑 Environment Variables

```bash
# Supabase (shared project)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # SERVER ONLY — tanpa NEXT_PUBLIC_

# App
NEXT_PUBLIC_APP_URL=
SUPERADMIN_EMAIL=superadmin@japanarenacorp.com

# Resend
RESEND_API_KEY=                  # SERVER ONLY
RESEND_FROM_EMAIL=noreply@japanarenacorp.com
```

Cek ini saat bug hanya muncul di production:
- Semua env vars sudah di-set di Vercel → Settings → Environment Variables?
- `SUPABASE_SERVICE_ROLE_KEY` tidak punya prefix `NEXT_PUBLIC_`?

---

## ✅ Pre-Deploy Checklist

```
□ SUPERADMIN_EMAIL ter-set di Vercel env vars
□ SUPABASE_SERVICE_ROLE_KEY ter-set (server only, tanpa NEXT_PUBLIC_)
□ RESEND_API_KEY ter-set
□ Migration 20260524_leads_table.sql sudah dijalankan di Supabase
□ JWT hook aktif di Supabase Dashboard (atau email fallback aktif)
□ npx tsc --noEmit → 0 errors
□ npm run build → clean
□ Test login superadmin → berhasil masuk ke /dashboard
□ Test create tenant → tenant terbuat + email terkirim
□ Test non-superadmin login → di-redirect ke /unauthorized
```

---

## 🚫 Anti-Patterns

```
❌ import createAdminClient di client component
❌ Gunakan 'role' sebagai JWT claim key (conflict PostgREST)
❌ Fetch data dari client component langsung ke Supabase (gunakan server component)
❌ Skip verifikasi superadmin di API route (middleware saja tidak cukup)
❌ Log temporaryPassword ke console di production
❌ Commit SUPABASE_SERVICE_ROLE_KEY atau RESEND_API_KEY ke git
```

---

*ja-superadmin-platform · JapanarEna Corp · Internal Developer Reference*
*Sprint 2 — Superadmin Dashboard*
