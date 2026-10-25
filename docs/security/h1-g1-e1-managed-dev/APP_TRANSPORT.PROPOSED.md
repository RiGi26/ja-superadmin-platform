# Proposed native SSO application transport

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
[coordinated security review](../../../../.wt-webzoka-stock-pdf/docs/security/H1_G1_SECURITY_REVIEW_20261025.md).

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
[focused Stock/Core security review](../../../../.wt-webzoka-stock-pdf/docs/security/H1_G1_SECURITY_REVIEW_20261025.md).


## Current continuation — 24 October 2026

Stock credential availability is resolved after Owner-provided local settings.
Actual Stock Auth/resolver checks passed 33/33 and actual native protocol plus
candidate callback-cookie checks passed 30/30, with fixture cleanup verified.
A fifth additive milestone migration installs the missing read-only Stock
canonical resolver; rollback rehearsal and actual Data API denial checks passed.
The local start now supplies a fresh OIDC nonce; 101 Stock unit tests, TypeScript
and focused lint pass. Runtime gates remain closed.

The immediate dependency is accepted Stock canonical membership/RLS: legacy
inactive-profile tenant visibility was reproduced, and PR #7 remains draft,
unmerged and without reported checks. Reconcile that rollout with the new managed
resolver before activation; do not replace its stronger session checks blindly.
The candidate vercel.app callback allowlist, positive application HTTP, required
browser and remaining recovery/concurrency/timeout acceptance are also unverified.
No provider configuration or deployment authority is inferred. See the current
checkpoint at the top of the linked local contract below; earlier credential
availability and test-count statements are historical.

## HTTP and Core managed-session checkpoint

Owner "okeey go ahead" continued the existing Production path. Dedicated Stock
start/callback endpoints and bounded PKCE continuation are implemented locally;
100 Stock unit tests, TypeScript and focused lint pass. Real local Next HTTP
returns 503/no-store/no cookies with the unchanged closed gates. Core managed
Auth session checks passed 24/24 with two temporary accounts; independent
readback confirms zero fixture users/sessions and original business counts.
No deployment, activation or configuration change occurred. Auth audit history
may persist; no raw Auth table was mutated with SQL.

Subsequent Owner-approved inspection covered the registered Stock primary
checkout and the exact legacy dotenv file. Neither supplied Stock Supabase
runtime settings. Existing Vercel Stock variable metadata is present, while
in-process CLI retrieval yielded no usable values; its cause is unresolved.
Actual public-key native SSO initiation passed six checks and returned the exact
Core issuer/client/Stock callback redirect, without following it or creating a
Stock account. This does not prove token exchange or native identity linkage.

The full current result, credential-custody limits, remaining Stock server-side
runtime availability gate and exact next action are recorded at the top of
[H1_G1_E1_STOCK_LOCAL_CONTRACT.md](../H1_G1_E1_STOCK_LOCAL_CONTRACT.md).
Earlier paragraphs below describing an unregistered callback or no managed Auth
execution are historical. Full native SSO, positive tenant-isolation and runtime
activation are not complete. No repeated Production environment approval is needed.

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

## Historical local and DEV transport record

Status: LOCAL IMPLEMENTATION; ALL RUNTIME GATES REMAIN CLOSED.
Scope: the existing Core/Stock E1 admission and inactive-quarantine objective.

Owner approved the local implementation request with "continue using best practice"
on 23 October 2026. This approval covers the dormant server handler/caller and
focused STATIC/UNIT checks in the existing worktrees. It does not authorize real
credential transmission, provider/configuration changes, CI, deployment or activation.
The approved proposal's original SHA-256 was
`da5100bea857b6109cb06f0560e76906ac640da0623d6f42ae85dd9259adc30a`.

## Original gap and approved change

The dormant Stock wrapper can derive and verify the native Core provider token
from its SSR session. The Core reciprocal binder still requires a Core cookie
session plus an internal Stock bearer header. There was no implemented server
path joining those compositions. The earlier offline composition harness supplied this
join synthetically; its 13 passing cases do not prove a real transport.

