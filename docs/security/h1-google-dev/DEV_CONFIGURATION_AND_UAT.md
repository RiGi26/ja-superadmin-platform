# H1 Google DEV authentication candidate

SOURCE AND OFFLINE TESTS ONLY. H1.G1 OPEN; E1 DISABLED; H2 SSO NOT_STARTED.

This contract does not authorize a server, login, provider configuration change, Auth mutation, database access, publication or deployment. The Owner's bounded authorization dated 15 October 2026 permits local source, static/unit tests and a future runtime decision packet only.

## Configuration contract

The following is documentation with a placeholder, not an active environment file. No credential-bearing file was created, read or changed. Do not copy workstation secrets or the existing `.env.local`. Prepare a separate isolated configuration only after the Owner authorizes runtime preparation.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://mcvekinhgcqygfddyifs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<PUBLIC_DEV_ANON_JWT_FROM_THIS_EXACT_PROJECT>
HUB_GOOGLE_DEV_PROJECT_REF=mcvekinhgcqygfddyifs
HUB_GOOGLE_DEV_ORIGIN=http://localhost:3000
HUB_GOOGLE_DEV_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
HUB_GOOGLE_DEV_ENABLED=false
```

Only an explicit later `HUB_GOOGLE_DEV_ENABLED=true`, Next.js development mode, and every exact binding enable the entry point. `VERCEL` and `VERCEL_ENV` must both be absent, including empty deployment markers. The existing `HUB_PREVIEW_MODE` and `HUB_SSO_PREVIEW_MODE` switches must not be `true`; the Google candidate refuses coexistence with those visual bypasses. No Preview/Production fallback exists. No trailing slash, alternate port, IP alias, custom domain, URL credentials, callback query or unknown Supabase project is accepted.

The candidate deliberately supports the existing legacy public anon JWT configuration. It rejects missing, malformed, expired, mismatched-ref, service-role and opaque publishable/secret keys. Header/payload decoding checks metadata; it does not verify a key signature or prove provider binding. Future runtime must verify the key against the selected DEV project's public API-key panel without recording the key. Opaque publishable-key support would need a separately reviewed binding approach; it is not silently inferred.

Google client credentials belong only in the private DEV Supabase provider dashboard. The application neither needs nor reads a Google client secret, service-role key, DB password or Vercel OIDC credential for this flow. There are no new dependencies. Existing unrelated environment variables must not be transferred into the isolated process.

## Routes and security boundaries

| Route | Contract |
|---|---|
| `POST /api/auth/google/start` | Exact configured local origin/Host, same-origin POST, no URL parameters; clear isolated cookies, use installed Supabase SSR PKCE with provider Google; validate returned DEV authorize origin, callback and S256 challenge. |
| `GET /api/auth/google/callback` | Exact local origin/Host; exactly one bounded code parameter, existing isolated verifier required; exchange through DEV client, independently call `getUser`, require non-anonymous Google identity; redirect only to the fixed pending route. |
| `GET /api/auth/google/pending` | Guarded DEV-only authenticated response, no business links/data or schema queries. Google email/role never becomes Company authority. No query parameters. |
| `POST /api/auth/google/logout` | Same-origin local POST; request Supabase local-scope sign-out and clear isolated cookies. Revocation failure returns 503 and explicitly requires review. Cookie deletion is not proof of managed revocation. |

Host must be `localhost:3000`; mismatched forwarded host/protocol and any `Forwarded` header deny. Callback requests may omit Origin because provider navigation is cross-site, but an explicitly foreign Origin denies. Foreign request origin/configuration returns 404 without constructing a client. Missing/provider-error/invalid/expired/replayed callbacks clear isolated cookies and redirect to a fixed local login error. No provider error, token or supplied redirect is reflected. Password-recovery `/auth/callback` and `safeHubAuthPath` remain unchanged and always select `/hub/update-password`. `/oauth/consent` remains unchanged. A consent continuation never displays the Google DEV button.

Installed `@supabase/ssr` uses a dedicated `wz-h1-google-dev` storage key, including chunked session/verifier cookies, HttpOnly, SameSite=Lax, host-only, path `/api/auth/google`. Secure is false only because the sole permitted origin is HTTP localhost. The default Core cookie namespace is not read, written or replaced. Candidate cookies are not sent to Hub/dashboard/consent paths; even if manually presented in a mocked standard proxy request, the standard SSR client does not recognize their name. This is application cookie isolation, not proof of managed Auth authorization, RLS or universal bearer-token containment.

The pending response has static Indonesian text, a native sign-out form, restrictive CSP, no script, no identity/token interpolation, no cache and no business navigation. It does not call legacy privileged tenant/subscription queries, Registry, W1, E1, onboarding or billing code. Authentication always leads to an unprovisioned state; no positive membership/provisioning path exists here. No custom account merge/link-by-email is implemented. Supabase's own automatic identity linking, user hooks/triggers and session behavior remain REVIEW_REQUIRED until separately verified in DEV.

The existing email/password form, actions and default SSR clients are unchanged. The local Google option is a separate form on the login page. Existing Hub login still requires its existing environment variables; this task does not bootstrap a live application or fix missing legacy DEV schema. Static compatibility does not prove runtime password login or reset delivery.

## Future synthetic Auth UAT decision packet (DESIGN ONLY)

**Selected account:** `riyadhakhdan3@gmail.com` (Owner response in this chat). The second configured Google Testing user is excluded. Do not infer this account's existing DEV identity or Company permissions from its email. Before execution the Owner must confirm this exact account is one of the two allowed Testing users and is safe for isolated synthetic DEV Auth use. If an existing real DEV account/session, custom hook, legacy linkage or unexpected provider setting is found, STOP; do not merge, delete or repurpose it.

**Targets:** frontend `http://localhost:3000`; exact application callback `http://localhost:3000/api/auth/google/callback`; exact Supabase DEV project `webzoka-core-dev`, ref `mcvekinhgcqygfddyifs`. The required Supabase Redirect URLs list must include exactly this application callback, without wildcard. Existing Site URL may stay `http://localhost:3000`. The upstream Google OAuth application's authorized redirect is the DEV provider endpoint `https://mcvekinhgcqygfddyifs.supabase.co/auth/v1/callback`, distinct from the application's PKCE callback. This task has not verified or changed either provider configuration. Never add Production/custom-domain callbacks or activate H2.

