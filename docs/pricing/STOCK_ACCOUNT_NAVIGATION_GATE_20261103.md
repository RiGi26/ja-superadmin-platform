# Stock account navigation: closed-sales Core rollout

Status: Core-only closed-sales rollout completed 3 November 2026 under the Owner's explicit approval, “go ahead for next gates. approved and browser enable,” reaffirmed by “go ahead for full self payment.” This rollout does not enable payment.

## Reviewed source and target

- Core source: `66a7efebb95fff144b834be9d6a141818713e1b0`, existing draft PR [#60](https://github.com/RiGi26/ja-superadmin-platform/pull/60), [candidate CI](https://github.com/RiGi26/ja-superadmin-platform/actions/runs/41581154524).
- Existing Vercel account `rigi26`, team `team_MGLKh5XmYFCwtCh6CjyaaL6f`, project `prj_Z8taL31maerKj0AXlz65OBO8Bs6o` / `ja-superadmin-platform`, Production Customer Hub `hub.webzoka.com`.
- Current reviewed Core deployment: `dpl_8rpHkeXfrRoNxAwK9vjcJWKbVskn`, source `f25f2764433471cb251f5bb67c3764ed9990345c`.
- Stock application remains at `dpl_2UT9SMMDa9mHosAVJChzPafrPdqc`, source `6f02d63df65d1f3770f46e965eb8acc301025e9c`. No Stock deployment is requested.
- Promoted Core deployment: `dpl_7tYb2D8CLXVNKkeGP8vtAWHPpX8Y`, URL `https://ja-superadmin-platform-eysmpybk0-rigi26s-projects.vercel.app`, now serving the existing `hub.webzoka.com` alias. It was staged Ready with no aliases, using the exact committed-only archive for `66a7efebb95fff144b834be9d6a141818713e1b0`, then promoted. Existing Next.js, Node 26 and iad1 settings were observed and preserved. Build and runtime overrides explicitly set `BILLING_SANDBOX_UAT_ENABLED=false` and `STOCK_SSO_PILOT_ENABLED=false`.

## Problem and change

Hosted Pro testing reproduced the same failure twice: clicking an account-home link to billing changes the address but keeps home content; reloading that billing address renders the correct authorized workspace and invoice state. A checkout-to-billing transition works for Basic, so the failure is scoped to the client transition and is not treated as a universal server billing failure. The precise framework/cache mechanism is not established.

The candidate uses document navigation for the account sections in AccountHub, shared account navigation and Stock checkout. This follows the working full-request/status-link behavior. The same server handlers, identity/Owner checks, hrefs, payment forms and styles remain in use. Store and unrelated links retain their current navigation. No authorization, RLS, callback, payment, plan, entitlement or security-release contract is changed.

Both focused regression checks fail before the change and pass afterward. Types and scoped lint pass. Initial full local UNIT has 1232 passes and one exact source-delta mismatch; the corrected delta preserves the frozen AccountHub baseline hash `0f37bb33703d3704d4d2456fb7bc2f9931bf076e16378ed4e20cce7d89132401` and rejection of adjacent edits. Affected UI/source-contract UNIT then passes 7/7. Full CI at the exact candidate passes, including the complete unit suite, types, scoped lint, build and whitespace checks. Hosted resolution is not claimed before deployment and symptom retest.

## Execution record

1. Exact candidate CI `41581154524` was freshly rechecked PASS. A committed-only archive was staged; only `.vercel/project.json` was copied to bind the existing project. The staged tree contained 435 committed files plus the binding file and zero secret environment files.
2. Vercel deployment `dpl_7tYb2D8CLXVNKkeGP8vtAWHPpX8Y` completed Ready with no aliases before promotion. CLI build and runtime overrides set both required switches false. Project identity, framework, Node version and region matched the existing target.
3. The deployment was promoted successfully. A fresh alias lookup returned this deployment ID and Ready status.
4. No SQL or migration was executed. Prior exact two-workspace readiness reads remain applicable; this rollout created no new records.
5. Fresh anonymous HTTP checks: `/hub/store` and both Basic/Pro checkout pages returned 307 to sign-in; unauthenticated POSTs to `/api/stock/active/authorize` and `/api/stock/active/enroll` returned 403. The browser is disabled in Work settings, so signed-in navigation, Owner isolation, invoice history, exact desktop/mobile screenshots and authenticated closed-sale UI are BLOCKED, not passed.
6. No rollback condition was observed in the checks that could run. No Stock deployment, project-level setting change, DNS/OAuth change, merge, database mutation, payment or paid activation occurred.

## Boundaries retained

Both Stock offers, public purchase buttons, sandbox checkout, cohorts, paid activation receiver, old active-access gate and pilots remain closed. Existing monthly prices and all legacy/LMS terms remain unchanged. No real or test payment, paid activation, entitlement write, team provisioning, multi-workspace contract replacement, secret rotation, infrastructure creation or paid plan/resource change is authorized by this gate.

This gate establishes only the navigation source and deployment record plus limited anonymous HTTP checks. It does not complete the full self-payment plan, signed-in browser acceptance, multiple-workspace and three-operator successor, commercial/security/release review, or purchase-to-activation acceptance. Those requirements remain in the canonical handoff and existing draft PRs.
