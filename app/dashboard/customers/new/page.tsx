import { BadgeCheck, Boxes, ShieldCheck } from 'lucide-react'
import { getPublicStockPlans } from '@/lib/customer-onboarding'
import { ManualCustomerForm } from './ManualCustomerForm'

export const dynamic = 'force-dynamic'

export default async function NewCustomerPage() {
  const plans = await getPublicStockPlans()
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-2xl border border-border bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white lg:sticky lg:top-6 lg:self-start lg:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-300">Manual onboarding</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">Daftarkan customer tanpa membagikan kata sandi.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">Metode admin memakai pipeline yang sama dengan Store: Core menjadi sumber akun, Stock dibuat setelah email customer terverifikasi.</p>
        <div className="mt-7 space-y-4 text-sm">
          <div className="flex gap-3"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-blue-300" /><span><strong className="block text-white">Identitas terverifikasi</strong><span className="text-slate-300">Customer menerima undangan dan membuat kata sandi sendiri.</span></span></div>
          <div className="flex gap-3"><Boxes className="mt-0.5 size-5 shrink-0 text-blue-300" /><span><strong className="block text-white">Provisioning idempotent</strong><span className="text-slate-300">Percobaan ulang tidak membuat tenant atau admin ganda.</span></span></div>
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-300" /><span><strong className="block text-white">Satu login Webzoka</strong><span className="text-slate-300">Setelah siap, customer membuka Stock melalui Hub dengan SSO.</span></span></div>
        </div>
      </section>
      <ManualCustomerForm plans={plans} />
    </div>
  )
}
