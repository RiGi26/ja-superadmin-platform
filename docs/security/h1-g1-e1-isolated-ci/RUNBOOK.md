# H1.G1 E1 isolated Supabase CI candidate

**LOCAL_CANDIDATE_ONLY. No publication, CI run, SQL execution or E1 activation is authorized by this document.**

Prepared for `RiGi26/ja-superadmin-platform`, public repository, branch `feat/h1-g1-e1-core-static`, existing worktree `.wt-customer-hub-core`, baseline `8a9ae5e7d61b706c3bd87f5516d759560876bad5`. The preserved integration branch remains at `cd3ee875713bed9ca0e0cdc2ba5b37c8f97a1783`. Registry PR #47 remains an unapplied restricted scaffold at `cd9fe1e9b1a1a4c4ede55f15f16a9ef00d7b215d`.

This directory contains exactly six candidate files. `workflow.CANDIDATE.yml` is outside GitHub's executable workflow discovery directory. `vercel.guard.proposed.json` is a proposal; root `vercel.json` remains unchanged. Existing E1 TypeScript, tests, detached UI, SQL draft, migrations, billing, authentication and portal code are not edited.

## Authority and publication order

The following stages each require explicit Owner authorization. This local preparation authorizes none of them.

1. **Guard installation and provider verification first.** Reverify repository visibility, exact branch, latest main, protected source hashes and effective governance. Review the complete guard-only commit. With separately approved publication authority, apply the proposed configuration to root `vercel.json` and publish only that guard change to the existing E1 branch. Do not publish an executable workflow yet. Verify that every relevant hosting integration will suppress automatic deployment for that first commit and subsequent branch commits. Inspect the resulting exact-SHA deployment records before proceeding. If that first guard publication cannot be prevented from deploying, STOP before pushing it.
2. **Configure the human CI gate before workflow publication.** With separate settings authorization, establish GitHub environment `e1-isolated-ci` with required human reviewers, prevention of self-approval where supported, and a deployment-branch restriction to this exact branch. It must already exist and be verified; GitHub can otherwise create an unprotected environment implicitly. Do not add secrets. Use the repository-level variable `E1_ISOLATED_CI_APPROVED_SHA`; an empty value skips the candidate job. Verify that standard public-repository runner usage is still free and that no larger runner or paid integration is selected.
3. **Approve promotion and the exact publication commit.** Copy the reviewed workflow bytes to `.github/workflows/h1-g1-e1-isolated.yml` only under new authorization. Preserve the documentation candidate. Review the complete commit, not just the new workflow: prior E1 source artifacts are currently local and must exist with their accepted hashes in the published commit because the tests read them. Publishing those prior artifacts needs explicit authority too. This six-file preparation does not authorize staging or publishing them. Keep the unrelated local `.gitignore` edit out of publication: local tests check its protected working-file hash, while future Linux CI checks the unchanged Git baseline. The existing keepalive workflow is likewise checked against canonical Git LF bytes in CI, preserving its source despite Windows CRLF working bytes. No main merge is required or authorized.
4. **Approve one run before the qualifying push.** Record the exact commit SHA, six candidate hashes, protected dependency hashes, runner, pins, fixture identity and cleanup. Set the repository approval variable to that exact SHA only with Owner authorization. Publish the reviewed commit to the exact branch with the already verified Vercel guard. The push event can discover a new branch workflow without adding it to main. A changed allowlisted path must be present in that push. A human reviewer must approve this exact queued run through the protected environment.
5. **Close the one-run window.** Clear the approval variable after the approved run is admitted, under the same explicitly granted one-run/settings authority. Keep it empty thereafter. `github.run_attempt == 1` rejects reruns; do not rerun failed jobs, replay the commit, move the branch away and back, or make another qualifying push without fresh authorization. A SHA variable alone is not a consumable one-use token. The human environment gate, exact approved run record and clearing the variable are required together.

If a step needs another file, provider change, paid resource, unsafe publication or a wider objective, STOP at that boundary. Do not substitute a new broad readiness task. The preferred next step is narrowly authorized guard installation and provider verification; CI publication and execution remain separate gates.

## Trigger and dependency review

The candidate uses only `push` for branch `feat/h1-g1-e1-core-static`, filtered to the six exact candidate paths plus the future executable workflow path. No wildcard, schedule, pull request event, `workflow_dispatch`, deployment step or artifact/cache action is present. The job also checks repository, ref, push event, exact approved SHA and first run attempt. Read-only token permission is `contents: read`. Checkout does not persist credentials or fetch submodules/LFS.