Use Stock's server-owned native SSO session for the reciprocal handoff:

1. Keep Core admission separate and reuse its Company/reservation IDs. Stock
   continues verifying its live customer, Core native provider token, expected
   OAuth client and native linked Core subject before staging inactive resources.
2. Add a dormant Core POST handler for reciprocal quarantine binding. It accepts
   only `commandId`, `companyId` and `reservationId` in JSON. Core credentials come
   only from an explicit native-provider Authorization header; Stock credentials
   come from a second server-to-server header. This handler has no cookie fallback.
3. Core verifies the provider token through its supported live Auth API and
   signature/claim verification, with exact Core DEV issuer and expected Stock
   OAuth client. Stock origin comes from the current canonical Core reservation;
   Stock's live account, claims and native linked subject must match that Core
   actor. Reuse the existing reciprocal tuple/RPC/Owner checks.
4. Stock calls that handler only from server composition after quarantine staging,
   using an explicitly configured approved Core DEV application origin. Use HTTPS,
   no redirects, bounded request time, no automatic retry and no token logging.
   Tokens never enter URLs, response bodies, browser storage or shared cookies.
5. Preserve the same command/reservation on uncertainty. An interrupted request or
   failed post-write session/context check remains UNCONFIRMED. A successful
   response means an inactive reciprocal quarantine tuple only.

The HTTP endpoint path, internal helper organization and focused test cases are
engineering choices within this proposed scope. Do not introduce an assertion
broker, shared signing secret, direct Auth-table privileges or a billing-based
identity match. The existing Core and Stock native JWTs are the credentials.

## Approved local implementation envelope

Core and Stock repositories only; reuse their current preserved worktrees.
Expected changes are the Core reciprocal binder/live-session helper, one Core
route, Stock server composition and focused tests. This is not a closed file
allowlist. All literal application flags and fixed refusal bindings stay false;
the handler must refuse before Auth, privileged clients or network calls while
those gates remain closed. No environment or provider setting is changed.

Acceptance is STATIC plus UNIT: strict selectors; no-cookie native token path;
configured issuer/client/realm checks; own/foreign/revoked/unlinked cases;
zero calls with real gates; one stable command across timeout/lost-response
recovery; no token exposure; inactive-only output. Existing cookie-based internal
tests must retain their defined behavior. Any fresh source defect is corrected
inside this same scope. These checks are not runtime evidence.

## Material boundaries

The new credential/security transport received the local implementation approval
recorded above under the protected authority rule in AGENTS.md. It authorizes no
real credential transmission, Auth fixture, provider SQL,
environment/configuration write, installation, commit/push/CI, dev server,
Preview/deployment, activation, migration, payment, Production or Notion action.
The exact Core DEV application origin, matched OAuth client configuration and
effective runtime target must be resolved and authorized before actual execution.

Positive Stock activation, final prices, trial terms and changed team-seat policy
remain separate unresolved behavior. This transport grants none of them. E2/E3
two-operator controls, current Owner checks, immutable origins/audit, revocation,
tenant isolation and existing Stock release gates remain binding.

## Implemented local boundary

- Core: `POST /api/auth/e1/stock/quarantine` checks the literal flags and fixed
  refusal before reading headers/body or constructing clients. With synthetic
  test gates only, it accepts two explicit bearer headers and at most 2,048 bytes
  of strict selector JSON. Cookies never supply either credential.
  The existing Auth namespace already delegates to individual handlers without
  dashboard cookie Auth. An offline routing symptom test rejected the first
  `/api/internal/` path because the frozen proxy routed it through dashboard
  authentication. Moving this native Auth handoff preserves that proxy byte for
  byte and retains the existing private dashboard/billing guards. It adds no
  new wildcard exemption or proxy configuration.
- Core's native verifier shares the existing live account/verified-claims checks
  and adds the expected Stock OAuth client on every pre/post-write verification.
  The cookie-based internal entry point retains its own cookie verification.
  The canonical reservation selects the Stock realm and current Owner; Stock's
  live native link and immutable inactive tuple must agree before the writer.
