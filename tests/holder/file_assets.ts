import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { credentialRegistryDirectory } from "../../src/infrastructure/midnight/credential_registry_contract.ts"

const paramsDirectory = process.env.MIDNIGHT_PP

if (paramsDirectory === undefined || paramsDirectory === "") {
  throw new Error("MIDNIGHT_PP is required: the holder's proof needs the public parameters")
}

async function fileAsset(name: string): Promise<Uint8Array> {
  if (name.startsWith("bls_midnight_2p")) {
    return readFile(join(paramsDirectory ?? "", name))
  }

  const directory = name.endsWith(".bzkir") ? "zkir" : "keys"

  return readFile(join(credentialRegistryDirectory, directory, name))
}

export { fileAsset }
