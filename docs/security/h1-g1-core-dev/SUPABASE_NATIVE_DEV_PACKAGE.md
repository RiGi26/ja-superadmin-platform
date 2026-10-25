# H1.G1 Supabase-native Registry candidate

> **Historical proposal contract; do not reinstall on current DEV.** The Owner
> reports that the native Registry is already installed manually through SQL
> Editor, while the Supabase migration ledger is empty. Read
> [DEV_REGISTRY_AS_BUILT.md](DEV_REGISTRY_AS_BUILT.md) for the current reconciliation
> record, source identities and protected PR #47 collision. SQL008/009 and the
> installation/recovery steps and next action below are historical proposals;
> they grant no current execution or cleanup authority. SQL006/007 remain
> superseded DO_NOT_APPLY references. Exact installed-source equivalence is unverified.

Authority: approved local architecture change, 2026-10-17. Baseline commit
`5dcff3c3bab1d6aaccf6b315a47e9bbb6edb6f0a`, branch
`feat/h1-g1-e1-core-static`, existing `.wt-customer-hub-core` worktree.
This package permits no provider execution, installation, commit or publication.
H1.G1 remains OPEN; E1 remains DISABLED; H2 remains NOT_STARTED.
`CORE_COMPANY_RUNTIME_ENABLED=false` remains the literal application gate.

## Architecture and source boundary

The new candidate uses Supabase Auth, ordinary RLS, and one narrow atomic writer
RPC. It requires no W1 roles, custom LOGIN, managed Auth SQL grants, Auth table
foreign keys, or direct Auth table queries. Existing `postgres`, `authenticated`,
`anon` and `service_role` roles are used with explicit object ACLs. Existing
`postgres` must already have the owner/BYPASSRLS authority needed by the definer;
the proposal neither creates that authority nor assumes the provider granted it.

SQL008 is the sole clean-DEV base and writer proposal. SQL009 is its independent
empty-scaffold recovery rehearsal. Both end in ROLLBACK. They do not depend on
SQL001/002/004/005/006/007 and must not be installed on top of them. SQL006/007
remain byte-identical superseded DO_NOT_APPLY references, including their refusal
guards. Old W1 codecs and their documentation are historical, inert candidates;
the native DAL imports only the disabled gate and DEV origin from `core-company`.
No existing app entrypoint is redirected or enabled in this source-only change.

`lib/core-registry-native.ts` contains actual Supabase calls, strict input
validation, current Auth checks, Owner billing authorization, and audit export
verification. It is a `server-only` DAL, not an automatically exposed Server
Action. Tests use in-memory client mocks solely to exercise its dormant branches.
The implementation is not a replacement Auth service or a mock database.

## Ordered installation contract (historical clean-DEV proposal)

1. Obtain separate Owner permission for a synthetic, rollback-only DEV rehearsal
   on **webzoka-core-dev / mcvekinhgcqygfddyifs**. Independently verify the selected
   provider/project connection; a shared database name is not project identity.
   No SQL is authorized by this document. No Production connection is acceptable.
2. Match every source hash in `NATIVE_MANIFEST.sha256` and the handoff's manifest
   hash. Confirm the source gate is false, the private runtime seed is false,
   the target public tables, private schema and public RPC names do not exist,
   and there are no existing migration records being silently adopted. Existing
   tables or a previous durable candidate require reconciliation, not rerunning.
3. Use an independently authorized existing `postgres` session. SQL008 preflight
   requires current_user=session_user=postgres, PG17, UTF8, existing BYPASSRLS,
   schema CREATE and standard Supabase function visibility. Unknown/missing
   authority stops. No SET ROLE, temporary role grants or Auth grants are needed.
4. Create the three canonical tables and their identity/history constraints;
   create the private settings, operators, provenance, claims and audit tables.
   All objects belong to the actual existing installer, constrained to postgres.
   No legacy records, invoices, subscriptions, disputes or audit history are copied.
5. Enable and FORCE RLS on all eight tables; remove default direct privileges;
   grant authenticated SELECT on the canonical three only. Add three read policies.
   Create the audit trigger/helpers and public functions with fixed empty search_path.
6. Revoke default function EXECUTE; grant authenticated only the user-scoped
   authorization RPC and service_role only claim-context plus atomic mutation.
   SQL008 checks effective inherited table/schema/function authority after grants.
   Any unexpected effective access aborts instead of guessing a grantor fix.
