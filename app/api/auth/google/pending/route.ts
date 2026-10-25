import { GOOGLE_DEV_ORIGIN, GOOGLE_DEV_PATH, googleDevConfig, googleDevRequest } from '@/lib/google-oauth-dev'
import { clearGoogleDevCookies, createGoogleDevClient } from '@/lib/supabase/google-dev'

export const dynamic = 'force-dynamic'

// Static response: no identity/token interpolation, legacy schema reads or business links.
const pendingScreen = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><title>Akses perusahaan belum tersedia | Webzoka</title>
<style>
:root{font-family:Arial,sans-serif;color:#10213f;background:#f5f7fb;color-scheme:light}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px 16px calc(24px + env(safe-area-inset-bottom))}
main{width:100%;max-width:480px;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;overflow-wrap:anywhere}
h1{font-size:24px;line-height:1.25;text-wrap:balance;margin:16px 0}p{font-size:16px;line-height:1.6;margin:16px 0}.brand{font-weight:700}
button{width:100%;min-height:48px;margin-top:8px;padding:12px 16px;border:1px solid #1769e0;border-radius:8px;background:#1769e0;color:white;font:inherit;cursor:pointer;touch-action:manipulation;transition:background-color 160ms ease}
button:hover,button:active{background:#0d4fb5}button:focus-visible{outline:3px solid #10213f;outline-offset:4px}
@media(min-width:768px){main{padding:32px}h1{font-size:32px}}@media(prefers-reduced-motion:reduce){button{transition:none}}
</style></head><body><main><p class="brand" translate="no">webzoka</p>
<h1>Akses perusahaan belum tersedia</h1>
<p>Anda sudah masuk dengan Google. Keanggotaan perusahaan Anda belum diverifikasi.</p>
<p>Halaman ini tidak memberikan akses ke sistem, langganan, atau tagihan perusahaan. Pembuatan workspace belum tersedia.</p>
<form method="post" action="${GOOGLE_DEV_PATH}/logout"><button type="submit">Keluar dari sesi uji</button></form>
</main></body></html>`

export async function GET(request: Request) {
  const config = googleDevConfig(process.env)
  if (!config || !googleDevRequest(request, 'pending') || new URL(request.url).search) {
    return new Response('Google DEV login is unavailable.', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const db = await createGoogleDevClient(config)
    const { data, error } = await db.auth.getUser()
    if (error || !data.user || data.user.is_anonymous ||
      !data.user.identities?.some((identity) => identity.provider === 'google')) {
      throw new Error('DEV Google session unavailable')
    }
    return new Response(pendingScreen, { headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    } })
  } catch {
    await clearGoogleDevCookies()
    return new Response(null, { status: 303, headers: {
      Location: `${GOOGLE_DEV_ORIGIN}/hub/login?message=google_dev_failed`, 'Cache-Control': 'no-store',
    } })
  }
}
