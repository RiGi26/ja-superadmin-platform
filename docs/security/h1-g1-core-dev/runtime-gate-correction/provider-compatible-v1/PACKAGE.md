# H1.G1 provider-compatible DEV correction and recovery candidates

Prepared 21 October 2026 (Asia/Jakarta). SOP WG-1.2 + WF-1.0 / V4;
IAM-2026-001 / H1.G1. Local preparation and offline validation only.

**CODE_READY: local candidate source and author checks. Independent review status:
see REVIEW.md. DEV execution: BLOCKED. New DB execution: NOT_EXECUTED.**
H1.G1 remains OPEN. Company runtime/E1 remain DISABLED. H2 remains NOT_STARTED.
These governance states do not claim a fresh observation of mutable DEV state.

## Delivery and scope

This directory is the revised package within the preserved
`runtime-gate-correction` evidence tree. The two adjacent SQL files are complete,
self-contained candidate transactions, not fragments to splice into a live session.
Neither is authorized for execution. Their exact hashes are in MANIFEST.sha256 and
the offline validation report. The parent frozen scripts must not be run instead.

| File | Purpose |
| --- | --- |
| PATCH.PROPOSED.sql | Forward correction; retain the accepted 165-byte post-lock runtime-disabled check. |
| RECOVERY.PROPOSED.sql | Separately authorized recovery to the exact known-vulnerable baseline, under continued containment. |
| OFFLINE_VALIDATION.json | Fresh parser/source/policy-model results and exact candidate hashes. |
| validate_offline.py | Reproducible offline validator; accepts private evidence paths and makes no provider/network calls. |
| REVIEW.md | Independent review status, findings and limitations. |
| MANIFEST.sha256 | Final file hashes and immutable reference hashes; does not include itself. |
| CANDIDATE.diff | Exact frozen-to-candidate source differences for both wrappers. |

Correction candidate SHA-256:
`448e5a2d9404fe001b718b342069f14b2b0794d42c2049b0934d97aa2355d36a`.
Recovery candidate SHA-256:
`e19b27713b93eb6da3d78c9f4eea6f75593d3e86edc698b803368c5c9aca4773`.
Independent static review completed with no actionable SQL findings; its limitations
and the final administrative changes outside that review are recorded in REVIEW.md.

These UTF-8 files are byte-sensitive. Local Git currently warns that LF may be
converted to CRLF on future Git operations. No staging/commit was performed; verify
the manifest after any transfer and stop if bytes differ. Do not silently normalize
the scripts or the mixed-ending accepted definition files.

The parent baseline/corrected definition files, frozen patch/recovery, Phase 1
proposal/evidence and prior runtime artifacts remain unchanged. Raw handler and
Phase 1 provider evidence remain private in session scratchpads; credentials,
connection URIs, account identifiers, session inventories and raw handler source
must not be published with a handoff.

## Starting source and safe directory

Repository: `RiGi26/ja-superadmin-platform`. GitHub default branch `main` was freshly
resolved to `8a9ae5e7d61b706c3bd87f5516d759560876bad5`, matching the accepted
source-reconciliation baseline. Local primary checkout is older and was not used
to infer missing code. Reused directory: `.wt-customer-hub-core`, branch
`feat/h1-g1-e1-core-static`, HEAD `5dcff3c3bab1d6aaccf6b315a47e9bbb6edb6f0a`.
The unpublished branch has no matching remote branch or open PR. Related open PRs
47/48 concern the static Registry scaffold and isolated harness; 49/50 concern HUB
UI; 46 concerns SSO opt-in. None is updated, merged or adopted as execution authority.

The two registered secondary worktrees and primary checkout are retained. No
worktree was created or destroyed, no dependencies were installed, and no branch,
index, commit, push, PR or CI state was changed. Existing related chats were idle or
not loaded; no running process using this worktree was observed except this task's
inspection shell. All 236 enumerated pre-existing tracked/untracked files were
hashed before preparation and remain byte-identical. Existing unrelated edits and
all frozen evidence are preserved. The only new worktree files are in this directory.
Cleanup is not authorized or attempted; all deliverables remain local and uncommitted.

## Exact incompatibility and narrow disposition

The frozen scripts stop when **any** enabled event trigger has NULL command tags
or includes `CREATE FUNCTION`. The accepted Phase 1 result contains two such rows.
That predicate does not distinguish their events, so it stops before replacement.

