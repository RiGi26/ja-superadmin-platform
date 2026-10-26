# H1.G1 canonical DEV Registry and W1 installation contract

STATUS: REVIEW_REQUIRED_W1_INSTALLATION_GRANTOR_AUTHORITY

One guarded local source package for `RiGi26/ja-superadmin-platform`, existing `.wt-customer-hub-core`, branch `feat/h1-g1-e1-core-static`, starting HEAD `8a9ae5e7d61b706c3bd87f5516d759560876bad5`. H1.G1 OPEN; `CORE_COMPANY_RUNTIME_ENABLED=false`; E1 DISABLED; H2 NOT_STARTED. No provider execution, login creation, live admission, deployment, payment or customer-data change is authorized. Offline verification grants no installation authority.

## Exact sources and dependencies

`INSTALLATION_MANIFEST.sha256` records exact byte hashes relative to the repository root, including this contract, candidate/recovery SQL, tests, server preparation source and protected inputs. It excludes itself to avoid a circular hash; the handoff hashes the manifest and complete patch separately. The focused test validates every manifest entry against actual bytes. SQL005 remains `4d13c94d25c49b7a878ba50dc3852323b745e7e623fb38e2d053d687f3a9c19c`. The contract before this revision was `ab905297d1e8b7fc85094e8e729f12babc8835d7e1969d8c8dcbcd3c61548fda`; original bytes remain in session evidence.

| Source | Exact relationship |
| --- | --- |
| Local `001_registry.PROPOSED.sql` | Preserved semantic input. All three canonical table definitions, constraints and indexes copied exactly into 006; ownership/grant ordering corrected there. Do not run or concatenate local 001. |
| `005_w1_transport.DO_NOT_APPLY.sql` | Preserved accepted input. Private-schema section and complete stores/Auth/functions section copied verbatim into 006. Never run as a second installer. |
| `006_registry_w1_installation.DO_NOT_APPLY.sql` | Single combined forward-only clean-DEV proposal. One transaction, unconditional initial refusal, exact phases below, final membership/recovery refusal and ROLLBACK. No includes or external SQL execution dependency. |
| `007_registry_w1_recovery.DO_NOT_APPLY.sql` | Independent empty, unadmitted scaffold recovery proposal. Separate transaction, unconditional refusal and terminal ROLLBACK. |
| `lib/core-w1.ts`, existing test | Preserved server observation/codec/fixed-call preparation. No SQL driver, execution callback, public RPC or application wiring. Preparation remains `executionAuthorized=false`, `authority=NOT_ESTABLISHED`. |
| `lib/core-w1-installation.test.mjs` | Offline assembly, dependency, source-preservation and recovery checks with in-memory negative controls. No SQL parser, database, network or Auth execution. |
| Historical GitHub `001_core_schema.sql`, PR47 `020_company_registry_forward.sql`, protected local 002/004 | Excluded immutable references, not runnable DEV inputs. No legacy tenants FK, old writer, claim, audit or recovery installer is included. |

PR47 remains OPEN/DRAFT, head `cd9fe1e9b1a1a4c4ede55f15f16a9ef00d7b215d`. The local proposed Registry owner is to be created, not an already installed provider owner. Historical GitHub 001 is a different file. Existing refusals remain intact. No environment toggle, bulk guard stripping or concatenation makes the proposals executable. Any future executable revision requires separate exact-hash review of guard/transaction changes; these originals remain DO_NOT_APPLY.

Only intended future target: isolated Free DEV `webzoka-core-dev`, ref `mcvekinhgcqygfddyifs`, origin `https://mcvekinhgcqygfddyifs.supabase.co`. Production Core `hxhusfkrlafxdnyasmsu` excluded. SQL cannot prove project ref/organization; independent provider identity evidence must precede any connection. No workstation runtime/tool/dependency installation is authorized.

## Ordered installation contract

All operations are PROPOSED / NOT_EXECUTED. Initial refusal prevents even proposed catalog preflight. One direct verified PG17 UTF8 backend, READ COMMITTED, statement timeout 5s, lock timeout 1s; no fragmented autocommit, ignored warnings or privilege escalation after failure.

