# H1.G1 E1 Core and Stock local implementation

## Release-gate continuation — 26 October 2026

Owner subsequently approved the explicit bounded reconciliation and Core/Stock
release plan in this chat with “okee i proved.” The original proposal is now
restored at the immutable pin; the 12,003-byte updated version is retained as
`h1-g1-core-dev/RUNTIME_APPROVAL_DISCOVERY_20261023.HISTORICAL.md`. Fresh local
Core UNIT passes 838/838, Stock 280/280, zero skipped tests; both types and
focused lint pass. Native manifests include both preserved proposal versions.
No test assertion or historical SQL was weakened. General activation remains
excluded. Earlier pending statements below describe the pre-approval snapshot.

The transferred worktrees and remote task branches still match Core `e92e74b`
and Stock `72fb354`. Fresh source checks: Core 837/838, with only the preserved
approval-document hash failure; Stock 280/280; both TypeScript and focused lint
exit 0. Zero tests skipped. These are local source checks, not runtime acceptance.

The original protected proposal was recovered from the 23 October chat output
and exactly matches the immutable `c4567b...cc7` pin. The current `5ec814...d9be`
version results from four recorded edits under an explicit Owner instruction to
update the runtime proposal. Both versions and the exact diff are prepared in
`h1-g1-release-gates-20261026/scratchpad/`; neither protected file nor assertion
changed. Recommended reconciliation preserves the current document as a dated
historical file and restores the pinned original, subject to Owner authority.

See [approval provenance, exact reconciliation and controlled rollout](H1_G1_CORE_STOCK_RELEASE_GATES_20261026.md).
Core's strict-origin correction and all other WIP remain preserved. No commit,
push, CI, provider/DB/configuration change or deployment occurred in this
continuation. Uninterrupted authenticated browser UAT and Core/Stock Production
acceptance remain NOT_EXECUTED here. Corp's completed release is unchanged.

## Current Step 6 result — approved Production-backed UAT, 26 October 2026

### Corporate routing release update

After the verified candidate handoff, the Owner explicitly answered “approved”
to commit, push, PR/CI, merge, and Production deployment of the Corp redirect
only. `RiGi26/ja-landingpage-platform` PR #167 merged commit
`950f39679e539afa34d3b4ce251a4604bafa6395`, after Public CI lint, typecheck, build,
and Vercel Preview checks passed on head
`1ed7deaaffa69a2a5c561e7e2d72146bfa968958`.

Vercel Production `dpl_3Mq4ksjpdBgSHwQgSM5yyNwy8r6f` is Ready. Both
`www.webzoka.com` and `ja-landingpage-platform.vercel.app` resolve to that exact
deployment, linked by Vercel's success status on the merge commit. Live HTTP
checks pass 7/7: both consent-path variants on both hosts preserve the request
identifier and fixed Core destination, existing store/legal redirects remain
unchanged, and unrelated nested paths still return 404 after normal trailing
slash normalization. Production browser checks reach Core login from both hosts
with the same continuation at desktop and mobile widths; mobile document width
is 390px. These checks use a synthetic selector and do not authenticate a user.

This resolves the corporate consent-host 404 recorded below. Earlier deployment
IDs and corporate release-pending statements are historical. The merged Corp
worktree and task branch are cleaned after preservation checks; manual corporate
UAT Previews are removed. Release evidence is `CORP_RELEASE_PROVIDER.json`,
`CORP_RELEASE_HTTP.json`, and `CORP_RELEASE_BROWSER.json` in the evidence directory.
Core and Stock app deployments and feature gates are unchanged by this release.
The protected Core approval hash failure, unreleased Core Origin fix, and
uninterrupted authenticated feature UAT remain separate release gates.

This section supersedes the earlier Step 6 environment-blocker interpretation
below. The Owner explicitly approved “Approve full flow uat”, “okeey go ahead use
the stock production”, and “Approve temporary callback” in chat
`01a172d2-5154-7da1-86ba-aed6a7002ee6`. A separate DEV project is not required for
this approved test envelope. Supabase Free rejected branching; no new project or
branch was created, and Core DEV was not changed.

### Environments, fixtures, and limits

Tests used the existing managed Production pair: Core `hxhusfkrlafxdnyasmsu` and
Stock `oyyfcmlquqfrdoffkgsd`. **Production data changed:** one clearly marked test
Company, Owner membership, reservation, Stock tenant, inactive profile, immutable
origins/binding, and audit records were created. The same fixture and command IDs
were reused throughout. Append-only records were retained, not deleted.

Run: `28047c1c-a0c6-425e-bb08-bb8b21f15ec9`; Core subject
`acdcbea5-9516-487b-b654-fb1f56a892f2`; Stock subject
`7a44cf21-b34a-4d40-89c0-92f898b51bff`; Company
`495681c7-a888-48bc-8cab-52d8f3ad02a7`; reservation
`2728ea28-47e8-4c0f-bf55-d782d4f332e0`; admission command
`d42747bf-a4a5-40ac-b91b-b4cae4e29c9c`; binding command
`dd820e74-d36b-486b-8d03-b698d6901db6`.

Private Core/Stock Preview snapshots temporarily enabled application gates,
pinned the two UAT aliases, restricted Core identity to the exact fixture, and
expired at `2026-10-26T06:16:51.929Z`. Test-only Preview protection used existing
short-lived Vercel OIDC credentials. Actual repository release constants stayed
false. There was no payment, entitlement, active Stock access, generic Registry
enablement, schema/ACL/RLS migration, or Production app promotion.

### Executed acceptance

| Level/scenario | Fresh evidence | Result |
| --- | --- | --- |
| Managed Auth/DB integration | `MANAGED_FLOW.json`, 48/48 | PASS: real concurrent admission, same-command recovery, native PKCE, lost acknowledgements after real commits, reciprocal inactive binding, native code replay rejection, effective RLS, and fresh Core session revocation denial. This driver uses test source gates and a Core loopback address adapter; it is not browser evidence. |
| Deployed Preview HTTP/cookie session | First 16 assertions in final `DEPLOYED_HTTP.json` | PASS: anonymous 307, authenticated fresh quarantine 200, controlled invalid input, foreign Origin 403, native start 303, real managed consent and callback 200, no provider credentials in normal Stock cookie, replay 400, inactive dashboard 307 to login. |
| Revocation | Final HTTP teardown/Core denial plus `POST_REVOCATION_STOCK.json` | PASS: global fixture revocation and bans; fresh Core GET denied; an actual prior Stock browser session gets `ok=false` and zero visible tenants. |
| Browser Origin regression | `BROWSER_RESULT.json`, before/after actual request headers | FIXED in candidate: `no-referrer` made the cross-origin form send `Origin: null` and receive 403. Workspace metadata now uses `strict-origin`: exact Core Origin, origin-only Referer, and 303. Stock Origin validation was not relaxed. |
| Deployed browser quarantine and return | Core/Stock desktop and mobile screenshots, `BROWSER_RESULT.json` | PASS WITH ADAPTERS: native Auth, real inactive receipt, UUID-only return link, fresh Core quarantine, reload. At 390×844 both documents are 390px wide; controls are at least 44px. |
| Uninterrupted configured consent | `consent-provider-404.png` | FAIL in existing Production routing: managed consent lands at `www.webzoka.com/oauth/consent/`, which returns 404. The successful browser run navigated the same authorization request to Core Preview and authenticated the protected callback separately. It is not uninterrupted Production acceptance. |

Harness failures remain in evidence. The first integration attempt did not handle
an already-approved consent redirect; the application already did. An HTTP driver
initially omitted `await` on SDK cookie combination. Its final revocation check
also expected a null/array instead of the installed `{ok:false}` contract.
`DEPLOYED_HTTP.json` therefore retains that failed harness assertion rather than
claiming 19/19. Independent fresh Stock browser-cookie readback confirms the
actual denial and effective RLS. Source tests are not weakened to hide failures.

### Consent-host repair selected by the Owner's delegated decision

The Owner's “pilihkan keputusan yang paling tepat untuk kestabilan dan bisa live”
authorizes the stability choice and implementation in the corporate host.
Provider inspection identifies `www.webzoka.com` as `ja-landingpage-platform`,
project `prj_BjUvWyOuoXPu3FQ72xvFGhYI0LWp`, working folder `ja-corp-landing`.
The isolated `.wt-consent-route` branch `fix/core-oauth-consent-route` starts at
`74afeb7d2c76cab5a03632359b1fb9ab52c7aee6`.

Two exact-path temporary redirects send `/oauth/consent` and `/oauth/consent/` to
`https://ja-superadmin-platform.vercel.app/oauth/consent`, preserving the managed
request identifier. This avoids changing Core's global Auth Site URL or email
destinations. An injected `next` parameter cannot choose the destination.
Configuration redirects return `public, max-age=0, must-revalidate`; ineffective
scoped page-header entries were removed after actual HTTP verification. Do not
claim no-store on this transport redirect. Core retains managed authentication
and consent checks.

The final corporate Preview is
`https://ja-landingpage-platform-p5tr7eean-rigi26s-projects.vercel.app`, deployment
`dpl_Fe4fGyWUys4VdowALPcZm4DGspVv`. `CORP_ROUTING_HTTP.json` proves 4/4: both
307 variants preserve the request and fixed host, while store/legal rules remain
unchanged. Browser evidence proves navigation into the existing Core login,
preserving the consent continuation, at 1280×800 and 390×844. This uses a synthetic
authorization request selector and is not another authenticated E1 run.

### Cleanup, source verification, and release status

Both fixture Auth accounts are banned and have zero managed sessions. Core has
one test origin, one binding, and two audit events. Stock has one origin, an
inactive profile, two audit events, and zero fixture entitlements. Core E1 is
false with null Stock origin; Stock E1 and generic Registry remain false.
Original Stock Site URL and four callback entries were restored; the temporary
fifth callback was removed, and both managed Auth settings endpoints return 200.
The temporary Stock Preview OIDC environment variable and all three Core/Stock
test deployments were removed. The corporate routing Preview contains no fixture
credentials and remains available for review. Test brokers and browser auth
interceptors were stopped; fixture browser cookies were cleared.

Core focused Origin regression tests pass 20/20; TypeScript and focused ESLint
pass. Current manifests are regenerated and verified after these documentation
changes. The protected runtime proposal is unchanged: actual SHA256
`5ec8142763141981ddacefc4e38e474fb0507a3cb1c246806829162fa0b2d9be`, expected
`c4567b1b3385f23e2ad83975ce42906815dc0b978b5cb4b4d0299dcd07b69cc7`.
That historical approval-integrity failure remains a Core release blocker; no
complete-suite green or Production-ready claim is made.

Production app aliases retain Core `dpl_GQHmfkVbojGZaEzVtQksn9UDVKLT`, Stock
`dpl_4U8ZQxYYV2ayTNBfJL5GeFxRNoco`, and corporate
`dpl_2G9U9qyvtWwzkb1UE5awED5maUTP`. No commit, push, PR, merge, CI, or
Production deployment is authorized by Codex itself. The next controlled release
can ship the independently verified corporate routing repair; Core/Stock feature
activation remains separately gated, including approval-integrity reconciliation
and uninterrupted post-release UAT. Earlier Step 6 notes below are historical.

Evidence directory:
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-production-uat-20261026/scratchpad/`.

## Step 6 — approved UAT preflight and blocked positive flow, 26 October 2026

`START_AUTHORITY`: Owner's "Approve full flow uat" in chat
`01a172d2-5154-7da1-86ba-aed6a7002ee6`. This authorizes full-flow testing;
deployment, release-gate changes and unspecified Production mutations remain
separately protected by the root `AGENTS.md` authority section. The complete
Step 5 source hashes, both repository identities, branches and HEADs were
rechecked with zero drift before any runtime request. No application code changed.

### Executed checks

Vercel connector identity was verified as `rigi26` under the configured team
`team_MGLKh5XmYFCwtCh6CjyaaL6f`. Its Core deployment listing returned 403 and
its exact Stock project search returned no results. The existing CLI independently
authenticated as `rigi26`; read-only inspection of the same exact target aliases
succeeded. Core remains Ready on `dpl_GQHmfkVbojGZaEzVtQksn9UDVKLT`; Stock remains
Ready on `dpl_4U8ZQxYYV2ayTNBfJL5GeFxRNoco`, both Production. These match the
previous security rollout, not evidence that the local successor was released.
Preview catalogs were read only for these two projects. They contain Core entries
up to 13 hours old and Stock entries 15 days old; no current runnable candidate
pair, exact current candidate bytes or isolated database configuration was verified.
No environment values, build/runtime logs or customer records were requested.

| Scenario | Observed | Result and scope |
| --- | --- | --- |
| Anonymous Core `/hub/workspace` | HTTP 307 to `/hub/login`; browser reaches Customer Hub login | PASS, existing anonymous redirect only. The redirect does not prove that the successor workspace page exists behind authentication. |
| Core `/hub/login`, Stock `/login` | Both HTTP 200 | PASS, existing public pages only; no sign-in or cookie-session acceptance. |
| Core quarantine without credentials | POST returns 503, `status=blocked`, `no-store`, no Set-Cookie | PASS, closed deployed boundary only. |
| Stock start without selectors | POST returns 503, `status=blocked`, private/no-store, no Set-Cookie | PASS, closed deployed boundary only; no valid OAuth start was attempted. |
| Stock callback without code | GET returns 503, `status=blocked`, private/no-store, no Set-Cookie | PASS, closed deployed boundary only; no code was consumed. |
| Desktop/mobile DOM | Core login redirect and Stock blocked body observed at 1280×800 and 390×844; document width equals viewport width | Partial BROWSER evidence only. No authenticated flow or successor presentation executed. |
| Screenshot export | MCP rejected the required Temp/Codex scratchpad path as outside its permitted roots | BLOCKED; no screenshot evidence retained and no mobile visual acceptance claim. Output-root controls were not changed or bypassed. |

Browser console observations were the expected Stock 503 plus a favicon 404;
neither establishes an application-code regression. The isolated browser page was
closed. Six HTTP responses and four browser DOM observations are retained in
`PUBLIC_HTTP.json` and `BROWSER_BASELINE.json` under
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-step6-20261026/scratchpad/`.

