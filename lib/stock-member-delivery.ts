import 'server-only'
import { randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { STOCK_E1_APP_ORIGIN } from '@/lib/e1-realm'
import { isActiveStockUuid } from '@/lib/stock-active-protocol'
import { STOCK_MEMBER_LIFECYCLE_ENABLED, parseStockMemberEvent, parseStockMemberReceipt,
  parseStockOperatorClosure, parseStockOperatorClosureReceipt } from '@/lib/stock-member-protocol'
import { readStockMemberBody, signStockMember, verifyStockMember } from '@/lib/stock-member-signature'

/** Read only persisted events. A lost response retries the same immutable event;
 * no browser supplies a tuple or delivery URL. Call from after() or reconciliation.
 */
export function deliverStockMemberEvent(eventId: string) {
  return deliver(eventId, 'member')
}

export function deliverStockOperatorClosure(inviteId: string) {
  return deliver(inviteId, 'closure')
}

async function deliver(id: string, kind: 'member' | 'closure'): Promise<'closed' | 'pending' | 'acknowledged'> {
  if(!STOCK_MEMBER_LIFECYCLE_ENABLED)return 'closed'
  const secret=process.env.BILLING_SYNC_SECRET
  if(!secret || secret.length<32 || !isActiveStockUuid(id))return 'pending'
  try {
    const db=createAdminClient()
    const read=await (kind==='member' ? db.rpc('core_stock_member_delivery',{p_event:id}) :
      db.rpc('core_stock_operator_closure_delivery',{p_invite:id})).abortSignal(AbortSignal.timeout(2500))
    if(read.error || read.data===null)return 'pending'
    const event=kind==='member' ? parseStockMemberEvent(read.data) : parseStockOperatorClosure(read.data)
    if(('eventId' in event ? event.eventId : event.inviteId)!==id)return 'pending'
    const body=JSON.stringify(event),nonce=randomBytes(16).toString('hex'),timestamp=String(Date.now())
    const response=await fetch(`${STOCK_E1_APP_ORIGIN}/api/billing/member-events`,{
      method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(5000),
      headers:{'Content-Type':'application/json','x-ja-timestamp':timestamp,'x-ja-nonce':nonce,
        'x-ja-signature':signStockMember(secret,'request',timestamp,nonce,body)},body,
    })
    if(response.status!==200 || response.redirected || response.headers.get('x-ja-nonce')!==nonce) {
      await response.body?.cancel().catch(()=>{});return 'pending'
    }
    const raw=await readStockMemberBody(response)
    if(raw===null || !verifyStockMember(secret,'ack',response.headers.get('x-ja-timestamp'),nonce,response.headers.get('x-ja-signature'),raw))return 'pending'
    const ack=await (event.kind==='stock_member_event_v2'
      ? db.rpc('core_stock_member_ack',{p_event:id,p_receipt:parseStockMemberReceipt(JSON.parse(raw),event)})
      : db.rpc('core_stock_operator_closure_ack',{p_invite:id,p_receipt:parseStockOperatorClosureReceipt(JSON.parse(raw),event)}))
      .abortSignal(AbortSignal.timeout(2500))
    return !ack.error && ack.data===true ? 'acknowledged' : 'pending'
  } catch { return 'pending' }
}

/** Reuse the existing daily lifecycle cron; bounded cohort and concurrency. */
export async function reconcileStockMemberEvents(): Promise<void> {
  if(!STOCK_MEMBER_LIFECYCLE_ENABLED)return
  await Promise.all([
    reconcile('core_stock_member_pending', 20, deliverStockMemberEvent),
    reconcile('core_stock_operator_closure_pending', 10, deliverStockOperatorClosure),
  ])
}

async function reconcile(rpc: 'core_stock_member_pending' | 'core_stock_operator_closure_pending',
  limit: number, send: typeof deliverStockMemberEvent): Promise<void> {
  try {
    const result=await createAdminClient().rpc(rpc).abortSignal(AbortSignal.timeout(2500))
    if(result.error || !Array.isArray(result.data) || result.data.length>limit || !result.data.every(isActiveStockUuid))return
    for(let index=0;index<result.data.length;index+=5) {
      await Promise.all(result.data.slice(index,index+5).map(send))
    }
  } catch { /* Retained events remain available to a later daily run. */ }
}
