import 'server-only'

import { DEFAULT_COOKIE_OPTIONS } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Mutable Action/Route contexts only. Match this client's default storage key. */
export async function clearHubSessionCookies() {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
  const key = `sb-${host.split('.')[0]}-auth-token`
  const store = await cookies()
  const owns = (name: string) => [key, `${key}-code-verifier`].some(base =>
    name === base || (name.startsWith(`${base}.`) && /^\d+$/.test(name.slice(base.length + 1))))
  for (const { name } of store.getAll()) {
    if (owns(name)) store.set(name, '', { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) })
  }
}
