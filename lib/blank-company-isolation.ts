import 'server-only'

import { CORE_COMPANY_RUNTIME_ENABLED } from '@/lib/core-company'

export type BlankCompanyDenial = Readonly<{
  context: 'blank_company'
  status: 'blocked'
  code: 'core_company_runtime_disabled' | 'blank_company_authority_unavailable'
  authorityReady: false
  legacyOperationsPermitted: false
  company: null
}>

export type BlankCompanyHubSnapshot = BlankCompanyDenial & Readonly<{
  tenant: null
  subscription: null
  invoices: readonly never[]
  manageSubscriptionUrl: null
}>

// Inert denial contract, not a verified identity or an authorization capability.
// No canonical verifier exists. Changing a runtime flag alone cannot grant access.
export function resolveBlankCompanyContext(untrustedContext?: unknown): BlankCompanyDenial {
  void untrustedContext
  return Object.freeze({
    context: 'blank_company',
    status: 'blocked',
    code: CORE_COMPANY_RUNTIME_ENABLED
      ? 'blank_company_authority_unavailable'
      : 'core_company_runtime_disabled',
    authorityReady: false,
    legacyOperationsPermitted: false,
    company: null,
  })
}

// Deliberately separate from getHubSnapshot(): no legacy import or fallback.
// The local Hub dispatcher consumes this denial without canonical authority.
// Deployed routing and session enforcement have not been validated.
export function getBlankCompanyHubSnapshot(untrustedContext?: unknown): BlankCompanyHubSnapshot {
  return Object.freeze({
    ...resolveBlankCompanyContext(untrustedContext),
    tenant: null,
    subscription: null,
    invoices: Object.freeze([]),
    manageSubscriptionUrl: null,
  })
}

// Refuse every operation without interpreting a token, selecting a legacy tenant,
// accepting an executor callback, or dispatching onboarding/provisioning/billing.
export function requestBlankCompanyLegacyOperation(
  untrustedOperation: unknown,
  untrustedContext?: unknown,
): BlankCompanyDenial {
  void untrustedOperation
  return resolveBlankCompanyContext(untrustedContext)
}
