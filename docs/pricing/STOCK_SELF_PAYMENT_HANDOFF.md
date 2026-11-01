# Stock self-payment implementation and acceptance

Status: local implementation and source verification; authorized source publication is in progress. Managed sandbox acceptance and release remain pending. The receiver successor preserves the reviewed installed access contract. Public sales remain closed. No Production deployment, provider SQL write, customer-account creation or gateway payment has occurred. Local checks do not prove the complete hosted purchase journey.

Source-publication update: the Owner explicitly approved commit, feature-branch integration, push/draft PR/CI and closed Previews in the two existing projects. That phase is in progress. Automatic Git deployments are disabled for `feat/basic-pro-pricing-prep` in both source configurations before push; this prevents an unverified Production branch setting from publishing the candidate. [Vercel's branch deployment configuration](https://vercel.com/docs/project-configuration/git-configuration) documents this behavior. No Production deployment, database write, fixture or payment authority follows from this source-publication approval.

The wider existing Stock script suite was added to pre-publication checks: 282/282 pass after supplying explicit disabled paid-module mocks and checking the moved login client. No denial assertion was removed. Source CI retains those scripts and now also runs the 96 Stock module checks and 25 disposable PostgreSQL checks against the paired immutable Core candidate. Pro's three-operator capacity is enforced, while the existing protected team-account creation restriction remains unchanged; actual additional-operator provisioning is still part of authorized hosted acceptance.

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
| Core | `.wt-customer-hub-core`, `RiGi26/ja-superadmin-platform` | Local HEAD `4e4937ca55fada4856a2c10551a4f3c01e212045`; reviewed upstream `ace57932005735bee6a341f46f0e12bd68560a4f` |
| Stock | `.wt-webzoka-stock-pdf`, `RiGi26/webzoka-stock-platform` | HEAD/main `0cb0298da1062f8047aee1a6074706a6da047466` |

Both existing checkouts use `feat/basic-pro-pricing-prep`. Prior pricing work was preserved. Core upstream UI/signup changes were reconciled locally without moving HEAD, changing the index, or overwriting unrelated work. Original historical source hashes remain unchanged; exact Stock successor deltas reconstruct those baselines and reject adjacent changes. Historical migration files were not edited.

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

No proposed SQL has been applied by this task. Files are executable review inputs, not evidence of installed database state.

| File | Exact target | Scope |
| --- | --- | --- |
| Core `STOCK_SELF_PAYMENT_BASELINE_READONLY.sql` | Core `hxhusfkrlafxdnyasmsu` | Function hashes/ACLs, schema columns and the two approved catalog rows; no customer or Auth rows |
| Stock `STOCK_SELF_PAYMENT_BASELINE_READONLY.sql` | Stock `oyyfcmlquqfrdoffkgsd` | Function hashes/ACLs, schema columns and relevant trigger metadata; no customer or Auth rows |
| Core `ATOMIC_SUBSCRIPTION_PAYMENT.PROPOSED.sql` | Core only | Installation and exact function definition confirmed by the 1 November read-only baseline; do not replay |
| Core `STOCK_SELF_PAYMENT_CORE.PROPOSED.sql` | Core only | New private settings, intent, account, finite sandbox cohort, delivery and event tables; bounded public RPCs; subscription/invoice guards and transactional outbox |
| Core `STOCK_PAID_ACTIVE_CORE.PROPOSED.sql` | Core only | New immutable, revocable paid-session enrollment and append-only audit; current Owner, paid receipt and live Core-session checks; no replacement of pilot or existing-business authority |
| Stock `STOCK_SELF_PAYMENT_RECEIVER.PROPOSED.sql` | Stock only | New private receipt/write-permit/settings objects; atomic paid admission/activation/context/restriction and server storage-bridge RPCs; exact baseline checks; preserved pilot guard and online assertion |

The forward proposals fail on missing prerequisite objects or conflicting installed schema. They do not rewrite Registry origins or legacy subscription contracts. Inspect the SQL object inventory and candidate source fingerprint before authorizing any migration. Provider SQL access, migration, sandbox fixtures, payment activation, candidate deployment, push/CI and Production actions each still need applicable explicit Owner authority.

The historical `E1_QUARANTINE_PUBLIC_RELEASE_20261026.md` explicitly excluded billing/payment activation and active Stock access, and prohibited profile reactivation/test entitlements during that quarantine release. Its runtime approval is not reused for this paid flow. New acceptance authority must explicitly cover receipt-driven initial activation of approved fresh sandbox fixtures. Direct profile reactivation or manual test entitlement insertion is not part of this implementation.

## Evidence levels

Fresh final command results and source hashes are recorded in the adjacent evidence JSON. Evidence types are distinct:

| Level | Scope and limit |
| --- | --- |
| STATIC — PASS | Both repositories passed fresh type checks, scoped runtime lint and locked Next.js 16.4.1 Webpack compile-only builds after deployed-source reconciliation. Compile-only is not hosted runtime acceptance. Stock retains an existing middleware-convention deprecation warning. |
| UNIT — PASS | Core: 1,229 checks. Stock modules: 96 checks. Actual TypeScript modules, rendered React views, shared billing engine, native callback/CSRF behavior, signatures, request-correlated online decisions and negative controls; no provider requests occur. Historical source pins and adjacent-mutation rejection remain intact. |
| PostgreSQL UNIT — PASS | 25 checks execute the actual proposals with the reviewed installed Stock assertion, native admission/revocation guards, exact Core OAuth-consent/session helper, ACL/RLS and rollback probes. Only cross-database HTTP transport is synthetic. Checks cover acknowledgment/enrollment requirements, live Owner/consent revocation, unavailable Core, idempotent admission/audit, identity conflicts and exact baseline/trigger drift rejection. This is not managed Supabase DB runtime or gateway integration. |
| INTEGRATION | Real Midtrans sandbox, cross-deployment delivery and hosted recovery have not been executed. |
| DB RUNTIME | All approved baseline, Stock dependency and Core active dependency reads completed on 1 November. Managed self-payment migrations and behavioral compatibility tests have not been executed. |
| BROWSER UAT | Hosted customer journey has not been executed. Local inert fixtures were inspected at 1440×1000 and 390×844; checkout showed no horizontal overflow and a 51px payment button; paid-pending showed no payment button. The mobile Company selector used a 16px font and 48px control; payment remained absent until a Company was selected. This is synthetic rendering evidence only. |
| PRODUCTION | No write, migration, deployment, real payment or sales activation. Read-only deployment metadata is not Production acceptance. |

The 30 October local screenshot attempt was blocked because Playwright rejected the required Temp destination, and computer-use initialization failed with `failed to write kernel assets ... os error 3`. Those are historical tool observations, not a fresh diagnosis of current capability. No alternate path bypassed the restriction. No mobile screenshot was retained; mobile visual acceptance and full hosted browser UAT remain open and require a fresh capability check within their authorized scope.

## Remaining acceptance and release gates

1. Both dependency reviews and the local receiver successor are complete. Review the exact forward object inventory, candidate fingerprint and installation preconditions before authorizing a managed migration. Preserve online authorization, pilot lifecycle, native mapping, revocation and audit; do not replay the installed atomic payment proposal.
2. Review and authorize the exact forward objects and safe fixture scope in a named environment. Deploy reviewed receivers before enabling the corresponding sender/runtime gates. Verify actual candidate source provenance and release protections before any push or deployment.
3. Complete both fresh verified-account journeys, Company preparation, sandbox payment, activation, Stock access and authorized invoice history. Enroll only the exact approved synthetic Company/resource identities; retire cohort eligibility afterward while retaining audit and paid records.
4. Run real HTTP/cookie and browser checks at desktop and 390px, including recovery, cancellation, expiry, duplicates, forged callbacks, amount/mode mismatch, Owner/member revocation and cross-tenant denial. Verify actual Basic inventory operations, Pro purchasing/finance, one/three seats, excluded features, legacy annual renewals and unchanged LMS behavior.
5. Confirm applicable customer terms before public selling: final tax/setup treatment, cancellation/refund policy, support and usage commitments, actual trial scope, privacy/terms links, provider readiness and the recovery timing above. This implementation does not invent or approve commercial/legal terms.
6. Authorize Stock sales separately only after the security, commercial and runtime gates pass. Do not activate LMS offers as part of this release.

## Recovery

Close the two Stock offers to new sales and close only the Stock catalog sales gate. Keep valid contracts active, keep invoices and audit history, retain the receiver and Company-aware authorization guards, and keep activation reconciliation running. Do not disable paid-runtime guards or private delivery settings as a sales rollback, delete paid records, reprice legacy contracts, migrate legacy subscribers, or revoke valid paid profiles. A pending payment or activation is not a reason to issue a replacement charge.