### Why positive UAT stops here

All three current source release constants are still false. Both source realm
modules pin the live application origins and Production Supabase pair Core
`hxhusfkrlafxdnyasmsu` / Stock `oyyfcmlquqfrdoffkgsd`. Changing only environment
variables cannot make an arbitrary Preview pair satisfy the existing exact-origin
checks. Current database gate state was not queried. No fixture accounts,
Company, membership, reservation, Stock tenant/profile, audit record or payment
were created. No customer credentials were used or requested.

Source inspection of the installed migration files also shows append-only E1
origins/bindings, protected graph references and immutable audit records. A live
positive fixture cannot be promised removable without disabling protections or
approving retained Production records. UAT approval does not authorize either.
Historical SQL and the protected approval-document hash assertion remain unchanged.

### Concrete proposed continuation — not executed or approved

Prepare an isolated non-Production Core/Stock UAT pair and test deployments,
using the exact Step 5 candidate plus reviewed environment-specific configuration.
Before provisioning or mutation, identify exact test project/realm/origin identities,
verify compatible existing zero-cost resources, and ensure no Production/customer
data is copied. Do not install workstation database tooling or incur cost.
E1 gates may be enabled only in the authorized isolated test pair; exact SSO
callback URLs and realm/origin mappings need explicit environment authority.
Preserve strict checks, managed-session requirements, RLS, append-only audit,
distinct commands and inactive Stock membership. A Preview URL against the live
database pair is not an isolated test environment. Any missing compatible free
runtime must be reported before resource creation or a Production fallback.

Once that setup/deployment envelope is approved and available, run the following
acceptance matrix in this same UAT task; no separate technical prompt is needed:

| Test | Required evidence | Current result |
| --- | --- | --- |
| New customer admission → native SSO/PKCE → inactive Stock stage → Core bind → Hub return | Authenticated HTTP cookie session plus real desktop/mobile browser interaction, actual persisted tuple and append-only audit counts, no Core provider credentials in browser storage | NOT_EXECUTED |
| Reload and exact replay | Same admission/binding commands and immutable tuple/audit identifiers; no duplicate Company, membership or resources | NOT_EXECUTED |
| Overlapping callbacks, restart and duplicate code | Actual provider code consumption, per-flow cookie isolation, deterministic interleavings and final database counts | NOT_EXECUTED |
| Lost stage/bind acknowledgement and explicit retry | Inactive partial state; same IDs and fresh authority; no automatic retry or invented cross-database rollback | NOT_EXECUTED |
| Revocation, foreign account/tenant, current Owner loss, expiry and contention | Real managed Auth, effective RLS/ACL, ≤30-second checkpoint semantics and actual transaction scheduling | NOT_EXECUTED |
| Test-state restoration | Revoke fixture sessions, restore test-only configuration, retain immutable test audit in the isolated environment; verify no Production changes | NOT_EXECUTED |

`FINAL_STATUS: FULL_FLOW_UAT_BLOCKED_MISSING_ISOLATED_RUNNABLE_CANDIDATE`.
`FULL_FLOW_UAT: NOT_EXECUTED`. `PRODUCTION_READY: NO`.
`PRODUCTION_APPLICATION_OR_DATABASE_STATE_CHANGED: NO`.
The earlier Step 5 STATIC/UNIT evidence remains applicable to unchanged source;
Core's protected-document failure is still unresolved. Only documentation and
current native manifest bytes change in this continuation. No commit, push, CI,
deployment, flag/provider/SQL mutation, dependency/worktree creation or cleanup
occurred. Required next Owner decision: authorize the isolated UAT setup and
test deployments described above; existing testing approval remains valid.

## Step 5 — local concurrency and recovery checks, 26 October 2026

`START_AUTHORITY`: Owner's "Go step 5" in chat
`01a172d2-5154-7da1-86ba-aed6a7002ee6`, continuing the existing local-only
Core/Stock envelope. Preflight found zero source or HEAD drift from Step 4.
The same two worktrees were reused. No runtime, provider, SQL, CI, commit, push,
deployment, financial action or new worktree/dependency installation occurred.
All three application release constants remain false.

### Reproduced defects and repairs

| Finding | Before repair | Repair and fresh UNIT evidence |
| --- | --- | --- |
| S5-F01: late callback cleared a newer restart | Callback A paused after code exchange. Restart B set a new continuation and PKCE verifier. A's successful response then deleted both singleton cookies, preventing B from completing. The ordered regression failed before repair. | Continuation and PKCE browser cookies now have separate names per random flow UUID. The cookie bridge projects only that flow's verifier into the installed SDK's normal storage key, including chunks. A callback deletes only its own cookies. Explicit restart retires valid older flows observed in its request, preserving their original command/Company/reservation selectors. Tests cover late success and uncertainty before/after B completes, parallel starts with reversed responses, chunk cleanup, duplicate-code consumption, and isolation from unrelated normal-login verifiers. |
| S5-F02: contention looked like a policy denial | Native admission mapped SQLSTATE `55P03` to `denied`, removing the Hub's explicit same-command retry path. The regression expecting retained uncertainty failed before repair. | Admission, Stock staging and Core binding classify writer `55P03` as `unconfirmed` with their original selectors. Other SQL policy refusals still deny; missing RPCs still block. There is no automatic writer retry. A controlled overlapping admission test proves a busy caller preserves its command and reauthenticates on explicit retry. |

Recovery composition tests load actual source from both repositories and the
installed SSR SDK. Synthetic Auth and RPC boundaries retain modeled durable
state across request-local clients. Cases cover lost stage replies, lost Core
acknowledgements, stage/bind contention, fresh-session retries, duplicate
callbacks, revoked/missing Owner authority after a partial result, overlapping
callbacks and attempted replacement of an already bound command. Every
successful public receipt remains inactive. Same-key retries retain the modeled
tuple and audit identifiers; that is evidence of caller behavior against an
assumed SQL contract, not proof of database uniqueness or atomicity.

### Fresh evidence and contract limits

| Level / requirement | Result | Evidence and limit |
| --- | --- | --- |
| STATIC | PASS | Both TypeScript checks and focused source lint exit 0. Current native manifests retain 64 raw / 63 Git-byte entries; final manifest and diff checks are recorded separately after this documentation update. Historical SQL/install artifacts remain unchanged. |
| UNIT, Core broad | 836/837; one pre-existing failure | `core-unit-final.txt`, zero skipped. Sole failure: unchanged `RUNTIME_APPROVAL_PROPOSAL.md` hash mismatch, actual `5ec814...d9be` versus protected historical `c4567b...cc7`. Neither document nor assertion was edited, repinned or skipped. |
| UNIT, Stock | PASS: 264/264 | `stock-unit-final.txt`, zero skipped. Includes 58 reciprocal source-composition cases, flow-isolated SDK cookie tests and writer-contention recovery. |
| Recovery selectors and authority | PASS, UNIT | Admission/binding commands remain distinct; recovery retains original IDs and rechecks current native identity, session and Owner context. Partial work stays inactive; no cross-database rollback, entitlement, activation or payment is claimed. |
| Browser cookie interleavings | PASS, UNIT | Real Next Request/Response and installed SSR SDK, synthetic token endpoint, manually ordered browser cookie-jar responses. No real browser or managed OAuth server executed. |
| SQL concurrency, audit atomicity, RLS and managed Auth | NOT_EXECUTED | Mocked RPC serialization/replay is an assumption. No actual lock scheduling, database race, effective ACL/RLS or live revocation evidence. Installed SQL source guards are STATIC only. |
| Framework build/hydration; deployed HTTP/browser UAT; Production | NOT_EXECUTED | Presentation source is unchanged; Step 3 renders remain layout-only evidence. This task neither starts a deployed flow nor opens a release flag. |

Flow-scoped cookies protect E1 continuation and PKCE state from late responses.
The normal Stock session cookie intentionally retains the SDK's normal shared
name. This change does not promise a global "latest login wins" rule across
tabs, immediate logout at SQL commit, or a cross-system transaction. Request-local
paired identity and bounded observation checks remain mandatory. Runtime browser
acceptance must still exercise overlapping logins, code replay and expiry against
the real provider, followed by authorized database checks of tuple/audit counts.
No new Auth-row locks, privileges or provider callback configuration were added.

