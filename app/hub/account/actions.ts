'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { clearHubSessionCookies } from '@/lib/hub-session'

export async function logoutHubAccount() {
  try {
    const db = await createClient()
    await db.auth.signOut({ scope: 'local' })
  } catch { /* Provider availability must not prevent local logout. */ }
  await clearHubSessionCookies()
  redirect('/hub/login')
}
