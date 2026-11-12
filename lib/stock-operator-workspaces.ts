import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { verifyNativeCoreSession } from '@/lib/core-registry-native'
import { STOCK_MEMBERSHIP_RUNTIME_ENABLED } from '@/lib/stock-membership-protocol'

const workspace = z.object({
  companyId: z.uuid(), companyName: z.string().min(2).max(100), instanceId: z.uuid(),
  membershipId: z.uuid(), coreSubject: z.uuid(), role: z.enum(['admin','staff','produksi']),
}).strict()
export type StockOperatorWorkspace = z.infer<typeof workspace>
export type StockOperatorWorkspaceList = { status: 'ready'; workspaces: StockOperatorWorkspace[] }
  | { status: 'closed' | 'unavailable'; workspaces: [] }

/** Discovery only. Stock still verifies both native identities and commits the
 * explicit selection before granting operational access. No billing is read.
 */
export async function readStockOperatorWorkspaces(): Promise<StockOperatorWorkspaceList> {
  if (!STOCK_MEMBERSHIP_RUNTIME_ENABLED) return { status: 'closed', workspaces: [] }
  try {
    const client = await createClient()
    const actor = await verifyNativeCoreSession(client)
    if (!actor.customer || Date.parse(actor.until)<=Date.now()) throw new Error('STOCK_OPERATOR_WORKSPACES_DENIED')
    const result = await client.rpc('core_stock_operator_workspaces').abortSignal(AbortSignal.timeout(2500))
    if (result.error) throw new Error('STOCK_OPERATOR_WORKSPACES_UNAVAILABLE')
    const rows = z.array(workspace).max(20).parse(result.data)
    if (rows.some(row=>row.coreSubject!==actor.subject) || new Set(rows.map(row=>row.companyId)).size!==rows.length) {
      throw new Error('STOCK_OPERATOR_WORKSPACES_DENIED')
    }
    const current = await verifyNativeCoreSession(client)
    if (!current.customer || current.subject!==actor.subject || current.session!==actor.session ||
        Math.min(Date.parse(actor.until),Date.parse(current.until))<=Date.now()) throw new Error('STOCK_OPERATOR_WORKSPACES_DENIED')
    return { status: 'ready', workspaces: rows }
  } catch { return { status: 'unavailable', workspaces: [] } }
}
