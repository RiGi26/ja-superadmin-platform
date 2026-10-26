# H1 first-purchase isolation preparation

Status: **LOCAL_PREPARATION_COMPLETE; MANAGED_PREPARATION_AND_RUNTIME_NOT_AUTHORIZED**.
Prepared 21 October 2026 under WG-1.2 + WF-1.0 / V4. Repository
RiGi26/ja-superadmin-platform; existing `.wt-customer-hub-core`, branch
`feat/h1-g1-e1-core-static`, HEAD `5dcff3c3bab1d6aaccf6b315a47e9bbb6edb6f0a`.

This package contains no launcher, credential, session, provider client, deployment
configuration or automatic SQL executor. Importing the module does not install a
global interceptor. `createOfflineFetch` has no network delegate: all real requests,
including exact DEV Auth/database requests, fail. Its only response is a synthetic
Snap response to an exact sandbox request with dummy credentials and fixture data.
SQL proposals have an unconditional refusal inside BEGIN plus terminal ROLLBACK.
No configuration switch enables managed access or starts the application.

## Existing evidence and the actual isolation boundary

The existing DEV project is `webzoka-core-dev`, `mcvekinhgcqygfddyifs`. Prior Google
UAT proved one pending-only DEV Auth login and cleanup on 15 October; it did not
prove legacy billing/RLS. The installed native Registry was recorded on 18 October
in [DEV_REGISTRY_AS_BUILT](../h1-g1-core-dev/DEV_REGISTRY_AS_BUILT.md). That state is
protected and is not disposable. The 21 October provider-readiness report still
lacks DDL/scheduler non-interference and execution-path attestations. Reusing the
project does not waive those gates. H1.G1 stays OPEN; Company runtime/E1 stay DISABLED.

Production `hxhusfkrlafxdnyasmsu`, production-shared Vercel Preview, old Google test
accounts, workstation `.env*`/OIDC credentials and the previous runtime copy are
excluded. No provider reads or writes were needed for this offline preparation.
Current managed schema, users, triggers, queues and settings remain unverified.

## Source compatibility assessment

The proposed **new, separately exposed** `h1_first_purchase_test` schema contains
seven tables. Existing public/private Registry objects, public legacy billing
objects, users, grants, functions, migrations and Auth Hooks are not altered.
No public.users profile is required: the Core migration family uses auth.users
directly for membership and Owner FKs. Do not apply the divergent root core_schema.sql.

| Exercised contract | Source / proposed compatibility |
| --- | --- |
| Fresh subject and active exact Owner | lib/hub-billing.ts: claims/getUser subject match; authenticated self-membership SELECT; tenant Owner FK; active tenant; confirmed non-anonymous user; no subscription |
| Snapshot and inventory | lib/hub-data.ts: tenant fields; membership-to-tenant FK; subscription-to-plan FK; invoices; active plans. Snapshot uses server-only reads after membership authorization. |
| Plan and prices | Core001/009 plus lib/billing.ts: tier, display name, monthly/yearly numeric prices, features and is_active; synthetic LMS Starter only, not a copy of customer pricing |
| Checkout writes | Core008/013/016 plus lib/billing.ts: unpaid subscription INSERT; invoice INSERT and PATCH to awaiting_payment, generated IDs/order ID, mode, change_type and promo columns |
| Read configuration | platform_settings midtrans_mode=sandbox and promo_campaign inactive, within test schema only |
| Auth/RLS | Core003 self-membership and active-plan read paths need no custom JWT hook. Seven tables have RLS; authenticated gets only SELECT on its own membership and active plans; service_role gets SELECT plus subscription/invoice INSERT/UPDATE. This is a deliberately narrower test subset, not deployed RLS certification. |

Two source discrepancies remain material. Root core_schema.sql has one-subscription
tenant uniqueness; Core001 does not. This proposal does not invent that constraint:
concurrent/duplicate-submission correctness is not proved. Core013 adds a second
subscription-to-plan FK (`scheduled_plan_id`); the unqualified snapshot plan join
can be ambiguous where both FKs are installed. The minimal first-purchase schema
omits scheduled-change columns/FK. Full schema/renewal parity therefore remains
NOT_PROVEN; do not use this fixture result to clear that release gate or conceal a
real PostgREST error. Managed catalog/actual relationship resolution is required
before any broader compatibility claim. This task does not change application code.

The outstanding Google suite failure is a historical preservation assertion, not
an observed OAuth failure. Two pins differ (core-company.ts and its test); both
files match pre-remediation evidence, and core-company.ts matches protected HEAD.
Do not update/waive the pins here. Future first-purchase testing uses dedicated
password Auth, not Google; the global suite remains non-green until classified.

## Proposed DEV preparation authorization (not execution authority)

