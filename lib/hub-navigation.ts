/** Public aliases select existing pages; they never establish account or Company access. */
export const HUB_PUBLIC_HOST = 'hub.webzoka.com'
export const HUB_PUBLIC_ORIGIN = 'https://hub.webzoka.com'

export const HUB_PUBLIC_ROUTES = [
  { publicPath: '/', internalPath: '/hub/account' },
  { publicPath: '/login', internalPath: '/hub/login' },
  { publicPath: '/signup', internalPath: '/hub/signup' },
  { publicPath: '/forgot-password', internalPath: '/hub/forgot-password' },
  { publicPath: '/update-password', internalPath: '/hub/update-password' },
  { publicPath: '/account', internalPath: '/hub/account' },
  { publicPath: '/workspace', internalPath: '/hub/workspace' },
  { publicPath: '/home', internalPath: '/hub' },
  { publicPath: '/systems', internalPath: '/hub/systems' },
  { publicPath: '/billing', internalPath: '/hub/billing' },
  { publicPath: '/support', internalPath: '/hub/support' },
  { publicPath: '/store', internalPath: '/hub/store' },
  { publicPath: '/portfolio', internalPath: '/hub/portofolio' },
  { publicPath: '/articles', internalPath: '/hub/artikel' },
  { publicPath: '/faq', internalPath: '/hub/faq' },
  { publicPath: '/commitment', internalPath: '/hub/komitmen' },
  { publicPath: '/onboarding/stock', internalPath: '/hub/onboarding/stock' },
  { publicPath: '/onboarding/verify', internalPath: '/hub/onboarding/verify' },
  { publicPath: '/onboarding/status', internalPath: '/hub/onboarding/status' },
] as const

export const HUB_SECTION_ROUTES = [
  { path: '/hub/systems', view: 'systems' },
  { path: '/hub/billing', view: 'billing' },
  { path: '/hub/support', view: 'support' },
] as const

/** Match the framework's HTTP host condition even behind an internal server URL. */
export function hubRequestHostname(urlHostname: string, hostHeader?: string | null): string {
  return hostHeader && /^hub\.webzoka\.com(?::[0-9]{1,5})?$/i.test(hostHeader)
    ? HUB_PUBLIC_HOST
    : urlHostname.toLowerCase()
}

export function internalHubPath(pathname: string, hostname: string): string {
  if (hostname !== HUB_PUBLIC_HOST) return pathname
  const route = HUB_PUBLIC_ROUTES.find(candidate => candidate.publicPath === pathname)
  if (route) return route.internalPath
  if (/^\/articles\/[^/]+$/.test(pathname)) return pathname.replace('/articles/', '/hub/artikel/')
  return pathname
}

export function publicHubPath(pathname: string, hostname: string): string {
  if (hostname !== HUB_PUBLIC_HOST) return pathname
  const route = HUB_PUBLIC_ROUTES.find(candidate => candidate.internalPath === pathname && candidate.publicPath !== '/')
  if (route) return route.publicPath
  if (/^\/hub\/artikel\/[^/]+$/.test(pathname)) return pathname.replace('/hub/artikel/', '/articles/')
  return pathname
}

/** Remove only redundant navigation state, preserving callback and continuation selectors. */
export function canonicalHubUrl(input: URL, migration?: {
  production: boolean; configuredOrigin?: string; method?: string;
}): URL | null {
  const result = new URL(input)
  // Keep protocol origins and in-flight callbacks stable. Only known customer
  // GET/HEAD links migrate after the exact Production application URL is enabled.
  if (migration?.production && migration.configuredOrigin === HUB_PUBLIC_ORIGIN &&
      ['GET', 'HEAD'].includes(migration.method ?? 'GET') &&
      ['ja-superadmin-platform.vercel.app', 'superadmin.webzoka.com'].includes(input.hostname) &&
      publicHubPath(input.pathname, HUB_PUBLIC_HOST) !== input.pathname) {
    result.protocol = 'https:'
    result.hostname = HUB_PUBLIC_HOST
    result.port = ''
  }
  const internalPath = internalHubPath(result.pathname, result.hostname)
  if (internalPath === '/hub' && input.searchParams.getAll('view').length === 1) {
    const view = input.searchParams.get('view')
    const section = HUB_SECTION_ROUTES.find(candidate => candidate.view === view)
    if (section || view === 'store' || view === 'home') {
      result.pathname = section?.path ?? (view === 'store' ? '/hub/store' : '/hub')
      result.searchParams.delete('view')
    }
  }
  if (internalPath === '/hub/login' && input.searchParams.getAll('next').length === 1 &&
      input.searchParams.get('next') === '/hub/account') result.searchParams.delete('next')
  result.pathname = publicHubPath(result.pathname, result.hostname)
  return result.href === input.href ? null : result
}