`workflow_dispatch` is deliberately absent: GitHub requires that workflow file to exist on the default branch before it can receive that event. This candidate is intended for an approved branch push, not a default-branch installation workaround.

The single job uses standard `ubuntu-latest`, timeout 25 minutes and branch-scoped concurrency with cancellation disabled. Each download, image pull, bootstrap, subprocess and cleanup has an additional bound. The platform timeout can interrupt cleanup; the disposable GitHub-hosted runner is the final disposal boundary. Cleanup failure makes the run fail, and absence of project containers/volumes must be verified before any runtime PASS is accepted.

Pins reviewed from upstream metadata and source on 14 October 2026:

| Dependency | Pin and review scope |
|---|---|
| `actions/checkout` | v7.0.1, commit `3d3c42e5aac5ba805825da76410c181273ba90b1`; action manifest and credential-removal source checked; read-only checkout, Node 24 action runtime. This is not a complete independent audit of bundled JavaScript. |
| Node.js | v24.21.0 Linux x64 archive, SHA-256 `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6`, obtained from official release checksums. |
| Supabase CLI | v2.120.0 Linux amd64 archive, SHA-256 `7074584113aa00495beeac661c41fb09f1ddd0a483cd7333894b0d080086dc6e`; upstream source commit `753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4`. Local `start`, config, image registry selection, container labels, migration discovery and exact-project `stop --no-backup` source reviewed. No CLI was executed locally. |
| PostgreSQL container | CLI-pinned tag `supabase/postgres:17.11.0.004`, Linux amd64 manifest `sha256:4b438c22395a9a2bd19ee0522742cc9a1ff91db4732ff0c1b08fc07e9c767c22`, read from upstream Docker Hub tag metadata. The workflow pulls the digest, tags it locally and forces Docker Hub image selection. Runtime tests compare the actual container image ID against this digest. |
| Local parsers | Existing Python 3.14.2, PyYAML 6.0.3 and standard-library `tomllib` are used for local parsing only. They are not installed or required by the future workflow. Node static gates are lexical checks; GitHub and Supabase CLI parsing still require the approved future run. |

Pins constrain inputs; they do not prove absence of upstream vulnerabilities or Production equivalence. `ubuntu-latest` and its Docker daemon are mutable platform dependencies explicitly chosen by the task. Recheck availability, upstream security notices and runner compatibility before publication; changed pins require review and fresh static checks. The candidate contains no npm installation, application build, external database connection or cloud credentials.

## Fixture isolation and trust boundary

The workflow copies only the candidate TOML and single fixture SQL into a newly created `$RUNNER_TEMP/h1-g1-e1-fixture`. It checks exactly two files, no symlinks, and no preexisting containers or volumes with this project label. The CLI uses that directory for both start and stop. Repository-root `.env`, Core migrations, seeds, roles files, declarative schemas, `.temp` links and the real E1 SQL draft are never copied or executed. CLI home is also under runner temp. Both CLI invocations use `env -i` with only PATH, the isolated HOME and explicit local configuration controls; ambient connection or credential variables are not passed. Telemetry and keyring use are disabled; experimental stack routing and slim image substitution are disabled.

Project identity is `h1-g1-e1-ci-disposable`, distinct from any hosted project reference. API, Auth, Realtime, Studio, SMTP, Storage, functions, analytics and pooler services are disabled and excluded. No Management API login, project linking, hosted project creation, `db push`, remote migration, `status` key export or service-role request is used. Only the database container is intended to run. Before each SQL test session, the suite checks the exact container name, project/workdir labels, running state and pinned image. SQL runs through `docker exec` and the container's local PostgreSQL socket; no caller-provided connection URL or host is accepted.

The fixture creates four tables in `e1_ci`: synthetic identities, Companies, memberships and one synthetic legacy/conflict marker. Eight fabricated identities and three fabricated Companies exercise active, anonymous, revoked, inactive, ambiguous and conflicting states. It does not populate `auth.users`, `auth.sessions`, real Company tables, financial records or portal instances. Bootstrap checks reject an existing fixture schema or Core table baseline. It is not safe to run this file against arbitrary databases; workflow/container isolation remains mandatory.

