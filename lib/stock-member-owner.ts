import 'server-only'
import { z } from 'zod'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyNativeCoreSession } from '@/lib/core-registry-native'
import { STOCK_MEMBERSHIP_RUNTIME_ENABLED } from '@/lib/stock-membership-protocol'
import { STOCK_MEMBER_LIFECYCLE_ENABLED, parseStockMemberEvent } from '@/lib/stock-member-protocol'
import { deliverStockMemberEvent } from '@/lib/stock-member-delivery'

const uuid=z.uuid(),role=z.enum(['admin','staff','produksi'])
const command=z.object({companyId:uuid,membershipId:uuid,commandId:uuid,expectedRevision:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER-1),
  action:z.enum(['role','revoke']),role:role.nullable()}).strict().refine(value=>value.action==='revoke'?value.role===null:value.role!==null)
const view=z.object({companyId:uuid,companyName:z.string().min(2).max(100),canManage:z.boolean(),members:z.array(z.object({
  membershipId:uuid,email:z.string().max(254).nullable(),role,revision:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  revoked:z.boolean(),canChangeRole:z.boolean(),pendingEvents:z.array(uuid).max(20),
}).strict()).max(20)}).strict()
export type StockMemberOwnerView=z.infer<typeof view>
export type StockMemberOwnerResult='closed'|'denied'|'unconfirmed'|'saved'|'unchanged'|'queued'
const enabled=()=>STOCK_MEMBER_LIFECYCLE_ENABLED && STOCK_MEMBERSHIP_RUNTIME_ENABLED

async function authenticate() {
  const client=await createClient(),actor=await verifyNativeCoreSession(client)
  if(!actor.customer || !(Date.parse(actor.until)>Date.now()))throw Error('STOCK_MEMBER_OWNER_DENIED')
  const current=async()=>{
    const latest=await verifyNativeCoreSession(client)
    if(!latest.customer || latest.subject!==actor.subject || latest.session!==actor.session ||
      !(Math.min(Date.parse(actor.until),Date.parse(latest.until))>Date.now()))throw Error('STOCK_MEMBER_OWNER_DENIED')
    return {...actor,until:new Date(Math.min(Date.parse(actor.until),Date.parse(latest.until))).toISOString()}
  }
  return {client,actor,current}
}
export async function readStockMemberOwnerView(companyId: unknown): Promise<StockMemberOwnerView|null> {
  if(!enabled() || !uuid.safeParse(companyId).success)return null
  try {
    const {client,current}=await authenticate()
    const result=await client.rpc('core_stock_member_owner_view',{p_company:companyId}).abortSignal(AbortSignal.timeout(2500))
    const parsed=view.safeParse(result.data);await current()
    return !result.error && parsed.success && parsed.data.companyId===companyId &&
      new Set(parsed.data.members.map(member=>member.membershipId)).size===parsed.data.members.length ? parsed.data : null
  } catch { return null }
}
export async function changeStockMember(input: unknown): Promise<StockMemberOwnerResult> {
  if(!enabled())return 'closed'
  const parsed=command.safeParse(input)
  if(!parsed.success)return 'denied'
  let attempted=false
  try {
    const {current}=await authenticate(),actor=await current(),fields=parsed.data
    attempted=true
    const result=await createAdminClient().rpc('core_stock_member_command',{
      p_actor:actor.subject,p_session:actor.session,p_until:actor.until,p_company:fields.companyId,p_member:fields.membershipId,
      p_command:fields.commandId,p_expected_revision:fields.expectedRevision,p_action:fields.action,p_role:fields.role,
    }).abortSignal(AbortSignal.timeout(2500))
    if(result.error)return 'unconfirmed'
    if(result.data?.status==='saved' && Object.keys(result.data).sort().join(',')==='event,status') {
      const event=parseStockMemberEvent(result.data.event)
      if(event.companyId!==fields.companyId || event.membershipId!==fields.membershipId || event.commandId!==fields.commandId ||
        event.action!==fields.action || event.previousRevision!==fields.expectedRevision ||
        (fields.action==='role' && event.role!==fields.role))return 'unconfirmed'
      // Durable delivery continues even if the native session expires after commit.
      after(()=>deliverStockMemberEvent(event.eventId).then(()=>{}))
      await current();return 'saved'
    }
    if(result.data?.status==='unchanged' && Object.keys(result.data).sort().join(',')==='membershipId,revision,status' &&
      result.data.membershipId===fields.membershipId && Number.isSafeInteger(result.data.revision) && result.data.revision>=1) {
      await current();return 'unchanged'
    }
    return 'unconfirmed'
  } catch { return attempted?'unconfirmed':'denied' }
}
export async function retryStockMember(input: unknown): Promise<StockMemberOwnerResult> {
  if(!enabled())return 'closed'
  const parsed=z.object({companyId:uuid,eventId:uuid}).strict().safeParse(input)
  if(!parsed.success)return 'denied'
  try {
    const {current}=await authenticate(),actor=await current()
    const result=await createAdminClient().rpc('core_stock_member_retry',{p_actor:actor.subject,p_session:actor.session,
      p_until:actor.until,p_company:parsed.data.companyId,p_event:parsed.data.eventId}).abortSignal(AbortSignal.timeout(2500))
    if(result.error || typeof result.data!=='boolean')return 'unconfirmed'
    if(result.data)after(()=>deliverStockMemberEvent(parsed.data.eventId).then(()=>{}))
    await current();return result.data?'queued':'unchanged'
  } catch { return 'unconfirmed' }
}