The revised guard compares the **entire original predicate's selected roster** to
the two accepted records. It pins names, events, enabled mode `O`, NULL tags, fully
qualified zero-argument handler identities and handler-definition MD5s. There is
no prefix, schema-wide, name-only or provider-role-wide exemption. An unknown
selected trigger, missing/disabled expected trigger, changed event/tags/mode,
changed handler identity or changed definition stops both correction and recovery.
Disabled unknown triggers and enabled triggers whose non-NULL tags exclude
`CREATE FUNCTION` remain outside the original predicate; neither can fire for this
command in the required origin mode. This does not approve their source generally.

For `pgrst_ddl_watch`, the event is `ddl_command_end` and installed definition MD5 is
`afaad7193dcf8f81e728d2bedb85e43e`. The accepted full-source inspection shows a
PL/pgSQL event-trigger handler that iterates DDL command records, filters command
tags and `pg_temp`, and issues only `NOTIFY pgrst, 'reload schema'` for this command.
It is SECURITY INVOKER (`prosecdef=false`), owned by `supabase_admin`, with an empty
function search_path. The candidate pins those observed properties and the SHA-256
computed offline from the retained complete definition:
`2b4b5d702ddf70fbd1a05c9825f9f9016d5c0ef97dd3df5f5b012ea23d9b94b1`.
The earlier `8d0f56a0...` approved hash identifies the inspection SQL, not the handler
definition; these digest scopes must not be interchanged.

For `pgrst_drop_watch`, accepted event `sql_drop` and MD5
`4357772baf5cfcd5c6d7049585b3a537` are pinned. The sole dynamically executed statement
is `CREATE OR REPLACE FUNCTION`; it does not issue DROP or change identity/signature.
The PostgreSQL 17 firing matrix specifies `CREATE FUNCTION` for DDL start/end, with
no `sql_drop` or table-rewrite event. This handler is retained as an exact observed,
non-applicable record; its body is not treated as inspected or broadly approved.

Both trigger owners and both handler owners must be `supabase_admin`. DDL-handler
ownership was observed; the two trigger owners and drop-handler owner were **not**
projected by the accepted Phase 1/handler inspection. These are stricter candidate
requirements, not invented provider facts. A mismatch stops before replacement.
They require a bounded metadata confirmation under future authority; no owner or
privilege change is proposed. `session_replication_role` must already be `origin`;
the script never changes it. Before/after snapshots compare the selected trigger
catalog rows, handler metadata and definition MD5s, catching persistent drift or
unexpected provider-side changes during the replacement.