- Stock: `stageAndBindCurrentE1StockQuarantine` accepts selectors only. It reuses
  the native SSR token pairing and quarantine adapter, then performs one server
  request with a 10-second abort signal, HTTPS, no redirects, no cookies, no cache
  and a bounded 2,048-byte response. It validates every inactive receipt field
  against the staged tuple and rechecks the paired session afterward.
- Any uncertainty after staging retains `commandId`, `companyId` and
  `reservationId`. There is no automatic retry or activation. Core emits only
  inactive receipt IDs or generic status; credentials/private errors are omitted.

Future authorized configuration must set Core's server-only `STOCK_SSO_CLIENT_ID`
to exactly Stock's `CORE_SSO_CLIENT_ID`, and Stock's `CORE_E1_DEV_APP_ORIGIN` to the
exact approved Core DEV `https://<hostname>.vercel.app` origin without a trailing
slash. No default application origin exists. Core keeps its existing public key
configuration; the reservation determines Stock's Supabase origin. No environment
file or provider setting was changed for this implementation.

Evidence belongs to `h1-g1-native-transport-20261023/scratchpad/` under the session
Temp/Codex root. The actual Request/Response route and caller compose through a
synthetic fetch bridge with Auth/SDK/RPC models. This is UNIT evidence, not actual
SDK/network, Next.js runtime, database, native SSO cookie delivery or browser proof.

## Runtime continuation proposal — 23 October 2026

Status: DISCOVERY_COMPLETE; runtime remains REVIEW_REQUIRED_CLARIFICATION.
The initial continuation permitted local inspection and planning only. The later
Owner message headed "WEBZOKA — OWNER AUTHORIZATION: READ-ONLY DISCOVERY" on
23 October 2026 explicitly authorized non-secret metadata discovery for this
milestone and local evidence updates. That authority is used below and remains
valid for ordinary metadata inspection of the same approved systems. It grants
no runtime, SQL, secret, configuration, resource-creation or deployment authority.
Earlier catalog and managed rollback approvals remain consumed.

Risk: this document change is LOW. Future native credential transmission and
opening security-boundary gates require HIGH-risk review and exact authority.
Full onboarding remains CODE_READY_NO.

### Verified local starting point

Core remains on `feat/h1-g1-e1-core-static` at
`5dcff3c3bab1d6aaccf6b315a47e9bbb6edb6f0a`; Stock remains on
`test/h1-g1-e1-dev` at `c951a7791d040e51b06aec366d959b7c5257593c`.
Before this documentation update, all 11 artifact hashes, nine preserved-source
hashes and 11 evidence hashes in the native transport RESULT matched local files.
The 449 Core, 89 Stock and 23 composition UNIT results are reused, not rerun.
They remain synthetic evidence with the limitations already recorded above.

The Core worktree's local `.vercel/project.json` names project
`prj_Z8taL31maerKj0AXlz65OBO8Bs6o` (`ja-superadmin-platform`) under
`team_MGLKh5XmYFCwtCh6CjyaaL6f`. This is only a local association, not proof of
an isolated deployment, its current provider configuration or an approved origin.
Stock has no local `.vercel/project.json`. Neither fact authorizes deployment.

The Stock source search finds the reciprocal caller only as an exported internal
function; no application route or action invokes it. Its current generic
`src/app/auth/callback/route.ts` exchanges a code for a session, but that does not
establish native SSO initiation or provider-token persistence in real SSR cookies.
The prior CI runner uses `/auth/webzoka/callback` in its disposable configuration;
that path is not an implemented route in this checkout. Reusing that fixture URL
as an application callback would therefore be unsupported. This is a validation
wiring gap, not permission to implement another public endpoint or alter login.

The existing Stock `.github/workflows/e1-company-stock-dev.yml` runs disposable
Auth/PostgREST/PostgreSQL checks. It does not launch these two Next.js applications.
Its branch deployment guard remains closed. A rerun of that unchanged workflow
cannot establish the missing application transport or SSR/browser evidence.

### Target and capability requirements

