# H1.G1 DEV Registry as-built record

Recorded 2026-10-18, Asia/Jakarta. Scope: source reconciliation only.
Repository: `RiGi26/ja-superadmin-platform`; worktree: `.wt-customer-hub-core`;
branch: `feat/h1-g1-e1-core-static`; verified local HEAD:
`5dcff3c3bab1d6aaccf6b315a47e9bbb6edb6f0a`.

## 23 October 2026 catalog comparison update

One specifically authorized catalog-only read against verified Core DEV
`mcvekinhgcqygfddyifs` returned PostgreSQL 17.11, the eight expected native tables,
six native functions and their grants/RLS/constraints/indexes/triggers. The
accepted public RPC SHA-256 fingerprints remain exactly `9185872def4078ab4d16bb3545faa9d09476d91c959edae49065a4b1be49cd81`
(`core_registry_mutate`), `01c29ee9f8181cc7ce7634aa9629550eb6dae41d514c7510185fcc4a5a1c14c5`
(`core_registry_owner_claim_context`), and
`6b58b33e1bb42eab0797d8d500fb52cf91deef52045a5395ff40beefe3aa558b`
(`core_registry_authorize`). All six function bodies match reviewed SQL008 bodies
after CRLF normalization and removal of surrounding body whitespace.

Native private tables and functions grant only postgres access; public tables
grant authenticated SELECT and no client writes. RLS and FORCE RLS are enabled
on all eight tables. The append-only event trigger and the three reviewed policy
expressions are present. Policy role targets are OIDs in this snapshot and their
name mapping was not independently returned. No settings values, Auth/customer
rows, migration ledger, E1-private objects or external event triggers were read.
The three public E1 extension functions were absent from the returned public
Registry function inventory. This is catalog evidence, not managed runtime PASS.

Evidence: `C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-registry-comparison-20261023/scratchpad/INSTALLED_REGISTRY_CATALOG.json`
and `FUNCTION_COMPARISON.json`. An additive, refusal-guarded successor is in
`../h1-g1-e1-managed-dev/FORWARD.PROPOSED.sql`. SQL008, SQL009 and protected020
remain untouched. The historical installation/unknown-state record below is
retained for provenance; this update resolves only the facts explicitly above.

### Approved follow-up catalog read

At 2026-10-23 06:46 UTC, a separate exact one-query approval executed
`NEXT_PRECHECK.READ_ONLY.PROPOSED.sql` with SHA-256
`8170785c4b15bbe9297593db8d8ffaaff5829cfdf3d8645037a729f5e5f82d86`.
The verified project URL was `https://mcvekinhgcqygfddyifs.supabase.co`.
The three native public policies target only `authenticated`, resolving the
earlier OID-name uncertainty. `core_e1_resource_private` and
`core_e1_stock_private` were absent, as were the four queried public E1 functions.

Six enabled event triggers are owned by `supabase_admin`, with invoker functions
in `extensions` and an empty fixed search path. Four are restricted to extension
creation/drop tags. `pgrst_ddl_watch` and `pgrst_drop_watch` have no tag restriction.
Only metadata and function hashes were returned; bodies and side effects were
not inspected. Do not infer permission, notification or transaction behavior from
their names. No trigger was disabled or bypassed. The additive draft pins this
snapshot but remains refusal-guarded and unexecuted.

Evidence: `C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-followup-catalog-20261023/scratchpad/CATALOG.json`.
The read approval is consumed. Settings values, customer/Auth rows, installation,
runtime and release remain outside this read approval. No provider write occurred.

### Managed rollback rehearsal — no E1 installation retained

The Owner subsequently delegated selection of the exact reviewed rehearsal and
mandatory readback. On verified Core DEV `mcvekinhgcqygfddyifs`, one execution of
rehearsal SHA-256 `ec64eef7acb230fe97765a5df099b33a8ff3897571b9ca083275a9ff63e523eb`
passed the native/provider preflights and transient E1 DDL/ACL/RLS/disabled-state
assertions, then ROLLBACKed. One readback execution with SHA-256
`164f17e740dfad535f0d8e7806b84614558042664248b2b3538c5f87979dcdb8` returned
`ROLLBACK_READBACK_PASS`, recorded at 2026-10-23 07:18 UTC. E1 objects were absent,
the native and provider catalog snapshots matched, and no exclusive Registry
relation locks remained. The native Registry is still the only installed family
established by this evidence; the E1 candidate was not permanently installed.