1. **Phase 0 — existing authority and clean baseline.** Require session/effective postgres, database CREATE and CREATEROLE. Reject any `wz_core_*`/`wz_w1_*` role, either private schema, or any relation kind with a canonical table name. Require anon/authenticated/service_role. Actual public owner must be pg_database_owner; auth schema/users/sessions owner must be supabase_auth_admin, both with existing permitted SET paths. Mismatch or unavailable authority stops. Neither provider-owner membership nor an alternate grant path is created.
2. **Phase 1 — canonical owner and pre-DDL grants.** Set transaction-local `createrole_self_grant=''`. Create only wz_core_registry_owner for the base. Manual proposed tuple: target Registry owner, member/grantor postgres, ADMIN FALSE / INHERIT FALSE / SET TRUE. As public owner grant USAGE + temporary CREATE; as Auth owner grant auth USAGE + users REFERENCES(id). Explicit SET LOCAL ROLE Registry owner before creating three tables/indexes. ENABLE/FORCE RLS, revoke PUBLIC/client/service table/composite privileges, no writer policy. Public owner revokes Registry CREATE immediately afterward.
3. **Phase 2 — W1 roles and canonical REFERENCES.** Create six W1 NOLOGIN roles with the same proposed manual installer tuple options. Public owner grants public USAGE only to store/issuer/consumer owners. Registry owner grants store REFERENCES(id) on companies/memberships, and issuer/consumer owners SELECT, composite-type USAGE and two internal SELECT policies. Grants precede private schema/tables. Check effective public CREATE absent, SET usable, plpgsql and built-in type USAGE present. Missing prerequisites stop; no global default privilege change.
4. **Phase 3a — private storage.** Create wz_w1_private AUTHORIZATION store owner. Select store owner for schema ACL, four tables, indexes, row-type ACLs, table grants and policies. All ENABLE/FORCE RLS. No seed rows. Disputed/unverified defaults remain restrictive.
5. **Phase 3b — managed Auth.** Recheck exact owners and existing SET. Auth owner grants auth USAGE and only users SELECT `(id,email_confirmed_at,is_anonymous,banned_until,deleted_at)`, sessions SELECT `(id,user_id,not_after)` to session owner. No Auth write, lock, policy, ownership or setting change. ACLs do not prove managed RLS visibility/profile; that requires independent evidence before admission.
6. **Phase 3c — functions and EXECUTE.** Store owner grants temporary private CREATE to one function owner at a time. Selected creator owns its function, revokes EXECUTE from PUBLIC/anon/authenticated/service_role/both execution groups, then grants exact callers. Store owner immediately revokes temporary CREATE. Store-owned invoker helpers need no extra CREATE grant. No ALTER OWNER or schema-wide postgres revoke. Empty search_path and row_security=on remain.
7. **Phase 4 — closure then protected connections.** Verify actual owners, every ACL including columns/types/defaults, seven FORCE-RLS tables and no temporary CREATE. Resolve complete memberships and independent post-COMMIT recovery before changing final refusal. Candidate creates no login or connection and grants no live admission. Protected connections are the last gated dependency below.

No Company, membership, portal, legacy tenant, invoice, subscription, claim, audit or Auth record is copied. No sequence is created. Canonical constraints preserve one active membership per identity even for inactive Company, all-history membership identity and Company×product reservation, RESTRICT FKs and retirement timestamps. External IDs must be NULL, mapping unmapped, lifecycle reserved. Revocation/retirement never grants clean-history E1 eligibility. The dormant base supplies no Company writer or S3 business audit; E1 remains disabled.

## Object / role / grantor matrix

All seven new roles: NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, NOREPLICATION. Role attributes do not replace per-membership options. Application credentials never own objects or receive membership in owner/provider roles.