Evidence directory:
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-step5-20261026/scratchpad/`.
Before-fix logs: `stock-overlap-before.txt`, `core-contention-before.txt`.
`FINAL_RESULT.json` records final source hashes, exact results, protected artifacts
and changes since Step 4. Broad tests precede the documentation-only update;
the final manifest check covers the final document bytes independently.

`FINAL_STATUS: LOCAL_CONCURRENCY_RECOVERY_CHECKED_WITH_PREEXISTING_CORE_SUITE_FAILURE`.
`DB_CONCURRENCY_ACCEPTANCE: NOT_ESTABLISHED`. `PRODUCTION_CHANGED: NO`.
This is a same-agent contract review, not independent certification or release
approval. Both worktrees remain uncommitted and unstaged. Step 6 is full-flow
HTTP/browser UAT under applicable runtime authority; Step 7 is controlled release
and cleanup. Neither phase runs automatically from this local handoff.

## Step 4 — local security and failure acceptance, 26 October 2026

`START_AUTHORITY`: Owner's "Go step 4" in chat
`01a172d2-5154-7da1-86ba-aed6a7002ee6`, following the Step 3 handoff. The same
local Core/Stock envelope continues: inspect, reproduce, minimally repair and
verify security/failure behavior. Release constants remain false. There is no
new authority for provider access, live SQL/Auth execution, CI, commit, push,
deployment, payment or Production mutation.

Preflight compared both HEADs and every source hash retained in the Step 3
handoff; there was zero drift. The original branches/worktrees and prior work
were reused. No dependency, worktree or local database runtime was installed.

### Findings reproduced and repaired

| Finding | Reproducer and first broken boundary | Repair and fresh result |
| --- | --- | --- |
| S4-F01: expired parallel identity observations | A context read can finish after its parallel identity checks. With a logical 31-second read delay, Core binding and Stock staging could still invoke their writer, or return confirmed quarantine after a write; Stock's final reciprocal confirmation had the same gap. Five stale-window cases failed before repair. This is an application observation-lifetime defect, not evidence of a live database access bypass. | Stock identity observations in the Core binder now expire at the earlier JWT expiry or observation start + 30 seconds. Core binding, Stock staging and final server confirmation check the original deadlines after awaited context reads. The writer receives the earlier unchanged Core/Stock deadline. Expiry before a write denies without invoking the writer; expiry afterward returns `unconfirmed` with the original selectors. Logical 29-second controls pass; 30/31-second staging/binding cases refuse stale observations. |
| S4-F02: malformed direct action argument | A direct Server Action call with a null/plain-object form argument threw before returning a controlled result. The bound selectors and previous state are untrusted inputs too. | The Hub DAL checks the runtime FormData type before reading fields. Malformed arguments return `invalid` before admission. Tests invoke the actual action wrapper and also prove that forged previous quarantine/Company state cannot override a fresh denial. |
| S4-F03: incompatible UUID acceptance | Generic `z.uuid()` accepted nil/max UUIDs as binding selectors even though native SSO and the approved request codec reject them. An admission could therefore be followed by an unusable continuation selector. | Hub keys and result selectors reuse the existing canonical RFC UUID codec. Nil/max UUIDs fail before admission/read; valid uppercase keys normalize and remain distinct. The immutable historical codec and existing login allowlist were not changed. |

The retained before-fix logs contain seven failing cases across these three
findings; the same 12-case reproducer selection passed after the first targeted
repair for each cause. Additional exact-deadline, action-state and normalization
checks are included in the final broad run. The tests use a logical clock and
synthetic RPC/Auth observations. They do not simulate PostgreSQL lock scheduling
or prove managed-provider revocation at wall-clock time.

The source SQL retains its independent `p_auth_until` validation; no SQL or Auth
row lock was added or changed. These repairs preserve the approved checkpoint
model and do not claim instantaneous cross-system logout at transaction commit.

### Acceptance against the approved contract

| Requirement | Local result | Evidence and scope |
| --- | --- | --- |
| Closed release fuses; strict inputs | PASS, STATIC/UNIT | Real source constants remain false. Existing gate tests make no SDK/writer calls; malformed action inputs, unknown form/query authority fields, injected HTTP role/token/status fields and unsupported UUIDs fail closed. |
| Current native identity and exact realms | PASS, UNIT | Actual Core and Stock source rejects banned/deleted/unconfirmed/anonymous accounts, foreign issuer/audience/role/subject, expired/future tokens, nonliteral managed-session success and missing/wrong native links. Core's actual native binder independently checks customer policy and current Owner context. |
| Fresh authority after waits | PASS, UNIT | Original deadlines are checked after parallel reads. Boundary cases cover 29, 30 and 31 seconds for pre/post staging and binding, plus delayed final reciprocal confirmation. A 30-second observation cannot be renewed by waiting. |
| Inactive partial outcomes and stable recovery selectors | PASS, UNIT | Lost Stock/Core responses, failed/missing bind RPC, wrong/active writer or persisted-context receipts, post-stage/post-bind revocation and tampered HTTP acknowledgements remain inactive and unconfirmed with the same command/Company/reservation. No automatic retry or claimed cross-database rollback occurs. |
| Credential custody | PASS, UNIT | All 49 reciprocal source-composition cases use the installed SSR SDK/PKCE code and actual source from both repositories, with synthetic Auth/RPC responses. Persisted browser cookie payloads are decoded and checked for absence of Core provider/refresh credentials on both success and failure; public receipt bodies do not expose them. Existing cookie, HTML/no-referrer/CSP and body-limit suites also pass. |
| E1 scope; legacy, ownership and finance boundaries | PASS, STATIC/UNIT | Generic legacy Company/Owner mutation and checkout/activation bindings remain blocked. Current native Owner/context checks are required. No E2/E3 proof shortcut, tenant adoption, billing token, payment, entitlement or active portal grant was added. Existing Hub dispatcher, billing and historical SQL source protections remain intact. |
| Effective RLS/ACL, native OAuth trust and SQL transaction behavior | NOT_EXECUTED in Step 4 | Synthetic getClaims/RPC results do not prove live signature validation, managed-session revocation, effective RLS, uniqueness, audit atomicity or database rollback. Existing installed-source checks are STATIC evidence only. |

This is a same-agent review against the approved contract with adversarial input
and failure tests; it is not independent security certification or release approval.

### Fresh verification and limits

| Level | Result | Evidence |
| --- | --- | --- |
| STATIC | PASS | Both TypeScript checks, focused lint and diff checks exit 0. Current native manifests retain 64 raw / 63 Git-byte entries; protected installation artifacts are unchanged. |
| UNIT, Core broad | 833/834; one pre-existing failure | `core-unit-final.txt`, zero skipped. The sole failure remains the protected `RUNTIME_APPROVAL_PROPOSAL.md` hash mismatch: actual `5ec814...d9be`, historical expected `c4567b...cc7`. Neither the document nor its expected hash was edited. |
| UNIT, Stock | PASS: 246/246 | `stock-unit-final.txt`, zero skipped; includes 49 actual-source reciprocal composition cases and the new clock/failure cases. |
| Reproducer | PASS after repair | `core-reproducer-before/after.txt` and `stock-reproducer-before/after.txt` retain failing and passing results. |
| UI layout evidence | REUSED only for unchanged presentation | Step 3 TSX/CSS/Stock HTML source is unchanged. Its 22 synthetic desktop/mobile renders remain layout evidence; they do not prove the new guards or a live browser flow. |
| FRAMEWORK BUILD / HYDRATION | NOT_EXECUTED | No running Next.js app or browser Server Action submission. |
| INTEGRATION / DB RUNTIME / CONCURRENCY | NOT_EXECUTED | No provider, SQL, real transaction scheduling or managed Auth execution. |
| DEPLOYED HTTP / BROWSER UAT / PRODUCTION | NOT_EXECUTED | No deployment or Production action; existing runtime/release gates remain binding. |

Evidence directory:
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-step4-20261026/scratchpad/`.
`FINAL_RESULT.json` retains exact final source hashes, validation and requirement
results. Unit evidence remains valid across the subsequent documentation-only
update; the final manifest check separately verifies those exact document bytes.

`FINAL_STATUS: LOCAL_SECURITY_FAILURE_ACCEPTANCE_VERIFIED_WITH_PREEXISTING_CORE_SUITE_FAILURE`

`RUNTIME_SECURITY_ACCEPTANCE: NOT_ESTABLISHED`.
`PRODUCTION_CHANGED: NO`. No live customer rows, credential values or .env values
were read. SQL, migrations, ACL/RLS, Auth/provider settings, allowlists, billing
and deployed applications are unchanged. Both worktrees remain uncommitted and
unstaged with protected/unrelated work preserved. The next package is Step 5
concurrency/recovery acceptance; full-flow UAT and controlled release remain later
gates, and this result grants no authority to open runtime flags.

## Step 3 — Customer Hub caller and results, 25 October 2026

`START_AUTHORITY`: Owner's "Go a head step 3" in chat
`01a172d2-5154-7da1-86ba-aed6a7002ee6`, following the Step 2 handoff. This
authorizes the local caller/result implementation and focused verification in
the same Core and Stock worktrees. It does not authorize opening release flags,
provider or database changes, CI, commit, push, deployment or payment activation.

### Caller and navigation

The dedicated `/hub/workspace` route uses the existing Hub navy/blue palette,
clear form hierarchy, one primary action, visible inactive state and a stacked
mobile layout. It does not route a native Company through legacy tenant data,
inventory or billing. Existing `/hub`, its dispatcher, blank-Company isolation,
legacy onboarding, billing actions and Owner checks retain their behavior.
The previously detached `E1WorkspaceCandidate` remains an unchanged historical
candidate; the new route uses `WorkspaceView` and a separate Server Action.

The initial route generates distinct admission and reciprocal-binding UUIDs in
the current URL. Admission posts only the business name; the server validates the
bound selectors, the shared normalized-name schema and the current customer
through the native DAL. Unknown/duplicate application fields and shared command
UUIDs fail before admission. React action state preserves pending, invalid,
denied, blocked and uncertain results. An uncertain admission keeps the same
keys and name for retry; it never generates a replacement command automatically.
Reloading the original URL retains both keys. The business name is not placed
in the URL; after a reload it must be entered again if admission is unconfirmed,
and the native idempotency contract rejects a different payload for that key.

After admission, only the binding command, returned Company and reservation
selectors replace the current URL. The Stock form posts exactly those three
selectors to the fixed approved Stock origin and retains them on retries. A
reload/status check independently reads `core_registry_e1_stock_context` under
the current customer's pinned Core JWT. Both native flags, realm, current account,
managed session, customer policy and matching subject/Company/reservation are
checked; identity is rechecked after the read. No admin client or writer is used
for this read. The UI receives only the name, selected IDs and inactive status.
`quarantined` here means Core currently records a reciprocal quarantine tuple;
it is not a fresh independent Stock session observation or an active access grant.

Login adds an entry link. The authentication proxy preserves `next` only for the
existing OAuth consent path and this exact workspace path. The return allowlist
accepts either no selectors, distinct admission/binding keys, or the exact three
UUID selectors; duplicate fields, extra status/activation hints, fragments and
foreign origins are rejected. Existing OAuth and password-recovery rules remain.
The exact navigation delta and return-helper bytes are covered by the existing
source-preservation contracts and the refreshed current native manifests. The
protected approval proposal and its failing historical hash assertion are unchanged.

### Stock browser results

Native start/callback handlers preserve their JSON protocol for existing clients.
Requests accepting HTML receive a static, script-free result screen with
`quarantined`, `unconfirmed`, `denied`, `blocked` and unavailable/pending recovery
messages. The callback's actual server result supplies the message. No query
parameter can assert success. Return links use the fixed Core origin and UUID
selectors only; Hub rereads its own current state on return.

HTML responses retain private/no-store headers, SDK cookie chunks and exact
continuation deletion on confirmed quarantine. A unit test caught combined
Set-Cookie parsing losing deletion; cookies are now reapplied individually from
the original response. Provider tokens, refresh tokens, codes and flow nonces
are absent from rendered pages and return URLs. Responses include no-referrer,
nosniff and a restrictive CSP. Conflicting starts return the original continuation
selectors; a lost callback response remains uncertain with those selectors and
keeps recovery continuity. No browser redirect enters a protected Stock portal.

### Fresh evidence and remaining gates

| Level | Result | Evidence and limitation |
| --- | --- | --- |
| STATIC | PASS | Core and Stock TypeScript; focused lint; exact-byte native manifests; diff checks. Source constants remain false. |
| UNIT, Core | 823/824; one existing failure | `core-unit-final.txt`. Includes 15 caller/render tests and 12 native context cases. Sole failure is the preserved approval-document hash mismatch, actual `5ec814...d9be` versus historical expected `c4567b...cc7`. Zero tests skipped. |
| UNIT, Stock | PASS: 199/199 | `stock-unit-final.txt`, including HTML/JSON status handling, actual SDK PKCE/cookie code, continuation deletion, selector recovery and the 10 reciprocal source-composition cases. Auth/RPC results remain synthetic. |
| LOCAL VISUAL | PASS: 22 rendered states | Seven Hub and four Stock states at 1440×1000 and 390×844. Actual component/stylesheet renders and actual handler-generated HTML; no horizontal overflow, inputs 16px, interactive target heights at least 44px. Screenshots are retained in the task scratchpad. |
| FRAMEWORK BUILD / HYDRATION | NOT_EXECUTED | No running Next.js application or live Server Action/browser submission was exercised. Static renders use synthetic action-state hooks for inspection only. |
| INTEGRATION / DB RUNTIME | NOT_EXECUTED | No provider session, SQL, effective RLS, transaction, contention or recovery-runtime test was run in this step. |
| DEPLOYED HTTP / BROWSER UAT / PRODUCTION | NOT_EXECUTED | The deployed applications are unchanged. Local render screenshots do not satisfy the later full-flow UAT gate. |

Evidence directory:
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-step3-20261025/scratchpad/`.
Final screenshots use `h1-g1-step3-new-1440.png`, `h1-g1-step3-new-390.png`,
`h1-g1-step3-blocked-390.png`, `h1-g1-step3-reserved-390.png`, and
`h1-g1-step3-stock-quarantined-{1440,390}.png`. Earlier screenshots without a
numeric viewport suffix document the initial font-fallback inspection and are
superseded. `browser-layout-results.json` records all 22 layout observations.
The temporary synthetic-render HTTP server is stopped after verification.

`FINAL_STATUS: LOCAL_HUB_CALLER_AND_RESULTS_VERIFIED_WITH_PREEXISTING_CORE_SUITE_FAILURE`

`PRODUCTION_CHANGED: NO`. Both worktrees retain uncommitted source and prior
Steps 1–2 work. All three application release constants remain false. SQL,
migrations, ACL/RLS, native Auth settings, allowlists and deployed applications
were not modified. No .env values, live credentials or customer rows were read.
The next package is Step 4 security/failure acceptance; Steps 5 concurrency and
recovery, 6 full-flow HTTP/browser UAT and 7 controlled release remain separate.

## Step 2 — reciprocal server integration, 25 October 2026

`START_AUTHORITY`: Owner's "okee go next step 2" in chat
`01a172d2-5154-7da1-86ba-aed6a7002ee6`, after the Step 1 handoff. This continues
local implementation and verification in the same two worktrees, with Step 1
changes preserved. Core HEAD remains `e92e74bb4536e8f7344c3c376fd02a1d35797756`;
Stock HEAD remains `72fb354ace0da860de5f3ea9ee2bc387290bd74d`. No additional
checkout, dependency installation or external runtime action was needed.

### Server composition

1. Stock's dedicated start/callback handlers retain native OAuth, random nonce,
   SDK PKCE, bounded continuation and the same request-local callback client.
   Configured application origins must exactly equal
   `https://ja-superadmin-platform.vercel.app` and
   `https://webzoka-stock-platform.vercel.app`. Another valid Vercel hostname is
   rejected before code exchange or credential transmission. Both repositories
   pin the same public application/database realm mapping.
