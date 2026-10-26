# Native Core DEV E1 forward draft

23 October 2026. Target: existing `mcvekinhgcqygfddyifs` only.
Status: ONE MANAGED ROLLBACK REHEARSAL PASSED / NOT INSTALLED / NOT CODE_READY.

## Verified input

One authorized read executed the exact catalog proposal with SHA-256
`acb24b63cc7eb6ba0e7d29d255b0698d6995a782189844106047cee657786f69`.
It read catalog metadata only. The three accepted public RPC fingerprints match;
all six native function bodies match reviewed SQL008. Eight table structures,
constraints/indexes, grants, forced RLS, policy expressions and the immutable
audit trigger were reviewed. Historical SQL008 remains a clean-install reference
and must never be rerun on this installation.

A separately approved follow-up read used exact source SHA-256
`8170785c4b15bbe9297593db8d8ffaaff5829cfdf3d8645037a729f5e5f82d86`.
It resolved all three policy roles to `authenticated`, found both queried E1
schemas and all four queried public E1 RPCs absent, and captured six enabled
provider event triggers and their function hashes. Each read ran once; no
provider write occurred and both read approvals are consumed.

## Forward artifact

[FORWARD.PROPOSED.sql](FORWARD.PROPOSED.sql) is an additive candidate, with an
unconditional exception before locks or DDL and terminal ROLLBACK. Its preflight
requires PostgreSQL17/UTF8 and the observed postgres authority, refuses existing
E1 extension objects, takes the native advisory fence, and locks the eight native
tables with NOWAIT before comparing catalog structures, grants, policy roles,
six exact function hashes and role attributes. An additional preflight pins the
follow-up policy-role, E1-object and event-trigger catalog metadata before DDL.
Any difference aborts. This is a drift check, not a provider configuration lock.

The E1 payload is copied without semantic edits from
`../E1_RESOURCE_ISOLATION.PROPOSED.sql` (whole-source SHA-256
`df04e5814e32310404ee6d1d8d5ec1c48620bcc1d31b8e30187c24f1e5066d9e`).
It adds three private tables, four private functions, three public E1 RPCs and
ten named guards/lock/immutability triggers. It reuses native Company rows and
append-only audit. It leaves the new settings false and Stock origin NULL.
Native function definitions and existing data are not rewritten. Legacy020 is
neither included nor changed.

## Effects requiring review before installation

Installing the new statement triggers changes Registry writer locking even while
E1 admission is disabled. Concurrent writers can receive
`E1_BUSY_REAUTHENTICATE`; this is not a behavior-preserving installation claim.
The preflight temporarily requires exclusive locks on eight native tables.
Protected E1 graphs cannot be adopted or changed through the older writer.
E2/E3 still require their independent two-operator path; this draft provides no
recovery override, payment, entitlement, active Stock profile or release.

The follow-up resolved the policy names and queried E1 object absence at catalog
level. All six provider event triggers are enabled and owned by `supabase_admin`.
Four have extension-specific tags; `pgrst_ddl_watch` and `pgrst_drop_watch` are
unrestricted by tag. Function hashes do not establish their bodies or side effects.
Watcher source equality and the specific rollback rehearsal are recorded below.
Concurrent provider configuration, existing enabled settings values, Registry
data contents and recovery authority remain outside those checks. No event trigger
is disabled or bypassed by this draft. The catalog comparison and rollback result
do not authorize permanent installation or activation.

## Validation boundary

Local checks verify exact payload reuse, baseline fingerprint pins, refusal before
effects, disabled settings, terminal rollback and preservation of historical
sources. The exact native/provider preflights and unchanged E1 payload now passed
one approved managed DEV rollback rehearsal with disabled settings. That result
establishes transient DDL creation and the explicit metadata/ACL assertions only.
The previous 11 real disposable Auth/PG17/PostgREST scenarios cover unchanged E1
payload behavior; the other five scenarios in run39897825995 prove native OIDC
protocol behavior. No combined application/browser or active managed RPC claim is
inferred from these separate evidence levels.