7. The unmodified SQL008 artifact executes ROLLBACK. To add the synthetic scenarios
   below inside its transaction, use a separately approved, exact hashed rehearsal
   envelope before its terminal ROLLBACK. Keep both application and DB gates false
   outside such a rollback transaction. No durable COMMIT is included or approved.
8. Only after accepted runtime evidence may Owner approve an exact durable
   derivative and activation plan. PostgREST schema reload, application wiring,
   deployment and operator/provenance enrollment are outside present authority.

No provider execution is needed to review this local patch. No old installer guard
should be removed to test the native proposal.

## Object, role and grantor matrix

| Object / operation | Owner or grantor | authenticated | service_role | anon / PUBLIC |
| --- | --- | --- | --- | --- |
| Canonical three tables | Existing postgres | SELECT through RLS | No direct table privileges | None |
| Private schema and five tables | Existing postgres | None | None | None |
| `core_registry_authorize(uuid,boolean)` | Existing postgres; SECURITY INVOKER | EXECUTE, own active membership/Company only | None | None |
| `core_registry_owner_claim_context(uuid,uuid)` | Existing postgres; SECURITY DEFINER | None | EXECUTE; current enrolled operator required | None |
| `core_registry_mutate(uuid,uuid,timestamptz,uuid,text,jsonb,uuid[])` | Existing postgres; SECURITY DEFINER | None | EXECUTE; Auth lease and current DB authorization required | None |
| Private helpers and audit trigger | Existing postgres; invoker inside definer | None | None | None |
| Operators, provenance, DB gate enrollment | Independently authorized custodian using existing postgres | None | No enrollment RPC or table grant | None |
| Auth users / sessions / identities tables | Provider managed | No new access | No new access | No new access |

`service_role` is an existing privileged backend credential, not an end-user role.
Its custody is the trust boundary for actor parameters and verified account IDs.
The new functions cannot make a stolen service key safe. Never put that key in
client code, requests, logs, evidence or public environment variables. The DAL
constructs it only after the local gate, exact DEV origin and user checks pass.
No custom role membership or post-install grant repair is required by this design.

## Security invariants and commands

- Company identity is UUID, not a display name. Equal names alone are not duplicates.
  Every user has at most one active Company membership across all Companies;
  historical revoked membership is retained. Company/product is unique across
  history. Product instances stay reserved, with external mapping IDs NULL.
- Membership read policy permits only the user's active row. Company policy uses
  that policy; portal policy uses Company policy. This dependency terminates,
  avoiding recursive membership/Company policies. No client INSERT/UPDATE/DELETE
  policies or grants exist, so JWT metadata cannot promote an Owner.
- Read and Owner-billing authorization use the cookie client's JWT, `auth.uid()`
  and current Registry state. Billing entrypoints must use
  `authorizeNativeOwnerBilling`, which fixes Owner-only=true; this package changes
  no billing/payment execution or existing application flows.
- The server calls supported `getUser()` and `getClaims()`, checking confirmed,
  non-anonymous account, signed subject/session, issuer, audience and token times.
  It derives a maximum 30-second lease bounded by token expiry. Caller-provided
  actor, session, role, proof, reviewers and verified account IDs are rejected.
- One service-role RPC performs each write. It takes the common transaction
  advisory fence, checks lease after waiting, locks current Company/membership,
  checks expected revision, and checks lease/proof again before audit. All writers
  and trusted provenance custodians must follow that fence. It serializes this
  bounded Registry globally; there is no distributed custom locking service.
- `company.bootstrap` requires a private, complete, fresh, exact-command-bound
  clean provenance record and **no membership history at all** for the creator.
  It atomically creates Company, first Owner and reserved product, consumes proof
  and writes audit. A revoked former member cannot reclassify as clean E1.
- `company.rename` and `membership.revoke` require current Owner, active Company
  and matching revision. Revocation checks same-Company membership and protects
  the last active Owner. No arbitrary role promotion or payment operation exists.
- `owner.propose` requires a currently enrolled independent platform operator,
  genuine legacy/disputed/takeover/conflict provenance, exact existing Owner,
  exact target and Company/revision. Proposal changes no membership. A separate
  `owner.approve` requires a different enrolled operator, neither operator being
  the target. The proposer is the first reviewer, the approver the second.
  Enrollment must represent two independent people; different UUIDs alone cannot
  prove independent human control. Email allowlists and JWT role strings do not
  enroll anyone.
