import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { hubE1RewriteQuery } from '@/lib/hub-e1-rewrite-query'
import { redirect } from 'next/navigation'
import { E1_QUARANTINE_RUNTIME_ENABLED } from '@/lib/e1-quarantine-release'
import { STOCK_E1_APP_ORIGIN } from '@/lib/e1-realm'
import { hubE1Keys, hubE1Selectors, hubE1ReturnPath, readHubE1Workspace, type HubE1State } from '@/lib/hub-e1-workspace'
import { WorkspaceView } from './WorkspaceView'
import { readStockPurchaseIntent } from '@/lib/stock-self-payment'

export const dynamic = 'force-dynamic'
// Native cross-origin form POST needs the real Origin for Stock's CSRF check.
// Send only the origin; workspace paths and selectors never become referrers.
export const metadata = { referrer: 'strict-origin' as const }

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = hubE1RewriteQuery(await searchParams, (await headers()).get('host'))
  const purchaseIntent = await readStockPurchaseIntent()
  const enabled = Boolean(E1_QUARANTINE_RUNTIME_ENABLED)
  let initial: HubE1State = { status: enabled ? 'new' : 'blocked' }
  let keys: { admissionId: string; commandId: string } | null = null
  let returnPath = '/hub/workspace'
  let pilotActive = false
  if (Object.keys(query).length === 0) {
    // Both selectors survive reloads and admission retries. They are not identity
    // or approval. Admission and reciprocal binding use distinct command UUIDs.
    redirect(`/hub/workspace?${new URLSearchParams({ admissionId: randomUUID(), commandId: randomUUID() })}`)
  }
  const selected = hubE1Selectors.safeParse(query)
  const creation = hubE1Keys.safeParse(query)
  if (selected.success) {
    initial = await readHubE1Workspace(selected.data)
    if (process.env.STOCK_SSO_PILOT_ENABLED === 'true') {
      const { readE1PilotStatus } = await import('@/lib/stock-e1-pilot')
      pilotActive = await readE1PilotStatus(selected.data.companyId, selected.data.reservationId)
    }
    returnPath = hubE1ReturnPath(selected.data)
  } else if (creation.success) {
    keys = creation.data
  } else initial = { status: 'invalid' }
  return <>{pilotActive
    ? <section className="mx-auto max-w-xl px-4 py-8"><h1 className="text-2xl font-semibold">Ruang kerja Stock aktif</h1>
        <p className="mt-3 text-base">Akses pengujian terbatas telah dikonfirmasi.</p></section>
    : <WorkspaceView initial={initial} keys={keys} enabled={enabled}
    stockStart={`${STOCK_E1_APP_ORIGIN}/api/auth/e1/start`} returnPath={returnPath}
    checkoutPath={purchaseIntent ? '/hub/checkout/stock' : null} />}
    {process.env.STOCK_SSO_PILOT_ENABLED === 'true' && (initial.status === 'quarantined' || pilotActive) &&
      <div className="mx-auto max-w-xl px-4 pb-8">
        <a href={`${STOCK_E1_APP_ORIGIN}/login`} className="flex min-h-11 items-center justify-center rounded-xl bg-[#0071E3] px-4 py-3 text-base font-semibold text-white">
          Lanjutkan ke Webzoka Stock
        </a>
      </div>}
  </>
}
