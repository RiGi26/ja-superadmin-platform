import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // This repo lives inside a multi-repo umbrella that also has a lockfile.
  // Pin Turbopack here so public assets and module tracing use this app root.
  turbopack: {
    root: process.cwd(),
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
