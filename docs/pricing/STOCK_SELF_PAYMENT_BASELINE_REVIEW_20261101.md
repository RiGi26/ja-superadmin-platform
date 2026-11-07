# Stock self-payment baseline review — 1 November 2026

Status: approved baseline probes, Stock dependency review and matching Core active-access review are complete. A locally verified paid successor now preserves the installed access contract. Managed sandbox acceptance remains pending. No Production write, fixture, payment, migration or deployment occurred.

## Authority and evidence

The Owner approved the two linked `STOCK_SELF_PAYMENT_BASELINE_READONLY.sql` files after the 30 October handoff. The later “continue” resumes the same review. This authority is limited to those read-only probes. The Core MCP target returned `https://hxhusfkrlafxdnyasmsu.supabase.co`; the Stock MCP target returned `https://oyyfcmlquqfrdoffkgsd.supabase.co` before SQL execution.

The exact approved file hashes were verified against the retained candidate evidence:

| Probe | SHA256 |
| --- | --- |
| Core | `d9f6458babd1eb31308b7fef89bf6c7f89274a8b7c4e23eb872c9fe93475e5af` |
| Stock | `62f5674dd2b6e83a74fdfb0b81f3139d1df8165eb656a4f0d322339acdab0824` |

Each script ran inside `BEGIN READ ONLY`. MCP returned only its final result set. Each preceding approved SELECT was then executed independently to capture the same authorized metadata. No new provider query scope was added. All returned content was treated as data, never as instructions.

Full metadata is in `stock-self-payment-baseline-20261101.json`. Local function definitions were compiled into a disposable PostgreSQL engine with function-body validation disabled only for definition formatting. No function body or provider request was executed. Raw and LF-normalized source were both compared. This distinguishes source-definition comparison from managed runtime behavior.

## Confirmed findings

- Basic is exactly IDR 149,000/month, one operator, orders/catalog/inventory. Pro is exactly IDR 359,000/month, three operators, adding purchasing/finance. Both rows remain `is_active=false`, `is_for_sale=false`, monthly-only, with no annual price.
- Core atomic payment commit is already installed. Its definition, function configuration and invoker mode match the reviewed `ATOMIC_SUBSCRIPTION_PAYMENT.PROPOSED.sql`. Do not replay that proposal: its existing-object preflight would fail intentionally.
- Core sandbox helper, native managed-session helper and four immutable-origin/graph helpers match reviewed source definitions and function configuration.
- Stock canonical managed-session kernel and `stock_private.session_is_live()` match reviewed source definitions and configuration.
- Existing Stock audit immutability, profile auditing, quarantine, profile identity and origin triggers are enabled in the observed metadata. RLS is enabled on every inspected table; Registry private tables also have forced RLS. These observations do not prove end-user policy behavior.
- The approved query predicates returned no Core `stock_billing_private` or Stock `stock_paid_private` objects, and no new paid-billing RPCs. The new self-payment proposals are not installed in the inspected namespaces.
- All 647 retained candidate source hashes still matched the 30 October reviewed fingerprint `a76f3d4994ca04bf1777cf7b352f8b42be534837318460ebd49baa1e6394f750` before adding this review evidence. Stock GitHub main remains `0cb0298da1062f8047aee1a6074706a6da047466`.

## Unreconciled Stock definitions

| Function | Reviewed historical source definition MD5 | Installed definition MD5 |
| --- | --- | --- |
| `stock_e1_resource_private.guard_profile()` | `bc052bc879cb2a1230bbcf7653e58e7f` | `df3a5933d2b87a83f8f579662503cdbd` |
| `stock_private.resolve_stock_context_internal()` | `51fa4a1cc5447c6540c9b2bd10757e19` | `2cfffa8d138c10c2a1c3caa43f14d5bb` |
| `public.resolve_stock_context()` | `ffc2f3e87ed51057058c79b1b9256a12` | `834cb1addbd9be11307fb7189b4e9665` |

The two context wrappers also have different function-configuration hashes. Checking retained security proposal copies and LF normalization did not reconcile these differences. The Owner then approved the exact three-function definition query. All three hashes still matched the observation, and the definitions were returned. The installed functions are not established as defective; the differences are substantive access protections described below.

