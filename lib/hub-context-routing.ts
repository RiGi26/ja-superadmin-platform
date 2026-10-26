import 'server-only'

import { CORE_COMPANY_RUNTIME_ENABLED } from '@/lib/core-company'
import { getBlankCompanyHubSnapshot, type BlankCompanyHubSnapshot } from '@/lib/blank-company-isolation'
import { getHubSnapshot, type HubCustomerSnapshot } from '@/lib/hub-data'

export type HubRouteDispatch = BlankCompanyHubSnapshot | Readonly<{
  context: 'legacy_tenant'
  snapshot: HubCustomerSnapshot
}>

// Only the existing server-owned, zero-argument Hub route keeps legacy behavior.
// This selects a route, not a trusted Company identity. No canonical resolver exists.
// Explicit context (including undefined) or an attempted runtime enablement must
// stop before legacy Auth, membership, billing-token or other dependency calls.
export async function dispatchHubRoute(...untrustedContext: never[]): Promise<HubRouteDispatch> {
  if (untrustedContext.length !== 0 || CORE_COMPANY_RUNTIME_ENABLED) {
    return getBlankCompanyHubSnapshot(untrustedContext[0])
  }

  return Object.freeze({ context: 'legacy_tenant', snapshot: await getHubSnapshot() })
}
