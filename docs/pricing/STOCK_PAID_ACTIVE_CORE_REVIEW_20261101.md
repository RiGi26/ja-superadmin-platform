# Core active-access dependency review — 1 November 2026

The Owner delegated the choice on the explicit read-only review question ("pilih yang paling ok"). The recommended read-only option was selected. The exact approved query SHA256 remained `0e59110ee066ada9c6cb8dfc01e34c20addbeef5d3c431c3ec5e34f4e37c274a`. The Core MCP target was verified as `https://hxhusfkrlafxdnyasmsu.supabase.co` before execution.

The query returned 17 function definitions and metadata for nine private tables, including columns, constraints and enabled triggers. No business, customer, Auth, payment, settings-value, session or audit rows were selected. No provider write occurred. Results are retained in `STOCK_PAID_ACTIVE_CORE_20261101.READONLY.json`.

## Preserved authority

`active_stock_core_session_live(uuid,uuid)` verifies an existing Core session, current user deletion/ban status, explicit session expiry, and unrevoked OAuth consent for the fixed Stock client. Its installed definition MD5 is `f4e62c2e0f8fb2d4151921662e75d28d`. The earlier synthetic UNIT dependency omitted OAuth consent; it has been replaced with this exact reviewed definition in the disposable PostgreSQL tests.

Existing-business authority still requires the independently approved active binding, current Company membership, retained two-operator control proof, and no E1 origin. The pilot authorizer instead requires its current finite cohort, no-charge entitlement, reciprocal E1 binding and confirmed session. Neither path establishes normal paid authority. Retained pilot identities must not fall through into a new commercial account.

The new paid-session proposal creates separate private sessions and append-only session events. It changes none of the existing-business or pilot functions. It reuses the exact live-session helper, verifies current E1 Owner and immutable resource mapping, requires an acknowledged exact paid invoice/current subscription, and returns the existing request-correlated decision tuple. Each operational request rechecks these conditions. Enrollment is idempotent; identity, expiry and revocation history cannot be rewritten or deleted.

The proposal now checks the exact installed live-session and public managed-session definition hashes before installation. This is a forward proposal, not an applied migration. The existing atomic payment migration is already installed and must not be replayed.

## Application and receiver compatibility

The application classifies retained paid history before selecting an authorization engine. A denied or unavailable paid result cannot retry through pilot or legacy authority. Two native credentials are independently verified during enrollment. The same immutable five-second method/path/subject/session/nonce protocol is used for online Stock authorization.

The Stock receiver successor preserves the installed private assertion, transport, native admission, subject revocation and audit functions. It retains the previous pilot/quarantine guard body and adds a separate receipt-controlled branch. Before installation it checks all 11 reviewed Stock function definitions, private forced RLS and history/audit triggers. Before activation it rechecks enabled audit/history triggers. Initial activation writes exact Core mappings and admits a matching native subject atomically with its receipt; any failure rolls back Stock while preserving Core's paid invoice.

Native Storage and Realtime restrictions remain unchanged. The existing server upload/document bridges use a separate current paid authorization RPC; errors deny without retrying a weaker path.

The retained provisioning wrappers already preserve ordinary nonpilot E1 creation and staging. They were reviewed from the execution archive and are unchanged. No additional provisioning adapter was introduced. Their managed behavior remains part of hosted acceptance, not a claim established by this metadata query.

## Evidence boundary

Read-only dependency review is complete. Local PostgreSQL UNIT tests execute the reviewed assertion, subject guards and Core consent/session helper; only the HTTP transport between the two disposable databases is synthetic. They do not prove managed Auth, hosted HTTP extension behavior, gateway payment, browser journey or Production acceptance. Migration, deployment, test-account creation, sandbox payment activation and public sales retain their separate Owner authority boundaries.
