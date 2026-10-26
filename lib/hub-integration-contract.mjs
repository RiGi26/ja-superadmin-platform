// Exact, reviewed source deltas for the local H1 integration. No runtime access.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const main = '8a9ae5e7d61b706c3bd87f5516d759560876bad5'
const inventory = '377a89aca0e3869454b544365705b1d868a57c5c'
const sources = new Map()
// Reviewed local first-purchase scope. Other H1 identity/runtime source pins in
// the isolation suite remain unchanged; these do not authorize runtime execution.
const firstPurchasePins = {
  // Step 3: exact workspace return selectors; existing OAuth/recovery rules stay.
  'lib/hub-return-path.ts': 'aa1cbd6898ce07b2bf174ead4c3938e13b7659c32c0f1943bb7f37450ff34f4c',
  'app/hub/page.tsx': 'ffae37f433158b4fb4f0a126c50691a75edd3085183bcc55613af4aee00523d9',
  'app/hub/actions.ts': '635c46880dd8b76b7bea76a2677cb45536cf7a266732096c628b0c66008214f6',
  'app/hub/_components/HubShell.tsx': '8b2e5f8a95a211eccc439dd911a25c172104d4b130eb46bb70cd66bf8ee5732d',
  'app/hub/hub.module.css': '872e5d94f697a17459815e9fd8a71319117e2c0bb7179d0c6553e3bab96969a2',
  'lib/billing.ts': '2d163a3116c601e742af4c8dd52cf1088925510e192d8bde9838b5012af1a951',
}
const replace = (text, before, after) => {
  assert.equal(text.split(before).length, 2, 'Approved source delta must have one immutable anchor')
  return text.replace(before, after)
}

export function approvedHubSource(file) {
  if (file === 'proxy.ts') {
    return replace(execFileSync('git', ['-C', root, 'show', `${main}:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n'),
      'if (isOAuthConsent) {', "if (isOAuthConsent || pathname === '/hub/workspace') {")
  }
  if (firstPurchasePins[file]) {
    const text = readFileSync(join(root, file), 'utf8').replaceAll('\r\n', '\n')
    assert.equal(createHash('sha256').update(text).digest('hex'), firstPurchasePins[file], file)
    return text
  }
  if (sources.has(file)) return sources.get(file)
  const ref = ['lib/hub-data.ts', 'app/hub/_components/HubShell.tsx', 'app/hub/hub.module.css'].includes(file) ? inventory : main
  let text = execFileSync('git', ['-C', root, 'show', `${ref}:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n')
  if (file === 'lib/hub-data.ts') {
    text = replace(text, "import { signBillingToken } from '@/lib/billing-link'\n", '')
    text = replace(text, '  manageSubscriptionUrl: string | null', '  manageSubscriptionUrl: null')
    text = replace(text, `  let manageSubscriptionUrl: string | null = null
  try {
    manageSubscriptionUrl = \`/billing/langganan?token=\${encodeURIComponent(signBillingToken(tenantId))}\`
  } catch {
    manageSubscriptionUrl = null
  }

`, '')
    text = replace(text, '    manageSubscriptionUrl,', '    manageSubscriptionUrl: null,')
  } else if (file === 'app/hub/page.tsx') {
    text = replace(text, "import { getHubSnapshot } from '@/lib/hub-data'", `import { dispatchHubRoute } from '@/lib/hub-context-routing'
import { getHubBillingOwnerTenant } from '@/lib/hub-billing'
import { getHubSystemsInventory } from '@/lib/hub-data'`)
    text = replace(text, '  const snapshot = await getHubSnapshot()', `  const route = await dispatchHubRoute()
  if (route.context !== 'legacy_tenant') redirect('/unauthorized')
  const snapshot = route.snapshot
  const [inventory, billingOwnerTenant] = await Promise.all([
    view === 'home' || view === 'systems' ? getHubSystemsInventory() : Promise.resolve(null),
    view === 'billing' && !snapshot.isPreview
      ? getHubBillingOwnerTenant(snapshot.tenant.id) : Promise.resolve(null),
  ])
  const canManageSubscription = billingOwnerTenant !== null`)
    text = replace(text, '      snapshot={snapshot}', '      snapshot={snapshot}\n      inventory={inventory}')
    text = replace(text, '      view={view}', '      view={view}\n      canManageSubscription={canManageSubscription}')
  } else if (file === 'app/hub/actions.ts') {
    text = replace(text, "import { z } from 'zod'", `import { z } from 'zod'
import { signBillingToken } from '@/lib/billing-link'
import { getHubBillingOwnerTenant } from '@/lib/hub-billing'`)
    text += `
// Capabilities are issued only by this explicit Billing form submission.
export async function openHubSubscriptionManagement(formData: FormData): Promise<never> {
  const requestedTenants = formData.getAll('tenant_id')
  const tenantId = requestedTenants.length === 1
    ? await getHubBillingOwnerTenant(requestedTenants[0])
    : null
  if (!tenantId) redirect('/unauthorized')

  let url: string
  try {
    url = \`/billing/langganan?token=\${encodeURIComponent(signBillingToken(tenantId))}\`
  } catch {
    redirect('/unauthorized')
  }
  redirect(url)
}
`
  } else if (file === 'app/hub/_components/HubShell.tsx') {
    for (const [before, after] of [
      ["import { logoutFromHub }", "import { logoutFromHub, openHubSubscriptionManagement }"],
      ['function BillingView({ snapshot }: { snapshot: HubCustomerSnapshot })', 'function BillingView({ snapshot, canManageSubscription }: { snapshot: HubCustomerSnapshot; canManageSubscription: boolean })'],
      ['<section className={styles.billingOverview}>', '<form action={openHubSubscriptionManagement} className={styles.billingOverview}>'],
      ['snapshot.manageSubscriptionUrl && !snapshot.isPreview', 'canManageSubscription && !snapshot.isPreview'],
      ['<a className={styles.primaryButton} href={snapshot.manageSubscriptionUrl}>', '<button className={styles.primaryButton} type="submit" name="tenant_id" value={snapshot.tenant.id}>'],
      ['Kelola langganan\n            </a>', 'Kelola langganan\n            </button>'],
      ['      </section>\n\n      <section className={styles.sectionBlock}>\n        <div className={styles.sectionTitleRow}>\n          <div><p className={styles.sectionKicker}>Transaksi', '      </form>\n\n      <section className={styles.sectionBlock}>\n        <div className={styles.sectionTitleRow}>\n          <div><p className={styles.sectionKicker}>Transaksi'],
      ['  inventory,\n  view,', '  inventory,\n  view,\n  canManageSubscription = false,'],
      ['  view: HubView', '  view: HubView\n  canManageSubscription?: boolean'],
      ['<BillingView snapshot={snapshot} />', '<BillingView snapshot={snapshot} canManageSubscription={canManageSubscription} />'],
    ]) text = replace(text, before, after)
  }
  sources.set(file, text)
  return text
}
