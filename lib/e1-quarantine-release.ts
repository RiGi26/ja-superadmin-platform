import 'server-only'

import { CORE_E1_ORIGIN } from '@/lib/e1-realm'
import { e1WorkspaceRequestSchema } from '@/lib/e1-workspace'

// Public release of the installed new-Company/Stock quarantine adapter only.
// Legacy Registry, billing, product activation and their fuses stay unchanged.
export const E1_QUARANTINE_RUNTIME_ENABLED = true as const

export async function requestE1QuarantineBootstrap(input: unknown) {
  const request = e1WorkspaceRequestSchema.safeParse(input)
  if (!request.success) return { status: 'rejected' as const }
  if (!E1_QUARANTINE_RUNTIME_ENABLED || process.env.NEXT_PUBLIC_SUPABASE_URL !== CORE_E1_ORIGIN) {
    return { status: 'blocked' as const }
  }
  const { executeNativeE1StockCommand } = await import('@/lib/core-registry-native')
  return executeNativeE1StockCommand({ action: 'e1.stock.admit', commandId: request.data.idempotencyKey,
    payload: { companyName: request.data.companyName, product: 'stock' } })
}
