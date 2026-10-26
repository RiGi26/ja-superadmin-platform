import 'server-only'

import { z } from 'zod'
import { requestE1QuarantineBootstrap } from '@/lib/e1-quarantine-release'
import { readNativeE1StockContext } from '@/lib/core-registry-native'
import { e1WorkspaceRequestSchema } from '@/lib/e1-workspace'

// Reuse the approved canonical RFC UUID codec, including normalization. Generic
// z.uuid() also accepts special nil/max UUIDs that native SSO cannot continue.
const uuid = e1WorkspaceRequestSchema.shape.idempotencyKey
export const hubE1Keys = z.object({ admissionId: uuid, commandId: uuid }).strict()
  .refine(value => value.admissionId.toLowerCase() !== value.commandId.toLowerCase())
export const hubE1Selectors = z.object({ commandId: uuid, companyId: uuid, reservationId: uuid }).strict()
export type HubE1Status = 'new' | 'invalid' | 'reserved' | 'quarantined' | 'unconfirmed' | 'denied' | 'blocked'
export type HubE1State = { status: HubE1Status; companyName?: string; selected?: z.infer<typeof hubE1Selectors> }

export function hubE1ReturnPath(selected: z.infer<typeof hubE1Selectors>) {
  return `/hub/workspace?${new URLSearchParams(selected)}`
}

export async function submitHubE1Workspace(keys: unknown, form: unknown): Promise<HubE1State> {
  if (!(form instanceof FormData)) return { status: 'invalid' }
  const parsedKeys = hubE1Keys.safeParse(keys)
  // Next.js adds its own $ACTION_ fields. Application fields remain a closed set.
  const fields = [...form.keys()].filter(key => !key.startsWith('$ACTION_'))
  if (!parsedKeys.success || fields.length !== 1 || fields[0] !== 'companyName') return { status: 'invalid' }
  const input = e1WorkspaceRequestSchema.safeParse({ companyName: form.get('companyName'), idempotencyKey: parsedKeys.data.admissionId })
  if (!input.success) return { status: 'invalid' }
  try {
    const result = await requestE1QuarantineBootstrap(input.data)
    if (result.status === 'completed') {
      const selected = hubE1Selectors.parse({ commandId: parsedKeys.data.commandId,
        companyId: result.reservation.companyId, reservationId: result.reservation.reservationId })
      return { status: 'reserved', companyName: input.data.companyName, selected }
    }
    return { status: result.status === 'unconfirmed' ? 'unconfirmed' : result.status === 'blocked' ? 'blocked' : 'denied',
      companyName: input.data.companyName }
  } catch {
    // A response may have been lost after admission. Preserve both command keys.
    return { status: 'unconfirmed', companyName: input.data.companyName }
  }
}

export async function readHubE1Workspace(input: unknown): Promise<HubE1State> {
  const selected = hubE1Selectors.safeParse(input)
  if (!selected.success) return { status: 'invalid' }
  const result = await readNativeE1StockContext({ companyId: selected.data.companyId, reservationId: selected.data.reservationId })
  return { status: result.status, selected: selected.data,
    ...('companyName' in result ? { companyName: result.companyName } : {}) }
}