2. Shared Stock identity verification checks live accounts, verified claims,
   issuer, audience, role, session, expiry and the native linked Core subject.
   Core identity additionally requires its installed managed-session RPC with
   the pinned bearer. Each observation expires within 30 seconds of its start;
   slow calls cannot extend prior authority. Provider credentials remain in
   callback memory; the existing cookie adapter strips them from browser storage.
3. Stock stages through the existing `stock_e1_resource_stage` command. It
   rechecks current Core reservation and both identities, then independently
   reads `stock_e1_resource_context` under the pinned Stock JWT. That installed
   context checks managed-session state and the persisted inactive profile/audit
   tuple. A writer response alone cannot establish staging confirmation.
4. `e1StockMutationBinding('e1.stock.bind')` now selects
   `core_registry_e1_stock_bind_stage`. Core checks the linked native accounts,
   current Owner/reservation and fresh Stock context before the atomic RPC, then
   verifies both contexts afterward. A missing RPC reports a blocked dependency;
   there is no fallback writer. Core's JSON body is capped at 2 KiB and three
   seconds, with bearer-only authentication and generic private responses.
5. Stock sends the two pinned customer credentials only in headers to the fixed
   Core path, with redirects disabled, no cookies, no-store and a bounded timeout.
   After the Core receipt, Stock independently rereads current Core reciprocal
   binding and Stock inactive context. An acknowledgement without a persisted
   matching Core tuple returns `unconfirmed`. Successful confirmation remains
   `quarantined` with `isActive: false`; no active portal or billing grant occurs.

`bound` selects a reviewed implementation; it is not runtime readiness or release
authority. All three application release constants remain false. Generic legacy
Registry mutations, E2/E3/operator paths and checkout/activation remain blocked.
SQL, migrations, ACL/RLS, database settings, Auth configuration, callback allowlist,
deployed applications and the Step 1 protected files were not changed.

### Caller contract for Step 3

Use the Company and reservation IDs returned by admission, then create and retain
one distinct UUID for the reciprocal binding command. Admission and binding must
not share a command UUID: the native audit has `UNIQUE (actor_id, command_id)`.
The form's `commandId` is this binding-command selector, never an authority claim.
Every retry/restarted SSO must retain that same binding command, Company and
reservation. A lost cross-realm response or a later Core policy/session denial
can leave a committed inactive resource; Core rechecks its own customer policy,
including its email allowlist, before binding. Such an inactive resource
cannot be rolled back through HTTP or replaced with new IDs automatically.

Step 3 owns the Customer Hub caller and result UI. Its result handling must
preserve `quarantined`, `unconfirmed`, `denied` and `blocked`, without interpreting
quarantine as product activation. No Hub caller or user-facing copy was changed.

### Verification and limits

Fresh source-composition checks passed 10/10 in Stock
`scripts/e1-reciprocal.spec.mjs`. They load actual source from both repositories,
exercise installed SSR PKCE/cookie code and the actual Core handler, native
binder, Stock staging and server composition. The fixture validates the generated
PKCE verifier/challenge relationship, inactive success, native pairing/session
denials, closed gates, lost response and an acknowledgement without Core binding.
Auth and RPC responses are synthetic: this is UNIT source-composition evidence,
not managed OAuth, SQL transaction, effective RLS, concurrency or Production proof.

Stock's selected existing and new unit suites passed 192/192; Core reciprocal
checks passed 68/68, including fresh managed context, missing RPC and stalled-body
denial. The unrelated protected approval-document hash failure from Step 1 remains
the sole Core broad-suite failure; that file was verified byte-identical to the
Step 1 handoff and was neither repinned nor skipped.

`FINAL_STATUS: LOCAL_SERVER_INTEGRATION_VERIFIED_WITH_PREEXISTING_CORE_SUITE_FAILURE`

| Validation | Result | Evidence |
| --- | --- | --- |
| STATIC | PASS | Core/Stock TypeScript exit 0, focused lint exit 0, both diff checks exit 0; current Core raw/Git-byte manifests contain 54/53 entries. |
| UNIT, Stock | PASS: 192/192 | `stock-unit-final.txt`, including 10 actual-source reciprocal composition cases. |
| UNIT, focused Core | PASS: 68/68 | `core-bind-final.txt`, including bounded-body denial and current persisted-context checks. |
| UNIT, broad Core | FAIL: 796/797; zero skipped | `core-unit-final.txt`; only the existing protected `RUNTIME_APPROVAL_PROPOSAL.md` hash mismatch described in Step 1. |

The TypeScript Core check is retained from the same unchanged TypeScript source;
later edits affected tests, documentation and manifests. Source-composition tests
explicitly override release constants only in their isolated module mocks; the
shipped source constants remain false. Historical SQL and the installation
manifest have no Git diff. Both worktrees retain uncommitted, unstaged work.

Evidence directory:
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-step2-20261025/scratchpad/`.
`INTEGRATION / DB RUNTIME / BROWSER UAT / PRODUCTION: NOT_EXECUTED` for this phase.
No UI behavior was activated, and no external runtime or release action was
performed. The installed foundation's historical evidence retains its original
scope; these new adapters require later signed runtime and full-flow acceptance.
`PRODUCTION_CHANGED: NO`. Commit/push/CI, enrollment, flag activation, merge and
deployment were not performed. Step 2 does not authorize the later packages.

## Step 1 — Core authority binding, 25 October 2026

Scope authority: Owner requested "Okeey go on next step on the new chat task"
in source chat `01a16b4f-46a0-7342-84c6-b957ede58024`. The resulting handoff to
`01a172d2-5154-7da1-86ba-aed6a7002ee6` authorizes local investigation,
implementation and focused verification of Step 1. Packages 2–7 and release
actions are not activated by this work. The existing Core and Stock worktrees
were reused at `e92e74bb4536e8f7344c3c376fd02a1d35797756` and
`72fb354ace0da860de5f3ea9ee2bc387290bd74d`; unrelated Core files were preserved.

### Implementation and trust boundaries

- `core-company.ts` now delegates new Stock Company creation to the native E1
  admission command, using only a normalized name and idempotency key. Reads
  require an explicit Company selector and delegate to native authorization.
  The active realm is `hxhusfkrlafxdnyasmsu`; `oyyfcmlquqfrdoffkgsd` remains the
  fixed Stock realm. Legacy DEV exports remain only for the unchanged, unwired
  W1 proposal. No active native verifier uses that DEV realm.
- `core-registry-native.ts` verifies one pinned bearer with `getUser`, signed
  claims and the installed `core_registry_session_is_live` RPC. The RPC and
  Company read use an explicit Authorization header; cookie/default-client
  identity cannot substitute another bearer. The observation expires no later
  than 30 seconds after verification began or JWT expiry. Missing RPC, errors,
  false/malformed results, changed sessions and stale observations fail closed.
- E1 admission uses the real `core_registry_e1_stock_create` RPC after fresh
  checkpoints. That installed command owns generated IDs, canonical history and
  pending-claim exclusion, uniqueness, Company × Stock mapping, immutable origin,
  scoped writer guards and atomic append-only audit. It does not accept an
  existing Company/tenant ID, a clean-history claim or an operator attestation.
  A missing admission RPC reports `E1_ADMISSION_RPC_UNAVAILABLE`; no fallback
  writer or automatic retry is used. Post-write verification failure stays
  `unconfirmed` with the original command ID, never a rollback claim.
- `e1StockMutationBinding('e1.stock.admit')` selects the concrete adapter; its
  `bound` status is not runtime readiness, authorization or release approval.
  Reciprocal bind/checkout remain blocked. `registryMutationBinding()` retains
  the independent proof and two-current-operator dependency for legacy/E2/E3.
  No old W1 issuer is fabricated or imposed on valid resource-isolated E1.
- Both application release constants remain literal false. Database settings,
  provider configuration, SQL bodies, privileges, migrations, Hub callers,
  commercial behavior and Production deployments were not changed. The only
  Stock edit corrects the exact evidence filename
  `CALLBACK_AUTH_HEALTH.WITH_PATTERN.json` in the existing review.

### Revocation semantics and evidence limits

The accepted checkpoint contract recorded below remains binding: deny revocation
observed before the final checkpoint, reauthenticate after contention, and do not
claim instantaneous revocation between an HTTP observation and SQL commit. No
Auth-row locks, Auth writes or new privileges were introduced. The installed
managed-session/RLS rollout evidence remains valid for its unchanged SQL; this
task makes no fresh provider-state claim. Supabase documents why signed JWT
verification alone is insufficient after logout in
[User sessions](https://supabase.com/docs/guides/auth/sessions#how-to-ensure-an-access-token-jwt-cannot-be-used-after-a-user-signs-out).
The installed SDK's `setHeader` behavior is checked with its real RPC builder
and a synthetic fetch response, without network access.

Historical SQL/proposals and `INSTALLATION_MANIFEST.sha256` remain byte-identical.
Current native manifests cover the authorized facade/test successors. Retired
mock W1 facade tests were replaced with real adapter contract tests; preserved
historical SQL and legacy denial tests remain. Older whole-file pins for the
facade are no longer treated as a prohibition on this explicitly requested change.
The Hub activation scanner now checks imports/re-exports/dynamic imports instead
of falsely flagging the detached component's own declaration; negative controls
still reject runtime activation and caller wiring.

Fresh verification artifacts are in
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-step1-20261025/scratchpad/`.

`FINAL_STATUS: LOCAL_IMPLEMENTATION_VERIFIED_WITH_PREEXISTING_SUITE_FAILURE`

| Validation level | Fresh result | Evidence and limit |
| --- | --- | --- |
| STATIC | PASS | `types-final.txt` and `lint-final.txt`: exit 0; both repository diff checks: exit 0. Current raw manifest has 54 entries and Git-byte manifest has 53. Git conversion is checked without staging or writing objects. |
| UNIT | Full suite FAIL: 793 passed, 1 failed, 0 skipped | `unit-final.txt`: 794 checks. The sole failure is the preserved unrelated approval-document hash described below. Native admission, managed-session, facade, isolation, retry, receipt and manifest checks passed. |
| INTEGRATION | NOT_EXECUTED | This task implements internal release-gated DAL behavior; no HTTP caller or runtime was activated. The SDK request-header check uses a synthetic fetch response and is UNIT evidence. |
| DB RUNTIME | NOT_EXECUTED | No SQL or runtime enrollment was authorized or performed for this new phase. Existing installed SQL and prior scoped evidence were reused without a new runtime claim. |
| BROWSER UAT | NOT_EXECUTED | No UI or caller wiring changed. Positive E1 browser acceptance belongs to the remaining packages. |
| PRODUCTION | NOT_EXECUTED | No provider or Production action occurred. No new deployed behavior or acceptance is claimed. |

The remaining full-suite failure is in
`google-oauth-dev.test.mjs`'s historical-artifact guard. The handoff explicitly
protects the unrelated, untracked
`docs/security/h1-g1-core-dev/RUNTIME_APPROVAL_PROPOSAL.md`. Its SHA-256 is
`5ec8142763141981ddacefc4e38e474fb0507a3cb1c246806829162fa0b2d9be`;
the original committed test already pins
`c4567b1b3385f23e2ad83975ce42906815dc0b978b5cb4b4d0299dcd07b69cc7`.
LF/CRLF comparison excludes a line-ending explanation. This task did not edit,
delete, repin or skip that document. `PROTECTED_DOCUMENT_MISMATCH.json` records
the original test pin, untracked state and preservation authority. The full suite
is therefore not reported as PASS. No runtime acceptance follows from the other
793 checks.

Historical SQL, the installation manifest and `core-w1.ts` have no Git diff;
the historical installation-manifest SHA-256 remains
`7a6992ee0b812f71c03ae164538ee3c83781aa6041c9c07571d50e6a28725d6e`.
Task changes remain uncommitted and unstaged on the original branches.
`PRODUCTION_CHANGED: NO`.

### Handoff

Step 2 is reciprocal server integration, using the preserved admission result
and native provider credentials. Keep its gate closed until its own adapters and
acceptance are satisfied. Step 3 owns Hub caller/result UI. Security, concurrency,
recovery, HTTP/browser acceptance and controlled release remain later packages.
Local Step 1 source does not authorize commit/push/CI, runtime enrollment, flag
activation, merge or deployment. No new SQL or provider permission is needed for
the local implementation; future runtime/release work still needs its applicable
explicit authority. No Notion write or new workstation dependency was used.

## Approved security rollout — 25 October 2026

