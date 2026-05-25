'use client'

export function TenantSearchInput({ defaultValue, platform, status }: {
  defaultValue: string
  platform: string
  status: string
}) {
  function buildUrl(q: string) {
    const params = { platform, status, q, page: '1' }
    const qs = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    return `/dashboard/tenants${qs ? `?${qs}` : ''}`
  }

  return (
    <input
      type="text"
      defaultValue={defaultValue}
      placeholder="Cari nama / slug..."
      className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-lg px-3 py-2 w-56 focus:outline-none focus:border-zinc-600 placeholder-zinc-600"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          window.location.href = buildUrl((e.target as HTMLInputElement).value)
        }
      }}
    />
  )
}
