import { APPROVED_OFFERS } from '@/lib/plan-catalog'

// Workspace-preparation candidate; deployment requires explicit Owner authority.
// Public offers stay closed. The reviewed preparation rollout forces sandbox
// checkout off, enrolls no cohort and keeps Stock's private receiver disabled.
export const STOCK_PAID_BILLING_RUNTIME_ENABLED = true

export function stockPurchaseAvailable(catalogSalesEnabled: boolean): boolean {
  return STOCK_PAID_BILLING_RUNTIME_ENABLED && catalogSalesEnabled
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function stockPlanId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.toLowerCase()
  return APPROVED_OFFERS.some(offer => offer.platform === 'stock' && offer.id === id) ? id : null
}

export function stockCompanyId(value: unknown): string | null {
  return typeof value === 'string' && uuid.test(value) ? value.toLowerCase() : null
}

export function stockCheckoutPath(plan: string | null, company?: string): string {
  const planId = stockPlanId(plan)
  const companyId = stockCompanyId(company)
  if ((plan !== null && !planId) || (company !== undefined && !companyId)) throw new Error('INVALID_STOCK_SELECTION')
  const query = new URLSearchParams()
  if (planId) query.set('plan', planId)
  if (companyId) query.set('company', companyId)
  return query.size > 0 ? `/hub/checkout/stock?${query}` : '/hub/checkout/stock'
}

export function stockWorkspaceCreationPath(plan: string, command: string): string {
  const id = stockCompanyId(command)
  if (!id) throw new Error('INVALID_STOCK_WORKSPACE_COMMAND')
  return stockCheckoutPath(plan) + '&creation=' + id
}

const checkoutNotices = new Set([
  'closed', 'denied', 'preparation_required', 'pending', 'unavailable',
  'workspace_denied', 'workspace_unconfirmed', 'workspace_reserved',
])

/** A continuation contains selectors only. Known display notices are discarded. */
export function safeStockCheckoutPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const url = new URL(value, 'https://hub.webzoka.com')
    if (url.origin !== 'https://hub.webzoka.com' || url.hash ||
        !['/hub/checkout/stock', '/checkout/stock'].includes(url.pathname)) return null
    if (!url.search) return '/hub/checkout/stock'
    if ([...url.searchParams.keys()].some(key => !['plan', 'company', 'creation', 'result'].includes(key)) ||
        url.searchParams.getAll('plan').length > 1 || url.searchParams.getAll('company').length > 1) return null
    const notices = url.searchParams.getAll('result')
    if (notices.length > 1 || (notices.length === 1 && !checkoutNotices.has(notices[0]))) return null
    const plan = stockPlanId(url.searchParams.get('plan'))
    if (url.searchParams.has('plan') && !plan) return null
    if (url.searchParams.has('creation')) {
      const command = stockCompanyId(url.searchParams.get('creation'))
      return plan && command && url.searchParams.getAll('creation').length === 1 && !url.searchParams.has('company')
        ? stockWorkspaceCreationPath(plan, command) : null
    }
    const company = url.searchParams.has('company') ? stockCompanyId(url.searchParams.get('company')) : undefined
    return company !== null && (plan || company) ? stockCheckoutPath(plan, company) : null
  } catch { return null }
}

export function safeStockPaymentRedirect(value: unknown, mode: unknown): string | null {
  if (typeof value !== 'string' || !['sandbox', 'production'].includes(String(mode))) return null
  try {
    const url = new URL(value)
    const hostname = mode === 'sandbox' ? 'app.sandbox.midtrans.com' : 'app.midtrans.com'
    if (url.protocol !== 'https:' || url.hostname !== hostname || url.port || url.username || url.password || url.hash ||
        !url.pathname.startsWith('/snap/')) return null
    return url.href
  } catch { return null }
}

export function stockOperatorPath(company: string, command?: string): string {
  const companyId = stockCompanyId(company)
  const commandId = stockCompanyId(command)
  if (!companyId || (command !== undefined && !commandId)) throw new Error('INVALID_STOCK_OPERATOR_SELECTION')
  const query = new URLSearchParams({ company: companyId })
  if (commandId) query.set('command', commandId)
  return '/hub/stock/team?' + query.toString()
}

export function safeStockOperatorReturnPath(value: string): string | null {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const url = new URL(value, 'https://hub.webzoka.com')
    if (url.origin !== 'https://hub.webzoka.com' || url.hash ||
        !['/stock/team', '/hub/stock/team'].includes(url.pathname) ||
        [...url.searchParams.keys()].some(key => !['company','command','result'].includes(key)) ||
        url.searchParams.getAll('company').length !== 1 || url.searchParams.getAll('command').length > 1 ||
        url.searchParams.getAll('result').length > 1) return null
    const company = stockCompanyId(url.searchParams.get('company'))
    const command = url.searchParams.has('command') ? stockCompanyId(url.searchParams.get('command')) : undefined
    const result = url.searchParams.get('result')
    if (result && !['sent','closed','denied','unconfirmed','full','duplicate','activated','canceled','expired'].includes(result)) return null
    return company && command !== null ? stockOperatorPath(company, command) : null
  } catch { return null }
}
