# Core–Stock approval integrity and controlled release gates

Date: 26 October 2026. Status: PREPARED_FOR_OWNER_DECISION; NOT_RELEASE_READY.

## Approved execution update

The Owner replied “okee i proved” in this chat to the explicit bounded plan:
protected-document reconciliation, Core/Stock commit, push, PR/CI, Preview,
merge and disabled Production deployment, followed by testing under existing
fixture/UAT authority. This supersedes the earlier pending-action statements
below for those exact actions. It does not authorize general E1 activation,
new security configuration, migration replay, payments or active Stock access.

Both proposal versions now exist at the exact proposed paths and retain their
expected hashes. The test pin is unchanged. The historical update was preserved,
not adopted as new runtime authority. Reproducible candidate validation is being
added to the two repositories; actual acceptance and release evidence will be
linked to their PRs. Core's unrelated `.gitignore` and isolated-CI archive remain
outside the candidate commit.

## Authority and preserved candidate

The Owner's “go a head for the next in new task” continues investigation,
implementation, local verification and preparation from chat
`01a172d2-5154-7da1-86ba-aed6a7002ee6`. The transferred Core worktree is
`.wt-customer-hub-core`, branch `feat/h1-g1-e1-core-static`, HEAD
`e92e74bb4536e8f7344c3c376fd02a1d35797756`. Stock is
`RiGi26/webzoka-stock-platform`, worktree `.wt-webzoka-stock-pdf`, branch
`test/h1-g1-e1-dev`, HEAD `72fb354ace0da860de5f3ea9ee2bc387290bd74d`.
The candidate includes substantial uncommitted and untracked Steps 1–6 work;
HEAD alone does not identify it. Existing WIP, Core `.gitignore`, and the
untracked isolated-CI archive are preserved. No new worktree or dependency
installation is needed.

The prior release grant covered Corp PR #167 only. It does not authorize
Core/Stock commits, pushes, CI, Preview, merge, deployment or activation.
Production-backed full-flow UAT remains authorized within its existing exact
fixture, data, configuration and security boundaries. The temporary fifth
callback approval was consumed and restored; it is not a permanent allowlist
expansion.

## Reproduced protected artifact failure

`lib/google-oauth-dev.test.mjs` pins
`docs/security/h1-g1-core-dev/RUNTIME_APPROVAL_PROPOSAL.md` to SHA256
`c4567b1b3385f23e2ad83975ce42906815dc0b978b5cb4b4d0299dcd07b69cc7`.
The current untracked file is
`5ec8142763141981ddacefc4e38e474fb0507a3cb1c246806829162fa0b2d9be`.
The pin exists in commit `64a6fdf`; the proposal itself has no Git history.
LF/CRLF comparison rules out line endings as the cause.

The original document was recovered from a complete `Get-Content -Raw` result
at `2026-10-23T09:48:34.677Z` in chat
`01a1679f-66f4-70e1-9157-ecd5dbe952c6`. Removing the terminal newline added by
PowerShell's output formatter and retaining the document's own final LF
produces the exact pinned hash. This is byte-identity evidence, not approval.

Four recorded edits at 09:54:34, 09:55:06, 09:56:42 and 09:57:39 UTC added
read-only provider discovery findings, corrected the catalog description,
clarified pending runtime authority, and qualified the proposed principal.
The Owner's actual instruction at `2026-10-23T09:46:26.493Z`, user message
`01a16827-9330-79d3-b6dc-6c705872850c`, explicitly authorized read-only discovery
and instructed Codex to “update the current runtime proposal.” The edits are
therefore an authorized documentation successor, not unexplained corruption.
The separate discovery task independently recorded the same concurrent drift in
`h1-g1-discovery-20261023/scratchpad/CONCURRENT_DRIFT.json`. No executable SQL,
grant or runtime authorization follows from either version. Attribution is to
the recorded chat edits; no human approval of the changed hash is inferred.

## Exact proposed reconciliation — not applied

1. Preserve the entire current 12,003-byte proposal as
   `docs/security/h1-g1-core-dev/RUNTIME_APPROVAL_DISCOVERY_20261023.HISTORICAL.md`
   with its existing hash. Explain its historical status in this release note,
   without rewriting the preserved bytes.
2. Restore `RUNTIME_APPROVAL_PROPOSAL.md` from the recovered original whose
   SHA256 exactly equals the existing test pin. Include both files explicitly
   in any later authorized candidate commit; the original is currently
   untracked and would otherwise be absent from a clean CI checkout.
