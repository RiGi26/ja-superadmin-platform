import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadStockModule } from './stock-self-payment-unit-harness.mjs'
import { loadHubUi } from './hub-ui-test-harness.mjs'

const id=n=>`95000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor={subject:id(1),session:id(2),customer:true,until:new Date(Date.now()+25000).toISOString()}
const workspace={companyId:id(3),companyName:'Operator Bakery',instanceId:id(4),membershipId:id(5),coreSubject:actor.subject,role:'produksi'}
function harness(options={}) {
  const calls=[]
  let observations=0
  const api=loadStockModule('./stock-operator-workspaces.ts',{
    '@/lib/stock-operator-protocol':{STOCK_OPERATOR_INVITATION_ENABLED:false},
    '@/lib/stock-membership-protocol':{STOCK_MEMBERSHIP_RUNTIME_ENABLED:options.enabled??true},
    '@/lib/supabase/server':{createClient:async()=>({rpc(name,args){
      assert.equal(name,'core_stock_operator_workspaces');assert.equal(args,undefined);calls.push('read')
      return {async abortSignal(){return {data:options.rows??[workspace],error:options.error}}}
    }})},
    '@/lib/core-registry-native':{verifyNativeCoreSession:async()=>{
      calls.push('native');return {...actor,...(++observations>1?options.current:options.actor)}
    }},
  })
  return {api,calls}
}

const read=async h=>JSON.parse(JSON.stringify(await h.api.readStockOperatorWorkspaces()))

test('operator discovery stays closed without side effects and requires the same live native customer after reading',async()=>{
  const closed=harness({enabled:false})
  assert.deepEqual(await read(closed),{status:'closed',workspaces:[]})
  assert.deepEqual(closed.calls,[])
  for(const options of [{actor:{customer:false}},{actor:{until:'2000-01-01T00:00:00Z'}},
    {current:{subject:id(90)}},{current:{session:id(91)}},{current:{customer:false}},
    {current:{until:'2000-01-01T00:00:00Z'}},{error:{message:'unavailable'}},
    {rows:[{...workspace,coreSubject:id(99)}]},{rows:[workspace,workspace]},
    {rows:[{...workspace,amount:359000}]},{rows:[{...workspace,role:'owner'}]}]) {
    const h=harness(options)
    assert.deepEqual(await read(h),{status:'unavailable',workspaces:[]})
  }
  const h=harness()
  assert.deepEqual(await read(h),{status:'ready',workspaces:[workspace]})
  assert.deepEqual(h.calls,['native','read','native'])
})

test('operator systems entry chooses only the exact workspace and never exposes invoice or Owner controls',async()=>{
  const account={name:'Operator',email:'operator@example.test',accessReady:true,workspace:{status:'empty'}}
  const list={status:'ready',workspaces:[workspace,{...workspace,companyId:id(6),instanceId:id(7),membershipId:id(8),companyName:'Second Bakery',role:'staff'}]}
  const {AccountHub}=loadHubUi('app/hub/_components/AccountHub.tsx',{'../account/actions':{logoutHubAccount(){}}})
  const html=renderToStaticMarkup(AccountHub({account,view:'systems',operatorWorkspaces:list}))
  assert.match(html,/Operator Bakery/);assert.match(html,/Second Bakery/)
  assert.match(html,/Stock · Produksi/);assert.match(html,/Stock · Staf/)
  assert.equal((html.match(/action="https:\/\/webzoka-stock-platform.vercel.app\/api\/auth\/stock-membership\/selection\/start"/g)??[]).length,2)
  assert.match(html,new RegExp('name="companyId" value="'+workspace.companyId+'"'))
  assert.match(html,new RegExp('name="reservationId" value="'+workspace.instanceId+'"'))
  assert.doesNotMatch(html,/name="role"|name="profileId"|name="amount"|name="coreSubject"|Peran Anda: Owner|Kelola undangan tim|Riwayat tagihan|Belum ada keanggotaan sistem aktif/)
  const billing=renderToStaticMarkup(AccountHub({account,view:'billing',operatorWorkspaces:list}))
  assert.doesNotMatch(billing,/Operator Bakery|stock-membership\/selection\/start/)
  const unavailable=renderToStaticMarkup(AccountHub({account,view:'systems',operatorWorkspaces:{status:'unavailable',workspaces:[]}}))
  assert.match(unavailable,/Akses tim Stock belum dapat diperiksa/)
  assert.doesNotMatch(unavailable,/Belum ada keanggotaan sistem aktif/)
})

test('account page requests operational workspace discovery only on Systems',async()=>{
  let reads=0
  const {default:Page}=loadHubUi('app/hub/account/page.tsx',{
    '@/lib/hub-account':{getHubAccount:async()=>({name:'Operator',email:'operator@example.test',accessReady:true,workspace:{status:'empty'}})},
    '@/lib/stock-self-payment':{readStockBillingAccount:async()=>({status:'unavailable',workspaces:[]})},
    '@/lib/stock-operator-workspaces':{readStockOperatorWorkspaces:async()=>{reads++;return {status:'ready',workspaces:[workspace]}}},
    '../account/actions':{logoutHubAccount(){}},
  })
  for(const view of ['home','billing','support'])await Page({searchParams:Promise.resolve({view})})
  assert.equal(reads,0)
  const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({view:'systems'})}))
  assert.equal(reads,1);assert.match(html,/Operator Bakery/)
})
