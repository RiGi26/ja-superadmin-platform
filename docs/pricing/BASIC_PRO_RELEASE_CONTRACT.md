# Basic/Pro pricing release contract

The Owner approved monthly package definitions for implementation preparation in the active task on 26 October 2026. On 27 October 2026, the Owner additionally approved local integration of the seven protected Core pricing files, correction of ambiguous Stock plan selection, pricing-only source re-review after behavioral checks, and the three exact additive schema changes recorded below on Production. These approvals establish the four monthly amounts and their bounded capacities. They do not authorize sales activation, deployment, payment activation, or unrelated IAM changes.

| Portal | Public package | ID suffix | Monthly IDR | Capacity |
| --- | --- | --- | ---: | --- |
| LMS | Basic | 1001 | 119000 | 100 active students; 200 MiB material attachments |
| LMS | Pro | 1002 | 299000 | 500 active students; 1 GiB material attachments |
| Stock | Basic | 2001 | 149000 | 1 active operator; orders, catalog, documents, and inventory |
| Stock | Pro | 2002 | 359000 | 3 active operators; Basic plus purchasing and finance |

All four exact plan IDs, features, and capacities are defined in `lib/plan-catalog.ts`. The contract version is `basic-pro-2026-10-v1`. New plans are monthly-only. A public label is never an authorization source. An existing legacy plan ID, price, invoice, paid period, feature set, and renewal contract must not be overwritten or silently converted. Existing annual contracts continue to renew on their own terms. New annual offers require a new approved contract version.

## Source integration gate

`lib/plan-catalog.ts` deliberately retains the false source constant `BASIC_PRO_RELEASE_AUTHORIZED`. An environment variable cannot activate new sales while this gate is closed. Local source integration and release authority are separate. Pure unit fixtures can exercise an enabled catalog without activating application or provider runtime.

The following existing protections are preserved:

- `lib/hub-integration-contract.mjs` pins the reviewed billing engine and Hub form source; `lib/hub-data.test.mjs` also preserves the exact snapshot adapter. The pricing successor is accepted only by its exact reviewed source hash.
- `lib/blank-company-isolation.test.mjs` preserves onboarding, provisioning, receivers, and Core portal sync source. The four pricing adapters receive exact before/after hash exceptions through `lib/pricing-source-successor.mjs`; unrelated files retain their prior freezes.
- `lib/e1-workspace.test.mjs` preserves reviewed source and requires independently approved IAM adapters and denial rules. Company/portal identity gates remain unchanged.

The two original proposed patches remain in the active task's scratch evidence as historical review inputs. Their seven pricing edits are now applied locally:

1. `basic-pro-protected-integration.PROPOSED.patch`: billing purchase/version/period guards, existing-contract preservation, Hub catalog selection, and monthly-only first-purchase display.
2. `basic-pro-frozen-adapters.PROPOSED.patch`: active new-offer onboarding selection, exact plan-ID requirement, and explicit signed Core-to-portal version/feature/capacity metadata.

The Stock sync now stops when a missing plan ID leaves zero or multiple matching legacy contracts; row age cannot select a contract. Both portal sync adapters stop on failed reads, mismatched tenant/plan/platform identity, or invalid versioned contracts. The reviewed Hub catalog still uses the session client; no new service-role access is introduced. Legacy comparison tests permit only the exact additive catalog projection; identity, membership, invoice and tenant query predicates remain compared verbatim.

`lib/pricing-source-successor.mjs` contains seven exact LF before/after pairs reviewed after actual billing and signed-sync unit checks. Its negative controls reject arbitrary successor edits, changed baselines, and exceptions for unrelated IAM, provisioning, dependency, and release-gate files. Existing ownership, revocation, tenant-isolation, token-free rendering, and runtime-off negative controls remain required. This source exception cannot activate a release.

## Production schema changes

On 2026-10-27, after the Owner authorized these exact changes on Production, the live schemas and all four reserved plan IDs were checked. The three proposal SQL files were applied unchanged through the Supabase migration tool and are retained as review inputs. Matching source migrations now record the provider-issued versions:

| Target | Project ref | Applied migration |
| --- | --- | --- |
| Core `subscription_plans` | `hxhusfkrlafxdnyasmsu` | `20261027024106` / `basic_pro_plan_catalog_20261027` |
| SaaS LMS `tenant_entitlements` | `jqypnrwegqyjteparqpv` | `20261027024043` / `basic_pro_entitlement_cache_20261027` |
| Stock `tenant_entitlements` | `oyyfcmlquqfrdoffkgsd` | `20261027024056` / `basic_pro_entitlement_cache_20261027` |

The four Core rows remain inactive and not for sale; all new offers are monthly-only. No legacy plan, subscription, invoice, tenant, or entitlement row was rewritten. A synthetic Core constraint/immutability probe passed and left no fixture row. These schema changes do not deploy the local pricing code or open `BASIC_PRO_RELEASE_AUTHORIZED`.

## Validation and release sequence

1. Retain the explicitly reviewed local source integration and all identity, owner-only billing, revocation, isolation, and callback protections. Verify finite-capacity handling when an existing new-package customer requests a downgrade in the authorized runtime rehearsal; do not delete students, staff, or data to meet a lower cap.
2. The three additive schema changes were applied to the explicitly authorized Production databases on 27 October 2026. Synthetic constraint, immutability, and entitlement probes passed, and read-back confirmed all fixtures were removed. This task-specific approval supersedes the general staging recommendation for these exact schema changes. Any further Production write requires applicable Owner authorization; runtime tests must use bounded synthetic fixtures and verify cleanup, never live customer rows. Legacy/new monthly/annual/pending-invoice application behavior remains unverified.
3. Run signed-sync and payment sandbox integration, including malformed/forged/duplicate callbacks, unknown references, mode mismatch, reconciliation, and rejection before financial mutation. Test cross-platform and revoked-owner cases.
4. Run actual browser UAT at desktop and 390px mobile on exact authorized targets. Verify two paid cards per portal, trial outside those cards, identical prices across surfaces, real Stock Basic inventory operation, excluded-feature denial, finite seat/storage enforcement, and legacy annual renewal. Offline React rendering is UNIT evidence only.
5. Resolve usage allowances, support commitments, actual cost evidence, tax/setup terms, trial truth, and payment/provider readiness before commercial activation. No unlimited WhatsApp, storage, support, or old enterprise rights are included by a new Pro label.
6. The authorized schema step is complete with sales off. Obtain separate applicable authority for coordinated code deployment. Deploy the reviewed receivers and Core code under closed gates only when authorized. Only after the integration and runtime gates pass may a separately authorized action activate all four verified rows and the reviewed release gate.
7. Build the static public page against the exact approved Core version. `PRICING_EXPECTED_OFFER_VERSION=basic-pro-2026-10-v1` makes the publication fail if the feed is missing, mixed, repriced, or incomplete. Compare the resulting deployed page with Core. Static export does not provide runtime five-minute ISR.
8. Recovery disables new sales without deleting an issued invoice, reversing a completed payment, deactivating a valid existing contract, or changing IAM/SSO gates. Existing-contract renewal behavior must pass the recovery rehearsal before release.

Local source and unit verification do not establish end-to-end runtime or release PASS. The active task handoff records exact checks, historical proposals, remaining gates, and whether Production changed.
