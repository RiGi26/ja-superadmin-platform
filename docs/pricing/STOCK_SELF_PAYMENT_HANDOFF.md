# Stock self-payment implementation and acceptance

Status, 2 November: the three reviewed forward migrations and the additionally approved intent-plan index are installed in the fixed Production Core/Stock projects with disabled sandbox settings. Exact-source Stock and Core deployments are promoted and Ready. Two fresh native signup requests reached the verification acknowledgment; Owner email verification is pending. Public sales, paid-runtime source switches and sandbox cohorts remain closed. No Company, invoice, charge or activation was created during this signup stage. The complete hosted purchase journey remains unverified.

## Index correction and verification requests — 2 November continuation

The Owner selected two Gmail +aliases for fresh Basic/Pro sandbox accounts and will verify the emails. On the exact additional-index question, the Owner answered “pilihkan yang paling tepat,” delegating the choice. The recommended application of the unchanged reviewed SQL was selected; this did not grant sales, runtime or data enablement.

The exact SHA256 `0ef26405120958d8d3f56ef9478004a6b7c203708dec550f2d3433fa3dde405e` proposal was installed as provider-issued migration `20261101232959_stock_self_payment_intent_plan_index_20261102`. Managed read-back confirms a valid, ready B-tree index on `stock_billing_private.intents(plan_id)`. The task's unindexed-FK advisor finding is now absent. Settings remain disabled/sandbox, with zero intents and cohort rows. The original proposal bytes are retained as installed history and must not be replayed.

Basic and Pro registrations used the existing public Hub signup UI and two separate browser contexts, retaining their selected package. Each form was submitted once, consented to account creation/verification email, and reached “Periksa email Anda.” This generic acknowledgment does not prove inbox delivery, confirmed email or a fresh authenticated session. No Auth-admin confirmation, email-policy bypass or direct Auth SQL was used. Full inbox addresses, credentials, cookies and PKCE state are excluded from source/evidence; only the fixture tags `+stock-basic-20261102` and `+stock-pro-20261102` are recorded. Credentials remain only in ephemeral controller memory.

The two registration contexts remain open for Owner verification; the existing signed-in browser context was preserved. Verification must use the matching registration context because the callback requires its PKCE cookie. A user status question is pending. No verification token should be copied into chat or evidence. The initial Basic acknowledgment wait observed an empty route-announcer element; its final success heading was subsequently verified without submitting again. A corrected wait was used for Pro.

Current boundary: email verification and fresh native identity proof remain pending. Paid source gates, private settings, cohort enrollment and public offers remain closed. The next dependent step is verification of these exact fresh accounts before preparing the finite Company/resource cohort and runtime prerequisites.

## Closed rollout — 2 November 2026

The preceding handoff named coordinated closed-sales receiver deployment, exact forward migrations and bounded sandbox acceptance as the next gate. The Owner then instructed “oke go a head.” Execution used that authority for the three reviewed migrations and exact-source Stock-before-Core deployments in the two existing projects, with no default-branch merge, public sales, real charge, existing customer mutation or secret export. The subsequent continuation above resolves the inbox choice and exact additional index. Sandbox activation still requires established fresh verified identity and isolation.

Fresh preflight confirmed both PR heads and passing CI, unchanged default branches and Production aliases, Vercel account/team/project identity, and exact Core/Stock database URLs. Repeating the approved metadata reviews returned the identical Core 17-function contract and Stock eight-function/five-table private contract, with matching wrappers. Exact read-only installation preflights passed before DDL.

| Database | Provider-issued migration | Result |
| --- | --- | --- |
| Core `hxhusfkrlafxdnyasmsu` | `20261101224842_stock_self_payment_core_closed_20261102` | Installed unchanged from reviewed proposal; disabled sandbox settings |
| Core `hxhusfkrlafxdnyasmsu` | `20261101224847_stock_paid_active_core_closed_20261102` | Installed unchanged; paid-session tables empty |
| Stock `oyyfcmlquqfrdoffkgsd` | `20261101224850_stock_self_payment_receiver_closed_20261102` | Installed unchanged; receipts and write permits empty |

Managed read-back verified all 36 installed function bodies against committed proposal bodies, 11 forced-RLS private tables, expected restricted function grants, enabled audit/history triggers, and unchanged eight private Stock active-access functions. Both settings rows are `enabled=false`, `payment_mode='sandbox'`. New task tables are empty. Both Stock offers retain exact monthly prices and remain inactive/not for sale. This is **DB RUNTIME PASS for closed installation only**; paid behavior remains NOT_EXECUTED.