This run included transient DDL and a disabled E1 settings row, all rolled back.
No existing business/Auth/settings row was targeted by a write. No Auth fixture,
customer/RLS-row access, active RPC or app/browser behavior was exercised. No
migration was applied or migration ledger queried. The two-call approval is
consumed; permanent installation, activation and release remain unauthorized.
Evidence: `C:/Users/61140/AppData/Local/Temp/Codex/h1-g1-managed-rehearsal-20261023/scratchpad/PROVIDER_RESULTS.json`.

## Historical installed baseline and evidence boundary

The Owner's verified baseline identifies the Supabase-native Registry as already
installed in **webzoka-core-dev** (`mcvekinhgcqygfddyifs`): three public and five
private tables, with RLS enabled. Installation was **MANUAL_SQL_EDITOR_INSTALL**.
**MIGRATION_LEDGER_EMPTY**: that manual installation is **not recorded in the
Supabase migration ledger**. An empty ledger does not mean an empty schema.
No applied version, migration filename, installation timestamp or ledger row is
invented here. Codex executed no database SQL, including catalog reads.

The following inventory is verified against local SQL008. The Owner confirms the
installed family/counts and RLS baseline; exact provider names, definitions, FORCE
RLS, policies, grants, RPC presence and behavior were not independently compared.

| Source table inventory | Purpose |
| --- | --- |
| `public.companies` | Canonical Company identity, revision and audit head |
| `public.company_memberships` | Company/Auth-subject relationship; one active membership per user |
| `public.company_portal_instances` | One product reservation per Company; external mappings disabled |
| `core_registry_private.settings` | Runtime gate; source seed is false, provider value unverified |
| `core_registry_private.operators` | Independent operator enrollment |
| `core_registry_private.provenance` | Private command-bound history evidence |
| `core_registry_private.owner_claims` | Proposer/independent approver workflow |
| `core_registry_private.events` | Atomic append-only, hash-linked audit |

| Source public RPC inventory | Signature / intended caller |
| --- | --- |
| `public.core_registry_authorize` | `(uuid, boolean)`; authenticated user, SECURITY INVOKER |
| `public.core_registry_owner_claim_context` | `(uuid, uuid)`; service_role only, SECURITY DEFINER |
| `public.core_registry_mutate` | `(uuid, uuid, timestamptz, uuid, text, jsonb, uuid[])`; service_role only, SECURITY DEFINER |

Source dependencies also include private `proof_valid`, `append_event`,
`reject_audit_change`, the `events_immutable` trigger and three SELECT policies.
These names and ACL intentions are source facts, not additional runtime PASS claims.

## Source identity and historical proposals

| Artifact | SHA-256 | Evidence / disposition |
| --- | --- | --- |
| [SQL008](008_supabase_native_registry.PROPOSED.sql) | `da7df1c890af10fa806dc0842d0163281b35318240e436fb478fa0f8d9730516` | Local bytes verified; historical rollback-only clean-DEV proposal |
| Permanent candidate | `047b208b7079815b9bf1a81a62f554865f4b0c2a998bbfd9bfec7170b6b4db90` | Owner-reported hash; matching SQL bytes not present in this worktree |
| [SQL009](009_supabase_native_recovery.PROPOSED.sql) | `119e17ea7499c5b8e947df98f4511ad053ca0371355f8257d9c3d603493f2ac9` | Local bytes verified; historical rollback-only empty-scaffold recovery proposal |
| [SQL006](006_registry_w1_installation.DO_NOT_APPLY.sql) | `0c0550332346c337ccb8b8420813767cc3df097a907411d107c499d43cff2f5f` | Superseded W1 DO_NOT_APPLY; unconditional refusal preserved |
| [SQL007](007_registry_w1_recovery.DO_NOT_APPLY.sql) | `b8e416dd01577b264b8d2e784daad3bc30e03c149359f7d5ee6ddb3a06ebd990` | Superseded W1 DO_NOT_APPLY; unconditional refusal preserved |

SQL008 and the reported permanent candidate are different byte identities. The
permanent hash also does not match a local terminal-ROLLBACK-to-COMMIT-only
derivative. Its actual differences and equivalence to installed objects remain
**UNKNOWN_NOT_YET_RESOLVED**. No permanent SQL was reconstructed, adopted or executed.
[NATIVE_MANIFEST.sha256](NATIVE_MANIFEST.sha256) records current local source hashes;
it is not provider inventory or migration-history evidence.

