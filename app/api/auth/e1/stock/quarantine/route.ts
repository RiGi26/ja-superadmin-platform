import { z } from 'zod'
import { bindNativeE1StockQuarantine, e1StockTransportGate } from '@/lib/e1-stock-binding'

export const runtime = 'nodejs'
const uuid = z.uuid().transform(value => value.toLowerCase())
const selector = z.object({ commandId: uuid, companyId: uuid, reservationId: uuid }).strict()
const respond = (body: unknown, status: number) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
})
const bearer = (value: string | null) => value && value.length <= 8199
  ? value.match(/^Bearer ([^\s,]+)$/i)?.[1] : undefined

async function readSelector(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('INVALID_REQUEST')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const deadline = AbortSignal.timeout(3000)
  let text = '', bytes = 0
  try {
    for (;;) {
      const part = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
        const aborted = () => reject(new Error('INVALID_REQUEST'))
        if (deadline.aborted) { aborted(); return }
        deadline.addEventListener('abort', aborted, { once: true })
        reader.read().then(resolve, reject).finally(() => deadline.removeEventListener('abort', aborted))
      })
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > 2048) throw new Error('INVALID_REQUEST')
      text += decoder.decode(part.value, { stream: true })
    }
    return selector.parse(JSON.parse(text + decoder.decode()))
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** Native Auth namespace delegates to this dormant bearer-only boundary. */
export async function POST(request: Request) {
  if (e1StockTransportGate().status === 'blocked') return respond({ status: 'blocked' }, 503)
  const coreToken = bearer(request.headers.get('authorization'))
  const stockToken = bearer(request.headers.get('x-webzoka-stock-authorization'))
  if (!coreToken || !stockToken) return respond({ status: 'denied' }, 403)
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '')) {
    return respond({ status: 'denied' }, 400)
  }
  let input: z.infer<typeof selector>
  try { input = await readSelector(request) }
  catch { return respond({ status: 'denied' }, 400) }
  const result = await bindNativeE1StockQuarantine(input, { coreToken, stockToken })
  if (result.status === 'quarantined') {
    const { stockTenantId, profileId, auditEventId } = result.binding
    return respond({ status: 'quarantined', ...input, stockTenantId, profileId, auditEventId, isActive: false }, 200)
  }
  if (result.status === 'unconfirmed') return respond({ status: 'unconfirmed', ...input }, 202)
  return respond({ status: result.status }, result.status === 'blocked' ? 503 : 403)
}