Security advisors identify the intentional deny-all private tables and authenticated `SECURITY DEFINER` read/context interfaces. Their exact reviewed native-session, Owner and resource predicates and direct-access restrictions remain required. New unused indexes are retained. The initial Core `intents.plan_id` covering-index finding was resolved by the separately approved forward correction above; installed proposal bytes remain unchanged. No blanket advisor-clean or security-release PASS is claimed.

Exact source export verified 474 Stock files at `de90ae979c0d5eaef59e80a9b7af5d0307be8309` and 417 Core files at `e06640ab3bda598100368db46aabd696ac0fad4c`. An initial Core archive comparison caught local CRLF conversion before upload; exporting with `core.autocrlf=false` preserved every Git blob byte. Failed exports remain in task scratch. Only non-secret existing Vercel project binding metadata was added outside the source tree. Unrelated Core `.gitignore` work and the isolated-CI archive are excluded.

| Application | Promoted Production deployment | Verified alias |
| --- | --- | --- |
| Stock | `dpl_8D9f94vmFPCyP1umQNZvEN3vnC5x`, `https://webzoka-stock-platform-2p4im8c5b-rigi26s-projects.vercel.app` | `webzoka-stock-platform.vercel.app` |
| Core | `dpl_39hnnjYRQvDqhiGe4b9kUMEwv8ji`, `https://ja-superadmin-platform-9vch4y9xr-rigi26s-projects.vercel.app` | `hub.webzoka.com` |

Both were staged with Production configuration and automatic alias assignment skipped. Existing Vercel protection blocked anonymous staged access; no protection setting or bypass credential was changed. Stock was promoted first, then its public receiver returned `503 {"error":"activation_closed"}` and login returned 200. Core was promoted afterward. Read-only inspection confirmed both canonical aliases resolve to the Ready candidates above. Default branches remain unmerged.

Anonymous HTTP smoke passes **12/12**: closed Stock receiver, Stock login, exact closed quotes on Core and Hub, Basic/Pro sign-in continuations, and authentication gating for invalid selectors. The initial run had six incorrect expectations that page validation preceded proxy authentication. Source confirmed the proxy runs first. That failed run is retained as `closed-http-smoke-initial.json`; only the harness expectation was corrected, with authenticated selector/financial denial explicitly remaining NOT_EXECUTED.

Separate anonymous browser contexts verify **9/9** login continuations: Basic/Pro survive; annual, price, unknown-plan, foreign-platform, invalid-Company, duplicate-plan and external returns are discarded before signup continuation. Contexts were closed after use. The original browser context already had a Core session, was not treated as a fresh fixture and was not cleared. Store DOM checks at 1440×1000 and 390×844 show the two approved prices, 48px consultation controls, closed-sales notice and no purchase controls or horizontal overflow. Stock login DOM checks at both sizes show no horizontal overflow; mobile inputs use 16px text and controls meet the measured 44px minimum. These are navigation/DOM results, not visual acceptance.

Fresh screenshot attempts on 2 November failed because Playwright rejects the required Temp path as outside its allowed roots. The alternate browser reported `Local browser use is disabled in Work settings`. No path restriction, protection setting or local setting was bypassed. Desktop/mobile screenshots and the full paid journey remain open.

Post-smoke database read-back confirms disabled sandbox settings and zero task intents, billing accounts, cohort rows, deliveries, events, paid sessions, receipts and write permits. Four disposable PostgreSQL index checks pass: closed/empty install, rejection when enabled, rejection with an intent row, and rejection without replacing an existing index. The additional index was subsequently approved, installed and verified as recorded above. The inbox choice is resolved; actual verification is pending.

Current detailed metadata, advisor findings and archive manifests are in the existing task scratchpad under `closed-rollout-20261102`; the adjacent evidence JSON retains the durable summary. Sandbox gateway, fresh-account operational access and full browser/mobile acceptance remain NOT_EXECUTED. Migration-history/evidence commits after the deployed refs do not change the running application bytes or Stock's paired Core application pin.

## Source phase — completed 1 November 2026

