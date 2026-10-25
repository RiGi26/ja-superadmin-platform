# H1.G1 candidate review record

21 October 2026, Asia/Jakarta. This record distinguishes author checks from an
independent review. It is not execution or governance approval.

## Author review against the requested scope

- The frozen trigger predicate blocks both accepted rows, including the non-applicable
  sql_drop event. The candidate retains the original predicate's domain and requires
  its entire observed two-record result, with source/security/owner checks.
- The reviewed DDL handler sends a schema-reload notification and does not execute
  business SQL. The drop handler is excluded by event applicability for the sole
  CREATE OR REPLACE FUNCTION statement, not by an unreviewed assumption about its body.
- Every frozen guard and byte of accepted mutation/recovery transformation is retained.
  New provider before/after assertions add preservation checks; no trigger is changed.
- The known two-record projection passes offline. Actual ownership of both event
  triggers and the drop handler is not in prior capture; candidate expectations are
  enforced but not represented as observed provider facts.
- A hidden non-client scheduler remains outside the frozen client activity predicate.
  This is an operational/provider non-conflict blocker, not cleared by code readiness.
- Managed PG17 wrapper behavior, primary/recovery continuity, maintenance hold/drain,
  actual caller isolation and independent post-COMMIT verification remain unproved.

No author finding requires changing the accepted function body, grants, ownership,
dependency/audit protections or runtime-disabled requirements. Source readiness is
not DEV execution readiness.

## Independent review

**STATIC review: PASS; no actionable SQL findings.** The Owner authorized one
read-only reviewer. Its first attempt ended at a usage limit without findings; the
same reviewer resumed under that approval and completed the review. No additional
agent, model/account switch or paid resource was used.

The reviewer inspected both complete candidates, frozen-wrapper diffs, PACKAGE.md,
the validator/report and private accepted evidence, without edits or provider calls.
It independently verified:

- Frozen correction/recovery hashes match the Owner-supplied baseline.
- Candidate correction SHA-256:
  `448e5a2d9404fe001b718b342069f14b2b0794d42c2049b0934d97aa2355d36a`.
- Candidate recovery SHA-256:
  `e19b27713b93eb6da3d78c9f4eea6f75593d3e86edc698b803368c5c9aca4773`.
- The retained handler capture has exactly one complete row. Its recomputed
  MD5/SHA-256, observed owner, invoker security and empty search_path match the pins.
- Both candidate rosters exactly match the accepted two-row Phase 1 projection.
- Independently derived correction/recovery match the accepted definition files;
  the body addition remains exactly 165 bytes.
- The complete roster comparison fails closed for unknown relevant, missing,
  disabled or changed trigger records; provider before/after snapshots are symmetric.
- The sole dynamic statement remains the accepted CREATE OR REPLACE FUNCTION.
  The reviewed DDL watcher sends a notification; the pinned sql_drop watcher is
  non-applicable to this statement.
- Existing source/security/ACL/companion/dependency/audit/runtime-disabled controls
  remain unchanged outside the authorized provider additions.

No finding required a SQL change. The reviewer requested final manifest creation
and replacement of the pending-review record; both are administrative completion
items. These final documentation/manifest updates were not independently re-reviewed.
They do not change the independently verified candidate SQL hashes. The validator's
review-status metadata was clarified after review; its executable checks and SQL
candidates remain unchanged.

**Limits:** independent STATIC review only. No SQL, provider call, PostgreSQL engine
execution or new runtime test was performed by the reviewer. Actual event-trigger
and drop-handler ownership, maintenance hold/drain, scheduler non-conflict, actual
caller isolation, primary/recovery continuity and independent committed-state
verification remain execution blockers. The independent review does not close
those gates, establish managed security, authorize execution or close H1.G1.