### Conditional authority requested later

One Owner decision may authorize only the following exact isolated DEV Auth rehearsal after prerequisites are satisfied: private configuration preparation, adding the exact DEV redirect if needed, one loopback frontend process, the selected Google test-account login, scoped synthetic identity/session creation, browser/HTTP verification, local-scope revocation and exact fixture cleanup. It must explicitly authorize any provider setting change and cleanup deletion. It must not authorize SQL, Company Registry/W1/E1, PG17 rehearsal, business records, Production, deployment, billing or cross-portal SSO. No such action is authorized by the present packet.

### Pre-execution stop conditions

1. Owner reviews this exact source/patch revision and supplies isolated DEV-scoped Auth inspection/cleanup capability. Do not substitute an existing Production/portal connector or workstation secret.
2. Record sanitized pre-state: project label/ref, local origin/callback, provider enablement, Testing audience/account selection, redirect allowlist and whether the selected account has an existing DEV identity/session. Do not collect API keys, Google credentials, tokens, authorization codes or cookies in evidence.
3. Inspect approved Auth hooks/triggers and RLS/business authorization impact using separately authorized DEV access. Prove an Auth signup cannot provision Company/Owner/tenant/subscription/invoice or trigger external email/payment/business effects. The empty legacy public schema does not establish this. If inspection needs SQL or another system, STOP for that specific scope; do not connect here.
4. Use a dedicated browser profile and a sanitized process environment, no inherited unrelated secrets, no existing default Core cookies or existing auth sessions. Verify exact anon-key project metadata privately. Bind a later authorized frontend to loopback only, for example `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000`; verify port availability then. This command was NOT_EXECUTED.
5. Confirm documented session cleanup/revocation semantics and exact test-account lifecycle. Existing real identity/account data must never be deleted. If provider auto-linking cannot be contained, STOP.

### Expected mutations and scenarios

