'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, ArrowRight, CheckCircle2, LoaderCircle, MailCheck, ShieldCheck } from 'lucide-react'
import type { StockPlanChoice } from '@/lib/customer-onboarding'
import { createManualStockCustomerAction, type OnboardingActionState } from '@/app/hub/onboarding/actions'

const initialState: OnboardingActionState = { status: 'idle', message: null }

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
      {pending ? 'Menyiapkan undangan…' : 'Buat Akun & Kirim Undangan'}
    </button>
  )
}

export function ManualCustomerForm({ plans }: { plans: StockPlanChoice[] }) {
  const [state, action] = useActionState(createManualStockCustomerAction, initialState)

  if (state.status === 'success' && state.requestId) {
    return (
      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6">
        <CheckCircle2 className="size-9 text-emerald-500" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">Customer berhasil dicatat</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{state.message}</p>
        <Link
          href={`/dashboard/customers/onboarding/${state.requestId}`}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          Lihat status onboarding <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    )
  }

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Data customer</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Tidak ada kata sandi sementara. Customer membuat kata sandi sendiri melalui undangan terverifikasi.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
          Nama bisnis
          <input className="min-h-12 rounded-xl border border-input bg-background px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" name="business_name" required minLength={2} maxLength={120} autoComplete="organization" placeholder="Contoh: Toko Maju Bersama" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Nama admin
          <input className="min-h-12 rounded-xl border border-input bg-background px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" name="owner_name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Nama lengkap" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          WhatsApp aktif
          <input className="min-h-12 rounded-xl border border-input bg-background px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" name="owner_phone" type="tel" inputMode="tel" required minLength={8} maxLength={24} autoComplete="tel" placeholder="08xx xxxx xxxx" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
          Email akun Customer Hub
          <input className="min-h-12 rounded-xl border border-input bg-background px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" name="owner_email" type="email" required maxLength={254} autoComplete="email" placeholder="nama@bisnis.com" />
          <span className="text-xs font-normal leading-5 text-muted-foreground">Gunakan email asli yang dikelola customer. Link aktivasi hanya dikirim ke alamat ini.</span>
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
          Paket Stock setelah trial
          <select className="min-h-12 rounded-xl border border-input bg-background px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" name="plan_id" required defaultValue={plans[0]?.id ?? ''}>
            {plans.map((plan) => (
              <option value={plan.id} key={plan.id}>{plan.name} · {formatRupiah(plan.priceMonthly)}/bulan</option>
            ))}
          </select>
          <span className="text-xs font-normal leading-5 text-muted-foreground">Trial 14 hari membuka seluruh fitur Stock Pro. Tidak ada pembayaran saat akun dibuat.</span>
        </label>
      </div>

      <div className="grid gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-muted-foreground sm:grid-cols-3">
        <span className="flex items-center gap-2"><MailCheck className="size-4 text-blue-500" /> Undangan email</span>
        <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-blue-500" /> Verifikasi wajib</span>
        <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-blue-500" /> SSO setelah aktif</span>
      </div>

      {state.status === 'error' ? (
        <p className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {state.message}
        </p>
      ) : null}
      <SubmitButton disabled={plans.length === 0} />
    </form>
  )
}
