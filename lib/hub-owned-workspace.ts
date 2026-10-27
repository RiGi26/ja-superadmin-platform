import 'server-only'

import { z } from 'zod'
import type { createClient } from '@/lib/supabase/server'
import { CORE_E1_ORIGIN } from '@/lib/e1-realm'
import { E1_QUARANTINE_RUNTIME_ENABLED } from '@/lib/e1-quarantine-release'
import { readNativeE1StockContext } from '@/lib/core-registry-native'

export type HubOwnedWorkspace =
  | { status: 'empty' | 'unavailable' }
  | { status: 'ready'; companyId: string; companyName: string; role: 'owner'; stockStatus: 'reserved' | 'quarantined' }

const uuid = z.uuid()
const membershipRows = z.array(z.object({ company_id: uuid }).strict()).max(1)
const instanceRows = z.array(z.object({ id: uuid, company_id: uuid }).strict()).length(1)

/** Public own-row reads discover selectors only. Released E1 context owns access. */
export async function readOwnedHubWorkspace(db: Awaited<ReturnType<typeof createClient>>, subject: string): Promise<HubOwnedWorkspace> {
  const unavailable: HubOwnedWorkspace = { status: 'unavailable' }
  if (!E1_QUARANTINE_RUNTIME_ENABLED || process.env.NEXT_PUBLIC_SUPABASE_URL !== CORE_E1_ORIGIN || !uuid.safeParse(subject).success) return unavailable
  try {
    const membership = await db.from('company_memberships').select('company_id')
      .eq('core_auth_user_id', subject).eq('status', 'active').limit(2)
    const rows = membershipRows.safeParse(membership.data)
    if (membership.error || !rows.success) return unavailable
    if (rows.data.length === 0) return { status: 'empty' }
    const companyId = rows.data[0].company_id
    const instance = await db.from('company_portal_instances').select('id,company_id')
      .eq('company_id', companyId).eq('portal_type', 'stock').eq('lifecycle_status', 'reserved')
      .is('legacy_tenant_id', null).is('portal_instance_id', null).limit(2)
    const instances = instanceRows.safeParse(instance.data)
    if (instance.error || !instances.success || instances.data[0].company_id !== companyId) return unavailable
    const reservationId = instances.data[0].id
    const context = await readNativeE1StockContext({ companyId, reservationId })
    if ((context.status !== 'reserved' && context.status !== 'quarantined') || context.companyId !== companyId ||
        context.reservationId !== reservationId || context.isActive !== false || !context.companyName) return unavailable
    return { status: 'ready', companyId, companyName: context.companyName, role: 'owner', stockStatus: context.status }
  } catch { return unavailable }
}
