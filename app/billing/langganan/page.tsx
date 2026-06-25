import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBillingToken } from '@/lib/billing-link'
import { LanggananCheckout, type CheckoutPlan } from './Checkout'
import { ShieldX } from 'lucide-react'

/**
 * /billing/langganan — halaman checkout self-service tenant (Slice C, publik).
 * Membaca ?token=<HMAC> yang di-mint app tenant, memverifikasinya → tenant_id,
 * lalu menampilkan paket platform tenant untuk dibayar via Snap. Tidak butuh
 * login superadmin; token bertanda tangan adalah otorisasinya.
 */

const PLATFORM_LABEL: Record<string, string> = {
  lms: 'Webzoka LMS',
  clinic: 'Webzoka Clinic',
  pharmacy: 'Webzoka Pharmacy',
  jastip: 'Webzoka Jastip',
  travel: 'Webzoka Travel',
  stock: 'Portal Operasi (Stock)',
}

function Invalid({ title, desc }: { title: string; desc: string }) {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col items-center text-center gap-4">
        <ShieldX className="size-12 text-muted-foreground" />
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground max-w-sm">{desc}</p>
        </div>
      </div>
    </main>
  )
}

export default async function LanggananPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const verified = verifyBillingToken(token)

  if (!verified.ok) {
    if (verified.reason === 'expired') {
      return (
        <Invalid
          title="Tautan kedaluwarsa"
          desc="Tautan pembayaran ini sudah tidak berlaku. Silakan buka kembali halaman langganan di aplikasi Anda untuk mendapatkan tautan baru."
        />
      )
    }
    return (
      <Invalid
        title="Tautan tidak sah"
        desc="Tautan pembayaran tidak dapat diverifikasi. Pastikan Anda membuka tautan terbaru dari aplikasi Anda."
      />
    )
  }

  const db = createAdminClient()
  const { data: tenant } = await db
    .from('tenants')
    .select('id, name, platform, status')
    .eq('id', verified.tenantId)
    .maybeSingle()

  if (!tenant) {
    return (
      <Invalid
        title="Akun tidak ditemukan"
        desc="Data tenant untuk tautan ini tidak ditemukan. Hubungi tim Webzoka."
      />
    )
  }

  // Paket aktif untuk platform tenant + langganan berjalan (utk pra-pilih).
  const [{ data: planRows }, { data: sub }] = await Promise.all([
    tenant.platform
      ? db
          .from('subscription_plans')
          .select('id, tier, tier_display_name, price_monthly, price_yearly')
          .eq('platform', tenant.platform)
          .eq('is_active', true)
          .order('price_monthly', { ascending: true })
      : Promise.resolve({ data: [] as CheckoutPlan[] }),
    db
      .from('tenant_subscriptions')
      .select('plan_id, status, current_period_start, current_period_end, scheduled_plan_id')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const plans = (planRows ?? []) as CheckoutPlan[]

  // Tier paket berjalan (utk bedakan upgrade/downgrade) — paket berjalan bisa saja
  // tak ada di daftar aktif, jadi query terpisah.
  let currentTier: string | null = null
  if (sub?.plan_id) {
    const { data: cp } = await db
      .from('subscription_plans')
      .select('tier')
      .eq('id', sub.plan_id)
      .maybeSingle()
    currentTier = cp?.tier ?? null
  }

  if (plans.length === 0) {
    return (
      <Invalid
        title="Belum ada paket"
        desc="Belum ada paket langganan yang tersedia untuk akun Anda. Hubungi tim Webzoka untuk bantuan."
      />
    )
  }

  return (
    <main className="min-h-dvh bg-background p-6 flex items-center justify-center">
      <LanggananCheckout
        token={token!}
        tenantName={tenant.name ?? 'Akun Anda'}
        platformLabel={tenant.platform ? PLATFORM_LABEL[tenant.platform] ?? tenant.platform : ''}
        plans={plans}
        currentPlanId={sub?.plan_id ?? null}
        currentTier={currentTier}
        subscriptionStatus={sub?.status ?? null}
        currentPeriodStart={sub?.current_period_start ?? null}
        currentPeriodEnd={sub?.current_period_end ?? null}
        scheduledPlanId={sub?.scheduled_plan_id ?? null}
      />
    </main>
  )
}
