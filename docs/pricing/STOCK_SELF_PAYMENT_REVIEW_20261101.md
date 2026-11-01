# Stock self-payment source review — 1 November 2026

Status: source implementation and application CI verified in [Core draft #60](https://github.com/RiGi26/ja-superadmin-platform/pull/60) and [Stock draft #14](https://github.com/RiGi26/webzoka-stock-platform/pull/14). Managed execution and release acceptance are pending. The approved objective remains purchase through activation. Public sales and new paid-runtime source fuses remain closed. The Owner approved source publication and closed Previews; no deployment was created.

## Review against the approved plan

| Requirement | Source result | Runtime acceptance |
| --- | --- | --- |
| Reconcile deployed Core/Stock baseline without losing pricing or security work | Recovered sealed Core r6/Stock r3 application sources, preserved prior checkout bytes, reconciled overlaps and retained original source pins | Managed rollout source identity must be reverified before an authorized release |
| Preserve Basic/Pro choice through verified auth and E1 workspace preparation | Closed internal return paths and authenticated intent; server resolves owned Company, resource and billing tenant | Fresh verified-account journeys not executed |
| Reuse billing with current Owner authority | Opaque request-local proof, current native session/membership recheck, exact monthly catalog and SQL invoice guards | Managed negative authorization matrix not executed |
| Reuse pending checkout and avoid a second charge | Durable issued order, existing pending checkout reuse, paid/pending UI state, explicit invoice verification/recovery | Real gateway expiry/cancel/lost-response scenarios not executed |
| Commit payment atomically and activate after commit | Existing atomic payment engine plus transactional outbox, signed idempotent receipt and bounded reconciliation | Cross-deployment delivery and hosted recovery not executed |
| Preserve active-access protections during paid activation | Exact baseline/hash/RLS/trigger checks; immutable origin, native mappings, subject admission, pilot guard body and append-only audit preserved | Managed HTTP-extension, RLS and identity behavior not executed |
| Require current authorization for operational access | Dedicated paid-session enrollment; exact current Core session and OAuth consent, Owner, acknowledged invoice and five-second request-bound decisions | Hosted Stock access and revocation checks not executed |
| Permit intended Stock capabilities | Exact Basic/Pro feature and seat contracts; current paid server storage/document bridge; native Storage/Realtime restrictions unchanged | Real inventory, purchasing/finance and operator invitation workflows not executed |
| Release correct prices and buttons without enabling LMS | Same approved Stock catalog supplies quotes and conditional purchase buttons; manual trial separate | Public purchase buttons remain closed; no LMS activation |
| Preserve legacy subscription terms | Shared billing regressions and legacy renewal paths retained; no legacy-plan migration | Actual legacy annual renewal remains unexecuted |

## Security and implementation review

- The paid receiver no longer omits the installed online assertion. All eight private Stock active-access functions remain byte-equivalent in the matching-baseline PostgreSQL fixture before the explicitly synthetic transport is installed.
- Paid activation admits only the immutable E1 tuple and its exact native Core identity. An issued payment or receipt alone cannot create a live operational session. A lost Core acknowledgment leaves Stock access denied until delivery and enrollment recover.
- Retained pilot identities cannot become commercial accounts or be reactivated through a paid receipt. Existing pilot activation/revocation branches remain present. No existing-business two-operator rule is weakened.
- Owner/session/consent revocation and unavailable authorization deny the next managed request. Admitted-subject and session revocation are one-way, and receipt/audit history remains retained.
- Paid login has an independent source gate. Simultaneous paid and pilot runtime modes deliberately deny before exchanging a native authorization code. A future paid rollout must verify that the contained pilot mode has been retired; this task changed no provider flag.
- The native Storage and Realtime policies remain closed for managed subjects. Existing privileged upload/document routes retain their tenant/permission checks and add a current paid bridge decision. They do not accept a browser-selected tenant as authority.
- No new dependency, workstation runtime, scheduler, provider resource or cost was introduced. Existing daily recovery remains the background cadence; customer invoice recheck can request earlier repair.

## Acceptance and authority still required

Static and offline UNIT results are recorded in `stock-self-payment-evidence.json`. They are not managed sandbox acceptance. The full requirement is not complete until exact forward migrations, receiver deployment and synthetic test identities have applicable Owner authority, and both paid journeys pass real HTTP/cookie, managed DB/gateway and desktop/390px browser acceptance. Commercial terms and remaining Stock release/security gates also require current applicability before public selling.

Because authorization origins are fixed and the online Stock database assertion calls the canonical Core endpoint, a hosted sandbox run needs an explicitly reviewed deployment/configuration sequence. An arbitrary Preview URL or alternate Supabase project must not silently substitute for the approved realms. Source commits, feature-branch integration, pushes, draft PRs and CI were completed under the explicit source-publication approval. No default-branch merge, managed migration, fixture, payment or deployment was performed.

Final application review references are Core `d3efccb474403a60753e965df853c2ed5fec3388` and Stock `de90ae979c0d5eaef59e80a9b7af5d0307be8309`. Source and PDF jobs pass at those candidates; exact links, remediation history and committed-blob fingerprints are in the handoff and evidence JSON. Historical pricing records and security pins remain unchanged. Development/build-tool dependency alerts are recorded for current release applicability; they were not silently upgraded or marked resolved.

The recommended next gate is an Owner review of the closed-sales receiver rollout and bounded sandbox execution scope. Public sales must stay closed throughout acceptance. Recovery closes only new purchases and retains paid subscriptions, invoices, audits, authorization guards and delivery retries.
