# Customer Hub link cleanup

## Objective and current authority

The Owner requested a search for untidy links followed by cleanup across the Webzoka customer journey. When asked about URL direction, the Owner requested the best recommendation. This candidate recommends the dedicated `hub.webzoka.com` hostname. The hostname is not attached to Core yet; recommendation and local source preparation do not constitute provider activation approval.

The existing signup/release work is already deployed. This successor concerns navigation and URL presentation. It does not change Company ownership, E1 admission, Stock activation, billing, or the generic Company Registry fuse. The separate login redesign was subsequently approved and merged as PR #54. This candidate was integrated onto that released source without changing its login layout, copy, password reveal behavior or mobile styling. Its privacy link now uses the canonical public privacy page directly.

## Authoritative starting point

| System | Verified state |
| --- | --- |
| Original Core source | `RiGi26/ja-superadmin-platform`, `main`, `56d9edc899060b9c794d72a21092ea24dce8f878` |
| Integrated Core baseline | PR #54, `367a2c814185287ba9b61b0b8b42d2135e21e79e`; task branch fast-forwarded and all cleanup changes reapplied without conflicts |
| Landing source | `RiGi26/ja-landingpage-platform`, `master`, `054cf61a6ae37662cf2b5d740fd05e20718209d2` |
| Core deployment | `dpl_9iYKTzAvwQosxBcYMHxpseEE3q8g`, Production READY |
| Current released Core UI, rechecked 28 October | Stable Core alias resolves to `dpl_3VwnL1fTSjFyhYY7me7MR5X356js`, Production READY, Git SHA `367a2c814185287ba9b61b0b8b42d2135e21e79e` |
| Landing deployment | `dpl_6YCtPuPPPV9P1xSLiJeuom7AzYyY`, Production READY |
| Core host assignment | `superadmin.webzoka.com` and Core Vercel aliases |
| Landing host assignment | `webzoka.com`, `www.webzoka.com`, `information.webzoka.com` and landing Vercel aliases |
| Proposed hostname | Public DNS for `hub.webzoka.com` points to `cname.vercel-dns.com`; no Core project assignment observed |

Existing main checkouts and pricing worktrees contain other work. This task uses `.wt-hub-link-cleanup-core` and `.wt-hub-link-cleanup-landing`, each on `feat/hub-link-cleanup-20261027`. Earlier Owner worktree creation/cleanup authorization is reused for this continuation. Task work must be preserved before cleanup.

## Findings and candidate changes

| Finding | Candidate |
| --- | --- |
| Landing desktop/mobile Hub links use the deployment hostname and force workspace continuation. | Both use `https://hub.webzoka.com/login`. Landing release depends on hostname activation. |
| Legacy landing OAuth consent redirects cross to the Core deployment hostname. | Preserve the authorization query while redirecting to `https://hub.webzoka.com/oauth/consent`, keeping customer authentication on the Hub host. Native Stock callback URIs remain unchanged. |
| Public Core navigation enters protected account first, causing an avoidable redirect and default `next`. | Generic entry links use `/hub/login`, which already sends confirmed customer sessions to account. |
| Signup success, existing-account links, account guard and logout add the default account return. | Use the plain login entry; old login bookmarks drop exactly one redundant `next=/hub/account`. |
| Systems, billing and support navigation use `?view=` to select separate sections. | Use `/hub/systems`, `/hub/billing`, `/hub/support`, with rewrites to the released renderer. |
| Old section bookmarks need continuity. | Temporary same-origin redirects remove only the recognized single `view` selector and preserve other query state. |
| Customer URLs expose internal `/hub` paths on the proposed hostname. | Exact hostname aliases serve existing pages under short public paths. Existing operator and deployment hosts retain their route meanings. |
| Native Stock browser-result links retain a protected Core protocol origin. | Keep the Stock origin and backend protocol unchanged. After exact Production Hub configuration is enabled, known customer GET/HEAD links on legacy Core hosts redirect to the branded aliases, preserving query selectors. Preview, POST, operator, payment, API and Auth callback routes do not cross hosts. |
| Landing links disagree with the configured trailing-slash convention or point through the privacy alias. | Use canonical `/seluruh-layanan/`, `/privacy/` and `/karya/`. |

