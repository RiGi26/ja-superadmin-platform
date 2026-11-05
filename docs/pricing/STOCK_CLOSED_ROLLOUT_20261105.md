# Stock closed rollout and remaining acceptance

Status: proposal for Owner review, 5 November 2026. This document grants no execution authority. Public sales remain closed. The complete objective remains account → verified identity → workspace → payment → active Stock → invoice history, including multi-workspace use and two real Pro operators. Source evidence is not managed-runtime or release acceptance.

## Reviewed source and evidence

The application candidates are Core `1c96621bed8682302b0baa01f959943244668262` and Stock `5b968a5fbc3c8b782464393c1bd8cfb6ed84899a`. Documentation-only follow-ups do not replace those deployment inputs. Any application, SQL, gate, dependency or callback change requires a new candidate and applicable checks before execution.

- [Core source CI](https://github.com/RiGi26/ja-superadmin-platform/actions/runs/41983918990): PASS at the exact corrected Core candidate; types, scoped lint, regression suites, source protections and build.
- [Paired Stock CI](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/41984174260): PASS at the exact Stock candidate, checking out the corrected Core candidate; scripts, modules, disposable actual SQL, independent PostgreSQL 17 connections, types, scoped lint and build.
- [Stock PDF CI](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/41984174280): PASS at the same Stock candidate.

PostgreSQL integration covers concurrent seat admission, selection, role changes, delivery, revocation and the same native session racing between v1 and v2 enrollment. Disposable/native observations remain synthetic; these results do not establish managed Auth, email, HTTP transport, payment-provider or browser behavior.

`stock-closed-rollout-20261105.json` pins the ordered forward files by SHA-256 of Git blob bytes, their application commits, installed migration observations and bounded fixtures. Export files from those commits, verify the hashes, and apply each transaction unchanged only after approval. Do not use local CRLF conversion as the approved SQL payload. Never use a similarly named retired Stock repository.

## Targets and installed history

| System | Exact target | Application origin |
| --- | --- | --- |
| Core | `RiGi26/ja-superadmin-platform`; Supabase `hxhusfkrlafxdnyasmsu` | `https://hub.webzoka.com` |
| Stock | `RiGi26/webzoka-stock-platform`; Supabase `oyyfcmlquqfrdoffkgsd` | `https://webzoka-stock-platform.vercel.app` |

Read-only Vercel discovery verified account `rigi26`, scope `rigi26s-projects`, Core project `prj_Z8taL31maerKj0AXlz65OBO8Bs6o` and Stock project `prj_nTIID94EysP6VzpfeprqiK78ouN2`. Current project inspection reports Core Node 24.x/preset Other and Stock Node 22.x/Next.js. The older Node 26 observation is historical. Core's reviewed `vercel.json` explicitly sets `framework: nextjs`; verify that effective configuration and Ready output on the new stage rather than changing the provider preset or assuming the old observation still applies. No provider configuration was changed; no environment value was read.

Exact canonical-origin deployment inspection still resolves Hub to Ready Production `dpl_7tYb2D8CLXVNKkeGP8vtAWHPpX8Y` (application output iad1) and Stock to Ready Production `dpl_2UT9SMMDa9mHosAVJChzPafrPdqc` (application output sin1). These are metadata observations of the existing closed deployments, not functional successor evidence or automatic rollback authority. Recheck them before execution and stop on unrelated deployment drift.

On 5 November, permitted non-secret metadata discovery verified both project URLs before listing migrations: Core had 20 migrations; Stock had 129. Core records pricing `20261027024106`, combined cohort/atomic payment `20261030042604`, billing `20261101224842`, paid access `20261101224847`, intent index `20261101232959` and native-identity FKs `20261103040648`. Stock records pricing `20261027024056` and payment receiver `20261101224850`. These are installed history, not forward work. The membership/workspace/operator/storage/mixed-session proposals are absent from that observation. Migration names do not prove installed definitions, grants, settings or fixture state; fresh approved SQL preflight remains required.

The manifest lists 16 Core and 13 Stock forward transactions. Install all Core transactions in their listed order and all Stock transactions in their listed order while new gates remain disabled. Both sets must pass before any new caller or gate is enabled. No installed proposal, native FK correction, cohort foundation or old preparation-enable transaction is replayed. A baseline/hash/lock failure rolls back the affected transaction and stops that installation branch; inspect drift within approved scope rather than editing away its guard.

Stock membership clones the existing reviewed HTTP 1.6 transport, including its `stock_http_private` types, options isolation, deadlines and TLS behavior. It does not install another HTTP extension. Its exact retained definition hash is a prerequisite. The disposable test supplies HTTP composite types because it cannot load that native extension; hosted transport remains a separate acceptance requirement.

## Current dependency review

Fresh production-dependency audits (`npm audit --omit=dev`) report zero findings and exit 0 in both repositories after the Core lock correction. Core's prior 2.10.32 browser-mapping package was affected by [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv). The existing Next/Browserslist ranges permit patched 2.11.x; the targeted lock-only update selects 2.11.35 and changes no other package entry or dependency declaration. No workstation package installation occurred. Exact source-history reconstruction and adjacent-change rejection tests pass, as does scoped lint; the full Core and paired CI linked above also pass.

This is not a clean full-tooling-tree claim. The preceding full audit found Core 27 findings (one critical, ten high, fourteen moderate, two low) and Stock eight moderate findings. Core's critical/high Shadcn/MCP/proxy/Zod paths are marked development-only in the lock; the app uses Shadcn's CSS, so removing its package without a replacement would break the build. Existing commands run Next, not that CLI or its MCP server. These observations narrow applicability; they do not clear the full dependency gate. Resolve applicable build/tooling findings or obtain explicit bounded risk acceptance at Gate D. Core's GitHub alert lookup returned HTTP 403/alerts disabled; no token-scope refresh or repository configuration change was made. Stock's three default-branch alerts remain open pending an authorized merge, while its candidate already locks patched Zod/PostCSS. Never use `npm audit fix --force` to downgrade Next or change unrelated dependencies automatically.

## Gate A: closed installation and receiver-first deployment

The next requested authority is limited to the following actions in the two targets above:

1. Execute the manifest-pinned read-only preflight files and the existing exact two-fixture read-back files. These reveal function/schema metadata, feature booleans and the two named prepared mappings only. No environment values, credentials, customer-wide queries, raw logs or unrelated records are included. Recheck migration metadata and deployed project/account identity before mutation. Freeze the current deployment IDs for recovery without exporting environment values.
2. Install the 29 manifest-pinned forward transactions, recording the actual provider-issued version and hash for each. Retain all baseline guards and existing Auth hooks, append-only audit, private grants, forced RLS and history. Run the manifest-pinned read-only postchecks and the existing performance advisor after DDL. Installation must leave every newly introduced setting disabled and both approved offers inactive/not for sale.
3. Stage the exact Stock candidate in the existing Stock project as a Production-target deployment with alias assignment skipped; verify Ready, `target=production`, no assigned aliases and receiver/source identity. Stage the exact Core candidate the same way only after Stock is compatible. These are Production-environment candidates, not Preview evidence. Explicit build and runtime overrides keep Core `BILLING_SANDBOX_UAT_ENABLED=false` and both applications' `STOCK_SSO_PILOT_ENABLED=false`. Public pricing flags remain false. No project-level secret, existing secret value, paid plan, protection setting or new provider project is changed. Automatic Git deployment remains disabled. No merge is included.
4. Promote Stock before Core to their existing canonical targets only if the Owner's approval explicitly includes those Production application promotions. A staged Preview alone is not permission to promote. Verify closed responses, exact deployment identities and unchanged public sales after each promotion. The candidate's new membership, creation, invitation and lifecycle source fuses remain false; this step does not enable those features, fixture signup or payments.
5. Separately stage one additional Core deployment of the same reviewed candidate with `target=preview`, the same closed switches and the existing Preview configuration. Verify its actual environment and Ready identity without exporting configuration values. This makes Gate A at most three new builds: Stock Production candidate, Core Production candidate and Core Preview. Record that exact Ready Preview URL as the proposed Core-only UAT origin before any Auth redirect allowlist change. The normal `ja-superadmin-platform.vercel.app` Production alias redirects customer pages to Hub and is not evidence of an independent UAT target. An actual hostname and deployment ID must replace the pending manifest entry before approval of that exception; no wildcard origin is allowed. A later gate-enabled source candidate may produce another Preview URL; freeze and approve that exact callback before its acceptance run. Gate A does not itself authorize Auth configuration changes.

Gate A does not include fixture/account/email operations, cohort enrollment, paid receiver enablement, payment, public sales, merchant configuration, merge or live-mode proof. If only installation/Preview is approved, stop before promotion. The older inactive-workspace approval does not authorize this new schema or application deployment.

## Callback and origin contract

Keep the native Core issuer and online decisions at `hub.webzoka.com`; keep Stock at its existing Vercel origin. Core's Stock OAuth client is `fe3e0af9-2d84-4ec2-a750-b26bb4a81caf`. Verify the current provider/client mapping rather than creating a client. The proposed exact Stock callback additions are:

- `https://webzoka-stock-platform.vercel.app/api/auth/stock-membership/callback`
- `https://webzoka-stock-platform.vercel.app/api/auth/stock-membership/selection/callback`
- `https://webzoka-stock-platform.vercel.app/api/auth/stock-membership/invitation/callback`

Retain existing `/api/auth/e1/callback`, legacy/native callbacks and protections. Any missing callback entry needs explicit Auth configuration authority for that exact URL. Do not add `*.vercel.app`, another realm, wildcard redirect, custom-domain Stock target or alternative OAuth identity as a workaround.

The Core-only UAT exception covers normal Core registration/login/verification and page checks on its selected exact Preview origin, including its exact `/auth/callback` redirect. It does not repoint Stock's native requests or authorize posting its native start forms from a new origin. Run native prepare/select/invitation transitions through the canonical Hub origin, with fresh same-person sign-in there when needed; record that origin transition in UAT evidence. Never copy cookies/tokens between origins. The approved UAT plan must distinguish Preview page evidence from canonical SSO evidence. If acceptance instead requires the entire Core journey to remain on the UAT hostname, the present pinned-origin source does not support that contract: resolve the explicit origin requirement before runtime, without widening it silently.

The Midtrans notification target remains `https://hub.webzoka.com/api/billing/webhook`; sandbox requests use the existing notification override. Stock activation and lifecycle deliveries remain fixed at `/api/billing/activate` and `/api/billing/member-events` on Stock's pinned origin. Reuse existing signing keys without reading or rotating them. Do not change global/LMS payment mode.

## Gate B: preparation and fixture freeze

After Gate A postchecks, prepare and verify an exact source-gate successor before deployment. Core requires `STOCK_WORKSPACE_CREATION_ENABLED`, `STOCK_MEMBERSHIP_PREPARATION_ENABLED` and `STOCK_MEMBERSHIP_RUNTIME_ENABLED`; Stock requires its preparation/runtime counterparts. Invitations and lifecycle remain independently controlled. Current candidates keep all those fuses false. Source edits alone are not authority to deploy the successor. Update the paired pins and rerun their required CI; do not reuse Gate A's SHA or evidence for changed gates.

Request the corresponding exact runtime setting transaction only after observing the installed closed state. Creation/preparation requires Core workspace and preparation settings, Stock workspace and preparation settings, and the current Core billing preparer. Operational selection additionally requires both membership settings and compatible signed online decisions. Stock paid receiver and paid mode remain closed until the sandbox gate. Do not enable the original general active-access/pilot engine as a substitute for membership.

Use normal forms, native email verification, native OAuth and the existing invitation interface; no Auth-admin verification, direct profile insertion, token copying or inferred email ownership. Owner enters private passwords and handles CAPTCHA, consent and security prompts. Existing-business attachment and recovery remain excluded. Create only these new businesses and aliases after applicable authority:

| Fixture | Identity and command | Business/package |
| --- | --- | --- |
| Existing Basic | Preserve email hash `80054671e626cb4ada79324f6ec1c5667ec5a99981054c38873b553f0efb9e62` and existing mapping | Company `0c0b5c44-2af7-471e-8685-bd99438db48d`; instance `80f34350-cf08-41b4-99b9-fa3012dc37ac`; Basic |
| Existing Pro | Preserve email hash `f89bad06bbc562993eaf322b3cbc001a5ddc8f8851f96207f7fd5439a02302cc` and existing mapping | Company `bab486e5-f50e-45ac-8dca-6ae8488104a0`; instance `1479f3e8-8e47-4a1e-a465-862260b229cb`; Pro |
| Fresh Basic Owner | Proposed `egyelisyaaaaa+stock-basic-fresh-20261105@gmail.com`; normal signup only | `Stock Fresh Basic 20261105`; Basic |
| Fresh Pro Owner | Proposed `egyelisyaaaaa+stock-pro-fresh-20261105@gmail.com`; normal signup only | `Stock Fresh Pro 20261105`; Pro |
| Additional Basic | Same fresh Pro identity; new durable creation command | `Stock Fresh Pro Second Basic 20261105`; Basic |
| Operator 1 | Previously approved `egyelisyaaaaa+stock-operator1-20261103@gmail.com` | Fresh Pro workspace; `staff` |
| Operator 2 | Previously approved `egyelisyaaaaa+stock-operator2-20261103@gmail.com` | Fresh Pro workspace; `produksi` |

The two fresh Owner aliases are proposals, not a claim of account authority or creation. Reuse existing operator accounts if present; never bypass a conflict by substituting another identity. Freeze normalized addresses and all actual Core/Stock native subject IDs, Company/instance/tenant/Owner-member/profile IDs, origin versions, command IDs and preparation receipts in the runtime fixture manifest before enrolling payment eligibility. Pending IDs are explicitly `null`; inventing them cannot satisfy this gate. Keep tokens, passwords, invitation capabilities and raw session data out of Git/evidence.

## Gate C: five bounded sandbox purchases

Only after actual fixture IDs and reciprocal readiness are confirmed, produce the exact five-Company cohort SQL and its close command against those IDs for Owner review. This proposal intentionally cannot authorize an unfrozen list. Use `stock_billing_private.sandbox_cohort`, not the historical public-tenant cohort workaround. Each row has at most a six-hour eligibility window. Retain its immutable identity and history; retirement changes only `enabled` from true to false. No public plan row is activated for testing.

Five successful purchases are permitted only by a later explicit sandbox grant: existing Basic, existing Pro, fresh Basic, fresh Pro and the fresh Pro Owner's additional Basic workspace. Basic is Rp149,000; Pro Rp359,000; monthly only; aggregate successful sandbox face value Rp1,165,000; no real charge. One durable checkout/invoice per purchase slot. Stop at five successes, an unexpected Production-mode request, an unknown financial result or an out-of-manifest identity. Recover the original checkout/invoice before any new attempt.

Proposed negative-order bound: at most two additional identified sandbox invoices, one canceled and one expired, attached to the fresh Basic fixture. These are separately numbered `N1` and `N2`, never paid, never counted as success and never repaired by another charge. Forged/amount/mode/annual/foreign-selector tests reuse known references or reject before invoice insertion; they do not authorize more financial rows. Expiry uses the normal provider deadline; do not rewrite timestamps or forge a verified settlement.

The sandbox successor needs Core `BILLING_SANDBOX_UAT_ENABLED=true`, exact Company eligibility and Stock-specific sandbox mode, compatible paid activation and membership receivers, and separately enabled operator/lifecycle source and database settings. Keep both public release fuses, LMS release, public offer rows, pilot mode and automatic debit closed. Never change an issued invoice's mode. Preserve existing key use without printing values. A missing receiver, key availability, email delivery or merchant setup is a gate failure, not permission to weaken verification.

## Requirement review and runtime acceptance

| Requirement | Source evidence at the paired candidates | Still required before acceptance |
| --- | --- | --- |
| Genuine workspace birth beside v1; exact Owner; no legacy adoption | `stock-workspace-create`, workspace Core/Stock proposals; birth/provisioning SQL tests | Two fresh verified Owners; generated IDs; managed audit, mappings and rollback/denial observations |
| Per-workspace command recovery; package/business switching | Checkout actions/page, `stock-purchase-policy`; workspace intents and prepare tests | Login expiry/uncertain response recovery without losing either command |
| Reciprocal readiness before finance | Membership prepare/confirm bridges; financial guards and expired-session SQL cases | Native Core/Stock confirmation; zero financial rows before readiness |
| Fresh selection, mixed v1/v2, revoked history and no cache authority | Membership select/canonical/Auth hook; mixed-session and PG17 races | Actual native sessions, customer RLS, Basic → Pro → Basic; old-session denial |
| Verified invitations; Owner + two Pro operators; Basic one seat | Invitation/mail/commit/confirm proposals, sender/receiver composition and concurrent admission | Real email, matching native identities, two admissions, fourth-seat denial, Basic extra-seat denial |
| Roles, revocation, cancellation, expiry and audited delivery | Lifecycle/closure proposals and independent PG17 CAS/delivery races | All operational roles; Owner-only billing; last-admin/Owner protection; offline/lost-response retry and stage cleanup |
| Documents, uploads and direct access use selected workspace | Exact storage reader, repeated privileged checks, actual document RLS and PDF tests | Customer-session RLS, foreign file denial, revocation/selection mid-operation; preserve Storage/Realtime restrictions |
| Server price, monthly period, issued mode and atomic payment | Payment-mode reader, existing engine, source guards and actual SQL | Five real sandbox completions; forged/duplicate callbacks, mismatches, cancellation and expiry |
| Bounded activation/recovery; no second charge | Three attempts/24-second budget, five-minute polling/manual check, retained outbox and daily reconciliation | Receiver outage/lost acknowledgment recovery; invoice/receipt count unchanged |
| Functional package controls and invoice-to-Stock entry | Source-gated purchase buttons, readiness and billing controls | Closed during sandbox; after release authority, working Basic/Pro controls and `Buka Stock` only after activation |
| Basic/Pro feature isolation; legacy annual; LMS unchanged | Catalog, billing, preserved source pins and module/SQL regressions | Both paid portal contracts; direct excluded-route denial; authorized bounded legacy/LMS regression without activating their sales |
| Desktop and exact 390px | Source layout and component regressions only | Full hosted journey screenshots at desktop and actual 390px image width, settled fonts, no horizontal overflow or covered controls |

For HTTP, use each fixture's own normal cookie/native session. Record method, path, expected/actual status and financial row-count delta for own, foreign, revoked, operator, manipulated selector/price and annual cases. Service-role checks cannot substitute for authenticated RLS. For browser UAT, record the exact candidate, deployment ID, environment, origin, role/workspace and screenshot for each scenario. Keep Preview, managed DB, sandbox and Production claims distinct. Report unrun checks `NOT_EXECUTED`; report attempted obstructions `BLOCKED` with the fresh reason. Do not claim mobile PASS from a resize command or a screenshot with another pixel width.

Retire cohort eligibility at the end of the window and verify all five rows are disabled, public offers still closed, exactly five successful paid invoices, at most the two separately recorded negative invoices, expected activation receipts, retained audit and no unintended test data. Delete only specifically approved disposable operational rows through normal authorized controls; retain subscription, invoice, receipt, membership/revocation, invitation and audit history. Sandbox acceptance does not authorize a refund, live charge or deletion of financial history.

## Recovery and public release

Recovery closes new purchases only: disable the sandbox checkout switch and the five cohort rows; public release flags and offers remain closed. Do not disable membership/authorization, signed delivery, paid receipt verification, activation retries or valid existing subscriptions as a purchase shutdown. Never rerun the historical preparation-close SQL against paid state. If a deployed defect requires a source rollback, first prove that the proposed prior application remains compatible with admitted v2 resources and retained session history; the pre-v2 application is not automatically a safe rollback. Preserve database forward history and deny unsafe requests while preparing a reviewed fix.

Gate D remains separate: current security/dependency findings resolved or explicitly accepted by the applicable authority; merchant readiness; Owner-approved tax/setup, cancellation/refund, support, privacy and trial terms; explicit merge, Production deployment and Stock-only financial/sales enablement authority. Keep general/LMS release false. No self-service trial, annual offer, automatic debit, legacy migration or LMS sales activation is included. Freeze the release candidates and reviewed sales-open/sales-close commands before requesting that authority.

Gate E requires a separately authorized real Production-mode smoke: normal account and workspace → correct live-mode monthly invoice → verified real payment → activation → authenticated Stock operation → invoice history, with bounded amount, identities and cleanup/refund policy approved in advance. No live smoke is executed from sandbox authority. Until that proof passes, subscriptions are not reported live.

## Current handoff

STATIC / UNIT: PASS at the corrected paired candidates above, including the browser-mapping lock correction and protected-history checks. INTEGRATION: PASS for disposable SQL and actual PostgreSQL 17 concurrent connections; real cross-provider integration remains NOT_EXECUTED. DB RUNTIME, HTTP, hosted BROWSER UAT, PAYMENT/RECOVERY and PRODUCTION: NOT_EXECUTED for this successor. Historical closed preparation is not reused as successor acceptance. Production changed by this source/proposal continuation: NO.

Next material authority: Gate A's exact metadata/settings/fixture reads, 29 forward transactions and closed Stock-first deployments, with promotion authority stated explicitly. Subsequent gates require the actual runtime manifest and reviewed successors; this document does not request a blanket financial or public-release grant.
