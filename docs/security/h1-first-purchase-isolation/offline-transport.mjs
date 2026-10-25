import { readFileSync } from 'node:fs'

export const DEV_ORIGIN = 'https://mcvekinhgcqygfddyifs.supabase.co'
export const TEST_SCHEMA = 'h1_first_purchase_test'
const SNAP_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions'
const TABLES = ['tenants', 'tenant_members', 'subscription_plans', 'tenant_subscriptions',
  'subscription_invoices', 'subscription_events', 'platform_settings']
const REQUIRED_EVIDENCE = ['owner_runtime_authorization', 'dev_project_and_principal',
  'registry_preservation_and_ddl_non_interference', 'schema_constraints_grants_rls_and_profile_routing',
  'test_auth_subjects_and_session_provenance', 'auth_hooks_triggers_and_smtp_containment',
  'scheduler_queues_webhooks_and_database_egress_containment', 'process_and_browser_egress_enforcement',
  'server_side_payment_and_email_interception', 'synthetic_only_write_limits_and_cleanup']

export function readPlan() {
  return JSON.parse(readFileSync(new URL('./isolation.plan.json', import.meta.url), 'utf8'))
}

function deny(reason) {
  throw new Error(`H1_ISOLATION_DENIED: ${reason}`)
}

export function assertInertPlan(plan) {
  if (plan?.mode !== 'OFFLINE_PREPARATION_ONLY' || plan.runtimeAuthorized !== false ||
      plan.providerWritesAuthorized !== false || plan.realNetwork !== 'DENY_ALL' ||
      plan.automaticStart !== false || plan.credentials !== null || plan.sessions !== null ||
      plan.providerEvidence !== null) deny('configuration must remain inert')
  if (plan.projectRef !== 'mcvekinhgcqygfddyifs' || plan.databaseSchema !== TEST_SCHEMA ||
      plan.applicationOrigin !== 'http://localhost:3000' ||
      plan.checkoutOrigin !== 'https://h1-checkout.invalid' ||
      JSON.stringify(plan.tables) !== JSON.stringify(TABLES) ||
      JSON.stringify(plan.requiredRuntimeEvidence) !== JSON.stringify(REQUIRED_EVIDENCE)) deny('target or schema drift')
  const f = plan.fixture
  if (!f || f.ownerA !== null || f.ownerB !== null || f.initialSubscriptions !== 0 ||
      f.initialInvoices !== 0 || f.initialEvents !== 0 || f.maximumAuthUsersCreated !== 2 ||
      f.maximumSuccessfulCheckouts !== 1 || f.platform !== 'lms' ||
      f.emailA !== 'h1-first-purchase-a@example.invalid' ||
      f.emailB !== 'h1-first-purchase-b@example.invalid' ||
      f.monthlyAmount !== 100000 || f.yearlyAmount !== 1000000 || f.maximumRuntimeMinutes !== 30 ||
      f.tenantA !== '8c15706b-f67e-4cc5-8b90-0fe619dd0101' ||
      f.tenantB !== '8c15706b-f67e-4cc5-8b90-0fe619dd0102' ||
      f.plan !== '8c15706b-f67e-4cc5-8b90-0fe619dd0201' ||
      f.membershipA !== '8c15706b-f67e-4cc5-8b90-0fe619dd0301' ||
      f.membershipB !== '8c15706b-f67e-4cc5-8b90-0fe619dd0302') deny('fixture drift')
  return plan
}

// This reports missing evidence. It cannot authorize a launch, consume credentials,
// install interception, open a socket, or turn a caller-supplied receipt into proof.
export function runtimeBlockers(plan) {
  assertInertPlan(plan)
  return [...plan.requiredRuntimeEvidence, 'live_transport_not_implemented_or_authorized']
}

// A dry-run descriptor only. The existing SDK clients default to public; a future
// separately approved server adapter must apply these profiles to EVERY REST call.
// Unknown tables, RPC, Realtime, Functions and Auth administration have no route.
export function describeDevRequest(input, method = 'GET') {
  const url = new URL(input)
  if (url.origin !== DEV_ORIGIN || url.username || url.password || url.hash ||
      /%|\\/.test(url.pathname)) deny('foreign or noncanonical destination')
  const verb = method.toUpperCase()
  const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1]
  if (table && TABLES.includes(table)) {
    if (!['GET', 'HEAD', 'POST', 'PATCH'].includes(verb) ||
        (['POST', 'PATCH'].includes(verb) &&
         !['tenant_subscriptions', 'subscription_invoices'].includes(table))) {
      deny('business mutation outside checkout boundary')
    }
    return { kind: 'DESCRIPTOR_ONLY', table, method: verb, redirect: 'manual',
      headers: { 'Accept-Profile': TEST_SCHEMA, 'Content-Profile': TEST_SCHEMA } }
  }
  const authRead = ['/auth/v1/user', '/auth/v1/.well-known/jwks.json'].includes(url.pathname) && verb === 'GET'
  const authLogout = url.pathname === '/auth/v1/logout' && verb === 'POST' && url.search === '?scope=local'
  const authToken = url.pathname === '/auth/v1/token' && verb === 'POST' &&
    ['?grant_type=password', '?grant_type=refresh_token'].includes(url.search)
  if (authRead || authLogout || authToken) return { kind: 'DESCRIPTOR_ONLY', method: verb, redirect: 'manual', headers: {} }
  deny('unapproved service or Auth operation')
}

// No delegate/native fetch exists here. Even the exact DEV Auth/REST origin is
// denied. This is an offline sink, not a complete Next.js network sandbox.
export function createOfflineFetch(plan = readPlan()) {
  assertInertPlan(plan)
  plan = structuredClone(plan)
  const fixture = structuredClone(plan.fixture)
  return async function offlineFetch(input, init = {}) {
    const request = new Request(input, init)
    if (request.url !== SNAP_URL || request.method !== 'POST') deny('real network disabled')
    const headers = request.headers
    if (headers.get('authorization') !== `Basic ${Buffer.from('H1_OFFLINE_ONLY:').toString('base64')}` ||
        headers.get('content-type') !== 'application/json') deny('only dummy payment credentials accepted')
    const body = await request.json()
    const amount = body.transaction_details?.gross_amount
    const finish = `${plan.applicationOrigin}/billing/selesai?inv=`
    if (!/^JA-SUB-\d{4}-[A-F0-9]{8}-(MON|YR)$/.test(body.transaction_details?.order_id ?? '') ||
        ![fixture.monthlyAmount, fixture.yearlyAmount].includes(amount) ||
        body.customer_details?.email !== fixture.emailA || body.customer_details?.phone ||
        body.customer_details?.first_name !== 'H1 first-purchase A' ||
        !body.callbacks?.finish?.startsWith(finish) ||
        !/^[a-f0-9-]{36}$/.test(body.callbacks.finish.slice(finish.length))) deny('non-fixture payment payload')
    return Response.json({ token: 'H1_OFFLINE_SYNTHETIC_SNAP',
      redirect_url: `${plan.checkoutOrigin}/checkout/synthetic` })
  }
}