**One bounded packet:** authorize a named Owner/operator to perform the following
preflight and, only if every gate passes, prepare the exact isolated schema and
two synthetic users/fixture below. Runtime, login, checkout and UAT remain excluded.

1. Independently verify Dashboard project ref, Primary, postgres login/effective
   principal and read-only preflight capture. A project URL alone is insufficient.
   `catalog.READ_ONLY.sql` is the exact proposed metadata-only query package.
   Do not use MCP execute_sql while its principal/transaction handling is unproven.
2. Obtain current operator/provider records for event-trigger behavior, scheduler
   jobs including hidden/NULL states, Edge schedules, queues/retries, Database
   Webhooks, Auth Hooks/triggers and SMTP. Establish that new-schema DDL and new
   Auth users cannot mutate protected Registry/public records, contact external
   services or trigger background writers. If any required change is global or
   touches protected controls, STOP. Do not disable/change triggers or H1 locks.
   The current H1.G1 readiness gaps remain a precondition, not approval to fix G1.
3. Confirm the test schema does not exist; capture protected Registry definitions,
   grants, gate/audit-head preservation and Auth-user identifiers/counts privately.
   Preserve existing users without exporting email, password, token or customer
   rows. A concurrent baseline change invalidates preservation comparison.
4. Review an execution derivative of schema.PROPOSED.sql: only remove its named
   refusal and replace terminal ROLLBACK with COMMIT. The named postgres operator
   executes it once in the verified SQL Editor session after approval/hash review.
   No IF NOT EXISTS, adoption, historical migrations, Registry changes, hook/RPC,
   new role/extension, migration-ledger entry, public DDL or privileged fallback.
5. Add only h1_first_purchase_test to DEV API exposed schemas, preserving the
   exact existing list; retain its pre-value for restoration. This preparation
   packet includes scoped post-creation metadata/API reads to verify relationships,
   grants and both profiles using only new objects; no Auth login or checkout.
   Do not expose any new private schema or alter existing public grants.
6. Owner-opened DEV Auth administration creates exactly TWO new password users,
   emails from isolation.plan.json, pre-confirmed without invite/recovery/SMTP.
   No login yet. Use strong private passwords supplied outside files/arguments/logs.
   Confirm returned fresh UUIDs, creation time, confirmed email, is_anonymous=false,
   unbanned/not deleted, no Company/tenant/superadmin custom claims or identities
   linked to existing users. If .invalid addresses are refused, STOP; do not use a
   real mailbox or protected account. No Auth hook/provider/callback/SMTP change.
7. Replace only the TWO UUID placeholders in fixture.PROPOSED.sql with those new
   subjects; remove named refusal and replace terminal ROLLBACK with COMMIT in a
   separately reviewed/pinned derivative. Require empty task-owned tables, exact
   email/UUID matches and creation receipts. Insert only two tenants, two Owner
   memberships, one plan and two settings. Subscriptions/invoices/events stay ZERO.
8. Capture exact new UUIDs, object inventory/ACL/RLS/constraints, receipt hashes,
   zero financial rows, unchanged protected state and no pending mail/automation.
   Stop and hand off. No session creation or runtime follows preparation approval.

The service-role key is broad project authority, not a test-scoped credential.
Future use must be limited to a clean process with exact DEV key provenance and
verified routing. JWT payload decoding alone cannot prove credential authenticity;
actual DEV Auth/API responses must independently establish it when authorized.

## Future runtime containment contract (separate approval required)

| Surface | Required containment; not established by offline tests |
| --- | --- |
| Process/configuration | Fresh task scratch app from exact pinned source, reuse installed dependencies without install/new worktree. Exclude all .env*, .git, .vercel, .next, previous runtime copies. Explicit minimal child environment, no inherited credentials/NODE_OPTIONS/proxies/OIDC. Loopback localhost only, never LAN/wildcard. |
| Credentials | Only exact DEV URL/anon/service-role references from private Owner input. No Production, payment, Resend, portal, cron, billing-sync, Google or DB-password credentials. NODE_ENV=development; preview flags false; Google DEV flag false; app origin localhost. Dummy MIDTRANS_SERVER_KEY_SANDBOX=H1_OFFLINE_ONLY only. Never persist keys or sessions in this package. |
| Database | A separately implemented server transport must force BOTH Accept-Profile and Content-Profile to the test schema for ALL REST calls, including server admin/SSR clients and joins. describeDevRequest supplies dry-run routing only. No public fallback, RPC, Auth admin, Realtime, Edge Functions, Storage, direct SQL or arbitrary table. Bind writes to fixture tenant/plan IDs, generated result IDs and exact INSERT/PATCH fields; reject DELETE/upsert/general updates. |
| Managed Auth | Only password/refresh token, user/JWKS and local logout routes; dedicated browser profile and A/B sessions only. No signup, recovery, invite, OAuth, link-identity, MFA or Auth-admin runtime endpoints. JWT hook must already be absent or independently proved non-mutating and compatible; never change it for this task. RLS self-membership must work without custom tenant claims. |
| Payment | Intercept Next SERVER fetch before any network request, using only dummy key and synthetic A data. Return synthetic Snap token and reserved .invalid redirect, then fulfill/abort browser navigation locally before DNS. Production and sandbox Midtrans/status/confirm/webhook calls all denied. No payment settlement, paid state, activation or provider call. Browser interception alone cannot contain server checkout. |
| Email/portals/automation | Resend/portal/cron secrets absent; default-deny egress additionally blocks their hosts. No global mail/config changes. Reject inbound cron, public provisioning, billing webhook/confirm/legacy checkout, onboarding and admin routes in the future harness. Existing DB schedulers, triggers, webhooks and queued jobs need independent operator containment; missing secrets do not prove it. |
| Network | Deny by default in server, Next workers/proxy and browser. Allow only pinned DEV Auth/scoped REST and loopback assets after all gates. Native fetch, SDK/undici and alternate HTTP/socket transports need coverage and smoke evidence. The present module is NOT a firewall, preloader, child-process wrapper or complete transport interceptor. No live delegation exists. |

