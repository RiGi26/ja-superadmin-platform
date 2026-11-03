// Executes actual source with explicit offline dependencies. No provider, Auth,
// application environment, network, or database credentials are available.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as crypto from 'node:crypto'
import { z } from 'zod'

export function loadStockModule(file, dependencies = {}, globals = {}) {
  const module = { exports: {} }
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, URL, URLSearchParams, FormData, Buffer, AbortSignal,
    Date, TextDecoder, TextEncoder, Response, Request, process: { env: {} },
    fetch: () => { throw new Error('Network is forbidden in Stock billing units') },
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name]
      if (name === 'server-only') return {}
      if (name === 'zod') return { z }
      if (name === 'node:crypto') return crypto
      if (name === '@/lib/stock-membership-protocol') return loadStockModule('./stock-membership-protocol.ts', {
        './stock-active-protocol': loadStockModule('./stock-active-protocol.ts'),
      })
      if (name === '@/lib/stock-membership-purchase') return loadStockModule('./stock-membership-purchase.ts', {
        '@/lib/stock-purchase-policy': stockPolicyFixture,
      })
      throw new Error('Unexpected offline dependency: ' + name)
    }, ...globals }, { filename: file })
  return module.exports
}

// Pure selectors execute actual catalog/policy code; no authority is mocked.
export const stockCatalogFixture = loadStockModule('plan-catalog.ts')
export const stockPolicyFixture = loadStockModule('stock-purchase-policy.ts', { '@/lib/plan-catalog': stockCatalogFixture })
