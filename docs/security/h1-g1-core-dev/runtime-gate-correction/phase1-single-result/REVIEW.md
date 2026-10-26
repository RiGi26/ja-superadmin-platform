# H1.G1 PHASE 1 single-result proposal

Prepared 21 October 2026, Asia/Jakarta. WG-1.2 + WF-1.0 / V4.

Local preparation is complete. This package is **not approved for execution**. Independent review and fresh exact Owner authorization are required. H1.G1 remains OPEN. Company runtime and E1 remain disabled; H2 remains NOT_STARTED. These are required governance states, not fresh observations of installed database state.

## Exact proposed files

The complete SQL is supplied in the two adjacent files; neither file contains PHASE 2, correction DDL or recovery DDL.

| File | UTF-8 bytes | SHA-256 |
| --- | ---: | --- |
| `H1G1_PHASE1_SINGLE_RESULT.PROPOSED.sql` | 8,213 | `7ed57b39d802083a7561d6476fe637f7f29995d71623be01d64e3c09f144af27` |
| `H1G1_RECOVERY_IDENTITY_SINGLE_RESULT.PROPOSED.sql` | 3,376 | `5e8554fa168e05322b3b6214e30b8c38b302cccdac5f6dde409149c8893a86fc` |

Original approved `H1G1_VERIFY_PHASE1_ONLY_REVIEW.sql` remains unchanged: 4,564 bytes, SHA-256 `0418387c5a1c047d1ef04e56efb5f3ea6915a3ddda9fe36fde64f8effcdcc51e`. Its previous execution authorization does not transfer to these proposed files.

## Scope comparison

Each original SELECT, excluding its terminating semicolon, is embedded byte-for-byte in a materialized CTE. Each is evaluated once when its envelope is consumed. No original projection, catalog predicate, privilege probe, dependency query or nested aggregate was changed. All group arrays are retained without a row limit, sampling, DISTINCT or NULL removal.

| Group | Original observation retained | Envelope cardinality |
| --- | --- | --- |
| `01_connection_identity` | Database, effective/login roles, backend PID, version, transaction/default settings, recovery state and the original three schema/language capability probes | Exactly one row |
| `02_role_capabilities` | Current role name, superuser, bypass-RLS and login attributes | Exactly one row |
| `03_runtime_disabled_singleton` | Settings row count and original singleton/runtime-disabled aggregate | Exactly one aggregate row |
| `04_other_database_sessions` | Other same-database sessions; original PID, role, backend type, state, transaction start and wait fields; no SQL text | Zero or more; PID order preserved |
| `05_registry_advisory_fence` | Only the original hashed Registry advisory-lock key, with PID/grant/mode | Zero or more; no new ordering promise |
| `06_prepared_transactions` | Same-database prepared-transaction count | Exactly one aggregate row |
| `07_caller_isolation_settings` | Original current/all-database settings for the three named caller roles or all roles; isolation settings only | Zero or more; no new ordering promise |
| `08_applicable_event_triggers` | Original enabled-event-trigger filter, tags, handler identity and handler-definition MD5 | Zero or more; trigger-name order preserved |
| `09_mutation_metadata_acl_dependencies` | Exact mutation signature, original metadata excluding `prosrc`, comment, dependency arrays and anon/authenticated/service-role EXECUTE probes | Exactly one row |

The separately bounded recovery-connection file contains **only groups 01 and 02**, copied from the same source, under the same transaction bounds. It does not create a recovery connection, test DDL, prove ownership or establish connection continuity.

Serialization adds only derived structure, counts, cardinality status, byte length and a digest. It adds no database observation. Handler definition text is still used only by the original MD5 expression; no handler source is returned. Existing function metadata, ACLs and dependency identifiers remain private evidence, not public output.

## Result contract and empty cases

Each proposed transaction contains one result-producing top-level SELECT. Its five columns are:

1. `report_json`: exact JSON text containing format identifier, original SQL hash, expected/observed group counts, overall structural cardinality status and all observation envelopes.
2. `report_utf8_bytes`: length of that exact text after UTF-8 encoding.
3. `report_sha256`: SHA-256 of those same UTF-8 bytes.
4. `group_count`: 9 for primary or 2 for recovery identity.
5. `cardinality_ok`: structural cardinality only; it is not a security PASS.

