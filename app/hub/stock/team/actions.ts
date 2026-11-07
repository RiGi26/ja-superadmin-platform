'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { inviteStockOperator, cancelStockOperatorInvitation } from '@/lib/stock-operator-owner'
import { stockCompanyId, stockOperatorPath } from '@/lib/stock-purchase-policy'
import { changeStockMember, retryStockMember, type StockMemberOwnerResult } from '@/lib/stock-member-owner'

export type StockOperatorFormState = {
  status: 'idle' | 'sent' | 'closed' | 'denied' | 'unconfirmed' | 'full' | 'duplicate' | 'activated' | 'canceled' | 'expired'
}

function fields(form: FormData, expected: string) {
  return [...form.keys()].filter(key => !key.startsWith('$ACTION_')).sort().join(',') === expected
}

export async function inviteStockOperatorAction(_previous: StockOperatorFormState, form: FormData): Promise<StockOperatorFormState> {
  if (!fields(form, 'commandId,companyId,email,instanceId,role')) return { status: 'denied' }
  const status = await inviteStockOperator(Object.fromEntries([...form.entries()].filter(([key]) => !key.startsWith('$ACTION_'))))
  revalidatePath('/hub/stock/team')
  return { status }
}

export async function cancelStockOperatorAction(form: FormData): Promise<never> {
  const company = stockCompanyId(form.get('companyId'))
  const command = stockCompanyId(form.get('commandId'))
  if (!company || !command || !fields(form, 'commandId,companyId,inviteId')) redirect('/hub/account?view=systems')
  const status = await cancelStockOperatorInvitation({ companyId: company, commandId: command, inviteId: form.get('inviteId') })
  revalidatePath('/hub/stock/team')
  redirect(stockOperatorPath(company) + '&result=' + status)
}

export type StockMemberFormState = { status: 'idle' | StockMemberOwnerResult }

export async function changeStockMemberAction(_previous: StockMemberFormState, form: FormData): Promise<StockMemberFormState> {
  const action=form.get('action')
  const expected=action==='role'?'action,commandId,companyId,expectedRevision,membershipId,role':
    action==='revoke'?'action,commandId,companyId,confirm,expectedRevision,membershipId':''
  if(!expected || !fields(form,expected) || (action==='revoke' && form.get('confirm')!=='revoke'))return {status:'denied'}
  const revision=form.get('expectedRevision')
  if(typeof revision!=='string' || !/^[1-9]\d{0,15}$/.test(revision))return {status:'denied'}
  const status=await changeStockMember({companyId:form.get('companyId'),membershipId:form.get('membershipId'),
    commandId:form.get('commandId'),expectedRevision:Number(revision),action,role:action==='role'?form.get('role'):null})
  revalidatePath('/hub/stock/team')
  return {status}
}

export async function retryStockMemberAction(_previous: StockMemberFormState, form: FormData): Promise<StockMemberFormState> {
  if(!fields(form,'companyId,eventId'))return {status:'denied'}
  const status=await retryStockMember({companyId:form.get('companyId'),eventId:form.get('eventId')})
  revalidatePath('/hub/stock/team')
  return {status}
}
