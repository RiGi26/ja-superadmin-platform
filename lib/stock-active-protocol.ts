/** Wire validation only. A parsed object is not an authorization issuer.
 * Production callers must obtain it through the pinned online Core boundary.
 */
export const ACTIVE_CORE_ORIGIN = 'https://hub.webzoka.com'
export const ACTIVE_CORE_REALM = 'https://hxhusfkrlafxdnyasmsu.supabase.co'
export const ACTIVE_STOCK_ORIGIN = 'https://webzoka-stock-platform.vercel.app'
export const ACTIVE_STOCK_REALM = 'https://oyyfcmlquqfrdoffkgsd.supabase.co'
export const ACTIVE_STOCK_CLIENT_ID = 'fe3e0af9-2d84-4ec2-a750-b26bb4a81caf'
export const ACTIVE_REQUEST_MAX_MS = 5_000

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const methods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'])
const decisionKeys = ['bindingId', 'bindingRevision', 'companyId', 'companyRevision', 'coreSessionId',
  'coreSubject', 'coreTenantId', 'expiresAt', 'instanceId', 'issuedAt', 'method', 'nonce',
  'path', 'stockSessionId', 'stockSubject', 'stockTenantId', 'version'].sort().join(',')

export type ActiveStockSelector = Readonly<{ companyId: string; instanceId: string }>
export type ActiveStockRequest = Readonly<{
  stockSubject: string; stockSessionId: string; method: string; path: string; nonce: string
}>
export type ActiveStockDecision = ActiveStockSelector & ActiveStockRequest & Readonly<{
  version: 1; bindingId: string; bindingRevision: number; companyRevision: number;
  coreSubject: string; coreSessionId: string; coreTenantId: string; stockTenantId: string;
  nonce: string; issuedAt: number; expiresAt: number
}>

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
export function isActiveStockUuid(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value)
}
export function parseActiveStockSelector(value: unknown): ActiveStockSelector {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'companyId,instanceId' ||
      !isActiveStockUuid(value.companyId) || !isActiveStockUuid(value.instanceId)) {
    throw new Error('ACTIVE_STOCK_SELECTOR_DENIED')
  }
  return Object.freeze({ companyId: value.companyId, instanceId: value.instanceId })
}

/** PostgREST request.path excludes /rest/v1 and the query string. Only resource
 * and RPC paths are supported. Native Auth, Storage and Realtime use other APIs.
 */
export function parseActiveStockRequest(value: unknown): ActiveStockRequest {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'method,nonce,path,stockSessionId,stockSubject' ||
      !isActiveStockUuid(value.stockSubject) || !isActiveStockUuid(value.stockSessionId) ||
      !isActiveStockUuid(value.nonce) ||
      typeof value.method !== 'string' || !methods.has(value.method) ||
      typeof value.path !== 'string' || value.path.length > 180 ||
      !/^\/(?:rpc\/)?[a-z][a-z0-9_]*$/.test(value.path)) {
    throw new Error('ACTIVE_STOCK_REQUEST_DENIED')
  }
  return Object.freeze({ stockSubject: value.stockSubject, stockSessionId: value.stockSessionId,
    method: value.method, path: value.path, nonce: value.nonce })
}

/** Validate the exact online response against this request and clock. The
 * lifetime is only an in-flight DB request bound, never a cached grant lease.
 */
export function parseActiveStockDecision(value: unknown, expected: ActiveStockRequest,
  now = Date.now()): ActiveStockDecision {
  expected = parseActiveStockRequest(expected)
  if (!object(value) || Object.keys(value).sort().join(',') !== decisionKeys || value.version !== 1 ||
      !Number.isSafeInteger(now) || now <= 0) throw new Error('ACTIVE_STOCK_DECISION_DENIED')
  for (const name of ['bindingId', 'companyId', 'instanceId', 'coreSubject', 'coreSessionId',
    'coreTenantId', 'stockTenantId', 'stockSubject', 'stockSessionId', 'nonce']) {
    if (!isActiveStockUuid(value[name])) throw new Error('ACTIVE_STOCK_DECISION_DENIED')
  }
  for (const name of ['bindingRevision', 'companyRevision']) {
    if (!Number.isSafeInteger(value[name]) || (value[name] as number) < 0) {
      throw new Error('ACTIVE_STOCK_DECISION_DENIED')
    }
  }
  if (!Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt) ||
      (value.issuedAt as number) <= 0 || (value.issuedAt as number) > now ||
      (value.expiresAt as number) <= now || (value.expiresAt as number) <= (value.issuedAt as number) ||
      (value.expiresAt as number) - (value.issuedAt as number) > ACTIVE_REQUEST_MAX_MS ||
      value.stockSubject !== expected.stockSubject || value.stockSessionId !== expected.stockSessionId ||
      value.method !== expected.method || value.path !== expected.path || value.nonce !== expected.nonce) {
    throw new Error('ACTIVE_STOCK_DECISION_DENIED')
  }
  // Snapshot scalars before an asynchronous consumer can use the decision.
  return Object.freeze({ ...value }) as ActiveStockDecision
}

/** Signed AMR is a restrictive classifier, not Company authority. Unknown or
 * malformed authentication methods must never enter the password-only bypass.
 */
export function activeStockSessionMode(amr: unknown): 'local' | 'federated' | 'denied' {
  if (!Array.isArray(amr) || amr.length === 0 || amr.length > 10 || amr.some(item =>
    !object(item) || typeof item.method !== 'string' || !Number.isSafeInteger(item.timestamp) || (item.timestamp as number) <= 0)) {
    return 'denied'
  }
  const names = new Set(amr.map(item => item.method))
  if (names.has('oauth')) return 'federated'
  if ([...names].some(name => !['password', 'totp', 'otp', 'magiclink', 'recovery', 'invite',
    'email/signup', 'email_change', 'token_refresh'].includes(name))) return 'denied'
  return [...names].some(name => ['password', 'otp', 'magiclink', 'recovery', 'invite', 'email/signup'].includes(name))
    ? 'local' : 'denied'
}
