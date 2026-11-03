import { copyFile, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { build } from "esbuild"

import { bundledPackages, licenceRefusals, noticesOf } from "./bundle_licences.ts"
import { publishBuild } from "./bundle_output.ts"

const outRoot = "dist/verifier-bundle"
const staging = join(outRoot, "staging")

await rm(outRoot, { recursive: true, force: true })
await mkdir(staging, { recursive: true })

const result = await build({
  entryPoints: { verifier: "verifier/src/verifier_main.ts" },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  metafile: true,
  legalComments: "none",
  outdir: staging,
  logLevel: "warning"
})

const packages = await bundledPackages(result.metafile)
const refusals = licenceRefusals(packages)

if (refusals.length > 0) {
  throw new Error(`the verifier bundle may not ship: ${refusals.join("; ")}`)
}

await copyFile("verifier/verifier.css", join(staging, "verifier.css"))
await writeFile(join(staging, "THIRD_PARTY_NOTICES.txt"), await noticesOf(packages))

const digest = await publishBuild(staging, outRoot)

process.stdout.write(`verifier: ${digest}, ${packages.length} packages, none refused\n`)