Owner approval in this chat explicitly covers coordinated SQL/app release,
commit/push/deployment and exact callback configuration. Both forward migrations
are installed and matching app builds are promoted: Core 20261025034453 / deployment
dpl_GQHmfkVbojGZaEzVtQksn9UDVKLT; Stock 20261025034454 / deployment
dpl_4U8ZQxYYV2ayTNBfJL5GeFxRNoco. Stock kernel is preserved, direct client profile
writes denied, and managed-session checks now guard Core reads and Stock access.
Stock signed checks 16/16 passed twice; Core signed revocation checks 2/2; deployed
public HTTP 8/8. Desktop/mobile browser checks verified team/denial behavior.
All fixture accounts/profiles removed. Fourteen immutable Stock test audit records
remain intentionally; final counts are 12 users, 12 tenants, 14 profiles, 2149 audit
rows. Runtime/commercial gates remain closed. Exact callback configuration is now
installed and reload-verified; hosted redirect matching passed 10/10 and final Auth
health/settings returned 200. Original three URLs and Site URL remain unchanged.
The initial combined-range pattern caused an Auth 503 interruption; it was removed,
then replaced with documented explicit hex character lists and verified. Full
positive E1 application flow remains unaccepted because runtime bindings are closed.

Current evidence, exact migrations, deployment/source identities and limits:
[coordinated security review](../../../.wt-webzoka-stock-pdf/docs/security/H1_G1_SECURITY_REVIEW_20261025.md).

Earlier sections below are historical and do not revoke this later approval.

## Focused security continuation — 25 October 2026

A rollback fixture independently reproduced revoked-session Company and E1
context visibility in the current Core baseline. The local managed-session
forward proposal adds restrictive RLS and a fresh-session predicate; 29 hosted
rollback assertions passed, including E1 without dual-operator proof, foreign
and revoked denial, bind replay and recovery. The proposal is not installed.

Stock canonical SQL reconciliation passed 49 rollback assertions. Matching
Stock application adapters are integrated locally; 181 unit tests, TypeScript,
focused lint and six local compiled HTTP scenarios passed. All current fixture
accounts/sessions were removed. Runtime and commercial gates remain closed.
The dedicated callback, signed new-policy HTTP, concurrent waits and required
desktop/mobile browser acceptance remain unverified.

The prior credential gate is resolved. PR7 draft status did not block local
remediation. Review and coordinated SQL/application rollout remain separately
gated by the existing handoff and Stock security contract.

Review and exact migration mapping:
[focused Stock/Core security review](../../../.wt-webzoka-stock-pdf/docs/security/H1_G1_SECURITY_REVIEW_20261025.md).


## Current managed Auth checkpoint — 24 October 2026

The Owner supplied the requested Git-ignored Stock runtime configuration and
replaced a rejected server credential with an existing active one. That credential
gate is resolved. Actual Stock Auth/resolver tests passed 33/33; actual native
Core-to-Stock protocol and candidate callback-cookie tests passed 30/30. All
temporary accounts were removed. Provider credentials remained in callback memory;
a subsequent client recovered normal Stock session cookies without Core tokens.
The protocol used the observed existing Stock site destination without navigating
to it. The candidate vercel.app callback allowlist and application/browser flow
remain unverified; the earlier exact-redirect failure is retained.

The missing additive read-only Stock resolver is now installed, with current
managed-session/account and canonical-profile checks. Its migration was rehearsed
with rollback before installation. Eleven functional assertions passed and a
separate observation reproduced legacy inactive-profile tenant visibility. The
resolver denies that profile, but existing tenant RLS still exposes its row.
Existing Stock security PR #7 remains draft/unmerged with no reported checks.
The accepted PR7 baseline remains a release dependency, including reconciliation
with the newly installed resolver. No shared legacy helper/policy was rewritten
or release gate silently removed. Full tenant-isolation acceptance is blocked.

The local HTTP start's missing fresh OIDC nonce was corrected after a failing
regression; affected Stock tests now pass 101/101, with TypeScript and focused
lint clean. All literal flags, fixed refusal bindings and database settings stay
closed. Five additive migrations are installed across Core/Stock. No deployment,
activation, provider configuration change or commercial completion occurred.

Current final readback: Core four Auth users, 22 tenants, zero task fixture
users/sessions and zero Companies/memberships/Registry events/E1 origins. Stock
12 Auth users, 12 tenants, 14 profiles, zero task fixture users/checked sessions
and zero E1 origins. Stock audit count is 2,081; 54 master_data updates appeared
at a single timestamp between probe runs and are preserved. This supersedes the
earlier unchanged-2,027 count; no unsupported source attribution is made.

Detailed acceptance, cleanup, limits and exact next gate:
[Stock managed Auth checkpoint](../../../.wt-webzoka-stock-pdf/docs/security/H1_G1_MANAGED_AUTH_CHECKPOINT.md).
The older checkpoints below remain historical. Required browser, positive
application HTTP, complete isolation, timeout and stage/bind recovery/concurrency
acceptance remain incomplete. No additional credential delivery is needed.

## HTTP wiring and Core managed-session continuation

The Owner's subsequent "okeey go ahead" refers to the proposed HTTP callback,
live-session revocation and tenant-isolation work on the existing Production
pair. The implementation and bounded Core Auth probe below follow that direction;
this is not deployment, payment or general provider-configuration authority.

Stock now has dedicated Node.js endpoints:
`POST /api/auth/e1/start` accepts a bounded form only from the exact configured
Core application origin; `GET /api/auth/e1/callback` accepts an exact code/flow
pair bound to a ten-minute host-scoped Secure/HttpOnly continuation cookie.
PKCE verifier cookies are also HttpOnly. Selectors confer no authority: native
identity, current Owner and canonical reservation checks remain downstream.
Changed/pending intents reject; explicit same-command restart rotates the flow
and rejects late callbacks. Callback responses report inactive quarantine only.
SDK cookie writes cannot weaken no-store policy or inject response redirects.
The generic existing callback and existing middleware are unchanged.

Required non-secret application-origin names are `CORE_E1_APP_ORIGIN` and
`STOCK_E1_APP_ORIGIN`, both exact HTTPS vercel.app origins. Existing Stock
`SUPABASE_SECRET_KEY` is preferred, with `SUPABASE_SERVICE_ROLE_KEY` as legacy
fallback; no new credential, variable value or provider setting was created.
All literal runtime flags, fixed refusal bindings and DB activation settings stay
closed.

Fresh checks: 100/100 Stock unit tests, TypeScript and focused lint passed.
Real Next.js 16.3.8 compiled both endpoint wrappers and returned 503 blocked with
no cookies and no-store headers. This is local negative HTTP integration only.
The task-owned server was stopped. Next's two autogenerated instruction files
were preserved in scratch evidence and removed after exact ownership/content
checks; no unrelated source was reset or deleted. The existing middleware
deprecation warning was retained without unrelated migration.

Both Production Auth health endpoints returned GoTrue v2.197.0 using publishable
keys. Invalid tokens were rejected by the real SDK/API with 403 bad_jwt on both.
Version-pinned upstream source confirms getUser's Auth endpoint loads the
referenced managed session and rejects a removed session; it also rejects banned
users. Therefore a new broad Auth-table grant/session RPC is not justified merely
by assuming getUser never checks session existence. Source/version evidence is
separate from the runtime results below.

Core's existing configuration in its approved main checkout was used only inside
the probe process. No credential or password value was printed, exported or
copied to evidence. Two temporary confirmed Core accounts were created through
the supported Auth Admin API, without invitation/confirmation email. All 24
checks passed: verified issuer/subject/session; getUser before revocation;
unexpired old JWT rejection after local sign-out; independent second-session
continuity; a fresh session after reauthentication; no resurrection of the old
token; ban denial and unban; and negative Company visibility/Owner checks.
Both exact fixture accounts were then signed out and deleted with Auth Admin.
Independent SQL readback established zero fixture users and sessions, the
original four Core Auth users, 22 tenants, zero Companies/memberships/Registry
events/E1 origins, and both DB gates false. Managed Auth audit history can remain.
No raw Auth table was mutated with SQL.

These checks prove the bounded Core password-session behavior, not the complete
Core OAuth provider-token/client-id path, Stock native linkage, positive
cross-tenant RLS, timeout policy or revocation during a database wait. Those
requirements remain open. There is no active membership, entitlement or
commercial/Production application completion claim.

The Owner subsequently approved configuration inspection/reuse from the exact
registered Stock primary checkout at
`D:/Project/Website JapanArena/verification/webzoka-stock-platform-fresh-20261001`.
Its Git identity matches the current Stock repository, but no usable runtime
configuration was present. The Owner then answered "jalankan sesuai best
practicenya" to a request limited to the legacy repository's exact
`D:/Project/Website JapanArena/JapanArena SaaS/ja-stock-platform/.env.local` file.
That file has no Supabase runtime settings; no financial credential was used.
No legacy repository code was changed. These permissions are granted, not pending.

The installed Vercel CLI 50.4.6 was inspected before use. Its `env run` operation
retrieves settings into a child process without writing a dotenv file. Exact
Stock project/team identities were pinned. Production, Preview, the existing
`test/h1-g1-e1-dev` Preview branch and Development supplied no usable Stock URL,
publishable key or server key to the probe. A separate metadata-only rendering
confirmed that this project does have `SUPABASE_SECRET_KEY` for Production and
Preview, and both public Supabase variable names for Production/Preview. Thus
configured variables exist; local retrieval did not yield usable values. The
cause of that discrepancy is not established. No export restriction was bypassed,
and no variable value was printed or persisted. No new or rotated key, provider
change, deployment or resource was requested or performed.

A real public-key native SSO initiation passed six checks: the installed SDK
generated Stock Auth PKCE/S256 authorization, and Stock returned HTTP 302 to
the exact Production Core `/auth/v1/oauth/authorize` endpoint, existing client
`fe3e0af9-2d84-4ec2-a750-b26bb4a81caf`, and exact Stock Auth callback URI.
The redirect was not followed. No consent was approved or Stock account created;
expiring Auth flow state may remain. This proves provider initiation only, not
confidential token exchange, the new application callback allowlist, identity
linkage, a current Stock session or end-to-end SSO.

The immediate technical gate is usable server-side Stock Auth runtime access
from an approved secure source, including exact realm verification and managed
Auth cleanup capability before creating a fixture. Then complete Stock session
revocation/ban, native identity linkage and own/foreign row-access checks. No
repeated Production DB permission, new Stock DEV or raw Auth-table SQL mutation
is required. Full H1.G1 remains incomplete; runtime flags stay closed.

Final independent readback: Core has four Auth users, 22 tenants, zero fixture
users/sessions and zero Companies/memberships/Registry events/E1 origins; native
and E1 gates are false and Stock origin is NULL. Stock retains 12 Auth users,
12 tenants, 14 profiles, 2,027 audit events, zero E1 origins and a false E1 gate.