3. Keep the test assertion, historical SQL and
   `INSTALLATION_MANIFEST.sha256` unchanged. Its SHA256 remains
   `7a6992ee0b812f71c03ae164538ee3c83781aa6041c9c07571d50e6a28725d6e`.
4. Rerun the protected assertion, complete local suites, exact-byte manifests,
   types and focused lint before claiming source acceptance.

Owner authority is required before steps 1–2 change the protected artifact's
location/content. Current task has prepared the exact original, full preserved
version, provenance and review diff in scratch; neither protected file nor test
pin has changed. Approval of this reconciliation would not approve the old DEV
rehearsal, SQL, any release, or feature activation.

## Origin correction and rollout sequence

The existing workspace candidate uses `metadata.referrer = 'strict-origin'`.
Prior browser evidence reproduced `no-referrer` producing `Origin: null` on
the cross-origin POST and Stock returning 403. The candidate sends the exact
Core origin, origin-only Referer and receives 303. Stock's exact Origin check
is preserved. The Corp consent-host routing correction is already released;
it is not repeated here.

After protected reconciliation and fresh source acceptance, seek authority for
Core/Stock commit, push/PR/CI and a coordinated **disabled** rollout. Keep
`CORE_COMPANY_RUNTIME_ENABLED`, `E1_STOCK_RUNTIME_ENABLED` and
`E1_COMPANY_STOCK_RUNTIME_ENABLED` false, keep database gates closed, and keep
generic Registry disabled. Review the complete Steps 1–6 diff and exact candidate
hashes. Never ship scratch adapters, fixture credentials, browser interceptors,
expired deadlines or Preview OIDC environment values.

Before a push, verify provider account/team, exact project and Git publication
settings. Stock's current `vercel.json` disables Git deployments for this task
branch; Core has no equivalent source guard. Neither fact establishes current
provider publication settings. Do not push Core assuming it cannot deploy.
Stock's isolated-runtime workflow triggers only changes to its workflow or
`supabase/tests/e1/**` on the named branch; source-only pushes do not establish
that workflow ran. Do not replay migrations or trigger an unrelated runtime job
as a replacement for required candidate checks.

An uninterrupted positive test requires a separately reviewable, authorized
fixture-restricted activation candidate and exact runtime gate changes. Reuse
the retained fixture graph; do not create another immutable Company graph by
default. Prove the real signed-in Core → native consent → Stock callback →
inactive quarantine → Core return in one browser flow, without navigation,
authentication or consent-host adapters. Use the approved `vercel.app` hosts,
HTTP/cookie sessions and desktop plus 390×844 browser evidence. Existing private
Preview snapshots are removed and expired; they are unusable evidence targets.
Any new security-sensitive browser/callback configuration needs applicable
action-time confirmation. Do not disable deployment protection merely to obtain
a green browser result.

Restore every temporary gate/configuration, revoke and ban the fixture users,
verify zero managed fixture sessions and zero entitlements, and retain birth
and append-only audit records. No payment, entitlement or active Stock access
is part of quarantine acceptance. Only after uninterrupted acceptance may a
separate controlled activation decision be reviewed. Disabled deployment,
positive UAT and general feature release are separate claims.

## Evidence and current limits

Current investigation evidence:
`C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-release-gates-20261026/scratchpad/`.
`PROVENANCE.json`, the two exact proposal copies and `proposal-delta.diff`
make the protected decision reviewable. `CHECKS.json` and individual logs
record fresh source validation. The recovered original's matching hash is a
diagnostic comparison; it does not turn the still-failing protected test green.

Fresh local results: Core UNIT 837/838, Stock UNIT 280/280, zero skipped tests.
Core's sole failure is the unchanged protected proposal hash. Both TypeScript
checks and focused lint checks exit 0 on Node v22.22.0. The larger Stock count
includes every local `scripts/*.spec.mjs` file, not only the earlier subset.
No build, CI, runtime or browser claim follows those checks.

Prior runtime/Corp evidence remains in
`h1-g1-production-uat-20261026/scratchpad/`. Its 48/48 managed integration,
16 HTTP assertions, adapter-assisted browser results and Corp routing acceptance
retain their stated limits. Retained harness failures are not relabeled PASS.

No provider setting, database, Auth fixture, deployment, remote branch or
Production application changed in this continuation. DB RUNTIME, uninterrupted
BROWSER UAT and Core/Stock PRODUCTION acceptance are NOT_EXECUTED here.
No release-ready or full-suite-green claim is made while the protected assertion
fails. Continue the same task after the precise protected-artifact decision and
any later applicable release authority; no new task is required.
