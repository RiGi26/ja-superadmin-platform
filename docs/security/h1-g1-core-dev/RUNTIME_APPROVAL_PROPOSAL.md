# Conditional runtime approval packet: H1.G1 PG17 rollback-only capability validation

STATUS: BLOCKED_PENDING_DEV_ACCESS_AND_EXECUTABLE_REHEARSAL_APPROVAL

This is the one proposed future mutation envelope, not authorization to execute. Current source remains guarded. The exact current candidate hashes are in the handoff manifest; no unreviewed executable revision, credential or signature is invented.

## Target, principal and purpose

Only `webzoka-core-dev`, project `mcvekinhgcqygfddyifs`, expected PostgreSQL 17.11/UTF8, Free, ACTIVE_HEALTHY. Production `hxhusfkrlafxdnyasmsu` and every portal project are excluded. Confirm exact provider project binding outside SQL; current_database, UUIDs or GUCs cannot attest the project. No current DEV-scoped connector is available in this session; portal tools must not substitute. Do not search existing .env/token/password files or provision a new principal to gain access.

Purpose: validate the actual PG17 creator-grant/ownership/ACL/rollback capabilities and disabled-boundary negatives within one rollback-only transaction, using no customer or Auth fixtures. It does not claim a durable recovery method, managed Auth integration, clean-E1 evidence, application UAT or Production readiness. A retained creator ADMIN is not approved as permanent recovery authority.

Proposed principal: the existing authorized DEV SQL connection with `current_user=session_user=postgres`, inherited observed CREATEROLE TRUE, SUPERUSER FALSE, BYPASSRLS TRUE, public CREATE and auth.users REFERENCES. Reverify exact capabilities without credentials in logs. No supabase_admin access, new login, executor credential, role used by a customer, or separate connection is permitted. A real same-backend connection/runner and its secure availability are currently UNKNOWN_NOT_YET_RESOLVED.

## Exact proposed scope and expected effects

| Resource | Proposed temporary effects in a separately approved rehearsal | Durable effect allowed |
|---|---|---|
| Four names: wz_core_registry_owner, wz_core_writer_owner, wz_core_audit_owner, wz_core_executor | CREATE restricted NOLOGIN/NOBYPASSRLS roles; observe creator automatic ADMIN with actual grantor/options; explicit postgres-issued ADMIN FALSE/INHERIT FALSE/SET TRUE; exact GRANTED BY postgres RESTRICT revocation | NONE; all disappear with rollback |
| public schema task grants | Registry temporary CREATE/USAGE; writer/audit USAGE; exact scoped revokes | NONE; provider-wide defaults/ACLs must not change |
| public.companies, company_memberships, company_portal_instances | Empty tables, declared indexes/FKs/checks, exact ownership transfer, RLS/FORCE RLS and object ACLs from 001 | NONE; no customer or fixture rows inserted |
| wz_core_private | Schema; creation_events/creation_receipts, reciprocal deferred FKs; four refusal functions and bootstrap_company(text,uuid); eight writer-only policies and exact ACLs from 002 | NONE; no assertion store or issuer is installed |
| Session settings | SET LOCAL owner role, row-security/function settings and createrole_self_grant as proposed; metadata observations | NONE; no persistent Git/provider/Postgres configuration |
| Auth, billing, tenants, portals, source proofs | Zero users/sessions/tokens/customers/financial records read or changed; auth.users metadata/REFERENCES only | NONE |
| Migration history, CI, hosting, payment, E1 | No migration tool that records history; no workflow/deployment/configuration/activation | NONE |

The maximum empty scaffold is three public tables, two private tables, four roles, five private functions, eight policies plus the declared indexes/constraints. No DML fixtures, managed Auth Admin actions, emails, logins, provisioning or real customer history are included. Expected post-run inventory equals the exact before-run catalog/ACL/migration manifest.

## Source approval and transaction contract

Current 001, 002 and 004 contain unconditional installer/recovery refusals. The writer identity/provenance/First Owner/codec refusals and application false constant also remain unconditional. Executing current 001+002 can demonstrate early refusal only; it cannot validate CREATE/SET/ownership/ACL behavior. **Approval of the current hashes is not approval to bypass those guards.**

