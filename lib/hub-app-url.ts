export function hubAppUrl() {
  const configured = process.env.WEBZOKA_HUB_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (!configured) throw new Error('Hub application URL is not configured')

  const url = new URL(configured)
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !local) {
    throw new Error('Hub application URL must use HTTPS')
  }

  return url.origin
}