Every envelope includes its unique identifier, expected minimum/maximum row counts, actual `row_count`, `cardinality_ok` and complete `rows` array. An unlimited maximum is explicit JSON null. Zero rows become `rows: []`, `row_count: 0`. Missing expected-singleton rows are retained as empty arrays with false cardinality; they cannot erase the other groups through an inner join. Unexpected multiple rows are all retained with false cardinality. SQL NULL values remain JSON null fields. The SQL does not suppress, replace or convert them to safe-looking values.

The settings aggregate always returns one row even for an empty settings table. `settings_rows: 0` with `runtime_is_disabled: null` must remain visible and blocks correction readiness. A one-row aggregate is not proof of a one-row settings table. Separately require exactly one settings record and strictly true runtime-disabled aggregate. A prepared-transaction aggregate returning one row can still contain a nonzero count.

Empty session/fence/isolation/trigger arrays mean no matching visible rows at that observation time. They do not prove visibility completeness, maintenance hold, caller isolation or absence of future writers. Hidden session state remains a blocker. Null wait fields, transaction timestamps for idle sessions, comments, ACL defaults or optional catalog metadata require field-specific interpretation; they are not silently treated as safe or universally classified as failures.

## Deliberate timing differences

The original `BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY`, `search_path = pg_catalog`, 10-second statement timeout, 30-second idle-in-transaction timeout and `ROLLBACK` are unchanged.

The nine observations now run inside **one statement**, sharing its MVCC statement snapshot where PostgreSQL applies one, rather than nine successive READ COMMITTED statement snapshots. Independent CTE evaluation order is not promised. Statistics and lock views do not form an atomic cross-subsystem snapshot. The 10-second timeout now bounds the combined statement, rather than each of nine separate statements. A timeout can therefore yield no complete result. No timeout was increased and no execution retry is authorized.

This is exact observation-source equivalence with an explicitly changed capture and timing structure. It is not proof of temporal equivalence, provider execution safety, managed-session revocation or installed source parity. Previous valid source, privilege and isolated-runtime evidence remains reusable without rerunning it.

## Capture assumptions and verification

One output row removes dependence on retention of nine distinct rowsets and prevents the Dashboard's displayed 100-row limit from selecting only part of an observation array. It does **not** establish deployed adapter equivalence, absence of response/cell/export byte limits, successful type/function resolution, sufficient privileges, performance within 10 seconds or same-backend transaction continuity.

The previously reviewed published postgres-meta behavior selects the last nonempty rowset. If the deployed adapter behaves that way, this single SELECT followed by an empty ROLLBACK result is compatible with that behavior. Hosted equivalence remains unproven. No SQL or editor changes were used to test it.

Before any future execution, establish that the approved existing Owner Dashboard path can send the entire unchanged transaction on one primary backend, capture the complete raw five-column result row, and retain confirmed transaction completion. If this cannot be established without an unapproved action, stop and report the remaining capture gate.

After any separately authorized execution, capture privately as a raw exported/downloaded row or another independently verified complete representation. Visible cells, screenshots, ellipsized previews and a green success indicator alone are insufficient. Do not rely on any particular export feature until its behavior is verified. Do not split, edit or rerun a failed transaction under a one-execution approval.

For verification, decode any transport JSON/CSV escaping to recover the **exact string value** of `report_json`. UTF-8 encode that string and compare its length and SHA-256 with the two sibling columns. Do not parse and reserialize or pretty-print it before hashing. Then parse it as JSON and verify the exact format, original source hash, 9 or 2 unique expected group identifiers, matching inner/outer group counts, each `row_count == len(rows)`, and each cardinality result. Reject missing or additional fields/groups that violate this contract. Preserve nested arrays and explicit null fields. A checksum detects incomplete or changed capture against the returned checksum; it is not an independent provider attestation.

Byte length or checksum mismatch, absent result columns, malformed JSON, missing groups, inconsistent counts, hidden required state or unconfirmed ROLLBACK/connection continuity are STOP conditions. Preserve any partial/error evidence privately; obtain fresh authorization before editing or retrying. This proposal cannot guarantee complete capture against an unknown hosted limit.