Source-publication authority: the Owner selected **“Approve source PR/CI and closed Previews”** on 1 November 2026. Both application candidates now have passing exact-source CI: [Core #60](https://github.com/RiGi26/ja-superadmin-platform/pull/60) and [Stock #14](https://github.com/RiGi26/webzoka-stock-platform/pull/14). Automatic Git deployments were disabled for `feat/basic-pro-pricing-prep` in both committed configurations before push. [Vercel's branch deployment configuration](https://vercel.com/docs/project-configuration/git-configuration) documents this behavior. No Preview was created, and no default branch was merged. No Production deployment, database write, fixture or payment authority follows from this source-publication approval.

Stock CI passes 284/284 script checks (282 existing checks plus two exact applied-pricing-history checks), 96/96 module checks and 25/25 disposable PostgreSQL checks against the paired immutable Core candidate. No denial assertion was removed. The PDF job also passes after adding an explicit paid-storage mock and denial scenarios to the issuance harness. The 35 local renderer/action/download scenarios pass; provider Storage remains untested. Pro's three-operator capacity is enforced, while the existing protected team-account creation restriction remains unchanged; actual additional-operator provisioning is still part of authorized hosted acceptance.

1 November update: the Owner-approved Stock and Core dependency reads are complete. The Core live-session helper also requires unrevoked OAuth consent for the fixed Stock client; tests now use that exact reviewed function. The receiver successor checks all 11 reviewed Stock function hashes, private forced RLS and history/audit triggers before installation. It preserves the eight private access functions and the installed pilot/quarantine guard body, adding only a separate receipt-controlled paid branch. Initial mapping, native subject admission, profile activation, audit and receipt are atomic. Deployed application overlays remain reconciled with the pricing and purchase work. See `STOCK_PAID_ACTIVE_CORE_REVIEW_20261101.md` and `STOCK_SELF_PAYMENT_REVIEW_20261101.md`. No Production mutation occurred.

## Implemented behavior

The purchase path is `/checkout/stock?plan=<approved-plan-id>` on the dedicated Hub hostname, mapped to `/hub/checkout/stock` internally.

| Offer | Plan ID | Monthly IDR | Rights |
| --- | --- | ---: | --- |
| Basic | `5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001` | 149000 | One active operator; orders, catalog and inventory |
| Pro | `5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002` | 359000 | Three active operators; Basic plus purchasing and finance |

The approved catalog determines price, monthly period, features and seats. Public quote, Store buttons and authenticated checkout use that catalog. Trial stays separate through the team. Annual offers, automatic debit, self-service trial, legacy-plan migration and LMS sales activation are absent.

The selected package survives login and verified signup through a closed return-path allowlist. Intent storage contains selectors only. The customer selects a verified owned Company, or prepares a new Company using the existing E1 flow. Reciprocal Stock binding must exist before payment. Preparing a workspace or remembering an approved price choice does not create a charge or activate Stock.

The Company adapter resolves Company, reservation, Core billing tenant and Stock resource on the server. It independently checks current native identity, session and Owner membership. An opaque request-local proof authorizes the existing financial engine. The shared engine rejects a legacy billing token or serialized imitation for a managed Company purchase, and rejects a new Basic/Pro purchase through a legacy token on an unmapped business. Old-plan renewals remain unchanged; a previously paid exact versioned contract can still renew monthly. Initial subscription and invoice triggers also reject revoked ownership or expired authorization. Existing-business ownership disputes still require the protected verification process.

Checkout persists its order before gateway I/O. A valid issued checkout is reused. Unknown provider responses remain pending; this path never repeats an uncertain charge. Authorized invoice history includes a recheck action using the existing provider-status verifier and atomic payment commit. Verified cancellation or expiry closes only the existing issued invoice; paid retries repair delivery without another charge or paid period.

The verified payment transaction records invoice, subscription, audit and an immutable activation reference together in Core. Delivery happens after commit using the existing signed transport secret. Stock verifies the signature, bounded payload, fresh native identity and exact reciprocal resource before one atomic activation RPC. Receipts are idempotent. Audit failure rolls back activation while Core retains the paid record. Pending deliveries retry through the existing lifecycle cron and explicit invoice recheck; reconciliation rotates attempted deliveries and excludes revoked Owners.

**Recovery timing:** the existing lifecycle cron runs daily (`0 1 * * *`). No new scheduler or cost was introduced. Customer invoice recheck can request an earlier repair. A faster background recovery commitment remains an explicit release decision.

The paid SSO source requires Core enrollment using both native credentials, then the installed Stock resolver and its online assertion, then the same reciprocal paid context. Denial never falls through to pilot or legacy authority. The only paid destination is the fixed Stock dashboard. Unpaid resources keep quarantine behavior. The receiver establishes the matching admitted subject and immutable Core mapping in local PostgreSQL tests; hosted Stock access remains unverified. Generic entitlement mirrors can restrict a matching paid period without granting or resurrecting access. Existing server upload/document bridges require a current paid decision, while native Storage and Realtime restrictions remain unchanged.

Paid login uses an independent gate. Overlapping paid and pilot runtime modes deny before exchanging an authorization code; the contained pilot mode must be verified retired before a paid rollout. This task changed no provider flag or existing pilot record.

Tagihan shows only current authorized Company subscriptions, invoices and activation state. A paid-pending order does not expose another payment button. The payment finish page directs managed Stock customers to activation status and does not claim Stock active prematurely.

## Source and deployment baseline

| System | Checkout and repository | Source baseline |
| --- | --- | --- |
| Core | `.wt-customer-hub-core`, `RiGi26/ja-superadmin-platform` | Published application `d3efccb474403a60753e965df853c2ed5fec3388`; reviewed main `ace57932005735bee6a341f46f0e12bd68560a4f` |
| Stock | `.wt-webzoka-stock-pdf`, `RiGi26/webzoka-stock-platform` | Published application `de90ae979c0d5eaef59e80a9b7af5d0307be8309`; reviewed main `0cb0298da1062f8047aee1a6074706a6da047466` |

Both existing checkouts use `feat/basic-pro-pricing-prep`. Prior pricing work was preserved. Core main was integrated into the feature branch, with an identical tree to the reviewed application commit `5f9b03f`; this was not a default-branch merge. Stock CI pins the exact Core application commit above. A subsequent Core documentation-only update records this handoff without changing the paired source. Original historical source hashes remain unchanged; exact Stock successor deltas reconstruct those baselines and reject adjacent changes. Historical migration files were not edited. Core's unrelated `.gitignore` change and `docs/security/h1-g1-e1-isolated-ci.zip` remain excluded and preserved; Stock is clean.

Published application checks:

- [Core source CI](https://github.com/RiGi26/ja-superadmin-platform/actions/runs/41323920776/job/124899762293): PASS, including UNIT, types, scoped lint, full synthetic build and successor whitespace.
- [Stock source CI](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/41325064026/job/124903168558): PASS, including 284 script, 96 module and 25 PostgreSQL checks, types, scoped lint, build and history/whitespace checks.
- [Stock PDF CI](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/41325064022/job/124903168735): PASS, including engine/rendering/issuance checks and build. The earlier harness failure is retained in the evidence JSON with its resolution.

The adjacent evidence JSON fingerprints committed Git blob bytes at these immutable application refs, including scripts. Its previous raw-workspace fingerprint is retained as a historical snapshot. Documentation-only commits do not require changing Stock's paired application pin; the final Core PR-head CI must still pass.

Read-only Production metadata was checked under Vercel account `rigi26`, team `team_MGLKh5XmYFCwtCh6CjyaaL6f`, on 30 October 2026:

| Public target | Deployment ID | State and creation time |
| --- | --- | --- |
| `hub.webzoka.com` | `dpl_66HhhsgPQD3p6jgPTa5ryJ6aBTKA` | Production Ready; 30 October, 13:30:48 WIB |
| `webzoka-stock-platform.vercel.app` | `dpl_BPPdu9YKqWpPhVDerk2brgji1EFC` | Production Ready; 30 October, 12:42:38 WIB |

Core GitHub main predates the observed deployment. The retained execution archive links the observed Core deployment to sealed r6 source tree `111f5d929fe787fd2012f12e1de5afc8a9e997cd39bb594a3421fcfb0ba14658`, and Stock to sealed r3 source tree `1e2b9a298d44ae61516b124c680fafa5fc12f59c111d3f8435382350c0019d89`. Incoming hashes were checked against those manifests before local reconciliation. Earlier checkout bytes were preserved in the task scratchpad. The merge restores current authorization routes, native login, pilot protections and the monthly-only billing upgrade fix. This establishes source context, not current managed DB compatibility or release acceptance. The Vercel connector returned 404; the installed CLI resolved the exact aliases. No provider environment values, customer rows or sensitive logs were read.

## Closed gates and sandbox design

All new gates remain closed by default:

- Core `STOCK_PAID_BILLING_RUNTIME_ENABLED=false`.
- Core `STOCK_BASIC_PRO_RELEASE_AUTHORIZED=false`; existing LMS/global fuse remains false.
- Stock `STOCK_PAID_ACTIVATION_RUNTIME_ENABLED=false`.
- New Core and Stock private SQL settings install with `enabled=false`, `payment_mode='sandbox'`.
- The new Company sandbox cohort installs empty. No enrollment SQL was run.

The existing sandbox helper retains its legacy cohort behavior. The additional Company cohort grants only a temporary sandbox eligibility decision for an exact already verified E1 Company and resource. It does not grant ownership. Enrollment is bounded to six hours, cannot be extended or reenabled, and remains retained after disabling. Both ordinary public offers can stay inactive and not for sale during sandbox acceptance. The customer sees an explicit sandbox notice only for a verified eligible Company. Unenrolled and foreign Companies remain unable to pay.

The helper still uses the existing fixed Core realm and Hub origin. A different test database, Auth realm or hostname is not silently substituted. Those targets require a separately approved configuration and identity review.

## SQL proposals and authority

At the 1 November source gate, these files were review inputs only. The three self-payment proposals and subsequent intent-plan index correction were installed unchanged on 2 November, as recorded above and in the provider-issued source migration files. They are retained installation history and must not be replayed.

| File | Exact target | Scope |
| --- | --- | --- |
| Core `STOCK_SELF_PAYMENT_BASELINE_READONLY.sql` | Core `hxhusfkrlafxdnyasmsu` | Function hashes/ACLs, schema columns and the two approved catalog rows; no customer or Auth rows |
| Stock `STOCK_SELF_PAYMENT_BASELINE_READONLY.sql` | Stock `oyyfcmlquqfrdoffkgsd` | Function hashes/ACLs, schema columns and relevant trigger metadata; no customer or Auth rows |
| Core `ATOMIC_SUBSCRIPTION_PAYMENT.PROPOSED.sql` | Core only | Installation and exact function definition confirmed by the 1 November read-only baseline; do not replay |
| Core `STOCK_SELF_PAYMENT_CORE.PROPOSED.sql` | Core only | New private settings, intent, account, finite sandbox cohort, delivery and event tables; bounded public RPCs; subscription/invoice guards and transactional outbox |
| Core `STOCK_PAID_ACTIVE_CORE.PROPOSED.sql` | Core only | New immutable, revocable paid-session enrollment and append-only audit; current Owner, paid receipt and live Core-session checks; no replacement of pilot or existing-business authority |
| Stock `STOCK_SELF_PAYMENT_RECEIVER.PROPOSED.sql` | Stock only | New private receipt/write-permit/settings objects; atomic paid admission/activation/context/restriction and server storage-bridge RPCs; exact baseline checks; preserved pilot guard and online assertion |

The installed forward proposals failed closed on missing prerequisite objects or conflicting installed schema. They do not rewrite Registry origins or legacy subscription contracts. The source-publication approval did not grant runtime authority; the subsequent 2 November go-ahead supplies the bounded closed-rollout authority recorded above. It does not authorize unrelated SQL objects, public sales, real charges, existing-customer changes or secret export. The additional index object was separately approved and installed; completed exact read-only reviews retain their original scope.

The historical `E1_QUARANTINE_PUBLIC_RELEASE_20261026.md` explicitly excluded billing/payment activation and active Stock access, and prohibited profile reactivation/test entitlements during that quarantine release. Its runtime approval is not reused for this paid flow. New acceptance authority must explicitly cover receipt-driven initial activation of approved fresh sandbox fixtures. Direct profile reactivation or manual test entitlement insertion is not part of this implementation.

## Evidence levels — updated 2 November

Fresh final command results and source hashes are recorded in the adjacent evidence JSON. Evidence types are distinct:

| Level | Scope and limit |
| --- | --- |
| STATIC — PASS | Both repositories passed fresh type checks, scoped runtime lint and locked Next.js 16.4.1 builds, locally and in the linked CI. Synthetic CI builds are not deployed runtime acceptance. Stock retains an existing middleware-convention deprecation warning. |
| UNIT — PASS | Core: 1,229 local checks. Stock: 96 module and 284 script CI checks; 35 local PDF/action/download scenarios. Actual TypeScript modules, rendered React views, shared billing engine, native callback/CSRF behavior, signatures, request-correlated online decisions and negative controls; no provider requests occur. Historical source pins and adjacent-mutation rejection remain intact. |
| PostgreSQL UNIT — PASS | 25 checks execute the actual proposals with the reviewed installed Stock assertion, native admission/revocation guards, exact Core OAuth-consent/session helper, ACL/RLS and rollback probes. Only cross-database HTTP transport is synthetic. Checks cover acknowledgment/enrollment requirements, live Owner/consent revocation, unavailable Core, idempotent admission/audit, identity conflicts and exact baseline/trigger drift rejection. This is not managed Supabase DB runtime or gateway integration. |
| INTEGRATION — NOT_EXECUTED | Real Midtrans sandbox, cross-deployment delivery and hosted recovery require applicable execution authority. |
| DB RUNTIME — PASS (closed installation and index) | Three exact base migrations and the additionally approved index installed; 36 function bodies, 11 forced-RLS private tables, restricted grants, retained guards and disabled/empty task state verified. The index is valid/ready and its task advisor finding cleared. Paid activation and operational behavior remain NOT_EXECUTED. |
| HTTP SMOKE — PASS (anonymous only) | 12/12 checks on the promoted applications; closed activation, public login/quotes and sign-in gating. Authenticated financial negatives remain NOT_EXECUTED. Initial harness failure and corrected scope are retained above. |
| BROWSER UAT — PARTIAL | Nine anonymous return checks and public Store DOM at desktop/390px pass, with Stock login DOM checks. Fresh paid journeys remain NOT_EXECUTED. Desktop/mobile screenshot capture is BLOCKED by the fresh tool errors above; no visual/mobile acceptance claim is made. |
| PRODUCTION — CLOSED FOUNDATION AND INDEX VERIFIED | Base migrations, the additionally approved index and exact-source Stock/Core deployments are installed/promoted at the recorded IDs. Two native signup verification requests are acknowledged; verified identity proof is pending. No Company, charge, paid activation or sales enablement was performed during signup preparation. Full commercial paid acceptance is NOT_EXECUTED. |

The 30 October local screenshot attempt was blocked because Playwright rejected the required Temp destination, and computer-use initialization failed with `failed to write kernel assets ... os error 3`. Those are historical tool observations, not a fresh diagnosis of current capability. No alternate path bypassed the restriction. No mobile screenshot was retained; mobile visual acceptance and full hosted browser UAT remain open and require a fresh capability check within their authorized scope.

## Remaining acceptance and release gates — updated 2 November

1. The disabled migrations, intent-plan index and closed Stock/Core deployments are complete. Preserve online authorization, pilot lifecycle, native mapping, revocation and audit; do not replay any installed proposal or historical migration.
2. Complete Owner verification of both requested signup emails and prove fresh native identities, then establish the exact synthetic Company/resource cohort before sandbox activation. Confirm sandbox provider mode and fixed-origin compatibility without exporting secrets. Verify contained pilot-mode retirement/current applicability before enabling the independently gated paid path; preserve all retained pilot and existing-business history. Public catalog gates remain closed.
3. Complete both fresh verified-account journeys, Company preparation, sandbox payment, activation, Stock access and authorized invoice history. Enroll only the exact approved synthetic Company/resource identities; retire cohort eligibility afterward while retaining audit and paid records.
4. Run real HTTP/cookie and browser checks at desktop and 390px, including recovery, cancellation, expiry, duplicates, forged callbacks, amount/mode mismatch, Owner/member revocation and cross-tenant denial. Verify actual Basic inventory operations, Pro purchasing/finance, one/three seats, excluded features, legacy annual renewals and unchanged LMS behavior.
5. Confirm applicable customer terms before public selling: final tax/setup treatment, cancellation/refund policy, support and usage commitments, actual trial scope, privacy/terms links, provider readiness and the recovery timing above. This implementation does not invent or approve commercial/legal terms.
6. Resolve the fresh screenshot output/capture limitation through an authorized tool path before claiming visual/mobile acceptance. Authorize Stock sales separately only after security, commercial and runtime gates pass. Do not activate LMS offers as part of this release.

Current dependency applicability was checked after GitHub reported three Stock alerts: dev-only Zod 4.4.3 through the ESLint toolchain, and root PostCSS 8.5.15 through Tailwind's build tooling. Next's separate bundled PostCSS is 8.5.23. No application imports or demonstrated self-payment runtime path were found. The development/build-tool advisories remain open for release review; no unrelated dependency upgrade was made. Details and advisory links are in `stock-self-payment-evidence.json`. This is an applicability observation, not a dependency-security PASS.

## Recovery

Close the two Stock offers to new sales and close only the Stock catalog sales gate. Keep valid contracts active, keep invoices and audit history, retain the receiver and Company-aware authorization guards, and keep activation reconciliation running. Do not disable paid-runtime guards or private delivery settings as a sales rollback, delete paid records, reprice legacy contracts, migrate legacy subscribers, or revoke valid paid profiles. A pending payment or activation is not a reason to issue a replacement charge.
