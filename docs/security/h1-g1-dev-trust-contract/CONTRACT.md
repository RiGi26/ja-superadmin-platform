# H1.G1 DEV trusted issuer and atomic adapter contract

22 October 2026 · WG-1.2 / WF-1.0 / PI V4.2 · LOCAL DESIGN ONLY.

**Disposition: contract prepared; positive DEV execution is NOT APPROVABLE yet.**
H1.G1 remains OPEN, E1 DISABLED and NOT CODE_READY. No application code or safety
gate is changed by this package. `OPERATIONS.PROPOSED.json` is a deny-by-default
operation specification, not a runner, migration, executable SQL or authorization.

## 1. Accepted authority and source boundary

Reuse [latest H1.G1 Charter](https://app.notion.com/p/3f8f69eadca081419bfaca1dcb823c95),
[DEC-2026-029](https://app.notion.com/p/3f7f69eadca08195ab4ec15100bdfa4d),
[trusted-binding handoff](../H1_G1_E1_STOCK_LOCAL_CONTRACT.md), and Stock PR7
`703171f6afbac0895e1fda4bd3079038efee888a`. Historical W1 signoff is a proposal;
it does not override the installed native architecture or authorize Auth grants.

Accepted native Core DEV is `webzoka-core-dev` / `mcvekinhgcqygfddyifs`.
Installed function fingerprints and ACL metadata are reused, not re-queried:

| Function | Accepted canonical SHA-256 |
| --- | --- |
| `core_registry_mutate` | `9185872def4078ab4d16bb3545faa9d09476d91c959edae49065a4b1be49cd81` |
| `core_registry_owner_claim_context` | `01c29ee9f8181cc7ce7634aa9629550eb6dae41d514c7510185fcc4a5a1c14c5` |
| `core_registry_authorize` | `6b58b33e1bb42eab0797d8d500fb52cf91deef52045a5395ff40beefe3aa558b` |

Mutation matches the baseline, not the corrected proposal. Definer ownership by
`postgres` does not prove RLS confinement. New E1 RPC installation is unestablished.
Local source pins and exact anchors appear in `SOURCES.json`. Core remote main
was read as `8a9ae5e7d61b706c3bd87f5516d759560876bad5`; Stock remote main as
`73c4b840a508d9eec5f31aecc1e000734569438f`. These are source identities, not
deployed versions or inventories of provider jobs, credentials or manual writers.

## 2. W01–W15 reconciliation and actual writers

The native coverage validator requires fifteen keys. Neither its accepted source,
the current Charter nor the old W1 signoff defines an authoritative key-to-source
dictionary. `SOURCES.json` therefore supplies **proposed mapping v1**, with
`authoritative_mapping=false`, `complete=false` and no participating-writer claim
for every key. Approval of that dictionary cannot itself prove writer fencing.

| Proposed key | Verified source family / current classification |
| --- | --- |
| W01 | Native Company/Owner DAL and installed mutation baseline: application fixed-denied; native advisory fence covers cooperating native calls only. |
| W02 | Core self-service/manual onboarding: Auth link issuance and separate `customer_onboarding` INSERT/update; UNFENCED. |
| W03 | Core `finalize_customer_onboarding`: inserts/updates `tenants`, `users`, `tenant_members`, subscription/event and request state; row lock on onboarding request, no shared E1 fence. |
| W04 | Core async Stock provisioning, retry cron and completion acknowledgement: updates onboarding/portal mapping around HTTP; UNFENCED. |
| W05 | Core admin tenant creation: creates legacy tenant/user/member/subscription; explicitly rejects Stock, still relevant to other Company history; UNFENCED. |
| W06 | Core `/api/tenants/provision`: HMAC-authenticated portal caller can create billing tenant/subscription; no Core-subject ownership proof or common E1 fence. |
| W07 | Core billing/lifecycle and Stock entitlement sync: history/status/mapping can change independently; HMAC is transport, not Owner proof; UNFENCED. |
| W08 | Stock `/api/register`: tenant, managed Auth user, profile, entitlement and best-effort Core call are separate operations; UNFENCED. |
| W09 | Core-targeted Stock `/api/internal/provision`: expected by Core; absent from inspected Webzoka Stock HEAD and PR7 tree. PR7 test fixture references a different repo's provisioning source; UNKNOWN_EXTERNAL, not installed evidence. |
| W10 | Stock team writes: old worktree uses service-role profile/Auth writes; PR7 substitutes `update_stock_team_profile` with tenant lock and atomic audit, disables account creation. PR7 lock is local, not a complete Core/Stock fence; deployed selection UNKNOWN. |
| W11 | Stock demo self-heal plus `seed_demo`/nightly cron: profile/Auth/tenant writers; demo must be excluded and kept outside isolated DEV validation; UNFENCED. |
| W12 | Stock internal bootstrap script: tenant/profile/entitlement/Auth metadata creation; multiple operations without E1 fence; UNFENCED. |
| W13 | Core import/backfill/seed/manual SQL and provider-admin/service credentials: source scripts exist; actual reachable writers, jobs and operator custody UNKNOWN. |
| W14 | Other portal identity/ownership histories and external provisioner callers: Core accepts multiple products; source custody, complete historical subject links and fences UNKNOWN. No other portal repo was audited here. |
| W15 | Pending/disputed/retired/revoked history, proof custodians and cross-realm identity link completeness: native claim source exists; independent historical evidence/issuer and absent-link proof UNKNOWN. |

Successful empty SELECTs, status filters and email/UUID coincidence cannot close
W09/W13–W15. Include all historical states, pending claims, imports and lost/revoked
links. RLS-hidden data, a missing source, missing tombstones or an unqueryable realm
means UNKNOWN, never clean. Positive history means E2/E3; unknown denies entirely.

## 3. Chosen trust contract: preserve native writer, require private authority

Use the existing server-only policy boundary and native Registry transaction;
add only private E1 proof/reservation/outbox state when independently authorized.
Do not adopt old W1 roles, reinstall SQL008, edit migration020 or use generic
service-role table writes as an issuer. No new cryptographic service or cost.

Supported implemented observation is the pinned SSR token checked by
`getUser(token)` and `getClaims(token)`, including account restrictions and token
consistency. **That observation is not current managed-session authority.**
The positive issuer requires an independently established provider-supported
session checkpoint bound to exact project, subject and session, including current
revocation and applicable session policy. Supabase documents session-row correlation
for post-signout checks and delayed enforcement of timeout settings:
[session semantics](https://supabase.com/docs/guides/auth/sessions).
No session-introspection API, grant or supported issuer principal is invented.
Direct managed-Auth SQL access, a `postgres` helper to bypass privileges, new Auth
policies/roles/triggers, refresh-as-proof or reinstating old W1 grants is not selected.
If the approved mechanism cannot supply this checkpoint, issuance remains denied.

Required issuer result is an opaque, server-created, one-use private record:
issuer/principal and project/audience; subject/session; command/action; canonical
payload digest and codec; exact source manifest/revisions/fence epoch; E1 class;
opaque evidence reference/digest; database-issued time/expiry; revocation and
consumption state. Customer input contains only strict selectors/name/idempotency
key. No actor, role, coverage, classification, approval count or clean boolean is
accepted. Assertion secrecy, signatures and HMACs do not replace authoritative reads.
Only an independently scoped issuer may create proof; command transport may consume
it but cannot create, refresh, overwrite or reactivate it. The issuer identity and
its supported custody/ACL/recovery path are **UNESTABLISHED**, not a proposed fake login.

Use PostgreSQL's native command digest `sha256(action || ':' || payload::jsonb::text)`
for native commands. The issuer and consumer must hash the same normalized typed
payload in PostgreSQL; never substitute the memory model's JavaScript JSON digest
or the older E1 v2 name codec. Parent E1 command and native bootstrap child have
distinct server-bound keys/digests recorded together, avoiding native audit-key collision.
Thirty seconds is the proposed maximum proof lifetime, bounded further by token
and session authority; elapsed time never repairs missing authority.

## 4. Canonical mapping: explicit new forward objects

Existing source-backed Stock columns are `tenant.id`,
`user_profile(id,user_id,tenant_id,role,is_active)` and
`tenant_entitlements(tenant_id,linked_tenant_id,status,expires_at)`.
Core source has `tenants.id/platform/linked_tenant_id/owner_user_id`,
`tenant_members` and onboarding references. Their presence/types in the isolated
DEV projects must be verified before using them. Do not replay old migrations.
Legacy membership or billing mapping is restrictive evidence, never Company authority.

Retain the earlier proposed private schema names `core_e1_stock_private` and
`stock_e1_private`; revised proposed object/column and privilege scope is in the
operation specification. They avoid assumed Stock `core_tenant_id/core_user_id`
columns. Those appear in PR7's guarded cross-repo test fixture, which is neither a
Stock production migration nor proof that the receiver exists. Old E1 Stock SQL
stays incompatible and non-executable; no modification or application is proposed.

Core reserves `(Company, product=stock, portal-instance/reservation, Core subject,
future billing-tenant UUID)` once; portal-instance is the native ID. Billing UUID
is a reservation, not a `tenants` row, subscription or invoice. Stock later stores
its exact tenant/profile/Auth subject plus Core reservation IDs in its new private
binding, with local FKs to `tenant`/`user_profile`, unique reservation, Core subject,
Stock subject, tenant and profile. Cross-database IDs have no fabricated FK.
An immutable server-issued provisioning intent binds both sides; independently
authenticated Stock acknowledgement returns exact IDs and revisions. Current
canonical resolver must return that same active admin/profile/tenant; entitlement
mapping/status must agree. Matching email or signed acknowledgement alone cannot
establish the Core Owner or live local membership. Recheck before every portal
access. Missing/revoked/reassigned/duplicate mapping denies and never reactivates.

## 5. Atomicity, fencing and revocation semantics

**One Core transaction** creates Company, initial Owner and native Stock portal
reservation, consumes both native provenance and E1 proof, persists E1 reservation,
idempotent receipt/outbox intent, and appends native plus E1 envelope audit.
Proposed wrapper reuses `core_registry_mutate` with distinct parent/child command
keys and the same native advisory lock; no separate Registry, autonomous transaction
or HTTP sequence of writes. A transaction error aborts everything, including proof
consumption and outbox. Existing native function and flags are not patched here.

Required order: BEGIN on one pinned backend; lock global native Registry fence,
then subject/proof, Company/reservation and audit head in deterministic order;
obtain fresh post-wait authority; read complete source history/revisions; create or
reconcile; final authority/fence/expiry check; append audit/receipt and consume;
COMMIT only in a later explicitly authorized positive run. Prefer READ COMMITTED
with mandatory cooperating-writer locks and fresh SQL statements after waits;
SERIALIZABLE alone does not constrain unfenced writers in another database.
[PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html).

All in-scope writers, including non-E1 service/cron/manual paths, must either use
the same validated fence or be independently contained for the exact isolated DEV
window. An advisory lock does not stop other SQL. Application pauses, stale leases
or an attestation timestamp alone are not a fence. For cross-database sources,
require an exclusive epoch-bound hold which prevents conflicting writes until
Core outcome is known; holds cannot expire while an uncertain Core commit may
succeed. Connection loss must abort Core or retain containment pending independent
reconciliation. Absent this demonstrated protocol, cross-source E1 issuance denies.

**Stock tenant/member creation is a later, separate Stock transaction.** It
consumes the exact intent under its own fence; creates local tenant/profile/private
binding and PR7 audit atomically; repeats return the same IDs without regranting.
Managed Auth account creation is outside SQL and must be a separately authorized,
idempotent provisioning step. An orphan Auth user or Stock failure cannot grant
portal access. Core confirmation is another audited compare-and-swap transaction.
No ordinary ACID transaction spans the two Supabase projects. If simultaneous
rollback of real Stock membership and Core Company is required, this contract is
insufficient: deny, do not disguise a saga as atomic. New E1 checkout may follow
reservation before Stock account/profile; checkout remains modeled, no payment.

Revocation acceptance is explicit: a revocation completed before the final managed
checkpoint must deny; changes observed after lock waits must deny. Overlapping
revocation/commit requires demonstrated ordering at the approved checkpoint, not
an instant-revocation promise. If current governance requires stronger serialization
than the provider-supported verifier supplies, B0 remains open. E2/E3 never enter
the E1 wrapper; both independent enrolled operator subjects AND current sessions
must bind to the same exact Company/portal case/proof/revision, with no self-approval.

## 6. Exact future DEV validation and recovery envelope

`OPERATIONS.PROPOSED.json` names future actions, objects, principals, limits and
acceptance. All are `authorized=false` and `executable=false`. Core is fixed to
`mcvekinhgcqygfddyifs`; **no isolated Stock DEV project ref is accepted**. Production
Stock `oyyfcmlquqfrdoffkgsd` and Core `hxhusfkrlafxdnyasmsu` are excluded. No new
project/branch/paid plan, subscription, email/SMS delivery, SSO or payment is allowed.
An existing zero-cost isolated Stock DEV target must be named independently before
any Stock action can be submitted. No wildcard or environment-derived fallback.

Only recorded provider principal `postgres` is a candidate installer/recovery actor;
actual ownership, source visibility and independent recovery capability remain
preconditions. Native `service_role` is transport, not proof authority or a blanket
table writer. User-session `authenticated` is used for actual RLS tests. No use of
unavailable `supabase_admin`, new roles, provider-default ACL changes or Auth grants.

Later execution needs an immutable complete SQL/runner hash allowlist, exact
confirmed target/principal and fixture UUID manifest. JSON object scopes here are
not substitute SQL bodies. Never strip proposal guards or run historical installers.
Initial PostgreSQL tests must use one backend with BEGIN/ROLLBACK; HTTP/Auth API
and two-connection commit/recovery cases are separately named because they cannot
roll back with that backend. RLS must be tested with actual user sessions, not a
service-role client. No public route or existing application flag is enabled;
an isolated runner alone may invoke a specifically approved candidate capability.

Recovery: containment first through separately approved candidate EXECUTE revokes
and candidate settings=false, drain named candidate work only, retain all audit and
uncertain outcomes. Restore exact pre-run candidate ACLs/settings/dependencies on
rollback and compare independently. Post-COMMIT fixture teardown requires a
preapproved disposable-fixture retention/erasure rule; do not disable append-only
triggers, delete Registry audit, reuse historical empty-scaffold recovery or issue
CASCADE. Prefer preserving quarantined synthetic rows with access denied until
that rule exists. Remove only approved orphan test Auth users through supported
Admin API after verifying no remaining FKs; never SQL-delete Auth. If recovery
authority or no-residue semantics are missing, do not start durable tests.

## 7. Single blocker and one Owner decision

**B0 — TRUSTED_AUTHORITY_AND_FENCE_CLOSURE_NOT_ESTABLISHED.** Required evidence is
one authoritative closure record naming: (a) provider-supported current-session
verifier and exact issuer principal/custody/revocation semantics; (b) adopted
W01–W15 source dictionary plus complete historical identity links and every
writer/job/manual authority, with enforced fences or proven containment;
(c) exact existing isolated Stock DEV ref and independently capable recovery
principal. Source inspection has identified real unfenced and unknown writers;
no current supported issuer can assert complete clean E1 from this evidence.

**ONE Owner approval needed:** adopt this bounded DEV contract and its proposed
W01–W15 dictionary/atomicity semantics, requiring B0's authoritative closure record
before any separate hash-bound provider execution authorization. This is not a
request to approve missing SQL, activate E1, waive B0, collect customer documents,
change managed Auth access or start another generic investigation cycle.

Fresh verification for this deliverable is STATIC package/source-integrity and
requirement coverage only. Prior 103 Core + 55 Stock offline results are reused as
prior UNIT/model evidence; not rerun or reclassified. INTEGRATION, DB RUNTIME,
BROWSER UAT and PRODUCTION remain NOT_EXECUTED. STOP after local handoff.
