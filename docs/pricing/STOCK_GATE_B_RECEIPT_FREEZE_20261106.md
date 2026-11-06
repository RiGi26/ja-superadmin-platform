# Gate B preparation command and receipt freeze

Status: proposed, not authorized or executed against managed databases. This requests two additional read-only payloads; Gate B's original closed SQL list did not include preparation command/receipt export. Original rollout, repair, normal fixture preparation and routine login approvals remain valid. No payment authority follows from this proposal.

## Exact reads and targets

| Target | Payload | SHA-256 of LF Git blob |
| --- | --- | --- |
| Core `hxhusfkrlafxdnyasmsu` | `docs/pricing/STOCK_PREPARATION_RECEIPTS_CORE_READONLY.sql` | `4d00eca228126b737c87928ca42fe7629ff6b227d688344e3626b4a9de98a69f` |
| Stock `oyyfcmlquqfrdoffkgsd` | `docs/pricing/STOCK_PREPARATION_RECEIPTS_STOCK_READONLY.sql` | `edeab960b54eaf8d04e330378325b29ab6d4893a426f640e59f22067a9d106bd` |

Both payloads are one `BEGIN READ ONLY` transaction with one SELECT and `COMMIT`. Each returns exactly five labeled rows, including explicit missing results. They contain the same frozen Company, instance, native subject, tenant, membership, profile and origin-version tuples from the runtime manifest:

| Fixture | Company | Origin |
| --- | --- | --- |
| Existing Basic | `0c0b5c44-2af7-471e-8685-bd99438db48d` | v1 |
| Existing Pro | `bab486e5-f50e-45ac-8dca-6ae8488104a0` | v1 |
| Fresh Basic | `d2c2f26b-9740-4f05-b775-b814563bfd79` | v2 |
| Fresh Pro | `d713ddba-3568-477b-af22-7dec7d7ec740` | v2 |
| Pro Owner's separate Basic | `8215b025-e5b6-43d4-b2d1-3a4236178b6c` | v2 |

Read only the exact fixture preparation records and current membership flags. Core additionally reports the matching saved plan ID and reciprocal confirmation flag. Stock reports the matching inactive-profile flag. The preparation command comes from `prepared_owners.command_id`, never from the distinct Company creation command.

Receipts are exported only when their safe field set and all frozen identity/resource selectors match, with prepared status, Owner operational role and `accessGranted=false`. An unexpected field, mismatched selector or missing receipt produces a false match flag and null receipt/command. No password, token, session, invitation capability, invoice, payment payload or unrestricted audit read is included. The exported JSON consists of the preparation protocol's known metadata fields. It is not a bearer capability and cannot authorize a financial or operational action.

## Execution and acceptance

After exact approval, verify both project identities, execute each pinned read and retain its five-row response. Reuse the original Gate B fixture/settings reads and normal retained-command fixture preparation as already authorized. Fill actual preparation commands/receipts into the manifest only when both sides agree. Missing or mismatched results remain incomplete; do not create replacement workspaces or invent IDs. Existing Basic/Pro normal login and preparation regressions remain required.

These privileged metadata reads do not prove authenticated customer RLS, fresh selected-workspace authority or payment eligibility. `receipt_matches` verifies bounded export conditions; current native authorization and full protocol checks remain separate. No Company cohort can be proposed for execution until the original five-fixture readiness and identity gate is satisfied.

No database mutation, function call with side effects, setting, grant, Auth configuration, credential change, deployment/build, cohort enrollment, financial action, invitation/operator action or public release is requested. Recovery is unnecessary for read-only execution; on an unexpected result, stop and retain the evidence without changing data.

## Validation

The disposable actual-SQL test prepares two v1 and three v2 fixtures, including two workspaces under one Owner. It exercises the exact reads with synthetic tuple bindings, checks both receipts/commands agree, confirms read-only transactions, and verifies unbound/mismatched tuples and unexpected JSON fields return no receipt or command. It retains zero purchase cohorts, invoices and active profiles. Local test passes 1/1. An initial test-only marker accidentally matched its own forbidden `DO` keyword check; changing that synthetic marker resolved the harness false positive without altering the proposed SQL or removing the check.

The same read helper is added to the existing PostgreSQL 17 independent-connection test before financial enrollment. It verifies one actual v2 preparation and four missing scoped rows on separate connections. Paired CI and immutable source references will be recorded before seeking managed-read approval. No workstation database/runtime installation or new paid resource is used.