The route table in `lib/hub-navigation.ts` is the source of truth for proposed public aliases. Its main entries are `/login`, `/signup`, `/forgot-password`, `/update-password`, `/account`, `/workspace`, `/home`, `/systems`, `/billing`, `/support`, `/store`, `/portfolio`, `/articles`, `/faq`, `/commitment`, and onboarding routes. Article slugs retain a single-segment route.

OAuth authorization IDs, workspace continuation selectors, recovery callbacks, onboarding request selectors, product tiers, payment capabilities, and failure-state flags are meaningful state. They are not removed for cosmetic reasons. The existing callback endpoint remains `/auth/callback?flow=signup`.

## Acceptance and evidence

| Requirement | Required evidence | Current result |
| --- | --- | --- |
| All customer entry links agree. | Source inventory over Core customer pages, OAuth return links, and landing navigation. | PASS locally: 125 Core source files audited; 12 exported landing HTML pages, 10 Hub links, zero broken internal links. |
| Short aliases preserve protection. | Anonymous/confirmed-customer/operator negative controls against the actual proxy implementation. | PASS: actual proxy tests cover normal and internal-origin HTTP host handling, configured Production migration and Preview exclusion. |
| Canonicalization cannot loop or lose special state. | Alias, bookmark, duplicate-query, callback and continuation tests. | PASS: only recognized navigation selectors and a single default account return are removed. |
| Released security behavior remains preserved outside explicit navigation changes. | Exact successor source comparisons and full Core unit suite. | PASS: 916 tests, zero failures/skips; exact navigation deltas reverse to PR #54 source. Existing signup, UI and security hashes remain unchanged. |
| Framework routing configuration renders the intended pages. | Build plus local HTTP and browser checks using synthetic configuration. | PASS locally: Core build, TypeScript, lint, real Next HTTP alias checks and anonymous browser navigation. |
| Landing keeps its existing export and navigation behavior. | Build and link inspection. | PASS: build and focused lint; static export link audit and desktop/mobile menu checks. Two pre-existing image warnings in unrelated gallery components remain advisory. |
| Branded customer URL works live. | Authorized Vercel assignment, DNS/HTTPS verification, exact Auth callback configuration and runtime evidence. | NOT_EXECUTED; no provider changes authorized/performed for this successor. |

## Release dependencies

Before publishing the landing link, attach the existing subdomain `hub.webzoka.com` to the verified Core project and verify actual ownership/DNS/HTTPS requirements. Preserve unrelated DNS records and existing project assignments. The Vercel domains skill explicitly distinguishes project assignment from registration and DNS; no domain purchase or nameserver change is proposed.

The new signup origin must be the trusted configured Hub application origin. Production `WEBZOKA_HUB_APP_URL` must target `https://hub.webzoka.com`. The actual recovery builder in `app/hub/actions.ts` was inspected; Supabase Auth needs these exact new callback entries:

- `https://hub.webzoka.com/auth/callback?flow=signup`
- `https://hub.webzoka.com/auth/callback?next=%2Fhub%2Fupdate-password`

The previously approved Core Vercel callback stays present. Do not change Site URL, SMTP, confirmation policies or OAuth/Stock callbacks as a side effect. A public DNS CNAME is not proof that the proposed hostname is unused: verify its current project assignment and public response before activation, and stop on a tenant or workstream conflict.

Provider mutation, new callback approval, merge and deployment remain explicit final release decisions. The old approval for PR #53 is not reported as approval of this successor's new hostname.

## Final local evidence, 28 October 2026

