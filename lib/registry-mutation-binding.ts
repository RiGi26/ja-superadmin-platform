import 'server-only'

/** The legacy Registry path still lacks independent proof/operator adapters.
 * E1 admission instead uses the installed resource-isolated atomic command.
 * A binding selects implementation; it is not identity, readiness or release authority.
 */
export const registryMutationDependencies = Object.freeze([
  'W01_W15_SOURCE_MAPPING_AND_ALL_WRITER_FENCE_UNBOUND',
  'INDEPENDENT_COMPANY_PORTAL_PROOF_AND_TWO_CURRENT_OPERATOR_SESSIONS_UNBOUND',
] as const)

export function registryMutationBinding() {
  return Object.freeze({ status: 'blocked' as const,
    reason: 'TRUSTED_REGISTRY_ISSUER_UNBOUND' as const,
    dependencies: registryMutationDependencies })
}

export function e1StockMutationBinding(action?: string) {
  if (action === 'e1.stock.admit') return Object.freeze({
    status: 'bound' as const,
    action: 'e1.stock.admit' as const,
    rpc: 'core_registry_e1_stock_create' as const,
  })
  if (action === 'e1.stock.bind') return Object.freeze({
    status: 'bound' as const,
    action: 'e1.stock.bind' as const,
    rpc: 'core_registry_e1_stock_bind_stage' as const,
  })
  return Object.freeze({ status: 'blocked' as const,
    reason: 'TRUSTED_E1_ADAPTERS_UNBOUND' as const,
    dependencies: Object.freeze([
      'E1_CHECKOUT_AND_ACTIVATION_ADAPTER_UNBOUND',
    ]) })
}
