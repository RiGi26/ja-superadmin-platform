# Gate B supplemental unpaid preparation repair

Status: proposed, not authorized for managed execution. Existing Gate A/B approvals remain applicable to their exact original payloads. This is one additional Core function repair, its pinned metadata-only postcheck and conditional recovery. No application build or promotion is needed.

## Problem and correction

Fresh Basic completed normal Core signup/email verification, same-person canonical sign-in, named Company creation and native Stock consent. Approved scoped reads freeze verified Core `8a0a703c-63d7-44d7-b8fd-d76a129349d1`, verified Stock `cecba884-f703-467a-8f44-3b932ba3a833`, Company `d2c2f26b-9740-4f05-b775-b814563bfd79` and reservation `6deede3f-a3cf-4d6d-815c-130e80c25f10`. Native confirmation twice returned uncertain; no replacement Company or financial operation was attempted.

The installed account preparer rejects a new unpaid account when public offers and sandbox cohort eligibility are both closed. Gate B intentionally keeps both closed. The prior disposable fixture enrolled a cohort before preparation, masking this path. A new no-eligibility regression fails before the repair with `STOCK_BILLING_EXISTING_RESOURCE`. This identifies a deterministic source blocker; hosted acceptance remains pending the approved repair and normal same-command retest.

Change only `public.stock_billing_prepare_account(uuid,uuid,timestamptz,uuid,uuid,uuid)`: its existing sales/cohort condition receives a narrow exception while the independent membership preparation setting is enabled. The routine still requires the original live service actor, verified current Owner, exact v1/v2 immutable origin and native Stock binding, approved Basic/Pro plan, preserved pilot-history denial, conflict checks and exact suspended tenant/account mapping. It issues no invoice, subscription, trial, paid access or cohort eligibility. All financial callers and invoice/subscription guards remain unchanged. The preparation gate becomes useful for the verified customers already covered by Gate B's disclosed global preparation scope.

## Exact requested authority

- Target only Core `hxhusfkrlafxdnyasmsu`; Stock database is unchanged.
- Apply the exact forward SQL once through the normal migration tool, preserving its provider-issued history version. It creates no account/customer rows directly and changes no settings, grants, RLS, triggers, Auth configuration or financial routine.
- Execute the exact postcheck read and Core performance advisor; assess only findings attributable to this function repair and retain unrelated historical observations. Reuse the original approved fixture/settings reads and normal retained-command preparation for the approved Owners/workspaces.
- Only if verification requires recovery, apply the exact recovery SQL, which restores the prior preparer body and retains all mappings, receipts, audit and financial history. No automatic deletion, financial reversal or gate shutdown is included.
- No new deployment, build, paid plan, cohort, invoice/payment, invitation/operator, merge or public release authority is requested.

The preflight pins the old body MD5 `b665c2a71190f0185e3d2bee3e5a14ac`, postgres ownership, security-definer configuration and retained service-only grants. It requires the three preparation settings enabled, sandbox billing retained, both exact approved offers closed and no enabled sandbox cohort. Wrong state/hash and replay reject before replacement. The new body MD5 is `966a113084bf699edb1c52cb42105be5`; conditional recovery accepts only that body.

## Pinned payloads

| Payload | SHA-256 | Bytes |
| --- | --- | --- |
| `docs/pricing/STOCK_PREPARATION_SALES_DECOUPLE_CORE_FORWARD.PROPOSED.sql` | `f77a0ec82e45f38d872ea42ce5c06d2819aa9265a21de429143c4c4e626b3d32` | 5311 |
| `docs/pricing/STOCK_PREPARATION_SALES_DECOUPLE_CORE_POSTCHECK_READONLY.sql` | `34db819d60ae346a373ebe476b9c7d30dcc04a91acf1c77e0b8e356e9d48437e` | 1301 |
| `docs/pricing/STOCK_PREPARATION_SALES_DECOUPLE_CORE_RECOVERY.PROPOSED.sql` | `96d2c95666fd03923bc5e559982595b495db73c5721b515042bf33ffd2c23d4e` | 5198 |

## Validation and remaining acceptance

Local disposable SQL reproduces the old failure, then passes exact forward/postcheck/recovery, wrong-baseline/hash denial and replay rejection. Reciprocal Core/Stock preparation succeeds while the Stock profile stays inactive, both offers stay closed, purchase eligibility stays false and preparation creates no financial rows. After reciprocal confirmation, invoice creation still fails with `STOCK_BILLING_INVOICE_DENIED`. Financial guard definitions remain byte-identical; recovery retains the prepared account. The local workspace suite passed 28/28, including the additional existing v1 Basic/Pro path before cohort enrollment. [Core CI](https://github.com/RiGi26/ja-superadmin-platform/actions/runs/42146802148) passes at `50451b25c850a882cad334477e1aee86dca73fe3`. [Paired Stock CI](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/42148043208) passes at `ab79315e20b47a418065ea57732cbb2745b2c0a4`, pinned to that Core commit: 336 source checks, 216 module tests, 311 disposable SQL checks and 10 actual PostgreSQL 17 independent-connection tests, all zero-fail, plus types/lint/build. [PDF CI](https://github.com/RiGi26/webzoka-stock-platform/actions/runs/42148043065) also passes. All three SQL payload hashes remain identical to that tested pair. Disposable Auth/transport is synthetic and does not establish managed/native authorization.

Separately, the agent's invalid compact Auth pattern was removed. Stock Auth recovered to 200, all four original entries remain, and the original approved preparation callback is applied verbatim. The approved selection callback still needs an execution path that can retain the complete 2053-character original list; Studio caps it at 2048. The original authorization remains valid; this repair does not change or broaden that Auth scope. Core's actual Go glob compilation/matching suite passed in CI `42144917127` at `1c3b11d21817290f532c96913892608a4687e610`. JavaScript regex equivalence claims from the rejected compact attempt are retracted.

Managed SQL execution is `NOT_EXECUTED` pending this exact additional authority. Native reciprocal readiness, customer RLS, full desktop/exact-390px journey, operators, five sandbox purchases and public/live-mode release remain open. Production changed previously through approved Gate A/B deployments, Auth and preparation settings; no supplemental repair has executed.

## Already-approved selection callback: remaining execution path

The [exact non-secret Management API patch](stock-gate-b-auth-management-patch-20261106.json) contains only `uri_allow_list`: the four retained Stock entries followed by both original approved callback patterns, verbatim. Five local Node contracts verify this complete 2053-character set; actual Go tests compile and constrain both approved patterns. It changes no Site URL, OAuth client, role or secret. The existing Auth approval remains valid; this is not an additional Auth authority request.

The connected Supabase tool has no Auth-configuration mutation, and the dashboard caps the exact combined string at 2048. An Owner with existing authorized Management API access can submit this body to `PATCH https://api.supabase.com/v1/projects/oyyfcmlquqfrdoffkgsd/config/auth`, after confirming the retained entries have not changed. No token or full Auth-config response should be pasted into chat. Do not create broader credentials or replace existing entries to get around the limit. This API submission has not executed; afterward verify six exact rows and Auth health before native selection UAT. [Official endpoint](https://supabase.com/docs/reference/api/v1-update-auth-service-config).