`e1_ci_reader` is NOLOGIN, NOINHERIT and NOBYPASSRLS with no administrative privileges. All four tables ENABLE and FORCE RLS. Reader privileges are SELECT only. Anonymous/authenticated roles receive no table reads or writes; their only fixture access is to functions that always deny. `service_role` receives no fixture schema/table/function access. Future tests inspect effective roles, inheritance, table flags and grants rather than treating declarations as runtime proof.

The synthetic read policy uses the explicitly named GUC `e1_ci.actor`. It is a test input, not a verified JWT, Core actor, session or trusted provenance. A privileged test supervisor can choose any synthetic subject. Successful cross-Company read assertions prove only the fixture's SQL predicate under that supplied subject. They do not prove that a real caller can securely acquire that identity. Registry PR47 still has no customer read policy; this reader is not a proposal to add one.

Both `request_workspace_disabled` and `assert_continuity_disabled` always refuse invocation with `REVIEW_REQUIRED_IDENTITY_TRANSPORT`, even for matching actor/source UUIDs and an eligible synthetic reader. Client actor, Company, role and `source_ref` fields are rejected explicitly. Neither function writes records or calls the real writer. Membership status `revoked` is a synthetic data state, not Auth-session revocation evidence. No advisory lock is acquired. No authenticated transport, freshness policy, restricted connection bridge or financial authorization is invented.

The read-only codec projection compares PostgreSQL UTF8/NFC/UUID behavior against the shared vectors previously exercised by the TypeScript tests. It intentionally exposes broader PostgreSQL typed-UUID spellings, including braced/dashless/nil values that the strict TypeScript string gate denies. Matching vectors do not prove all Unicode-version equivalence or the missing real argument adapter. NUL/surrogate encoding rejection is a separate PostgreSQL test. `REVIEW_REQUIRED_CODEC_INTEGRATION` remains unresolved.

## Planned evidence and limitations

| Area | Candidate test | Evidence level until an approved run |
|---|---|---|
| Anonymous/authenticated access | Direct role SELECT must fail with SQLSTATE 42501. | STATIC design only |
| RLS and ACLs | Effective role flags, membership, table RLS/FORCE flags and denied mutation attempts. | STATIC design only |
| Client Company/Owner fields | Synthetic guard rejects each field, with no positive writer path. | STATIC design only |
| Revoked/inconsistent memberships | Synthetic read results must be empty. | STATIC design only; no Auth revocation |
| Cross-Company reads | A/B see only their own synthetic Company under a supplied GUC. | STATIC design only; no authenticated actor proof |
| Legacy eligibility | Synthetic conflict excludes reads and creation always refuses. | STATIC design only; no complete Core/Stock/LMS provenance |
| Actor/source continuity | Missing, changed and matching observations all fail closed. | STATIC design only; no locking/provider transport |
| Codec differences | Shared vectors plus broader PostgreSQL UUID and invalid UTF8 cases. | STATIC design only; no real writer adapter |
| No unrelated mutation | Fixture object inventory and full four-table snapshot before/after denied attempts. | STATIC design only; applies only to synthetic records |

Every SQL scenario is NOT_EXECUTED during preparation. The future suite does not establish actual Core session revocation, advisory-lock races, real E1 atomic rollback, provider-side identity binding, Production RLS or provider role equivalence. Surrounding test statements with `BEGIN/ROLLBACK` is isolation hygiene, not a concurrency/atomicity acceptance test. Existing E1 remains hard-disabled with identity, legacy and codec review dependencies.

## Vercel guard review

The complete proposal preserves `framework: nextjs` and both existing cron paths/schedules exactly. Its only semantic addition is:

```json
"git": {
  "deploymentEnabled": {
    "feat/h1-g1-e1-core-static": false
  }
}
```

At this source baseline, root `vercel.json` has no competing Git rule and no `vercel.ts` override was found. Other branches retain their default behavior. Vercel documents that an overlapping `true` branch pattern wins over a `false` pattern. Verify all effective rules afresh before guard installation; do not silently add global suppression or change main.

Provider checks remain OPEN: all projects linked to this repository, actual project roots, Production tracking, custom environments, deploy hooks, other workflow/deployment integrations, GitHub deployment records and exact-branch/exact-SHA Vercel deployments. Previous PR47 observations are not fresh proof for this branch. A non-root project or separate configuration may ignore this root guard. Branch suppression does not prevent manual CLI/API deployments or independently configured publishers. A future GitHub environment job can record deployment metadata; distinguish that approval metadata from an actual application/hosting deployment. No provider setting is inspected or modified in this local-only task.

