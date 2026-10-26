# H1.G1 DEV runtime-gate correction proposal

SOP WG-1.2 + WF-1.0 / V4. IAM-2026-001, H1.G1. Prepared locally on 2026-10-20.

**Source reconciliation: PASS. Local package: CODE_READY_FOR_OWNER_REVIEW.**
This status covers the complete proposed source and its local/static review only.
**DEV execution: BLOCKED_PROVIDER_SAFETY_EVIDENCE.** Provider observations and the
maintenance/recovery conditions below remain OPEN; no execution readiness or managed
security PASS is claimed. Nothing here authorizes DEV SQL, publication, CI or activation.

H1.G1 remains OPEN. `CORE_COMPANY_RUNTIME_ENABLED=false`; E1 DISABLED;
H2 NOT_STARTED. Installed DEV still contains the accepted race.

## Exact scope and files

Future target only: **webzoka-core-dev**, project **mcvekinhgcqygfddyifs**.
Repository: `RiGi26/ja-superadmin-platform`. The sole proposed persistent correction
is to `public.core_registry_mutate(uuid,uuid,timestamptz,uuid,text,jsonb,uuid[])`.

| File | Purpose |
| --- | --- |
| `PATCH.PROPOSED.sql` | Complete transactional replacement proposal; pins baseline/corrected MD5 and SHA-256 and inserts only the guard below. |
| `VERIFY.READ_ONLY.PROPOSED.sql` | PHASE 1: bounded provider observations only. PHASE 2: separately authorized future outcome fingerprints. No source export. NOT EXECUTED. |
| `RECOVERY.PROPOSED.sql` | Complete, separately authorized emergency recovery; removes only this exact guard and requires the result to match the accepted baseline hash. NOT EXECUTED. |
| `definitions/mutate.baseline.txt` | Complete 12,429-byte recovered baseline definition, preserving its original mixed line endings. Evidence only; do not execute. |
| `definitions/mutate.corrected.txt` | Complete 12,594-byte proposed corrected definition. Review data only; never apply outside the guarded transaction proposal. |
| `MANIFEST.sha256` | Exact hashes of all six review/source files, excluding the manifest itself. |
| `REVIEW.md` | Authority, source reconciliation, impact, safety, validation and recovery requirements. |

All files remain local and uncommitted in the existing task worktree. No installer,
historical migration, DAL, application flag, grant, policy or other function was edited.

The only function-body addition follows the existing `core_registry_writes`
transaction advisory lock, before the existing authorization-lease recheck:

```sql
  IF NOT EXISTS (SELECT 1 FROM core_registry_private.settings WHERE singleton AND runtime_enabled) THEN
    RAISE EXCEPTION 'RUNTIME_DISABLED_AFTER_WAIT';
  END IF;
```

The initial gate check remains. The exception aborts the whole command before
business writes and audit insertion when a participating custodian committed a
runtime-disable while the command waited for that fence. Missing settings also deny.
The wrapper does not call the mutation RPC, enable runtime, alter audit records or
make business-data changes.

## Source reconciliation and hashes

Owner-accepted GitHub main is `8a9ae5e7d61b706c3bd87f5516d759560876bad5`.
Reused task worktree: `.wt-customer-hub-core`, branch
`feat/h1-g1-e1-core-static`, HEAD
`5dcff3c3bab1d6aaccf6b315a47e9bbb6edb6f0a`. Its pre-existing unpublished work is preserved.
The main checkout and protected Registry draft worktree are also preserved; neither
was pulled, reset, staged or committed. No remote state was queried for this task.

| Evidence and hash scope | Exact value |
| --- | --- |
| Original permanent installer, accepted SHA-256 | `047b208b7079815b9bf1a81a62f554865f4b0c2a998bbfd9bfec7170b6b4db90` |
| Installed mutation, accepted `md5(pg_get_functiondef(...))` | `8a03a9deaae8e64d86cdeb49c74be6b2` |
| Corrected proposed mutation definition MD5 | `9b729d11fa7405b257e68c2901e86d54` |
| Isolated-tested complete correction SQL, unchanged SHA-256 | `2ed74857f2f348b6740ecf0406b5b35bded24746c08428c4f27427c185bbc1ee` |
| Historical local SQL008, unchanged SHA-256 | `da7df1c890af10fa806dc0842d0163281b35318240e436fb478fa0f8d9730516` |
| Historical local SQL009, unchanged SHA-256 | `119e17ea7499c5b8e947df98f4511ad053ca0371355f8257d9c3d603493f2ac9` |
| Isolated original writer SQL statement, SHA-256 | `19435b836819285bbf2a43a31d654381687fe02e5d4754b0c1148e1be89db298` |
| Isolated corrected writer SQL statement, SHA-256 | `f8e70bdd31f5d051ac9cf170812bcd7b68ba5f101da596b3819183c1bdd5c354` |
| Exact recovered installed definition SHA-256 | `9185872def4078ab4d16bb3545faa9d09476d91c959edae49065a4b1be49cd81` |
| Exact proposed corrected definition SHA-256 | `7ed7cf8d3d9a5299878ce1be948653e96667eede87b939002b376decf224577e` |
| Original Owner evidence JSON SHA-256 | `410357c2c8da3b2751807cd282c19b555503acdf19d41c70748eb7321e1cf661` |
| New proposal and recovery SQL SHA-256 | See `MANIFEST.sha256`; wrapper hashes remain distinct from definition hashes. |