| Object / principal | Actual proposed creator / owner | Exact grantor / privilege / closure |
| --- | --- | --- |
| Existing public schema | Must be pg_database_owner | That owner grants Registry USAGE/temporary CREATE and store/issuer/consumer public USAGE. Registry CREATE revoked after tables; effective inherited/PUBLIC CREATE must also be absent. No provider ownership/global ACL change. |
| wz_core_registry_owner | New role created by postgres | Proposed manual postgres-granted SET tuple plus all actual automatic tuples requiring proof. Owns three canonical tables/indexes/row types/constraints and two internal read policies. No old E1 writer/audit/executor role. |
| public.companies | Registry selected before CREATE | Registry grants store REFERENCES(id), issuer/consumer owners SELECT and row-type USAGE. FORCE RLS; internal SELECT policy only. No customer/service write policy. |
| public.company_memberships | Registry selected before CREATE | Auth owner grants Registry auth USAGE and users REFERENCES(id) before DDL. Registry grants store REFERENCES(id), issuer/consumer owners SELECT/type USAGE. Company/Auth FKs, identity and partial active-user unique constraints retained. |
| public.company_portal_instances | Registry selected before CREATE | Same-owner Company FK. No W1 caller grant. FORCE RLS, no policy, all-history Company×product unique, external mapping disabled. |
| Canonical indexes / row types | Registry owner | Four explicit indexes: company_memberships_active_user_uniq, company_memberships_company_user_idx, company_memberships_core_auth_user_idx, company_portal_instances_company_idx. Five implicit primary/unique indexes. Row-type PUBLIC/client/service USAGE revoked. Actual generated names must come from catalog, not assumed truncation. |
| wz_w1_private / wz_w1_store_owner | Schema AUTHORIZATION store owner; explicit store-owner table/helper creation | Store owner grants USAGE to three function owners/two execution groups. Temporary CREATE only to each non-schema function owner during its phase. PUBLIC/client/service schema/table/type access revoked. Store-owner CREATE is intrinsic; execution groups receive none. |
| provider_contract | Store owner | SELECT and row-type USAGE to session/issuer/consumer owners. FORCE RLS read policy. No seed writer; independently attested singleton revision/profile/expiry; proposed assertion ceiling 1–60s, no approved default value. |
| company_authority | Store owner | Issuer/consumer owners SELECT + locking UPDATE + row-type USAGE. Canonical REFERENCES above. FORCE RLS; UPDATE WITH CHECK(false) prevents authority editing. Disputed=true / writers_verified=false defaults; no legitimate source currently seeded. |
| assertions | Store owner | Issuer owner SELECT/INSERT, consumer owner SELECT/consume UPDATE; consumer row-type USAGE. FORCE RLS, nonce unique, no execution-group access or raw token storage. |
| receipts | Store owner | Consumer owner SELECT/INSERT/type USAGE only. FORCE RLS; no UPDATE/DELETE/TRUNCATE. Unique first assertion and idempotency tuple. Security receipt is not S3 business audit. |
| Private indexes | Store owner | w1_authority_company_idx, w1_assertion_subject_idx and eight implicit primary/unique indexes. Nineteen indexes total across seven tables, six explicitly named. No standalone sequence. |
| verify_session(uuid,uuid,bigint) / wz_w1_session_owner | Session owner, temporary private CREATE | Actual function owner grants EXECUTE only issuer/consumer owners. SECURITY DEFINER; Auth column SELECT only. Missing visibility/profile denies; no bypass fallback. |
| check_binding(uuid,uuid,uuid,text,uuid,text,text) | Store owner | Actual owner grants EXECUTE only issuer/consumer owners. SECURITY INVOKER, no extra owner authority. |
| lock_company_authority(uuid,uuid,text) | Store owner | Actual owner grants EXECUTE only issuer/consumer owners. SECURITY INVOKER using caller locking/SELECT rights; current canonical Company/membership checks. |
| issue_assertion(uuid,uuid,bigint,uuid,text,uuid,text,text) / wz_w1_issuer_owner | Issuer owner, temporary private CREATE | Actual owner grants EXECUTE only wz_w1_issuer. SECURITY DEFINER, fixed issuer session_user. No Auth/Company DML, consumer or receipt authority. |
| consume_assertion(uuid,uuid,uuid,bigint,uuid,text,uuid,text,text) / wz_w1_consumer_owner | Consumer owner, temporary private CREATE | Actual owner grants EXECUTE only wz_w1_consumer. SECURITY DEFINER, fixed consumer session_user. Receipt INSERT + assertion UPDATE in caller transaction, no business mutation. |
| Existing auth schema/users/sessions | Must be supabase_auth_admin | Owner grants auth USAGE to Registry/session owners, users REFERENCES(id) to Registry, two exact column SELECT grants to session owner. Existing provider-approved SET path required. No membership workaround, broad SELECT, policy, Auth write/lock or ownership change. |
| wz_w1_issuer / wz_w1_consumer | New NOLOGIN execution groups | Matching outer-function EXECUTE and private schema USAGE only; no object ownership, table/Auth/type access or CREATE. Future login memberships gated below. |

