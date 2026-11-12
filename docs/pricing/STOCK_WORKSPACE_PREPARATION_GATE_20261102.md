# Stock inactive-workspace preparation rollout

Status, 3 November: the Owner approved this exact scope through “Approve inactive workspace rollout.” Stock and Core candidates were deployed/promoted in the order below, and the exact Core preparation setting change committed. Pro is prepared in quarantine; Basic preparation remains pending. A separate native-identity FK correction is proposed in `STOCK_NATIVE_OWNER_FK_GATE_20261103.md` and is not authorized by this rollout approval. Payment, paid activation and public sales remain excluded.

Update, 3 November: the Owner explicitly retained the full Basic + Pro plan. This preparation phase does not reduce that acceptance scope. Existing one-workspace-per-native-identity constraints and disabled team-account creation require a secure reviewed successor before multiple-workspace and three-operator acceptance can pass; they are not changed by this candidate.

## Purpose and current evidence

Both named Basic/Pro fixtures completed email verification, normal password recovery and normal sign-in. Pro's new Core Company is `bab486e5-f50e-45ac-8dca-6ae8488104a0`, reservation `1479f3e8-8e47-4a1e-a465-862260b229cb`, reserved billing tenant `871aadb3-b581-456b-a2f5-076f90d16564`. Its current Owner and no-pilot-history predicates pass; no Stock resource, binding or paid receipt exists. Basic's Company still needs normal creation under its own identity.

The approved seven SELECT statements confirm sandbox engine mode, disabled sandbox feature/receiver settings and two unchanged approved offers that are inactive and not for sale. Project and linked shared-variable searches find no configured `BILLING_SANDBOX_UAT_ENABLED` in Core or `STOCK_SSO_PILOT_ENABLED` in either project. No value was revealed and no full environment was exported. These are project/shared configuration observations, not an export of deployed environment overrides.

The canonical Hub-to-Stock connection currently fails at the intentionally closed source gate. An existing unit scenario confirms exact Hub denial when closed and continuation when enabled, while forged origins remain denied.

## Concrete candidate

The candidate changes only the two new Stock preparation/runtime source flags to `true`:

- Core `lib/stock-purchase-policy.ts`: `STOCK_PAID_BILLING_RUNTIME_ENABLED`.
- Stock `src/lib/stock-paid-policy.ts`: `STOCK_PAID_ACTIVATION_RUNTIME_ENABLED`.

Exact application candidates: Core `f25f2764433471cb251f5bb67c3764ed9990345c`; Stock `6f02d63df65d1f3770f46e965eb8acc301025e9c`. Later documentation-only evidence commits do not replace these execution targets. The paired Stock source workflow checks out that immutable Core candidate. Both task branches keep automatic Vercel deployment disabled.

Their current-release assertions are updated for this preparation candidate. Core asserts both public catalog release flags remain false and a closed catalog cannot purchase. Stock asserts the general active-access gate and default pilot mode remain false. Historical source pins, installed migrations, function bodies, identity rules and negative authorization/signature/amount checks remain unchanged.

Local verification: Core full UNIT 1231/1231, Stock module UNIT 96/96, disposable PostgreSQL UNIT 38/38, and both repositories' types/scoped lint exit 0. A focused disabled-receiver rerun after stronger delivery-deadline assertions passes 1/1. Final-source hosted CI must pass before deployment; these local checks do not establish managed Auth, payment integration, concurrency or hosted UAT acceptance.

