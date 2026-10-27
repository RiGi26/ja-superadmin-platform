// Exact local signup successors. Historical manifests and source pins remain unchanged.
// These comparisons validate source scope; they do not grant runtime or release authority.
import assert from 'node:assert/strict'

const deltas = {
  "proxy.ts": [
    [
      "  const isHubLogin = pathname === '/hub/login' || pathname === '/hub/forgot-password'",
      "  const isHubLogin = pathname === '/hub/login' || pathname === '/hub/forgot-password' || pathname === '/hub/signup'"
    ],
    [
      "if (isOAuthConsent || pathname === '/hub/workspace') {",
      "if (isOAuthConsent || pathname === '/hub/workspace' || pathname === '/hub/account') {"
    ]
  ],
  "app/auth/callback/route.ts": [
    [
      "import { createClient } from '@/lib/supabase/server'",
      "import { createClient } from '@/lib/supabase/server'\nimport { finishHubRegistration } from '@/lib/hub-registration'"
    ],
    [
      "  const requestUrl = new URL(request.url)",
      "  const requestUrl = new URL(request.url)\n  if (requestUrl.searchParams.get('flow') === 'signup') return finishHubRegistration(request)"
    ]
  ],
  "app/hub/actions.ts": [
    [
      "  if (claims.user_role === 'superadmin') redirect('/dashboard')\n  redirect('/hub')",
      "  if (claims.user_role === 'superadmin') redirect('/dashboard')\n  redirect('/hub/account')"
    ]
  ],
  "app/hub/login/HubLoginForm.tsx": [
    [
      "          Setelah masuk, Anda akan kembali ke proses penyambungan sistem.",
      "          Setelah masuk, Anda akan kembali ke halaman yang dituju."
    ]
  ],
  "app/hub/login/page.tsx": [
    [
      "  if (data?.claims?.sub) redirect(next ?? '/hub')",
      "  let invalidSession = false\n  if (data?.claims?.sub) {\n    const identity = await db.auth.getUser().catch(() => null)\n    const user = identity?.data.user\n    if (!identity?.error && user?.email && user.email_confirmed_at && !user.is_anonymous && user.id === data.claims.sub) {\n      redirect(next ?? (data.claims.user_role === 'superadmin' ? '/dashboard' : '/hub/account'))\n    }\n    invalidSession = true\n  }"
    ],
    [
      "          <HubLoginForm next={next} />",
      "          {invalidSession ? <p className={styles.formError} role=\"alert\">Sesi belum dapat diverifikasi. Verifikasi email Anda atau masuk kembali.</p> : null}\n          <HubLoginForm next={next} />"
    ],
    [
      "          <p className={styles.loginHelp}><Link href=\"/hub/workspace\">Buat workspace usaha gratis</Link></p>",
      "          <p className={styles.loginHelp}><Link className={styles.loginSecondaryLink} href=\"/hub/signup\">Buat akun Customer Hub gratis</Link></p>"
    ]
  ],
  "lib/hub-return-path.ts": [
    [
      "    const parsed = new URL(value, 'https://www.webzoka.com')\n    if (parsed.origin === 'https://www.webzoka.com' && parsed.pathname === '/hub/workspace'",
      "    const parsed = new URL(value, 'https://www.webzoka.com')\n    if (parsed.origin === 'https://www.webzoka.com' && parsed.pathname === '/hub/account' && !parsed.search && !parsed.hash) {\n      return '/hub/account'\n    }\n    if (parsed.origin === 'https://www.webzoka.com' && parsed.pathname === '/hub/workspace'"
    ]
  ],
  "app/hub/_public/PublicExploreNav.tsx": [
    [
      "<Link className={styles.publicHubButton} href=\"/hub\">",
      "<Link className={styles.publicHubButton} href=\"/hub/account\">"
    ],
    [
      "<Link className={styles.publicMobileHubLink} href=\"/hub\">Customer Hub</Link>",
      "<Link className={styles.publicMobileHubLink} href=\"/hub/account\">Customer Hub</Link>"
    ]
  ],
  "app/hub/_public/PublicExploreContent.tsx": [
    [
      "<Link className={styles.publicPrimaryButton} href=\"/hub\">",
      "<Link className={styles.publicPrimaryButton} href=\"/hub/account\">"
    ]
  ],
  "lib/hub-integration-contract.mjs": [
    [
      "import assert from 'node:assert/strict'",
      "import assert from 'node:assert/strict'\nimport { historicalSignupSource, signupCandidateSource } from './hub-signup-source-contract.mjs'"
    ],
    [
      "    return replace(execFileSync('git', ['-C', root, 'show', `${main}:${file}`], { encoding: 'utf8' }).replaceAll('\\r\\n', '\\n'),\n      'if (isOAuthConsent) {', \"if (isOAuthConsent || pathname === '/hub/workspace') {\")",
      "    return signupCandidateSource(file, replace(execFileSync('git', ['-C', root, 'show', `${main}:${file}`], { encoding: 'utf8' }).replaceAll('\\r\\n', '\\n'),\n      'if (isOAuthConsent) {', \"if (isOAuthConsent || pathname === '/hub/workspace') {\"))"
    ],
    [
      "assert.equal(createHash('sha256').update(text).digest('hex'), firstPurchasePins[file], file)",
      "assert.equal(createHash('sha256').update(historicalSignupSource(file, text)).digest('hex'), firstPurchasePins[file], file)"
    ]
  ],
  "lib/e1-workspace.test.mjs": [
    [
      "import { approvedHubSource } from './hub-integration-contract.mjs'",
      "import { approvedHubSource } from './hub-integration-contract.mjs'\nimport { signupCandidateSource } from './hub-signup-source-contract.mjs'"
    ],
    [
      "  // Step 3 allows only preservation of the workspace return path on login.\n  assert.equal(read('proxy.ts'), baselineSource('proxy.ts').replace('if (isOAuthConsent) {',\n    \"if (isOAuthConsent || pathname === '/hub/workspace') {\"))",
      "  // Preserve Step 3 and the exact account-only signup entry additions.\n  assert.equal(read('proxy.ts'), signupCandidateSource('proxy.ts', baselineSource('proxy.ts').replace('if (isOAuthConsent) {',\n    \"if (isOAuthConsent || pathname === '/hub/workspace') {\")))"
    ]
  ],
  "lib/google-oauth-dev.test.mjs": [
    [
      "import { approvedHubSource } from './hub-integration-contract.mjs'",
      "import { approvedHubSource } from './hub-integration-contract.mjs'\nimport { signupCandidateSource } from './hub-signup-source-contract.mjs'"
    ],
    [
      ": execFileSync('git', ['-C', root, 'show', `${baseline}:${path}`], { encoding: 'utf8' }).replaceAll('\\r\\n', '\\n')",
      ": signupCandidateSource(path, execFileSync('git', ['-C', root, 'show', `${baseline}:${path}`], { encoding: 'utf8' }).replaceAll('\\r\\n', '\\n'))"
    ]
  ],
  "lib/core-registry-native.test.mjs": [
    [
      "import assert from 'node:assert/strict'",
      "import assert from 'node:assert/strict'\nimport { signupHistoricalBytes } from './hub-signup-source-contract.mjs'"
    ],
    [
      "  for (const [path, expected] of entries) {\n    const source = readFileSync(join(root, path))",
      "  for (const [path, expected] of entries) {\n    const source = signupHistoricalBytes(path, readFileSync(join(root, path)))"
    ]
  ]
}

export const signupSourcePaths = Object.freeze(Object.keys(deltas))
const lf = value => value.replaceAll('\r\n', '\n')
function replaceOnce(text, before, after, file) {
  assert.equal(text.split(before).length, 2, 'Exact signup source anchor: ' + file)
  return text.replace(before, after)
}
export function signupCandidateSource(file, historical) {
  if (!deltas[file]) return historical
  return deltas[file].reduce((text, [before, after]) => replaceOnce(text, before, after, file), lf(historical))
}
export function historicalSignupSource(file, candidate) {
  if (!deltas[file]) return candidate
  return [...deltas[file]].reverse().reduce((text, [before, after]) => replaceOnce(text, after, before, file), lf(candidate))
}
export function signupHistoricalBytes(file, bytes) {
  return deltas[file] ? Buffer.from(historicalSignupSource(file, bytes.toString('utf8'))) : bytes
}
