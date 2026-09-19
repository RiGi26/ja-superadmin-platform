import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clock3, RefreshCw, Send, ShieldAlert } from 'lucide-react'
import { getOnboardingStatus } from '@/lib/customer-onboarding'
import { resendManualStockInviteAction, retryStockProvisioningAsAdminAction } from '@/app/hub/onboarding/actions'

export const dynamic = 'force-dynamic'

export default async function AdminOnboardingStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ retry?: string; resent?: string }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const onboarding = await getOnboardingStatus(id)
  if (!onboarding) notFound()
  const ready = onboarding.status === 'ready'
  const pending = onboarding.status === 'pending_verification'
  const Icon = ready ? CheckCircle2 : onboarding.canRetry ? ShieldAlert : Clock3

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/dashboard/customers/new" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali ke registrasi customer
      </Link>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-500"><Icon className="size-6" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-500">Status onboarding Stock</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{onboarding.businessName}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{onboarding.ownerEmail} · Paket {onboarding.planName}</p>
            <span className="mt-4 inline-flex rounded-full bg-muted px-3 py-1.5 text-xs font-bold capitalize text-foreground">{onboarding.status.replaceAll('_', ' ')}</span>
          </div>
        </div>

        {onboarding.safeError ? <p className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-600">{onboarding.safeError}</p> : null}
        {query.retry === '1' ? <p className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-600">Setup ulang sudah dijadwalkan.</p> : null}
        {query.resent === '1' ? <p className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-600">Undangan verifikasi sudah dikirim ulang.</p> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {pending ? (
            <form action={resendManualStockInviteAction}>
              <input type="hidden" name="request_id" value={onboarding.id} />
              <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground sm:w-auto"><Send className="size-4" /> Kirim ulang undangan</button>
            </form>
          ) : null}
          {onboarding.canRetry ? (
            <form action={retryStockProvisioningAsAdminAction}>
              <input type="hidden" name="request_id" value={onboarding.id} />
              <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground sm:w-auto"><RefreshCw className="size-4" /> Coba setup Stock lagi</button>
            </form>
          ) : null}
          <Link href={`/dashboard/customers/onboarding/${onboarding.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground">Perbarui status</Link>
        </div>
      </section>
    </div>
  )
}
