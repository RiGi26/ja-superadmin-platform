# H1.G1 managed PostgreSQL 17 runtime and recovery resolution

STATUS: BLOCKED_ZERO_COST_RUNTIME_ENVIRONMENT

LOCAL DESIGN / STATIC / SCRIPTED UNIT ONLY. Every SQL statement in this package is
NOT_EXECUTED. H1.G1 OPEN; E1 DISABLED; H2 SSO NOT_STARTED. This document and its
hashes provide no execution authority.

## Baseline and preservation

Owner SOP dated 15 October 2026 authorizes this local package and focused offline
validation only. Repository: RiGi26/ja-superadmin-platform. Reused worktree:
`D:/Project/Website JapanArena/JapanArena SaaS/.wt-customer-hub-core`; branch
`feat/h1-g1-e1-core-static`; HEAD and freshly checked GitHub main:
`8a9ae5e7d61b706c3bd87f5516d759560876bad5`. PR47 is OPEN/DRAFT/unmerged at
`cd9fe1e9b1a1a4c4ede55f15f16a9ef00d7b215d`; relevant PR46/48/49/50 remain
OPEN/DRAFT. No Git publication is authorized.

The accepted combined patch is SHA-256
`cf12f05902b6454826763ba033e782d37ab95c9244c6a42fbb34946eb4d07e8d`.
All twenty accepted source paths, including eleven H1/W1/PG17 paths, matched
their accepted manifest before changes. All starting files remain byte-identical;
this package adds files only. Full preservation evidence, source copies, complete
and incremental patches, checksums and logs accompany FINAL_HANDOFF.

The existing 001_registry.PROPOSED.sql, 002_writer.PROPOSED.sql,
003_catalog_checks.READ_ONLY.sql and 004_recovery.PROPOSED.sql are preserved.
They are review references and are NOT submitted by this runner. Their
unconditional installer/recovery/identity/provenance/First Owner/codec guards
remain unchanged. Existing RUNTIME_PACKAGE.md and RUNTIME_APPROVAL_PROPOSAL.md
are historical preserved proposals; this contract supplies the narrower probe
envelope. No full-scaffold installer revision or guard removal is proposed.

## Verified mechanism investigation and one conditional path

Selected conditional design: **one direct TLS node-postgres Client connected to
the existing DEV PostgreSQL backend**, with one explicit transaction and terminal
ROLLBACK. Independent before/after observers use separate fresh connections;
they never execute transactional mutations. This is a documented mechanism,
not a currently verified usable environment or selected runtime PASS.

| Existing mechanism inspected | Evidence and disposition |
|---|---|
| psql on current PATH | Absent; no installation performed |
| Existing worktree Node resolution | pg, postgres and pgsql-parser absent |
| Codex Node REPL resolution | pg and postgres absent |
| Existing Python | pglast available; psycopg, psycopg2 and pg8000 absent |
| User-global Node inventory | No standalone PostgreSQL client package; transitive packages in unrelated applications were not borrowed or assumed supported |
| Supabase app project metadata | Read-only list_projects attempt rejected: non-empty link_id required; no provider connection established |
| Portal-specific MCP servers | Wrong project scope; not called |
| SQL Editor, repeated execute_sql, Management API batches | No evidenced affinity/transaction/error contract in this session; not selected |
| CI | Explicitly prohibited; no jobs created or run |

Existing Node is sufficient to host a portable client, but the client, verified
DEV connection, TLS trust and network reachability are not currently established.
No credentials, .env files or production connections were inspected. The supplied
DEV inventory (Free, ACTIVE_HEALTHY, PG17.11, no application tables/migrations) is
inherited Owner evidence, not a fresh provider or SQL observation.

The sole proposed direct endpoint is `db.mcvekinhgcqygfddyifs.supabase.co:5432`,
database `postgres`, principal `postgres`. This is a documented endpoint pattern,
not a claim that the endpoint has been authenticated or reached. Provider Connect
metadata must independently confirm that exact binding. Free direct connectivity
requires working IPv6; reachability was not tested. No paid IPv4 add-on, alternate
pooler, proxy, local database, system tool or new cloud resource is authorized.
If direct access is unavailable, STOP; do not silently switch mechanisms.

Registry metadata inspected without downloading/installing packages proposes
`pg@8.23.1`; tarball integrity:
`sha512-aL96AHANtWjPLDOLqnhx+ngp9+UK7ETEU8VJrDCGvsSSi/mGLcWYsS6Herg7lmaBJe4uwrfqsa7gTEFaSizDoQ==`.
Transitive dependency lock/integrities are NOT_AVAILABLE until separately
authorized task-local acquisition. No dependency or app lockfile was changed.