Explicit PG17 SET with INHERIT FALSE / SET TRUE selects the creator/grantor. Ownership, REFERENCES and EXECUTE are separate rights: [SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html), [GRANT](https://www.postgresql.org/docs/17/sql-grant.html), [CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html). Existing provider superuser/BYPASSRLS authority remains outside ordinary FORCE-RLS confinement; no new bypass role is proposed: [row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## Preflight evidence / precise STOP conditions

Current provider facts remain NOT_VERIFIED. A prior metadata call was blocked before execution. Do not retry, reframe or route around that block. Use owner-supplied safe metadata export or a separately approved provider channel; no customer/Auth rows or secrets.

| Evidence required before executable revision | Acceptance / STOP |
| --- | --- |
| Target/isolation | Current ref, provider organization, PG17/UTF8, Free capacity, zero incremental cost, no customer data/unknown resource owner. Missing independent proof: STOP. |
| Public schema authority | pg_namespace.nspowner/nspacl, role names, existing postgres→pg_database_owner SET path, actual owner-led USAGE/CREATE capability. Owner mismatch, warning-only grant or absent path: REVIEW_REQUIRED_W1_PUBLIC_SCHEMA_GRANTOR. |
| Clean absence | All wz_core_/wz_w1_ roles, target namespaces/relation kinds, relevant dependent jobs/defaults/exposure. Any existing target: REVIEW_REQUIRED_W1_CLEAN_DEV_BASELINE. No IF NOT EXISTS adoption. |
| Auth authority | Actual auth/users/sessions owners; nspacl/relacl/attacl, exact column types and referenced uniqueness; existing permitted supabase_auth_admin SET and approval for narrow USAGE/REFERENCES/SELECT. Otherwise REVIEW_REQUIRED_W1_MANAGED_AUTH_GRANTOR. BYPASSRLS supplies neither ACL nor grant option. |
| Auth visibility/profile | RLS flags/policies/reachable roles plus synthetic real session-owner visibility and negative checks. ACL or metadata alone cannot prove it. No bypass/policy repair permitted. Unknown profile/visibility: STOP before connection/admission. |
| Every membership tuple | pg_auth_members roleid/member/grantor/admin_option/inherit_option/set_option for new roles and all reachable installer/provider/recovery paths, pg_roles OID/name/attributes, effective direct/indirect ADMIN/SET/INHERIT graph. Count-only or one-grantor assumption: STOP. |
| Every object privilege | relowner/relacl, attacl, nspowner/nspacl, proowner/proacl/prosecdef/proconfig, type owners/typacl, language lanacl, creator pg_default_acl, policies, pg_depend/pg_shdepend and Data API schema exposure. Unexpected owner/grant/inherited CREATE/PUBLIC EXECUTE/private RPC: STOP. |
| Independent recovery | Separate authenticated provider-admin route after installer disconnection/COMMIT; all owner SET, CREATEROLE + ADMIN on seven roles, provider ACL revocation, full row and cluster-dependency visibility. Actual approved post-COMMIT empty-scaffold recovery + independent no-residue comparison required. Otherwise REVIEW_REQUIRED_W1_INDEPENDENT_RECOVERY_AUTHORITY. |

Reused real DEV probe proved one transient NOLOGIN owner/schema/table, FORCE RLS, explicit SET and same-backend rollback, with independent absence of those exact probe identifiers. It reported membership COUNT=2 without full tuples/grantors/options. It did not prove canonical ownership, Auth grants/visibility, seven-role closure, five functions or independent post-COMMIT recovery. Do not repeat that probe or invent its tuple contents.

## Membership and protected connection closure

For each of seven NOLOGIN roles, proposed manual installer tuple is member/grantor postgres, ADMIN FALSE / INHERIT FALSE / SET TRUE. Transaction-local createrole_self_grant='' precedes creation. PG17 automatic creator ADMIN records and other effective paths must be observed; the manual grant does not erase another grantor's tuple. COUNT=2 identifies no options or safe revoke path.

Before durable installation, record all grantors/dependent grants and prove recovery without removable installer SET grants. No such path is known. Do not revoke only the postgres-granted tuple and claim closure. 006 therefore retains final hard refusal, with no invented durable GRANTED BY cleanup. A later reviewed revision must contain exact retained/revoked tuples and commands from actual evidence; COMMIT remains prohibited until then.

Protected connection identities must be exactly wz_w1_issuer_login and wz_w1_consumer_login because functions check session_user. Each: NOSUPERUSER/NOBYPASSRLS/NOCREATEROLE/NOCREATEDB/NOREPLICATION, no ownership, only matching execution-group membership ADMIN FALSE / INHERIT TRUE / SET FALSE. No reachable SET/ADMIN/INHERIT path to an owner/provider/service/other execution group. Include PUBLIC/database defaults in effective-access checks.

Later exact membership form: `GRANT wz_w1_issuer TO wz_w1_issuer_login WITH ADMIN FALSE, INHERIT TRUE, SET FALSE GRANTED BY <verified grantor>` and analogous consumer. The actual grantor must be supplied in a new reviewed source revision, not fabricated now. Login creation/auth method, database CONNECT owner/grantor, protected credential location, TLS and exact driver/runner remain unselected/unverified. No dependency installation or driver wiring occurs here.

Require direct authentication as each login, TLS server verification, parameterized calls, one pinned backend/transaction, READ COMMITTED, bounded timeouts, no public RPC and no browser/log secrets. SET ROLE from a generic postgres connection preserves wrong session_user and fails. Any pooler must prove session_user/transaction compatibility. Connections remain absent; live W1 admission closed.

## Rollback-only rehearsal / synthetic acceptance

No rehearsal authorized now. Future executable revision must identify exact input/output hashes and reviewed guard changes, retain originals, end ROLLBACK and use one verified backend. Capture complete initial metadata. Create only named objects/roles, inspect intermediate owner/ACL/grantor invariants, and stop on any error/warning. ROLLBACK on original backend; on disconnect independently determine outcome before retry. Restore exact pre-existing ACL/membership/dependency snapshot, not only missing table names. Never run local 001/002/004/005 or historical 020 as additional steps.

| Later synthetic scenario | Required acceptance |
| --- | --- |
| Canonical identity | Duplicate active identity, second Company×product including retired history, external mapping, invalid status/times and orphan FK reject; revoked history cannot grant E1 eligibility. |
| Actual ACL/RLS | Client/service roles deny private functions/tables; issuer cannot consume; consumer cannot issue; groups cannot read Auth, alter schema or SET/ADMIN owner. Seven actual owners/FORCE flags and five function owners/modes/exact EXECUTE verified. |
| Managed session | Confirmed nonanonymous synthetic subject/matching live session only; wrong subject/session, unconfirmed, banned/deleted, expired JWT/not_after, removed session, unsupported/expired contract deny. Supported Auth API only if separately approved; no Auth INSERT. |
| Canonical authority | A/C1 and B/C2, owner/admin/member, no/revoked membership, inactive Company, disputed/stale/unverified provenance and changed revisions checked without real customer/billing/proof records. |
| Binding/replay | Exact Node/PG codec vectors; cross-Company/session/payload/key/operation mismatch denies with no writes. Consumed assertion denies; fresh currently bound assertion alone may recover matching receipt. |
| Atomicity/concurrency | Two real-principal connections: one consume/receipt, duplicate serialization, failure rollback, expiry/revocation/role changes during wait and final rechecks. No global instantaneous-revocation promise. |
| Cleanup/recovery | Same-backend rollback restores snapshot. Independent post-COMMIT empty-scaffold recovery separately approved/tested. Auth API effects require supported API cleanup and independent zero-residue proof. |

Fixture permission must name generated IDs/fields/custodian, temporary scoped policies/grantors, private fixture manifest and cleanup before seeding Company/membership/provider contract/provenance. Candidate has no seed writer or false verified flag. No FORCE-RLS disabling, service bypass or documentary proof shortcut. Empty stores prove denial only. No fixture exists from this task.

Only supported independently attested profile: no_timebox_inactivity_single_session_or_low_aal_timeout; other/unknown settings deny. Row existence alone cannot certify provider limits: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions). Consumer rechecks managed session and current canonical authority after waits, binds revisions/actor/session/Company/operation/key/scope/digest, and records receipt+consume atomically in caller transaction. Auth is read-only. Changes after final checkpoint cannot undo commit; propagation/isolation/concurrency remain untested. Security receipt is not a future capability or S3 audit. E1 creation and W01–W15 participating-writer provenance remain closed.

