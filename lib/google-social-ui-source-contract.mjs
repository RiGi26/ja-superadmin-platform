// Exact Google entry-point deltas over the reviewed Core main baseline.
// Removing only these additions must recover all earlier frozen-source checks.
import assert from 'node:assert/strict'
import { historicalStockPurchaseSource, stockPurchaseCandidateSource } from './stock-purchase-source-successor.mjs'

const deltas = {
  "app/hub/login/page.tsx": [
    [
      "import { safeHubReturnPath } from '@/lib/hub-return-path'\nimport { HubLoginForm } from './HubLoginForm'\nimport styles from './login.module.css'\n\n",
      "import { safeHubReturnPath } from '@/lib/hub-return-path'\nimport { HubLoginForm } from './HubLoginForm'\nimport { GoogleSocialEntry } from './GoogleSocialEntry'\nimport styles from './login.module.css'\n\n"
    ],
    [
      "              </p>\n            ) : null}\n            <HubLoginForm next={next} />\n            {!next && googleDevConfig(process.env) && googleDevLocalHeaders(await headers()) ? (\n",
      "              </p>\n            ) : null}\n            {query.message === 'google_failed' ? (\n              <p className={styles.formError} role=\"alert\">\n                Masuk dengan Google belum berhasil. Coba kembali atau gunakan email dan kata sandi.\n              </p>\n            ) : null}\n            <GoogleSocialEntry next={next} />\n            <HubLoginForm next={next} />\n            {!next && googleDevConfig(process.env) && googleDevLocalHeaders(await headers()) ? (\n"
    ]
  ],
  "app/hub/signup/HubSignupForm.tsx": [
    [
      "import { signupToHub } from './actions'\nimport type { HubRegistrationState } from '@/lib/hub-registration'\nimport styles from '../login/login.module.css'\nimport signup from './signup.module.css'\n",
      "import { signupToHub } from './actions'\nimport type { HubRegistrationState } from '@/lib/hub-registration'\nimport { GoogleSocialEntry } from '../login/GoogleSocialEntry'\nimport styles from '../login/login.module.css'\nimport signup from './signup.module.css'\n"
    ],
    [
      "      <h1 className={styles.title} id=\"signup-title\">Buat akun<br />Webzoka</h1>\n      <p className={`${styles.intro} ${signup.intro}`}>Gunakan email yang Anda kelola. Kami akan mengirimkan tautan verifikasi ke email tersebut.</p>\n    <form ref={formRef} action={action} onSubmit={handleSubmit} className={styles.form} aria-label=\"Buat akun Webzoka\">\n      <div className={signup.honeypot} aria-hidden=\"true\">\n",
      "      <h1 className={styles.title} id=\"signup-title\">Buat akun<br />Webzoka</h1>\n      <p className={`${styles.intro} ${signup.intro}`}>Gunakan email yang Anda kelola. Kami akan mengirimkan tautan verifikasi ke email tersebut.</p>\n      <GoogleSocialEntry signup />\n    <form ref={formRef} action={action} onSubmit={handleSubmit} className={styles.form} aria-label=\"Buat akun Webzoka\">\n      <div className={signup.honeypot} aria-hidden=\"true\">\n"
    ]
  ],
  "lib/google-oauth-dev.test.mjs": [
    [
      "})\n\ntest('login page displays Google only for exact DEV and never offers it as portal consent continuation', async () => {\n  const paths = load('lib/hub-return-path.ts')\n  for (const [env, host, next, enabled] of [\n",
      "})\n\ntest('closed Production entry preserves the exact DEV-only button and continuation restriction', async () => {\n  const paths = load('lib/hub-return-path.ts')\n  for (const [env, host, next, enabled] of [\n"
    ],
    [
      "      '../_components/HubAuthStory': { HubAuthStory: () => createElement('aside') },\n      './HubLoginForm': { HubLoginForm: () => createElement('form', { 'data-password-login': 'intact' }) },\n      './login.module.css': { default: {} },\n      'lucide-react': Object.fromEntries(['ArrowRight', 'Headset', 'LayoutGrid', 'ReceiptText', 'UserRound'].map(name => [name, props => createElement('svg', props)])),\n",
      "      '../_components/HubAuthStory': { HubAuthStory: () => createElement('aside') },\n      './HubLoginForm': { HubLoginForm: () => createElement('form', { 'data-password-login': 'intact' }) },\n      './GoogleSocialEntry': { GoogleSocialEntry: () => null },\n      './login.module.css': { default: {} },\n      'lucide-react': Object.fromEntries(['ArrowRight', 'Headset', 'LayoutGrid', 'ReceiptText', 'UserRound'].map(name => [name, props => createElement('svg', props)])),\n"
    ]
  ],
  "lib/hub-registration.test.mjs": [
    [
      "      '../_components/HubAuthStory': { HubAuthStory: 'story' },\n      './HubLoginForm': { HubLoginForm: 'form' }, './login.module.css': { default: {} },\n      'lucide-react': Object.fromEntries(['ArrowRight', 'Headset', 'LayoutGrid', 'ReceiptText', 'UserRound'].map(name => [name, name])),\n    })\n",
      "      '../_components/HubAuthStory': { HubAuthStory: 'story' },\n      './HubLoginForm': { HubLoginForm: 'form' }, './login.module.css': { default: {} },\n      './GoogleSocialEntry': { GoogleSocialEntry: () => null },\n      'lucide-react': Object.fromEntries(['ArrowRight', 'Headset', 'LayoutGrid', 'ReceiptText', 'UserRound'].map(name => [name, name])),\n    })\n"
    ]
  ],
  "lib/hub-signup-ui.test.mjs": [
    [
      "  const api = load('app/hub/signup/HubSignupForm.tsx', {\n    react, 'next/link': { __esModule: true, default: 'a' }, 'next/script': { __esModule: true, default: 'script' }, './actions': { signupToHub: serverAction },\n  }, siteKey ? { NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey } : {})\n  function render() { refCursor = 0; stateCursor = 0; effects.length = 0; tree = api.HubSignupForm({ verificationFailed }); return tree }\n",
      "  const api = load('app/hub/signup/HubSignupForm.tsx', {\n    react, 'next/link': { __esModule: true, default: 'a' }, 'next/script': { __esModule: true, default: 'script' }, './actions': { signupToHub: serverAction },\n    '../login/GoogleSocialEntry': { GoogleSocialEntry: () => null },\n  }, siteKey ? { NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey } : {})\n  function render() { refCursor = 0; stateCursor = 0; effects.length = 0; tree = api.HubSignupForm({ verificationFailed }); return tree }\n"
    ]
  ]
}