Core candidate CI [41563612890](https://github.com/RiGi26/ja-superadmin-platform/actions/runs/41563612890/job/125679735319) passes. The initial Stock candidate's source CI found unpaid reciprocal fixtures missing the newly reached paid-status lookup. A focused reproduction confirmed the test-harness defect; explicit unpaid lookup plus unavailable/malformed denial controls pass all 60 reciprocal and 286 script UNIT checks. Corrected Stock `6f02d63` passes [source CI](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/41564619596/job/125683023086), including 286 scripts, 96 module checks, 38 disposable PostgreSQL checks, types, lint and build, plus [PDF CI](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/41564619763/job/125683023578). Core's documentation follow-up also passes [CI](https://github.com/RiGi26/ja-superadmin-platform/actions/runs/41564849325/job/125683788431). The failed run is retained in the handoff.

These source flags alone do not authorize payment or activation. The preparation deployment must explicitly force `BILLING_SANDBOX_UAT_ENABLED=false` in Core and `STOCK_SSO_PILOT_ENABLED=false` in both applications, for both build and runtime. No project-level environment setting or secret is changed. Core and Stock public catalog release flags and both managed offers remain closed.

The source/private preparation switches are application-wide, not a two-account access allowlist. They make the existing guarded preparation route usable by otherwise eligible verified customers who reach it; they do not publish purchase buttons or authorize payment. The agent's permitted test mutations are limited to the two named fixtures. If preparation itself must be fixture-only, do not deploy this candidate: add and review an explicit restrictive preparation allowlist first.

## Requested execution authority

Authorize the following actions in the two existing projects only, after current-source checks pass and deployed-source/target identity is reverified:

1. Deploy the reviewed Stock candidate first, then Core, using the existing canonical targets and accounts. Stage exact source, inspect Ready and promote in that order. Keep automatic Git publication disabled; do not merge a default branch, create a provider project or change protection/callback/security configuration.
2. On Core `hxhusfkrlafxdnyasmsu`, execute the exact `STOCK_WORKSPACE_PREPARATION_ENABLE.PROPOSED.sql`. It changes only `stock_billing_private.settings.enabled` from false to true. Its guarded transaction requires sandbox engine/feature mode, both approved offers closed, no billing accounts and no sandbox cohort rows. It changes no price, period, engine mode, account, subscription, invoice or ownership record.
3. On Stock `oyyfcmlquqfrdoffkgsd`, execute only the two SELECT statements in `STOCK_WORKSPACE_PREPARATION_POSTCHECK_READONLY.sql`. This adds read-only inspection of `stock_active_private.settings.runtime_enabled`, alongside the new receiver setting. Do not change either Stock setting; in particular, `stock_paid_private.settings.enabled` must remain false.
4. Complete the two fresh fixtures' native workspace preparation through normal Core/Stock E1 forms and OAuth, preserving the existing Pro Company/reservation and recording Basic's new server-created identifiers. Only the fixtures selected by the Owner are included. Keep all Stock profiles/resources inactive. Existing, legacy, contested, transferred or recovery ownership is excluded. The Owner enters private passwords and handles any action-time consent/security prompt.
5. Verify current native identity, reciprocal mapping, preserved package return paths, inactive status and absence of payment controls/receipts using authorized HTTP/browser checks. Retain append-only audit and history. No direct Auth, membership, profile or entitlement mutation is included.
6. If preparation needs rollback before any billing account/cohort exists, the exact `STOCK_WORKSPACE_PREPARATION_CLOSE.PROPOSED.sql` may restore the single Core setting to false. It refuses unsafe paid/billing state. Restoring the verified prior closed application deployments is permitted only after rechecking target identity, no unrelated deployment drift and the same no-paid-state condition. Never disable paid recovery or erase records if financial activity is found.

All SQL files are review inputs until this execution scope receives explicit Owner approval. The original readiness queries may be reused for a necessary fresh preflight within their unchanged approved scope. No migrations are replayed.

## Why payment stays unavailable

The Stock private receiver remains disabled. A PostgreSQL regression executes a valid paid delivery against that disabled receiver: activation is rejected, the Stock profile remains inactive, no receipt is created and Core's paid fixture record/outbox remain intact. This is offline UNIT evidence, not managed payment execution.

Core's test checkout switch is explicitly false, both public offers remain closed and no Company cohort is enrolled. The preparation setting enables only the existing Owner-verified package-intent/workspace flow; it does not make a new purchase saleable. General active Stock, native Storage/Realtime restrictions, pilot history, revocation and existing-business two-operator protections remain unchanged.

## Excluded authority and next gate

This scope does not authorize sandbox or real payments, cohort enrollment, Stock receiver enablement, existing active-access database enablement, manual activation/reactivation, team-account workarounds, legacy repricing/migration, LMS activation, automatic debit, public selling or commercial-term approval. No new dependency, workstation runtime, paid resource or plan upgrade is included.

After both inactive reciprocal mappings exist, prepare the exact finite-cohort and payment-activation review using their actual identifiers. Actual sandbox payment, paid activation, operational entitlements, three-operator provisioning and complete desktop/390px acceptance remain separate unverified requirements. Existing dependency/security and commercial release gates are not cleared by this preparation phase.