| Required item | Established fact or unresolved value |
|---|---|
| Core Auth/DB identity | Source pins `https://mcvekinhgcqygfddyifs.supabase.co`; discovery confirms project `webzoka-core-dev`, ACTIVE_HEALTHY, `ap-northeast-2`, PostgreSQL `17.11.0.003`. Database contents and Auth configuration were not inspected. |
| Core application | CLI confirms existing project `prj_Z8taL31maerKj0AXlz65OBO8Bs6o`; no exact isolated deployment for the current candidate is established. Existing Ready previews are historical. Approved Core DEV HTTPS origin: UNKNOWN_NOT_YET_RESOLVED. |
| Stock Auth/DB identity | No verified isolated Stock DEV in the three connected inventories. Exact accepted zero-cost project ref: UNKNOWN_NOT_YET_RESOLVED. Inventory does not establish that no such project exists elsewhere or under an unrecognized name. |
| Stock application | CLI confirms project `prj_nTIID94EysP6VzpfeprqiK78ouN2`, `webzoka-stock-platform`, and a historical Ready preview. Source/repo binding, backing DEV DB, isolation and actual SSO callback suitability remain unverified. |
| Native OAuth | Expected client UUID, Core authorization path, Stock provider registration and redirect allowlist: UNKNOWN_NOT_YET_RESOLVED. Core `STOCK_SSO_CLIENT_ID` must equal Stock `CORE_SSO_CLIENT_ID`. No client secret is needed for target discovery. |
| Transport configuration | Stock `CORE_E1_DEV_APP_ORIGIN` must be the approved exact Core app origin; each public key must belong to the selected realm. No value is inferred from an environment file. |
| Database capability | Managed rollback evidence established transient objects only. E1 installation, approved settings, actual session/RLS behavior and recovery capability remain separate requirements. Never rerun SQL008 or Registry020. |
| Application capability | Literal Core/Stock flags and fixed refusal bindings stay closed. Positive transport needs a separately reviewed isolated runner/candidate capability; changing environment values alone cannot enable it. |
| Recovery and cost | Exact fixture identities, independent recovery authority, audit-preserving retention/cleanup and zero incremental cost must be established before durable execution. |

Production Core `hxhusfkrlafxdnyasmsu` and Stock `oyyfcmlquqfrdoffkgsd` remain
excluded. Disposable localhost services from the older CI run do not satisfy the
current source's pinned managed Core issuer, Stock managed-origin checks or Core
HTTPS application-origin check. Do not substitute URLs or weaken those checks to
make a test pass. Any separately approved adaptation must disclose precisely which
boundaries it exercises and must not be represented as unchanged-app validation.

### Approved discovery scope — executed

The Owner explicitly approved read-only, non-secret provider metadata discovery
and local evidence updates. The following was the proposed scope; findings and
limitations follow. No renewed approval is needed for ordinary inspection of the
same approved systems within that authorization.

1. Inspect existing Vercel project/deployment metadata for the Core project above
   and projects linked to `RiGi26/ja-superadmin-platform` or
   `RiGi26/webzoka-stock-platform`, within the same owner/team. Record project IDs,
   branch/source SHA, environment classification, deployment URLs and publication
   guards. Do not visit application URLs or trigger deployments/builds.
2. Inspect project inventory metadata only to identify an existing isolated Stock
   DEV candidate and confirm Core DEV identity. Record names/refs, ownership,
   region/status and any available non-secret cost classification. Inventory alone
   does not prove data isolation or zero incremental runtime cost. Do not inspect
   either excluded Production project's contents or configuration.
3. Return a proposed exact target tuple and unresolved conditions. Keep target
   selection and execution authority distinct. If the inventory is unavailable,
   ask for the non-secret project refs/origins; do not install tools, obtain new
   credentials or broaden access. Do not create a replacement project.

Use existing authenticated provider tooling only within those metadata reads;
never print, export or store its credentials. No SQL, Auth/user/session reads,
OAuth configuration or environment-value reads, secret/key retrieval, customer
token transmission, settings changes, fixtures, CI, dev server, Preview, deployment,
paid resource or application execution is included. OAuth/realm verification,
runtime candidate changes and exact DB/fixture actions need their applicable
later authority after the target is known. This avoids asking for unknown SQL or
approving an unspecified deployment now.

