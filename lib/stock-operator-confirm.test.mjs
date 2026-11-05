import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadStockModule } from './stock-self-payment-unit-harness.mjs'

const active=loadStockModule('./stock-active-protocol.ts')
const protocol=loadStockModule('./stock-operator-protocol.ts',{'./stock-active-protocol':active})
const id=n=>`96000000-0000-4000-8000-${String(n).padStart(12,'0')}`
function harness(options={}) {
  const calls=[],writes=[]
  let phase=0
  const core={subject:id(1),session:id(2),customer:true,until:new Date(Date.now()+25000).toISOString()}
  const stock={coreSubject:id(1),stockSubject:id(3),stockSessionId:id(4),until:Date.now()+25000}
  const context={status:'activated',inviteId:id(5),companyId:id(6),instanceId:id(7),membershipId:id(8),profileId:id(9),
    membershipRevision:1,role:'staff',coreSubject:core.subject,stockSubject:stock.stockSubject,stockSessionId:stock.stockSessionId,
    stockAuditEventId:id(10),accessGranted:false}
  const api=loadStockModule('./stock-operator-confirm.ts',{
    '@/lib/stock-active-protocol':active,
    '@/lib/stock-membership-protocol':{STOCK_MEMBERSHIP_RUNTIME_ENABLED:options.enabled??true},
    '@/lib/stock-operator-protocol':protocol,
    '@/lib/supabase/server':{createClient:async()=>{calls.push('client');return {}}},
    '@/lib/core-registry-native':{verifyNativeCoreProvider:async(_client,token,clientId)=>{
      phase++;calls.push('native Core');assert.equal(token,'core.native.token');assert.equal(clientId,active.ACTIVE_STOCK_CLIENT_ID)
      return {...core,...options.core,...(phase===options.changeAt?{session:id(90)}:{}),...(options.expireAfterWrite&&writes.length?{until:'2000-01-01T00:00:00Z'}:{})}
    }},
    '@/lib/stock-active-identity':{verifyStockIdentityForCoreBridge:async(token,opts)=>{
      calls.push('native Stock');assert.equal(token,'stock.native.token');assert.equal(opts.requireLiveOperatorSession,true)
      return {...stock,...options.stock}
    }},
    '@supabase/supabase-js':{createClient(realm,key,config){
      calls.push('reader');assert.equal(realm,active.ACTIVE_STOCK_REALM);assert.equal(key,'synthetic-public-key')
      assert.equal(config.global.headers.Authorization,'Bearer stock.native.token')
      assert.equal(config.auth.persistSession,false)
      return {rpc(name,args){
        assert.equal(name,'stock_operator_activated_context');assert.equal(args.p_invite,id(5))
        return {async abortSignal(){
          if(options.readThrows)throw Error('lost Stock read')
          return {error:options.readError,data:options.inactive?null:{...context,...options.context}}
        }}
      }}
    }},
    '@/lib/supabase/admin':{createAdminClient:()=>({rpc(name,args){
      assert.equal(name,'core_stock_operator_confirm_activation');writes.push(args)
      return {async abortSignal(){return {error:options.dbError,data:{status:'confirmed',inviteId:context.inviteId,
        companyId:context.companyId,membershipId:context.membershipId,profileId:context.profileId,
        stockAuditEventId:context.stockAuditEventId,accessGranted:false,...options.receipt}}}}
    }})},
  },{process:{env:{NEXT_PUBLIC_SUPABASE_URL:active.ACTIVE_CORE_REALM,STOCK_SUPABASE_PUBLISHABLE_KEY:'synthetic-public-key',...options.env}}})
  return {calls,writes,context,run:(input={inviteId:id(5)})=>api.confirmStockOperatorActivation(input,'stock.native.token','core.native.token')}
}

test('confirmation stays closed before native effects and rejects caller-supplied receipt or identity fields',async()=>{
  for(const options of [{enabled:false},{env:{NEXT_PUBLIC_SUPABASE_URL:'https://foreign.invalid'}}]) {
    const h=harness(options);assert.equal((await h.run()).status,'blocked');assert.deepEqual(h.calls,[])
  }
  for(const input of [{inviteId:'bad'},{inviteId:id(5),receipt:{}},{inviteId:id(5),coreSubject:id(1)}]) {
    const h=harness();assert.equal((await h.run(input)).status,'denied');assert.deepEqual(h.calls,[])
  }
})

test('only the current paired native recipient can supply the independently read activation witness',async()=>{
  for(const options of [{core:{customer:false}},{stock:{coreSubject:id(99)}},{core:{until:'2000-01-01T00:00:00Z'}}]) {
    const h=harness(options);assert.equal((await h.run()).status,'denied');assert.ok(!h.calls.includes('reader'));assert.equal(h.writes.length,0)
  }
  for(const context of [{inviteId:id(99)},{coreSubject:id(99)},{stockSubject:id(99)},{stockSessionId:id(99)},
    {stockAuditEventId:'bad'},{membershipId:'bad'},{role:'owner'},{accessGranted:true},{amount:359000}]) {
    const h=harness({context});assert.equal((await h.run()).status,'unconfirmed');assert.equal(h.writes.length,0)
  }
})

test('inactive, unavailable or changed native observations never append a confirmation',async()=>{
  const inactive=harness({inactive:true});assert.equal((await inactive.run()).status,'not_active');assert.equal(inactive.writes.length,0)
  for(const options of [{readThrows:true},{readError:{message:'unavailable'}},{changeAt:2}]) {
    const h=harness(options);assert.equal((await h.run()).status,'unconfirmed');assert.equal(h.writes.length,0)
  }
})

test('confirmation returns only the exact receipt and rechecks native authority after the write',async()=>{
  const h=harness();const result=await h.run()
  assert.equal(result.status,'confirmed');assert.equal(result.accessGranted,false);assert.equal(h.writes.length,1)
  assert.equal(h.writes[0].p_stock_session,h.context.stockSessionId)
  assert.equal(h.writes[0].p_context.stockAuditEventId,h.context.stockAuditEventId)
  assert.equal(h.calls.filter(value=>value==='native Core').length,3)
  for(const options of [{dbError:{code:'55P03'}},{receipt:{profileId:id(99)}},{receipt:{stockAuditEventId:id(99)}},
    {receipt:{accessGranted:true}},{changeAt:3},{expireAfterWrite:true}]) {
    const h=harness(options);assert.equal((await h.run()).status,'unconfirmed');assert.equal(h.writes.length,1)
  }
})
