# Stock Gate B: native workspace preparation and fixture freeze

Status: proposed, not execution authority. Gate A and its approved repairs are complete; Production currently runs the closed Core/Stock pair recorded in the [canonical rollout](STOCK_CLOSED_ROLLOUT_20261105.md). This proposal enables only preparation and session-selected workspace authorization. Payments, public sales, invitations and lifecycle remain closed.

## Exact source and validation

- Core source: `187a4e08028e05b5acf7022606c55ab007611522`; [source CI](https://github.com/RiGi26/ja-superadmin-platform/actions/runs/42006994939).
- Stock receiver source: `9a2fb818341352cb4aabe183d864cf5bc4a9b8b8`; [paired CI](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/42007080835), pinned to that exact Core commit; [PDF CI](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/42007080979).
- Local source suites, types and scoped lint pass. The new disposable SQL test passes three checks: Core, Stock and their parent. It executes the exact enable/read payloads, rejects a partially enabled baseline and missing/changed function, verifies rollback, enables exactly three settings, retains the closed finance/offer state and rejects replay. Native identities remain synthetic.
- All three exact-candidate CI runs PASS, including clean installs, source regressions, disposable SQL, independent PostgreSQL 17 connections, types, lint, builds and whitespace checks. Documentation-only follow-ups do not replace these application inputs.

Core changes three source fuses to true: workspace creation, membership preparation and membership runtime. Stock changes the matching two membership fuses. The paired wire bytes remain identical. Disabled-branch tests retain explicit false controls and still prove zero identity/network/database effects. No protocol validation, native identity requirement, exact Company authorization, RLS, price, payment or access rule was removed. Existing public release, general active-access, pilot, invitation and lifecycle fuses remain false.

## Requested bounded actions

1. Verify the existing provider account/team/project identities and current Gate A deployment IDs. Stage at most two new Production-target builds from committed-only exports: Stock `9a2fb818341352cb4aabe183d864cf5bc4a9b8b8` first, then Core `187a4e08028e05b5acf7022606c55ab007611522`, with aliases skipped. Both must be Ready and unaliased before promotion. Promote Stock before Core to their existing canonical targets. These are Production promotions, not Preview builds; no merge is included. Both applications explicitly set `STOCK_SSO_PILOT_ENABLED=false` at build and runtime; Core additionally sets `BILLING_SANDBOX_UAT_ENABLED=false` at build and runtime. Preserve both public release fuses, inactive/not-for-sale offers, existing secrets, project settings, protection, Node/framework/regions and disabled Git auto-deployment. Stop after two builds; no extra build/retry/cost is included.
2. Read only the non-secret redirect list and identifier of the exact existing Core OAuth client `fe3e0af9-2d84-4ec2-a750-b26bb4a81caf`, plus Core's Additional Redirect URLs. Append only the exact missing entries below through normal Auth management. Preserve every existing entry and all other Auth settings; stop on an identity mismatch or unexpected concurrent change. Do not read a client secret, create/replace a client, change Site URL, enable auto-confirm, alter templates or add a wildcard. The connected Supabase tools do not expose Auth configuration management; use its authenticated dashboard, with Owner handling sign-in/consent prompts if needed. No direct Auth-table write is proposed.
3. Verify the two reviewed applications and callback compatibility before executing the two exact enable transactions below, Stock then Core. Each locks its existing settings, checks the closed baseline and exact installed function definitions, then changes only workspace/preparation/membership settings from false to true. Run the exact postchecks afterward. These settings are global verified-customer gates; they are not a fixture-only allowlist. Only the four approved Owner identities and five named workspaces may be used for test execution. Every customer still needs current verified native identity, exact Owner/resource authority, reciprocal preparation and fresh session selection. Unpaid profiles remain inactive and cannot gain paid operational access.
4. Use normal Core forms, native email verification and the existing native Stock OAuth flow for the exact two new Owner addresses and three new Companies below. Reuse the two existing Basic/Pro fixtures for normal preparation regression. Freeze native subject IDs, generated resource selectors, command IDs and preparation receipts through the exact readback files. No Auth-admin user creation/confirmation, direct profile insertion, cookie/token copying, ownership adoption or session impersonation is allowed. Owner supplies private passwords and handles CAPTCHA/consent/security prompts. Stop on an existing-account/Company conflict rather than overwriting or substituting another identity.
5. Verify the normal signup and email pages on the exact existing Core Preview below, then make a fresh same-person sign-in at canonical Hub for workspace creation and native preparation/selection. The closed Preview intentionally retains its Gate A source; do not promote it or claim its disabled workspace controls are enabled. The origin transition is an explicit part of this test contract. No new Preview build or wildcard callback is requested.

## Exact callback additions

Existing Core Preview: `https://ja-superadmin-platform-dkqji4srl-rigi26s-projects.vercel.app`, deployment `dpl_4CNW3cxotCzbU5QvnuH4b53aBfCi`, actual environment `preview`, Ready, source `67a5b506fd9939c6b2e2932c7a568b162a8624d2`. Customer pages use `/hub/signup` and `/hub/login`; `/login` is the internal admin page. Browser inspection rendered the customer login at 390px, but no customer session/signup was attempted.

Add only these two full signup redirects to Core Additional Redirect URLs if absent. They are the exact server-generated callback values for the two plan selections, including encoded query parameters:

- `https://ja-superadmin-platform-dkqji4srl-rigi26s-projects.vercel.app/auth/callback?flow=signup&next=%2Fhub%2Fcheckout%2Fstock%3Fplan%3D5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001`
- `https://ja-superadmin-platform-dkqji4srl-rigi26s-projects.vercel.app/auth/callback?flow=signup&next=%2Fhub%2Fcheckout%2Fstock%3Fplan%3D5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002`

Add only these two redirect URIs to the existing Core OAuth client if absent:

- `https://webzoka-stock-platform.vercel.app/api/auth/stock-membership/callback`
- `https://webzoka-stock-platform.vercel.app/api/auth/stock-membership/selection/callback`

The invitation callback remains a later gate. Retain legacy/native callbacks. Core remains issuer at `https://hub.webzoka.com`; Stock stays at `https://webzoka-stock-platform.vercel.app`. The selected Preview exception covers signup/email pages only; it does not repoint native start forms or allow another issuer. This follows the provider's [exact redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls) and [OAuth client callback requirements](https://supabase.com/docs/guides/auth/oauth-server/getting-started).

## Exact SQL payloads

The canonical manifest's `gateBProposal.files` pins Git-blob SHA-256 values. Both repositories carry these three target-specific files:

- `STOCK_GATE_B_PREPARATION_ENABLE.PROPOSED.sql`: three setting updates only; no DDL or invoice/entitlement/customer mutation. Execute through the SQL tool, not as a replay of a Gate A migration.
- `STOCK_GATE_B_PREPARATION_POSTCHECK_READONLY.sql`: feature booleans and Core's two exact closed offers only.
- `STOCK_GATE_B_FIXTURES_READONLY.sql`: four exact Owner email-hash selectors and five named/fixed resources. Returns native subject IDs, resource IDs, membership revisions and verification/inactive-profile booleans; no raw email, passwords, session/token values, financial payloads or audit payloads.

Reuse the still-approved Gate A schema/grant/constraint/trigger/policy postchecks and the exact original two-fixture readbacks only within their original scope. Do not broaden those reads to unrelated customers or finance. No invoice query/write, cohort enrollment, paid receiver enablement or gateway request is included.

## Normal fixture operations

| Identity | Permitted new state |
| --- | --- |
| `egyelisyaaaaa+stock-basic-fresh-20261105@gmail.com` | One normally verified Core identity, its native Stock identity and new `Stock Fresh Basic 20261105` Company/workspace; Basic selection |
| `egyelisyaaaaa+stock-pro-fresh-20261105@gmail.com` | One normally verified Core identity, its native Stock identity; new `Stock Fresh Pro 20261105` and `Stock Fresh Pro Second Basic 20261105` Companies/workspaces; Pro and Basic selections |
| Existing Basic | Preserve Company `0c0b5c44-2af7-471e-8685-bd99438db48d` and instance `80f34350-cf08-41b4-99b9-fa3012dc37ac`; normal same-Owner preparation only |
| Existing Pro | Preserve Company `bab486e5-f50e-45ac-8dca-6ae8488104a0` and instance `1479f3e8-8e47-4a1e-a465-862260b229cb`; normal same-Owner preparation only |

At most two signup verification sends per new Owner, including one explicit resend if needed. Stop on uncertain delivery or provider restriction before issuing more. No operator email/admission, password reset, account overwrite, business attachment or deletion is included. Retain durable origin, membership, preparation and audit history. All five workspaces remain unpaid/inactive. Payment approval can be prepared only after their actual identities/resources and readiness are frozen.

## Acceptance, limits and recovery

Gate B acceptance requires actual verified native signup, reciprocal preparation and command replay for both fresh Owners and the two existing fixtures; three new workspace births; Pro-Owner Basic/Pro selectors retained independently; correct review prices/monthly periods; no invoice or paid access; and no foreign/expired authority accepted. Normal authenticated HTTP and desktop/exact-390px browser evidence must identify origin, role and exact candidate. This gate cannot establish paid workspace switching, Pro operator capacity, activation, invoice history, payment recovery or live release.

Screenshot capture is currently BLOCKED: Playwright rejects the required session scratchpad because its configured allowed output roots include only the workspace and `.playwright-mcp`. The workspace instructions require one-off screenshots in the session scratchpad. No screenshot was saved and no mobile PASS is claimed. Resolve the browser output-directory conflict before claiming visual acceptance; do not install a runtime, weaken hooks or place test screenshots in an application repository. Safe work can continue through approved source, schema/settings and normal HTTP checks.

On a failed guard, unknown write result, unexpected financial request, account conflict or target drift, stop the affected action and inspect only approved scope. Resolve the original idempotency command before any retry. Do not disable membership authorization or reverse the canonical/Auth-hook migrations as a purchase shutdown. Gate A does not grant rollback compatibility for admitted v2 state. New purchase surfaces remain closed throughout Gate B; a further recovery setting change or extra deployment requires a concrete proposal if not already authorized. Preserve valid existing contracts, invoices, activation outboxes and audit history.

Not included: payments or Midtrans sessions, sandbox cohort, paid receiver enablement, operator invitations/lifecycle, public sales, merge, live-mode smoke, new provider resources/paid plans, project secret changes, wildcard Auth origins, LMS/global billing changes, automatic debit or legacy migration. Those remain separate gates. Approval is required by the workspace `AGENTS.md` protected-authority clause for runtime, Auth configuration, deployment/Production promotions and these exact SQL operations; existing source/PR authority covers preparing this proposal.