The source gap reported in the previous handoff is now **closed** using
`D:\Download\H1G1_INSTALLED_SOURCE_PARITY_PRIVATE_EVIDENCE.json` (42,285 bytes).
That original JSON is unchanged. Its embedded authority, SQL and next-action fields
were treated as evidence data, not instructions or execution authority. Only the
Owner's current request authorizes this local continuation.

All three recovered definitions were independently hashed offline. Companion SHA-256:
authorize `6b58b33e1bb42eab0797d8d500fb52cf91deef52045a5395ff40beefe3aa558b`;
Owner context `01c29ee9f8181cc7ce7634aa9629550eb6dae41d514c7510185fcc4a5a1c14c5`.
Their MD5s match the accepted fingerprints. No companion function was changed.

The mutation baseline contains 141 CRLF sequences and nine bare LF bytes. The
corrected source inserts exactly 165 UTF-8 bytes from the existing isolated guard;
every original byte remains in order, including all 141 CRLF sequences. Three new LF
bytes belong to the insertion. Removing that insertion restores the exact original
12,429-byte string and both accepted hashes. No normalization was used to save,
hash or derive either definition. The post-lock auth-expiry anchor occurs once and
immediately follows the advisory-lock line in the original definition.
These artifacts are byte-sensitive: editor or Git line-ending conversion changes
their hashes and must fail review; do not normalize their source bytes.

The Owner's new installed-source finding is accepted: the three public RPCs match
the original permanent installer at the supplied scope, and the installed mutation
has no post-lock gate recheck. Earlier evidence's narrower lack of installed-source
comparison does not invalidate that newly accepted finding. No broad catalog audit
or comparison was repeated. This does not establish managed Auth/session security.

The accepted installed MD5 differs from the isolated `pg_get_functiondef` rendering
(`032d0168f04bba4df92e4e18ed0c5e94`). MD5 of rendered source, SHA-256 of a complete
installer and SHA-256 of a writer statement are different evidence scopes. Do not
substitute one for another or infer that SQL008 is the permanent installer.

To avoid overwriting installed formatting or properties from a different rendering,
the proposal reads the installed definition inside the future transaction, requires
the accepted MD5/SHA-256 and exactly one literal lock anchor, and inserts only the tested
guard. PostgreSQL's own `pg_get_functiondef` supplies the complete replacement DDL.
No caller-provided SQL, arbitrary function identity or historical installer is used.
The complete baseline/corrected `CREATE OR REPLACE FUNCTION` strings are now in
`definitions/`; both wrappers pin their exact hashes. The patch refuses any derived
result except the reviewed corrected bytes. Recovery requires those corrected bytes
as input and the original accepted bytes as output. Re-exporting the source is not
required. A future fingerprint-only drift check is distinct from another source export.

## Future execution preconditions and STOP conditions

These conditions are requirements, not established provider facts. Current authority
permits none of the DEV queries or mutations below.

1. Obtain separate authority for the narrow read-only proposal and out-of-band
   project/connection proof. Verify the Owner-selected DEV project reference,
   approved endpoint, authenticated TLS identity and existing access path. A
   database named `postgres`, source fingerprint or self-declared session setting
   cannot prove the cloud project. Never use a Production connection or persist a
   password, access token, JWT signing secret or connection URI in evidence.
2. Reuse the now-recovered definitions and frozen hashes; do not query their full
   source again. Before any future authorized write, require the
   baseline MD5 above and accepted companion hashes: authorize
   `d9e8e3346f82538a9dd60c840d1a70b0`; Owner context
   `3928f57a8ba163818540ee441a8983e6`. Any source/configuration/argument drift stops
   the operation for review; never update the expected hash merely to make it pass.