**One practical remedy:** Owner separately authorizes a disposable task-local
`pg@8.23.1` dependency acquisition, locked dependency review, and securely supplies
the existing isolated DEV direct connection for this exact conditional envelope.
This involves no workstation-level installation. Before any SQL, confirm zero
incremental cost, IPv6, provider binding, TLS trust, isolated synthetic use and
the exact reviewed dependency lock. Failure of any prerequisite means no SQL.

## PostgreSQL 17 authority findings

PG17 automatically grants a non-superuser creator membership in the created role
through the bootstrap superuser, with ADMIN TRUE, SET FALSE and INHERIT FALSE.
The creator cannot modify or revoke that bootstrap grant. ADMIN lets its holder
issue another grant to obtain SET/INHERIT; therefore false defaults prevent
accidents, not a durable administrator security boundary. NOINHERIT on a role
does not erase explicit membership options. CREATEROLE and BYPASSRLS do not imply
superuser rights or access to provider-internal supabase_admin.

001 correctly separates automatic creator ADMIN from its postgres-issued
ADMIN FALSE / INHERIT FALSE / SET TRUE grant. 002 revokes only the latter with
GRANTED BY postgres RESTRICT. Its final zero-delegation assertion still rejects
the automatic ADMIN record, and all unconditional refusals remain. Grantor,
ADMIN, SET and INHERIT must be examined separately; one membership row cannot
stand in for effective role reachability. Ownership transfer requires SET to the
new owner and its CREATE privilege on the containing schema. Provider-specific
behavior remains unverified.

The existing writer uses a distinct NOLOGIN/NOBYPASSRLS owner, SECURITY DEFINER,
empty search_path, row_security=on and FORCE RLS tables. Object default grants
come from the creating principal and are not reset by ownership transfer.
Effective PUBLIC/inherited/column/function/schema rights must be checked;
service_role BYPASSRLS is no substitute for denied ACLs. No provider-wide default
ACL changes are permitted. No real identity/session authority is supplied by
these role mechanics, OAuth login or a caller field.

004 remains an early/final-refused, empty-scaffold, rollback-only counterfactual.
It is not a recovery implementation after a commit. Its owner/dependency order
does not prove a usable principal, complete row visibility under FORCE RLS,
provider-supported membership control or safe data retention. No DROP OWNED,
REASSIGN OWNED, CASCADE, self-revocation assumption or provider-superuser access
is introduced. Permanent installation and physical role recovery remain
REVIEW_REQUIRED_MANAGED_PG17_INSTALLER_AND_RECOVERY.

## Exact bounded probe

| Proposed artifact | Scope |
|---|---|
| capability.PROPOSED.sql | One BEGIN; bounded local timeouts; prerequisite refusal; four restricted roles; creator grant observation/assertion; self-issued SET-only grant; isolated empty ownership/ACL fixture; refusal-only invocation; own-grant revoke; remaining ADMIN observation/assertion; mandatory ROLLBACK |
| inventory.READ_ONLY.sql | One catalog SELECT for before/after roles, memberships, schema/relations/owners/ACL/RLS, functions, default ACLs, shared dependencies and lingering primary sessions; no customer/Auth rows |
| runner.PROPOSED.mjs | Fixed-source hash checking, phase scheduling, one direct Client, stable pid/xid assertions, same-client failure rollback, close, fresh independent residual observation; no CLI/driver import/environment reads/auto-connect |
| runner.offline.test.mjs | Scripted clients exclusively; no database enforcement or real TLS/connection test |
| REVIEW_HASHES.json | Exact proposed SQL and runner hashes; content identity, not signature or approval |

Only these role names may be created: wz_h1g1_r17_registry,
wz_h1g1_r17_audit, wz_h1g1_r17_writer and wz_h1g1_r17_executor. All are NOLOGIN,
NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS.
Only schema wz_h1g1_r17, two empty UUID-primary-key tables registry_probe and
audit_probe (including their PK indexes), and function refuse() may be created.
The schema stays owned by postgres; table owners are the registry/audit probe
roles, definer owner is the writer probe role. No sequences, policies, application
functions, Company tables, real writer calls, Auth references/identities, customer
fixtures or DML statements are included. This intentionally tests capabilities,
not the complete candidate schema or positive W1 behavior.

