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

export function stockCheckoutPath(plan: string, company?: string): string {
  const id = stockPlanId(plan)
  if (!id || (company !== undefined && !stockCompanyId(company))) throw new Error('INVALID_STOCK_SELECTION')
  const query = new URLSearchParams({ plan: id })
  if (company) query.set('company', stockCompanyId(company)!)
  return `/hub/checkout/stock?${query}`
}

/** A continuation contains selectors only, never a price, token, or tenant grant. */
export function safeStockCheckoutPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const url = new URL(value, 'https://hub.webzoka.com')
    if (url.origin !== 'https://hub.webzoka.com' || url.hash ||
        !['/hub/checkout/stock', '/checkout/stock'].includes(url.pathname)) return null
    if (!url.search) return '/hub/checkout/stock'
    if ([...url.searchParams.keys()].some(key => !['plan', 'company'].includes(key)) ||
        url.searchParams.getAll('plan').length !== 1 || url.searchParams.getAll('company').length > 1) return null
    const plan = stockPlanId(url.searchParams.get('plan'))
    const company = url.searchParams.has('company') ? stockCompanyId(url.searchParams.get('company')) : undefined
    return plan && company !== null ? stockCheckoutPath(plan, company) : null
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