Evidence:
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-discovery-20261023/scratchpad/`
contains HTTP_START.json, HTTP_UNIT.tap, HTTP_EXECUTION.json,
CORE_SESSION_RUNTIME.mjs, CORE_SESSION_RUNTIME.json,
STOCK_RUNTIME_AUTHORITY.json, STOCK_ENV_METADATA.json, STOCK_ENV_PREFLIGHT_RUNS.jsonl,
STOCK_SSO_INITIATION.json, HTTP_FINAL_READBACK.json and
HTTP_NEXT_GENERATED_AGENT_FILES.json. The previous callback-only checkpoint below
is historical where it says no route exists or all managed Auth was unexecuted.

## Current Production checkpoint — 23 October 2026

The Owner replaced the earlier DEV-only discovery direction with these direct
instructions: "kamu di perbolehkan menggunakan data production. tidak ada batasan",
"smua database production kita boleh di gunakan", and
"kita menjalankan ini gunakan production tidak papa. karna saya blm ada customer.
yang penting ini bisa stabil selesai jangan terlalu banyak halangan".
Use the existing Core and Stock Production databases for this milestone. Do not
request the same environment permission again or require a new Stock DEV.

This checkpoint supersedes the environment/discovery status in the historical
sections below. It does not turn old synthetic tests into runtime evidence or
silently grant unrelated release, payment, credential or infrastructure actions.

### Installed database state

- Core `hxhusfkrlafxdnyasmsu`: the additive native Registry foundation and E1
  extension are installed. Eight Registry tables and three E1 private tables have
  forced RLS. Native runtime and E1 settings remain false; Stock origin remains
  NULL. No Company, membership, portal instance, Registry event, E1 origin or
  binding was created by this work. Existing tenants: 22.
- Stock `oyyfcmlquqfrdoffkgsd`: the additive inactive-resource extension is
  installed, disabled, with no E1 origins. Existing counts remain 12 tenants,
  14 profiles and 2,027 append-only audit events.
- A unique index now prevents duplicate Stock subjects. A subsequent forward
  correction attaches it as a validated nondeferrable UNIQUE constraint, because
  the staging RPC checks `pg_constraint`, not merely `pg_index`. Production
  rollback rehearsal and post-install readback both passed the RPC's exact
  uniqueness predicate. A separate rollback test rejected duplicate profiles with
  SQLSTATE 23505 without retaining a profile or audit event.
- Four durable schema migrations were applied, after rollback rehearsals.
  Historical proposal/rehearsal SQL remains unchanged. DDL notification and
  migration-history effects are real; business row counts did not change.
  Runtime flags, activation, billing and payment settings were not opened.

### Local source and validation

Dormant native server adapters now pin exactly the two Production Supabase
origins through the shared `e1-realm.ts` modules. Stock's reciprocal application
origin is explicit `CORE_E1_APP_ORIGIN`, still HTTPS and vercel.app constrained.
No environment values were read or changed. All literal runtime flags and fixed
refusal bindings remain closed; the frozen Core proxy is unchanged.

Fresh validation: Core and Stock TypeScript and focused lint passed; affected
Core unit tests 134/134, Stock unit tests 77/77, offline composition 23/23 passed.
The Core unit run first failed on the stale manifest after intentional source
changes; the updated manifest rerun passed. Retain the failure as artifact-ordering
evidence. These are synthetic Auth/RPC/HTTP models, not actual native sessions.
Earlier broad test totals are historical and are not claimed as fresh here.

Production DDL/ACL/disabled-state and uniqueness checks passed. Actual managed
Auth revocation, positive customer RLS, cross-request SDK/HTTP and browser UAT
remain NOT_EXECUTED. Provider advisors retain existing findings; new private
no-policy findings reflect denied private-schema access, while authenticated
context-definer warnings require the planned own/foreign-session validation.
No claim of globally clean advisors or complete Production application PASS.

### Exact next technical gate

### Callback continuation — local implementation

The server-only `exchangeAndBindE1StockQuarantine` entry point now exchanges the
native code and stages/binds using one request-local SDK client. Its dedicated
`createE1CallbackClient` strips Core `provider_token` and
`provider_refresh_token` from every Stock auth-cookie batch, reassembles and
rechunks complete encoded sessions with the installed SSR utilities, clears stale
chunks, and refuses malformed/incomplete/duplicate chunks or a read-only cookie
adapter. It preserves normal Stock SSR access/refresh state and unrelated cookies.
Core provider credentials remain only in that request's SDK storage. This is not
a claim that all Stock session credentials are absent from browser cookies.

The literal gate and strict selectors are checked before SDK construction or
exchange. Code-exchange failure performs no staging. A lost stage/bind response
retains the same command and inactive reservation. The caller must forward the
SDK's no-store response headers. No HTTP callback route or Server Action was
registered by this continuation; the generic existing callback is unchanged.

Fresh Stock checks: 88/88 tests passed, TypeScript exit 0, focused lint exit 0.
Missing reciprocal configuration refuses before consuming a one-time code.
The installed SSR/Auth SDK executed PKCE exchange and a second-client cookie
read against synthetic fetch only; the same-client stage/bind cases use synthetic
Core/Stock authorities. Composition rerun: 23/23 passed. Initial TypeScript and
lint failures (optional cookie writer and a test-local variable name) were fixed
and retained in evidence. No actual credential, managed Auth, browser or
deployment execution occurred.

The cookie-custody mechanism is now implemented locally. The next gate remains
the actual HTTP callback/continuation, required response-cache handling, and
managed current-session/revocation plus own/foreign row-access verification.
Opening runtime flags or interpreting an inactive tuple as portal activation
would still exceed the available evidence.
Evidence: PRODUCTION_CALLBACK_EXECUTION.json and PRODUCTION_CALLBACK_UNIT.tap.

Existing Core OAuth client `fe3e0af9-2d84-4ec2-a750-b26bb4a81caf`,
`Webzoka Stock Preview`, is not deleted and points to
`https://oyyfcmlquqfrdoffkgsd.supabase.co/auth/v1/callback`. Its public metadata
uses authorization-code/refresh-token grants and confidential
client_secret_basic authentication. This observation does not prove Stock's
configured provider, matching confidential credentials, application redirect
allowlist or a successful token exchange. No client secret/hash was read.

Complete and validate the server-owned native callback/session transport before
replacing runtime refusal bindings. Stock's current callback is generic, and the
dormant E1 wrapper reconstructs an SSR client to read `provider_token`. Installed
@supabase/ssr 0.10.3 defaults cookies to httpOnly=false; installed auth-js stores
the full session, including provider credentials. A naive callback therefore
fails the intended Core-token custody requirement. There is no new live E1
callback path and flags remain closed; this is an implementation gap, not an
observed customer-token leak.

Use the same server exchange to retain the Core provider credential only for the
bounded stage/bind call, prevent it from entering response cookies or browser
storage, and preserve only the supported Stock session state needed by the
existing portal. Do not globally change cookie visibility without checking
browser-client dependencies. Verify real session revocation and own/foreign
tuple access, stable command replay and interruption recovery before enabling
the feature. Do not infer session liveness from a JWT signature or account
lookup alone. New DEV infrastructure is not this gate.

Detailed evidence:
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-discovery-20261023/scratchpad/`
contains PRODUCTION_REGISTRY_EXECUTION.json, PRODUCTION_E1_EXECUTION.json,
PRODUCTION_CONSTRAINT_AND_AUTH_METADATA.json and PRODUCTION_COMPOSITION_UNIT.tap.
An unrelated concurrent edit to RUNTIME_APPROVAL_PROPOSAL.md was preserved and
recorded separately; that document was not overwritten or adopted as authority.

## Current decision — 23 October 2026 installed Registry catalog compared

Latest local continuation: the Owner answered "continue using best practice" to
the concrete native SSO transport implementation request. The dormant Core POST
handler and Stock server caller are now implemented under that local-only scope.
[Transport boundaries and configuration prerequisites](h1-g1-e1-managed-dev/APP_TRANSPORT.PROPOSED.md)
record the original approval hash and exact credential/selector paths. The new
Core native path uses explicit provider credentials and never falls back to Core
cookies; current Owner, native-link, realm and reciprocal tuple checks are reused.
Stock sends one bounded request after staging and preserves the same command on
uncertainty. No active membership or entitlement is issued. All literal flags and
fixed refusal bindings remain unchanged. No configuration, provider, CI/runtime,
deployment, commercial or Production action occurred.

The new local evidence composes the actual Stock wrapper, native Request/Response
handler and Core native binder through a synthetic fetch bridge. It closes the
source join only. Auth/SDK/RPC, idempotency and audit effects remain model state;
it establishes no actual SDK/network, Next.js runtime, database, native cookie or
browser behavior. Evidence is in
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-native-transport-20261023/scratchpad/`.
Full positive onboarding CODE_READY remains NO.

Owner's "gooo ahead continue" authorized the exact previously proposed one-time
catalog-only transaction on existing Core DEV `mcvekinhgcqygfddyifs`. The project
URL and proposal SHA-256 were verified before execution. One SQL read completed;
no customer, Auth, settings-value or migration-ledger rows were queried and no
provider write occurred. No additional provider SQL authority is inferred.

The three accepted public RPC definition hashes match exactly. All six installed
native function bodies match SQL008's reviewed bodies. The eight tables' columns,
constraints, indexes, forced RLS, grants, audit trigger and policy expressions
were compared with the reviewed native source. This closes the missing native
definition comparison at catalog/source level; it does not reconstruct the exact
historical permanent installer or establish managed transaction/application PASS.
The first snapshot returned policy role OIDs without their names. The Owner then
explicitly approved one execution of `NEXT_PRECHECK.READ_ONLY.PROPOSED.sql`
(SHA-256 `8170785c4b15bbe9297593db8d8ffaaff5829cfdf3d8645037a729f5e5f82d86`).
The exact file text was executed once against the verified Core DEV project URL.
All three policies target only `authenticated`. Both queried E1-private schemas
and all four queried public E1 RPCs were absent at that snapshot. Six enabled
provider event triggers were inventoried with function hashes; two have no tag
restriction. The local forward preflight now pins that catalog snapshot too.
No trigger behavior, settings values, customer/Auth rows or migration ledger was
queried or established. The preflight rechecks both snapshots before any DDL;
catalog pins do not freeze concurrent provider configuration or prove runtime.
Each of the two read approvals was used once and is now consumed.

Subsequent public-source review reconstructed both unrestricted PostgREST watcher
definitions with exact full SHA-256 matches against the captured metadata. Their
bodies queue schema-reload notifications; PostgreSQL 17 specifies commit-only
delivery. This remains static definition/source evidence, not a notification
listener result or a configuration freeze.

The Owner then delegated the exact rehearsal/readback choice with "you choose the
best way". One execution of the reviewed rollback-only rehearsal and one mandatory
readback completed against verified Core DEV. Transient DDL, owners, forced RLS,
effective grants, false/NULL settings, empty E1 origins/bindings and ten enabled
triggers passed their assertions. Readback established E1 object absence,
matching native/provider catalogs and no exclusive Registry relation locks.
This proves the scoped managed rollback rehearsal, not permanent installation or
active customer/session/row-access behavior. No retries or additional provider
actions were authorized. Both exact SQL files and their hashes remain unchanged.

Latest runtime evidence is at
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-managed-rehearsal-20261023/scratchpad/`.
The refusal-guarded forward draft, application source, runtime flags and financial
boundaries remain unchanged. Positive onboarding CODE_READY remains NO.

[The additive forward draft](h1-g1-e1-managed-dev/FORWARD.PROPOSED.sql) pins the
observed native baseline before adding the unchanged, previously rehearsed E1
resource payload. It retains unconditional refusal, terminal ROLLBACK, disabled
settings and NULL Stock origin. It does not reinstall SQL008 or alter legacy020.
[Package limits and impact](h1-g1-e1-managed-dev/PACKAGE.md) identify the new
triggers' effect on Registry writer locking, scoped managed rollback evidence and
remaining application gaps. Latest catalog evidence is at
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-followup-catalog-20261023/scratchpad/`.

All fixed-refusal application bindings and runtime flags remain disabled.
Positive onboarding CODE_READY remains NO. New provider writes, Auth fixtures,
CI/runtime, deployment, commercial activation and Production remain unauthorized.

The dormant Stock server composition now reads the Stock cookie session's native
`provider_token` rather than a caller-supplied Core Authorization header. It checks
the token through live Core `getUser` and verified `getClaims`, pins the configured
server-only `CORE_SSO_CLIENT_ID`, and requires exactly one live Stock
`custom:webzoka` identity with the same Core subject. Both customer tokens are
pinned through the quarantine adapter; the composition rechecks tokens and linked
subjects afterward. Missing/expired provider credentials require native SSO again;
no token refresh, fallback identity pairing or browser handoff is invented.
The writer client is constructed only after initial live identity checks. A
post-stage failure remains UNCONFIRMED for the same inactive reservation.

These are local source and synthetic SDK unit checks. They do not extend the prior
native protocol runtime result to this changed wrapper or prove actual SSR cookie
delivery, managed Stock, application integration, revocation-at-commit or browser
behavior. No environment value or runtime registration was changed. The internal
adapter is not an externally callable security boundary.

## Offline composition checkpoint

The actual Core native admission adapter, Stock native-session wrapper, Stock
quarantine adapter, Core live-session verifier and Core reciprocal binder were
loaded together in one offline Node/TypeScript VM harness. Thirteen scenarios
passed: literal gates and fixed refusal, admission-to-quarantine composition,
same-key replay, lost stage/bind responses, pre-stage Core/Stock revocation,
post-stage/post-bind native-link or Core-session loss, foreign/injected selectors,
and changed Core owner/Stock realm. The shared SDK response shapes agree and all
modeled profiles remain inactive without an entitlement.