Temporary grants affect only probe roles, probe schema/tables/function and the
existing postgres creator's grantor-specific membership. Executor receives only
schema USAGE and refusal-function EXECUTE. Two tables have ENABLE/FORCE RLS and
no positive policy. Public/customer/service table/column/function rights and
ambient probe-schema CREATE are checked. The retained automatic ADMIN record
is expected to be observed, never accepted as permanent role closure.

## Runner and failure contract

The future invocation injects the reviewed `pg.Client` constructor and secure
in-memory password/CA, exact REVIEW_HASHES sql/inventory/runner fields and an
independently verified human authority record. Those record booleans are audit
inputs, NOT proof generated by SQL or authorization derived from caller claims.
No connection URL/options override is accepted: host, port, database, user,
application_name and TLS servername are fixed; certificate verification is
required. Do not persist or print configuration, driver errors, passwords or
tokens. A dependency acquisition does not itself authorize rehearsal execution.

1. Validate exact hashes, approved binding/isolation/cost/private API exclusion
   and configuration before constructing a client. Obtain fresh provider evidence
   and review enabled event triggers/extensions for unbounded external effects;
   unknown/unreviewed hooks block execution. No customer-dependent DEV is allowed.
2. Fresh observer authenticates, checks PG17/UTF8/postgres/TLS and captures one
   catalog snapshot. Conflicting probe/candidate roles or active primary sessions
   deny before a mutating connection. SQL preconditions independently deny
   conflicting schemas/Company tables and insufficient CREATEROLE/database CREATE.
3. Construct exactly one primary direct Client. Authenticate and check principal,
   database, server generation, encoding, TLS, pid and backend_start. There is no
   pool, retry, automatic reconnect, migration wrapper or cross-client write.
4. Send BEGIN once, require BEGIN acknowledgement, allocate/capture xid on that
   same backend, then set statement_timeout=10s, lock_timeout=2s,
   idle_in_transaction_session_timeout=30s and transaction_timeout=90s locally.
   Capture stable pid/xid after every successful phase before the next phase.
   A different xid or pid aborts; no later mutation is attempted.
5. Execute only fixed reviewed phases sequentially. Their multiple statements
   are submitted to that same Client without parameters. Phase markers are fixed
   reviewed boundaries, not a generic SQL splitter. Unexpected errors abort the
   entire transaction. The sole expected 42501 refusal is caught in a PL/pgSQL
   exception subtransaction and its exact message checked; any other denial or
   unexpected success fails. No broad continue-on-error or retry is used.
6. Require explicit ROLLBACK acknowledgement. On any failure after BEGIN was
   attempted, attempt ROLLBACK only on that original client, then close it. Never
   replace a lost client to continue/rollback its transaction. No COMMIT path exists.
7. Fresh observer authenticates independently after primary close and runs the
   same inventory. Require exact before/after catalog equality and no primary
   sessions. Any observation failure/delta/lingering backend remains unresolved;
   no automatic DROP/REVOKE/cleanup or provider session termination is authorized.

Graceful interruption is checked before connection and each phase; an in-flight
statement must finish/error before sequential rollback. Its server timeout bounds
execution. Abrupt process death/network loss cannot guarantee client-side cleanup
or immediate server disconnect detection. PG17 idle/transaction timeouts and
backend termination normally abort an uncommitted transaction, but managed
behavior must be observed. A future operator may rerun only the approved read-only
inventory after timeout if a backend remains; no mutation retry. Missing rollback
acknowledgement always returns FAIL_CLOSED even if later catalog delta is zero.
Network blackholes can still delay client completion; no bounded wall-clock
success guarantee is claimed from the model. Further execution requires resolved
residual evidence, not optimistic timeout assumptions.

Zero residue means the named catalog/ACL/session scope returns to its before
state. It does not mean transaction/OID counters, WAL, provider logs, usage metrics
or monitoring timestamps are reversed. The inventory does not inspect migration
history rows or arbitrary external-hook side effects; reviewed zero-hook side
effects and absence of migration tooling are mandatory execution prerequisites.

If a commit is observed or any persistent residue survives, STOP with containment
failure. The current package cannot repair it. Preserve sanitized metadata and
request exact provider-supported recovery authority. No post-COMMIT recovery PASS
or durable role installation follows from a successful rollback probe.

## Security decision compatibility

Fresh read-only DEC-2026-029 review confirms the 14 October amendment: E1 creator
eligibility applies only to independently proven new/clean creation. E2/E3 legacy,
existing, contested or recovery claims require two distinct current independently
authorized authenticated operators; UNKNOWN remains HOLD. Google email equality
and OAuth login supply no Company Owner or new privileged authority.
CORE_COMPANY_RUNTIME_ENABLED=false stays literal and unchanged. No First Owner,
Company provisioning or W1 write is enabled. Missing trusted session/auth proof,
revocation, authoritative history/fences and Node/PG codec equality stay
REVIEW_REQUIRED. Google OAuth UAT/managed cleanup are inherited accepted history;
none is reopened or rerun.