- **STATIC:** PASS. TypeScript in the final Core build, lint over changed source/tests, whitespace checks, source link inventories, and protected-source comparisons. The approved PR #54 form and stylesheet are byte-identical; its page changes only the privacy link destination.
- **UNIT:** PASS, 916 tests, zero fail/cancel/skip. The final candidate includes both internal-host routing and Production migration negative controls.
- **INTEGRATION:** PASS locally with synthetic configuration. Actual Next responses prove branded login/signup return 200, account returns to plain login, old default-account login bookmarks lose only that redundant return, section bookmarks preserve failure flags, and the internal operator login stays distinct. These are local HTTP host tests, not public DNS/HTTPS evidence.
- **DB RUNTIME:** NOT_APPLICABLE. No database operation, Auth signup, verification message, trial, subscription, invoice or Company mutation was performed for this cleanup.
- **BROWSER UAT:** PASS for local anonymous navigation. Login → signup → login works; protected account returns to login; password visibility works; final fresh browser run records zero console/page errors and zero form submissions. Desktop is 1280×900, mobile is 390×844 with no horizontal overflow, 16px inputs and 52px input height. Landing desktop/mobile menus expose the same branded link.
- **HOSTED PREVIEW / PRODUCTION:** NOT_EXECUTED for this candidate. No commit, push, PR, deployment, hostname attachment, environment change, callback change or release was performed for this successor.

The earlier branded-browser attempt used request interception to transport a synthetic hostname to localhost. Redirect follow-up requests escaped that transport and timed out against the unassigned hostname. This is retained as a test-harness limitation, not a passing public-domain test. Direct alias HTTP responses passed, and the final normal localhost browser navigation passed. Real branded-domain browser acceptance remains a release check.

Windows checkout conversion initially changed exact reference bytes. Only unchanged tracked files were restored from their own Git blobs, after proving the difference was CRLF conversion; expected hashes and reference contents were not changed. The PR #54 integration first preserved all task work in a verified scratch backup, fast-forwarded this task branch, and reapplied the cleanup without conflicts. The UI source verifier now removes only the explicitly enumerated navigation successor before checking its existing approved hashes.

Evidence directory: `C:\Users\61140\AppData\Local\Temp\Codex\hub-link-cleanup-20261027\scratchpad`.

Final logs and observations:

- `core-unit-candidate-final.log`, `core-build-candidate-final.log`, `core-lint-candidate-final.log`
- `landing-build.log`, `landing-lint.log`, `landing-link-audit.json`, `core-source-link-audit.json`
- `local-http-integrated-final.json`, `browser-final.json`, `CANDIDATE_RESULT.json`
- `hub-login-desktop-final.png`, `hub-login-mobile-final.png`, `landing-desktop.png`, `landing-mobile.png`

## Handoff and remaining authority

`FINAL_STATUS: ROLLOUT_AUTHORIZED_PUBLICATION_IN_PROGRESS`

`PRODUCTION_CHANGED_BY_THIS_CLEANUP: NO`

Creation YES; both task worktrees remain on `feat/hub-link-cleanup-20261027`. Cleanup was authorized earlier but has not been attempted: source is still unpublished and must remain reviewable. Existing main, registry and pricing worktrees remain protected. Remove only these two task worktrees after the reviewed work is preserved and the task is actually finished, with no task server/process still using them.

The Owner replied “gunakan best practicenya” to the exact combined rollout question on 28 October 2026. Execution proceeds within that reviewed scope: commit/push, Core and landing PR/CI/Preview, merge/deploy only after checks pass, attach the existing `hub.webzoka.com` subdomain to Core, set the exact Production Hub application URL, add the two exact callback entries above, and verify anonymous public navigation after activation. No domain purchase, Stock release, protocol-origin change, database write or new test identity is included.

Before publication, Core main advanced through the approved UI/header polish in PRs #55 and #56. Task work was preserved, the task branch was fast-forwarded to `51a1c84e57625c38d0b9e12bd514412e7de3590c`, and the navigation changes were reapplied without conflicts. Exact source comparisons now use that baseline; CI and Preview must validate the resulting published head. The earlier 916-test/local-build evidence remains scoped to the preceding candidate, and is not substituted for the new head's CI.
