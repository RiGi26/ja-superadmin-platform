import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient as createRealSdkClient } from '@supabase/supabase-js'

function load(file,dependencies={},env={},globals={}) {
  const sandboxModule={exports:{}}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText,{module:sandboxModule,exports:sandboxModule.exports,Date,Object,Number,AbortSignal,
    process:{env},...globals,require(name){assert.ok(Object.hasOwn(dependencies,name),name);return dependencies[name]}})
  return sandboxModule.exports
}
const active=load('./stock-active-protocol.ts')
const protocol=load('./stock-membership-protocol.ts',{'./stock-active-protocol':active})
const id=n=>`84000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const input={companyId:id(1),instanceId:id(2),commandId:id(3)}
const receipt={...input,version:2,status:'prepared',accessGranted:false,role:'admin',bindingId:id(2),
  bindingRevision:1,companyRevision:0,coreSubject:id(5),coreTenantId:id(7),stockSubject:id(12),
  stockTenantId:id(8),ownerMembershipId:id(10),profileId:id(9),membershipRevision:1}
function harness(options={}) {
  const calls=[],diagnostics=[];let coreReads=0,stockReads=0
  const core={customer:true,subject:id(5),session:id(6),until:new Date(Date.now()+25000).toISOString(),...options.core}
  const stock={coreSubject:id(5),stockSubject:id(12),stockSessionId:id(13),until:Date.now()+25000,...options.stock}
  const saved={planId:id(20),companyId:null,reservationId:null,commandId:id(3),...options.intent}
  const fresh=options.v2 ? {originVersion:2,companyName:'New Workspace',stockAuditEventId:id(30)} : {}
  const client={rpc(name,args){assert.equal(name,'stock_billing_read_workspace_intent');assert.equal(args.p_company,id(1));calls.push(name);return {
    setHeader(key,value){assert.equal(key,'Authorization');assert.equal(value,'Bearer core.native.token');return this},
    async abortSignal(){return {data:saved,error:options.intentError}},
  }}}
  const api=load('./stock-membership-prepare.ts',{
    'server-only':{},'@/lib/stock-active-protocol':active,
    '@/lib/stock-membership-preparation-diagnostics':load('./stock-membership-preparation-diagnostics.ts',{'server-only':{}},{},{
      console:{info(...args){if(options.logSinkThrows)throw Error('unavailable log sink');diagnostics.push(args)}},
    }),
    '@supabase/supabase-js':{createClient(origin,key,config){
      calls.push('stock-read');assert.equal(origin,active.ACTIVE_STOCK_REALM);assert.equal(key,'synthetic-stock')
      assert.equal(config.global.headers.Authorization,'Bearer stock.native.token')
      if(options.actualSdk)return createRealSdkClient(origin,key,config)
      return {rpc(name,args){assert.equal(name,'stock_membership_prepared_owner_context');assert.equal(args.p_company,id(1));return {
        async abortSignal(){return {data:{...receipt,...fresh,...options.stockReceipt},error:options.stockReadError}},
      }}}
    }},
    '@/lib/stock-purchase-policy':{stockPlanId:value=>value===id(20)?value:null},
    '@/lib/stock-membership-protocol':{...protocol,STOCK_MEMBERSHIP_PREPARATION_ENABLED:options.enabled??true},
    '@/lib/supabase/server':{async createClient(){calls.push('client');return client}},
    '@/lib/core-registry-native':{async verifyNativeCoreProvider(actual,token,clientId){
      assert.equal(actual,client);assert.equal(token,'core.native.token');assert.equal(clientId,active.ACTIVE_STOCK_CLIENT_ID)
      coreReads++;if(options.mutateInput)options.mutateInput()
      return {...core,...(coreReads>1?options.latestCore:{})}
    }},
    '@/lib/stock-active-identity':{async verifyStockIdentityForCoreBridge(token){
      assert.equal(token,'stock.native.token');stockReads++
      return {...stock,...(stockReads>1?options.latestStock:{})}
    }},
    '@/lib/supabase/admin':{createAdminClient(){calls.push('admin');return {rpc(name,args){
      if(name==='core_stock_workspace_is_v2') {calls.push('origin-read');return {async abortSignal(){return {data:options.originResult??(options.v2===true),error:options.originError}}}}
      calls.push({name,args});return {async abortSignal(){
        if(options.lost===name)throw Error('lost response')
        return name==='core_stock_membership_confirm_owner'||name==='core_stock_workspace_confirm_owner'
          ?{data:{status:'confirmed',...input,accessGranted:false,...options.confirmation},error:options.confirmationError}
          :name==='stock_billing_prepare_account'
          ?{data:{tenantId:id(7),planId:id(20),...options.account},error:options.accountError}
          :{data:{...receipt,...fresh,...options.receipt},error:options.prepareError}
      }}
    }}}},
  },{NEXT_PUBLIC_SUPABASE_URL:options.realm??active.ACTIVE_CORE_REALM,STOCK_SUPABASE_PUBLISHABLE_KEY:'synthetic-stock'},{
    async fetch(url,init){
      assert.equal(options.actualSdk,true,'No real network transport is permitted in this harness')
      assert.equal(String(url),active.ACTIVE_STOCK_REALM+'/rest/v1/rpc/stock_membership_prepared_owner_context')
      const headers=new Headers(init.headers)
      calls.push({name:'actual-sdk-request',method:init.method,authorization:headers.get('authorization'),
        apiKey:headers.get('apikey'),body:JSON.parse(init.body)})
      return options.stockReadError
        ?Response.json(options.stockReadError,{status:403})
        :Response.json({...receipt,...fresh,...options.stockReceipt})
    },
  })
  return {calls,diagnostics,run:value=>api.prepareStockMembershipOwner(value??input,'stock.native.token',options.token??'core.native.token'),
    confirm:()=>api.confirmStockMembershipOwner(input,'stock.native.token','core.native.token')}
}
test('preparation disabled and wrong realm produce zero effects',async()=>{
  for(const options of [{enabled:false},{realm:'https://foreign.invalid'}]){
    const h=harness(options);assert.equal((await h.run()).status,'blocked');assert.deepEqual(h.calls,[])
  }
})

test('genuine v2 native preparation dispatches atomically without the legacy account preparer',async()=>{
  const h=harness({v2:true}),result=await h.run()
  assert.equal(result.status,'prepared');assert.equal(result.receipt.originVersion,2)
  const writes=h.calls.filter(value=>typeof value==='object')
  assert.equal(writes.length,1);assert.equal(writes[0].name,'core_stock_workspace_prepare_owner')
  assert.equal(writes[0].args.p_company,input.companyId);assert.equal(writes[0].args.p_command,input.commandId)
  const confirm=harness({v2:true});assert.equal((await confirm.confirm()).status,'confirmed')
  assert.equal(confirm.calls.filter(value=>typeof value==='object').at(-1).name,'core_stock_workspace_confirm_owner')
})

test('unavailable origin reader denies before mutation; v2 uncertain results never use v1',async()=>{
  for(const options of [{originError:{code:'42883'}},{originResult:'false'}]) {
    const h=harness(options);assert.equal((await h.run()).status,'denied')
    assert.equal(h.calls.some(value=>typeof value==='object'),false)
  }
  for(const options of [{lost:'core_stock_workspace_prepare_owner'},{receipt:{originVersion:undefined}},
    {receipt:{stockAuditEventId:'foreign'}},{receipt:{coreSubject:id(99)}}]) {
    const h=harness({v2:true,...options});assert.equal((await h.run()).status,'unconfirmed')
    assert.deepEqual(h.calls.filter(value=>typeof value==='object').map(value=>value.name),['core_stock_workspace_prepare_owner'])
  }
  const conflicting=harness({receipt:{originVersion:2,companyName:'Foreign Version',stockAuditEventId:id(30)}})
  assert.equal((await conflicting.run()).status,'unconfirmed')
})
test('receipt validates every field, snapshots values and never grants authority',()=>{
  const parsed=protocol.parseStockMembershipPreparation(receipt)
  assert.equal(Object.isFrozen(parsed),true);assert.equal(parsed.accessGranted,false)
  for(const key of Object.keys(receipt)) {
    const missing={...receipt};delete missing[key]
    assert.throws(()=>protocol.parseStockMembershipPreparation(missing))
  }
  for(const change of [{accessGranted:true},{version:1},{role:'staff'},{membershipRevision:2},{bindingRevision:2},
    {bindingId:id(99)},{companyRevision:-1},{companyRevision:0.5},{profileId:'bad'},{amount:149000}]) {
    assert.throws(()=>protocol.parseStockMembershipPreparation({...receipt,...change}))
  }
})
test('saved plan and verified paired subjects reach account then inactive admission',async()=>{
  const h=harness(),result=await h.run()
  assert.equal(result.status,'prepared');assert.equal(result.receipt.accessGranted,false)
  const rpcs=h.calls.filter(value=>typeof value==='object')
  assert.equal(rpcs.length,2);assert.equal(rpcs[0].name,'stock_billing_prepare_account')
  assert.equal(rpcs[0].args.p_plan,id(20));assert.equal(rpcs[0].args.p_actor,id(5))
  assert.equal(rpcs[1].name,'core_stock_membership_prepare_owner')
  assert.equal(rpcs[1].args.p_command,id(3));assert.equal(rpcs[1].args.p_stock_session,id(13))
  assert.ok(!JSON.stringify(result).includes('native.token'))
})
for(const [name,options] of [
  ['foreign identity',{stock:{coreSubject:id(99)}}],['internal operator',{core:{customer:false}}],
  ['expired observation',{stock:{until:0}}],['changed Core session',{latestCore:{session:id(99)}}],
  ['changed Stock session',{latestStock:{stockSessionId:id(99)}}],['expired recheck',{latestStock:{until:0}}],
  ['missing intent',{intentError:{code:'42501'}}],['foreign command',{intent:{commandId:id(99)}}],
  ['foreign workspace',{intent:{companyId:id(99)}}],['foreign reservation',{intent:{reservationId:id(99)}}],
  ['unknown plan',{intent:{planId:id(99)}}],['malformed intent',{intent:{amount:149000}}],
])test(`inactive preparation rejects ${name} before mutation`,async()=>{
  const h=harness(options);assert.equal((await h.run()).status,'denied');assert.ok(!h.calls.includes('admin'))
})
test('browser cannot provide price, receipt, subject or role',async()=>{
  for(const change of [{price:149000},{receipt},{coreSubject:id(5)},{role:'admin'},{commandId:'bad'}]){
    const h=harness();assert.equal((await h.run({...input,...change})).status,'denied');assert.deepEqual(h.calls,[])
  }
})
for(const [name,options] of [
  ['lost account response',{lost:'stock_billing_prepare_account'}],
  ['lost admission response',{lost:'core_stock_membership_prepare_owner'}],
  ['account rejected',{accountError:{code:'42501'}}],['admission rejected',{prepareError:{code:'42501'}}],
  ['foreign account',{account:{tenantId:id(99)}}],['changed plan',{account:{planId:id(99)}}],
  ['foreign receipt command',{receipt:{commandId:id(99)}}],['foreign receipt subject',{receipt:{stockSubject:id(99)}}],
  ['access grant',{receipt:{accessGranted:true}}],['financial response',{receipt:{amount:149000}}],
])test(`partial preparation remains unconfirmed after ${name}`,async()=>{
  assert.equal((await harness(options).run()).status,'unconfirmed')
})
test('mutable input cannot substitute selectors across awaited identity checks',async()=>{
  const value={...input},h=harness({mutateInput(){value.companyId=id(99);value.commandId=id(99)}})
  const result=await h.run(value);assert.equal(result.status,'prepared');assert.equal(result.receipt.companyId,id(1))
})
test('reciprocal confirmation reads Stock with explicit native token before Core acknowledgement',async()=>{
  const h=harness(),result=await h.confirm()
  assert.equal(result.status,'confirmed');assert.equal(result.accessGranted,false)
  const saved=h.calls.find(value=>typeof value==='object'&&value.name==='core_stock_membership_confirm_owner')
  assert.deepEqual(JSON.parse(JSON.stringify(saved.args.p_stock_receipt)),receipt)
  assert.equal(saved.args.p_stock_session,id(13));assert.ok(h.calls.indexOf('stock-read')<h.calls.indexOf(saved))
})
for(const options of [{stockReadError:{code:'42501'}},{stockReceipt:{profileId:id(99)}},
  {stockReceipt:{accessGranted:true}},{stockReceipt:{companyRevision:1}},{stockReceipt:{amount:149000}}]) {
  test('missing or substituted local preparation cannot create Core invoice readiness',async()=>{
    const h=harness(options);assert.equal((await h.confirm()).status,'unconfirmed')
    assert.ok(!h.calls.some(value=>typeof value==='object'&&value.name==='core_stock_membership_confirm_owner'))
  })
}
for(const options of [{lost:'core_stock_membership_confirm_owner'},{confirmationError:{code:'42501'}},
  {confirmation:{status:'prepared'}},{confirmation:{companyId:id(99)}},{confirmation:{accessGranted:true}}]) {
  test('uncertain Core acknowledgement requires same-command recovery',async()=>{
    assert.equal((await harness(options).confirm()).status,'unconfirmed')
  })
}

test('server diagnostics distinguish receipt-read and acknowledgement failures without private fields', async () => {
  for (const [options, stage, code] of [
    [{ stockReadError: { code: '42501', message: 'stock.native.token' } }, 'stock_context_read', '42501'],
    [{ confirmationError: { code: '55P03', details: id(1) } }, 'core_acknowledge', '55P03'],
    [{ accountError: { code: 'secret.native.token', message: id(1) } }, 'repeat_prepare', 'NONE'],
  ]) {
    const h = harness(options)
    assert.equal((await h.confirm()).status, 'unconfirmed')
    const trace = h.diagnostics.at(-1)[1]
    assert.equal(trace.operation, 'core_confirm')
    assert.equal(trace.stage, stage)
    assert.equal(trace.errorCode, code)
    assert.equal(trace.status, 'unconfirmed')
    assert.ok(trace.elapsedMs >= 0)
    const serialized = JSON.stringify(h.diagnostics)
    for (const forbidden of ['native.token', id(1), id(5), 'Authorization', 'message', 'details']) {
      assert.equal(serialized.includes(forbidden), false, forbidden)
    }
    assert.deepEqual(Object.keys(trace).sort(), ['checkpoints', 'elapsedMs', 'errorCode', 'operation', 'peerStatus', 'stage', 'status'])
  }
  assert.equal((await harness({ logSinkThrows: true }).confirm()).status, 'confirmed')
})

test('the installed SDK preserves the native Stock bearer on the actual confirmation RPC request', async () => {
  const h = harness({ actualSdk: true })
  assert.equal((await h.confirm()).status, 'confirmed')
  const requests = h.calls.filter(value => typeof value === 'object' && value.name === 'actual-sdk-request')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].authorization, 'Bearer stock.native.token')
  assert.equal(requests[0].apiKey, 'synthetic-stock')
  assert.deepEqual(requests[0].body, { p_company: input.companyId, p_instance: input.instanceId, p_command: input.commandId })
})

test('an actual SDK 42501 response prevents Core acknowledgement and remains diagnostically distinct', async () => {
  const h = harness({ actualSdk: true, stockReadError: { code: '42501', message: 'Synthetic permission denial' } })
  assert.equal((await h.confirm()).status, 'unconfirmed')
  assert.equal(h.calls.some(value => typeof value === 'object' && value.name === 'core_stock_membership_confirm_owner'), false)
  assert.equal(h.diagnostics.at(-1)[1].stage, 'stock_context_read')
  assert.equal(h.diagnostics.at(-1)[1].errorCode, '42501')
})
