import 'server-only'

import { createHash, createHmac } from 'node:crypto'
import { z } from 'zod'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyNativeCoreSession } from '@/lib/core-registry-native'
import { STOCK_OPERATOR_INVITATION_ENABLED } from '@/lib/stock-operator-protocol'
import { STOCK_MEMBERSHIP_RUNTIME_ENABLED } from '@/lib/stock-membership-protocol'
import { ACTIVE_STOCK_ORIGIN } from '@/lib/stock-active-protocol'

const uuid = z.uuid()
const role = z.enum(['admin', 'staff', 'produksi'])
const email = z.string().trim().toLowerCase().max(254).pipe(z.email())
const invitation = z.object({
  companyId: uuid, instanceId: uuid, commandId: uuid, email, role,
}).strict()
const sent = z.object({
  status: z.enum(['ready', 'sent']), inviteId: uuid, companyId: uuid,
  recipient: email, companyName: z.string().min(2).max(100), role,
  expiresAt: z.iso.datetime({ offset: true }),
}).strict()
const view = z.object({
  companyId: uuid, instanceId: uuid, companyName: z.string().min(2).max(100),
  availableSeats: z.number().int().min(0).max(2), canInvite: z.boolean(),
  invitations: z.array(z.object({
    inviteId: uuid, commandId: uuid, email: email.nullable(), role, expiresAt: z.iso.datetime({ offset: true }),
    state: z.enum(['reserved', 'claimed', 'canceled', 'expired', 'activated']), sent: z.boolean(),
  }).strict()).max(20),
}).strict()
const terminal = z.object({ status: z.enum(['activated','canceled','expired']), inviteId: uuid, companyId: uuid }).strict()
const created = z.object({
  status: z.enum(['reserved','claimed','activated','canceled','expired']), inviteId: uuid,
  companyId: uuid, instanceId: uuid, commandId: uuid, role, expiresAt: z.iso.datetime({ offset: true }),
}).strict()
export type StockOperatorOwnerView = z.infer<typeof view>
export type StockOperatorOwnerResult = 'sent' | 'closed' | 'denied' | 'unconfirmed' | 'full' | 'duplicate'
  | 'activated' | 'canceled' | 'expired'

const enabled = () => STOCK_OPERATOR_INVITATION_ENABLED && STOCK_MEMBERSHIP_RUNTIME_ENABLED
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const escape = (text: string) => text.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

async function authenticate() {
  const client = await createClient()
  const actor = await verifyNativeCoreSession(client)
  if (!actor.customer || Date.parse(actor.until) <= Date.now()) throw new Error('STOCK_OPERATOR_OWNER_DENIED')
  async function current() {
    const latest = await verifyNativeCoreSession(client)
    if (!latest.customer || latest.subject !== actor.subject || latest.session !== actor.session ||
        Math.min(Date.parse(actor.until), Date.parse(latest.until)) <= Date.now()) throw new Error('STOCK_OPERATOR_OWNER_DENIED')
    return { ...latest, until: new Date(Math.min(Date.parse(actor.until), Date.parse(latest.until))).toISOString() }
  }
  return { client, actor, current }
}

export async function readStockOperatorOwnerView(companyId: unknown): Promise<StockOperatorOwnerView | null> {
  if (!enabled() || !uuid.safeParse(companyId).success) return null
  try {
    const { client, current } = await authenticate()
    const response = await client.rpc('core_stock_operator_owner_view', { p_company: companyId })
      .abortSignal(AbortSignal.timeout(2500))
    const value = view.safeParse(response.data)
    await current()
    return !response.error && value.success && value.data.companyId === companyId ? value.data : null
  } catch { return null }
}

/** A replay derives the same capability from the existing key and exact command.
 * Only its digest reaches the database. Provider idempotency binds the frozen
 * recipient, Company name, role, deadline, and invitation ID to one email.
 */
