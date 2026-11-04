import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyNativeCoreSession } from '@/lib/core-registry-native'
import { CORE_E1_ORIGIN } from '@/lib/e1-realm'
import { STOCK_PAID_BILLING_RUNTIME_ENABLED } from '@/lib/stock-purchase-policy'
import { STOCK_MEMBERSHIP_PREPARATION_ENABLED } from '@/lib/stock-membership-protocol'

// Independent source fuse. Enabling this requires the complete reciprocal
// provisioning/selection successor, reviewed migrations and rollout authority.
export const STOCK_WORKSPACE_CREATION_ENABLED = false
export const STOCK_CHECKOUT_WORKSPACE_CREATION_ENABLED = STOCK_WORKSPACE_CREATION_ENABLED &&
  STOCK_MEMBERSHIP_PREPARATION_ENABLED && STOCK_PAID_BILLING_RUNTIME_ENABLED
const uuid=z.uuid().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
const request=z.object({commandId:uuid,companyName:z.string().trim().min(2).max(100).regex(/^[^\p{Cc}]+$/u)}).strict()
const receipt=z.object({companyId:uuid,eventId:uuid,eventHash:z.string().regex(/^[0-9a-f]{64}$/),revision:z.literal(0)}).strict()
const reserved=z.object({version:z.literal(2),status:z.literal('reserved'),commandId:uuid,companyId:uuid,
  instanceId:uuid,companyName:z.string(),receipt,accessGranted:z.literal(false)}).strict()
export type StockWorkspaceCreation={status:'reserved';workspace:z.infer<typeof reserved>}|{status:'closed'|'denied'|'unconfirmed'}

/** The caller chooses only a new business name and idempotency command.
 * Existing-business attachment, identity, Owner role and resource IDs are never
 * accepted from the browser. A reservation cannot authorize Stock or billing. */
export async function createStockWorkspace(input:unknown):Promise<StockWorkspaceCreation> {
  if(!STOCK_WORKSPACE_CREATION_ENABLED || process.env.NEXT_PUBLIC_SUPABASE_URL!==CORE_E1_ORIGIN) return {status:'closed'}
  const parsed=request.safeParse(input)
  if(!parsed.success) return {status:'denied'}
  let attempted=false
  try {
    const client=await createClient()
    const actor=await verifyNativeCoreSession(client)
    if(!actor.customer || Date.parse(actor.until)<=Date.now()) return {status:'denied'}
    attempted=true
    const result=await createAdminClient().rpc('core_stock_workspace_create',{
      p_actor:actor.subject,p_session:actor.session,p_auth_until:actor.until,
      p_command:parsed.data.commandId,p_company_name:parsed.data.companyName,
    }).abortSignal(AbortSignal.timeout(2500))
    const value=reserved.safeParse(result.data)
    if(result.error || !value.success || value.data.commandId!==parsed.data.commandId ||
      value.data.companyName!==parsed.data.companyName || value.data.receipt.companyId!==value.data.companyId) return {status:'unconfirmed'}
    const latest=await verifyNativeCoreSession(client)
    if(!latest.customer || latest.subject!==actor.subject || latest.session!==actor.session ||
      Date.parse(actor.until)<=Date.now() || Date.parse(latest.until)<=Date.now()) return {status:'unconfirmed'}
    return {status:'reserved',workspace:value.data}
  } catch { return {status:attempted?'unconfirmed':'denied'} }
}
