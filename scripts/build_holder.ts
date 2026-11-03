import { createHash } from "node:crypto"
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Zkir } from "@midnight-ntwrk/zkir-v2"
import { build } from "esbuild"

import { bundledPackages, licenceRefusals, noticesOf } from "./holder_licences.ts"
import { hexOnlyAddressFormat, wasmBindgenLoader } from "./holder_plugins.ts"

const paramsDirectory = process.env.MIDNIGHT_PP
const contractDirectory = "managed/credential_registry"
const outRoot = "dist/holder-bundle"
const staging = join(outRoot, "staging")

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Kinetix seal holder</title>
  </head>
  <body>
    <script type="module" src="holder.js"></script>
  </body>
</html>
`

if (paramsDirectory === undefined || paramsDirectory === "") {
  throw new Error("MIDNIGHT_PP is required: the holder ships the prover's public parameters")
}

async function digestOf(directory: string): Promise<string> {
  const hash = createHash("sha256")

  for (const name of (await readdir(directory)).sort()) {
    hash.update(name)
    hash.update("\0")
    hash.update(await readFile(join(directory, name)))
  }

  return hash.digest("hex")
}

await rm(outRoot, { recursive: true, force: true })
await mkdir(staging, { recursive: true })

const result = await build({
  entryPoints: { holder: "holder/src/holder_main.ts" },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  metafile: true,
  legalComments: "none",
  outdir: staging,
  assetNames: "[name]-[hash]",
  loader: { ".wasm": "file" },
  plugins: [hexOnlyAddressFormat, wasmBindgenLoader],
  logLevel: "warning"
})

const packages = await bundledPackages(result.metafile)
const refusals = licenceRefusals(packages)

if (refusals.length > 0) {
  throw new Error(`the holder bundle may not ship: ${refusals.join("; ")}`)
}

const ir = await readFile(join(contractDirectory, "zkir", "present.bzkir"))
const params = `bls_midnight_2p${Zkir.deserialize(ir).getK()}`

await copyFile(join(contractDirectory, "keys", "present.prover"), join(staging, "present.prover"))
await copyFile(join(contractDirectory, "keys", "present.verifier"), join(staging, "present.verifier"))
await writeFile(join(staging, "present.bzkir"), ir)
await copyFile(join(paramsDirectory, params), join(staging, params))
await writeFile(join(staging, "index.html"), page)
await writeFile(join(staging, "THIRD_PARTY_NOTICES.txt"), await noticesOf(packages))

const digest = await digestOf(staging)

await rename(staging, join(outRoot, digest))
await writeFile(join(outRoot, "current.json"), `${JSON.stringify({ digest })}\n`)
process.stdout.write(`holder: ${digest}, ${packages.length} packages, none refused\n`)
