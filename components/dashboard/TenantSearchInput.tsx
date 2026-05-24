'use client'

export function TenantSearchInput({ defaultValue, buildUrl }: {
  defaultValue: string
  buildUrl: (q: string) => string
}) {
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
