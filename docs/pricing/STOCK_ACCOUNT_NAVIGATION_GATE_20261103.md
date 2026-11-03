# Stock account navigation: closed-sales Core rollout

Status: proposed execution scope; no deployment authority is inferred from source publication or the earlier exact preparation/FK approvals. Exact Core candidate CI passes. This gate requests an application-only Core rollout; it does not enable payment.

## Reviewed source and target

- Core source: `66a7efebb95fff144b834be9d6a141818713e1b0`, existing draft PR [#60](https://github.com/RiGi26/ja-superadmin-platform/pull/60), [candidate CI](https://github.com/RiGi26/ja-superadmin-platform/actions/runs/41581154524).
- Existing Vercel account `rigi26`, team `team_MGLKh5XmYFCwtCh6CjyaaL6f`, project `prj_Z8taL31maerKj0AXlz65OBO8Bs6o` / `ja-superadmin-platform`, Production Customer Hub `hub.webzoka.com`.
- Current reviewed Core deployment: `dpl_8rpHkeXfrRoNxAwK9vjcJWKbVskn`, source `f25f2764433471cb251f5bb67c3764ed9990345c`.
- Stock application remains at `dpl_2UT9SMMDa9mHosAVJChzPafrPdqc`, source `6f02d63df65d1f3770f46e965eb8acc301025e9c`. No Stock deployment is requested.

## Problem and change

Hosted Pro testing reproduced the same failure twice: clicking an account-home link to billing changes the address but keeps home content; reloading that billing address renders the correct authorized workspace and invoice state. A checkout-to-billing transition works for Basic, so the failure is scoped to the client transition and is not treated as a universal server billing failure. The precise framework/cache mechanism is not established.

The candidate uses document navigation for the account sections in AccountHub, shared account navigation and Stock checkout. This follows the working full-request/status-link behavior. The same server handlers, identity/Owner checks, hrefs, payment forms and styles remain in use. Store and unrelated links retain their current navigation. No authorization, RLS, callback, payment, plan, entitlement or security-release contract is changed.

Both focused regression checks fail before the change and pass afterward. Types and scoped lint pass. Initial full local UNIT has 1232 passes and one exact source-delta mismatch; the corrected delta preserves the frozen AccountHub baseline hash `0f37bb33703d3704d4d2456fb7bc2f9931bf076e16378ed4e20cce7d89132401` and rejection of adjacent edits. Affected UI/source-contract UNIT then passes 7/7. Full CI at the exact candidate passes, including the complete unit suite, types, scoped lint, build and whitespace checks. Hosted resolution is not claimed before deployment and symptom retest.

## Exact requested actions

1. Verify the existing account/project, current reviewed deployment and passing exact-source CI. Export only committed source at the immutable candidate above; verify stored Git bytes and exclude unrelated work, local settings, secrets and untracked files. Reuse the existing workspace and installed tooling; no new dependency, workstation runtime or worktree is requested.
2. Build/stage that Core source in the same existing project, without assigning aliases yet. Preserve its existing framework, Node, region and protection configuration. Explicitly set only `BILLING_SANDBOX_UAT_ENABLED=false` and `STOCK_SSO_PILOT_ENABLED=false` for both this build and runtime. Do not export secret/environment values or change project-level settings. Keep automatic Git deployments disabled.
3. Verify Ready and the exact candidate source metadata, then promote that staged Core deployment to its existing Production aliases. Do not change DNS, callbacks, OAuth clients, project protection, repositories or default branches. This includes no merge.
4. Reuse the already approved closed-readiness and two-workspace SELECTs only as necessary for before/after verification. They must show closed offers, sandbox mode, inactive prepared resources, no billing accounts and zero paid receipts. Execute no SQL write, migration, cohort or settings enablement. The already installed native-identity migration is not replayed.
5. Repeat anonymous HTTP smoke and normal signed-in browser checks for the existing Basic/Pro fixtures only. Verify account-home to billing, systems and support render their selected views; retain Owner isolation, empty invoices, saved Basic selection and disabled payment. Attempt desktop and exact-390px screenshots and verify actual dimensions. If the viewport override is unavailable, record that missing level and preserve the limited functional result; do not claim mobile acceptance or use a prohibited fallback. The Owner enters any password privately. No new Auth account, consent scope, test recipient, business resource or financial record is created for this rollout.
6. If the new application causes a regression, restore only the reviewed prior Core application deployment after checking there is no unrelated deployment drift. Preserve database constraints, settings, identities, intents, Company/Stock resources, all audit and financial history. No database rollback, preparation-close SQL, deletion or activation-retry shutdown is included.

## Boundaries retained

Both Stock offers, public purchase buttons, sandbox checkout, cohorts, paid activation receiver, old active-access gate and pilots remain closed. Existing monthly prices and all legacy/LMS terms remain unchanged. No real or test payment, paid activation, entitlement write, team provisioning, multi-workspace contract replacement, secret rotation, infrastructure creation or paid plan/resource change is authorized by this gate.

This gate can establish only the navigation rollout's source/deployment/browser evidence. It does not complete the full self-payment plan, multiple-workspace and three-operator successor, commercial/security/release review, or purchase-to-activation acceptance. Those requirements remain in the canonical handoff and the existing draft PRs.