## Offline validation

`OFFLINE_VALIDATION.json` records **14 focused checks passed, zero failed**. Checks cover syntax parsing, identical transaction-control AST, exact embedded original SELECT bytes and semantic AST, materialization, no additional catalog reads or mutating/locking statements, complete envelopes, original ordering, no truncating LIMIT, explicit empty/null behavior and digest/output structure.

The separate synthetic capture-format model retains a 250-entry array, Unicode, empty groups, explicit NULLs, nested empty dependencies and missing/multiple singleton cases. Five negative examples detect truncation, group omission, null-field deletion, array-row deletion and reformatting against the original byte/digest metadata. This model tests the capture contract, not SQL execution or the hosted renderer.

Environment: Python 3.14.2; pglast 8.4 with PostgreSQL parser 18.4. No PostgreSQL 17 runtime or semantic catalog/type resolution was exercised. No new runtime was installed. One initial harness comparison flagged relocated IN-list parser byte offsets; the comparator was corrected to ignore only source positions while retaining semantic AST comparison. SQL did not change to satisfy that test.

Reproducible preparation and validation scripts, original frozen copy and preservation snapshots are retained in `C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-phase1-single-result-20261021/scratchpad/`. `prepare.py` is creation-only; its derivation function can compare proposed bytes without overwriting files. `validate.py` runs offline and refreshes the local validation report. This is evidence tooling, not an execution instruction.

## Remaining provider safety gates

No fresh DEV observations were collected. Prior Dashboard evidence showed the expected DEV project, Primary database and selected Owner principal, but did not establish backend identity/continuity or an independent recovery connection. Database SQL execution count remains zero.

The following remain unresolved for any future correction authorization:

- Fresh exact project/principal/primary identity, sufficient visibility and complete result capture under a continuous read-only transaction.
- Live runtime-disabled singleton, active/conflicting writers, prepared transactions and Registry advisory-fence observations.
- An existing out-of-band maintenance hold and evidence that all relevant callers use suitable transaction isolation. Database defaults alone cannot establish every caller's actual transaction mode.
- Applicable provider DDL event triggers, exact function ownership, metadata/ACL/dependency retention and provider-specific correction/recovery safety. An applicable enabled trigger blocks the currently prepared correction/recovery package pending separate review; it is not remedied here.
- An already authorized independent recovery connection with separation and continuity. Distinct PIDs observed once are insufficient to establish lasting independent recovery access; a pool or SQL Editor may change backends. No accounts, role changes or connectivity purchases are authorized.
- A separately reviewed plan for correction/recovery connectivity and independent post-COMMIT verification. This PHASE 1 package does not perform any correction, recovery DDL or PHASE 2 comparison.

Wrong/unknown identity, denied access, uncertain continuity, unavailable full capture or any need to change the approved SQL requires stopping before the affected action. Unsuitable isolation, absent maintenance hold, conflicting writers, missing independent recovery access and applicable provider DDL triggers remain blockers for correction; they do not authorize automatic remediation.

## One next Owner authorization request

After independent review, authorize **exactly one** execution of `H1G1_PHASE1_SINGLE_RESULT.PROPOSED.sql`, SHA-256 `7ed57b39d802083a7561d6476fe637f7f29995d71623be01d64e3c09f144af27`, solely on `webzoka-core-dev` / `mcvekinhgcqygfddyifs`, using the existing authenticated Owner account, existing role and approved Primary connection, only after identity, complete capture and transaction continuity are verified. If an already available independent recovery connection can be verified through the same authorized access path, separately include at most one execution there of `H1G1_RECOVERY_IDENTITY_SINGLE_RESULT.PROPOSED.sql`, SHA-256 `5e8554fa168e05322b3b6214e30b8c38b302cccdac5f6dde409149c8893a86fc`, with the same read-only/rollback and capture conditions. No split, edit, retry, role change, source export, correction/recovery DDL, PHASE 2 or other action is included.

Until that review and fresh exact approval, these files remain proposals. No execution readiness or permission is claimed.
