import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadStockModule, stockPolicyFixture } from './stock-self-payment-unit-harness.mjs'

const company='86000000-0000-4000-8000-000000000001'
function harness(options={}) {
  const calls=[]
  const api=loadStockModule('./stock-membership-purchase.ts',{
    '@/lib/stock-membership-protocol':{STOCK_MEMBERSHIP_PREPARATION_ENABLED:options.enabled??true},
    '@/lib/stock-purchase-policy':stockPolicyFixture,
  })
  const client={rpc(name,args){calls.push({name,args});return {async abortSignal(){
    if(options.lost)throw Error('unavailable')
    return {data:options.value??{companyId:company,ready:true},error:options.error}
  }}}}
  return {calls,run:value=>api.stockMembershipPurchaseReady(client,value??company)}
}
test('readiness gate and invalid Company produce zero database calls',async()=>{
  const closed=harness({enabled:false});assert.equal(await closed.run(),false);assert.deepEqual(closed.calls,[])
  const invalid=harness();assert.equal(await invalid.run('foreign'),false);assert.deepEqual(invalid.calls,[])
})
test('only exact current-owner reciprocal readiness permits new purchase',async()=>{
  const h=harness();assert.equal(await h.run(),true)
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[{name:'core_stock_membership_purchase_readiness',args:{p_company:company}}])
  for(const value of [false,[],{ready:true},{companyId:company,ready:false},{companyId:'foreign',ready:true},
    {companyId:company,ready:true,role:'owner'},{companyId:company,ready:'true'}]) {
    assert.equal(await harness({value}).run(),false)
  }
  assert.equal(await harness({lost:true}).run(),false);assert.equal(await harness({error:{code:'42501'}}).run(),false)
})
