import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import { ACTIVE_STOCK_RUNTIME_ENABLED, STOCK_SSO_PILOT_ENABLED } from '@/lib/stock-active-release'
import { ACTIVE_CORE_ORIGIN } from '@/lib/stock-active-protocol'
import { authorizeActiveStockRequest } from '@/lib/stock-active-authorize'
import { enrollActiveStockSession } from '@/lib/stock-active-enroll'
import { STOCK_PAID_BILLING_RUNTIME_ENABLED } from '@/lib/stock-purchase-policy'

const headers = { 'Cache-Control': 'private, no-store, no-cache, max-age=0', Pragma: 'no-cache', Expires: '0',
  'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', Vary: 'Authorization' }
const jwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

async function body(request: NextRequest) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('BODY_REQUIRED')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    const signal = AbortSignal.timeout(3000)
    while (true) {
      const part = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
        const abort = () => reject(new Error('BODY_TIMEOUT'))
        if (signal.aborted) { abort(); return }
        signal.addEventListener('abort', abort, { once: true })
        reader.read().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
      })
      if (part.done) break
      size += part.value.byteLength
      if (size > 2048) throw new Error('BODY_TOO_LARGE')
      chunks.push(part.value)
    }
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
}

/** Explicit native credentials only. Cookies and browser-origin requests cannot
 * select a fallback identity. No credentials or raw errors enter the response.
 */
export async function handleActiveStockCoreRequest(request: NextRequest, operation: 'authorize' | 'enroll') {
  if (!(ACTIVE_STOCK_RUNTIME_ENABLED || STOCK_SSO_PILOT_ENABLED || STOCK_PAID_BILLING_RUNTIME_ENABLED)) return NextResponse.json({ status: 'unavailable' }, { status: 404, headers })
  const url = new URL(request.url)
  const authorization = request.headers.get('authorization') ?? ''
  const stockToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const coreToken = request.headers.get('x-webzoka-core-provider') ?? ''
  if (request.method !== 'POST' || url.origin !== ACTIVE_CORE_ORIGIN || url.search ||
      url.pathname !== '/api/stock/active/' + operation || request.headers.has('cookie') ||
      request.headers.has('origin') || !jwt.test(stockToken) || stockToken.length > 8192 ||
      (operation === 'enroll' ? !jwt.test(coreToken) || coreToken.length > 8192 : coreToken !== '') ||
      !/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '') ||
      (request.headers.has('content-length') && !/^\d{1,4}$/.test(request.headers.get('content-length')!)) ||
      Number(request.headers.get('content-length') ?? 0) > 2048) {
    return NextResponse.json({ status: 'denied' }, { status: 403, headers })
  }
  try {
    const input = await body(request)
    if (operation === 'enroll' && input?.phase !== undefined) {
      const { e1PilotExchange } = await import('@/lib/stock-e1-pilot')
      const pilot = await e1PilotExchange(input, stockToken, coreToken)
      if (pilot.status === 'prepared' || pilot.status === 'confirmed') {
        return NextResponse.json(pilot, { status: 200, headers })
      }
      return NextResponse.json({ status: pilot.status }, { status: pilot.status === 'denied' ? 403 : 503, headers })
    }
    const result = operation === 'enroll' ? await enrollActiveStockSession(input, stockToken, coreToken)
      : await authorizeActiveStockRequest(input, stockToken)
    if (result.status === 'authorized' || result.status === 'enrolled') {
      return NextResponse.json(result.decision, { status: 200, headers })
    }
    return NextResponse.json({ status: result.status === 'unconfirmed' ? 'unconfirmed' : 'denied' },
      { status: result.status === 'denied' ? 403 : 503, headers })
  } catch { return NextResponse.json({ status: 'denied' }, { status: 403, headers }) }
}

/** Database introspection uses HEAD because the supported http extension does
 * not follow redirects for HEAD. The request/response metadata is bounded and
 * nonce-correlated; authorization credentials remain only in their normal header.
 * This endpoint performs no session enrollment or business mutation.
 */
export async function handleActiveStockCoreHead(request: NextRequest) {
  const headHeaders = { ...headers, Vary: 'Authorization, X-Webzoka-Stock-Request' }
  if (!(ACTIVE_STOCK_RUNTIME_ENABLED || STOCK_SSO_PILOT_ENABLED || STOCK_PAID_BILLING_RUNTIME_ENABLED)) return new NextResponse(null, { status: 404, headers: headHeaders })
  const url = new URL(request.url)
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const encoded = request.headers.get('x-webzoka-stock-request') ?? ''
  if (request.method !== 'HEAD' || url.origin !== ACTIVE_CORE_ORIGIN || url.search ||
      url.pathname !== '/api/stock/active/authorize' || request.headers.has('cookie') || request.headers.has('origin') ||
      request.headers.has('x-webzoka-core-provider') || !jwt.test(token) || token.length > 8192 ||
      encoded.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    return new NextResponse(null, { status: 403, headers: headHeaders })
  }
  try {
    const bytes = Buffer.from(encoded, 'base64url')
    if (bytes.length > 1536 || bytes.toString('base64url') !== encoded) throw new Error('DENIED')
    const input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const result = await authorizeActiveStockRequest(input, token)
    if (result.status !== 'authorized') return new NextResponse(null,
      { status: result.status === 'blocked' ? 503 : 403, headers: headHeaders })
    return new NextResponse(null, { status: 200, headers: { ...headHeaders,
      'X-Webzoka-Stock-Decision': Buffer.from(JSON.stringify(result.decision)).toString('base64url') } })
  } catch { return new NextResponse(null, { status: 403, headers: headHeaders }) }
}
