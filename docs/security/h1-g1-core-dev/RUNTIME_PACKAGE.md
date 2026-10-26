# H1.G1 PG17 installation and recovery contract

SOURCE ONLY / DO NOT APPLY. Local edits and static/unit tests only. H1.G1 OPEN; E1 DISABLED. No managed SQL/Auth execution, CI, publication or activation is authorized. The [security decision matrix](SECURITY_DECISION_MATRIX.md) is part of this one package.

## Exact source and inherited DEV evidence

Repository `RiGi26/ja-superadmin-platform`; branch `feat/h1-g1-e1-core-static`; reused worktree `.wt-customer-hub-core`; unchanged HEAD/main `8a9ae5e7d61b706c3bd87f5516d759560876bad5`. Accepted complete patch SHA-256 `73ff0ef1a11afd69bd520068fa08b3bc9a0781edd4cf98e63181f0d5d530b0b7` is preserved. Current edits are uncommitted, outside migration discovery. PR46â€“50 remain independent OPEN/DRAFT artifacts; none is deployed integration evidence.

Owner supplied independently observed baseline for **webzoka-core-dev**, `mcvekinhgcqygfddyifs`, exact origin `https://mcvekinhgcqygfddyifs.supabase.co`:

| Observed fact | Limit |
|---|---|
| ACTIVE_HEALTHY, Free, PostgreSQL 17.11, UTF8 | Inherited provider evidence, not re-queried in this local-only task; quotas/connectivity still need fresh execution-time confirmation |
| Zero candidate application tables, applied migrations and wz_core_% roles | Clean target metadata; no proof of clean customer/entity history |
| current_user=session_user=postgres; CREATEROLE TRUE, SUPERUSER FALSE, BYPASSRLS TRUE | Non-superuser capabilities; not proof of ownership transfer, role delegation, recovery or safe application authority |
| postgres CREATE on public and REFERENCES on auth.users | Necessary registry preconditions; not access to internal supabase_admin |
| public owned by pg_database_owner; auth.users/auth.sessions by supabase_auth_admin | Provider-owned boundaries must remain untouched |
| Broad public default ACL contexts grant anon/authenticated/service_role table/sequence/function rights | Explicit candidate-object revokes and effective inherited/PUBLIC/column checks required; do not alter provider-wide defaults |
| service_role BYPASSRLS | Forbidden shortcut; absence of table ACL is still required |
| pgrst.db_schemas NULL | Data API exposure UNKNOWN; NULL does not mean private |
| auth.sessions metadata exists | Current/revoked-session behavior NOT_VALIDATED |
| Owner transfer, temporary delegation, post-COMMIT recovery and SQL runner semantics | NOT_EXECUTED; mandatory blockers |

Production `hxhusfkrlafxdnyasmsu` and all portal projects are excluded. No existing Production .env, keys, customer exports, migrations or Auth identities may be reused in DEV. No provider access was attempted in this remediation.

## Local source and immutable codec provenance

`lib/core-company.ts` is server-only and unwired. `CORE_COMPANY_RUNTIME_ENABLED = false` remains literal. Public execution functions validate strict input then return disabled before Auth/DB access. Enabling environment variables or client fields cannot change it. Private Auth observations/WeakSet are unit policy observations, not a capability or proof of managed revocation. Membership match requires canonical subject/Company, one unambiguous active relation, active Company and Owner for Owner commands. All matching cases still block.

The denial-only First Owner screen never returns an E1 allow. Claimed legacy/disputed/history-positive input requires S1 hold with two operators; all zero/ambiguous/untrusted claims remain UNKNOWN. The candidate now uses `sourceRef:null` instead of inventing a creation UUID. It has no verified creation source or transport. The restricted executor always refuses; SQL independently refuses identity, clean provenance, First Owner and codec authority.

Exact pre-existing local dependency `lib/e1-workspace.ts` remains byte-identical, SHA-256 `ae8a6488844500683e45fcb7472c8b44127df43700a3c25da923f27aff0b86d4`. It is untracked (`??`), absent from the base/main tree; no source commit is fabricated. It is included in the complete patch. Original local E1 test source remains `01a1e62cbbdbdd9ebfc9f53b33df6fb57e3774cade36311b9f0378bf827d363c`; original static SQL remains preserved. The seven positive vectors and original negatives are frozen in `codec-vectors.json` with source hashes. The focused test imports only main dependencies and packaged files; the original broader E1 test remains preserved outside this patch.

