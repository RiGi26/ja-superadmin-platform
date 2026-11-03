// Actual adapter, synthetic native observations and SQL response. No runtime grant.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(file,dependencies={},env={}) {
  const sandboxModule={exports:{}}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText,{module:sandboxModule,exports:sandboxModule.exports,Date,Object,Number,Set,AbortSignal,
    process:{env},require(name){assert.ok(Object.hasOwn(dependencies,name),name);return dependencies[name]}})
  return sandboxModule.exports
}
const active=load('./stock-active-protocol.ts')
const protocol=load('./stock-membership-protocol.ts',{'./stock-active-protocol':active})
const id=n=>`83000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const input={companyId:id(1),instanceId:id(2),commandId:id(3),expectedRevision:0}
const authority={companyId:id(1),instanceId:id(2),bindingId:id(4),bindingRevision:1,companyRevision:1,
  coreSubject:id(5),coreSessionId:id(6),coreTenantId:id(7),stockTenantId:id(8),profileId:id(9),
  membershipId:id(10),membershipRevision:1,selectionRevision:1,role:'staff',
  ownerMembershipId:id(11),ownerMembershipRevision:1}
function harness(options={}) {
  const calls=[]
  let coreReads=0,stockReads=0
  const core={customer:true,subject:id(5),session:id(6),until:new Date(Date.now()+25000).toISOString(),...options.core}
  const stock={coreSubject:id(5),stockSubject:id(12),stockSessionId:id(13),until:Date.now()+25000,...options.stock}
  const client={auth:{async getClaims(token){
    calls.push('claims');assert.equal(token,'core.native.token')
    return {data:{claims:{sub:id(5),session_id:id(6),client_id:active.ACTIVE_STOCK_CLIENT_ID,
      exp:Math.floor(Date.now()/1000)+3600,...options.claims}},error:options.claimsError}
  }}}
  const api=load('./stock-membership-select.ts',{
    'server-only':{},'@/lib/stock-active-protocol':active,
    '@/lib/stock-membership-protocol':{...protocol,STOCK_MEMBERSHIP_RUNTIME_ENABLED:options.enabled??true},
    '@/lib/supabase/server':{async createClient(){calls.push('client');return client}},
    '@/lib/core-registry-native':{async verifyNativeCoreProvider(actual,token,clientId){
      assert.equal(actual,client);assert.equal(token,'core.native.token');assert.equal(clientId,active.ACTIVE_STOCK_CLIENT_ID)
      calls.push('core');coreReads++
      if(options.mutateInput) options.mutateInput()
      if(options.coreFails) throw Error('native unavailable')
      return {...core,...(coreReads>1?options.latestCore:{})}
    }},
    '@/lib/stock-active-identity':{async verifyStockIdentityForCoreBridge(token){
      assert.equal(token,'stock.native.token');calls.push('stock');stockReads++
      if(options.stockFails) throw Error('native unavailable')
      return {...stock,...(stockReads>1?options.latestStock:{})}
    }},
    '@/lib/supabase/admin':{createAdminClient(){calls.push('admin');return {rpc(name,args){
      calls.push({name,args})
      return {async abortSignal(){
        if(options.transportFails) throw Error('lost response')
        return {data:{...authority,...options.authority},error:options.sqlError}
      }}
    }}}},
  },{NEXT_PUBLIC_SUPABASE_URL:options.realm??active.ACTIVE_CORE_REALM})
  return {calls,run:value=>api.selectStockMembershipSession(value??input,'stock.native.token',options.token??'core.native.token')}
}
test('selection remains closed before credentials, database and network effects',async()=>{
  for(const options of [{enabled:protocol.STOCK_MEMBERSHIP_RUNTIME_ENABLED},{realm:'https://foreign.invalid'}]){
    const h=harness(options);assert.equal((await h.run()).status,'blocked');assert.deepEqual(h.calls,[])
  }
})
test('selection accepts only selectors, idempotency and bounded optimistic revision',async()=>{
  for(const value of [null,[],{...input,role:'admin'},{...input,amount:149000},{...input,coreSubject:id(5)},
    {...input,expectedRevision:-1},{...input,expectedRevision:0.5},{...input,expectedRevision:Number.MAX_SAFE_INTEGER},
    {...input,commandId:'bad'}]){
    const h=harness();assert.equal((await h.run(value===null?{}:value)).status,'denied');assert.deepEqual(h.calls,[])
  }
})
test('verified identities and provider session determine all enrollment authority',async()=>{
  const h=harness(),result=await h.run()
  assert.equal(result.status,'selected');assert.equal(result.decision.selectionRevision,1)
  assert.equal(result.decision.role,'staff');assert.equal(result.decision.nonce,input.commandId)
  assert.equal(result.decision.stockSessionId,id(13));assert.equal(result.decision.coreSessionId,id(6))
  const rpc=h.calls.find(call=>typeof call==='object')
  assert.equal(rpc.name,'core_stock_membership_select_session')
  assert.equal(rpc.args.p_core_subject,id(5));assert.equal(rpc.args.p_stock_subject,id(12))
  assert.equal(rpc.args.p_core_session,id(6));assert.equal(rpc.args.p_stock_session,id(13))
  assert.equal(rpc.args.p_command,id(3));assert.equal(rpc.args.p_expected_revision,0)
  assert.equal(h.calls.filter(call=>call==='core').length,2)
  assert.equal(h.calls.filter(call=>call==='stock').length,2)
  assert.ok(!JSON.stringify(result).includes('native.token'))
})
for(const [name,options] of [
  ['foreign pair',{stock:{coreSubject:id(99)}}],['operator actor',{core:{customer:false}}],
  ['expired Core observation',{core:{until:'2020-01-01'}}],['expired Stock observation',{stock:{until:0}}],
  ['native Core failure',{coreFails:true}],['native Stock failure',{stockFails:true}],
  ['foreign provider client',{claims:{client_id:id(99)}}],['foreign signed session',{claims:{session_id:id(99)}}],
  ['claims unavailable',{claimsError:{message:'unavailable'}}],['expired token',{claims:{exp:1}}],
]) test(`selection denies ${name} before mutation`,async()=>{
  const h=harness(options);assert.equal((await h.run()).status,'denied')
  assert.ok(!h.calls.includes('admin'))
})
for(const [name,options] of [
  ['lost response',{transportFails:true}],['foreign Company',{authority:{companyId:id(99)}}],
  ['foreign session',{authority:{coreSessionId:id(99)}}],['wrong revision',{authority:{selectionRevision:2}}],
  ['financial field',{authority:{canBill:true}}],['malformed role',{authority:{role:'owner'}}],
  ['Core revoked during selection',{latestCore:{customer:false}}],
  ['Core session changed',{latestCore:{session:id(99)}}],['Stock session changed',{latestStock:{stockSessionId:id(99)}}],
  ['Stock pair changed',{latestStock:{coreSubject:id(99)}}],['Stock observation expired',{latestStock:{until:0}}],
]) test(`selection is unconfirmed after ${name}`,async()=>{
  const h=harness(options);assert.equal((await h.run()).status,'unconfirmed')
})
test('explicit SQL rejection and unknown mutation result remain distinct',async()=>{
  assert.equal((await harness({sqlError:{code:'42501'}}).run()).status,'denied')
  assert.equal((await harness({sqlError:{code:'ECONNRESET'}}).run()).status,'unconfirmed')
})
test('caller mutation during native verification cannot change selected command',async()=>{
  const value={...input}
  const h=harness({mutateInput(){value.companyId=id(99);value.commandId=id(99);value.expectedRevision=100}})
  const result=await h.run(value)
  assert.equal(result.status,'selected');assert.equal(result.decision.companyId,id(1));assert.equal(result.decision.nonce,id(3))
})
