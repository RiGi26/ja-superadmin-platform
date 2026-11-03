// Actual adapter, isolated dependencies. No provider, managed database or HTTP.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const identity = () => ({ coreSubject: 'unit-core', stockSubject: 'unit-stock', stockSession: 'unit-stock-session', until: Date.now()+25000 })
function harness(options={}) {
  const calls=[], sandboxModule={exports:{}}
  const code=ts.transpileModule(readFileSync(new URL('./stock-paid-session.ts',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText
  const db={rpc(name,args){calls.push({name,args});return{abortSignal:async()=>{
    if(options.throw)throw Error('UNIT_FAILURE')
    if(name==='core_stock_membership_is_managed')return{
      data:Object.hasOwn(options,'membership')?options.membership:false,error:options.membershipError??null,
    }
    return name==='stock_billing_active_is_managed'
      ? {data: options.managed ?? true,error:options.classError ?? null}
      : {data: options.data === undefined ? {bindingId:'unit-binding'} : options.data,error:options.authorityError ?? null}
  }}}}
  vm.runInNewContext(code,{module:sandboxModule,exports:sandboxModule.exports,Date,AbortSignal,require(name){
    if(name==='server-only')return{}
    if(name==='@/lib/stock-purchase-policy')return{STOCK_PAID_BILLING_RUNTIME_ENABLED:options.enabled!==false}
    if(name==='@/lib/supabase/admin')return{createAdminClient:()=>db}
    throw Error(name)
  }})
  return{calls,run:sandboxModule.exports.paidStockSessionAuthority}
}
test('closed paid engine still classifies retained membership before legacy',async()=>{
  const h=harness({enabled:false});assert.equal((await h.run(identity())).kind,'legacy')
  assert.deepEqual(h.calls.map(c=>c.name),['core_stock_membership_is_managed'])
})
test('only an explicit unclaimed identity returns to the existing authorization engine',async()=>{
  const h=harness({managed:false});assert.equal((await h.run(identity())).kind,'legacy');assert.equal(h.calls.length,2)
})
test('retained paid history uses its own authorization without legacy fallback',async()=>{
  const h=harness();assert.equal((await h.run(identity())).kind,'paid')
  assert.deepEqual(h.calls.map(c=>c.name),['core_stock_membership_is_managed','stock_billing_active_is_managed','stock_billing_active_authorize'])
})
test('enrollment sends only verified identity and selectors to the dedicated RPC',async()=>{
  const h=harness(), actor=identity(), enrollment={companyId:'company',instanceId:'instance',coreSession:'session',tokenExpires:Date.now()+60000}
  assert.equal((await h.run(actor,enrollment)).kind,'paid')
  assert.equal(h.calls[2].name,'stock_billing_active_enroll')
  assert.equal(h.calls[2].args.p_core_subject,actor.coreSubject)
  assert.equal(h.calls[2].args.p_stock_session,actor.stockSession)
  assert.equal(h.calls[2].args.p_company,enrollment.companyId)
  assert.equal(h.calls[2].args.p_core_session,enrollment.coreSession)
})
for(const options of [{classError:{code:'DENIED'}},{managed:'true'},{throw:true},{authorityError:{code:'REVOKED'}},{data:null}])
 test('unavailable or rejected paid authority denies without another engine: '+JSON.stringify(options),async()=>{
   const h=harness(options);assert.equal((await h.run(identity())).kind,'denied')
   assert.equal(h.calls[0].name,'core_stock_membership_is_managed')
   assert.ok(h.calls.slice(1).every(c=>c.name.startsWith('stock_billing_active_')))
 })
test('expired verified identity cannot authorize an operational request',async()=>{
  const h=harness();assert.equal((await h.run({...identity(),until:Date.now()-1})).kind,'denied');assert.equal(h.calls.length,0)
})
for(const membership of [true,null,'false',{},undefined])test('retained or unknown v2 classification never enters v1: '+JSON.stringify(membership),async()=>{
  for(const enabled of [true,false]){
    const h=harness({membership,enabled})
    assert.equal((await h.run(identity())).kind,'denied')
    assert.deepEqual(h.calls.map(c=>c.name),['core_stock_membership_is_managed'])
  }
})
test('failed v2 history read cannot fall through to paid, pilot or legacy',async()=>{
  const h=harness({membershipError:{message:'unavailable'}})
  assert.equal((await h.run(identity())).kind,'denied');assert.equal(h.calls.length,1)
})
