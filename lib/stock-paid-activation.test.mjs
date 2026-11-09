import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHmac } from 'node:crypto'
import { loadStockModule } from './stock-self-payment-unit-harness.mjs'
import { loadPricingPolicy } from './pricing-unit-harness.mjs'

const catalog=loadPricingPolicy()
const id=n=>`71000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const secret='UNIT_ONLY_SIGNED_CORE_ACTIVATION_SECRET'
function payload(){return{kind:'stock_paid_activation_v1',invoiceId:id(1),deliveryId:id(2),companyId:id(3),reservationId:id(4),coreTenantId:id(5),coreSubject:id(6),
 stockTenantId:id(7),stockSubject:id(8),profileId:id(9),stockAuditEventId:id(10),planId:'5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001',offerVersion:'basic-pro-2026-10-v1',
 publicTier:'basic',planDisplayName:'Basic',planTier:'starter',features:['orders','catalog','stock'],maxActiveUsers:1,amount:149000,mode:'sandbox',
 expiresAt:new Date(Date.now()+60_000).toISOString(),validUntil:new Date(Date.now()+25_000).toISOString()}}
function harness(options={}){
 const calls=[]
 let now=Date.now()
 class ActivationDate extends Date {static now(){return now}}
 const adapter=loadStockModule('./stock-paid-activation.ts',{
  '@/lib/supabase/admin':{createAdminClient:()=>({auth:{admin:{getUserById:async subject=>({error:null,data:{user:{id:subject,is_anonymous:false,email_confirmed_at:new Date(0).toISOString(),...options.identity}}})}},rpc:async(name,args)=>{
   calls.push({name,args})
   if(options.expireClaim && name==='stock_billing_claim_activation')now+=24001
   return name==='stock_billing_claim_activation'?{data:options.claim===null?null:{...payload(),...options.claim},error:options.error??null}
    :{data:options.ack!==false,error:null}
  }})},
  '@/lib/plan-catalog':catalog,'@/lib/e1-realm':{STOCK_E1_APP_ORIGIN:'https://webzoka-stock-platform.vercel.app'},
  '@/lib/stock-purchase-policy':{STOCK_PAID_BILLING_RUNTIME_ENABLED:options.enabled!==false},
 },{Date:ActivationDate,process:{env:{BILLING_SYNC_SECRET:secret}},fetch:async(url,request)=>{
  calls.push({url,request})
  if(options.networkFailure || calls.filter(call=>call.url).length <= (options.failures ?? 0))throw new Error('SYNTHETIC_LOST_ACK')
  const p=JSON.parse(request.body)
  const receipt={status:'active',invoiceId:p.invoiceId,deliveryId:p.deliveryId,companyId:p.companyId,stockTenantId:p.stockTenantId,profileId:p.profileId,...options.receipt}
  return new Response(JSON.stringify(receipt),{headers:{'Content-Type':'application/json'}})
 }})
 return{calls,run:invoiceId=>adapter.deliverStockPaidActivation(id(5),invoiceId)}
}
test('default closed runtime cannot read outbox or send activation',async()=>{
 const h=harness({enabled:false});assert.equal(await h.run(),'closed');assert.equal(h.calls.length,0)
})
test('only a committed exact contract is signed for the fixed Stock endpoint and acknowledged',async()=>{
 const h=harness();assert.equal(await h.run(),'active')
 const sent=h.calls.find(call=>call.url)
 assert.equal(sent.url,'https://webzoka-stock-platform.vercel.app/api/billing/activate')
 const headers=sent.request.headers
 assert.equal(headers['x-ja-signature'],createHmac('sha256',secret).update(`${headers['x-ja-timestamp']}\n${headers['x-ja-nonce']}\n${sent.request.body}`).digest('hex'))
 assert.equal(h.calls.at(-1).name,'stock_billing_ack_activation')
})
test('invoice-specific recovery never sends a different paid invoice for the same tenant', async () => {
 const mismatch=harness()
 assert.equal(await mismatch.run(id(99)),'not_applicable')
 assert.equal(mismatch.calls.length,1)
 assert.equal(mismatch.calls[0].name,'stock_billing_claim_activation')
 const match=harness()
 assert.equal(await match.run(id(1)),'active')
 assert.equal(JSON.parse(match.calls.find(call=>call.url).request.body).invoiceId,id(1))
})
test('unknown, revoked, expired or mismatched outbox state cannot send an activation',async()=>{
 for(const claim of [{coreTenantId:id(99)},{amount:1},{features:['orders','catalog','stock','production']},
  {maxActiveUsers:99},{mode:'other'},{validUntil:new Date(0).toISOString()},{expiresAt:new Date(0).toISOString()}]){
  const h=harness({claim});assert.equal(await h.run(),'pending');assert.equal(h.calls.some(call=>call.url),false)
 }
 const absent=harness({claim:null});assert.equal(await absent.run(),'not_applicable');assert.equal(absent.calls.some(call=>call.url),false)
})
test('lost or foreign acknowledgements leave persisted delivery pending for reconciliation',async()=>{
 for(const options of [{networkFailure:true},{receipt:{profileId:id(99)}},{ack:false}]){
  const h=harness(options);assert.equal(await h.run(),'pending')
  if(options.networkFailure||options.receipt)assert.equal(h.calls.some(call=>call.name==='stock_billing_ack_activation'),false)
 }
})
test('a banned Core account cannot deliver new activation even when membership remains',async()=>{
 const h=harness({identity:{banned_until:new Date(Date.now()+60_000).toISOString()}})
 assert.equal(await h.run(),'pending');assert.equal(h.calls.some(call=>call.url),false)
})

test('transient receiver failure recovers the same committed delivery within three attempts',async()=>{
 const h=harness({failures:2});assert.equal(await h.run(),'active')
 const sent=h.calls.filter(call=>call.url)
 assert.equal(sent.length,3)
 assert.equal(new Set(sent.map(call=>JSON.parse(call.request.body).invoiceId)).size,1)
 assert.equal(new Set(sent.map(call=>JSON.parse(call.request.body).deliveryId)).size,1)
 assert.equal(h.calls.filter(call=>call.name==='stock_billing_ack_activation').length,1)
})

test('persistent outage stops after three attempts, preserving daily reconciliation',async()=>{
 const h=harness({networkFailure:true});assert.equal(await h.run(),'pending')
 assert.equal(h.calls.filter(call=>call.url).length,3)
 assert.equal(h.calls.filter(call=>call.name==='stock_billing_claim_activation').length,3)
 assert.equal(h.calls.some(call=>call.name==='stock_billing_ack_activation'),false)
 assert.ok(h.calls.every(call=>call.url || call.name==='stock_billing_claim_activation'))
})

test('exhausted function budget stops before native reads or another delivery attempt',async()=>{
 const h=harness({expireClaim:true});assert.equal(await h.run(),'pending')
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'stock_billing_claim_activation')
})