This is UNIT evidence. SDK Auth and RPC responses, idempotency and audit effects
are synthetic model state; no database, actual SDK client, native SSO exchange,
Next.js request/cookie handling, route, HTTP transport or browser ran. The harness
does not turn those models into integration, atomicity, RLS or runtime evidence.
It replaces only flags/refusal dependencies inside the VM for positive cases;
real source flags and fixed refusal remain unchanged. No application defect was
reproduced. Evidence and the single composition harness remain at
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-composition-20261023/scratchpad/`.

## Continuation — reciprocal identity and unsupported dispatch

The Core reciprocal quarantine adapter now checks the live Stock account's native
`custom:webzoka` identity against the current verified Core actor on every Stock
Auth recheck. Missing, duplicated, foreign or removed native links deny before a
writer is constructed. A link removed or changed after a write leaves the same
command/reservation UNCONFIRMED; no inactive membership is activated.

The generic native E1 command transport now supports admission only. Bind and
checkout commands stop before Auth/client construction, even in a synthetic test
that replaces the fixed refusal binding. No call to the old
`core_registry_e1_stock_command` remains in that transport. Admission accepts only
an unmodeled reserved receipt with all Stock IDs NULL; a provisioned receipt does
not establish admission success. The separate reciprocal quarantine adapter
continues to target only `core_registry_e1_stock_bind_stage`.

At this earlier checkpoint, the Core binder had an internal Stock bearer input
and no registered route, browser handoff or trusted cross-origin transport.
Checking its native identity link did not supply that transport or verify deployed Stock provider settings.
The managed SQL draft and prior disposable protocol/runtime sources are unchanged.
Positive activation, trial, billing and commercial decisions remain outside this
local correction. All runtime/refusal gates remain unchanged.

## Historical checkpoint — native SSO and disposable runtime proven; catalog comparison then pending

Use existing Core DEV native OAuth and canonical Stock membership. The fresh
Company graph remains isolated by immutable origin/binding and scoped writer
guards. No universal historical W01–W15 refactor is required by the tested fresh
fixture. This does not establish the definitions or behavior of installed hosted
writers. Keep E2/E3 two-operator controls, Owner-only billing, append-only audit and
all application runtime/refusal gates unchanged.

Owner separately approved one synthetic Core DEV customer/client, a temporary
fixture-only Actions secret, the exact temporary OAuth enable/consent-path patch,
and up to three additional attempts within 30 minutes. Additional attempt **1**
succeeded; attempts 2 and 3 were not needed. No Core admin key was sent to CI.

At Stock commit `c951a7791d040e51b06aec366d959b7c5257593c`,
[run 39897825995](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/39897825995)
passed **16/16** Auth/PostgREST/PG17 scenarios plus **1/1** offline SDK regression.
The native tests used hosted Core DEV `mcvekinhgcqygfddyifs` and disposable Stock:
verified Core issuer/subject/session, public discovery, PKCE and nonce checks,
native consent/callback, exact Core subject/client, token-endpoint code replay
rejection, membership denial and live Core logout checks. The other 11 scenarios
covered disposable atomic admission/audit, own/foreign RLS, writer contention,
idempotency, rollback, lost-response recovery and inactive reciprocal quarantine.

[Run 39896578329](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/39896578329)
failed at Stock authorize and is retained. The SDK URL regression established that
the harness previously asserted a nonce without supplying one. The corrected
harness generates a fresh random request nonce and checks its exact upstream
value; native nonce checking remains enabled. Earlier logs do not identify the
exact failed assertion, so the missing nonce is not asserted as their sole cause.
The success is evidence for the corrected source, not a relabeling of the failure.

Cleanup read-back confirmed: temporary secret absent, fixture session rejected,
OAuth client and synthetic customer absent, both disposable stacks/data removed.
Core DEV settings were restored to `oauth_server_enabled=false`,
`oauth_server_authorization_path=null`, dynamic registration false and Site URL
`http://localhost:3000`. The exact commit has zero GitHub deployment records.
Production, hosted SQL, migrations, activation, billing and payments were untouched.

**One remaining prerequisite:** the installed native Core DEV Registry is an
Owner-reported manual install whose exact permanent SQL differs from local SQL008.
The disposable rehearsal cannot establish installed-source/ACL equivalence. The
minimum safe remedy is one catalog-only read of that existing Registry's tables,
constraints, RLS/policies, ACLs, triggers and native functions, compared with the
tested source. `NEXT_MANAGED_READ.PROPOSED.sql` in task evidence contains the exact
read-only transaction; it reads no customer, Auth or settings rows and is not
authorized for execution. The existing prohibition on provider SQL is this stop.
Do not reinstall SQL008 or apply legacy migration020 to the existing installation.

**Readiness:** native protocol and disposable runtime PASS; complete positive
onboarding **CODE_READY: NO**. Managed Auth was exercised only with the approved
temporary fixture; managed Company/Stock SQL and actual application guards remain
NOT_EXECUTED. Stock's independent session can survive Core logout; application
authorization still needs live Core checks and canonical active membership.
Browser UAT is NOT_EXECUTED because this was a protocol/service fixture without a
deployed application target. Managed integration readiness and release authority
remain NO. Runtime flags stay false; no Stock entitlement or active profile was
issued. Reuse unchanged Core 134/134, Stock SDK 67/67, engine 12/12, TypeScript and
scoped lint evidence only for their unchanged source boundaries.

## Historical evidence — earlier authority stops below were superseded by the approvals above

Owner approved the consolidated DEV-only envelope ("go ahead solve this"). This
permits the isolated synthetic runtime and same-scope remediation. It does not
permit hosted Supabase changes, new infrastructure, merge/deploy, Production or
payments. Earlier environment-blocker statements below are historical.

The signed-in GitHub billing page showed GitHub Free, 285 of 2,000 included Actions
minutes used (1,715 remaining before these runs), and the existing account Actions
budget at $0 with "Usage blocked". No billing setting, credential or scope changed.
The private Stock branch `test/h1-g1-e1-dev` now runs standard Linux Actions with
two disposable Supabase Auth/PostgREST/PG17 realms. Private Stock source stays in
the private repository. Its exact branch is disabled in `vercel.json`; no hosted
Supabase credential, linked project, deployment step or persistent test data is used.

[The initial runtime run](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/39885030891)
passed 11 scenarios: real confirmed Auth accounts, native atomic Company admission,
replay, own/foreign RLS and writer ACL, canonical inactive Stock staging and audit,
protected graph denial, independent writer contention, parallel same-key admission,
audit-failure rollback, actual post-commit lost-response reconciliation, immutable
reciprocal binding, and logout observed before a new writer call. Both realms were
removed. The exact historical native baseline and PR7 source pins remain unchanged.
This proves those disposable fixture boundaries, not every hosted writer or policy.

A stronger diagnostic revoked a session after the last HTTP observation and then
called the service writer directly with that earlier observation. It could commit.
That is an explicit limit of checkpoint-based Auth, not proof that logout completed
before the approved final checkpoint was accepted. The accepted trust contract
requires denial before that checkpoint and post-wait reauthentication; it expressly
does not promise instantaneous revocation. The experimental Auth-row lock candidate
was not adopted: the native package forbids restoring direct Auth-table access.
Both E1 SQL proposals, Core source test and engine fixture were restored to their
exact pre-experiment hashes. Failed runs and the unadopted patch are retained as
review-only evidence. No stronger session semantics or privilege is inferred.

Native Core OAuth-server to Stock custom-OIDC/PKCE protocol acceptance is
**BLOCKED_PUBLIC_DEV_AUTHORITY**, not PASS. The latest
[disposable run](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/39891542927)
proved strict Core HTTPS Auth/PostgREST probes and the same atomic/RLS/quarantine
boundaries, then native provider creation rejected the private issuer with
`URL cannot resolve to private network addresses`. Both realms were removed.
The exact CLI 2.119.0 Auth source is v2.197.0, commit
`4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`. Its native URL validator requires
HTTPS and rejects private/loopback addresses; no production local allowlist exists.
Do not patch Auth, insert provider records through SQL, use DNS rebinding, publish a
tunnel, skip nonce checks or disable certificate validation to make this test pass.
The CLI readiness result is not acceptance: separate strict TLS Auth and PostgREST
probes passed before any fixture SQL. Failed setup and experimental runs remain in
evidence; no lucky rerun or lower-level result supplies native SSO acceptance.

Read-only public discovery on existing Core DEV
`https://mcvekinhgcqygfddyifs.supabase.co/auth/v1` returns HTTP 200, exact native OAuth
endpoints and an ES256 public JWKS key. No key rotation or new Stock project is
necessary for the next protocol rehearsal. Reuse this public issuer with disposable
Stock in private Linux CI; keep Company/Stock SQL in disposable PG17. This avoids
new infrastructure and a managed Stock database for protocol validation. Public
metadata alone does not prove client registration, consent, account/session policy
or successful login. The connected Stock account lists Production only; no target
is repurposed. No hosted Auth settings, users, clients, grants or data were changed.

**CODE_READY: NO for complete positive onboarding.** Existing local source remains
an admission/quarantine candidate. Application runtime flags and fixed-refusal
bindings remain off. Stock profiles remain inactive; no entitlement, billing,
payment or E2/E3 operator authority is issued. Fresh checks: Core 134/134, Stock SDK
67/67, PGlite engine 12/12; both TypeScript checks and scoped ESLint exit 0. These
remain distinct from managed DB/runtime and actual application/browser evidence.

**One next authority gate:** allow one bounded hosted Core DEV Auth rehearsal:
create one synthetic confirmed customer and one native OAuth client with exact
`http://localhost:55521/auth/v1/callback`, run native PKCE/nonce/issuer/subject and
code-replay checks against disposable Stock, then revoke/delete only those exact
fixture records. Existing Core DEV service credentials stay on their current host;
the private CI may receive only the synthetic customer's temporary credentials
and native OAuth client secret, through one temporary encrypted repository secret
`E1_CORE_OIDC_FIXTURE`, removed after the run. Never pass a Core service-role key to
CI. Existing repository secrets do not provide this fixture; creating the temporary
credential handoff also requires explicit security authority. Default remains
`authorized=false`, `executable=false`. Exact proposed actions/cleanup and evidence
are in the task scratchpad, not a new implementation workstream or Notion update.

No provider SQL or Auth mutation is authorized by the disposable envelope. This
first hosted step is the stop; it grants neither managed Company/Stock installation,
activation, browser deployment nor release. Managed DEV readiness and release
remain NO. If no such bounded Auth authority is given, retain the current disabled
candidate and the proven zero-cost disposable database path.

## 22 October 2026 resource-isolated E1 successor â€” current local candidate

Owner approved the recommended resource-isolated E1 architecture in this session
("okeey saya percayakan arsitekturnya dengan best practicenya kamu"). This supersedes
the historical E1 requirement below for globally clean-person W01â€“W15 history.
It does not relax E2/E3, current identity, canonical membership, audit, revocation,
owner-only billing, runtime or release requirements. No Notion record was changed.

E1 creates a wholly fresh graph; unrelated legacy history grants no authority and
is never imported. Existing or ambiguous canonical Company membership and pending
canonical ownership claims still deny. No existing Company/tenant IDs are admitted.

- Core `lib/e1-stock-integration.ts` now models an immutable creation origin bound
  to the generated native Company, Owner membership, Stock reservation, future Core
  tenant identity, subject and command/digest. It rechecks origin and scoped guard
  availability on replay and later operations. Native E2/E3 dependencies are unchanged.
- `E1_RESOURCE_ISOLATION.PROPOSED.sql` implements the concrete creation candidate
  over the existing native tables and native append-only audit. Private origins
  are immutable. Triggers serialize the relevant native Registry writers and
  reject legacy reparenting or mutation of protected graphs. The creation command
  uses a nonblocking fence; contention requires reauthentication with the same key.
  It does not enable the old Registry mutation flag or register a provenance issuer.
  Each origin now pins one Stock realm from private configuration; configuration
  starts NULL and disabled. Known Core/Stock Production realms are excluded.
  The new `core_registry_e1_stock_bind_stage` records one immutable reciprocal
  quarantine tuple and a native audit event atomically. Replay requires the same
  command and tuple; current Owner, customer-only status and reservation are checked.
- The dormant native DAL targets `core_registry_e1_stock_create` for admission,
  derives actor/session from pinned live Auth, excludes platform operators, and
  rechecks Auth before reporting a response. A post-RPC failure is UNCONFIRMED,
  never a claim that an HTTP check rolled back a committed database transaction.
- Stock `src/lib/e1-resource-staging.ts` implements the SDK adapter for two
  independently verified Core and Stock sessions plus the Core customer's exact
  origin/Owner context RPC. It accepts only Company/reservation selectors, never
  caller identities, local IDs or proof flags. Core context must pin this Stock
  realm and any existing reciprocal tuple must match. The new internal
  `src/lib/e1-resource-server.ts` owns cookie/public-key/server-writer clients and
  originally verified an explicit Core provider bearer without fabricating a
  stored session. The current decision above supersedes that header composition
  with verified native SSO pairing and pins both customer tokens.
- Core `lib/e1-stock-binding.ts` owns reciprocal composition. It verifies Core's
  cookie session, derives the Stock origin from the native reservation, verifies
  the Stock provider bearer and reads Stock's own authenticated quarantine context.
  It passes only server-derived identities/IDs to the narrow Core RPC, rechecks
  both sessions and both contexts, and reports uncertain outcomes with the SAME
  command/reservation. This source grants no active Stock access.
- Stock `E1_RESOURCE_QUARANTINE.PROPOSED.sql` generates a new tenant/profile,
  reuses PR7's unique canonical identity and atomic membership-audit trigger,
  and stores the immutable cross-realm tuple. Existing/duplicate/revoked profiles
  cannot be adopted. Profile guards prevent activation/reassignment and resurrection.
  The profile remains INACTIVE and no entitlement is issued. Missing-entitlement
  legacy fallback therefore cannot accidentally grant access. Independent database
  outcomes reconcile by reservation ID; there is no distributed ACID claim.
  `stock_e1_resource_context` returns only the authenticated subject's exact
  inactive canonical profile and named audit tuple; foreign selectors return none.