**Do not reinstall.** Do not run SQL008, the permanent candidate or SQL006/007
against this installed DEV baseline. SQL008's existing-object refusal is correct;
do not bypass it with IF NOT EXISTS, selective statements or dropped objects.
SQL009 is not authorized cleanup: installed data, independent recovery authority
and exact provider dependencies are unverified. Neither historical proposal is
an applied migration, an upgrade path or evidence of a successful recovery.

## Protected PR #47 collision

Protected reference: `supabase/migrations/core_db/020_company_registry_forward.sql`
in `.wt-core-company-registry-static`, local ref
`cd9fe1e9b1a1a4c4ede55f15f16a9ef00d7b215d`, SHA-256
`341213bfb1068d63adff71c8490233b85b1bd4d3aaeb4bfc77312c0f9d6ddf66`.
This is the Owner-identified legacy Draft PR #47, not a native DEV migration;
its header targets historical Core `hxhusfkrlafxdnyasmsu`, not this DEV project.
No current GitHub status change is inferred from the local ref.

| Collision | Native SQL008 source | Protected PR #47 source |
| --- | --- | --- |
| Object names | Creates all three public tables listed above | Creates those same names; no compatible adoption path |
| Company | `revision`, `audit_head` | `updated_at` and different timestamp constraints |
| Membership | Auth UUID without managed Auth FK | FK to `auth.users`; different indexes/timestamp constraints |
| Product instance | `legacy_tenant_id`, `portal_instance_id`, `lifecycle_status`; reserved/NULL only; all-history Company/product uniqueness | `legacy_core_tenant_id`, `portal_tenant_id`, `lifecycle_state`, `mapping_state`; FK to `public.tenants`; partial current-product uniqueness |
| Authorization/audit | Authenticated SELECT policies, service-role RPCs, five private tables | No client policies or native RPC/audit stores; direct service_role SELECT |

Do not edit, apply, repoint or merge migration020 to reconcile this DEV schema.
Do not replay migrations because the ledger is empty, insert a fabricated applied
record, or label SQL008/020 as already applied. A future migration-history strategy
needs exact installed-source/catalog evidence and separate authority; no version
is selected here. Any required PR #47 mutation must STOP with
`REVIEW_REQUIRED_CROSS_WORKSTREAM_DEPENDENCY`. This source record requires none.

## Validation, drift and remaining gaps

- Fresh STATIC: source hashes/manifests, eight-table/three-RPC inventory, the three
  collisions, refusal/ROLLBACK preservation, local dependency closure, record
  consistency, links and scoped preservation checks. Actual outputs accompany the
  reconciliation handoff; no provider result is substituted for a local check.
- Reused unchanged evidence from 2026-10-17: native offline suite 45/45, W1/blank
  regression checks 110/110, TypeScript and focused ESLint exit 0. These are source
  and mocked-unit results, not proof of installed behavior. Only the affected
  manifest check is rerun after this documentation/checksum update.
- DATABASE/RUNTIME this task: **NOT_EXECUTED**. Installed tables/RLS and the empty
  ledger are Owner-verified baseline facts; RPC authorization, transaction rollback,
  concurrency and post-COMMIT recovery have no fresh Codex runtime verification.
- PREVIEW/UAT: not applicable to documentation-only changes. PRODUCTION/payments:
  unchanged; no validation or activation performed.

Drift is recorded rather than repaired: DEV has a manually installed Registry while
Git retains historical rollback-only proposals and no applied migration record.
Exact permanent bytes/catalog equivalence, effective ACL/RLS/RPC state, private DB
gate value and data contents remain unverified. Earlier safety gaps also remain:
genuine W01-W15 provenance/participating-writer evidence, managed Auth revocation
semantics, independent audit anchoring and provider recovery. RLS being enabled
alone does not establish any of those guarantees.

ONE next action: Owner supply the exact permanent candidate matching `047b208b…`
and the existing installation/catalog/RPC/ACL evidence as one bundle for this same
workstream's source-to-provider comparison, without rerunning any installer.

H1.G1 OPEN. E1 DISABLED. `CORE_COMPANY_RUNTIME_ENABLED=false` remains literal in
local source; this is not an assertion about an unqueried provider setting.
H2 NOT_STARTED. No staging, commit, publication, provider mutation or Notion update.
