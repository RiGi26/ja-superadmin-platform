# Customer Hub self-signup candidate — 27 October 2026

## Objective and current result

Validate an anonymous visitor registering, verifying email, creating a new Company as its first Owner, and using Customer Hub without administrator intervention.

**The hosted objective is not achieved yet.** The deployed signup rejected the approved synthetic test. This document describes a local, uncommitted remediation candidate; it is not release approval or evidence of hosted success.

Repository: `RiGi26/ja-superadmin-platform`. Branch: `feat/hub-self-signup-20261027`. Base: `4e4937ca55fada4856a2c10551a4f3c01e212045` (Core PR #52).

## Observed deployed failure

On 27 October 2026, the valid synthetic submission to `/hub/onboarding/stock` returned HTTP 200 with application error `Pendaftaran mandiri sedang disiapkan. Hubungi tim Webzoka.` The deployed action rejects before account creation while unified onboarding is closed. The login footer's free-workspace link redirects an anonymous customer back to login; it does not create an Auth account.

The exact test alias is `webzokacompany+uat-hub-20261027-a17b28@gmail.com`, controlled by the connected Webzoka company inbox. The rejected run created no matching Auth user, onboarding, tenant, subscription, invoice, Stock Auth user, or verification email. Request/authentication audit logs remain retained. No fixture deletion was necessary.

The Owner approved synthetic signup, verification-message effects, trial effects if applicable, identity and cleanup. A separate explicit instruction permits this additional worktree and requests removal after completion and preservation. These grants do not authorize code publication, deployment, provider configuration, migration, payment or opening product gates.

## Candidate behavior

1. `/hub/signup` accepts name, email, a confirmed password, and consent. It uses the public Supabase Auth client, provider email confirmation and optional configured CAPTCHA. It does not accept tenant, Company, role or redirect authority from the form.
2. The PKCE callback requires a fresh confirmed, non-anonymous identity matching the exchanged session, then returns to `/hub/account`. The existing password-recovery callback remains separate.
3. The account page supports verified identities without a legacy tenant. Existing legacy members retain their dashboard path. Stale or ineligible sessions render recoverable login instead of redirecting in a loop.
4. A new customer follows the existing `/hub/workspace` flow. Its released E1 adapter atomically creates the new Company, first Owner, audit and inactive Stock reservation. Existing, contested or legacy businesses do not use this automatic first-Owner path.
5. On normal login, own-active RLS reads discover Company/reservation selectors. The released `readNativeE1StockContext` independently verifies the live session, current Owner and exact E1 graph before displaying Company name, Owner role and inactive Stock status. Ambiguous, failed or denied reads do not display ownership or offer creation.
6. The Owner can refresh workspace status, browse Store/help and sign out. Logout and rejected newly established sessions expire only the current project's session/PKCE cookies even when provider logout fails.

The generic Company Registry fuse, legacy unified onboarding, trial finalizer, billing, payments and Stock activation remain unchanged. This candidate does not recover a lost Stock continuation command; the original workspace continuation path remains unchanged. Auth signup and free workspace creation do not start a trial.

## Release-gate comparison

[Core PR #52](https://github.com/RiGi26/ja-superadmin-platform/pull/52) and [Stock PR #13](https://github.com/RiGi26/webzoka-stock-platform/pull/13) accepted retained-fixture native SSO into inactive quarantine. They do not prove public signup or active Stock readiness. The historical gate documents and exact-byte security manifests remain unchanged. A closed source-successor contract validates each precise signup addition against historical bytes and rejects adjacent changes.

Metadata-only inspection of Core project `hxhusfkrlafxdnyasmsu` confirmed authenticated SELECT, enabled/forced RLS, own-active policies and restrictive live-session policies on Company tables. This supports selector discovery; it is not authenticated runtime evidence. No DDL or policy change is proposed.

## Verification and remaining acceptance

Final local verification: **883 tests passed, zero failed or skipped; build, focused lint and post-build TypeScript checks exited 0.** Whitespace validation also exited 0. Independent review found no remaining findings in session recovery or scoped Company rediscovery. Its acceptance is source-level only.

| Level | Current scope and limitation |
| --- | --- |
| STATIC | PASS: source, callback, identity, source-preservation and release-boundary review; post-build TypeScript, focused lint, production build and whitespace validation. |
| UNIT | PASS: 883/883, exit 0. Regressions cover registration, callback eligibility, logout failure cleanup, redirect-loop prevention, selector discovery, denied/foreign/ambiguous scope, and actual account-page ownership/creation states. |
| INTEGRATION | Deployed legacy signup application error reproduced. Candidate's valid form → Auth/email callback not executed on hosted runtime. |
| DB RUNTIME | Metadata and absence checks only. New Auth/Company/Owner creation and user-session RLS reads remain unverified. |
| BROWSER UAT | Deployed failure recorded at desktop and 390×844. Local signup validation rendered. Account screenshots are explicitly labeled synthetic offline fixtures, not authenticated UAT. |
| PRODUCTION | No deployment, migration, provider configuration, payment or activation change. No successful signup claim. |

Hosted acceptance still requires: public navigation to signup; synthetic signup; actual controlled-inbox verification; callback identity; new Company creation; first-Owner membership/audit evidence; account status after logout/login and fresh browser session; denial of foreign/revoked access; Store/help navigation; desktop/mobile screenshots; and approved cleanup with residual-count verification. Preserve append-only audit; revoke sessions before identity cleanup. Never broaden cleanup to unrelated data.

## Evidence and publication boundary

Session artifacts live at `C:\Users\61140\AppData\Local\Temp\Codex\hub-self-signup-20261027-a17b28\scratchpad`:

- `UAT_REPORT.md`, `UAT_RESULT.json`, `UAT_EVIDENCE.json`: original deployed failure and zero-fixture checks.
- `candidate-unit-owner-final.log`, `candidate-build-owner-final.log`, `candidate-lint-owner-final.log`, `candidate-types-owner.log`, `candidate-types-owner-final.log`: local verification output.
- `hub-candidate-signup-desktop-a17b28.png`, `hub-candidate-signup-mobile-a17b28.png`: local signup rendering.
- `hub-candidate-account-desktop-a17b28.png`, `hub-candidate-account-mobile-a17b28.png`: labeled offline Company/Owner layout with synthetic data, fallback font and real public logo. At 390px, no horizontal overflow; interactive targets are at least 44px tall.

Automatic approval review rejected `npm run start -- --hostname 127.0.0.1 --port 3017` with `blocked by policy`; no more specific reason was returned. That local production-server check was not executed. No alternate server command was used to evade the rejection.

Root `AGENTS.md`, consolidated operating rules, **Protected authority**, requires explicit authority for commit, push/PR/CI, Preview, merge and deploy. Publication remains pending. The PR workflow runs on pull requests targeting `main`; its synthetic environment and pinned Actions remain unchanged, with lint coverage extended to candidate files. `vercel.json` has no Git deployment guard, so an authorized push may automatically create a Preview. No push, PR, CI or Preview has been triggered by this task.

### Publication authorization received

The Owner subsequently answered the explicit publication request: **“Authorize commit, PR, CI and Preview UAT.”** This authorizes committing the reviewed candidate, pushing `feat/hub-self-signup-20261027`, opening a PR to Core `main`, running CI and automatic Preview, and continuing the previously approved synthetic signup/Company Owner UAT. Production merge/deploy, provider configuration, migration, payments and Stock activation remain outside this grant. Earlier statements that publication was pending describe the checkpoint before this response.

Keep this worktree until changes are preserved and the task is complete; then remove it under the Owner's cleanup instruction. Preserve all other worktrees and unrelated pricing work.