### Provisional validation matrix

All future execution rows below are NOT_EXECUTED and conditional on explicit
authority. A disabled-path result does not count as a positive transport result.

| VALIDATION_LEVEL | CONCRETE_CHECK | EXPECTED_OUTCOME | REQUIRED_EVIDENCE |
|---|---|---|---|
| STATIC | Compare exact candidate source, dependencies, literal gates and fixed refusal bindings against the reviewed manifest. | Unrelated work, SQL, proxy and closed gates preserved; every runtime-only adaptation identified. | Source hashes, scoped diff and dependency identity. |
| UNIT | Reuse unchanged 449/89/23 results; rerun affected cases only after an authorized relevant source change. | Strict selectors, identity pairing, inactive receipts and stable uncertainty keys remain enforced. | Existing hashed TAP files or fresh affected output; synthetic boundaries disclosed. |
| INTEGRATION, disabled path | Run the real Next.js Core POST handler through its actual proxy/server with closed gates and no customer credentials. | HTTP 503 with `status=blocked`, no-store; no Auth, writer or partner calls. | HTTP transcript plus process/egress observations; status alone cannot prove zero calls. Exact runtime target is unresolved. |
| INTEGRATION, native session | Complete approved native SSO through the actual Stock callback and inspect the server-side session without exposing tokens. | Live Core and Stock subjects link via `custom:webzoka`; provider token is available to the server on the subsequent request; configured client matches. | Redacted redirect/cookie attributes, SDK results and server assertions; never record cookie/token values. |
| INTEGRATION, quarantine | Invoke the approved isolated server entry point with selectors only and call the actual Core HTTPS route. | One bounded request, no redirect/cookie forwarding, reciprocal IDs agree, `isActive=false`; exact entry-point capability remains unresolved. | Real HTTP status/latency and redacted SDK/RPC receipts tied to exact candidate/deployments. |
| DB RUNTIME | Read context as actual customer sessions; invoke only separately approved E1 RPCs with exact fixture identities. | Own context only; cross-Company/foreign/revoked users denied; inactive tuple and append-only audit agree; no access/entitlement granted. | Authenticated RLS assertions and before/after task-owned state. Service-role success is not RLS proof. |
| INTEGRATION + DB RUNTIME | Exercise wrong client/issuer/link, missing token, Owner or realm drift, session change/revocation, duplicate command and controlled lost-response cases. | Reject before mutation where possible; post-write uncertainty preserves the same command/reservation and inactive state; reconciliation produces no duplicate resource/audit effect. | Per-case call counts, rejection/uncertainty result and persisted-state comparison; retain failures. |
| DB RUNTIME, concurrency | Exercise approved writer contention and revocation ordering at the final managed checkpoint. | Required fencing and ordering hold; no claim of instantaneous cross-system revocation. | Two-session timing/lock/commit evidence and exact acceptance from the existing trust contract. |
| BROWSER UAT | Exercise actual login/callback and inactive-result flow on approved `vercel.app` deployments; desktop and 390x844 when a browser-facing candidate exists. | Correct redirect/state, no token exposure, no usable Stock activation; required mobile controls visible. | Redacted browser trace/screenshots and console/network observations. No browser-facing E1 caller is currently wired. |
| INTEGRATION + DB RUNTIME, recovery | Restore only approved fixture/configuration changes and verify retention/containment. | No uncontrolled access or setting remains; audit retained. Do not delete audit or assume Auth/HTTP effects roll back with SQL. | Baseline comparison, approved fixture manifest and independent recovery readback. Missing cleanup/retention authority blocks durable tests. |
| PRODUCTION | No Production execution in this objective. | NOT_EXECUTED; PRODUCTION_CHANGED=NO. | Action ledger; non-Production results imply no Production claim. |

### Acceptance and consistency review

