import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import { ACTIVE_CORE_ORIGIN } from '@/lib/stock-active-protocol'
import { authorizeStockMembershipRequest } from '@/lib/stock-membership-authorize'
import { STOCK_MEMBERSHIP_RUNTIME_ENABLED, STOCK_MEMBERSHIP_PREPARATION_ENABLED } from '@/lib/stock-membership-protocol'
import { selectStockMembershipSession } from '@/lib/stock-membership-select'
import { prepareStockMembershipOwner, confirmStockMembershipOwner } from '@/lib/stock-membership-prepare'
import { claimStockOperatorInvitation, commitStockOperatorInvitation } from '@/lib/stock-operator-claim'
import { confirmStockOperatorActivation } from '@/lib/stock-operator-confirm'
import { STOCK_OPERATOR_INVITATION_ENABLED } from '@/lib/stock-operator-protocol'

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
export async function handleStockMembershipCoreRequest(request: NextRequest, operation: 'authorize' | 'select' | 'prepare' | 'confirm' | 'claim' | 'commit' | 'operator-confirm' = 'authorize') {
  const enabled = operation === 'prepare' || operation === 'confirm' ? STOCK_MEMBERSHIP_PREPARATION_ENABLED
    : STOCK_MEMBERSHIP_RUNTIME_ENABLED && (!['claim','commit'].includes(operation) || STOCK_OPERATOR_INVITATION_ENABLED)
  if (!enabled) {
    return NextResponse.json({ status: 'unavailable' }, { status: 404, headers })
  }
  const url = new URL(request.url)
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const length = request.headers.get('content-length')
  const coreToken = request.headers.get('x-webzoka-core-provider') ?? ''
  if (request.method !== 'POST' || url.origin !== ACTIVE_CORE_ORIGIN || url.pathname !== '/api/stock/membership/' + operation || url.search ||
      request.headers.has('cookie') || request.headers.has('origin') || !jwt.test(token) || token.length > 8192 ||
      (operation !== 'authorize' ? !jwt.test(coreToken) || coreToken.length > 8192 : coreToken !== '') ||
      !/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '') ||
      (length !== null && (!/^\d{1,4}$/.test(length) || Number(length) > MAX_BODY_BYTES))) {
    return NextResponse.json({ status: 'denied' }, { status: 403, headers })
  }
  try {
    const input = await readBody(request)
    if (operation === 'prepare' || operation === 'confirm') {
      const prepared = operation === 'prepare' ? await prepareStockMembershipOwner(input, token, coreToken)
        : await confirmStockMembershipOwner(input, token, coreToken)
      return NextResponse.json(prepared, { status: ['prepared','confirmed'].includes(prepared.status) ? 200 : prepared.status === 'denied' ? 403 : 503,
        headers: { ...headers, Vary: 'Authorization, X-Webzoka-Core-Provider' } })
    }
    if (operation === 'operator-confirm') {
      const confirmed = await confirmStockOperatorActivation(input,token,coreToken)
      return NextResponse.json(confirmed,{
        status: ['confirmed','not_active'].includes(confirmed.status) ? 200 : confirmed.status==='denied' ? 403 : 503,
        headers:{...headers,Vary:'Authorization, X-Webzoka-Core-Provider'},
      })
    }
    if (operation === 'claim' || operation === 'commit') {
      const claimed = operation === 'claim' ? await claimStockOperatorInvitation(input, token, coreToken)
        : await commitStockOperatorInvitation(input, token, coreToken)
      return NextResponse.json(claimed, {
        status: claimed.status === 'denied' ? 403 : claimed.status === 'unconfirmed' || claimed.status === 'blocked' ? 503 : 200,
        headers: { ...headers, Vary: 'Authorization, X-Webzoka-Core-Provider' },
      })
    }
    if (operation === 'select') {
      const selected = await selectStockMembershipSession(input, token, coreToken)
      return NextResponse.json(selected.status === 'selected' ? selected : { status: selected.status }, {
        status: selected.status === 'selected' ? 200 : selected.status === 'denied' ? 403 : 503,
        headers: { ...headers, Vary: 'Authorization, X-Webzoka-Core-Provider' },
      })
    }
    const result = await authorizeStockMembershipRequest(input, token)
    if (result.status === 'authorized') return NextResponse.json(result.decision, { status: 200, headers })
    return NextResponse.json({ status: 'denied' }, { status: result.status === 'blocked' ? 503 : 403, headers })
  } catch {
    return NextResponse.json({ status: 'denied' }, { status: 403, headers })
  }
}

/** Database-side online checks use a bodyless request, matching the installed
 * private HTTP transport's bounded decision-header convention. This is still
 * the independent closed v2 receiver; no v1 receiver or gate is changed.
 */
export async function handleStockMembershipCoreHead(request: NextRequest) {
  const headHeaders = { ...headers, Vary: 'Authorization, X-Webzoka-Stock-Request' }
  const respond = (status: number, decision?: unknown) => new Response(null, {
    status, headers: decision === undefined ? headHeaders : { ...headHeaders,
      'X-Webzoka-Stock-Decision': Buffer.from(JSON.stringify(decision)).toString('base64url') },
  })
  if (!STOCK_MEMBERSHIP_RUNTIME_ENABLED) return respond(404)
  try {
    const url = new URL(request.url)
    const authorization = request.headers.get('authorization') ?? ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    const encoded = request.headers.get('x-webzoka-stock-request') ?? ''
    const length = request.headers.get('content-length')
    if (request.method !== 'HEAD' || url.origin !== ACTIVE_CORE_ORIGIN || url.pathname !== PATH || url.search ||
        request.headers.has('cookie') || request.headers.has('origin') || request.body !== null ||
        request.headers.has('x-webzoka-core-provider') ||
        (length !== null && length !== '0') || !jwt.test(token) || token.length > 8192 ||
        encoded.length > 2731 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return respond(403)
    const bytes = Buffer.from(encoded, 'base64url')
    if (bytes.length > MAX_BODY_BYTES || bytes.toString('base64url') !== encoded) return respond(403)
    const input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const result = await authorizeStockMembershipRequest(input, token)
    if (result.status !== 'authorized') return respond(result.status === 'blocked' ? 503 : 403)
    if (Buffer.byteLength(JSON.stringify(result.decision), 'utf8') > 3072) return respond(403)
    return respond(200, result.decision)
  } catch { return respond(403) }
}