**Status: local admission/quarantine source candidate, not complete onboarding
CODE_READY.** The new SQL files unconditionally refuse execution and ROLLBACK;
they are not migrations, installed objects, privileged grants or runtime evidence.
All three source gates and both fixed-refusal bindings remain disabled. Historical
native/Stock SQL is unchanged and must not be replayed. The old Stock proposal
still assumes unsupported columns and is not this candidate's adapter.

Required next material gate is exact isolated DEV installation/runtime authority
for this candidate, with the accepted native baseline and PR7, supported managed
session/lock/commit checks, effective trigger/ACL/RLS and concurrency tests, atomic
audit failure and replay checks, quarantine/access-denial and retained-audit recovery.
Source syntax and SDK/memory tests cannot establish those properties. Privileged
operator custody and trigger-disable/replication paths are not assumed contained.
Server-owned source compositions now exist. No route, browser credential handoff,
runtime registration or post-quarantine activation exists; the former adapter gaps
are not presented as newly granted authority. Provider revocation at commit, real
RLS denial, rollback and concurrency remain unvalidated. This task does not
activate or claim a complete positive onboarding path.

Zero-cost execution direction remains the existing public Core repository's
standard Linux runner with two disposable Supabase Auth/PostgREST/PostgreSQL realms
and synthetic-only data. The old PostgreSQL-only fixture cannot validate this path.
Do not publish private Stock source to that public repo: a complete run requires
explicitly authorized private checkout access, or verified free allowance in the
private Stock repository. No access, quota, CI execution, managed Stock DEV target,
deployment suppression or runtime PASS is invented. No Windows installation.

The first external gate is an authorized isolated runtime rehearsal of this exact
candidate. Minimum remedy: approve its explicit source/SQL digest set and a
standard Linux runner, with a verified zero-spend execution limit and private
Stock checkout access, no deployment/publishing, synthetic Auth users and disposable
databases. Exercise simultaneous admission, foreign/revoked sessions, unique
identity races, effective ACL/RLS/trigger behavior, audit failure rollback, exact
replay and lost-response reconciliation. Resolve runtime findings within that
envelope before considering managed DEV publication. A disposable integration
PASS would not prove hosted session policy or grant release authority.

Reference: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
distinguishes free standard public runners from private included quota;
[Supabase local development](https://supabase.com/docs/guides/local-development)
provides Auth and database services in a Docker-compatible runtime. This is a
feasible runtime design, conditional on access and execution authority, not a run.

Fresh STATIC/UNIT results and the task-only diff are retained in this session's
`h1-g1-local-completion-20261022/scratchpad` evidence, with prior resource-isolation
evidence retained separately. No provider SQL/Auth/DB
write, migration, CI, infrastructure, payment, activation, publication or release.

## 22 October 2026 trusted binding reconciliation (supersedes stale gaps below)

Authority: Owner's H1.G1 trusted issuer and adapter binding instruction, local
source and focused STATIC/UNIT only. Latest existing Notion Charter read:
https://app.notion.com/p/3f8f69eadca081419bfaca1dcb823c95 . No Notion changes.

The three installed DEV native RPC catalog records are accepted evidence:
`core_registry_mutate` canonical definition SHA-256
`9185872def4078ab4d16bb3545faa9d09476d91c959edae49065a4b1be49cd81` is the
baseline, not the corrected proposal; `core_registry_owner_claim_context` is
`01c29ee9f8181cc7ce7634aa9629550eb6dae41d514c7510185fcc4a5a1c14c5`;
`core_registry_authorize` is
`6b58b33e1bb42eab0797d8d500fb52cf91deef52045a5395ff40beefe3aa558b`.
No catalog audit was repeated. Neither proposed correction nor E1 command RPC
installation is inferred from these hashes.

| Requirement | Local implementation and exact limit |
| --- | --- |
| Server Auth | Native DAL pins one SSR token for `getUser(token)` and `getClaims(token)`, validates subject/session/issuer/audience/times/account restrictions, and rejects token changes. Stored user data is ignored. This is a verified account/token observation, not proof of a live managed session row or session policy. |
| Genuine E1 and protected issuance | New fixed `lib/registry-mutation-binding.ts` denies every native Company/Owner mutation and E1 command before privileged client construction. It accepts no caller assertions, environment activation, proof registration or injected issuer. No complete-looking coverage object can become a production proof. |
| Source coverage and fencing | Existing accepted native package expressly lacks an authoritative source-to-W01â€“W15 mapping and complete participating-writer fence. No newness proof or writer-fence participation is fabricated. Local mutation gates cannot fence independent database/manual/cross-portal writers. |
| Atomic creation, uniqueness and audit | Existing model retains one transaction for Company/Owner/reservation/audit/replay. Added final actor revalidation after audit/store, rejecting revocation before model commit. Actual PostgreSQL atomic adapter remains unavailable; separate HTTP writes are not substituted. |
| Stock canonical binding | Concrete read adapter uses unchanged PR7 resolver, current local admin/profile, existing tenant ID and `tenant_entitlements.linked_tenant_id`. It rechecks canonical context and entitlement mapping. Server-owned no-argument wrapper constructs the SSR client. Result is explicitly a local observation, never Company/Core-subject authority. Full `verifyE1StockAccess` now unconditionally denies until authoritative Core reservation/Owner binding exists. |
| Post-provision replay | Core admission replay revalidates provisioned Stock membership. Binding rechecks Stock proof after update; a different command cannot bind an already provisioned reservation. |
| E2/E3 | Legacy native mutation path additionally remains issuer-blocked. Auth Admin account lookup is not evidence of the proposer's current session. Independent exact Company/portal proof and two distinct currently authorized operator sessions remain mandatory. E1's dependency list does not require two operators. |
| First checkout | Existing model still reserves and models checkout before local Stock membership. Portal access stays denied without complete current binding. No payment code is called. |

Source correction: the checked Stock tree and PR7 identity migration do not
establish `tenant.core_tenant_id` or add `user_profile.core_user_id`. PR7 guards
optional Core profile metadata without proving that column exists. The previous
Stock SQL proposal assumes those fields; it is an incompatible, refusal-guarded,
unapplied proposal until an independently reviewed binding schema exists. New
read code does not query either assumed column. Existing billing mapping alone
does not prove a Company, Core subject or reciprocal unique reservation.

The implementation is **NOT CODE_READY**. The exact remaining mandatory dependency
is a concrete supported authority for current managed sessions, authoritative
source-to-W01â€“W15 history plus all-writer fencing, and canonical Core/Stock
reservation issuance, consumed with the Company/Owner/reservation/audit transaction.
This cannot be established by the three catalog fingerprints, account lookup,
empty tables, service-role access, mocks, or a caller-supplied proof. No such
issuer contract or installed atomic E1 adapter exists in the accepted source.
The fixed refusal is deliberate; it is not an implemented positive issuer.

Focused offline tests exercise the adapters with synthetic SDK responses and the
transaction services with explicit memory fakes. Source gates are also tested
using the real refusal module while outer feature gates are overridden only in
the test VM. Synthetic successful transport cases separately mock that refusal;
they are future transport models, never managed-runtime PASS. Coverage includes
authorization, token change, conflicts, duplicate creation, replay, revocation,
cross-tenant denial and atomic audit rollback. Final fresh counts are in the chat.
TypeScript and targeted ESLint are STATIC. INTEGRATION, DB RUNTIME, BROWSER UAT,
and PRODUCTION are NOT_EXECUTED. No UI changed; browser omitted under the local
STATIC/UNIT boundary. All three feature flags remain literal false. SQL artifacts
remain unapplied, non-executable review proposals; no SQL files changed here.

One next action: obtain Owner authorization for a narrowly bounded DEV
issuer/atomic-adapter implementation and validation contract covering the exact
missing authorities above, reusing the accepted native baseline and PR7.
No release, migration or runtime action is authorized by this handoff.

22 October 2026. Authority: the Owner's bounded Core+Stock local-only instruction,
applied PI V4.2, and DEC-2026-029's E1/E2/E3 split. No runtime or publication authority.

## Implemented source

`lib/e1-stock-integration.ts` implements the internal E1 application service over
trusted transaction and provenance interfaces. Admission validates current Core
customer/session observations, all native W01â€“W15 source coverage, writer fencing,
absence of Company membership/history, exact Stock product, and atomic Company,
Owner, reservation and audit creation. Replay rechecks current authority. Checkout
is modeled only, is unique per reservation, and requires the current Core Owner;
it can precede local Stock membership. Provisioning confirmation requires exact
current Stock Auth, canonical profile, reciprocal mapping and entitlement proof.
E2/E3 classification cannot enter E1; the existing native independent operator
proposal/approval implementation remains unchanged.

`lib/core-registry-native.ts` adds a dormant, strict-selector transport to the
proposed `core_registry_e1_stock_command` RPC. It reuses existing Auth verification,
checks a second observation, validates returned Company/subject/reservation, and
reports uncertain transport outcomes as unconfirmed with the same command ID.
Both Core and E1 source gates must pass; both remain literal false. No existing
Hub route, billing function, subscription, invoice or provisioning receiver is wired.

Stock changes are in the existing `.wt-webzoka-stock-pdf` worktree:
`src/lib/e1-company-stock.ts` adds transactional canonical membership creation and
exact post-provision access verification. `src/lib/stock-security-context.ts` is
copied byte-for-byte from Stock PR7 head
`703171f6afbac0895e1fda4bd3079038efee888a`; it is not reimplemented. The E1 verifier
uses its uncached same-client Auth/RPC resolver twice, with exact profile/Core
mapping/entitlement checks between them. Revocation, missing/duplicate profiles,
query errors and conflicting claims deny. Existing Stock routes are untouched.

## Forward proposals and unresolved binding

[Core proposal](h1-g1-e1-stock-forward.PROPOSED.sql) reuses native Company tables,
`core_registry_mutate`, provenance validation and append-only audit. Additive
private reservation and attestation objects carry the exact Core/Stock mapping.
The Stock proposal, `docs/security/E1_STOCK_MEMBERSHIP_FORWARD.PROPOSED.sql`, reuses
PR7 profile constraints, tenant serialization and canonical profile audit trigger.
Both proposals unconditionally refuse execution, keep their own settings false,
and end in ROLLBACK. Neither is an applied migration or installed-schema assertion.
No historical SQL proposal or migration was modified.

**The complete path is not CODE_READY.** The transaction interfaces are exercised
with memory fakes, not registered managed adapters. The native RPC transport has a
local SQL proposal, but the installed DEV permanent Registry differs from SQL008
and its exact definitions/ACLs are unavailable in the verified source baseline.
The independently trusted current-session/provenance/fence issuer is also not
available: no public or service-role table grant was invented to populate private
attestations. There is deliberately no route that accepts client-supplied "clean"
observations, no automatic E1 proof issuance and no runtime composition that grants
access. These are real integration dependencies, not satisfied by mock success.

One next action: supply one existing authoritative bundle containing the installed
native Registry SQL/RPC/ACL definitions and the trusted managed session/provenance
issuer/fence contract, so dependent adapters can be bound in this same local scope.
Do not rerun historical installers or infer new SQL/runtime authority from this note.

## Evidence boundary and retained workspace

Focused suites cover successful synthetic E1, concurrent duplicate protection,
payload replay conflict, legacy/contested denial, current Owner checks, membership
creation/revocation, wrong product/tenant, and audit-failure rollback. These are
UNIT/model results; SQL text checks are STATIC. They establish no managed Auth/RLS,
PostgreSQL transaction/concurrency, provider revocation, recovery, browser UAT or
Production result. Those levels remain NOT_EXECUTED. No UI behavior changed.

Reused paths: Core `.wt-customer-hub-core`, branch `feat/h1-g1-e1-core-static`,
HEAD `5dcff3c3bab1d6aaccf6b315a47e9bbb6edb6f0a`; Stock
`.wt-webzoka-stock-pdf`, branch `codex/stock-v2-conditional-pdf`,
HEAD `13f65413e5424ed9c8392a5db68683a86ba5196f`. Main source baselines remain
Core `8a9ae5e7d61b706c3bd87f5516d759560876bad5`, Stock
`73c4b840a508d9eec5f31aecc1e000734569438f`. Prior unrelated Core dirty work is
preserved. No branch, worktree or dependency installation was created. Cleanup was
not authorized or attempted; both worktrees and all local deliverables are retained.
No staging, commit, push, PR/CI, SQL execution, Auth/provider mutation, Preview,
deployment, merge, payment, activation, Production change or Notion update occurred.

Current native manifest is updated only for changed source and new local artifacts;
protected historical artifact hashes remain unchanged. Raw verification logs are
under the task scratchpad, outside both repositories. Final test counts and static
results are reported in the chat handoff after execution.
