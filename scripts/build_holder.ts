import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Zkir } from "@midnightntwrk/zkir-v3"
import { build } from "esbuild"

import { bundledPackages, licenceRefusals, noticesOf } from "./bundle_licences.ts"
import { publishBuild } from "./bundle_output.ts"
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

await rm(outRoot, { recursive: true, force: true })
await mkdir(staging, { recursive: true })

const result = await build({
  entryPoints: { holder: "holder/src/holder_main.ts" },
  bundle: true,
  splitting: true,
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
await copyFile(join(contractDirectory, "compiler", "contract-manifest.json"), join(staging, "contract-manifest.json"))
await copyFile(join(paramsDirectory, params), join(staging, params))
await writeFile(join(staging, "index.html"), page)
await writeFile(join(staging, "THIRD_PARTY_NOTICES.txt"), await noticesOf(packages))

const digest = await publishBuild(staging, outRoot)

process.stdout.write(`holder: ${digest}, ${packages.length} packages, none refused\n`)
