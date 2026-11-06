import 'server-only'

type Operation = 'core_prepare' | 'core_confirm' | 'stock_callback'
type Stage = 'input' | 'native_identity' | 'saved_intent' | 'native_recheck' | 'origin_read'
  | 'account_prepare' | 'membership_prepare' | 'receipt_parse' | 'receipt_match'
  | 'stock_context_read' | 'core_acknowledge' | 'acknowledgement_result'
  | 'repeat_prepare' | 'peer_prepare' | 'stock_commit' | 'peer_confirm'
  | 'confirmation_result' | 'final_native_recheck'
type Status = 'blocked' | 'denied' | 'unconfirmed' | 'prepared' | 'confirmed'
const codes = new Set(['23503', '23505', '42501', '55P03', '57014', 'P0001', 'PGRST202', 'PGRST301', 'PGRST302'])

/** Request-local diagnostics only. Never accepts identity, URL, credential or
 * receipt fields. A broken log sink cannot change an authorization result.
 */
export function stockPreparationDiagnostics(operation: Operation) {
  const started = Date.now()
  let stage: Stage = 'input'
  let errorCode = 'NONE'
  let peerStatus: number | null = null
  const checkpoints: { stage: Stage; elapsedMs: number }[] = []
  const elapsed = () => Math.max(0, Date.now() - started)
  return {
    at(value: Stage) {
      stage = value
      if (value === 'peer_prepare' || value === 'peer_confirm') peerStatus = null
      if (checkpoints.length < 16) checkpoints.push({ stage, elapsedMs: elapsed() })
    },
    error(value: unknown) {
      if (!value || typeof value !== 'object') return
      try {
        const code = 'code' in value ? value.code : undefined
        const name = 'name' in value ? value.name : undefined
        errorCode = typeof code === 'string' && codes.has(code) ? code
          : name === 'TimeoutError' ? 'TIMEOUT' : name === 'AbortError' ? 'ABORTED' : 'OTHER'
      } catch { errorCode = 'OTHER' }
    },
    http(value: number) {
      peerStatus = Number.isInteger(value) && value >= 100 && value <= 599 ? value : null
    },
    result<const T extends { status: Status }>(value: T): T {
      try {
        console.info('STOCK_PREPARATION_DIAGNOSTIC', {
          operation, stage, status: value.status, errorCode, peerStatus,
          elapsedMs: elapsed(), checkpoints,
        })
      } catch { /* Logging must not affect custody, denial or acknowledgement. */ }
      return value
    },
  }
}

