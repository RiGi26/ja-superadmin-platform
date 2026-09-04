import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Check, ShieldCheck, Warehouse } from 'lucide-react'
import { normalizeAuthorizationId } from '@/lib/hub-return-path'
import { createClient } from '@/lib/supabase/server'
import { approveWebzokaAuthorization, denyWebzokaAuthorization } from './actions'
import styles from '../../hub/hub.module.css'

type ConsentDetails = {
  authorization_id: string
  redirect_uri: string
  client: { name: string }
  user: { email: string }
  scope: string
}

const SCOPE_COPY: Record<string, string> = {
  openid: 'Konfirmasi identitas akun Webzoka Anda',
  email: 'Bagikan alamat email terverifikasi',
  profile: 'Bagikan informasi profil dasar',
}

function destinationHost(value: string) {
  try {
    return new URL(value).hostname
  } catch {
    return 'sistem Webzoka'
  }
}

function ConsentError() {
  return (
    <main className={styles.oauthPage}>
      <section className={styles.oauthCard}>
        <span className={styles.oauthMark}><ShieldCheck aria-hidden="true" /></span>
        <p className={styles.eyebrow}>Webzoka SSO</p>
        <h1>Permintaan akses tidak tersedia</h1>
        <p>Mulai kembali dari Customer Hub, lalu buka Webzoka Stock dari Sistem Saya.</p>
        <Link className={styles.oauthPrimaryButton} href="/hub?view=systems" prefetch={false}>
          Kembali ke Customer Hub <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    </main>
  )
}

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; error?: string; preview?: string }>
}) {
  const query = await searchParams
  const previewMode =
    process.env.HUB_SSO_PREVIEW_MODE === 'true' &&
    query.preview === '1'

  let details: ConsentDetails | null = null

  if (previewMode) {
    details = {
      authorization_id: 'preview-authorization',
      redirect_uri: 'https://stock.webzoka.com/auth/callback',
      client: { name: 'Webzoka Stock' },
      user: { email: 'pelanggan@webzoka.com' },
      scope: 'openid email profile',
    }
  } else {
    const authorizationId = normalizeAuthorizationId(query.authorization_id)
    if (!authorizationId || query.error) return <ConsentError />

    const db = await createClient()
    const { data: claimsData } = await db.auth.getClaims()
    if (!claimsData?.claims?.sub) {
      const next = `/oauth/consent?${new URLSearchParams({ authorization_id: authorizationId })}`
      redirect(`/hub/login?${new URLSearchParams({ next })}`)
    }

    const { data, error } = await db.auth.oauth.getAuthorizationDetails(authorizationId)
    if (error || !data) return <ConsentError />
    if (!('authorization_id' in data)) redirect(data.redirect_url)
    details = data
  }

  const scopes = details.scope.split(' ').filter(Boolean)

  return (
    <main className={styles.oauthPage}>
      <section className={styles.oauthCard} aria-labelledby="oauth-title">
        <Link
          className={styles.oauthBrand}
          href="/hub"
          aria-label="Webzoka Customer Hub"
          prefetch={false}
        >
          <Image src="/logo-rocket.png" alt="" width={38} height={35} priority unoptimized />
          <span translate="no">webzoka</span>
        </Link>

        {previewMode ? <p className={styles.oauthPreview}>Pratinjau tampilan SSO</p> : null}
        <div className={styles.oauthConnection} aria-hidden="true">
          <span><ShieldCheck /></span>
          <i />
          <span><Warehouse /></span>
        </div>

        <p className={styles.eyebrow}>Webzoka SSO</p>
        <h1 id="oauth-title">Hubungkan {details.client.name}</h1>
        <p className={styles.oauthIntro}>
          Lanjutkan sebagai <strong>{details.user.email}</strong>. Kata sandi Anda tetap di
          Customer Hub dan tidak dibagikan ke Stock.
        </p>

        <div className={styles.oauthPermissionBox}>
          <div>
            <span>Aplikasi</span>
            <strong>{details.client.name}</strong>
          </div>
          <div>
            <span>Tujuan</span>
            <strong translate="no">{destinationHost(details.redirect_uri)}</strong>
          </div>
          <ul>
            {scopes.map((scope) => (
              <li key={scope}>
                <Check aria-hidden="true" />
                {SCOPE_COPY[scope] ?? `Izinkan akses ${scope}`}
              </li>
            ))}
          </ul>
        </div>

        {previewMode ? (
          <div className={styles.oauthActions}>
            <Link className={styles.oauthPrimaryButton} href="/hub?view=systems" prefetch={false}>
              Lanjut ke Webzoka Stock <ArrowRight aria-hidden="true" />
            </Link>
            <Link className={styles.oauthSecondaryButton} href="/hub?view=systems" prefetch={false}>
              Batal
            </Link>
          </div>
        ) : (
          <div className={styles.oauthActions}>
            <form action={approveWebzokaAuthorization}>
              <input type="hidden" name="authorization_id" value={details.authorization_id} />
              <button className={styles.oauthPrimaryButton} type="submit">
                Lanjut ke Webzoka Stock <ArrowRight aria-hidden="true" />
              </button>
            </form>
            <form action={denyWebzokaAuthorization}>
              <input type="hidden" name="authorization_id" value={details.authorization_id} />
              <button className={styles.oauthSecondaryButton} type="submit">Batal</button>
            </form>
          </div>
        )}

        <p className={styles.oauthFootnote}>
          Stock tetap memakai peran dan hak akses bisnis yang sudah tersimpan.
        </p>
      </section>
    </main>
  )
}
