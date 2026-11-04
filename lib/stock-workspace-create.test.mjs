import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadStockModule, stockPolicyFixture } from './stock-self-payment-unit-harness.mjs'

const realm='https://hxhusfkrlafxdnyasmsu.supabase.co'
const id=n=>`6b000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const input={commandId:id(1),companyName:'New Workspace'}
const actor={subject:id(2),session:id(3),customer:true,until:new Date(Date.now()+25000).toISOString()}
const workspace={version:2,status:'reserved',...input,companyId:id(4),instanceId:id(5),
  receipt:{companyId:id(4),eventId:id(6),eventHash:'a'.repeat(64),revision:0},accessGranted:false}
function harness(options={}) {
  const calls=[];let observations=0
  const api=loadStockModule('./stock-workspace-create.ts',{
    '@/lib/stock-purchase-policy':stockPolicyFixture,
    '@/lib/e1-realm':{CORE_E1_ORIGIN:realm},
    '@/lib/supabase/server':{createClient:async()=>({})},
    '@/lib/core-registry-native':{verifyNativeCoreSession:async()=>{calls.push('auth');return options.actors?.[observations++]??actor}},
    '@/lib/supabase/admin':{createAdminClient:()=>({rpc(name,args){calls.push({name,args});return{
      async abortSignal(){if(options.lost)throw Error('lost response');return {data:{...workspace,...options.workspace},error:options.error}}}}})},
  },{process:{env:{NEXT_PUBLIC_SUPABASE_URL:options.realm??realm}}})
  // Synthetic module fixture only. The exported source fuse stays false on disk.
  if(options.enabled!==false)api.STOCK_WORKSPACE_CREATION_ENABLED=true
  return {api,calls,run:value=>api.createStockWorkspace(value??input)}
}
test('workspace creation stays source-closed with no identity or DB effects',async()=>{
  for(const options of [{enabled:false},{realm:'https://foreign.invalid'}]) {
    const h=harness(options);assert.equal((await h.run()).status,'closed');assert.equal(h.calls.length,0)
  }
})
test('browser cannot supply existing Company, identity, role, tenant, malformed name or idempotency key',async()=>{
  for(const value of [
    {...input,companyId:id(9)},{...input,role:'owner'},{...input,tenantId:id(9)},
    {...input,subject:id(9)},{...input,companyName:'a\nname'},{...input,commandId:'00000000-0000-0000-0000-000000000000'},
  ]) {
    const h=harness();assert.equal((await h.run(value)).status,'denied');assert.equal(h.calls.length,0)
  }
})
test('fresh native customer creates reservation only; no caller-supplied identity or access grant',async()=>{
  const h=harness();assert.equal((await h.run()).status,'reserved')
  assert.deepEqual(h.calls.filter(call=>typeof call==='object').map(call=>call.name),['core_stock_workspace_create'])
  const mutation=h.calls[1]
  assert.equal(mutation.args.p_actor,actor.subject);assert.equal(mutation.args.p_session,actor.session)
  assert.equal(mutation.args.p_command,input.commandId);assert.equal(mutation.args.p_company_name,input.companyName)
  assert.equal(h.calls.at(-1),'auth')
})
test('lost results, foreign receipt, changed session and expired observations remain unconfirmed',async()=>{
  for(const options of [
    {lost:true},{error:{code:'42501'}},{workspace:{accessGranted:true}},
    {workspace:{commandId:id(99)}},{workspace:{receipt:{...workspace.receipt,companyId:id(99)}}},
    {actors:[actor,{...actor,session:id(99)}]},{actors:[actor,{...actor,until:new Date(0).toISOString()}]},
  ]) {
    const h=harness(options);assert.equal((await h.run()).status,'unconfirmed')
    assert.equal(h.calls.filter(call=>typeof call==='object').length,1)
    assert.equal(h.calls.find(call=>typeof call==='object').args.p_command,input.commandId)
  }
  for(const observation of [{...actor,customer:false},{...actor,until:new Date(0).toISOString()}]) {
    const h=harness({actors:[observation]});assert.equal((await h.run()).status,'denied')
    assert.equal(h.calls.filter(call=>typeof call==='object').length,0)
  }
})