## Independent post-COMMIT recovery / cleanup

007 supplies concrete conditional empty-scaffold recovery, not proof of available authority. Its separate provider-admin session must authenticate independently as postgres after install disconnection and membership cleanup, with existing BYPASSRLS for reliable emptiness, CREATEROLE + ADMIN on seven roles, all owner/provider SET paths and complete dependency visibility. These are required capabilities, not new grants or facts. If unavailable, STOP before COMMIT; no invented superuser/Auth-owner membership.

1. Initial refusal; then check seven role attributes/SET/ADMIN, provider owners, seven FORCE-RLS tables and absence of either future login name. Drift or admitted connection requires separate recovery.
2. Outer function owners revoke matching group EXECUTE. Actual table owners take NOWAIT ACCESS EXCLUSIVE locks on all seven tables. They grant temporary SELECT/private schema USAGE to existing postgres inside recovery transaction. Existing verified BYPASSRLS supplies full visibility, but does not itself supply table ACL. No new bypass or RLS change.
3. Check all seven tables for emptiness under that visible principal. Any Company/contract/authority/assertion/receipt history raises REVIEW_REQUIRED_W1_POPULATED_HISTORY_RECOVERY before DROP. ROLLBACK includes temporary grants/containment; no destructive fallback.
4. Drop five exact functions under actual owners; then receipts → assertions → authority → contract → empty private schema under store owner; portal instances → memberships → companies under Registry owner. Every object DROP uses RESTRICT. Unexpected dependency aborts; no CASCADE, DROP OWNED, REASSIGN OWNED, TRUNCATE or history deletion.
5. Auth owner revokes only new column SELECT, REFERENCES(id), schema USAGE. Public owner revokes only four new roles' USAGE/CREATE. All seven roles had to be absent before install, so no pre-existing grant is erased.
6. Independently proved role administrator drops seven exact new roles after objects/external ACLs. PG17 DROP ROLE requires CREATEROLE + ADMIN and automatically removes memberships involving removed roles, including grantor-specific tuples. Do not manually revoke bootstrap creator ADMIN. Cluster-wide residual dependencies must be absent: [DROP ROLE](https://www.postgresql.org/docs/17/sql-droprole.html).
7. Current source ends ROLLBACK. Later durable recovery revision must separately define COMMIT and independent observer comparison against complete pre-install role/object/ACL/membership/dependency snapshot. Never claim cleanup from partial visibility.

For populated/admitted installation, preserve all history. Stop admission through protected connection control plane and revoke exact outer EXECUTE as owners in a separately approved containment transaction. Existing-session termination/drain needs explicit authority; 007 does not terminate sessions. Retention/correction/erasure decisions and exact forward repair require separate review; empty-scaffold deletion is not populated-data recovery.

Auth API fixtures do not roll back with SQL. After only approved synthetic FK dependencies are removed via reviewed fixture cleanup, use supported API sign-out/deletion and independently verify zero fixture/session residue. Neither SQL proposal mutates Auth rows.

## Verified / unverified / exact remaining authority

Locally verified claims have fresh logs in final handoff: accepted SQL005 hash, preserved starting 500-file baseline, main/PR47 refs, canonical DDL/full W1 section reuse, source owner/grantor ordering, refusals and conditional recovery inventory. Historical unaffected Core/blank/E1 evidence is reused at its original boundary, not added to fresh counts.

NOT_VERIFIED / NOT_EXECUTED: current provider identity/isolation/owners/grantors, managed Auth visibility/profile, full membership graph, effective ACLs, exact connection/runner, SQL parsing/runtime, constraints/RLS behavior, concurrency, full rollback and post-COMMIT recovery. Non-UI source-only task: browser/UAT skipped; no UI changed and runtime prohibited. No provider SQL/DDL/DML/Auth, commit/push/PR/CI/Preview/deploy, dependency installation or Notion write.

Four material conditions keep REVIEW_REQUIRED_W1_INSTALLATION_GRANTOR_AUTHORITY:

- Existing authorized public-owner SET/grant path, including ability to grant Registry CREATE then revoke it; canonical role is proposed, not installed.
- Approved actual Auth owner path for auth USAGE, users REFERENCES(id), exact users/sessions column SELECT and real session-owner row visibility; no owner-membership workaround.
- Complete automatic/manual grantor membership tuples/dependencies for seven roles and exact safe retained/revoked operations. Historical COUNT=2 insufficient.
- Named independent recovery route satisfying 007 after COMMIT and installer removal, with tested post-COMMIT empty recovery and independent no-residue evidence. No recovery availability assumed.

Before any provider execution, exact Owner permission must cover reviewed executable hashes, DEV ref, observed owner/grantor/member matrix, named DDL/ACL/membership mutations, one rollback-only rehearsal, independent recovery-test COMMIT boundary/observer, timeouts and zero-cost ceiling. Any synthetic Auth API fixture, Company/authority seed, protected login/credential/driver operation needs explicit named permission in that bounded approval. No current permission to install/COMMIT/admit W1.

**ONE next Owner decision:** accept an independently reviewable safe metadata/recovery-authority package through an approved provider channel or owner-supplied export for these four conditions, then assess this exact candidate before considering an executable revision. Do not execute it, repeat prior probe or start another generic review. STOP after handoff. H1.G1 OPEN; E1 DISABLED; H2 NOT_STARTED.
