# Customer Hub self-signup UAT — 27 October 2026

## Result and tested candidate

**PASS for the approved Preview journey:** anonymous signup → controlled-inbox email verification → authenticated account → self-service new Company/first Owner → Customer Hub use → logout/login rediscovery. No administrator created or promoted the Company Owner.

Tested application commit: `6e66dddfe1fe8f93d765664fddc6fa78fd66066f`.
Repository: `RiGi26/ja-superadmin-platform`. [PR #53](https://github.com/RiGi26/ja-superadmin-platform/pull/53).
Preview: `dpl_EbeDzrXWJGPEFHtJR7o5BEbYS4DB`, READY, at `https://ja-superadmin-platform-gsmugsx57-rigi26s-projects.vercel.app`.
Application environment: Preview. Backing database: approved Production Core project `hxhusfkrlafxdnyasmsu`; all created business/account data is synthetic.

Production application deployment remains `dpl_H3G4jR8eJE6Ys38dY8Ltmog9VE2L` at `4e4937ca55fada4856a2c10551a4f3c01e212045`. This PR has not been merged or deployed to Production. Production release needs separate authority and a reviewed permanent callback configuration; the temporary Preview callback was removed after testing. This report does not claim Production signup readiness.

## Implementation

Public signup uses the public Supabase Auth client, email confirmation, optional configured CAPTCHA, validated credentials and a fixed server-owned callback. It accepts no Company, tenant or role authority from the form. The PKCE callback freshly verifies the confirmed, non-anonymous identity against the exchanged session. Recovery callbacks remain separate.

The account page supports verified customers without legacy tenants. Own-row RLS reads discover selectors only; the released E1 context independently validates current session, Owner membership and exact Company graph before displaying ownership. Existing E1 workspace creation atomically creates Company, first Owner, reservation and audit. Login recovery avoids redirects in a loop; local logout expires only this project's session/PKCE cookies even when provider logout fails.

Generic Registry, legacy unified onboarding, trial finalizer, billing, pricing and Stock activation gates remain unchanged. Historical security manifests and gate artifacts retain their original bytes; exact signup successor checks preserve baseline comparisons and negative controls.

## Acceptance evidence

| Scenario | Result | Fresh evidence |
| --- | --- | --- |
| Anonymous access | PASS | Signup/login HTTP 200; account/workspace/Hub HTTP 307 to login. Store navigation reaches account login and public signup. |
| Validation | PASS | Mismatched password confirmation rejected before Auth creation. |
| Signup and delivery | PASS | Valid signup HTTP 200 application success; Core Auth user created; real confirmation email delivered to the controlled alias. |
| Verification gating | PASS | Before confirmation, account HTTP 307 to login; no managed customer session. |
| Email return and PKCE | PASS after approved test configuration | Initial email returned to Site URL. After exact temporary callback addition, newly delivered email targeted Preview callback; actual link confirmed email and established account session. No manually generated link, edited verification URL or administrator confirmation was used. |
| New Company/Owner | PASS | Customer submitted the workspace form. Core recorded active Company, active owner membership, reserved inactive Stock resource and matching atomic admission audit. |
| Hub use | PASS | Account HTTP 200 displays Company and Owner; creation CTA suppressed. Refresh, Store/help navigation and return preserve ownership. |
| Logout and fresh login | PASS | Logout removed app cookies; managed sessions became zero; account redirected to login. Wrong-password control denied. A new tab logged in normally and rediscovered Owner with HTTP 200. |
| Session refresh | PASS | Following a user pause, normal Hub reload refreshed the expired session and preserved Owner access. Expired-token API denial was not counted as revocation evidence. |
| Foreign graph | PASS | Current customer denied the approved retained foreign fixture; HTTP 200 with denied application state, no foreign Company name and no creation control. |
| Revocation | PASS | Fresh token had 3552 seconds remaining. Session live before global logout; logout HTTP 204; same unexpired token then returned live=false and Company context=null. Zero managed sessions; browser Company access denied and account returned to login. |
| Desktop/mobile | PASS | Actual Preview screenshots at desktop and 390×844. No mobile horizontal overflow; visible controls at least 44px, signup inputs 16px/48px. |
| Cleanup | PASS | Exact synthetic Auth account banned; subsequent normal login denied; zero managed sessions. Temporary callback removed and baseline reloaded/verified. Required birth/audit records retained. |

Synthetic identity: `webzokacompany+uat-hub-20261027-a17b28@gmail.com`, controlled by connected Webzoka company Gmail.
Core subject: `a88c907b-1d9e-45cc-82c3-67dba212cc64`.
Company: `e5af9ca0-41d2-47ec-b7aa-ac647ecf5e9d`.
Owner membership: `3bbcd529-4020-4139-bcbc-50a61243ec19`.
Reservation: `ad397392-e34d-45a7-9140-5f482ba64a21`.
Audit: `c9ca5267-a8a5-4007-af12-0495ed38323e`, action `e1.stock.admit`, actor equal to Core subject, admission command `eb7200f5-3308-4d08-8080-1178bd516c2b`.

## Cleanup and boundaries

The Owner approved synthetic signup, verification-message effects, test identity and cleanup, then commit/PR/CI/Preview UAT. After the exact temporary URL request, the Owner replied “don loggin. gunakan best waynya” and supplied the signed-in Core URL Configuration screenshot. Only that Preview callback was added and later removed. Site URL stayed `https://www.webzoka.com`. Baseline redirect URLs were verified after reload:

- `https://webzoka-customer-hub-preview.vercel.app/auth/callback`
- `https://www.webzoka.com/**`
- `https://superadmin.webzoka.com/**`

Final database counts: banned=true, managed sessions=0, legacy onboarding=0, legacy tenants=0, legacy memberships=0, trial/subscriptions=0, invoices=0, Stock Auth users for the alias=0. One Company/Owner birth graph and one admission audit remain intentionally retained, as required by the release contract. No payment, entitlement or active Stock access was created or tested.

Cross-check: [Core PR #52](https://github.com/RiGi26/ja-superadmin-platform/pull/52), [Stock PR #13](https://github.com/RiGi26/webzoka-stock-platform/pull/13), and Codex chat `01a176d1-fa8a-7a71-88c8-6a2ce3d3c432` (“Continue Core–Stock release gates and…”) retain their quarantine/activation boundaries. That chat's latest Basic/Pro work remains a separate isolated validation candidate. No pricing changes or activation authority were imported into this PR. Foreign selectors came from its approved retained fixture; that fixture was not unbanned or modified.

## Verification levels and artifacts

- **STATIC:** PASS: source review, preserved gates/manifests, TypeScript, lint and whitespace.
- **UNIT:** PASS: 883 local tests, zero failures/skips.
- **INTEGRATION:** PASS for this Preview signup/verification/Company/account path. [CI run 40448390287](https://github.com/RiGi26/ja-superadmin-platform/actions/runs/40448390287) passed tests, types, lint, build and baseline whitespace.
- **DB RUNTIME:** PASS for scoped synthetic identity, Company/Owner/audit, isolation, revocation and cleanup.
- **BROWSER UAT:** PASS for the named Preview scenarios, desktop and mobile.
- **PRODUCTION:** Application release NOT_EXECUTED; approved synthetic Core data and temporary Auth configuration effects described above. Production customer readiness and active Stock/payment flows are not claimed.

Artifacts: `C:\Users\61140\AppData\Local\Temp\Codex\hub-self-signup-20261027-a17b28\scratchpad`. Actual hosted screenshots: `hub-preview-signup-desktop-a17b28.png`, `hub-preview-signup-mobile-a17b28.png`, `hub-preview-email-sent-mobile-a17b28.png`, `hub-preview-owner-desktop-a17b28.png`, `hub-preview-owner-mobile-a17b28.png`, `hub-preview-foreign-denied-a17b28.png`, `hub-preview-revoked-account-a17b28.png`. `AUTH_URL_RESTORE.json` records the non-secret baseline and restoration. Earlier `hub-candidate-*` screenshots are labeled local fixtures and are not hosted evidence.

Original deployed legacy-signup failure remains in `UAT_REPORT.md` and its structured evidence. A local production-server command was automatically rejected with “blocked by policy”; it was not rerun through an alternate command. Hosted UAT above supplies actual runtime evidence.

No password, API key, access token or verification URL is included in this record. A sign-in snapshot exposed a credential during setup; the Owner was advised to rotate it and it was excluded from saved evidence.

The additional worktree may be removed after the final evidence commit is preserved remotely and no process uses it. The remote PR branch and protected Preview remain available for review; other worktrees and unrelated pricing work must remain untouched.