The actual application still has disabled/unbound composition and no accepted
positive Hub-to-Stock activation/trial path. The older generic bind/checkout
transport is not an installed E1 adapter. A successful catalog read does not
authorize removing those refusals. The two catalog reads and the later exact
rollback rehearsal/readback below are the complete provider execution scope.
No permanent install, Auth fixture, CI, Preview, deployment or activation occurred.

The dormant Stock wrapper now derives Core credentials from the native SSO
session, verifies the configured Core OAuth client and linked Stock identity, and
pins both customer tokens through quarantine staging. This local change has only
STATIC and synthetic SDK UNIT coverage; it is outside the immutable source set
of the prior native protocol runtime result. No actual SSR cookie, deployed app,
managed installation or positive activation claim follows from these checks.
`CORE_SSO_CLIENT_ID` is a required server configuration reference in source only;
no environment value was added or changed.

## Watcher source comparison

The two unrestricted watcher definitions were reconstructed from official
`supabase/postgres` source at commit `220751e04862f6023ba56871cc22fb81bc6f0954`,
using the observed empty search path and PostgreSQL's definition format. Their
complete SHA-256 values match the captured installed definitions exactly:

- `pgrst_ddl_watch`: `2b4b5d702ddf70fbd1a05c9825f9f9016d5c0ef97dd3df5f5b012ea23d9b94b1`.
- `pgrst_drop_watch`: `3a2696133853e17a0456cbfbb233a03815f50895492143e84df983b558d76593`.

These matched bodies iterate DDL/drop metadata and issue PostgREST schema-reload
notifications. PostgreSQL 17 documents that NOTIFY delivery requires commit.
This is a static source/equality conclusion, not a managed runtime observation.
It does not identify the entire installed image or freeze provider configuration.
Two extension-helper definitions also matched reconstructed source; the remaining
two did not. All four extension helpers have CREATE/DROP EXTENSION-only event
tags in the captured catalog, and neither proposed rehearsal changes extensions.
No helper is disabled, modified or called directly.

