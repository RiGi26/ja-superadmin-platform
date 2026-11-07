import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadStockModule } from './stock-self-payment-unit-harness.mjs'
import { loadHubUi } from './hub-ui-test-harness.mjs'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

const active=loadStockModule('./stock-active-protocol.ts')
const protocol=loadStockModule('./stock-member-protocol.ts',{'./stock-active-protocol':active})
const id=n=>`98000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const input={companyId:id(1),membershipId:id(2),commandId:id(3),expectedRevision:1,action:'role',role:'admin'}
const event={...input,kind:'stock_member_event_v2',eventId:id(4),companyRevision:0,instanceId:id(5),coreTenantId:id(6),
  stockTenantId:id(7),bindingId:id(5),bindingRevision:1,ownerMembershipId:id(8),profileId:id(9),coreSubject:id(10),stockSubject:id(11),
  previousRevision:1,revision:2,previousRole:'staff',occurredAt:'2026-01-01T00:00:00Z',coreAuditEventId:id(12)}
delete event.expectedRevision
const workspace={companyId:input.companyId,companyName:'Workspace fixture',canManage:true,members:[{
  membershipId:input.membershipId,email:'operator@example.test',role:'staff',revision:1,revoked:false,canChangeRole:true,pendingEvents:[],
}]}
function harness(options={}) {
  const calls=[],jobs=[];let observations=0
  const api=loadStockModule('./stock-member-owner.ts',{
    '@/lib/stock-member-protocol':{...protocol,STOCK_MEMBER_LIFECYCLE_ENABLED:options.enabled??true},
    '@/lib/stock-membership-protocol':{STOCK_MEMBERSHIP_RUNTIME_ENABLED:true},
    'next/server':{after:job=>jobs.push(job)},
    '@/lib/stock-member-delivery':{deliverStockMemberEvent:async eventId=>{calls.push({delivery:eventId});return 'acknowledged'}},
    '@/lib/supabase/server':{createClient:async()=>({rpc(name,args){
      calls.push({name,args});return {async abortSignal(){return {error:null,data:{...workspace,...options.view}}}}
    }})},
    '@/lib/core-registry-native':{verifyNativeCoreSession:async()=>{
      observations++;return {subject:id(20),session:options.changedSession&&observations>1?id(99):id(21),customer:options.customer??true,
        until:new Date(Date.now()+(options.expired?-1000:25000)).toISOString()}
    }},
    '@/lib/supabase/admin':{createAdminClient:()=>({rpc(name,args){
      calls.push({name,args})
      return {async abortSignal(){
        if(options.writeThrows)throw Error('lost commit response')
        if(name==='core_stock_member_retry')return {error:options.dbError,data:true}
        return {error:options.dbError,data:options.unchanged?{status:'unchanged',membershipId:input.membershipId,revision:1}:
          {status:'saved',event:{...event,...options.event}}}
      }}
    }})},
  })
  return {api,calls,jobs,run:(value=input)=>api.changeStockMember(value)}
}
test('closed lifecycle and invalid selectors reject before native effects',async()=>{
  const closed=harness({enabled:false});assert.equal(await closed.run(),'closed');assert.deepEqual(closed.calls,[])
  for(const value of [{...input,amount:1},{...input,role:'owner'},{...input,expectedRevision:0},{...input,action:'revoke'}]) {
    const h=harness();assert.equal(await h.run(value),'denied');assert.deepEqual(h.calls,[])
  }
})
test('only current verified native Owner identity reaches the atomic command',async()=>{
  for(const options of [{customer:false},{expired:true},{changedSession:true}]) {
    const h=harness(options);assert.equal(await h.run(),'denied');assert.equal(h.calls.length,0)
  }
  const h=harness();assert.equal(await h.run(),'saved');assert.equal(h.jobs.length,1)
  assert.equal(h.calls[0].args.p_actor,id(20));assert.equal(h.calls[0].args.p_expected_revision,1)
  assert.equal(h.calls.some(call=>call.delivery),false,'cross-repo delivery must wait for after()')
  await h.jobs[0]();assert.equal(h.calls.at(-1).delivery,event.eventId)
})
test('uncertain writes retain recovery and never schedule a caller-shaped event',async()=>{
  for(const options of [{writeThrows:true},{dbError:{}},{event:{companyId:id(99)}},{event:{revision:4}},{event:{role:'produksi'}}]) {
    const h=harness(options);assert.equal(await h.run(),'unconfirmed');assert.equal(h.jobs.length,0)
  }
  assert.equal(await harness({unchanged:true}).run(),'unchanged')
})
test('Owner read validates scope and duplicate members; retry validates selected Company and event',async()=>{
  const h=harness();assert.equal((await h.api.readStockMemberOwnerView(input.companyId)).members.length,1)
  for(const view of [{companyId:id(99)},{members:[workspace.members[0],workspace.members[0]]}]) {
    assert.equal(await harness({view}).api.readStockMemberOwnerView(input.companyId),null)
  }
  assert.equal(await h.api.retryStockMember({companyId:input.companyId,eventId:event.eventId}),'queued')
  assert.equal(h.jobs.length,1)
  assert.equal(await h.api.retryStockMember({companyId:input.companyId,eventId:event.eventId,role:'admin'}),'denied')
})
test('member forms require explicit terminal revocation and exact fields',async()=>{
  const calls=[]
  const actions=loadHubUi('app/hub/stock/team/actions.ts',{
    'next/cache':{revalidatePath(){}},'next/navigation':{redirect(){throw Error('unexpected redirect')}},
    '@/lib/stock-operator-owner':{},'@/lib/stock-member-owner':{
      changeStockMember:async fields=>{calls.push(fields);return 'saved'},retryStockMember:async()=> 'queued',
    },'@/lib/stock-purchase-policy':{},
  })
  const form=new FormData()
  for(const [key,value] of Object.entries(input))form.set(key,String(value))
  assert.equal((await actions.changeStockMemberAction({status:'idle'},form)).status,'saved')
  form.set('action','revoke');form.delete('role')
  assert.equal((await actions.changeStockMemberAction({status:'idle'},form)).status,'denied')
  form.set('confirm','revoke')
  assert.equal((await actions.changeStockMemberAction({status:'idle'},form)).status,'saved')
  assert.equal(calls.at(-1).role,null)
  form.set('expectedRevision','1e0')
  assert.equal((await actions.changeStockMemberAction({status:'idle'},form)).status,'denied')
})
test('team page retains member controls when new invitations are unavailable',async()=>{
  const {default:Page}=loadHubUi('app/hub/stock/team/page.tsx',{
    'next/headers':{headers:async()=>new Headers({host:'hub.webzoka.com'})},'next/navigation':{redirect:path=>{throw Error(path)}},
    '@/lib/hub-e1-rewrite-query':loadStockModule('./hub-e1-rewrite-query.ts'),
    '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{email_confirmed_at:'2026-11-05'}}})}})},
    '@/lib/stock-operator-owner':{readStockOperatorOwnerView:async()=>null},
    '@/lib/stock-member-owner':{readStockMemberOwnerView:async()=>workspace},
    './StockMemberControls':{StockMemberControls:props=>createElement('form',{'data-member':props.member.membershipId,'data-company':props.companyId})},
    './StockInvitationForm':{StockInvitationForm:()=>null},'./actions':{},
  })
  const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({company:input.companyId,command:input.commandId})}))
  assert.ok(html.includes('data-member="'+input.membershipId+'"'));assert.match(html,/operator@example.test/)
  assert.doesNotMatch(html,/name="amount"|name="tenantId"|name="coreSubject"/)
})