Strict Node adapter: canonical hyphenated UUID strings, versions 1..8 and RFC variant, lowercase output; Unicode ECMAScript trim then NFC; 2..100 Unicode scalars; C0/C1 controls and lone surrogates rejected; UTF8 lowercase hex. Scope SHA-256 hashes `e1:v2:scope:<subject>:<key>`; payload SHA-256 hashes `e1:v2:payload:<subject>:<lowercase-hex-name>`. SQL explicitly lists the same 25 trim code points, NFC, character count, C0/C1 rejection and UTF8/hex/sha256 framing. SQL typed UUID accepts extra textual spellings before the function, so the strict string adapter is mandatory. PostgreSQL text cannot carry every invalid Node string/NUL/surrogate. Managed Unicode/version/locale equivalence is NOT_EXECUTED; the codec refusal remains.

## Deterministic installation proposal

| File | Role in one proposed package |
|---|---|
| 001_registry.PROPOSED.sql | ONE BEGIN, unconditional installer refusal before any DDL, capability checks, four restricted roles, private schema, three registry tables/indexes/FKs, owner transfer, ENABLE+FORCE RLS, exact ACL cleanup |
| 002_writer.PROPOSED.sql | Unconditional continuation refusal before any DDL; SAME backend/transaction: four refusal guards, audit/receipt tables and reciprocal FKs, eight writer policies, private atomic function, exact ACL revokes, temporary membership revocation, effective privilege assertions, unconditional final refusal, ONE terminal ROLLBACK; no COMMIT |
| 003_catalog_checks.READ_ONLY.sql | Proposed SELECT-only metadata inventory, including roles, ADMIN/INHERIT/SET/grantor, owners/RLS/ACL/default/column/sequence privileges, role reachability and object/shared dependencies; no customer/Auth/session/billing rows |
| 004_recovery.PROPOSED.sql | Independent guarded EMPTY-SCAFFOLD teardown proposal with explicit owner/dependency order; NOT a fixture deletion procedure and NOT a proven usable recovery path |

Never submit 001/002 separately, split statements into independent provider requests, auto-discover historical migrations, or replace conflicts with IF NOT EXISTS. A future reviewed runner must concatenate 001 + newline + 002 as one request to the exact DEV connection, use one stable backend/explicit transaction and stop on error. Verify backend/principal/transaction behavior before even a rollback rehearsal. Management tooling may wrap or split SQL; its behavior is not established by these text files. Current early refusal prevents intentional progression; continuing errors on the SAME transaction leaves it aborted. Never assume a runner that switches backends will preserve that protection. No current proposal can successfully install on a compliant runner.

### Ownership and PG17 permissions

Four roles are NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS. Registry owner owns private schema, three public registry tables and refusal functions. Audit owner owns event/receipt tables. Writer owner owns only the fixed SECURITY DEFINER writer. Executor has private schema USAGE and writer EXECUTE only; no table access, owner membership or CREATE. No login principal is created.

PG17 ADMIN permits membership administration; INHERIT permits automatic object privilege use; SET permits becoming a role. These are independent, including across different grantors. NOINHERIT is not a guarantee against an explicit INHERIT TRUE grant.