- Approval obtains target and proposer via the private context RPC, uses supported
  Auth Admin `getUserById` for both accounts, refreshes approver authentication,
  and passes only server-derived verified IDs. The DB rechecks both operator
  enrollments, original short proposer lease, Company/proof revision and digest,
  pending claim and membership uniqueness. It promotes/inserts the target Owner
  before revoking the specified previous Owner, preserving other active Owners.
  Both operators must act within the original <=30-second lease; expiration
  requires a new proposal against current state, not extending an old approval.
- `(actor_id,command_id)` is unique in audit. Same-key/different-payload fails.
  Matching retry can return the stored receipt only after current Auth and current
  Owner/operator authorization; a receipt grants no future authority. Changed
  claim IDs, revisions or consumed proofs cannot be silently reused.
  A PostgreSQL error returns denied; a lost/invalid response after a write attempt
  returns unconfirmed with the original command ID. Reconcile or retry that same
  ID after current authorization; never generate a new ID to hide an uncertain commit.
- All successful state changes and proposal creation append canonical audit bytes,
  before/after state, actor/session/request IDs, Company/member/product IDs where
  relevant, evidence reference, reviewers, timestamp and SHA-256 chain. UPDATE,
  DELETE and TRUNCATE are refused by the audit trigger; ordinary callers cannot
  insert or change audit. An audit insertion error aborts the whole writer RPC.
  Only successes are recorded in this atomic ledger; failed attempts cannot be
  durably logged in the same transaction that is rolled back. Existing sanitized
  server observability may record denials; no sensitive documentary uploads.
- Audit export verification hashes **stored canonical text**, not a JavaScript
  reserialization of PostgreSQL JSONB. The verifier requires an independently
  retained trusted head. Hash chains do not prevent a database owner from rewriting
  both events and a co-located head; approved independent anchoring remains required.

## Provenance contract and exact remaining limitations

Provenance is private business evidence, not a W1 token transport. No public/API
path inserts it, no client-provided history is trusted, and no synthetic "clean"
proof is seeded. An approved custodian must bind `subject_id`, optional Company,
classification, revision UUID, command UUID, request digest, opaque evidence/fence
references, and a <=30-second validity interval. Request digest is PostgreSQL17
`encode(sha256(convert_to(action || ':' || payload::jsonb::text,'UTF8')),'hex')`;
use the normalized strict command payload, not JavaScript object serialization.
For bootstrap Company is NULL and classification clean; for an Owner claim,
Company and classification must match the proposal. Coverage must contain exactly
W01 through W15, each with `complete:true`, a nonempty `revision` string,
`participatingWriter:true`, and for bootstrap `state:"clean"`.

These identifiers preserve the existing trusted-history requirement. This task
does not invent a new source inventory or mark actual sources covered. A row with
those flags is not evidence by itself. **No verified producer/source-to-W01–W15
mapping, independent evidence attestation or cross-source writer-fence participation
has been supplied or runtime-proven.** Absent that exact trusted contract, do not
enroll proofs or enable bootstrap. Unknown/partial/expired coverage fails closed.
The architecture removes W1's seven-role/Auth-grant dependency; it does not erase
the business requirement for genuine provenance.

Supported Supabase APIs do not provide a transactionally locked managed Auth
session row to this SQL transaction. `getUser`/Admin account checks plus a bounded
lease reduce stale authority, but **do not guarantee linearizable logout, password
reset, global session-limit or revocation effects between Auth check and SQL commit**.
Admin getUserById proves current account state, not the proposer's current session.
The DB does enforce current membership/operator state under its own write fence.
No instantaneous managed-session revocation PASS is claimed. If that stronger
semantic is mandatory, this is the exact remaining architecture limitation; do
not restore direct Auth-table access or invent another role layer to hide it.

## Rollback rehearsal and independent recovery

The exact SQL008 changes are enclosed in BEGIN/ROLLBACK. An error must stop the
client; explicitly ROLLBACK a failed transaction before reuse. No Auth Admin writes
or external mutations occur inside the proposal. Rehearsal must snapshot source,
object/ACL inventory and migration history before/after and prove no residue.
Synthetic Auth accounts, if separately approved, must be created/deleted through
supported APIs by exact test IDs; SQL rollback cannot remove external Auth writes.