A capability run requires a separately reviewed rollback-rehearsal source revision in the SAME consolidated objective, with its full byte-level SQL and SHA-256 accepted before the first mutation. The exact proposed amendment scope is limited to installer-specific refusal blocks required to reach the empty-scaffold operations and explicit handling of expected creator-grant closure failure; no identity/First Owner/clean provenance/codec guard, runtime false constant or customer policy may change. The terminal ROLLBACK must remain; no COMMIT is permitted. The executable hash is NOT_YET_AVAILABLE because this local task must preserve the unconditional installation/recovery guards. It is a blocking field, not a placeholder approval. Current guarded source is the complete reviewable starting point.

Before that source can run, evidence must establish the selected runner submits the entire byte string on ONE backend in ONE explicit transaction, does not split/autocommit, does not wrap it in a separately committed migration and supports explicit rollback after an expected error. Use a secure existing DEV connection, verified TLS, exact backend identity and transaction semantics. Any unknown here prohibits mutation. Do not assume management SQL tools, dashboard batches or poolers satisfy it. No system installation or new infrastructure is permitted to obtain a runner.

Within the approved rehearsal: BEGIN exactly once, create roles and scaffold under their specified owners, inspect 003's catalog queries on that same transaction, exercise only approved disabled-function/role denial checks, then ROLLBACK exactly once. Expected statement errors require an explicitly reviewed SAVEPOINT/ROLLBACK TO protocol within the same backend; otherwise stop and roll back the entire transaction, without additional mutations or retrying an unrelated session. A final unconditional refusal is not a reason to ignore errors blindly.

The current 004 text is an independent counterfactual recovery review; it is not part of this rehearsal execution and cannot repair a committed install. No role or owner dependency is cleaned by CASCADE or broad DROP OWNED. An unexpected committed residue is a containment failure: stop, preserve sanitized metadata, and use only separately authorized provider recovery. A usable post-COMMIT recovery mechanism is still required before ANY future durable installation.

## Required validation matrix and acceptance

| Condition | Minimum actual evidence | Reject/stop |
|---|---|---|
| Exact venue/isolation/cost | Authenticated DEV project metadata, empty candidate roles/tables/migrations, synthetic-only/no customer dependency attestation, Free/quota confirmation | Wrong/unknown ref, customer dependency, paid requirement or nonempty conflicting object |
| Runner | Actual same-backend/transaction/rollback behavior, no migration-history entry | Splitting, hidden commits, unavailable explicit rollback or unknown behavior |
| PG17 role grants | All creator and explicit grantor rows/options observed; explicit SET, owner transfer and self-issued-grant revocation behave as signed source | Treating implicit bootstrap ADMIN as postgres-revocable or as approved permanent authority |
| Physical ownership and RLS | Expected owners; all five tables ENABLE/FORCE RLS; writer restricted/non-bypass; no role path to owners except approved temporary installer path | Any ambient role/schema CREATE/owner escape or bypass definer |
| Effective permissions | Table AND column rights, functions, default ACL contexts, schemas and all candidate dependencies; no sequences expected | Broad anon/authenticated/service_role/executor access; unexpected dependent sequence/object/default ACL |
| Private Data API | Provider exposure config independently verifies private schema exclusion; NULL pgrst.db_schemas stays UNKNOWN | Unknown/exposed private schema blocks security acceptance; do not change config under this packet |
| Denied execution | Current refusal functions deny; no Company/event/receipt rows created; role checks do not use a service key as a surrogate | Any positive bootstrap, fake JWT/GUC identity or changed First Owner guard |
| Rollback | Full post-rollback catalog/role/ACL/migration inventory matches pre-run; no task setting/membership/object residue | Any committed residue or unknown verification result; no cleanup claim |
| Durable recovery | NOT_EXECUTED and not accepted by rollback evidence | No RUNTIME_READY, durable recovery PASS or H1.G1 COMPLETE |

Managed Auth/session-revocation, trusted E1 source provenance, real operator adjudication, replay-store enforcement, positive writer concurrency/atomicity, Node-to-managed-SQL codec equality and application HTTP/browser UAT remain the integration acceptance matrix in SECURITY_DECISION_MATRIX.md. They are not silently authorized by this minimal capability packet; they require actual proof transport and a safe durable recovery design in the consolidated implementation scope. No fabricated source record or SQL GUC can substitute for managed identity.

## One Owner remedy and stop

Provide DEV-scoped provider access and authorize this one rollback-only capability/negative-validation envelope **only after its exact executable rehearsal revision and same-backend runner evidence are reviewable**. Complete those requirements inside the consolidated objective, not in new readiness tasks. Until then the packet is BLOCKED, source guards remain unconditional, external mutations are zero, H1.G1 OPEN and E1 DISABLED.
