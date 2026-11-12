import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as crypto from 'node:crypto'
import { loadStockModule, stockCatalogFixture } from './stock-self-payment-unit-harness.mjs'

function plan(platform) {
  const offer=stockCatalogFixture.APPROVED_OFFERS.find(row=>row.platform===platform)
  return {id:offer.id,platform,tier:offer.tier,tier_display_name:offer.name,price_monthly:offer.price,price_yearly:null,
    offer_version:stockCatalogFixture.BASIC_PRO_VERSION,public_tier:offer.publicTier,allowed_periods:['monthly'],entitlement_contract:offer.contract}
}
function harness(options={}) {
  const calls=[]
  const query={select(){return this},eq(){return this},async maybeSingle(){calls.push('global');return {data:{value:options.global??'production'},error:null}}}
  const api=loadStockModule('./midtrans.ts',{
    crypto, '@/lib/plan-catalog':stockCatalogFixture,
    '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>query,async rpc(name){calls.push(name);return {data:options.stock??'sandbox',error:options.error??null}}})},
  })
  return {calls,api}
}
test('new approved Stock mode uses private Stock setting without changing global/LMS mode',async()=>{
  const h=harness()
  assert.equal(await h.api.getMidtransMode(plan('stock')),'sandbox')
  assert.deepEqual(h.calls,['stock_billing_payment_mode'])
  assert.equal(await h.api.getMidtransMode(plan('lms')),'production')
  assert.equal(await h.api.getMidtransMode(),'production')
  assert.deepEqual(h.calls,['stock_billing_payment_mode','global','global'])
})
test('missing, closed or invalid Stock mode cannot fall back to global billing',async()=>{
  for(const options of [{error:{code:'42883'}},{stock:'unknown'},{stock:false}]) {
    const h=harness(options)
    await assert.rejects(h.api.getMidtransMode(plan('stock')),/STOCK_PAYMENT_MODE_UNAVAILABLE/)
    assert.deepEqual(h.calls,['stock_billing_payment_mode'])
  }
})