Before any future durable installation, a second authorized postgres connection
must independently demonstrate recovery access and identify the exact installation
inventory. SQL009 is executable only as an approved recovery rehearsal: it locks
the same fence and all eight tables, verifies ownership, private table inventory,
the single false settings seed, and absence of every business, operator, proof,
claim and audit row. It drops only named candidate functions/objects in reverse
dependency order with RESTRICT, then ROLLBACK. Unknown objects/dependencies or
populated/enabled state STOP; it never uses CASCADE, DROP OWNED or history truncation.
Source review is not proof that provider post-COMMIT recovery access exists.

If data exists, preserve it. An explicitly approved custodian may contain writes
by disabling the DB gate and revoking EXECUTE on `core_registry_mutate` and
`core_registry_owner_claim_context` from service_role. Existing transactions must
be drained/rolled back under an approved operational envelope before declaring
containment. Keep the app gate false; retain audit exports/anchors. Recovery then
needs a separately reviewed forward repair against exact retained state, rather
than the empty-scaffold script. Restore access only after fresh security tests.

## Validation and acceptance

Offline commands, using already installed local tooling:

```text
node --test lib/core-registry-native.test.mjs lib/core-w1.test.mjs lib/core-w1-installation.test.mjs lib/blank-company-isolation.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js lib/core-registry-native.ts lib/core-registry-native.test.mjs
```

The handoff contains actual command logs and exit statuses. Manifest verification,
transitive local-import closure and preservation comparison are additional static
checks. Existing accepted E1/Core historical suites are reused only for unchanged
source hashes; their results are not counted as fresh runtime tests.

Authorized next runtime envelope must prove, with synthetic identities only:

| Scenario | Required real DEV result |
| --- | --- |
| Unauthenticated/anon; wrong JWT; forged Owner/proof/actor | No read/write/privilege escalation |
| Active member in A selects/writes B | Zero rows or denied; no B audit/state change |
| Duplicate active user membership or Company/product | Unique violation, complete rollback |
| Clean bootstrap with missing/partial/expired provenance or any history | Denied, zero Company/member/product/event residue |
| Valid clean bootstrap | Exactly one Company, Owner, reserved product and linked audit event |
| Concurrent duplicate/bootstrap; changed replay payload | One successful effect; conflict denied; matching retry current-authorized only |
| Revoked membership or stale Company revision | Denied even with previously valid receipt/JWT |
| Owner-only billing check; last-Owner revoke | Non-Owner denied; last Owner preserved; no payment execution |
| Same operator, target self-approval, inactive proposer/approver, changed proof/revision | No Owner mutation |
| Two independent enrolled operators, verified target, current proof/lease | Atomic promotion/revocation, both reviewers in audit |
| Forced audit insertion failure; constraint failure after Company insertion | Entire transaction rolled back, including consumed proof/claim |
| RLS under actual anon/authenticated/service_role; inherited/default ACLs | Exactly the matrix above, including private schema refusal |
| Auth logout/revocation during wait | Measure supported behavior and document lease limitation; never label instantaneous |
| Audit export tampering, deletion/reordering; independent head | Verification fails; unchanged export verifies |
| Rehearsal rollback, empty-scaffold recovery and refusal with populated state | Zero residue; history preserved; independent recovery authority proven |

DATABASE/RUNTIME and provider recovery are NOT_EXECUTED. No local PostgreSQL,
psql or Docker executable was available; installation was not authorized. SQL
source contracts and mocked RPC error behavior are not proof of PostgreSQL parsing,
RLS enforcement, concurrency or actual transaction rollback. Non-UI source change:
browser UAT is not applicable; no Preview/Production validation is claimed.

ONE next action: Owner review this exact hashed package and authorize a bounded
synthetic rollback-only DEV runtime envelope, with explicit provenance authority
and acceptance of the documented Auth lease semantics before any activation.

## Primary mechanism references

- [Supabase database functions and EXECUTE closure](https://supabase.com/docs/guides/database/functions)
- [Supabase RLS and auth.uid](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase server Auth security](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/server-side/advanced-guide.mdx)
- [Supabase session semantics](https://supabase.com/docs/guides/auth/sessions)
- [PostgreSQL 17 binary hash functions](https://www.postgresql.org/docs/17/functions-binarystring.html)
