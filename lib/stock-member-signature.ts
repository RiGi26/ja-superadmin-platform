import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Separate both this protocol and its acknowledgment from existing billing APIs.
export function signStockMember(secret: string, direction: 'request' | 'ack', timestamp: string, nonce: string, body: string) {
  return createHmac('sha256',secret).update(`webzoka.stock.member.v2.${direction}\n${timestamp}\n${nonce}\n${body}`).digest('hex')
}

export function verifyStockMember(secret: string, direction: 'request' | 'ack', timestamp: string | null,
  nonce: string | null, signature: string | null, body: string) {
  if (secret.length < 32 || !/^\d{13}$/.test(timestamp ?? '') || !/^[a-f0-9]{32}$/.test(nonce ?? '') ||
      !/^[a-f0-9]{64}$/.test(signature ?? '') || Number(timestamp) < Date.now()-30_000 || Number(timestamp) > Date.now()+5000) return false
  const expected = signStockMember(secret,direction,timestamp!,nonce!,body)
  return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature!,'hex'))
}

export async function readStockMemberBody(message: Request | Response): Promise<string | null> {
  if (!message.body || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(message.headers.get('content-type') ?? '') ||
      Number(message.headers.get('content-length') ?? 0)>8192) return null
  const reader=message.body.getReader(), decoder=new TextDecoder('utf-8',{fatal:true}), deadline=AbortSignal.timeout(3000)
  let text='',size=0
  try {
    for (;;) {
      const part=await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve,reject)=>{
        const expired=()=>reject(new Error('MEMBER_BODY_TIMEOUT'))
        if (deadline.aborted) { expired();return }
        deadline.addEventListener('abort',expired,{once:true})
        reader.read().then(resolve,reject).finally(()=>deadline.removeEventListener('abort',expired))
      })
      if(part.done) return text+decoder.decode()
      size+=part.value.byteLength
      if(size>8192)return null
      text+=decoder.decode(part.value,{stream:true})
    }
  } catch { return null }
  finally { void reader.cancel().catch(()=>{});reader.releaseLock() }
}
