'use server'

import { redirect } from 'next/navigation'
import { rememberStockPurchase, startStockPurchase, readStockBillingAccount } from '@/lib/stock-self-payment'
import { stockCheckoutPath, stockPlanId, stockCompanyId } from '@/lib/stock-purchase-policy'
import { refreshStockInvoice } from '@/lib/stock-invoice-recovery'
import { STOCK_MEMBERSHIP_PREPARATION_ENABLED } from '@/lib/stock-membership-protocol'

function selection(form: FormData) {
  if ([...form.keys()].some(key => !['plan', 'company'].includes(key) && !key.startsWith('$ACTION_')) ||
      form.getAll('plan').length !== 1 || form.getAll('company').length > 1) return null
  const plan = stockPlanId(form.get('plan'))
  const company = form.has('company') ? stockCompanyId(form.get('company')) : undefined
  return plan && company !== null ? { plan, company } : null
}

export async function prepareStockWorkspace(form: FormData): Promise<never> {
  const selected = selection(form)
  if (!selected) redirect('/hub/store#stock-packages')
  const intent = await rememberStockPurchase(selected.plan, selected.company)
  if (!intent) redirect(stockCheckoutPath(selected.plan, selected.company) + '&result=unavailable')
  if (intent.companyId && intent.reservationId) {
    redirect(`/hub/workspace?${new URLSearchParams({ commandId: intent.commandId, companyId: intent.companyId, reservationId: intent.reservationId })}`)
  }
  redirect('/hub/workspace')
}

export async function submitStockPayment(form: FormData): Promise<never> {
  const selected = selection(form)
  if (!selected?.company) redirect('/hub/store#stock-packages')
  const result = await startStockPurchase({ plan: selected.plan, company: selected.company })
  if (result.status === 'checkout') redirect(result.redirectUrl)
  if (result.status === 'paid') redirect('/hub/account?view=billing')
  redirect(stockCheckoutPath(selected.plan, selected.company) + `&result=${result.status}`)
}

export async function prepareStockMembership(form: FormData): Promise<never> {
  const selected = selection(form)
  if (!selected?.company) redirect('/hub/store#stock-packages')
  if (!STOCK_MEMBERSHIP_PREPARATION_ENABLED) redirect(stockCheckoutPath(selected.plan, selected.company) + '&result=closed')
  const intent = await rememberStockPurchase(selected.plan, selected.company)
  redirect(stockCheckoutPath(selected.plan, selected.company) + (!intent ? '&result=unavailable' : ''))
}

export async function refreshStockInvoiceAction(form: FormData): Promise<never> {
  if (![...form.keys()].some(key => key !== 'invoice' && !key.startsWith('$ACTION_')) && form.getAll('invoice').length === 1) {
    await refreshStockInvoice(form.get('invoice'))
  }
  redirect('/hub/account?view=billing')
}

/** Poll only an already paid, currently owned invoice; never create a charge. */
export async function checkStockActivationAction(invoice: string): Promise<'active' | 'pending' | 'unavailable'> {
  const account = await readStockBillingAccount()
  const workspace = account.status === 'ready' && account.workspaces.find(row => row.invoices.some(item => item.id === invoice && item.status === 'paid'))
  if (!workspace) return 'unavailable'
  if (workspace.activation === 'active') return 'active'
  if (workspace.activation !== 'pending') return 'unavailable'
  await refreshStockInvoice(invoice)
  return 'pending'
}