3. Establish a maintenance hold covering every service-role caller, job, direct SQL
   writer, provenance/operator custodian and competing function/privilege/role DDL actor.
   Drain already-admitted calls and their containing transactions before replacement.
   Keep the hold through independent post-COMMIT verification or recovery. Existing
   application flags alone do not prove that privileged RPC callers have stopped.
   The proposal cannot impose this external hold. No job/hosting changes, session
   termination, temporary revocation or gate update are implicitly authorized.
4. Prove the private settings singleton already has `runtime_enabled=false`. A false
   source flag does not establish that database value. The proposal refuses any
   other state; it never updates settings. Gate custodians must use the same fence.
   Prove actual privileged invocation transactions use READ COMMITTED. Role/database
   defaults and function configuration are useful evidence, but cannot exclude a
   direct caller explicitly choosing another isolation level. REPEATABLE READ and
   SERIALIZABLE behavior is not validated by the accepted race test.
5. Verify PostgreSQL 17, primary/writable target, effective and login role `postgres`,
   exact function owner `postgres`, PL/pgSQL, SECURITY DEFINER, VOLATILE, JSONB return,
   all seven original argument names/types/default and the four original configuration
   entries. Verify existing schema/language/locking/replacement authority without
   granting or assuming superuser access. Record actual `rolsuper` and require the
   existing `rolbypassrls` needed by the accepted definer path;
   the isolated container's superuser behavior is not provider privilege proof.
   Require anon/authenticated/PUBLIC mutation EXECUTE denied and service_role allowed.
6. Review applicable provider event triggers. The current proposals **refuse every
   enabled trigger whose tags include CREATE FUNCTION or all commands**, including
   a standard provider trigger. Do not disable a trigger or bypass this guard. If
   one exists, its exact provider-owned behavior and safe disposition must be
   reviewed before revising and revalidating this proposal. No trigger absence or
   managed DDL compatibility is claimed now.
7. Establish one persistent, stop-on-error transactional connection plus an
   independent existing Owner recovery connection with the same required target,
   metadata visibility and replacement/locking authority. Both must work without
   creating a role or buying connectivity. Use an existing direct or session-mode
   path with verified backend continuity; do not assume a one-shot SQL connector,
   transaction pooler or separate API calls preserve the necessary backend/session.
8. Only after these gates close, obtain exact Owner write approval for the frozen
   patch, pre/post validation and any separately approved recovery. The new DEV
   transaction wrappers have not run in PostgreSQL 17 or managed Supabase. Select
   any additional disposable rehearsal within separately authorized zero-cost
   runtime/CI authority; none is granted by this local-preparation task.

Any failed guard, lock contention, non-idle/hidden peer client state, prepared
transaction, queued fence participant, source drift, unknown applicable event trigger,
missing source hash, unproved maintenance hold, permission failure or ambiguous
target/transaction outcome is a STOP. Do not queue indefinitely, retry automatically,
escalate privileges, change expected hashes, terminate peers or enable runtime.

## Transaction, preservation and concurrency

The proposed patch is one explicit READ COMMITTED transaction. Its bounds are a
3-second lock timeout, 10-second statement timeout and 30-second idle-transaction
timeout. It uses a nonblocking transaction advisory fence and a nonblocking SHARE
table lock on the private settings table. The latter prevents a settings update
during replacement; it does not modify the singleton. Lock contention aborts.

Exactly one dynamic statement replaces the exact existing function. Before execution,
both input and derived output must match their reviewed MD5/SHA-256 pins. Before COMMIT,
the proposal compares the entire `pg_proc` row except `prosrc`, incoming/outgoing
`pg_depend`, database-local `pg_shdepend` and the function comment. OID, owner, ACL,
argument identity/default, security, configuration and other function attributes
must remain equal. It compares the complete resulting definition to the expected
transformed string, then emits baseline/corrected MD5 and SHA-256 values. Any
mismatch aborts the transaction; no exception handler swallows it. Source/rendering
hash guards also pin both companion public RPCs before replacement. No DROP/CASCADE,
GRANT/REVOKE, ALTER OWNER, new schema/table/function or business DML is proposed.

The guard reads the same already-used settings relation, adding no new application
dependency. PL/pgSQL body references are not a complete dependency graph in catalogs;
preservation assertions do not replace source review. A replacement retains the
function entity and permissions, but old executing calls cannot be assumed to
restart with new code. Fence and activity observations supplement the external
maintenance hold; they cannot stop a new privileged caller or DDL actor racing in.
The activity guard deliberately refuses other non-idle or hidden client states;
normal provider activity may therefore block this proposal safely.