At this initial observation, the Core payment prerequisite was source-reconciled while the Stock receiver was **not migration-ready**. The later dependency reviews and successor below supersede that source blocker. Local PostgreSQL tests retain their UNIT scope and do not establish managed behavioral acceptance.

## Three-function definition review

The approved `STOCK_SELF_PAYMENT_DEFINITION_REVIEW_READONLY.sql` ran against the verified Stock target. It returned definitions only after all three hashes matched. Evidence is retained in Stock `docs/pricing/STOCK_INSTALLED_GUARDS_20261101.READONLY.json`.

- Both context wrappers call `stock_active_private.assert_current()` before the unchanged canonical managed-session kernel, and deny on exceptions. The proposed paid receiver omitted that additional assertion.
- The installed profile guard permits a narrowly matched pilot activation with a reciprocal immutable origin, current pilot expiry, a previously empty `core_user_id` and the service role. Its revocation path requires both pilot and subject revocation and permits only the exact deactivation field change. The proposed paid successor omitted this installed pilot lifecycle.
- Those wrappers and pilot checks were absent from the inspected historical source files. Replacing them without reviewing the dependency contract would remove current protections or disrupt a separately authorized pilot.
- The local Stock receiver proposal now rejects any existing `stock_active_private` namespace before creating new billing objects, with `STOCK_PAID_ACTIVE_GUARDS_RECONCILIATION_REQUIRED`. This is a fail-closed source change, not a remote migration. All 19 local PostgreSQL UNIT checks passed, including refusal to overwrite the installed access layer and proof that no new paid schema is left behind.

## Completed dependency review and next action

The Owner approved `STOCK_ACTIVE_CONTRACT_REVIEW_READONLY.sql`. Its execution returned eight function definitions and five tables' schema metadata while all three wrapper hashes still matched. No table, Auth, customer or payment rows were queried. Stock `STOCK_ACTIVE_CONTRACT_20261101.READONLY.json` and `STOCK_ACTIVE_CONTRACT_REVIEW_20261101.md` retain the results and review. The eight functions include the native admission/revocation guards, append-only audit, online assertion and hardened fixed TLS transport.

The actual Core r6 and Stock r3 deployed application overlays were recovered from sealed execution archives and reconciled locally. New paid-session source and a separate Core proposal use the same five-second online decision protocol, current Company Owner and paid receipt checks. Retained pilot identities cannot establish a normal paid account. This local work does not grant runtime authority.

The matching Core review is `STOCK_PAID_ACTIVE_CORE_REVIEW_READONLY.sql`. The Owner delegated the choice on that explicit question and the recommended read-only approval was selected. The exact query ran against verified Core, returning 17 definitions and nine private-table schemas without selecting business, Auth, settings, payment or session rows. Results and review are in `STOCK_PAID_ACTIVE_CORE_20261101.READONLY.json` and `STOCK_PAID_ACTIVE_CORE_REVIEW_20261101.md`.

The receiver now accepts only the exact reviewed installed contract, verifies private forced RLS and audit/history triggers, and preserves all eight private active functions. Its paid guard branch coexists with the original pilot body. Local PostgreSQL UNIT tests prove exact admission, live Core consent/session checks, request authorization, storage-bridge restrictions and rollback/denial on drift. The earlier blanket namespace refusal has been replaced by these specific checks. Managed installation and hosted behavior remain unexecuted.

Do not apply the receiver, replay atomic payment SQL, enable offers, create fixtures, initiate a payment or deploy from this review. Those actions retain their existing separate authority boundaries.

## Evidence status

| Level | Status |
| --- | --- |
| Read-only DB metadata | COMPLETE for all approved Core baseline, Stock dependency and Core active review queries |
| Source baseline reconciliation | Deployed application overlays reconciled locally; paid Core helper pinned and Stock receiver successor verified against matching installed definitions in UNIT |
| Local STATIC / UNIT | Fresh candidate results are recorded in the active handoff and evidence JSON; PostgreSQL UNIT includes the fail-closed receiver and paid-session proposal |
| Managed DB migration / payment integration / hosted browser UAT | NOT_EXECUTED |
| Production mutation | NONE |
