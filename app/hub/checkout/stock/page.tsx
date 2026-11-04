import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { hubE1RewriteQuery } from '@/lib/hub-e1-rewrite-query'
import { createClient } from '@/lib/supabase/server'
import { readStockBillingAccount, readStockPurchaseIntent, readStockPurchaseOffers } from '@/lib/stock-self-payment'
import { stockPlanId, stockCompanyId, stockCheckoutPath } from '@/lib/stock-purchase-policy'
import { StockCheckoutView } from './StockCheckoutView'
import { STOCK_MEMBERSHIP_PREPARATION_ENABLED } from '@/lib/stock-membership-protocol'
import { stockMembershipPurchaseReady } from '@/lib/stock-membership-purchase'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pilih Paket Stock | Webzoka', referrer: 'strict-origin' as const, robots: { index: false, follow: false } }

export default async function StockCheckoutPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = hubE1RewriteQuery(await searchParams, (await headers()).get('host'))
  if (Object.keys(query).some(key => !['plan', 'company', 'result'].includes(key)) ||
      Object.values(query).some(value => Array.isArray(value)) ||
      (query.plan !== undefined && !stockPlanId(query.plan)) || (query.company !== undefined && !stockCompanyId(query.company))) {
    redirect('/hub/store#stock-packages')
  }
  const selectedPlan = stockPlanId(query.plan)
  const company = stockCompanyId(query.company)
  const returnPath = selectedPlan ? stockCheckoutPath(selectedPlan, company ?? undefined) : '/hub/checkout/stock'
  const client = await createClient()
  const identity = await client.auth.getUser().catch(() => null)
  if (identity?.error || !identity?.data.user?.email_confirmed_at || identity.data.user.is_anonymous === true) {
    redirect(`/hub/login?next=${encodeURIComponent(returnPath)}`)
  }
  const [offers, account, intent] = await Promise.all([readStockPurchaseOffers(), readStockBillingAccount(), readStockPurchaseIntent(company ?? undefined)])
  const planId = selectedPlan ?? intent?.planId ?? null
  const workspaces = account.status === 'ready' ? account.workspaces : []
  const selected = company ? workspaces.find(item => item.companyId === company) ?? null : workspaces.length === 1 ? workspaces[0] : null
  const scopedOffers = offers?.salesEnabled || !selected ? offers : await readStockPurchaseOffers(selected.companyId)
  const plan = scopedOffers?.plans.find(item => item?.id === planId) ?? null
  const preparationRequired = Boolean(STOCK_MEMBERSHIP_PREPARATION_ENABLED && selected?.stockTenantId &&
    !selected.hasPaidContract && !(await stockMembershipPurchaseReady(client, selected.companyId)))
  const membershipPreparation = preparationRequired && selected && intent?.planId === planId &&
    intent.companyId === selected.companyId && intent.reservationId === selected.reservationId
    ? { companyId: selected.companyId, instanceId: selected.reservationId, commandId: intent.commandId } : null
  return <StockCheckoutView plan={plan} salesEnabled={scopedOffers?.salesEnabled === true}
    sandbox={Boolean(scopedOffers && 'sandbox' in scopedOffers && scopedOffers.sandbox)}
    accessReady={account.status === 'ready'} workspaces={workspaces} selected={selected}
    preparationRequired={preparationRequired} membershipPreparation={membershipPreparation}
    result={typeof query.result === 'string' ? query.result : null} />
}