Expected managed effects, if authorized: at most one synthetic DEV `auth.users` record if absent, its Google `auth.identities` record, provider-managed session/refresh-token/Auth audit records, PKCE verifier/session cookies in the dedicated browser. Google/Supabase may retain audit/security metadata; do not promise complete erasure. Existing-account linking behavior is not assumed or authorized. No public Company/tenant/membership/subscription/product/invoice record or W1 assertion may be created.

| Scenario | Required evidence and acceptance |
|---|---|
| Opt-in false/missing, missing key/ref, wrong project, Production/hosted markers | Button absent; start/callback/pending/logout 404; no Auth call/session mutation. Use a separate sanitized process per case; never point at Production. |
| Start from allowed localhost | Same-origin POST returns 303 to exact DEV `/auth/v1/authorize`, Google provider, fixed callback and S256 challenge. Redact query values in logs. |
| Account A Google login | DEV-only provider chain returns via exact PKCE callback to pending 200. Record sanitized request origins/statuses; no tokens/codes/cookie values. |
| Pending with absent legacy schema | Authentication succeeds without any PostgREST/privileged legacy queries or business records; membership remains unverified, zero Company/Owner capabilities. Verify observed network and approved DEV Auth/data inspection, not UI copy alone. |
| Protected Hub/dashboard/consent | Dedicated session cannot enter protected Hub/dashboard or approve downstream authorization; expected login redirect. Check HTTP cookie-session matrix and real browser. Never copy isolated bearer tokens into legacy cookie names. Any broader token/authorization behavior remains a separate security prerequisite. |
| Invalid, expired, missing, duplicate or replayed code; provider cancellation; missing verifier | Fixed login failure or guarded 404; no business access. Replay once after successful consumption, expiry through a controlled expired code. Provider guarantees require actual evidence. |
| Foreign origin, callback/next injection, alternate host/port, H2 authorization ID | Rejection before exchange; no attacker-controlled redirects. |
| Session revoked/expired | Pending rejects invalid session. Test real managed revocation independently; cached JWT acceptance and refresh behavior must be recorded rather than assumed. |
| Desktop and 390×844 mobile | Screenshots and measurements: no horizontal overflow, visible state/error, 44px+ tap targets, keyboard focus, sign-out usable, no floating overlap. No mobile-friendly claim until these exist. |
| Logout and cleanup | Local-scope revocation observed, candidate cookies removed, pending inaccessible, no default Core cookie modified. If revocation fails, preserve error evidence and STOP; do not claim cleanup. |

### Recovery and cleanup

Disable opt-in and stop the loopback server at the end or on failure. Restore only explicitly changed task-owned DEV Redirect URLs/configuration to the captured pre-state. Revoke all synthetic DEV sessions and remove only the newly created synthetic Auth identity/user if creation/deletion was explicitly authorized and no unrelated identity/data exists; never delete or unlink an existing account. Verify absence of test-owned active sessions/identities, zero business-record mutations and no cookie residue. Retained provider audit metadata must be disclosed. If any unexpected hook, linking, default cookie, business record or external effect appears, stop immediately and escalate with sanitized evidence; no ad hoc SQL cleanup or Production fallback.

Evidence packet: source/patch hashes, target project ref, configuration-check booleans, pre/post provider/identity/session inventories (sanitized IDs as needed), per-scenario HTTP statuses and destinations, desktop/mobile screenshots, network absence of legacy data access, revocation outcome, cleanup delta and failure log. A mocked PASS does not satisfy this runtime packet.

## Independent unresolved prerequisites

- Managed Google/Supabase Auth runtime, identity linking, session revocation, cookie persistence and exact provider configuration: REVIEW_REQUIRED / NOT_EXECUTED.
- Company Registry/clean provenance/First Owner authority and W1 transport: unresolved, runtime disabled, separate from authentication UAT.
- PostgreSQL 17 same-backend rollback-only runner, role closure and recovery: unresolved separate execution prerequisites. No SQL or runner execution here.
- H1.G1 remains OPEN. E1 remains DISABLED. H2 remains NOT_STARTED. No automatic next phase.

References: [Supabase Google SSR flow](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase SSR server client](https://github.com/supabase/ssr/blob/main/src/createServerClient.ts), and the installed Next.js 16.2.6 Route Handler/cookies guides. Documentation establishes API conventions, not DEV runtime facts.
