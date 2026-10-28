// Synthetic component rendering only. No application runtime or provider access.
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const React = require('react')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function loadHubUi(file, mocks = {}) {
  const modules = new Map()
  function load(path) {
    if (modules.has(path)) return modules.get(path)
    const mod = { exports: {} }
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    vm.runInNewContext(code, { module: mod, exports: mod.exports, URL, require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name === 'react') return React
      if (name === 'react/jsx-runtime') return require(name)
      if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
      if (name === 'next/image') return { __esModule: true, default: ({ src, alt, width, height }) => React.createElement('img', { src, alt, width, height }) }
      if (name === 'lucide-react') return new Proxy({}, { get: () => props => React.createElement('svg', props) })
      if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
      if (name.startsWith('.')) {
        const candidate = resolve(dirname(path), name)
        for (const extension of ['.tsx', '.ts', '.mjs']) if (existsSync(candidate + extension)) return load(candidate + extension)
      }
      throw new Error('Unexpected UI dependency: ' + name)
    } }, { filename: path })
    modules.set(path, mod.exports)
    return mod.exports
  }
  return load(resolve(root, file))
}