The Control Tower's published full-text governance page is still labeled WG-1.1;
its own later notes acknowledge the WG-1.2 provenance discrepancy. This package
enforces the stricter supplied WG-1.2/WF-1.0 task restrictions plus WG-1.1 safety
and installed OpenSpec Lite/Reuse First execution rules. No protection is removed
and this local task does not amend governance or update Notion.

## Future exact Owner authorization envelope — PREPARED, NOT APPROVED

Purpose: one isolated rollback-only PG17 capability/negative rehearsal of the
exact probe files and runner identified by REVIEW_HASHES.json and final evidence
manifest. Review the complete local patch; hashes identify bytes, not approval.

- Target only webzoka-core-dev, mcvekinhgcqygfddyifs, database postgres, exact
  direct endpoint above; expected inherited server PG17.11, fresh PG17 check.
- Permit task-local pinned pg@8.23.1 acquisition and exact dependency-lock review
  in disposable scratch only, with no app dependency/system configuration changes.
  No SQL until that lock, zero cost, IPv6, provider binding, private schema exclusion,
  hooks, TLS trust, principal and isolation prerequisites are positively evidenced.
- Existing postgres principal only; non-superuser CREATEROLE, database CREATE,
  needed catalog visibility, ability to delegate SET/transfer own probe objects.
  Existing BYPASSRLS is not granted anew or used as application authorization.
  No new login, supabase_admin access, password reset or production credential.
- Authorize only the four exact probe roles, schema, two empty tables/PK indexes,
  refusal-only function and temporary grants/settings above, all inside one explicit
  transaction ending ROLLBACK. No guarded 001/002/004 execution or modification.
- Allow only exact catalog metadata before/during/after and sanitized runner evidence.
  No Auth/customer/billing/session-row reads or writes, migrations, E1/First Owner,
  activation, CI, Git publication, deployments, payment or H2 SSO.
- Record source hashes, dependency lock/integrities, provider/principal/TLS binding,
  backend_start/pid/xid chain, actual grantors/options/effective reachability,
  table owners/RLS/ACLs, precise expected refusal, rollback acknowledgement,
  primary close and independent before/after equality. Any required missing result
  blocks acceptance. Preserve errors by safe code/stage, never secrets.
- Wrong target, unexpected role/schema, new customer dependency, unknown hooks,
  lost affinity, hidden transaction end, unexpected privileges, SQL error, signal,
  timeout, observer failure, residue or cost requirement means STOP/rollback/close
  as specified; no mutation continuation, retry, cleanup or alternate venue.
- Unsupported after any probe PASS: full candidate install, permanent membership
  closure/recovery, managed session revocation, positive W1/Auth/codec integration,
  clean source history, application UAT and Production readiness.

ONE next Owner action: approve or decline the narrowly scoped portable-client and
DEV direct-connection remedy together with this exact conditional probe envelope.
No blanket database-write authority is requested. Until separately approved and
all prerequisites verified, the runner has no installed driver/access and every
SQL status remains NOT_EXECUTED. STOP after FINAL_HANDOFF.

## Primary references inspected 15 October 2026

- [PG17 role attributes](https://www.postgresql.org/docs/17/role-attributes.html)
- [PG17 GRANT](https://www.postgresql.org/docs/17/sql-grant.html)
- [PG17 ROLLBACK](https://www.postgresql.org/docs/17/sql-rollback.html)
- [PG17 client defaults and timeouts](https://www.postgresql.org/docs/17/runtime-config-client.html)
- [PG17 protocol flow](https://www.postgresql.org/docs/17/protocol-flow.html)
- [node-postgres transactions](https://node-postgres.com/features/transactions)
- [node-postgres TLS](https://node-postgres.com/features/ssl)
- [node-postgres Client API](https://node-postgres.com/apis/client)
- [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [pg package metadata](https://registry.npmjs.org/pg/latest)
- [DEC-2026-029](https://app.notion.com/p/3f7f69eadca08195ab4ec15100bdfa4d)
- [Published governance full text](https://app.notion.com/p/3f3f69eadca081b0b117e7c16584b62d)

Supabase changelog.md fetch failed; no changelog completeness claimed. No provider
API feature is implemented. Connection documentation and actual future provider
binding remain required independently.
