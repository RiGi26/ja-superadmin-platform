import 'server-only'
import { randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { STOCK_E1_APP_ORIGIN } from '@/lib/e1-realm'
import { isActiveStockUuid } from '@/lib/stock-active-protocol'
import { STOCK_MEMBER_LIFECYCLE_ENABLED, parseStockMemberEvent, parseStockMemberReceipt } from '@/lib/stock-member-protocol'
import { readStockMemberBody, signStockMember, verifyStockMember } from '@/lib/stock-member-signature'

/** Read only persisted events. A lost response retries the same immutable event;
 * no browser supplies a tuple or delivery URL. Call from after() or reconciliation.
 */
export async function deliverStockMemberEvent(eventId: string): Promise<'closed' | 'pending' | 'acknowledged'> {
  if(!STOCK_MEMBER_LIFECYCLE_ENABLED)return 'closed'
  const secret=process.env.BILLING_SYNC_SECRET
  if(!secret || secret.length<32 || !isActiveStockUuid(eventId))return 'pending'
  try {
    const db=createAdminClient()
    const read=await db.rpc('core_stock_member_delivery',{p_event:eventId}).abortSignal(AbortSignal.timeout(2500))
    if(read.error || read.data===null)return 'pending'
    const event=parseStockMemberEvent(read.data)
    if(event.eventId!==eventId)return 'pending'
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
    const receipt=parseStockMemberReceipt(JSON.parse(raw),event)
    const ack=await db.rpc('core_stock_member_ack',{p_event:eventId,p_receipt:receipt}).abortSignal(AbortSignal.timeout(2500))
    return !ack.error && ack.data===true ? 'acknowledged' : 'pending'
  } catch { return 'pending' }
}

/** Reuse the existing daily lifecycle cron; bounded cohort and concurrency. */
export async function reconcileStockMemberEvents(): Promise<void> {
  if(!STOCK_MEMBER_LIFECYCLE_ENABLED)return
  try {
    const result=await createAdminClient().rpc('core_stock_member_pending').abortSignal(AbortSignal.timeout(2500))
    if(result.error || !Array.isArray(result.data) || result.data.length>20 || !result.data.every(isActiveStockUuid))return
    for(let index=0;index<result.data.length;index+=5) {
      await Promise.all(result.data.slice(index,index+5).map(deliverStockMemberEvent))
    }
  } catch { /* Retained events remain available to a later daily run. */ }
}