export async function inviteStockOperator(input: unknown): Promise<StockOperatorOwnerResult> {
  if (!enabled()) return 'closed'
  const selected = invitation.safeParse(input)
  const signingKey = process.env.WEBZOKA_PROVISIONING_SECRET
  const apiKey = process.env.RESEND_API_KEY
  if (!selected.success) return 'denied'
  if (!signingKey || signingKey.length < 32 || !apiKey) return 'closed'
  let attempted = false
  try {
    const fields = selected.data
    const { actor, current } = await authenticate()
    const capability = createHmac('sha256', signingKey).update(JSON.stringify([
      'webzoka.stock.operator.invitation.v1', actor.subject, fields.companyId, fields.instanceId,
      fields.commandId, fields.email, fields.role,
    ])).digest('base64url')
    const admin = createAdminClient()
    attempted = true
    const result = await admin.rpc('core_stock_operator_invite', {
      p_actor: actor.subject, p_session: actor.session, p_until: actor.until,
      p_company: fields.companyId, p_instance: fields.instanceId, p_command: fields.commandId,
      p_role: fields.role, p_email_hash: hash(fields.email), p_secret_hash: hash(capability),
    }).abortSignal(AbortSignal.timeout(2500))
    if (result.error) return 'unconfirmed'
    for (const status of ['full','duplicate'] as const) {
      if (result.data?.status === status && Object.keys(result.data).length === 1) return status
    }
    const reserved = created.parse(result.data)
    if (reserved.companyId !== fields.companyId || reserved.instanceId !== fields.instanceId ||
        reserved.commandId !== fields.commandId || reserved.role !== fields.role) return 'unconfirmed'
    if (['activated','canceled','expired'].includes(reserved.status)) return reserved.status as 'activated' | 'canceled' | 'expired'
    const fresh = await current()
    const snapshot = await admin.rpc('core_stock_operator_mail', {
      p_actor: fresh.subject, p_session: fresh.session, p_until: fresh.until,
      p_company: fields.companyId, p_invite: reserved.inviteId, p_email: fields.email,
    }).abortSignal(AbortSignal.timeout(2500))
    if (snapshot.error) return 'unconfirmed'
    const stopped = terminal.safeParse(snapshot.data)
    if (stopped.success && stopped.data.inviteId === reserved.inviteId && stopped.data.companyId === fields.companyId) return stopped.data.status
    const message = sent.parse(snapshot.data)
    if (message.inviteId !== reserved.inviteId || message.companyId !== fields.companyId ||
        message.recipient !== fields.email || message.role !== fields.role || Date.parse(message.expiresAt) <= Date.now()) return 'unconfirmed'
    await current()
    if (message.status === 'sent') return 'sent'
    const link = new URL('/invite/stock', ACTIVE_STOCK_ORIGIN)
    link.hash = new URLSearchParams({ inviteId: message.inviteId, secret: capability }).toString()
    const roles = { admin: 'Admin operasional', staff: 'Staf', produksi: 'Produksi' }
    const expires = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(message.expiresAt))
    const body = {
      from: process.env.RESEND_FROM_EMAIL ?? 'Webzoka <noreply@webzoka.com>',
      to: message.recipient,
      subject: `Undangan Stock untuk ${message.companyName}`,
      html: `<div style="font:16px/1.6 Arial,sans-serif;color:#10213f;max-width:560px;margin:auto;padding:24px">
<h1 style="font-size:24px">Undangan workspace Stock</h1>
<p>Pemilik workspace <strong>${escape(message.companyName)}</strong> mengundang Anda sebagai <strong>${roles[message.role]}</strong>.</p>
<p>Masuk atau daftar dengan alamat email yang menerima undangan ini. Verifikasi email sebelum melanjutkan.</p>
<p><a href="${escape(link.href)}" style="display:inline-block;background:#175dcc;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Terima undangan Stock</a></p>
<p>Undangan berlaku sampai ${escape(expires)} WIB. Pemilik workspace mengelola langganan dan tagihan.</p>
<p>Jika Anda tidak mengenal workspace ini, abaikan email ini.</p></div>`,
    }
    const options = { idempotencyKey: 'stock-operator-invite/' + message.inviteId, signal: AbortSignal.timeout(5000) }
    const delivery = await new Resend(apiKey).emails.send(body, options)
    if (delivery.error || !delivery.data?.id) return 'unconfirmed'
    const latest = await current()
    const ack = await admin.rpc('core_stock_operator_mail', {
      p_actor: latest.subject, p_session: latest.session, p_until: latest.until,
      p_company: fields.companyId, p_invite: reserved.inviteId, p_email: fields.email, p_provider_id: delivery.data.id,
    }).abortSignal(AbortSignal.timeout(2500))
    if (ack.error) return 'unconfirmed'
    const closed = terminal.safeParse(ack.data)
    if (closed.success && closed.data.inviteId === reserved.inviteId && closed.data.companyId === fields.companyId) return closed.data.status
    const receipt = sent.safeParse(ack.data)
    return receipt.success && receipt.data.status === 'sent' && receipt.data.inviteId === reserved.inviteId &&
      receipt.data.recipient === fields.email && receipt.data.companyId === fields.companyId ? 'sent' : 'unconfirmed'
  } catch { return attempted ? 'unconfirmed' : 'denied' }
}

export async function cancelStockOperatorInvitation(input: unknown): Promise<StockOperatorOwnerResult> {
  if (!enabled()) return 'closed'
  const selected = z.object({ companyId: uuid, inviteId: uuid, commandId: uuid }).strict().safeParse(input)
  if (!selected.success) return 'denied'
  try {
    const { actor } = await authenticate()
    const response = await createAdminClient().rpc('core_stock_operator_cancel_invite', {
      p_actor: actor.subject, p_session: actor.session, p_until: actor.until, p_company: selected.data.companyId,
      p_invite: selected.data.inviteId, p_command: selected.data.commandId,
    }).abortSignal(AbortSignal.timeout(2500))
    const value = terminal.safeParse(response.data)
    return !response.error && value.success && value.data.companyId === selected.data.companyId &&
      value.data.inviteId === selected.data.inviteId ? value.data.status : 'unconfirmed'
  } catch { return 'unconfirmed' }
}
