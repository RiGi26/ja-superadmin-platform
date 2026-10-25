import 'server-only'

/** Source-backed dependency ledger, not provider observations or attestations.
 * The verified native RPC catalog does not implement these missing authorities.
 * No request, environment switch, complete-looking JSON or injected callback can
 * register an issuer. Replace this refusal only with reviewed concrete adapters.
 */
export const registryMutationDependencies = Object.freeze([
  'MANAGED_CURRENT_SESSION_AUTHORITY_UNBOUND',
  'W01_W15_SOURCE_MAPPING_AND_ALL_WRITER_FENCE_UNBOUND',
  'INDEPENDENT_COMPANY_PORTAL_PROOF_AND_TWO_CURRENT_OPERATOR_SESSIONS_UNBOUND',
] as const)

export function registryMutationBinding() {
  return Object.freeze({ status: 'blocked' as const,
    reason: 'TRUSTED_REGISTRY_ISSUER_UNBOUND' as const,
    dependencies: registryMutationDependencies })
}

export function e1StockMutationBinding() {
  return Object.freeze({ status: 'blocked' as const,
    reason: 'TRUSTED_E1_ADAPTERS_UNBOUND' as const,
    dependencies: Object.freeze([
      'MANAGED_CURRENT_SESSION_CHECKPOINT_NOT_RUNTIME_VALIDATED',
      'RESOURCE_ORIGIN_AND_SCOPED_DATABASE_GUARDS_NOT_RUNTIME_VALIDATED',
      'ATOMIC_E1_RESOURCE_COMMAND_NOT_INSTALLED_OR_VALIDATED',
      'RECIPROCAL_STOCK_BINDING_AND_SESSION_TRANSPORT_NOT_RUNTIME_VALIDATED',
    ]) })
}
