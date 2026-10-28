import type { NextConfig } from "next";
import { HUB_PUBLIC_HOST, HUB_PUBLIC_ROUTES, HUB_SECTION_ROUTES } from './lib/hub-navigation'

const nextConfig: NextConfig = {
  devIndicators: false,
  // This repo lives inside a multi-repo umbrella that also has a lockfile.
  // Pin Turbopack here so public assets and module tracing use this app root.
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return {
      beforeFiles: [
        ...HUB_PUBLIC_ROUTES.map(({ publicPath, internalPath }) => ({
          source: publicPath,
          destination: internalPath,
          has: [{ type: 'host' as const, value: HUB_PUBLIC_HOST.replaceAll('.', '\\.') }],
        })),
        {
          source: '/articles/:slug',
          destination: '/hub/artikel/:slug',
          has: [{ type: 'host' as const, value: HUB_PUBLIC_HOST.replaceAll('.', '\\.') }],
        },
        ...HUB_SECTION_ROUTES.map(({ path, view }) => ({
          source: path,
          destination: `/hub?view=${view}`,
        })),
      ],
    }
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      ],
    }]
  },
};

export default nextConfig;