**STOP before publication if automatic Preview or Production deployment cannot be reliably prevented.** Preferred compliant solution: first obtain narrow authority to install this exact branch guard and verify effective provider settings plus zero deployments for the guard commit. If reliable suppression still cannot be established, leave the candidate unpublished and report that one blocker; do not disconnect providers or create another branch without approval.

## Local checks and mutation/cost ledger

Run only these preparation checks with existing tooling:

```powershell
node --check docs/security/h1-g1-e1-isolated-ci/tests/e1-negative.test.mjs
node --test docs/security/h1-g1-e1-isolated-ci/tests/e1-negative.test.mjs
git diff --check
```

Parse YAML with a duplicate-key-rejecting PyYAML loader and TOML with `tomllib`; inspect triggers, disabled services, exact project, migration/seed paths and runner settings. Parse proposed JSON and compare the complete proposal against the original framework/crons plus exactly one false branch rule. Verify the six-file inventory, fresh SHA-256 hashes, clean whitespace, absent executable workflow and all preexisting file hashes. Those local structural checks are not Supabase CLI configuration validation or PostgreSQL parsing.

Preparation evidence on 14 October 2026: 58 static tests passed with zero failures; Node syntax and scoped ESLint passed. Duplicate-key-rejecting YAML parsing, TOML parsing, JSON/cron comparison and all six Bash `run` blocks passed syntax-only checks using existing tooling. An initial static-checker anchoring defect was corrected without changing the authorization model. An optional Bash probe at the standard installation path was unavailable; the existing Git installation at `D:/APK Python/Git` supplied the successful parser check.

The official Vercel schema's `framework`, `crons` and `git` subset validated the proposal. Full schema meta-validation was rejected under its declared draft-04 schema at `properties.functions.patternProperties.^.{1,256}$.properties.experimentalTriggers.items`, outside this proposal's fields. This is a recorded validator/schema compatibility limitation, not a full-schema or provider PASS. Effective provider acceptance and deployment suppression remain OPEN. No provider schema was changed and no system tooling was installed to bypass this limitation.

Current mutations: exactly six new files in this directory. No existing file, Git branch, worktree, provider setting, database, environment or repository variable is changed. No installation, commit, push, PR, merge, workflow publication, Actions run, container, SQL, deployment, resource creation or Production access occurs. Incremental task cost: zero. A future authorized run is intended to use free standard GitHub-hosted execution for the still-public repository, no paid runner, no external Supabase resource, no artifact upload and no cache action. Reverify billing/visibility before that run; do not claim a zero-cost runtime result before execution.

Only fixed PASS/FAIL summaries reach workflow logs. Bootstrap/SQL details stay in bounded subprocess buffers or ephemeral runner-local files and are not uploaded. No keys, connection URLs, full environment, customer data or CLI `status` output are printed. Exact-project stop removes data volumes without backups; the runner and its remaining temp files are discarded afterward.

## Sources

- [GitHub workflow trigger filters and dispatch default-branch requirement](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
- [GitHub Actions billing for standard public-repository runners](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
- [Vercel branch deployment rules and overlapping true rules](https://vercel.com/docs/project-configuration/git-configuration).
- [Pinned checkout action manifest](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/action.yml).
- [Official Node archive checksums](https://nodejs.org/dist/v24.21.0/SHASUMS256.txt).
- [Supabase CLI v2.120.0 release](https://github.com/supabase/cli/releases/tag/v2.120.0).
- [Pinned local-stack side effects](https://github.com/supabase/cli/blob/753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4/apps/cli/src/commands/start/SIDE_EFFECTS.md), [container identity/labels](https://github.com/supabase/cli/blob/753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4/apps/cli/src/command-internal/docker-ids.ts), [service image pins](https://github.com/supabase/cli/blob/753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4/apps/cli/src/shared/services/Dockerfile).
- [Supabase local configuration reference](https://supabase.com/docs/guides/local-development/cli/config), [CLI command reference](https://supabase.com/docs/reference/cli).

**STOP after local handoff. No automatic promotion, publication, CI execution, migration, deployment or E1 activation.**
