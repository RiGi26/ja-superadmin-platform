import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import { ACTIVE_CORE_ORIGIN } from '@/lib/stock-active-protocol'
import { authorizeStockMembershipRequest } from '@/lib/stock-membership-authorize'
import { STOCK_MEMBERSHIP_RUNTIME_ENABLED } from '@/lib/stock-membership-protocol'

const PATH = '/api/stock/membership/authorize'
const MAX_BODY_BYTES = 2048
const jwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const headers = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0', Pragma: 'no-cache', Expires: '0',
  'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', Vary: 'Authorization',
}

async function readBody(request: NextRequest) {
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
      if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE')
      chunks.push(part.value)
    }
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
}

/** Dedicated closed v2 receiver. It is independent from the v1/pilot flags and
 * never accepts cookies or browser-originated authority. */
export async function handleStockMembershipCoreRequest(request: NextRequest) {
  if (!STOCK_MEMBERSHIP_RUNTIME_ENABLED) {
    return NextResponse.json({ status: 'unavailable' }, { status: 404, headers })
  }
  const url = new URL(request.url)
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const length = request.headers.get('content-length')
  if (request.method !== 'POST' || url.origin !== ACTIVE_CORE_ORIGIN || url.pathname !== PATH || url.search ||
      request.headers.has('cookie') || request.headers.has('origin') || !jwt.test(token) || token.length > 8192 ||
      !/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '') ||
      (length !== null && (!/^\d{1,4}$/.test(length) || Number(length) > MAX_BODY_BYTES))) {
    return NextResponse.json({ status: 'denied' }, { status: 403, headers })
  }
  try {
    const input = await readBody(request)
    const result = await authorizeStockMembershipRequest(input, token)
    if (result.status === 'authorized') return NextResponse.json(result.decision, { status: 200, headers })
    return NextResponse.json({ status: 'denied' }, { status: result.status === 'blocked' ? 503 : 403, headers })
  } catch {
    return NextResponse.json({ status: 'denied' }, { status: 403, headers })
  }
}
