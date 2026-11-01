# Stock self-payment — next source-publication gate

Status: Owner authorized the exact source-publication question with "Approve source PR/CI and closed Previews" on 1 November 2026. Execution is in progress. This remains the same purchase-to-activation objective and does not authorize public sales or Production actions.

## Reviewable candidate

- Review-start source fingerprint: `90b4c1fcd40486e9072a2e6e9040a1adaeae095a9e659f711d179cbfea762ca7`, covering 683 source/configuration/proposal files. Authorized publication guards and CI/test integration follow that review. Current exact hashes and object inventory: `stock-self-payment-evidence.json`.
- Core: `RiGi26/ja-superadmin-platform`, checkout `.wt-customer-hub-core`, branch `feat/basic-pro-pricing-prep`, starting HEAD `4e4937ca55fada4856a2c10551a4f3c01e212045`; reviewed upstream main `ace57932005735bee6a341f46f0e12bd68560a4f`.
- Stock: `RiGi26/webzoka-stock-platform`, checkout `.wt-webzoka-stock-pdf`, branch `feat/basic-pro-pricing-prep`, starting HEAD/main `0cb0298da1062f8047aee1a6074706a6da047466`.
- Local evidence: Core 1,229 UNIT, Stock 96 UNIT, PostgreSQL 25 UNIT, types/lint and compile-only builds pass. Source review: `STOCK_SELF_PAYMENT_REVIEW_20261101.md`.

## Requested Owner authority

Authorize these actions for the two named repositories and their existing Vercel projects only:

1. Reverify remote/default-branch identity and current publication settings. Preserve unrelated work, including Core's unrelated `.gitignore` changes and isolated-CI archive. Do not create or delete worktrees.
2. Commit the reviewed pricing, recovered deployed baseline, self-payment implementation and associated evidence. If required, integrate the verified default branch into the task feature branch, preserving protected history and rechecking the resulting candidate. This permits integration into the feature branch only; no merge into a default branch.
3. Push the task feature branches, create/update draft PRs, and run/retry the relevant CI. Add the new Stock module/PostgreSQL checks to its source validation and pin the paired Core candidate by the actual immutable commit produced in step 2. No historical pin or test is weakened to obtain a pass.
4. Permit automatically triggered Preview builds/deployments only inside the two existing projects, with all new paid-runtime/public-sales gates closed. Verify publication behavior before pushing. If a push could deploy to Production or a different project, stop before that push.
5. Use existing provider plan allowances only. No new paid resource, provider upgrade, project creation, secret export, unrelated/customer data access, or security/callback configuration change is included. Stop if material additional cost or missing target/identity authority is encountered.
6. Report exact commits, PR links, CI results, Preview targets if created, preserved work and remaining acceptance limitations in the existing handoff and PRs. Do not write to Notion or Obsidian.

This gate does **not** authorize a Production deployment, a default-branch merge, any managed SQL write/migration, fixture/account creation, sandbox or real payment activation, cohort enrollment, runtime/sales enablement, or access to secret/environment values. The read-only SQL approvals retain their original exact scope.

## Why this gate precedes runtime

`AGENTS.md` → Protected authority requires explicit authority for commit, push/PR/CI, Preview, merge, deploy, migration and financial actions. The preserved Core–Stock release contract also requires passing exact-source CI before deployment. Core's source configuration does not establish that feature pushes cannot publish; Stock's branch-specific configuration is not proof of provider settings for this task branch. Preview side effects must therefore be explicitly bounded before any push.

After current-source CI and review, prepare the exact coordinated closed-sales receiver/migration and sandbox acceptance execution for its applicable Owner authority. The three self-payment proposals remain unapplied; the already installed atomic payment migration must not be replayed. Both fresh-account purchases, actual Stock access, invoice history, gateway/recovery negatives and desktop/390px browser evidence remain required before public selling. Fixed authorization origins must be preserved; an arbitrary Preview or another Supabase project cannot substitute silently.