- This proposal identifies the exact known source/DB identity and marks unknown
  application, Stock realm, OAuth and recovery details without inventing values.
- Metadata discovery is now explicitly authorized and completed to the available
  visibility. It does not reopen consumed SQL approvals, activate literal flags,
  replace refusal bindings or authorize runtime.
- Future positive runtime needs both real application transport and real DB/Auth
  evidence. Mocked SDKs, direct SQL, protocol-only CI and a disabled HTTP response
  each establish narrower facts and cannot substitute for that combined result.
- E1 automatic First-Owner criteria and E2/E3 independent two-operator controls,
  Company identity, RLS, append-only audit, revocation and Stock release gates stay
  binding. Existing 3/5 active-account policy includes the Owner; no price, trial,
  seat-policy or positive activation decision is made here.

ANALYZE_GATE: the planning and metadata-discovery deliverables are consistent with
current authority. Runtime execution remains REVIEW_REQUIRED_CLARIFICATION because
no complete accepted target/capability/recovery envelope exists. Do not claim that
an environment does not exist merely because discovery has not identified it.
The earlier local planning evidence remains in
`h1-g1-runtime-plan-20261023/scratchpad/RESULT.json` under Temp/Codex. The discovery
and current preservation evidence are recorded separately below.

### Discovery findings — 23 October 2026

Authority source: the Owner's message headed "WEBZOKA — OWNER AUTHORIZATION:
READ-ONLY DISCOVERY" in this chat. This is a real discovery authorization;
target selection, configuration changes and execution are not inferred from it.

Supabase metadata:

- The `Stock + Super Admin` connection lists two projects: the already excluded
  Core and Stock Production refs. Only inventory metadata was read; no Production
  contents, Auth, settings, SQL or application URL was inspected.
- A second connected account confirms Core DEV `mcvekinhgcqygfddyifs` in
  organization `kgpudxazvvzxdwstkkui`, named `JASuperApp n Superadmin Dev`, with
  provider-reported `plan=free` and `tier=tier_free`. Core DEV is ACTIVE_HEALTHY in
  Seoul (`ap-northeast-2`), with PostgreSQL `17.11.0.003`, engine 17, GA channel.
  It was created on 14 October 2026 at 15:03:31 UTC.
- All three available account inventories were checked for a Core/Stock DEV
  candidate. No verified Stock DEV emerged. Unrelated projects were not inspected
  beyond inventory classification, and their details are excluded from evidence.
  A failed Core DEV lookup in a different connection is retained as an access
  observation, not evidence of absence. Free-tier organization metadata alone
  does not prove runtime headroom, incremental cost, row isolation or recovery.

Vercel metadata:

- The connector reports team `team_MGLKh5XmYFCwtCh6CjyaaL6f`, slug
  `rigi26s-projects`, but its inventory exposes only an unrelated project. Exact
  Core/Stock project reads returned 404 and matching searches were empty.
- The already installed authenticated CLI 50.4.6, with that exact team explicitly
  supplied, successfully resolves both projects. Core is
  `prj_Z8taL31maerKj0AXlz65OBO8Bs6o`, Node 24.x, root `.`; its CLI summary reports
  framework preset Other while local `vercel.json` declares Next.js. Stock is
  `prj_nTIID94EysP6VzpfeprqiK78ouN2`, Node 22.x, root `.`, Next.js preset.
  This establishes a connector/CLI visibility discrepancy, not its root cause.
  Do not interpret connector 404 as project deletion or change configuration.
- Core's latest listed Ready Preview is deployment
  `dpl_5ujFN47KR94xTjouBoWhDX2DeZuS`, created 13 September 2026, 10:15:29 UTC,
  at `https://ja-superadmin-platform-jia4lb3bt-rigi26s-projects.vercel.app`.
  The Preview predates creation of the pinned Core DEV project and the current
  transport implementation. Its backing database is unverified.
- Stock's listed Ready Preview is `dpl_8Bvrn3TK5oDmAhLKyj7wBRHocV8p`, created
  11 October 2026, 00:36:33 UTC, at
  `https://webzoka-stock-platform-jjd867lyg-rigi26s-projects.vercel.app`.
  Its source SHA, repository linkage, backing database and isolation are unverified.
  These URLs were read as provider metadata only; neither application was visited.