References: [PostgreSQL 17 firing matrix](https://www.postgresql.org/docs/17/event-trigger-matrix.html),
[event-trigger behavior](https://www.postgresql.org/docs/17/event-trigger-definition.html),
[transactional NOTIFY](https://www.postgresql.org/docs/17/sql-notify.html), and
[Supabase provider implementation](https://github.com/supabase/postgres/blob/develop/migrations/schema-17.sql).
The installed-source pins, not a moving upstream branch, govern these candidates.

## Preserved correction, security and audit boundary

The candidate wrappers differ from their frozen parents only in their review-header
reference, provider declarations/guard and provider post-replacement assertions.
The accepted body addition is unchanged and follows the existing Registry advisory
fence before the authorization-expiry check and every business/audit write:

```sql
  IF NOT EXISTS (SELECT 1 FROM core_registry_private.settings WHERE singleton AND runtime_enabled) THEN
    RAISE EXCEPTION 'RUNTIME_DISABLED_AFTER_WAIT';
  END IF;
```

Baseline definition MD5/SHA-256 remain `8a03a9deaae8e64d86cdeb49c74be6b2` /
`9185872def4078ab4d16bb3545faa9d09476d91c959edae49065a4b1be49cd81`;
corrected definition MD5/SHA-256 remain `9b729d11fa7405b257e68c2901e86d54` /
`7ed7cf8d3d9a5299878ce1be948653e96667eede87b939002b376decf224577e`.
The exact mixed-ending source bytes, unique anchor, one insertion/reversal,
companion hashes, identity/defaults, SECURITY DEFINER, four function settings,
ownership, ACL restrictions, target metadata, dependency and comment comparisons,
disabled singleton check, fence/activity/prepared-transaction checks and bounded
transaction settings are unchanged. No audit/grant/role/RLS/table/trigger change,
new application dependency, business DML or runtime enablement is included.

## Actual validation and reused evidence

Fresh STATIC and offline UNIT policy-model checks: **17 checks, zero failures and
zero errors**, exit 0; details in OFFLINE_VALIDATION.json. Both complete transactions
and their DO bodies parse with existing Python 3.14.2 / pglast 8.4 (PostgreSQL parser
18.4). Parser success does not prove PostgreSQL 17 name/type binding, permissions,
NOTIFY delivery or managed execution. JSON-roster negative controls are offline
models tied to the SQL constants and checked predicate shape, not engine execution.
The observed two-record projection passes; source/identity/event/mode/tag drift,
unknown relevant records, missing records and handler-security/ownership negative
fixtures stop. Ownership fixtures are explicitly synthetic, not provider evidence.

The first validation run failed two **validator** assertions: source-position offsets
in AST comparison and an extra removed blank line in reverse derivation. Candidate
SQL was unchanged; the harness now ignores parser positions while preserving all
semantic fields, and reconstructs the original whitespace exactly. Failed report
is preserved privately. No failed SQL/runtime check is hidden by the passing run.

Reuse: accepted installed-source parity, complete Phase 1 capture, handler inspection,
frozen definition hashes, previous 15 focused checks and 12 source-reconciliation
checks; no broad audit or source export repeated. Accepted isolated run
[39409742149](https://github.com/RiGi26/webzoka-h1g1-security-isolated/actions/runs/39409742149),
commit `0a7650afc43d2c8fb9a5a396a1c6111d8279ae2c`, PostgreSQL 17.11 / PostgREST 13.0.7,
reported 26 PASS, reproduced the baseline race and denied the corrected race.
It applies to the unchanged body correction only, not these provider-aware wrappers.

INTEGRATION, new DB RUNTIME, DEV SQL/RPC/DDL/DML, BROWSER UAT, PRODUCTION, CI,
Preview and deployment: **NOT_EXECUTED**. Browser work is inapplicable to this
local SQL package. The existing DEV baseline remains unrepaired by this task.

To reproduce offline checks with retained private inputs, run existing Python and
`validate_offline.py --phase1 <private Phase 1 row JSON> --handler-result <private handler MCP JSON>
--preservation <private pre-edit hash inventory> --output <local result JSON>`.
Do not install a database or runtime to expand this validation level.

## Operational evidence checklist and outstanding dependencies

The following checklist is an execution gate for a future separately authorized
operation. It is not a request to repeat accepted Phase 1, export source again or
run any query now. Technical checks already completed are distinguished from facts
that only an operator/provider or the future transaction can establish.

| Gate | Completed technical evidence | Outstanding proof and smallest remedy |
| --- | --- | --- |
| Exact target and principal | Accepted DEV ref/source/Phase 1 identity evidence; this task used local files only. | Owner identifies existing approved Primary and recovery endpoints/principals; verify TLS/project and actual login/effective roles without exposing credentials. Do not infer cloud identity from database name/hash. |
| Provider triggers | Exact two-record projection and inspected DDL-handler source/security accepted; new guard/pins parse and pass offline models. | Under bounded future read-only authority, confirm only the missing event-trigger/drop-handler ownership and relevant state drift. Do not repeat handler export or full Phase 1. Candidate also refuses mismatch at execution. |
| Hidden scheduler/session visibility | Accepted Phase 1 has one NULL-state non-client scheduler row; other visible clients were idle. Original client-backend activity guard is preserved. | Provider/operator evidence must cover whether that scheduler and its jobs can write Registry state, mutate the gate/provenance or perform competing DDL, and prove their hold/drain or non-conflict. The client-only guard does not clear a hidden scheduler. Keep BLOCKED if this cannot be established; do not relax the guard, elevate privileges or terminate sessions. |
| Maintenance hold and drain (external attestation) | Fence, NOWAIT settings SHARE lock and visible activity/prepared/fence guards remain in both scripts. | Named operator attests all service-role/API callers, workers/jobs, direct SQL writers, gate/provenance custodians and function/privilege/role/trigger DDL actors are held; admitted calls and containing transactions drained. Evidence must cover provider/scheduler actors or an explicit provider-supported non-conflict assurance. Keep hold through independent outcome verification/recovery. Flags and momentary idle snapshots alone are insufficient. |
| Actual caller isolation (external/caller evidence) | Prior synthetic race evidence covers READ COMMITTED; scripts require their own READ COMMITTED transaction. | For every actual privileged caller, prove its transaction uses READ COMMITTED and custodians participate in the same fence. Empty/default isolation settings do not exclude explicit REPEATABLE READ/SERIALIZABLE. Stop if actual coverage is incomplete; no caller changes are authorized here. |
| Primary and recovery capability/continuity | Proposed owner/schema/language/BYPASSRLS checks retained; no new authority claimed. | Existing zero-cost persistent stop-on-error connection plus an independently open recovery connection, stable distinct backend PIDs, approved same target, metadata visibility and replacement/locking authority. Establish without buying connectivity, creating roles or relying on one-shot MCP calls/transaction pooling for session continuity. |
| Runtime disabled and exact input drift | Frozen source/config/ACL/companion guards and disabled-singleton check retained. | Under future authority, verify immediately before operation: source flag/E1 disabled, exactly one DB settings row disabled, correct principal/PG17/primary, source/ACL/ownership/config/dependencies and provider state unchanged. Any drift stops; never update pins to accept it. |
| Independent post-COMMIT verification | Expected baseline/corrected hashes and original metadata/dependency comparison format already prepared in parent VERIFY proposal. | Future authorization must include exact read-only independent-backend fingerprint/metadata/ACL/dependency/companion/provider/gate verification and complete result capture. A NOTICE or editor success alone cannot prove committed visibility. Keep writers held and gates disabled on failure or ambiguous outcome. |
| Independent candidate review and new runtime | Author STATIC/offline checks complete; accepted body runtime reused. | See REVIEW.md. Managed PG17 execution of new wrappers is NOT_EXECUTED. Any additional isolated rehearsal requires separate explicit compatible zero-cost environment/runtime authority; no installation, CI or new resource is included. |

External attestations are required facts, not SQL predicates to bypass. Candidate
catalog checks do not grant missing permissions, impose a maintenance hold, prove
all scheduler visibility or prevent an uncontained privileged DDL actor from racing
and restoring catalog state between observations. Missing operational proof keeps
DEV correction BLOCKED even when the roster model passes.

## Future impact, containment, recovery and STOP conditions

If separately authorized, the only persistent correction is replacing the exact
existing mutation body in one bounded transaction. Existing invocations cannot be
assumed to switch code; drain is mandatory. The standard provider DDL handler stays
enabled and queues a PostgREST schema-reload notification. Delivery occurs only on
successful COMMIT; this cache reload is a provider side effect requiring inclusion
in future execution scope, not Company runtime/E1 activation. A trigger or notification
queue error can abort the transaction or fail COMMIT; no notification-delivery PASS
is claimed. Preserve target/provider metadata evidence before and after the operation.

Before COMMIT, any guard/permission/timeout/lock/trigger error means stop and roll
back in the same verified backend. Never continue after an error or retry blindly.
If connectivity fails around COMMIT, retain all containment and use the independent
connection's frozen fingerprints to resolve the outcome before any next action.

After a confirmed COMMIT, keep runtime disabled and all callers held. Prefer retained
corrected source under containment while investigating unrelated failures. Only with
separate exact recovery authority may RECOVERY.PROPOSED.sql run on the verified
independent connection. It requires the exact corrected input and restores only the
original function definition; the same provider/security/gate/fence/metadata checks
apply. Recovery queues the same schema reload. Independently verify the restored
baseline and unchanged metadata/dependencies/ACL/companions/provider/gate. A recovered
baseline is **UNREPAIRED and known vulnerable**; runtime must remain disabled.
If the provider roster, source, ownership, gate, privileges or containment differ,
recovery also stops; request exact provider-assisted containment/recovery authority,
never use scaffold teardown, privilege escalation or trigger disabling as fallback.

STOP for absent independent review when required; unknown target/principal or
transaction outcome; unproved hold/drain/caller isolation/recovery continuity; hidden
conflicting activity; any guard/source/provider/config/ACL/dependency drift; lock
contention; prepared/queued writers; permission/trigger errors or timeouts; incomplete
result capture; unauthorized environment, action or cost. No automatic retries,
correction, recovery, enablement, H2, publication or next task follow this package.

## One next Owner decision

After independent review, authorize only the narrowly bounded missing provider
ownership/non-conflict and connection-continuity evidence plus operational
hold/drain/isolation/recovery attestations described above, using existing approved
DEV access. Do not authorize mutation until those gates and exact candidate review
close. ChatGPT owns Control Tower reconciliation; Codex does not update Notion.