export const googleSocialUiSourcePaths = Object.freeze(Object.keys(deltas))
function replaceOnce(text, before, after, file) {
  assert.equal(text.split(before).length, 2, 'Exact Google UI source anchor: ' + file)
  return text.replace(before, after)
}
export function googleSocialUiCandidateSource(file, baseline) {
  if (!deltas[file]) return baseline
  const candidate = deltas[file].reduce((text, [before, after]) => replaceOnce(text, before, after, file), baseline)
  const result = file === 'app/hub/login/page.tsx'
    ? replaceOnce(candidate, '<GoogleSocialEntry next={next} />',
      '<GoogleSocialEntry next={next} pilotEnabled={process.env.STOCK_SSO_PILOT_ENABLED === \'true\'} />', file)
    : candidate
  return stockPurchaseCandidateSource(file, result)
}
export function historicalGoogleSocialUiSource(file, candidate) {
  candidate = historicalStockPurchaseSource(file, candidate)
  if (!deltas[file]) return candidate
  const prior = file === 'app/hub/login/page.tsx'
    ? replaceOnce(candidate, '<GoogleSocialEntry next={next} pilotEnabled={process.env.STOCK_SSO_PILOT_ENABLED === \'true\'} />',
      '<GoogleSocialEntry next={next} />', file)
    : candidate
  return [...deltas[file]].reverse().reduce((text, [before, after]) => replaceOnce(text, after, before, file), prior)
}
