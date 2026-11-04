'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { inviteStockOperator, cancelStockOperatorInvitation } from '@/lib/stock-operator-owner'
import { stockCompanyId, stockOperatorPath } from '@/lib/stock-purchase-policy'

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
