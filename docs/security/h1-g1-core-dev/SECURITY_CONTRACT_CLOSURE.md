# H1.G1 Company identity security contract closure

15 October 2026. Local design and denial-only source candidate under the Owner's bounded task, WG-1.2/WF-1.0. This document supersedes earlier recommendations to repeat the synthetic rehearsal in this directory. It does not replace immutable SQL, accepted Google OAuth evidence, DEC-2026-029 or release governance.

## Disposition and exact blocker

**PERMANENT_ROLE_ARCHITECTURE: BLOCKED_PROVIDER_ADMIN_CLOSURE.** No compliant permanent installation/recovery architecture is established by available provider evidence. The selected disposition is to preserve the existing fail-closed Registry design, with no permanent installation. This is the task's explicitly permitted blocker outcome, not a claim that a permanent architecture was selected or proved impossible on every Supabase configuration.

**One precise blocker:** no evidenced, customer-usable, provider-supported authority can both contain the unavoidable creator ADMIN grants under the existing role restrictions and recover the dedicated owners after COMMIT and session/installer loss. The current `postgres` creator cannot remove the superuser-issued grants; access to their `supabase_admin` grantor is not available merely because it exists in the catalog. A supported recovery protocol and its authorized principal have not been supplied.

Retaining creator ADMIN as a new accepted security boundary would change the existing closure requirement. This task does not silently make that change. Password rotation, NOLOGIN, NOINHERIT, cleared SET options, a second login or a synthetic mock do not establish compliant containment. We also do not invent a provider superuser login, privileged SECURITY DEFINER escape hatch or service-role DDL access. The blocker concerns authority, not a need to repeat the completed network/TLS/password rehearsal.

**One next Owner action:** obtain a written Supabase support determination for this project's PG17 role-administration and post-COMMIT recovery contract: identify the supported executing principal, how automatic creator ADMIN can be contained without broadening the accepted restrictions, and how an authorized replacement operator regains dedicated-owner control after installer/session loss. No secrets or SQL execution are needed in that request. A negative provider answer is a decision input, not permission to relax guards.

## Reconciled authority and evidence

