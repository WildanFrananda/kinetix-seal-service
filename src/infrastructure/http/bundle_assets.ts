import { readdirSync, readFileSync } from "node:fs"
import { extname, join } from "node:path"

import type { BundleAsset } from "../../types/bundle_asset.type.ts"

const digestPattern = /^[0-9a-f]{64}$/

const contentTypes = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".txt", "text/plain; charset=utf-8"],
  [".css", "text/css; charset=utf-8"]
])

class BundleAssets {
  readonly digest: string
  private readonly files: ReadonlyMap<string, BundleAsset>

  private constructor(digest: string, files: ReadonlyMap<string, BundleAsset>) {
    this.digest = digest
    this.files = files
  }

  static load(directory: string, required: readonly string[]): BundleAssets {
    const manifest: unknown = JSON.parse(readFileSync(join(directory, "current.json"), "utf8"))
    const digest = typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, "digest") : undefined

    if (typeof digest !== "string" || !digestPattern.test(digest)) {
      throw new Error(`${directory}/current.json names no build`)
    }

    const files = new Map<string, BundleAsset>()

    for (const name of readdirSync(join(directory, digest))) {
      files.set(name, {
        bytes: readFileSync(join(directory, digest, name)),
        contentType: contentTypes.get(extname(name)) ?? "application/octet-stream"
      })
    }

    const missing = required.filter((name) => !files.has(name))

    if (missing.length > 0) {
      throw new Error(`the build ${digest} lacks ${missing.join(", ")}`)
    }

    return new BundleAssets(digest, files)
  }

  file(digest: string, name: string): BundleAsset | undefined {
    return digest === this.digest ? this.files.get(name) : undefined
  }
}

export default BundleAssets
