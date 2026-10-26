import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { E1_QUARANTINE_RUNTIME_ENABLED } from '@/lib/e1-quarantine-release'
import { STOCK_E1_APP_ORIGIN } from '@/lib/e1-realm'
import { hubE1Keys, hubE1Selectors, hubE1ReturnPath, readHubE1Workspace, type HubE1State } from '@/lib/hub-e1-workspace'
import { WorkspaceView } from './WorkspaceView'

export const dynamic = 'force-dynamic'
// Native cross-origin form POST needs the real Origin for Stock's CSRF check.
// Send only the origin; workspace paths and selectors never become referrers.
export const metadata = { referrer: 'strict-origin' as const }

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const enabled = Boolean(E1_QUARANTINE_RUNTIME_ENABLED)
  let initial: HubE1State = { status: enabled ? 'new' : 'blocked' }
  let keys: { admissionId: string; commandId: string } | null = null
  let returnPath = '/hub/workspace'
  if (Object.keys(query).length === 0) {
    // Both selectors survive reloads and admission retries. They are not identity
    // or approval. Admission and reciprocal binding use distinct command UUIDs.
    redirect(`/hub/workspace?${new URLSearchParams({ admissionId: randomUUID(), commandId: randomUUID() })}`)
  }
  const selected = hubE1Selectors.safeParse(query)
  const creation = hubE1Keys.safeParse(query)
  if (selected.success) {
    initial = await readHubE1Workspace(selected.data)
    returnPath = hubE1ReturnPath(selected.data)
  } else if (creation.success) {
    keys = creation.data
  } else initial = { status: 'invalid' }
  return <WorkspaceView initial={initial} keys={keys} enabled={enabled}
    stockStart={`${STOCK_E1_APP_ORIGIN}/api/auth/e1/start`} returnPath={returnPath} />
}
