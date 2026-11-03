import { readFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { OnLoadArgs, OnLoadResult, Plugin } from "esbuild"

const hexOnlyModule = fileURLToPath(new URL("../holder/src/hex_only_address_format.ts", import.meta.url))
const wasmEntry = /[\\/]@midnight-ntwrk[\\/](ledger-v8|onchain-runtime-v3|zkir-v2)[\\/]midnight_[a-z_]+_wasm\.js$/

async function importedModules(wasmPath: string): Promise<string[]> {
  const module = new WebAssembly.Module(await readFile(wasmPath))

  return [...new Set(WebAssembly.Module.imports(module).map((entry) => entry.module))]
}

async function loaderOf(args: OnLoadArgs): Promise<OnLoadResult> {
  const base = basename(args.path, ".js")
  const glue = `./${base}_bg.js`
  const wasmFile = `${base}_bg.wasm`
  const snippets = (await importedModules(join(dirname(args.path), wasmFile))).filter((name) => name !== glue)
  const lines = [
    `export * from ${JSON.stringify(glue)}`,
    `import * as glue from ${JSON.stringify(glue)}`,
    `import wasmUrl from ${JSON.stringify(`./${wasmFile}`)}`,
    ...snippets.map((name, index) => `import * as snippet${index} from ${JSON.stringify(name)}`),
    `const imports = { ${[`${JSON.stringify(glue)}: glue`, ...snippets.map((name, index) => `${JSON.stringify(name)}: snippet${index}`)].join(", ")} }`,
    "const { instance } = await WebAssembly.instantiateStreaming(fetch(new URL(wasmUrl, import.meta.url)), imports)",
    "glue.__wbg_set_wasm(instance.exports)",
    "instance.exports.__wbindgen_start()"
  ]

  return { contents: lines.join("\n"), loader: "js", resolveDir: dirname(args.path) }
}

const hexOnlyAddressFormat: Plugin = {
  name: "hex-only-address-format",
  setup(build) {
    build.onResolve({ filter: /^@midnight-ntwrk\/wallet-sdk-address-format$/ }, function redirect() {
      return { path: hexOnlyModule }
    })
  }
}

const wasmBindgenLoader: Plugin = {
  name: "wasm-bindgen-loader",
  setup(build) {
    build.onLoad({ filter: wasmEntry }, loaderOf)
  }
}

export { hexOnlyAddressFormat, wasmBindgenLoader }