- Repository: `RiGi26/ja-superadmin-platform`; remote `main` and local task HEAD `8a9ae5e7d61b706c3bd87f5516d759560876bad5` at preflight.
- Reused worktree: `.wt-customer-hub-core`; branch `feat/h1-g1-e1-core-static`. Existing H1/W1/E1/Google edits are prior task deliverables, not new changes in this task. The prior rehearsal chat is idle and its final handoff ends with STOP; no concurrent active user of this worktree was identified in the current chat inventory. No new branch/worktree is created.
- DEV identity reference only: `webzoka-core-dev`, `mcvekinhgcqygfddyifs`. No provider runtime state was freshly queried in this task; current provider capabilities remain REVIEW_REQUIRED.
- [IAM Charter](https://app.notion.com/p/3f8f69eadca081419bfaca1dcb823c95), latest relevant 15 October authorization and scoped acceptance, and [Control Tower](https://app.notion.com/p/3eaf69eadca0817ba3aac1c4f54a4bde) reconcile this local task with H1.G1 OPEN, E1 DISABLED and H2 NOT_STARTED. The unrelated V3 pilot has a separate isolated-workstream exception; it supplies no authority over this source.
- [DEC-2026-029](https://app.notion.com/p/3f7f69eadca08195ab4ec15100bdfa4d), including its 14 October amendment: E1 exception only for independently proven clean new onboarding; E2/E3 require two distinct, currently authenticated, independently authorized operators; uncertainty/dispute holds.
- Reused result: `PASS_MANAGED_PG17_ROLLBACK_REHEARSAL_ONLY`. Twelve phases, explicit acknowledged ROLLBACK, independently corroborated zero residual, creator ADMIN retained until rollback; allowance USED 1/1. Charter accepts the original execution as Codex-attested and separately corroborates absence, not independent observation of the entire original transaction. The retained local final handoff and execution artifacts provide additional source evidence; this task does not rerun them.
- Reviewed official documentation: [PG17 role attributes](https://www.postgresql.org/docs/17/role-attributes.html), [PG17 GRANT](https://www.postgresql.org/docs/17/sql-grant.html), [Supabase roles](https://supabase.com/docs/guides/database/postgres/roles), [hosted superuser limits](https://supabase.com/docs/guides/database/postgres/roles-superuser), [Auth sessions](https://supabase.com/docs/guides/auth/sessions). Context7 Supabase documentation also consulted. These establish documented behavior, not project-specific recovery support.

## PostgreSQL authority and ownership contract

PG17 automatically grants a non-superuser role creator ADMIN through the bootstrap superuser, initially without SET/INHERIT. ADMIN can grant those options back. The creator cannot edit that bootstrap grant. This matches the accepted managed observation; revoking a separate postgres-issued grant does not remove it. [Engine reference](https://www.postgresql.org/docs/17/role-attributes.html).

The following is the preserved inert ownership design, not an installed layout:

| Principal/object | Required authority and boundary |
| --- | --- |
| Permanent role creator | NOT_APPROVED. Existing proposal uses `postgres`, with the ADMIN-closure blocker above. No customer-accessible `supabase_admin` execution is assumed. |
| `wz_core_registry_owner` | Restricted NOLOGIN/NOBYPASSRLS owner of private schema, Company/membership/portal tables and refusal helpers; no operator or customer identity. Existing managed `public` schema ownership is not transferred. |
| `wz_core_audit_owner` | Separate restricted owner of event/receipt tables; application authority limited to explicitly reviewed append/read operations. |
| `wz_core_writer_owner` | Separate restricted owner of private definer writer; fixed empty search path, qualified names, row security on, minimal table policies/grants; no blanket bypass. |
| `wz_core_executor` | Restricted NOLOGIN execution group; no table/Auth DML, ownership, CREATE or owner-role membership. A future dedicated login can only inherit its approved execute permission, ADMIN FALSE, SET FALSE. No login is provisioned here. |
| W1 verifier / assertion store | Not part of the four-role SQL. Future exact issuer/store owner, constrained issue function and narrow Auth/source access must be separately resolved within the same ownership/recovery policy before implementation. No generic service-role client. |
| Company Owner/Admin/Member | Application memberships, never PostgreSQL owner roles. No role administration, DDL, assertion issuance, privileged recovery, direct Registry/audit mutation or public writer RPC. Internal platform operators do not automatically own a customer Company. |

Supabase documents `postgres` as administrative but non-superuser, Dashboard SQL as `postgres`, and `supabase_admin` as internal. These do not prove an Owner-accessible provider recovery service. Its documented project-password reset can restore credentials, but does not establish the missing role-containment protocol. [Provider roles](https://supabase.com/docs/guides/database/postgres/roles), [superuser restrictions](https://supabase.com/docs/guides/database/postgres/roles-superuser).

### Required recovery behavior before any future installation

1. Identify a provider-supported durable recovery principal and all grantors/effective paths, including ADMIN, SET, INHERIT, default/column/sequence/function ACLs, ownership and shared dependencies. A grantor name is not a usable credential. Contain every administrative path without weakening accepted restrictions.
2. Establish authorized operator replacement and Owner-controlled access recovery independent of the original installer, workstation and connection. Document its authentication, authorization, audit and revocation. Losing the only operator must not strand owned objects or create a customer-accessible administrator.
3. If the session disappears before COMMIT, rely on confirmed transaction outcome, not presumed client success. If acknowledgment is lost around COMMIT, treat outcome as UNKNOWN: stop application writers, reconnect only through the separately authorized recovery path, inspect durable catalog/version/receipt evidence and decide a reviewed forward recovery. Never blindly replay install/teardown.
4. After COMMIT, ROLLBACK cannot undo the installation. Recover through the proven principal, quiesce connections, inventory dependencies/data, restore a consistent authorized owner/ACL graph or perform an approved forward repair. Do not run the empty-scaffold `004` teardown against populated Company/audit data. Preserve audit and customer records.
5. Revoking an operator/login does not revoke an object's owner. Transfer required object ownership and explicit dependencies to a verified successor before removing owner roles. Unknown dependencies, populated tables, unresolved grants or missing recovery authority stop revocation/teardown. No DROP OWNED, REASSIGN OWNED or CASCADE shortcut is selected.
6. Future proof must cover actual post-COMMIT recovery from a new independently authenticated connection, loss of installer/operator, grant revocation and ambiguous commit outcome. This requires separate exact authorization; all such runtime evidence is NOT_EXECUTED. Unit assertions in this task only prove preserved refusals and file integrity.

The existing 001/002/004 unconditional authority refusals, 002 final gate and terminal ROLLBACK remain byte-identical. Historical migrations remain untouched. No new SQL is supplied; all requirements above are inert prose outside migration directories. Application runtime remains `CORE_COMPANY_RUNTIME_ENABLED=false`.

## One W1 trust design

The sole retained transport design is **protected server-issued assertion records, consumed by a dedicated restricted executor through a private atomic writer**. It extends the existing E1 proposal to existing-Company Owner commands. This is a bounded implementation contract with explicit unimplemented provider dependencies, not an authenticated transport implementation.

`Verified Core identity → current managed session → canonical active Company membership → current Owner authorization → exact restricted command`

### Identity, session and Company binding

1. The server accepts a strict request describing an operation and optional Company selector. It obtains identity through the configured Core cookie client, verifies `getUser()` and signed claims, and checks exact project issuer, authenticated audience, subject, non-anonymous confirmed account, expiry and session ID. Client actor IDs, JWT custom role text, email/name matches and Google-login success cannot supply Company authority. Operator allowlists may deny customer entry, never grant ownership. Existing Google callbacks remain unchanged.
2. Current session verification is additional to JWT validation. A narrow provider-supported verifier must bind `auth.sessions.id` to the same subject/session and current account, plus actual timeout, refresh, not-after, disable/ban and revocation semantics. Session-row existence alone is insufficient for timeouts; Supabase cleanup is delayed. Provider access and exact field/version semantics remain REVIEW_REQUIRED. No raw Auth/session table access is granted to Company users or the executor. [Session behavior](https://supabase.com/docs/guides/auth/sessions).
3. Read canonical membership with authoritative completeness, not a client claim or an RLS-filtered first match. Exactly one eligible Company binding is required by this candidate; ambiguous, absent, revoked or historically unresolved bindings hold. Company must be active. Owner commands require `owner`; `admin` and `member` may match only the existing read policy shape, which still grants no runtime access. Membership replacement or Company mismatch denies. No membership or role is inferred from internal SuperAdmin or portal-local roles.
4. Existing-Company ownership provenance must be independently verified and versioned; unknown/disputed provenance holds even if a row says Owner. First assignment follows DEC-2026-029: proven-clean new E1 only, complete seven-source coverage and creation intent; E2/E3 use a separate dual-operator case command. Both reviewers must be distinct from each other and the requester, currently authenticated and independently authorized for the exact same evidence/action; revalidate both after waits. Two IDs, historical allowlists or previous approvals do not satisfy this. Current source grants no E1 or E2/E3 positive capability.

### Assertion, writer and revocation checkpoint

- The protected issuer binds issuer/project/audience, actor/session, exact Company, membership ID/revision, action, canonical idempotency key, request-scope and payload digests, assertion ID/nonce, issued/expiry times, provenance revision and serialization fence. Fixed function privileges establish authenticity; knowing fields or an assertion UUID does not. `owner_command` is a denial-only category, not an executable operation. A future command must define an exact allowlisted action and server/SQL canonical payload codec; no generic action dispatcher is authorized here.
- After every lock or queue wait, recheck current identity/session, eligible account, membership/status/role, Company/status, provenance revisions and participating-writer fences. Re-read after waiting rather than reusing a cached boolean. Changed authority denies, including revocation/downgrade followed by regrant through a different membership. A version/fence requires every relevant authority writer to participate; equality of fixture strings does not prove serialization.
- Bound assertion lifetime by token expiry and actual session validity at both observations; reject future, expired, swapped or incomplete observations. A maximum assertion TTL remains REVIEW_REQUIRED; the earlier 30-second proposal is not adopted as an approved parameter. Wall-clock observations and WeakSet identity are local consistency checks only.
- The private writer verifies the dedicated connection principal and protected assertion, locks/consumes the unused assertion/nonce and checks exact command binding. Mutation, receipt, assertion consumption and minimal append-only success audit must commit atomically; audit/constraint failure aborts all. Do not forward browser claims, trust a GUC, expose a public RPC or use blanket service-role DML.
- A consumed/revoked/expired assertion cannot authorize a new write. Exact idempotent retry needs new current authentication/authorization and a matching durable receipt; stale receipt/assertion is never a credential. Different payload, actor, Company, action or source decision denies. No assertion store or replay ledger exists locally; repeated valid-looking mocks are unconditionally blocked rather than falsely claiming a functioning replay consumer.
- Revocation effective before the final post-wait/pre-mutation checkpoint must deny, even with an unexpired access token. Revocation racing after that checkpoint is not claimed to cancel a committed operation. A stronger ordering guarantee requires a proved common serialization protocol with revocation writers; none is implemented. Current provider propagation and account/session invalidation need separate runtime verification.

### Audit and error contract

The future server boundary returns generic unauthenticated/forbidden responses for invalid identity or ownership, a non-disclosing HOLD/unavailable outcome for uncertain authority, and no other-Company details. Public static helpers currently return only typed refusal results with `company:null`, `writesPermitted:false`, and no database connection or secrets exposed. No new route/status mapping is installed.

Protected audit records minimal opaque correlation, actor/session reference, exact action/Company/membership revision, evidence/provenance digest, approval references where required, decision/reason, timestamp and commit receipt. Never persist JWTs, cookies, passwords, raw proof documents or unrelated personal data. Denied/held attempts need a separately restricted append-only security event channel because the rejected business transaction cannot retain its own audit row; if that required channel is unavailable, do not promote an operation to success. That channel, access/retention and real operator proof remain unimplemented. No real customer documentary intake is authorized.

## Local candidate and evidence limits

`lib/core-company.ts` adds private `inspectOwnerW1Contract` shape/consistency denials. The existing private membership lane supplies no envelope and remains blocked on managed-session proof; public helpers still return before Auth/DB calls. Tests expose private functions only inside the existing VM harness. Every complete mock ends at unconditional `REVIEW_REQUIRED_W1_IDENTITY_TRANSPORT`; no positive trusted capability exists.

Focused tests cover forged identity/issuer/audience, stale/revoked/unknown sessions and disabled accounts, Owner/Admin/Member separation, wrong/ambiguous/revoked/replaced membership, wrong Company, disputed/unknown provenance, revision/fence change, assertion replay state, payload/key binding and expiry. Existing E1 negatives cover unproven clean history, missing/conflicting sources and E2/E3 shortcuts. Recovery tests pin the four accepted SQL hashes and retain early/final refusals. These are static/unit mock evidence only, never real session, replay-store or PostgreSQL recovery proof.

| Remaining gate | Classification |
| --- | --- |
| Permanent creator ADMIN containment and durable recovery | BLOCKED_PROVIDER_ADMIN_CLOSURE; one provider-authority blocker above |
| Auth session verifier, safe narrow access, timeout/disable/revocation semantics | REVIEW_REQUIRED / runtime NOT_EXECUTED |
| Protected assertion issuer/store, exact command codec, replay consumption and restricted connection | REVIEW_REQUIRED / NOT_IMPLEMENTED |
| Complete E1/legacy/dispute provenance, independent E2/E3 operators and participating source fences | REVIEW_REQUIRED / NOT_IMPLEMENTED |
| Managed codec/ACL/RLS/atomicity/concurrency/revocation and post-COMMIT recovery | NOT_EXECUTED in this task; prior rollback evidence reused only for its accepted scope |
| HTTP/cookie UAT, desktop/mobile UAT, hosted runtime and release | NOT_EXECUTED; local non-UI contract only, application runtime expressly prohibited |
| Production, payments, portal changes, H2 | NOT_EXECUTED; outside authority |

H1.G1 remains OPEN. Conditional 18 October target supplies no release authority. No next milestone starts from this contract. Actual final hashes, focused command results, preservation comparison and task diff accompany `H1_G1_SECURITY_CONTRACT_FINAL_HANDOFF`.
