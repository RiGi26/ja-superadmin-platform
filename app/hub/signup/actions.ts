'use server'

import { headers } from 'next/headers'
import { registerHubAccount, type HubRegistrationState } from '@/lib/hub-registration'

export async function signupToHub(_state: HubRegistrationState, form: FormData): Promise<HubRegistrationState> {
  const requestHeaders = await headers()
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || 'unknown'
  return registerHubAccount(form, ip, requestHeaders.get('origin'))
}