No business-data snapshot, backup table, copy of customer data or persistent helper
is needed. Retain the source-only definition, metadata/dependency results and their
hashes locally before future execution. A NOTICE saying pending COMMIT is not
commit proof. Verify from the independent backend that the corrected hash, unchanged
metadata/ACL/dependencies/companion fingerprints and disabled gate are visible.
Leave all external writers stopped; do not use a successful source replacement as
permission to enable runtime or perform synthetic writes in existing DEV.

## Non-destructive recovery

**Before COMMIT:** on any error stop the client and issue `ROLLBACK;` in the same
backend. Replacement and all locks roll back together. No business rows, audit chain,
grants or ownership require compensating changes. If the connection fails around
COMMIT, retain containment and resolve the outcome from the independent backend
using the frozen baseline/corrected hashes. Never rerun blindly. Automatic
transaction rollback on disconnect is not evidence of which COMMIT outcome occurred.

**After COMMIT:** first keep the existing maintenance hold and the database/source
gates disabled. Capture the independent verification or regression evidence. If
separately authorized, `RECOVERY.PROPOSED.sql` starts a new transaction, enforces the
same target/owner/gate/fence/provider/metadata guards, removes exactly the tested
guard at its single anchor and requires the full input/output definitions to match
the corrected/original MD5 and SHA-256 pins. Its single CREATE OR REPLACE restores that definition
without deleting data, rebuilding the schema or touching audit/grants/ownership.
Independently verify the restored baseline hash and preserved metadata afterwards.

This restores a **known-vulnerable source baseline**, so the recovery endpoint is
contained, disabled and **UNREPAIRED**. Runtime must remain disabled until a reviewed
forward repair passes its own required gates. Prefer maintaining the corrected
function under containment while investigating; do not restore merely for an
unrelated managed-auth failure. Never use historical SQL009's empty-scaffold teardown
as post-COMMIT recovery for a populated Registry.

If the database gate is enabled, writers cannot be stopped, the source differs from
the exact corrected baseline or provider privileges/triggers prevent recovery,
this script refuses to proceed. No safe SQL recovery is claimed in that state:
separate exact containment/provider-recovery authority is required. No speculative
REVOKE, UPDATE, schema teardown, process termination or permission escalation is
included in this package.

## Actual validation and limits

