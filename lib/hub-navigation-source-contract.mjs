// Exact navigation successor deltas over Core main 51a1c84 (approved login polish).
// Historical signup/security contracts and their original hashes remain intact.
// Removing these exact navigation deltas must recover the approved source.
import assert from 'node:assert/strict'

const deltas = {
  "app/hub/_components/HubShell.tsx": [
    [
      "\nconst NAV: HubNavItem[] = [\n  { id: 'home', label: 'Beranda', icon: Home, href: '/hub' },\n  { id: 'systems', label: 'Sistem Saya', icon: LayoutGrid, href: '/hub?view=systems' },\n  { id: 'store', label: 'Store', icon: ShoppingBag, href: '/hub/store' },\n  { id: 'billing', label: 'Tagihan', icon: ReceiptText, href: '/hub?view=billing' },\n  { id: 'support', label: 'Bantuan', icon: CircleHelp, href: '/hub?view=support' },\n]\n\nconst STATUS_LABEL: Record<string, string> = {\n",
      "\nconst NAV: HubNavItem[] = [\n  { id: 'home', label: 'Beranda', icon: Home, href: '/hub' },\n  { id: 'systems', label: 'Sistem Saya', icon: LayoutGrid, href: '/hub/systems' },\n  { id: 'store', label: 'Store', icon: ShoppingBag, href: '/hub/store' },\n  { id: 'billing', label: 'Tagihan', icon: ReceiptText, href: '/hub/billing' },\n  { id: 'support', label: 'Bantuan', icon: CircleHelp, href: '/hub/support' },\n]\n\nconst STATUS_LABEL: Record<string, string> = {\n"
    ],
    [
      "            ? 'Akun Anda belum memiliki keanggotaan aktif untuk sistem yang terdaftar.'\n            : 'Kami belum dapat memverifikasi keanggotaan Anda. Muat ulang halaman atau hubungi bantuan.'}</p>\n        </div>\n        <Link className={styles.secondaryButton} href=\"/hub?view=support\">Hubungi bantuan</Link>\n      </section>\n    )\n  }\n",
      "            ? 'Akun Anda belum memiliki keanggotaan aktif untuk sistem yang terdaftar.'\n            : 'Kami belum dapat memverifikasi keanggotaan Anda. Muat ulang halaman atau hubungi bantuan.'}</p>\n        </div>\n        <Link className={styles.secondaryButton} href=\"/hub/support\">Hubungi bantuan</Link>\n      </section>\n    )\n  }\n"
    ],
    [
      "            <p className={styles.sectionKicker}>Keanggotaan aktif</p>\n            <h2>Sistem Saya</h2>\n          </div>\n          <Link href=\"/hub?view=systems\" className={styles.textLink}>\n            Lihat detail <ArrowRight aria-hidden=\"true\" />\n          </Link>\n        </div>\n",
      "            <p className={styles.sectionKicker}>Keanggotaan aktif</p>\n            <h2>Sistem Saya</h2>\n          </div>\n          <Link href=\"/hub/systems\" className={styles.textLink}>\n            Lihat detail <ArrowRight aria-hidden=\"true\" />\n          </Link>\n        </div>\n"
    ],
    [
      "          <span><strong>Jelajahi Webzoka Store</strong><small>Lihat paket dan solusi bisnis lainnya.</small></span>\n          <ChevronRight aria-hidden=\"true\" />\n        </Link>\n        <Link href=\"/hub?view=billing\" className={styles.actionRow}>\n          <span className={styles.actionIcon}><CreditCard aria-hidden=\"true\" /></span>\n          <span><strong>Kelola langganan</strong><small>Periksa periode aktif dan riwayat pembayaran.</small></span>\n          <ChevronRight aria-hidden=\"true\" />\n        </Link>\n        <Link href=\"/hub?view=support\" className={styles.actionRow}>\n          <span className={styles.actionIcon}><MessageCircle aria-hidden=\"true\" /></span>\n          <span><strong>Butuh bantuan?</strong><small>Hubungi tim Webzoka melalui jalur resmi.</small></span>\n          <ChevronRight aria-hidden=\"true\" />\n",
      "          <span><strong>Jelajahi Webzoka Store</strong><small>Lihat paket dan solusi bisnis lainnya.</small></span>\n          <ChevronRight aria-hidden=\"true\" />\n        </Link>\n        <Link href=\"/hub/billing\" className={styles.actionRow}>\n          <span className={styles.actionIcon}><CreditCard aria-hidden=\"true\" /></span>\n          <span><strong>Kelola langganan</strong><small>Periksa periode aktif dan riwayat pembayaran.</small></span>\n          <ChevronRight aria-hidden=\"true\" />\n        </Link>\n        <Link href=\"/hub/support\" className={styles.actionRow}>\n          <span className={styles.actionIcon}><MessageCircle aria-hidden=\"true\" /></span>\n          <span><strong>Butuh bantuan?</strong><small>Hubungi tim Webzoka melalui jalur resmi.</small></span>\n          <ChevronRight aria-hidden=\"true\" />\n"
    ]
  ],
  "app/hub/_public/PublicExploreContent.tsx": [
    [
      "        <h2>{title}</h2>\n        <p>{description}</p>\n      </div>\n      <Link className={styles.publicPrimaryButton} href=\"/hub/account\">\n        Buka Customer Hub <ArrowRight aria-hidden=\"true\" />\n      </Link>\n    </section>\n",
      "        <h2>{title}</h2>\n        <p>{description}</p>\n      </div>\n      <Link className={styles.publicPrimaryButton} href=\"/hub/login\">\n        Buka Customer Hub <ArrowRight aria-hidden=\"true\" />\n      </Link>\n    </section>\n"
    ]
  ],
  "app/hub/_public/PublicExploreNav.tsx": [
    [
      "        </nav>\n        <div className={styles.publicSidebarFooter}>\n          <a href=\"https://www.webzoka.com\">Webzoka.com <ArrowRight aria-hidden=\"true\" /></a>\n          <Link className={styles.publicHubButton} href=\"/hub/account\">\n            Buka Customer Hub <ArrowRight aria-hidden=\"true\" />\n          </Link>\n        </div>\n",
      "        </nav>\n        <div className={styles.publicSidebarFooter}>\n          <a href=\"https://www.webzoka.com\">Webzoka.com <ArrowRight aria-hidden=\"true\" /></a>\n          <Link className={styles.publicHubButton} href=\"/hub/login\">\n            Buka Customer Hub <ArrowRight aria-hidden=\"true\" />\n          </Link>\n        </div>\n"
    ],
    [
      "          <span translate=\"no\">webzoka</span>\n        </Link>\n        <div className={styles.publicMobileActions}>\n          <Link className={styles.publicMobileHubLink} href=\"/hub/account\">Customer Hub</Link>\n          <details className={styles.publicMenuDisclosure}>\n            <summary aria-label=\"Buka menu publik\">\n              <Menu aria-hidden=\"true\" />\n",
      "          <span translate=\"no\">webzoka</span>\n        </Link>\n        <div className={styles.publicMobileActions}>\n          <Link className={styles.publicMobileHubLink} href=\"/hub/login\">Customer Hub</Link>\n          <details className={styles.publicMenuDisclosure}>\n            <summary aria-label=\"Buka menu publik\">\n              <Menu aria-hidden=\"true\" />\n"
    ]
  ],
  "app/hub/account/actions.ts": [
    [
      "    await db.auth.signOut({ scope: 'local' })\n  } catch { /* Provider availability must not prevent local logout. */ }\n  await clearHubSessionCookies()\n  redirect('/hub/login?next=%2Fhub%2Faccount')\n}\n",
      "    await db.auth.signOut({ scope: 'local' })\n  } catch { /* Provider availability must not prevent local logout. */ }\n  await clearHubSessionCookies()\n  redirect('/hub/login')\n}\n"
    ]
  ],
  "app/hub/actions.ts": [
    [
      "  } catch {\n    // Existing engine owns invoice/payment recovery. Never retry a financial call here.\n  }\n  redirect(destination ?? '/hub?view=billing&purchase=failed')\n}\n",
      "  } catch {\n    // Existing engine owns invoice/payment recovery. Never retry a financial call here.\n  }\n  redirect(destination ?? '/hub/billing?purchase=failed')\n}\n"
    ]
  ],
  "app/hub/login/page.tsx": [
    [
      "        </div>\n        <footer className={styles.footer}>\n          <p>© {new Date().getFullYear()} Webzoka</p>\n          <a href=\"https://information.webzoka.com/kebijakan-privasi\">Kebijakan privasi</a>\n        </footer>\n      </main>\n    </div>\n",
      "        </div>\n        <footer className={styles.footer}>\n          <p>© {new Date().getFullYear()} Webzoka</p>\n          <a href=\"https://www.webzoka.com/privacy/\">Kebijakan privasi</a>\n        </footer>\n      </main>\n    </div>\n"
    ]
  ],
  "app/hub/onboarding/status/page.tsx": [
    [
      "\n          <div className={styles.buttonRow}>\n            {onboarding.status === 'ready' ? (\n              <Link className={styles.primaryLink} href=\"/hub?view=systems\">\n                Buka Customer Hub <ExternalLink aria-hidden=\"true\" />\n              </Link>\n            ) : null}\n",
      "\n          <div className={styles.buttonRow}>\n            {onboarding.status === 'ready' ? (\n              <Link className={styles.primaryLink} href=\"/hub/systems\">\n                Buka Customer Hub <ExternalLink aria-hidden=\"true\" />\n              </Link>\n            ) : null}\n"
    ]
  ],
  "app/hub/signup/HubSignupForm.tsx": [
    [
      "      <h3>Periksa email Anda</h3>\n      <p>{state.message}</p>\n      <p>Buka tautan verifikasi di browser yang Anda gunakan untuk mendaftar.</p>\n      <Link className={styles.primaryButton} href=\"/hub/login?next=%2Fhub%2Faccount\">Masuk setelah verifikasi <ArrowRight aria-hidden=\"true\" /></Link>\n      <a className={signup.link} href=\"/hub/signup\">Gunakan email lain</a>\n    </div>\n  )\n",
      "      <h3>Periksa email Anda</h3>\n      <p>{state.message}</p>\n      <p>Buka tautan verifikasi di browser yang Anda gunakan untuk mendaftar.</p>\n      <Link className={styles.primaryButton} href=\"/hub/login\">Masuk setelah verifikasi <ArrowRight aria-hidden=\"true\" /></Link>\n      <a className={signup.link} href=\"/hub/signup\">Gunakan email lain</a>\n    </div>\n  )\n"
    ]
  ],
  "app/hub/signup/page.tsx": [
    [
      "          <h1 className={signup.heading}>Buat akun gratis</h1>\n          <p className={styles.loginIntro}>Gunakan email yang Anda kelola. Tautan verifikasi akan dikirim ke email tersebut.</p>\n          <HubSignupForm verificationFailed={query.error === 'verification_failed'} />\n          <p className={styles.loginHelp}>Sudah punya akun? <Link className={signup.link} href=\"/hub/login?next=%2Fhub%2Faccount\">Masuk ke Customer Hub</Link></p>\n        </div>\n      </section>\n    </main>\n",
      "          <h1 className={signup.heading}>Buat akun gratis</h1>\n          <p className={styles.loginIntro}>Gunakan email yang Anda kelola. Tautan verifikasi akan dikirim ke email tersebut.</p>\n          <HubSignupForm verificationFailed={query.error === 'verification_failed'} />\n          <p className={styles.loginHelp}>Sudah punya akun? <Link className={signup.link} href=\"/hub/login\">Masuk ke Customer Hub</Link></p>\n        </div>\n      </section>\n    </main>\n"
    ]
  ],
  "app/oauth/consent/actions.ts": [
    [
      "  const authorizationId = normalizeAuthorizationId(\n    String(formData.get('authorization_id') ?? ''),\n  )\n  if (!authorizationId) redirect('/hub?view=systems')\n\n  const db = await createClient()\n  const { data, error } = await db.auth.oauth.approveAuthorization(authorizationId, {\n",
      "  const authorizationId = normalizeAuthorizationId(\n    String(formData.get('authorization_id') ?? ''),\n  )\n  if (!authorizationId) redirect('/hub/systems')\n\n  const db = await createClient()\n  const { data, error } = await db.auth.oauth.approveAuthorization(authorizationId, {\n"
    ],
    [
      "  const authorizationId = normalizeAuthorizationId(\n    String(formData.get('authorization_id') ?? ''),\n  )\n  if (!authorizationId) redirect('/hub?view=systems')\n\n  const db = await createClient()\n  const { data, error } = await db.auth.oauth.denyAuthorization(authorizationId, {\n",
      "  const authorizationId = normalizeAuthorizationId(\n    String(formData.get('authorization_id') ?? ''),\n  )\n  if (!authorizationId) redirect('/hub/systems')\n\n  const db = await createClient()\n  const { data, error } = await db.auth.oauth.denyAuthorization(authorizationId, {\n"
    ]
  ],
  "app/oauth/consent/page.tsx": [
    [
      "        <p className={styles.eyebrow}>Webzoka SSO</p>\n        <h1>Permintaan akses tidak tersedia</h1>\n        <p>Mulai kembali dari Customer Hub, lalu buka Webzoka Stock dari Sistem Saya.</p>\n        <Link className={styles.oauthPrimaryButton} href=\"/hub?view=systems\" prefetch={false}>\n          Kembali ke Customer Hub <ArrowRight aria-hidden=\"true\" />\n        </Link>\n      </section>\n",
      "        <p className={styles.eyebrow}>Webzoka SSO</p>\n        <h1>Permintaan akses tidak tersedia</h1>\n        <p>Mulai kembali dari Customer Hub, lalu buka Webzoka Stock dari Sistem Saya.</p>\n        <Link className={styles.oauthPrimaryButton} href=\"/hub/systems\" prefetch={false}>\n          Kembali ke Customer Hub <ArrowRight aria-hidden=\"true\" />\n        </Link>\n      </section>\n"
    ],
    [
      "\n        {previewMode ? (\n          <div className={styles.oauthActions}>\n            <Link className={styles.oauthPrimaryButton} href=\"/hub?view=systems\" prefetch={false}>\n              Lanjut ke Webzoka Stock <ArrowRight aria-hidden=\"true\" />\n            </Link>\n            <Link className={styles.oauthSecondaryButton} href=\"/hub?view=systems\" prefetch={false}>\n              Batal\n            </Link>\n          </div>\n",
      "\n        {previewMode ? (\n          <div className={styles.oauthActions}>\n            <Link className={styles.oauthPrimaryButton} href=\"/hub/systems\" prefetch={false}>\n              Lanjut ke Webzoka Stock <ArrowRight aria-hidden=\"true\" />\n            </Link>\n            <Link className={styles.oauthSecondaryButton} href=\"/hub/systems\" prefetch={false}>\n              Batal\n            </Link>\n          </div>\n"
    ]
  ],
  "lib/core-registry-native.test.mjs": [
    [
      "// Offline DAL behavior, audit verification and SQL source contracts. No live SQL/Auth.\nimport assert from 'node:assert/strict'\nimport { signupHistoricalBytes } from './hub-signup-source-contract.mjs'\nimport * as crypto from 'node:crypto'\nimport { readFileSync } from 'node:fs'\nimport { dirname, join } from 'node:path'\n",
      "// Offline DAL behavior, audit verification and SQL source contracts. No live SQL/Auth.\nimport assert from 'node:assert/strict'\nimport { signupHistoricalBytes } from './hub-signup-source-contract.mjs'\nimport { historicalNavigationBytes } from './hub-navigation-source-contract.mjs'\nimport * as crypto from 'node:crypto'\nimport { readFileSync } from 'node:fs'\nimport { dirname, join } from 'node:path'\n"
    ],
    [
      "    'lib/supabase/server.ts', 'lib/supabase/admin.ts', docs + '008_supabase_native_registry.PROPOSED.sql',\n    docs + '009_supabase_native_recovery.PROPOSED.sql', docs + 'SUPABASE_NATIVE_DEV_PACKAGE.md']) assert.ok(entries.has(path), path)\n  for (const [path, expected] of entries) {\n    const source = signupHistoricalBytes(path, readFileSync(join(root, path)))\n    if (digest(source) === expected) continue\n    // Git normalizes text line endings on export. Both manifests pin exact bytes;\n    // this fallback accepts only the separately recorded Git representation.\n",
      "    'lib/supabase/server.ts', 'lib/supabase/admin.ts', docs + '008_supabase_native_registry.PROPOSED.sql',\n    docs + '009_supabase_native_recovery.PROPOSED.sql', docs + 'SUPABASE_NATIVE_DEV_PACKAGE.md']) assert.ok(entries.has(path), path)\n  for (const [path, expected] of entries) {\n    const source = signupHistoricalBytes(path, historicalNavigationBytes(path, readFileSync(join(root, path))))\n    if (digest(source) === expected) continue\n    // Git normalizes text line endings on export. Both manifests pin exact bytes;\n    // this fallback accepts only the separately recorded Git representation.\n"
    ]
  ],
  "lib/e1-stock-transport-proxy.test.mjs": [
    [
      "const endpoint = '/api/auth/e1/stock/quarantine'\nfunction harness() {\n  const calls = [], mod = { exports: {} }\n  const source = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')\n  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {\n    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,\n",
      "const endpoint = '/api/auth/e1/stock/quarantine'\nfunction harness() {\n  const calls = [], mod = { exports: {} }\n  const navigation = { exports: {} }\n  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./hub-navigation.ts', import.meta.url), 'utf8'), {\n    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },\n  }).outputText, { module: navigation, exports: navigation.exports, URL })\n  const source = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')\n  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {\n    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,\n"
    ],
    [
      "      rewrite: url => ({ kind: 'rewrite', url: String(url) }),\n    } }\n    if (name === '@/lib/superadmin') return { isSuperadminEmail: () => false }\n    if (name === '@supabase/ssr') return { createServerClient() {\n      calls.push('cookie-client')\n      return { auth: { getClaims: async () => { calls.push('cookie-claims'); return { data: { claims: null } } } } }\n",
      "      rewrite: url => ({ kind: 'rewrite', url: String(url) }),\n    } }\n    if (name === '@/lib/superadmin') return { isSuperadminEmail: () => false }\n    if (name === '@/lib/hub-navigation') return navigation.exports\n    if (name === '@supabase/ssr') return { createServerClient() {\n      calls.push('cookie-client')\n      return { auth: { getClaims: async () => { calls.push('cookie-claims'); return { data: { claims: null } } } } }\n"
    ]
  ],
  "lib/e1-workspace.test.mjs": [
    [
      "import ts from 'typescript'\nimport { approvedHubSource } from './hub-integration-contract.mjs'\nimport { signupCandidateSource } from './hub-signup-source-contract.mjs'\n\nconst root = join(dirname(fileURLToPath(import.meta.url)), '..')\nconst baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'\n",
      "import ts from 'typescript'\nimport { approvedHubSource } from './hub-integration-contract.mjs'\nimport { signupCandidateSource } from './hub-signup-source-contract.mjs'\nimport { navigationCandidateSource } from './hub-navigation-source-contract.mjs'\n\nconst root = join(dirname(fileURLToPath(import.meta.url)), '..')\nconst baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'\n"
    ],
    [
      "function assertPreservedHubContract(read) {\n  for (const file of frozenLegacyFiles) assertFrozenOrSecurityDependency(file, read(file), baselineSource(file))\n  // Preserve Step 3 and the exact account-only signup entry additions.\n  assert.equal(read('proxy.ts'), signupCandidateSource('proxy.ts', baselineSource('proxy.ts').replace('if (isOAuthConsent) {',\n    \"if (isOAuthConsent || pathname === '/hub/workspace') {\")))\n  for (const file of ['app/hub/page.tsx', 'app/hub/actions.ts', 'lib/hub-data.ts', 'lib/billing.ts']) {\n    assert.equal(read(file), approvedHubSource(file), file)\n  }\n",
      "function assertPreservedHubContract(read) {\n  for (const file of frozenLegacyFiles) assertFrozenOrSecurityDependency(file, read(file), baselineSource(file))\n  // Preserve Step 3 and the exact account-only signup entry additions.\n  assert.equal(read('proxy.ts'), navigationCandidateSource('proxy.ts', signupCandidateSource('proxy.ts', baselineSource('proxy.ts').replace('if (isOAuthConsent) {',\n    \"if (isOAuthConsent || pathname === '/hub/workspace') {\"))))\n  for (const file of ['app/hub/page.tsx', 'app/hub/actions.ts', 'lib/hub-data.ts', 'lib/billing.ts']) {\n    assert.equal(read(file), approvedHubSource(file), file)\n  }\n"
    ]
  ],
  "lib/google-oauth-dev.test.mjs": [
    [
      "import { renderToStaticMarkup } from 'react-dom/server'\nimport { approvedHubSource } from './hub-integration-contract.mjs'\nimport { signupCandidateSource } from './hub-signup-source-contract.mjs'\n\nconst root = join(dirname(fileURLToPath(import.meta.url)), '..')\nconst baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'\n",
      "import { renderToStaticMarkup } from 'react-dom/server'\nimport { approvedHubSource } from './hub-integration-contract.mjs'\nimport { signupCandidateSource } from './hub-signup-source-contract.mjs'\nimport { navigationCandidateSource } from './hub-navigation-source-contract.mjs'\n\nconst root = join(dirname(fileURLToPath(import.meta.url)), '..')\nconst baseline = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'\n"
    ],
    [
      "      redirect: (url) => new Response(null, { status: 307, headers: { location: url.toString() } }),\n    } },\n    '@/lib/superadmin': { isSuperadminEmail: () => false },\n  }, environment())\n  for (const path of ['/hub', '/dashboard', '/oauth/consent?authorization_id=synthetic']) {\n    const url = `${origin}${path}`\n",
      "      redirect: (url) => new Response(null, { status: 307, headers: { location: url.toString() } }),\n    } },\n    '@/lib/superadmin': { isSuperadminEmail: () => false },\n    '@/lib/hub-navigation': load('lib/hub-navigation.ts'),\n  }, environment())\n  for (const path of ['/hub', '/dashboard', '/oauth/consent?authorization_id=synthetic']) {\n    const url = `${origin}${path}`\n"
    ],
    [
      "    'app/oauth/consent/actions.ts', 'proxy.ts', 'lib/hub-data.ts', 'app/hub/page.tsx', 'package.json', 'package-lock.json']) {\n    const expected = ['app/hub/actions.ts', 'lib/hub-data.ts', 'app/hub/page.tsx', 'proxy.ts', 'lib/hub-return-path.ts'].includes(path)\n      ? approvedHubSource(path)\n      : signupCandidateSource(path, execFileSync('git', ['-C', root, 'show', `${baseline}:${path}`], { encoding: 'utf8' }).replaceAll('\\r\\n', '\\n'))\n    assertFrozenOrSecurityDependency(path, source(path), expected)\n  }\n})\n",
      "    'app/oauth/consent/actions.ts', 'proxy.ts', 'lib/hub-data.ts', 'app/hub/page.tsx', 'package.json', 'package-lock.json']) {\n    const expected = ['app/hub/actions.ts', 'lib/hub-data.ts', 'app/hub/page.tsx', 'proxy.ts', 'lib/hub-return-path.ts'].includes(path)\n      ? approvedHubSource(path)\n      : navigationCandidateSource(path, signupCandidateSource(path, execFileSync('git', ['-C', root, 'show', `${baseline}:${path}`], { encoding: 'utf8' }).replaceAll('\\r\\n', '\\n')))\n    assertFrozenOrSecurityDependency(path, source(path), expected)\n  }\n})\n"
    ]
  ],
  "lib/hub-account.ts": [
    [
      "  const { data, error } = await db.auth.getUser().catch(() => ({ data: { user: null }, error: true }))\n  const user = data?.user\n  if (error || !user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous === true) {\n    redirect('/hub/login?next=%2Fhub%2Faccount')\n  }\n  // This own-membership read chooses the existing dashboard only. Its data is\n  // never copied into Company context, and failed reads do not grant access.\n",
      "  const { data, error } = await db.auth.getUser().catch(() => ({ data: { user: null }, error: true }))\n  const user = data?.user\n  if (error || !user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous === true) {\n    redirect('/hub/login')\n  }\n  // This own-membership read chooses the existing dashboard only. Its data is\n  // never copied into Company context, and failed reads do not grant access.\n"
    ]
  ],
  "lib/hub-integration-contract.mjs": [
    [
      "// Exact, reviewed source deltas for the local H1 integration. No runtime access.\nimport assert from 'node:assert/strict'\nimport { historicalSignupSource, signupCandidateSource } from './hub-signup-source-contract.mjs'\nimport { execFileSync } from 'node:child_process'\nimport { createHash } from 'node:crypto'\nimport { readFileSync } from 'node:fs'\n",
      "// Exact, reviewed source deltas for the local H1 integration. No runtime access.\nimport assert from 'node:assert/strict'\nimport { historicalSignupSource, signupCandidateSource } from './hub-signup-source-contract.mjs'\nimport { historicalNavigationSource, navigationCandidateSource } from './hub-navigation-source-contract.mjs'\nimport { execFileSync } from 'node:child_process'\nimport { createHash } from 'node:crypto'\nimport { readFileSync } from 'node:fs'\n"
    ],
    [
      "\nexport function approvedHubSource(file) {\n  if (file === 'proxy.ts') {\n    return signupCandidateSource(file, replace(execFileSync('git', ['-C', root, 'show', `${main}:${file}`], { encoding: 'utf8' }).replaceAll('\\r\\n', '\\n'),\n      'if (isOAuthConsent) {', \"if (isOAuthConsent || pathname === '/hub/workspace') {\"))\n  }\n  if (firstPurchasePins[file]) {\n    const text = readFileSync(join(root, file), 'utf8').replaceAll('\\r\\n', '\\n')\n    assert.equal(createHash('sha256').update(historicalSignupSource(file, text)).digest('hex'), firstPurchasePins[file], file)\n    return text\n  }\n  if (sources.has(file)) return sources.get(file)\n",
      "\nexport function approvedHubSource(file) {\n  if (file === 'proxy.ts') {\n    return navigationCandidateSource(file, signupCandidateSource(file, replace(execFileSync('git', ['-C', root, 'show', `${main}:${file}`], { encoding: 'utf8' }).replaceAll('\\r\\n', '\\n'),\n      'if (isOAuthConsent) {', \"if (isOAuthConsent || pathname === '/hub/workspace') {\")))\n  }\n  if (firstPurchasePins[file]) {\n    const text = readFileSync(join(root, file), 'utf8').replaceAll('\\r\\n', '\\n')\n    assert.equal(createHash('sha256').update(historicalSignupSource(file, historicalNavigationSource(file, text))).digest('hex'), firstPurchasePins[file], file)\n    return text\n  }\n  if (sources.has(file)) return sources.get(file)\n"
    ]
  ],
  "lib/hub-login-ui-source-contract.mjs": [
    [
      "// Exact presentation-only successors for the Owner-approved Customer Hub login.\n// Authentication actions, routing, historical manifests, and source pins stay intact.\nimport assert from 'node:assert/strict'\nimport { createHash } from 'node:crypto'\nimport { execFileSync } from 'node:child_process'\nimport { readFileSync } from 'node:fs'\n",
      "// Exact presentation-only successors for the Owner-approved Customer Hub login.\n// Authentication actions, routing, historical manifests, and source pins stay intact.\nimport assert from 'node:assert/strict'\nimport { historicalNavigationSource } from './hub-navigation-source-contract.mjs'\nimport { createHash } from 'node:crypto'\nimport { execFileSync } from 'node:child_process'\nimport { readFileSync } from 'node:fs'\n"
    ],
    [
      "function delta(file) {\n  if (!Object.hasOwn(candidates, file)) return null\n  const before = normalized(execFileSync('git', ['-C', root, 'show', `${baseline}:${file}`], { encoding: 'utf8' }))\n  const after = normalized(readFileSync(join(root, file), 'utf8'))\n  assert.equal(hash(after), candidates[file], 'Exact approved login UI source: ' + file)\n  return { before, after }\n}\n",
      "function delta(file) {\n  if (!Object.hasOwn(candidates, file)) return null\n  const before = normalized(execFileSync('git', ['-C', root, 'show', `${baseline}:${file}`], { encoding: 'utf8' }))\n  const after = historicalNavigationSource(file, normalized(readFileSync(join(root, file), 'utf8')))\n  assert.equal(hash(after), candidates[file], 'Exact approved login UI source: ' + file)\n  return { before, after }\n}\n"
    ]
  ],
  "lib/hub-registration.test.mjs": [
    [
      "    '@supabase/ssr': { createServerClient: () => { calls.push('auth'); return { auth: { getClaims: async () => ({ data: { claims: null } }) } } } },\n    'next/server': { NextResponse: { next: () => ({ status: 200 }), redirect: url => ({ status: 307, location: String(url) }) } },\n    '@/lib/superadmin': { isSuperadminEmail: () => false },\n  })\n  const request = path => ({ nextUrl: new URL('https://hub.example.test' + path), url: 'https://hub.example.test' + path, cookies: { getAll: () => [] } })\n  assert.equal((await proxy.proxy(request('/hub/signup'))).status, 200)\n",
      "    '@supabase/ssr': { createServerClient: () => { calls.push('auth'); return { auth: { getClaims: async () => ({ data: { claims: null } }) } } } },\n    'next/server': { NextResponse: { next: () => ({ status: 200 }), redirect: url => ({ status: 307, location: String(url) }) } },\n    '@/lib/superadmin': { isSuperadminEmail: () => false },\n    '@/lib/hub-navigation': loadFile('lib/hub-navigation.ts', {}),\n  })\n  const request = path => ({ nextUrl: new URL('https://hub.example.test' + path), url: 'https://hub.example.test' + path, cookies: { getAll: () => [] } })\n  assert.equal((await proxy.proxy(request('/hub/signup'))).status, 200)\n"
    ],
    [
      "test('account entry denies unverified identities and sends existing members to their dashboard', async () => {\n  const verified = { id: subject, email: 'customer@example.test', email_confirmed_at: 'confirmed' }\n  for (const [user, member, destination] of [\n    [null, null, '/hub/login?next=%2Fhub%2Faccount'],\n    [{ ...verified, email_confirmed_at: null }, null, '/hub/login?next=%2Fhub%2Faccount'],\n    [{ ...verified, is_anonymous: true }, null, '/hub/login?next=%2Fhub%2Faccount'],\n    [verified, { tenant_id: subject }, '/hub'],\n  ]) {\n    let reads = 0\n",
      "test('account entry denies unverified identities and sends existing members to their dashboard', async () => {\n  const verified = { id: subject, email: 'customer@example.test', email_confirmed_at: 'confirmed' }\n  for (const [user, member, destination] of [\n    [null, null, '/hub/login'],\n    [{ ...verified, email_confirmed_at: null }, null, '/hub/login'],\n    [{ ...verified, is_anonymous: true }, null, '/hub/login'],\n    [verified, { tenant_id: subject }, '/hub'],\n  ]) {\n    let reads = 0\n"
    ],
    [
      "    '@/lib/hub-session': { clearHubSessionCookies: async () => { calls.push('clearCookies') } },\n    '@/lib/supabase/server': { createClient: async () => ({ auth: { signOut: async input => { calls.push(plain(input)) } } }) },\n  })\n  await assert.rejects(api.logoutHubAccount(), /REDIRECT:\\/hub\\/login\\?next=%2Fhub%2Faccount/)\n  assert.deepEqual(calls, [{ scope: 'local' }, 'clearCookies'])\n})\n\n",
      "    '@/lib/hub-session': { clearHubSessionCookies: async () => { calls.push('clearCookies') } },\n    '@/lib/supabase/server': { createClient: async () => ({ auth: { signOut: async input => { calls.push(plain(input)) } } }) },\n  })\n  await assert.rejects(api.logoutHubAccount(), /REDIRECT:\\/hub\\/login$/)\n  assert.deepEqual(calls, [{ scope: 'local' }, 'clearCookies'])\n})\n\n"
    ]
  ],
  "lib/hub-return-path.ts": [
    [
      "\n  try {\n    const parsed = new URL(value, 'https://www.webzoka.com')\n    if (parsed.origin === 'https://www.webzoka.com' && parsed.pathname === '/hub/account' && !parsed.search && !parsed.hash) {\n      return '/hub/account'\n    }\n",
      "\n  try {\n    const parsed = new URL(value, 'https://www.webzoka.com')\n    if (parsed.origin === 'https://www.webzoka.com' && !parsed.hash &&\n        ['/hub/systems', '/hub/billing', '/hub/support'].includes(parsed.pathname) &&\n        (!parsed.search || (parsed.pathname === '/hub/billing' && parsed.search === '?purchase=failed'))) {\n      return `${parsed.pathname}${parsed.search}`\n    }\n    if (parsed.origin === 'https://www.webzoka.com' && parsed.pathname === '/hub/account' && !parsed.search && !parsed.hash) {\n      return '/hub/account'\n    }\n"
    ]
  ],
  "lib/hub-signup-source-contract.test.mjs": [
    [
      "import { fileURLToPath } from 'node:url'\nimport { test } from 'node:test'\nimport { historicalSignupSource, signupCandidateSource, signupHistoricalBytes, signupSourcePaths } from './hub-signup-source-contract.mjs'\n\nconst root = join(dirname(fileURLToPath(import.meta.url)), '..')\nconst baseline = '4e4937ca55fada4856a2c10551a4f3c01e212045'\n",
      "import { fileURLToPath } from 'node:url'\nimport { test } from 'node:test'\nimport { historicalSignupSource, signupCandidateSource, signupHistoricalBytes, signupSourcePaths } from './hub-signup-source-contract.mjs'\nimport { historicalNavigationSource } from './hub-navigation-source-contract.mjs'\n\nconst root = join(dirname(fileURLToPath(import.meta.url)), '..')\nconst baseline = '4e4937ca55fada4856a2c10551a4f3c01e212045'\n"
    ],
    [
      "\nfor (const file of paths) test('exact signup delta retains the historical baseline: ' + file, () => {\n  const historical = execFileSync('git', ['-C', root, 'show', `${baseline}:${file}`], { encoding: 'utf8' }).replaceAll('\\r\\n', '\\n')\n  const candidate = readFileSync(join(root, file), 'utf8').replaceAll('\\r\\n', '\\n')\n  assert.equal(candidate, signupCandidateSource(file, historical))\n  assert.equal(historicalSignupSource(file, candidate), historical)\n  assert.equal(hash(signupHistoricalBytes(file, Buffer.from(candidate))), hash(historical))\n",
      "\nfor (const file of paths) test('exact signup delta retains the historical baseline: ' + file, () => {\n  const historical = execFileSync('git', ['-C', root, 'show', `${baseline}:${file}`], { encoding: 'utf8' }).replaceAll('\\r\\n', '\\n')\n  const candidate = historicalNavigationSource(file, readFileSync(join(root, file), 'utf8').replaceAll('\\r\\n', '\\n'))\n  assert.equal(candidate, signupCandidateSource(file, historical))\n  assert.equal(historicalSignupSource(file, candidate), historical)\n  assert.equal(hash(signupHistoricalBytes(file, Buffer.from(candidate))), hash(historical))\n"
    ]
  ],
  "lib/hub-token-isolation.test.mjs": [
    [
      "    ...['javascript:alert(1)', 'http://payments.example.test', 'https://user:pass@payments.example.test', 'not-a-url'].map((redirectUrl) => ({ checkoutResult: { ok: true, kind: 'checkout', redirectUrl } })),\n  ]) {\n    const mock = harness({ ...withoutSubscription, ...options })\n    await assert.rejects(mock.purchase(), (error) => error.url === '/hub?view=billing&purchase=failed')\n    assert.equal(financialCalls(mock).length, 1)\n    assert.equal(signed(mock).length, 0)\n  }\n",
      "    ...['javascript:alert(1)', 'http://payments.example.test', 'https://user:pass@payments.example.test', 'not-a-url'].map((redirectUrl) => ({ checkoutResult: { ok: true, kind: 'checkout', redirectUrl } })),\n  ]) {\n    const mock = harness({ ...withoutSubscription, ...options })\n    await assert.rejects(mock.purchase(), (error) => error.url === '/hub/billing?purchase=failed')\n    assert.equal(financialCalls(mock).length, 1)\n    assert.equal(signed(mock).length, 0)\n  }\n"
    ]
  ],
  "next.config.ts": [
    [
      "import type { NextConfig } from \"next\";\n\nconst nextConfig: NextConfig = {\n  devIndicators: false,\n",
      "import type { NextConfig } from \"next\";\nimport { HUB_PUBLIC_HOST, HUB_PUBLIC_ROUTES, HUB_SECTION_ROUTES } from './lib/hub-navigation'\n\nconst nextConfig: NextConfig = {\n  devIndicators: false,\n"
    ],
    [
      "  turbopack: {\n    root: process.cwd(),\n  },\n  async headers() {\n    return [{\n      source: '/(.*)',\n",
      "  turbopack: {\n    root: process.cwd(),\n  },\n  async rewrites() {\n    return {\n      beforeFiles: [\n        ...HUB_PUBLIC_ROUTES.map(({ publicPath, internalPath }) => ({\n          source: publicPath,\n          destination: internalPath,\n          has: [{ type: 'host' as const, value: HUB_PUBLIC_HOST.replaceAll('.', '\\\\.') }],\n        })),\n        {\n          source: '/articles/:slug',\n          destination: '/hub/artikel/:slug',\n          has: [{ type: 'host' as const, value: HUB_PUBLIC_HOST.replaceAll('.', '\\\\.') }],\n        },\n        ...HUB_SECTION_ROUTES.map(({ path, view }) => ({\n          source: path,\n          destination: `/hub?view=${view}`,\n        })),\n      ],\n    }\n  },\n  async headers() {\n    return [{\n      source: '/(.*)',\n"
    ]
  ],
  "proxy.ts": [
    [
      "import { NextResponse } from 'next/server'\nimport type { NextRequest } from 'next/server'\nimport { isSuperadminEmail } from '@/lib/superadmin'\n\nexport async function proxy(request: NextRequest) {\n  const { pathname } = request.nextUrl\n  const hostname = request.nextUrl.hostname.toLowerCase()\n\n  // Production public-domain routing. Keep the internal superadmin hostname on\n  // its existing dashboard surface while the public www hostname opens the\n",
      "import { NextResponse } from 'next/server'\nimport type { NextRequest } from 'next/server'\nimport { isSuperadminEmail } from '@/lib/superadmin'\nimport { canonicalHubUrl, hubRequestHostname, internalHubPath, publicHubPath } from '@/lib/hub-navigation'\n\nexport async function proxy(request: NextRequest) {\n  const hostname = hubRequestHostname(request.nextUrl.hostname, request.headers?.get('host'))\n  const routingUrl = new URL(request.nextUrl)\n  routingUrl.hostname = hostname\n  const canonical = canonicalHubUrl(routingUrl, {\n    production: process.env.VERCEL_ENV === 'production',\n    configuredOrigin: process.env.WEBZOKA_HUB_APP_URL,\n    method: request.method,\n  })\n  if (canonical) return NextResponse.redirect(canonical, 307)\n  const pathname = internalHubPath(request.nextUrl.pathname, hostname)\n\n  // Production public-domain routing. Keep the internal superadmin hostname on\n  // its existing dashboard surface while the public www hostname opens the\n"
    ],
    [
      "\n  if (isHubRoute || isOAuthConsent) {\n    if (!claims?.sub && !isPublicHubExplore) {\n      const loginUrl = new URL('/hub/login', request.url)\n      if (isOAuthConsent || pathname === '/hub/workspace' || pathname === '/hub/account') {\n        loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)\n      }\n      return NextResponse.redirect(loginUrl)\n",
      "\n  if (isHubRoute || isOAuthConsent) {\n    if (!claims?.sub && !isPublicHubExplore) {\n      const loginUrl = new URL(publicHubPath('/hub/login', hostname), routingUrl)\n      if (isOAuthConsent || pathname === '/hub/workspace' || ['/hub/systems', '/hub/billing', '/hub/support'].includes(pathname)) {\n        loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)\n      }\n      return NextResponse.redirect(loginUrl)\n"
    ]
  ]
}

export const navigationSourcePaths = Object.freeze(Object.keys(deltas))
const lf = value => value.replaceAll('\r\n', '\n')
function replaceOnce(text, before, after, file) {
  assert.equal(text.split(before).length, 2, 'Exact navigation source anchor: ' + file)
  return text.replace(before, after)
}
export function navigationCandidateSource(file, historical) {
  if (!deltas[file]) return historical
  return deltas[file].reduce((text, [before, after]) => replaceOnce(text, before, after, file), lf(historical))
}
export function historicalNavigationSource(file, candidate) {
  if (!deltas[file]) return candidate
  return [...deltas[file]].reverse().reduce((text, [before, after]) => replaceOnce(text, after, before, file), lf(candidate))
}
export function historicalNavigationBytes(file, bytes) {
  return deltas[file] ? Buffer.from(historicalNavigationSource(file, bytes.toString('utf8'))) : bytes
}
