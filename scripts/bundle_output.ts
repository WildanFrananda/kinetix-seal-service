import { createHash } from "node:crypto"
import { readdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"

async function digestOf(directory: string): Promise<string> {
  const hash = createHash("sha256")

  for (const name of (await readdir(directory)).sort()) {
    hash.update(name)
    hash.update("\0")
    hash.update(await readFile(join(directory, name)))
  }

  return hash.digest("hex")
}

async function publishBuild(staging: string, outRoot: string): Promise<string> {
  const digest = await digestOf(staging)

  await rename(staging, join(outRoot, digest))
  await writeFile(join(outRoot, "current.json"), `${JSON.stringify({ digest })}\n`)

  return digest
}

export { publishBuild }