Future bounded UAT: maximum 30 minutes, two fresh test users, one successful
synthetic checkout, one monthly plan, no parallel submissions. First run HTTP and
browser read-only Home/Systems/Support/Billing GET and prove zero billing signing,
financial writes and provider requests. Then A requests B's tenant, revoked A
membership, wrong A role, mismatched A tenant Owner FK, suspended A and malformed/
Company/mapping input. Only exact test rows may change and must be restored between
negative cases. Negative cases must leave zero financial rows. Session/logout
revocation behavior needs managed evidence; no claim of immediate JWT invalidation.
Finally restore valid A and submit once: expect at most one unpaid subscription,
one awaiting_payment invoice, synthetic Snap response, no events/paid state. Test
HTTP plus desktop and 390x844 browser behavior; all unexpected network activity or
state drift stops the run. Existing-subscription rejection can reuse that final
row. No renewal, cross-portal login, real payment or Company authority claim.

## Cleanup and recovery proposal

Preparation failure rolls back its single SQL transaction; Auth administration and
API exposure are separate provider operations and do not roll back with SQL.
Stop further work on any mismatch. Preserve sanitized receipts; never retry a
financial operation or delete/adopt a collided schema/user.

Explicit cleanup authority must cover only this newly created schema and the two
receipt-bound new Auth users. Restore exposed-schemas to its exact recorded value.
After any later runtime, stop the task process/browser, revoke ONLY its sessions,
verify no in-flight requests/jobs, then perform reviewed cleanup as postgres:
DROP TABLE test-schema subscription_invoices, subscription_events, tenant_members,
tenant_subscriptions, tenants, subscription_plans, platform_settings in dependency
order, all RESTRICT; DROP SCHEMA h1_first_purchase_test RESTRICT. Never CASCADE,
TRUNCATE, broad DELETE, trigger suspension, or alter/drop any public/private object.
If non-task dependencies/rows appeared, STOP and preserve state; no forced cleanup.
`cleanup.PROPOSED.sql` pins that drop order, refuses foreign rows or paid state and
retains the same unconditional refusal/ROLLBACK safeguards. It still requires
independent creation/ownership receipts and a reviewed execution derivative.
Only after foreign keys are gone, Owner deletes the two exact newly created Auth
UUIDs through DEV administration. Verify absent fixtures/schema/sessions, restored
API exposure, unchanged protected Registry/Auth baseline and no delivered mail or
external calls. Standard provider audit/security metadata is not claimed erased.
Private runtime input/cache deletion needs exact task-path authority and preservation
checks; no cleanup of earlier task directories or protected worktrees.

## Offline verification and decision

Run only `node --test docs/security/h1-first-purchase-isolation/isolation.test.mjs`
from the existing worktree. Node standard library only; no install/server/provider.
The suite verifies deny defaults, dummy-only in-memory payment responses, DEV
descriptor/schema restrictions, refusal guards, proposed table/column/fixture
closure, and unchanged application/security source pins. These are STATIC/UNIT
facts, not SQL compilation, managed Auth/RLS, DB runtime or browser proof.

Current blocker to managed preparation is **unproved DEV DDL/Auth/automation
non-interference with protected Registry state**. The no-cost alternative is the
existing in-memory first-purchase tests plus this offline sink, with no credentials
or provider access. No additional project, paid tier, installation or lock change
is proposed. One next approval is the bounded conditional DEV-preparation packet
above, including exact cleanup authority; it grants no runtime/UAT authority and
cannot waive any unmet safety precondition.
