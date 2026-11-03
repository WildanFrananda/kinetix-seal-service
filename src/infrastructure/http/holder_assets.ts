import { readdirSync, readFileSync } from "node:fs"
import { extname, join } from "node:path"

import type { HolderAsset } from "../../types/holder_asset.type.ts"

const digestPattern = /^[0-9a-f]{64}$/

const contentTypes = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".txt", "text/plain; charset=utf-8"]
])

class HolderAssets {
  readonly digest: string
  private readonly files: ReadonlyMap<string, HolderAsset>

  private constructor(digest: string, files: ReadonlyMap<string, HolderAsset>) {
    this.digest = digest
    this.files = files
  }

  static load(directory: string): HolderAssets {
    const manifest: unknown = JSON.parse(readFileSync(join(directory, "current.json"), "utf8"))
    const digest = typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, "digest") : undefined

    if (typeof digest !== "string" || !digestPattern.test(digest)) {
      throw new Error(`${directory}/current.json names no holder build`)
    }

    const files = new Map<string, HolderAsset>()

    for (const name of readdirSync(join(directory, digest))) {
      files.set(name, {
        bytes: readFileSync(join(directory, digest, name)),
        contentType: contentTypes.get(extname(name)) ?? "application/octet-stream"
      })
    }

    if (!files.has("index.html") || !files.has("holder.js")) {
      throw new Error(`the holder build ${digest} has no page or no script`)
    }

    return new HolderAssets(digest, files)
  }

  file(digest: string, name: string): HolderAsset | undefined {
    return digest === this.digest ? this.files.get(name) : undefined
  }
}

export default HolderAssets
