import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { readOwnedHubWorkspace, type HubOwnedWorkspace } from '@/lib/hub-owned-workspace'

export type HubAccount = Readonly<{ email: string; name: string; accessReady: boolean; workspace: HubOwnedWorkspace }>

/** Account identity is not Company, tenant, product, or billing authority. */
export const getHubAccount = cache(async (): Promise<HubAccount> => {
  const db = await createClient()
  const { data, error } = await db.auth.getUser().catch(() => ({ data: { user: null }, error: true }))
  const user = data?.user
  if (error || !user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous === true) {
    redirect('/hub/login?next=%2Fhub%2Faccount')
  }
  // This own-membership read chooses the existing dashboard only. Its data is
  // never copied into Company context, and failed reads do not grant access.
  let legacyTenantId: string | null = null
  let accessReady = false
  try {
    const membership = await db.from('tenant_members').select('tenant_id')
      .eq('user_id', user.id).eq('is_active', true).in('role', ['owner', 'admin', 'member'])
      .limit(1).maybeSingle()
    accessReady = !membership.error
    if (accessReady && typeof membership.data?.tenant_id === 'string' && membership.data.tenant_id) legacyTenantId = membership.data.tenant_id
  } catch { /* The account page may show identity; business access stays closed. */ }
  if (legacyTenantId) redirect('/hub')
  const workspace = await readOwnedHubWorkspace(db, user.id)
  // User-editable metadata is used for escaped display text only.
  const fullName = user.user_metadata?.full_name
  return Object.freeze({ email: user.email, name: typeof fullName === 'string' ? fullName.trim().slice(0, 120) : '', accessReady: accessReady && workspace.status !== 'unavailable', workspace })
})
