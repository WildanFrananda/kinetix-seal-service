import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Metafile } from "esbuild"

import type { BundledPackage } from "./types/bundled_package.type.ts"

const refused = /\b(A?GPL|LGPL|SSPL|BUSL|BSL|FSL)\b/i
const licenceFiles = /^(licen[cs]e|copying|notice)(\.(md|txt))?$/i

const sourceLicences = new Map<string, string>([
  ["@midnight-ntwrk/ledger-v8", "Apache-2.0 (midnightntwrk/midnight-ledger)"],
  ["@midnight-ntwrk/onchain-runtime-v3", "Apache-2.0 (midnightntwrk/midnight-ledger)"],
  ["@midnight-ntwrk/zkir-v2", "Apache-2.0 (midnightntwrk/midnight-ledger)"]
])

function packageDirectoryOf(input: string): string | undefined {
  const at = input.lastIndexOf("node_modules/")

  if (at < 0 || input.startsWith("(disabled):")) {
    return undefined
  }

  const rest = input.slice(at + "node_modules/".length).split("/")
  const name = rest[0]?.startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0]

  return name === undefined ? undefined : `${input.slice(0, at)}node_modules/${name}`
}

function licenceOf(manifest: Record<string, unknown>): string | undefined {
  const licence = manifest.license

  if (typeof licence === "string") {
    return licence
  }

  if (typeof licence === "object" && licence !== null && typeof Reflect.get(licence, "type") === "string") {
    return String(Reflect.get(licence, "type"))
  }

  return undefined
}

async function bundledPackages(metafile: Metafile): Promise<BundledPackage[]> {
  const directories = new Set<string>()

  for (const input of Object.keys(metafile.inputs)) {
    const directory = packageDirectoryOf(input)

    if (directory !== undefined) {
      directories.add(directory)
    }
  }

  const packages: BundledPackage[] = []

  for (const directory of [...directories].sort()) {
    const manifest: Record<string, unknown> = JSON.parse(await readFile(join(directory, "package.json"), "utf8"))

    packages.push({
      name: String(manifest.name),
      version: String(manifest.version),
      licence: licenceOf(manifest),
      directory
    })
  }

  return packages
}

function licenceRefusals(packages: readonly BundledPackage[]): string[] {
  const refusals: string[] = []

  for (const bundled of packages) {
    const licence = bundled.licence ?? sourceLicences.get(bundled.name)

    if (licence === undefined) {
      refusals.push(`${bundled.name}@${bundled.version} carries no licence`)
    } else if (refused.test(licence)) {
      refusals.push(`${bundled.name}@${bundled.version} is ${licence}`)
    }
  }

  return refusals
}

async function noticesOf(packages: readonly BundledPackage[]): Promise<string> {
  const sections = [
    "Third-party software in this Kinetix seal bundle.",
    "The credential registry contract it runs is MIT (its SPDX headers)."
  ]

  for (const bundled of packages) {
    const licence = bundled.licence ?? sourceLicences.get(bundled.name) ?? "unknown"
    const texts: string[] = []

    for (const file of (await readdir(bundled.directory)).filter((name) => licenceFiles.test(name)).sort()) {
      texts.push(await readFile(join(bundled.directory, file), "utf8"))
    }

    sections.push([`${bundled.name}@${bundled.version}: ${licence}`, ...texts].join("\n\n"))
  }

  return `${sections.join("\n\n----\n\n")}\n`
}

export { bundledPackages, licenceRefusals, noticesOf }