- Preview queries filtered by `githubCommitRef=feat/h1-g1-e1-core-static` and
  `githubCommitRef=test/h1-g1-e1-dev` returned no deployments. This is the exact
  query result, not proof covering missing Git metadata, hidden or deleted records.
  Native CLI inspection does not expose the required deployment source SHA or
  function-region metadata in its JSON summary. No existing Preview is accepted
  as the current local candidate or an approved Core DEV application origin.
- The native CLI lacks the newer `api` subcommand; its help request printed deploy
  help and exited without deployment. No CLI installation, update, authentication
  change or credential-file access was attempted. Local inspection showed that
  `env ls` can print plain/system values. It was therefore not invoked. No
  environment-value or key endpoint was called, even with decryption disabled.

The existing local Stock guard still disables deployment of `test/h1-g1-e1-dev`;
local Core `vercel.json` contains no matching branch guard. These are source facts
only, not provider-enforced publication proof. No push, CI or deployment occurred.
All runtime flags, refusal bindings, SQL and the frozen proxy remain unchanged.

The Owner subsequently said "continue" within the same discovery envelope.
Remaining safe metadata paths were checked: Core DEV lists no Supabase branches;
native CLI project inventory shows the current projects plus legacy Stock/guide
project names, and its next cursor returns no projects. Those legacy names do not
prove a DEV realm or an E1 application target, and no alternate workstream was
adopted or inspected beyond inventory. No dedicated matching Core/Stock DEV
application was identified. The reviewed local task documents supply no accepted
Stock DEV ref or current Core DEV app origin. These are bounded discovery results,
not a global resource-absence claim. Additional evidence is retained in
`CONTINUATION_METADATA.json` in the same discovery evidence directory.

### Exact next technical gate

Close the missing isolated runtime target before any execution proposal can be
made executable: identify an existing Stock DEV ref with verifiable ownership,
synthetic-data isolation and recovery authority, plus an exact Core DEV HTTPS
application deployment for the candidate. The Stock application must use that
same realm, and Core/Stock must share the approved native OAuth client and actual
callback mapping. No discovered historical Preview supplies that tuple.

Ordinary further non-secret metadata reads of these same approved systems remain
authorized. Reconnecting tools, reading secret values, creating a missing resource,
changing configuration, installing E1 objects, exposing an isolated invocation
capability, deploying a candidate or running Auth/HTTP/DB/browser tests is a genuine
material boundary. This discovery grants none of those actions. If no suitable
existing target can be named, runtime remains BLOCKED_ZERO_COST_RUNTIME_ENVIRONMENT;
do not provision one, use Production, weaken origin checks or substitute UNIT.

The next material input is the Owner's identification of the intended existing
Stock DEV project ref and Core DEV application origin/deployment, or confirmation
that those targets do not exist. Ordinary metadata authority is already sufficient;
requesting the missing target identity is not a request to approve those reads
again. If suitable targets do not exist, provisioning or repurposing resources and
deploying a candidate requires a separate concrete scope and explicit authority.

Once target identity is established, a runtime envelope must separately define
exact candidate capabilities, immutable SQL/runner hashes where needed, fixtures,
current-session/RLS/fencing checks, containment, append-only audit retention and
recovery readback. The existing provisional matrix remains applicable. No positive
activation, trial, price or seat-policy decision is part of this discovery.

Evidence: `h1-g1-discovery-20261023/scratchpad/` under Temp/Codex contains
`AUTHORITY.json`, `PROVIDER_METADATA.json`, `CLI_METADATA.json`, the two redacted
Preview metadata summaries, source-preservation checks and `RESULT.json`.
METADATA_DISCOVERY is distinct from INTEGRATION, DB RUNTIME and BROWSER UAT;
all three remain NOT_EXECUTED. PRODUCTION_CHANGED=NO; full onboarding CODE_READY_NO.
