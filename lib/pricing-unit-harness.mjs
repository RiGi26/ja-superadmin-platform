// Test-only loader. Executes actual pricing modules against in-memory clients.
// No application/provider runtime, secrets, or network access is available.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function evaluate(file, require) {
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require,
    process: { env: {} }, fetch: () => { throw new Error('Network is forbidden in pricing units') } })
  return mod.exports
}

export function loadPricingPolicy() {
  return evaluate('./plan-catalog.ts', (name) => { throw new Error(`Unexpected pricing import ${name}`) })
}

export function loadPricingServer(createAdminClient, enabled, sandboxAllowed = async () => false) {
  const real = loadPricingPolicy()
  // Explicit offline fixture for future enabled sales; the application's source
  // fuse remains false. All actual catalog and purchase rules still execute.
  const policy = enabled === undefined ? real : { ...real,
    saleablePlans: (rows) => real.saleablePlans(rows, enabled),
    purchaseError: (plan, rows, current, period) => real.purchaseError(plan, rows, current, period, enabled),
  }
  return evaluate('./plan-catalog-server.ts', (name) => {
    if (name === 'server-only') return {}
    if (name === '@/lib/supabase/admin') return { createAdminClient }
    if (name === '@/lib/plan-catalog') return policy
    if (name === '@/lib/billing-sandbox-uat') return { sandboxPurchaseAllowed: sandboxAllowed }
    throw new Error(`Unexpected pricing server import ${name}`)
  })
}
