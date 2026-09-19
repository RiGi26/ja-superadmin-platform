import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Customer Hub | Webzoka',
  description: 'Kelola sistem, paket, dan tagihan Webzoka dari satu tempat.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f5f7fb',
}

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return children
}