Sources: [pinned Supabase schema](https://github.com/supabase/postgres/blob/220751e04862f6023ba56871cc22fb81bc6f0954/migrations/schema-17.sql),
[PostgreSQL 17 NOTIFY](https://www.postgresql.org/docs/17/sql-notify.html), and
[transaction timeout](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-TRANSACTION-TIMEOUT).

## Approved rollback rehearsal — executed once

The Owner replied "you choose the best way" to the exact rehearsal/readback
approval choice. This delegated selection was used for the bounded rehearsal and
mandatory readback only. Both exact file hashes and the Core DEV project URL
were verified immediately before execution:

- Rehearsal: `ec64eef7acb230fe97765a5df099b33a8ff3897571b9ca083275a9ff63e523eb`.
- Readback: `164f17e740dfad535f0d8e7806b84614558042664248b2b3538c5f87979dcdb8`.

Each file ran once, with no retry:

1. `REHEARSAL.ROLLBACK_ONLY.PROPOSED.sql`: one transaction on existing Core DEV
   `mcvekinhgcqygfddyifs`, limited to 30 seconds, with statements limited to 10
   seconds and lock waits to one second. It retains the exact native/provider
   preflights, briefly takes NOWAIT exclusive locks on eight Registry tables,
   creates the three E1-private tables/four private functions/three public RPCs
   and ten triggers, and inserts one false/NULL settings row. It checks new-object
   owners, forced RLS, effective grants, disabled/empty state and enabled triggers,
   then unconditionally ROLLBACKs. It invokes no admission or binding RPC.
2. `READBACK.READ_ONLY.PROPOSED.sql`: one mandatory catalog/lock-metadata readback
   afterward, also after a failed or timed-out attempt. It compares the full
   native and provider snapshots, requires E1 absence and no remaining exclusive
   Registry relation locks, and ends ROLLBACK. A failed attempt must be allowed
   its 30-second transaction window before this readback. No automatic retry or
   backend termination is included.

Only the separately proposed rehearsal omits the source draft's unconditional
refusal. `FORWARD.PROPOSED.sql` keeps that refusal. The unchanged payload starts
disabled with NULL Stock origin. No existing business/Auth/settings row, provider
hook, role, extension, migration ledger, runtime flag or deployment is changed.
The new objects and settings row exist only inside the transaction. Native table
triggers and locks are transient effects and can briefly block other DEV work.

The transient check returned `TRANSIENT_DDL_CHECKS_PASS_NOT_COMMITTED` with the
expected three private tables, four private functions, three public RPCs and ten
enabled triggers. Effective grants, owners, forced RLS and false/NULL empty state
assertions passed. The transaction ended ROLLBACK. The mandatory separate readback
then returned `ROLLBACK_READBACK_PASS`: E1 objects absent, native/provider catalog
snapshots matching, and no remaining exclusive Registry relation locks.

This is fresh managed DEV DB evidence for this exact rollback/metadata scope.
There was one transient write transaction, not a zero-write run; none of its E1
objects or settings row persisted. No notification listener, live Auth session,
RLS row-access, active RPC, contention/revocation, application or browser flow was
tested. Catalog equality at boundaries is not a technical provider freeze.
Both calls are consumed. Any further execution, retry, permanent install or
activation needs separate applicable authority. The refusal-guarded forward
draft and all application runtime/refusal gates remain unchanged.

The actual admission, Stock SSO/quarantine and Core reciprocal modules now compose
in one offline harness with 13 passing scenarios. Auth/RPC responses and database
effects are synthetic; this is UNIT evidence only. Real application sources and
runtime gates were unchanged at that checkpoint. No route, cookie transport or live integration was
exercised there. Evidence is in `h1-g1-composition-20261023/scratchpad/` under the same
session Temp/Codex evidence root.

The later Owner-approved local transport implementation adds a dormant native
bearer-only Core handler and Stock server caller. Its explicit client/issuer,
native-link, Owner/realm, inactive receipt and stable-command checks are described
in [the transport record](APP_TRANSPORT.PROPOSED.md). Both literal flags and fixed
refusal bindings stay closed. A synthetic fetch bridge now composes the actual
Request/Response handler with both applications' adapters; this remains UNIT,
with no actual network/SDK, Next.js server, managed Auth/DB or browser proof.
The evidence root is `h1-g1-native-transport-20261023/scratchpad/`. No environment,
provider, CI, deployment, permanent install, activation or financial action follows.

The Core reciprocal adapter now rechecks Stock's native identity link against the
verified Core actor before and after its quarantine RPC. The generic native
transport explicitly blocks bind/checkout before constructing clients and accepts
only reserved, unmodeled admission receipts. These source corrections have focused
STATIC/UNIT coverage only; they introduce no active transport or entitlement.

## Completed approved catalog read

`NEXT_PRECHECK.READ_ONLY.PROPOSED.sql` was the separately approved one-time read on
existing Core DEV `mcvekinhgcqygfddyifs`. It resolves the three native policies'
role OIDs, checks catalog presence of the two E1-private schemas and four public
E1 functions, and inventories event-trigger metadata and function hashes. It
starts READ ONLY and ends ROLLBACK. It does not read settings values, customer or
Auth rows, or the migration ledger. Function definitions are hashed on the server;
their bodies are not returned. It performs no DDL, fixture, environment or release
action. Catalog visibility does not prove trigger behavior.

The Owner approved this exact hash and catalog-only scope. The project URL and
file hash were verified, then the exact file text including its terminal newline
was executed once. This approval is consumed and authorizes no further provider
SQL, installation, Auth fixture, runtime, activation or release.

Latest evidence remains outside the repository at
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-followup-catalog-20261023/scratchpad/`.
The preceding `h1-g1-registry-comparison-20261023` and `h1-g1-core-binding-20261023`
evidence directories retain their historical results and source hashes. Watcher
source reconstruction and rehearsal preparation are recorded at
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-watcher-review-20261023/scratchpad/`.
The fresh managed rehearsal/readback result is at
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-managed-rehearsal-20261023/scratchpad/`.
