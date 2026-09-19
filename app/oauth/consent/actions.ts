'use server'

import { redirect } from 'next/navigation'
import { normalizeAuthorizationId } from '@/lib/hub-return-path'
import { createClient } from '@/lib/supabase/server'

function decisionErrorUrl(authorizationId: string) {
  const query = new URLSearchParams({
    authorization_id: authorizationId,
    error: 'decision_failed',
  })
  return `/oauth/consent?${query.toString()}`
}

export async function approveWebzokaAuthorization(formData: FormData) {
  const authorizationId = normalizeAuthorizationId(
    String(formData.get('authorization_id') ?? ''),
  )
  if (!authorizationId) redirect('/hub?view=systems')

  const db = await createClient()
  const { data, error } = await db.auth.oauth.approveAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  })

  if (error || !data?.redirect_url) redirect(decisionErrorUrl(authorizationId))
  redirect(data.redirect_url)
}

export async function denyWebzokaAuthorization(formData: FormData) {
  const authorizationId = normalizeAuthorizationId(
    String(formData.get('authorization_id') ?? ''),
  )
  if (!authorizationId) redirect('/hub?view=systems')

  const db = await createClient()
  const { data, error } = await db.auth.oauth.denyAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  })

  if (error || !data?.redirect_url) redirect(decisionErrorUrl(authorizationId))
  redirect(data.redirect_url)
}
