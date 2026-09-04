export function normalizeAuthorizationId(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim()
  if (!normalized || normalized.length > 512) return null
  return normalized
}

export function safeHubReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null
  }

  try {
    const parsed = new URL(value, 'https://webzoka.com')
    if (parsed.origin !== 'https://webzoka.com' || parsed.pathname !== '/oauth/consent') {
      return null
    }

    const authorizationId = normalizeAuthorizationId(
      parsed.searchParams.get('authorization_id'),
    )
    if (!authorizationId) return null

    const query = new URLSearchParams({ authorization_id: authorizationId })
    return `/oauth/consent?${query.toString()}`
  } catch {
    return null
  }
}

/** Password-recovery callbacks may only enter the password update screen. */
export function safeHubAuthPath(value: string | null | undefined) {
  if (!value || value.includes('\\')) return '/hub/update-password'

  try {
    const parsed = new URL(value, 'https://webzoka.com')
    if (
      parsed.origin !== 'https://webzoka.com' ||
      parsed.pathname !== '/hub/update-password'
    ) {
      return '/hub/update-password'
    }
    return '/hub/update-password'
  } catch {
    return '/hub/update-password'
  }
}