| Level | Evidence and result |
| --- | --- |
| STATIC, fresh continuation | Recovered three-RPC fingerprints, complete baseline/corrected SQL and procedural syntax, exact source insertion/reversal, header equality, new wrapper pins and provider-only read-only scope checked. Preservation and manifest evidence recorded separately. |
| Offline UNIT, reused | Previous 15/15 checks accepted for unchanged guard logic, anchor/command/recovery negative controls and core safeguards. Prior results remain immutable. |
| Offline UNIT, fresh continuation | Focused changed-source/wrapper/read-only tests and exact results in the new `validation.json`. No full security-suite rerun. |
| Parser/environment | Existing Windows `C:\Python314\python.exe`, Python 3.14, pglast 8.4 / PostgreSQL parser 18.4. No installation, database connection or network use by the tests. Parser success is not PostgreSQL 17 semantic, privilege or runtime execution. |
| DB RUNTIME, reused | Private isolated repo commit `0a7650afc43d2c8fb9a5a396a1c6111d8279ae2c`, run [39409742149](https://github.com/RiGi26/webzoka-h1g1-security-isolated/actions/runs/39409742149), PostgreSQL 17.11 / PostgREST 13.0.7: 26 PASS, baseline race reproduced, separate corrected race denied; synthetic evidence only. |
| New wrappers / exact installed-source candidate runtime | NOT_EXECUTED. Full normalized baseline/corrected bodies match the prior isolated original/corrected bodies, and guard bytes are unchanged. That establishes source reconciliation, not execution of the new SHA-pinned wrappers or exact mixed-ending definition in PostgreSQL 17. |
| Existing DEV / Production SQL | NOT_EXECUTED, including SELECT. No new managed-provider evidence collected. |
| Managed Auth, actual two-operator sessions, genuine Company×portal provenance, independent audit anchor/recovery | OPEN; unchanged by this narrow proposal. |
| Browser UAT | Not applicable: source-only backend proposal; no UI change, deployment or permitted runtime. |

Prior initial run `39409397442` failed on a synthetic token-expiry fixture. The final
run corrected that fixture and retained the one-second expiry/provider-clock-skew
case as OPEN; no security acceptance was waived. The existing successful runtime
does not prove installed-source byte parity beyond the Owner-accepted scope, live
Supabase revocation, two independent authenticated humans, provider DDL/recovery,
or overall H1.G1 readiness. No CI was repeated in this task.

Detailed fresh results and reproducible local test/preservation scripts are in:
`C:\Users\61140\AppData\Local\Temp\Codex\h1-g1-source-reconciliation-20261020\scratchpad\`.
See `source-reconciliation.json`, `validation.json`, `verify.py`,
`preservation-result.json` and `HANDOFF.md`. The previous five-file proposal and its
validation remain preserved in `original-review-files/` and the earlier
`h1-g1-dev-gate-correction-20261020\scratchpad\`; its missing-source statement is superseded here.
The existing isolated runtime's detailed evidence remains in the sibling
`h1-g1-runtime-execution-20261020\scratchpad\RUNTIME_EVIDENCE.json` and run log.
Existing worktrees are retained; no new worktree, dependency install, cleanup,
commit, publication, provider mutation, Notion update or billing action occurred.

## Provider references and next decision

PostgreSQL documents replacement ownership/permission retention and existing entity
references; other function properties still need preservation checks:
[PostgreSQL 17 CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html).
VOLATILE statement snapshots and request isolation explain why the isolation
precondition matters: [PostgreSQL volatility](https://www.postgresql.org/docs/17/xfunc-volatility.html),
[PostgREST 13 transactions](https://docs.postgrest.org/en/v13/references/transactions.html).
Provider connection choices do not prove the actual connection's permissions or
identity: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres),
[Supabase roles](https://supabase.com/docs/guides/database/postgres/roles).

## Exact bounded next authorization request

The existing JSON already records the prior DEV project/principal verification and
three source fingerprints at `2026-10-20T11:52:01.857Z`. The earlier accepted narrow
catalog/privilege PASS is reused. Neither needs another full inventory or source export.
The genuinely missing or execution-time observations are:

- Actual maintenance hold and drained privileged writers/DDL actors, with Owner
  attestation covering scheduled/manual callers and gate/provenance custodians.
  Activity/fence observations supplement that hold; they cannot establish it alone.
- Current database singleton disabled state, competing transactions/fence users and
  actual caller isolation. Only isolation-specific role/database settings are read;
  other role settings and secrets are excluded. Direct callers' explicit isolation
  choices require operational/caller evidence, not inference from defaults.
- Applicability of current provider DDL event triggers; current code stops on any
  applicable enabled trigger. Metadata/handler fingerprints identify any required
  further source review. Do not disable a trigger or presume provider compatibility.
- Existing primary/recovery connection identity and continuity, current owner/schema/
  language/BYPASSRLS authority and exact function ACL/dependency snapshot needed for
  retention comparison. Catalog authority observations are not a live DDL/recovery test.
- A fingerprint-only drift check before a future approved correction, and independent
  post-COMMIT hash/metadata/ACL/dependency/gate verification after any such correction.
  Post-COMMIT evidence is necessarily NOT_EXECUTED until a separately approved write.

**Requested Owner authorization, not granted or executed here:**

> Authorize only PHASE 1 (the first complete transaction) of the current hash-manifested
> `VERIFY.READ_ONLY.PROPOSED.sql`, once on an existing primary Owner connection to
> webzoka-core-dev (`mcvekinhgcqygfddyifs`). Do not run PHASE 2.
> Permit only its explicit read-only transaction, local session settings and SELECTs
> over connection identity, the exact mutation's ownership/ACL/dependency metadata,
> private settings singleton, system activity/locks/prepared transactions,
> isolation-only role settings, and applicable event-trigger metadata/handler hashes.
> On an independently existing recovery connection, permit only the first two
> identity/capability SELECTs under the same read-only transaction/session bounds;
> repeat the identity SELECT on each persistent connection as needed to establish
> stable, distinct backend PIDs while both connections remain open. Collect
> out-of-band endpoint/maintenance-hold/caller-isolation evidence without changing
> hosting, jobs, settings, roles or credentials. No source export, business/customer
> rows, RPC execution, DML, DDL, explicit table/row/advisory locking, session termination, privileged
> escalation, paid connectivity or code application. Stop on missing continuity,
> unknown target, contention, drift, unsuitable isolation, absent hold or applicable
> provider trigger requiring review.

No post-COMMIT execution is requested under this read-only preflight authority;
that verification belongs to a separate exact write-and-verification approval.
The mutation's reviewed hashes are checked inside the proposed correction transaction;
PHASE 1 does not repeat Registry source hashing or export. PHASE 2 supplies future
outcome fingerprints, and PHASE 1's metadata/gate observations can be repeated after
COMMIT only under that future approval. Nothing in this file executes now.
This one next decision closes only provider observations, not managed Auth or overall
H1.G1 security acceptance. Stop after the local handoff; no automatic next task follows.
