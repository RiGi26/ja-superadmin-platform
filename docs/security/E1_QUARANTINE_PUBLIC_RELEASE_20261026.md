# Public Customer Hub and E1 quarantine release

The Owner requested “okee solve it” after the active chat identified two pending
items: Production quarantine activation and the public Customer Hub entry. This
release connects the desktop/mobile Webzoka entry to canonical Core sign-in,
returning to `/hub/workspace`, and enables the verified new-Company → native
Stock SSO → inactive quarantine flow. Stock access, entitlement, billing and
payment activation remain outside this release.

`E1_QUARANTINE_RUNTIME_ENABLED` selects only the installed resource-isolated
admission/context/binding adapters. The legacy `CORE_COMPANY_RUNTIME_ENABLED`,
`E1_STOCK_RUNTIME_ENABLED`, `E1_COMPANY_STOCK_RUNTIME_ENABLED`, generic Registry
database gate, existing Hub routing and billing fuses remain closed/unchanged.
There is no environment/request-controlled activation or test credential adapter.

Rollout order: passing exact-source CI → install the six existing native SSO
public configuration values in Production → release Stock → release Core →
enable only the two installed E1 settings rows → validate retained-fixture
same-command replay, native SSO, inactive context, foreign denial and revocation
→ release Corp navigation and verify desktop/mobile links. No migration replay
or Auth callback expansion is required.

The Core settings row uses Stock realm `https://oyyfcmlquqfrdoffkgsd.supabase.co`;
Core realm remains `https://hxhusfkrlafxdnyasmsu.supabase.co`. Generic Registry
must remain false. Native application origins stay the approved canonical
`ja-superadmin-platform.vercel.app` and `webzoka-stock-platform.vercel.app`.

Recovery: close both E1 settings first, clear Core's Stock origin to null, and
restore the prior Core/Stock deployments if runtime acceptance fails. Keep Corp
on its previous deployment until reciprocal acceptance passes. Preserve every
birth record and append-only audit entry; revoke and ban retained test accounts
after validation. Never reactivate a Stock profile or create test entitlements.

Fresh implementation/release evidence and exact deployment IDs belong to this
chat's handoff and the linked release PRs. The earlier disabled-release note and
historical approval documents retain their original scope and bytes.
