import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

async function contractBuildDigest(contractDirectory: string): Promise<string> {
  const keys = join(contractDirectory, "keys")
  const verifiers = (await readdir(keys)).filter((name) => name.endsWith(".verifier")).sort()

  if (verifiers.length === 0) {
    throw new Error(`${keys} holds no verifier key: compile the contract with its keys`)
  }

  const digest = createHash("sha256")

  for (const name of verifiers) {
    digest
      .update(name)
      .update("\0")
      .update(await readFile(join(keys, name)))
  }

  return digest.digest("hex")
}

export { contractBuildDigest }
