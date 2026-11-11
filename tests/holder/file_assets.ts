import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { credentialRegistryDirectory } from "../../src/infrastructure/midnight/credential_registry_contract.ts"

const paramsDirectory = process.env.MIDNIGHT_PP

if (paramsDirectory === undefined || paramsDirectory === "") {
  throw new Error("MIDNIGHT_PP is required: the holder's proof needs the public parameters")
}

function directoryOf(name: string): string {
  if (name.endsWith(".bzkir")) {
    return "zkir"
  }

  if (name.endsWith(".json")) {
    return "compiler"
  }

  return "keys"
}

async function fileAsset(name: string): Promise<Uint8Array> {
  if (name.startsWith("bls_midnight_2p")) {
    return readFile(join(paramsDirectory ?? "", name))
  }

  return readFile(join(credentialRegistryDirectory, directoryOf(name), name))
}

export { fileAsset }
