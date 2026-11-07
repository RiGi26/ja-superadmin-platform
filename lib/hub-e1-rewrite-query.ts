/** Next.js host-matched rewrites append their matched host to searchParams.
 * Remove only that exact routing value on the actual canonical Hub host.
 * Ownership, identity, and authorization selectors retain their strict codecs.
 */
export function hubE1RewriteQuery(
  query: Record<string, string | string[] | undefined>,
  requestHost: string | null,
): Record<string, string | string[] | undefined> {
  if (requestHost?.toLowerCase() !== 'hub.webzoka.com' || query.host !== 'hub.webzoka.com') return query
  return Object.fromEntries(Object.entries(query).filter(([key]) => key !== 'host'))
}
