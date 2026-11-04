import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Resend } from 'resend'
import { loadStockModule, stockPolicyFixture } from './stock-self-payment-unit-harness.mjs'
import { loadHubUi } from './hub-ui-test-harness.mjs'

const id = n => `94000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const input = { companyId:id(1),instanceId:id(2),commandId:id(3),email:'Operator+New@Example.Test',role:'produksi' }
const actor = { subject:id(4),session:id(5),customer:true,until:new Date(Date.now()+25000).toISOString() }
const invitation = { status:'reserved',inviteId:id(6),companyId:input.companyId,instanceId:input.instanceId,
  commandId:input.commandId,role:input.role,expiresAt:new Date(Date.now()+3600000).toISOString() }
const workspace = { companyId:input.companyId,instanceId:input.instanceId,companyName:'Example Bakery',
  availableSeats:1,canInvite:true,invitations:[] }

function harness(options={}) {
  const calls=[],emails=[],effects=new Map()
  let native=0,sent=false,ackLost=false,mailLost=false
  const nativeActor=()=>++native===options.expireAt?{...actor,until:'2000-01-01T00:00:00Z'}:{...actor,...options.actor}
  const api=loadStockModule('./stock-operator-owner.ts',{
    '@/lib/stock-operator-protocol':{STOCK_OPERATOR_INVITATION_ENABLED:options.enabled??true},
    '@/lib/stock-membership-protocol':{STOCK_MEMBERSHIP_RUNTIME_ENABLED:true},
    '@/lib/stock-active-protocol':{ACTIVE_STOCK_ORIGIN:'https://webzoka-stock-platform.vercel.app'},
    '@/lib/supabase/server':{createClient:async()=>({rpc(name,args) {
      assert.equal(name,'core_stock_operator_owner_view')
      calls.push('read')
      return {async abortSignal(){return {data:options.view??workspace}}}
    }})},
    '@/lib/core-registry-native':{verifyNativeCoreSession:async()=>{calls.push('native');return nativeActor()}},
    '@/lib/supabase/admin':{createAdminClient:()=>({rpc(name,args) {
      calls.push({name,args})
      return {async abortSignal(){
        if(name==='core_stock_operator_invite')return {data:options.invitation??invitation,error:options.error}
        if(name==='core_stock_operator_cancel_invite')return {data:{status:'canceled',inviteId:id(6),companyId:id(1)}}
        assert.equal(name,'core_stock_operator_mail')
        if(args.p_provider_id){
          sent=true
          if(options.ackLost&&!ackLost){ackLost=true;throw Error('lost ack response')}
        }
        return {data:{status:sent?'sent':'ready',inviteId:id(6),companyId:id(1),recipient:input.email.toLowerCase(),
          role:input.role,expiresAt:invitation.expiresAt,companyName:'Example Bakery',...options.snapshot}}
      }}
    }})},
    resend:{Resend:class {
      constructor(key){assert.equal(key,'synthetic-provider-key')}
      emails={send:async(body,opts)=>{
        calls.push('email');emails.push({body,options:opts})
        if(!effects.has(opts.idempotencyKey))effects.set(opts.idempotencyKey,body)
        else assert.deepEqual(body,effects.get(opts.idempotencyKey),'idempotency requires the same email payload')
        if(options.mailLost&&!mailLost){mailLost=true;throw Error('provider accepted but response was lost')}
        return {data:{id:'synthetic-provider-id'}}
      }}
    }},
  },{process:{env:{RESEND_API_KEY:'synthetic-provider-key',WEBZOKA_PROVISIONING_SECRET:'synthetic-provisioning-key-32-characters',...options.env}}})
  return {api,calls,emails,effects}
}

test('closed invitation controls and invalid or unauthenticated owners have no email or reservation effects',async()=>{
  const closed=harness({enabled:false})
  assert.equal(await closed.api.inviteStockOperator(input),'closed')
  assert.equal(await closed.api.readStockOperatorOwnerView(id(1)),null)
  assert.deepEqual(closed.calls,[])
  for(const invalid of [{...input,role:'owner'},{...input,amount:1},{...input,email:'bad\nemail'},
    {...input,commandId:'not-a-uuid'}]) {
    const h=harness()
    assert.equal(await h.api.inviteStockOperator(invalid),'denied')
    assert.deepEqual(h.calls,[])
  }
  for(const options of [{actor:{customer:false}},{actor:{until:'2000-01-01T00:00:00Z'}}]){
    const h=harness(options)
    assert.equal(await h.api.inviteStockOperator(input),'denied')
    assert.ok(!h.calls.some(call=>typeof call==='object'))
    assert.equal(h.emails.length,0)
  }
})

test('Owner invitation stores only secret digests and sends the exact fragment link with provider idempotency',async()=>{
  const h=harness()
  assert.equal(await h.api.inviteStockOperator(input),'sent')
  const saved=h.calls.find(call=>call.name==='core_stock_operator_invite')
  assert.match(saved.args.p_email_hash,/^[a-f0-9]{64}$/)
  assert.match(saved.args.p_secret_hash,/^[a-f0-9]{64}$/)
  const email=h.emails[0]
  assert.equal(email.body.to,'operator+new@example.test')
  assert.equal(email.options.idempotencyKey,'stock-operator-invite/'+id(6))
  assert.equal(email.options.signal.aborted,false)
  const href=email.body.html.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&')
  const link=new URL(href)
  assert.equal(link.origin,'https://webzoka-stock-platform.vercel.app')
  assert.equal(link.pathname,'/invite/stock')
  assert.equal(link.search,'')
  const fragment=new URLSearchParams(link.hash.slice(1))
  assert.equal(fragment.get('inviteId'),id(6))
  assert.match(fragment.get('secret'),/^[A-Za-z0-9_-]{43}$/)
  assert.ok(!JSON.stringify(saved.args).includes(fragment.get('secret')))
  assert.ok(!email.body.html.includes('synthetic-provisioning-key'))
  assert.equal(await h.api.inviteStockOperator(input),'sent')
  assert.equal(h.emails.length,1)
})

test('lost provider and database acknowledgments recover the original email and reserve no replacement command',async()=>{
  for(const options of [{mailLost:true},{ackLost:true}]){
    const h=harness(options)
    assert.equal(await h.api.inviteStockOperator(input),'unconfirmed')
    assert.equal(await h.api.inviteStockOperator(input),'sent')
    assert.equal(h.effects.size,1)
    const commands=h.calls.filter(call=>call.name==='core_stock_operator_invite').map(call=>call.args.p_command)
    assert.deepEqual(commands,[input.commandId,input.commandId])
    assert.ok(h.emails.every(email=>email.options.idempotencyKey==='stock-operator-invite/'+id(6)))
  }
})

test('seat refusal, foreign mapping, expiration and changed native session prevent email delivery',async()=>{
  for(const [options,status] of [
    [{invitation:{status:'full'}},'full'],[{invitation:{status:'duplicate'}},'duplicate'],
    [{invitation:{...invitation,companyId:id(99)}},'unconfirmed'],
    [{expireAt:3},'unconfirmed'],[{snapshot:{expiresAt:'2000-01-01T00:00:00Z'}},'unconfirmed'],
  ]){
    const h=harness(options)
    assert.equal(await h.api.inviteStockOperator(input),status)
    assert.equal(h.emails.length,0)
  }
  const h=harness()
  assert.equal((await h.api.readStockOperatorOwnerView(input.companyId)).companyId,input.companyId)
  assert.equal(await h.api.cancelStockOperatorInvitation({companyId:id(1),inviteId:id(6),commandId:id(8)}),'canceled')
  const malformed=harness()
  assert.equal(await malformed.api.cancelStockOperatorInvitation({companyId:id(1),inviteId:id(6),commandId:id(8),role:'owner'}),'denied')
  assert.deepEqual(malformed.calls,[])
})

test('Owner page preserves the exact Company and creation command through login and has no price or access grant inputs',async()=>{
  const formPath=stockPolicyFixture.stockOperatorPath(input.companyId,input.commandId)
  for(const bad of [formPath+'&amount=1',formPath+'&company='+id(99),formPath+'&command='+id(99),
    '//evil.test/stock/team',formPath+'&result=paid']){
    assert.equal(stockPolicyFixture.safeStockOperatorReturnPath(bad),null)
  }
  assert.equal(stockPolicyFixture.safeStockOperatorReturnPath(formPath+'&result=unconfirmed'),formPath)
  let signedOut=false, currentWorkspace=workspace
  const {default:Page}=loadHubUi('app/hub/stock/team/page.tsx',{
    'next/headers':{headers:async()=>new Headers({host:'hub.webzoka.com'})},
    'next/navigation':{redirect:path=>{throw Error('REDIRECT:'+path)}},
    '@/lib/hub-e1-rewrite-query':loadStockModule('./hub-e1-rewrite-query.ts'),
    '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:signedOut?null:{email_confirmed_at:'2026-11-04'}}})}})},
    '@/lib/stock-operator-owner':{readStockOperatorOwnerView:async()=>currentWorkspace},
    './StockInvitationForm':{StockInvitationForm:props=>createElement('form',{'data-company':props.companyId,'data-command':props.commandId,'data-can-invite':props.canInvite,'data-email':props.initialEmail,'data-role':props.initialRole})},
    './actions':{cancelStockOperatorAction(){}},
  })
  const query={company:input.companyId,command:input.commandId}
  const tree=await Page({searchParams:Promise.resolve(query)})
  const html=renderToStaticMarkup(tree)
  assert.match(html,/Undangan tim Stock/)
  assert.match(html,/data-company="94000000-0000-4000-8000-000000000001"/)
  assert.match(html,/data-command="94000000-0000-4000-8000-000000000003"/)
  assert.doesNotMatch(html,/name="amount"|name="tenantId"|name="secret"/)
  currentWorkspace={...workspace,availableSeats:0,canInvite:false,invitations:[{...invitation,commandId:input.commandId,email:input.email.toLowerCase(),state:'reserved',sent:false}]}
  const recovering=renderToStaticMarkup(await Page({searchParams:Promise.resolve(query)}))
  assert.match(recovering,/data-can-invite="true"/)
  assert.match(recovering,/data-email="operator\+new@example.test"/)
  assert.match(recovering,/data-role="produksi"/)
  assert.ok(recovering.includes(formPath.replaceAll('&','&amp;')))
  signedOut=true
  await assert.rejects(Page({searchParams:Promise.resolve(query)}),error=>error.message==='REDIRECT:/hub/login?next='+encodeURIComponent(formPath))
})


test('installed mail SDK forwards provider idempotency and the bounded abort signal',async()=>{
  const previous=globalThis.fetch
  const signal=AbortSignal.timeout(5000)
  let request
  globalThis.fetch=async(url,init)=>{
    request={url,init}
    return Response.json({id:'synthetic-sdk-message'})
  }
  try {
    const result=await new Resend('synthetic-key').emails.send({
      from:'Webzoka <noreply@example.test>',to:'operator@example.test',subject:'Synthetic test',html:'<p>Test</p>',
    },{idempotencyKey:'stock-operator-invite/'+id(6),signal})
    assert.equal(result.data.id,'synthetic-sdk-message')
    assert.equal(request.url,'https://api.resend.com/emails')
    assert.equal(new Headers(request.init.headers).get('idempotency-key'),'stock-operator-invite/'+id(6))
    assert.equal(request.init.signal,signal)
  } finally { globalThis.fetch=previous }
})