**Correction to earlier source assumptions:** PostgreSQL 17 documents an automatic creator membership, granted by the bootstrap superuser, with ADMIN TRUE / SET FALSE / INHERIT FALSE. A non-superuser creator cannot remove or modify that grant. Therefore the earlier "revoke all installer membership, then zero membership" claim is not a valid physical plan. The default creator ADMIN may permit the creator to issue new SET membership, so the earlier assertion that postgres necessarily loses every recovery capability is also unproven. Neither conclusion may be inferred without grantor-specific managed evidence. See [PG17 role attributes](https://www.postgresql.org/docs/17/role-attributes.html).

**One selected design: ROLLBACK_ONLY_ROLE_REHEARSAL.** There is no durable install path in this revision. Both install fragments keep unconditional refusals, and 002 ends with ROLLBACK rather than COMMIT. 004 also ends with ROLLBACK and remains an unexecutable counterfactual reference. There is no persistent creator grant or stranded owner if a separately approved rehearsal truly uses one transaction and rolls it back. This is a source safety choice, not a managed rollback PASS. Split/autocommit runners remain forbidden because a text ROLLBACK cannot undo work committed on another backend.

The proposed rehearsal clears optional `createrole_self_grant` options with SET LOCAL before CREATE ROLE, then explicitly grants only ADMIN FALSE / INHERIT FALSE / SET TRUE, GRANTED BY postgres, for the ownership operations. It revokes only that postgres-issued grant with GRANTED BY postgres RESTRICT; it does not pretend to revoke bootstrap-granted ADMIN. Required grantor and options must be observed on actual PG17. Final no-delegation assertions deliberately still deny residual creator ADMIN and are not expected to pass standard PG17. This exposes the durable design blocker instead of waiving closure. All roles and both kinds of memberships disappear only with verified transaction rollback. No default setting, persistent membership or provider configuration is changed now.

A non-superuser transferring a table must own it and be able to SET the target role; the new owner needs CREATE on its schema during transfer. Registry tables are proposed under postgres so auth.users REFERENCES is available, then transferred to registry owner while CREATE/SET is temporarily granted. Private tables/functions use exact owners through SET LOCAL ROLE; temporary schema CREATE is revoked. The writer remains a separate NOLOGIN/NOBYPASSRLS definer. See [PG17 ALTER TABLE ownership](https://www.postgresql.org/docs/17/sql-altertable.html). No legacy/Auth object ownership changes are proposed.

### ACL, RLS and escape assertions

Object default ACLs are determined by creating principal, not later ownership. Inspect global and public/private defaults for tables, sequences and functions; revoke broad privileges on each task-owned object immediately inside the same transaction, then check effective rights. Never ALTER DEFAULT PRIVILEGES globally or REVOKE on all public objects to fix this candidate. Current tables use UUID defaults, no sequences. Unexpected candidate-owned/dependent sequences mean drift and STOP. Full dependency inventory must catch names outside wz_core_% as well.

Final installer and writer checks inspect effective PUBLIC/inherited table and column ACLs, function EXECUTE for broad clients, ambient public CREATE and unexpected named/private sequences. Catalog checks enumerate all role edges/reachability; no implicit role attributes alone establish closure. Known candidate table owner/RLS/constraint/function assertions remain required at runtime. `service_role` must have zero candidate table/column rights despite BYPASSRLS. Executor cannot directly read/insert/update/delete/truncate/maintain/reference/trigger candidate tables, create schemas/functions or acquire writer/audit/registry/verifier authority. Writer SELECT/INSERT only on companies, memberships, events and receipts; no portal data or UPDATE/DELETE/TRUNCATE/MAINTAIN. Any PUBLIC CREATE inherited by an owner/executor is an unresolved provider ACL blocker, not justification for global mutations.

FORCE RLS applies to every registry/audit table, including ordinary owners. Writer is neither table owner nor BYPASSRLS, uses empty search_path and row_security=on. Policies target writer only; guards derive identity from the unimplemented trusted transport. Company INSERT WITH CHECK true is constrained by the nondelegated nonlogin definer's fixed insert path and independent authority guards; it is not a public insert policy. No positive customer read policy is installed. Definer owner privilege escape in either role direction denies. Current private schema is denied to PUBLIC/anon/authenticated/service_role, but effective schema access and actual provider Data API exposure must be verified independently. NULL pgrst.db_schemas is not sufficient.

Atomic writer locks the subject, rechecks subject/session/source after wait, compares actor/key and digest receipts, requires current active Owner/Company on replay, denies any membership history for new creation, then invokes independent provenance/First Owner guards before four inserts. Deferred event/receipt constraints are checked before return. No upsert, swallowed exception or internal COMMIT. Future W1 assertion consumption/current Auth/source revalidation still need implementation; source lock alone does not coordinate managed Auth or legacy writers.

## Recovery: selected fallback and blocked durable path

**REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY.** Current tools expose portal-specific Supabase servers but no tool scoped to DEV mcvekinhgcqygfddyifs. No portal was queried as a substitute, no credential/config file was searched, and no SQL was submitted. Owner-supplied DEV metadata remains inherited evidence. Current actual creator grantor/options, role-transfer behavior, runner backend/transaction semantics, and usable post-COMMIT recovery principal/method are NOT_VERIFIED.

The selected rollback-only design preserves the dedicated writer while prohibiting a durable scaffold. It does not choose retained creator ADMIN as approved permanent recovery authority. A later durable design must prove either provider removal/control of bootstrap-granted creator ADMIN and a usable authorized recovery method, or an explicitly approved restricted recovery authority model with verified management controls. No such alternate path is implemented or approved here. [Supabase role documentation](https://supabase.com/docs/guides/database/postgres/roles) describes supabase_admin as internal; its presence is not Owner access.

Pre-COMMIT recovery: stop on error and ROLLBACK the same backend; verify exact pre/post role/object/ACL/migration inventory. Current early refusals prevent reaching DDL; changing them for a capability rehearsal requires separate explicit authorization and reviewed exact source bytes. The terminal ROLLBACK must remain. PostgreSQL documents transaction rollback semantics, but provider runner behavior still requires evidence. See [PG17 ROLLBACK](https://www.postgresql.org/docs/17/sql-rollback.html).

Post-COMMIT recovery is **unsupported by this revision**: it never intentionally commits. If an unexpected commit occurs, stop; do not run 004 or infer cleanup rights. Preserve the metadata/error evidence and use the actual authorized provider recovery process, UNKNOWN_NOT_YET_RESOLVED. No post-COMMIT cleanup PASS is claimed. This is why a runner that splits the transaction is an absolute pre-execution blocker.

004 preserves a dependency-safe empty-scaffold teardown order for review, behind early/final refusals and terminal ROLLBACK: drop writer, registry/audit policies, both reciprocal FKs, receipts/events, portal/membership/Company tables, guard functions, then empty private schema; revoke task-owned public grants, then drop roles while actual ADMIN remains available. PG17 ADMIN and effective SET may come from different grantors; assertions now check them separately and require no effective INHERIT. [DROP ROLE](https://www.postgresql.org/docs/17/sql-droprole.html) requires CREATEROLE plus ADMIN for a non-superuser. Unexpected shared/default ACL/other-database dependencies mean STOP; never CASCADE, DROP OWNED or REASSIGN OWNED. Role memberships vanish with dropped roles. No provider/Auth object is dropped.

A future committed populated design cannot use empty-scaffold cleanup. FORCE RLS may hide rows from a table owner, and postgres BYPASSRLS without SELECT is not complete visibility. Verified emptiness requires a separately authorized principal with both complete visibility and SELECT. Audit/customer history may not be destroyed to make teardown succeed. No teardown, cleanup, principal or customer-row read is authorized now.

No managed Auth action rolls back with SQL. Future synthetic users/sessions require their own secure test-ID inventory and approved deletion, after removing explicitly authorized fixture FK dependencies. Append-only audit means ordinary callers cannot edit events; table owners/provider administrators can alter privileges/policies/data. It is not administrator-proof tamper evidence. Retention, correction/erasure and RESTRICT Auth-delete behavior require approved policy before real use. No safe fixture cleanup or recovery is claimed from static SQL.

## Missing evidence and one next action

Required evidence remains: actual temporary grant/SET/owner transfer/revoke semantics; one-backend runner; real post-revocation recovery lease/principal; complete default/effective/column/function/sequence ACL closure and private Data API exclusion; managed current/revoked session verification; trusted creation/classification/history sources and cross-writer fences; actual Nodeâ†”PG17 codec equality; isolated application connectivity and HTTP/browser UAT. All are NOT_EXECUTED or OPEN, not RUNTIME_READY.

Free managed DEV is the sole proposed venue for managed Auth/PG17 validation, contingent on proven isolation, recovery/connectivity and zero incremental cost. The accepted PostgreSQL synthetic CI run is not a substitute. No new local stack, CI workflow, branch, project or hosting is provisioned here. Source checks and unit evidence are in FINAL_HANDOFF.md and exact command logs; earlier 67/67 and E1 188/188 are historical preserved evidence, not the current test result.

The exact conditional future runtime approval request is [RUNTIME_APPROVAL_PROPOSAL.md](RUNTIME_APPROVAL_PROPOSAL.md): one rollback-only DEV capability/negative-validation objective, no Auth identities or customer data, no durable install. This document is not execution approval. Missing DEV access/runner evidence and reviewed rehearsal bytes must be supplied in that same objective before any mutation; no additional readiness task is requested.

Patch byte provenance requires command-scoped `git -c core.autocrlf=false apply` (and the same flag for reverse/check). This machine has system core.autocrlf=true, which changes LF bytes on application. No persistent Git setting was changed. The initial byte-check failure and corrected verification are preserved in the handoff evidence.

## Locally testable W1 contract refinement

The private strict `inspectW1Contract` checks exact DEV issuer/project/executor audience, subject/session/action/new-Company scope, assertion/nonce/key format, canonical v2 digests, session-state denial, freshness bounded by both observed token expiries, and mandatory complete coverage for all seven authoritative source domains before/after waits. History/conflict, unavailable coverage and changed revision/fence deny. E2/E3 use a separate S1 path; UNKNOWN never becomes E1. The schema's clean state means complete customer/entity coverage with the allowed current new-intent record explicitly reconciled, not an empty table or zero records. Mock strings are fixtures only; no live proof is created.

A structurally complete clean E1 mock still returns REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT. The candidate has no authenticated assertion issuer/store, consumption/replay ledger, DB connection or authoritative revocation/source check; no request can inject this private envelope. No positive database path is implemented. The earlier proposed 30-second TTL remains an unapproved design parameter, not an authority granted by local validation. Existing E1 bytes and seven frozen vectors remain unchanged.

Source identity is SHA-256 content-addressed in the complete patch manifest. No digital signature, signing key or Owner signoff is fabricated; source signing/approval remains a human governance requirement.
