import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js"

import { Contract } from "#contracts/credential_registry/contract/index.js"
import type { CredentialRegistryPrivateState } from "../../types/credential_registry_private_state.type.ts"
import { credentialRegistryWitnesses } from "./credential_registry_witnesses.ts"

const credentialRegistryDirectory = dirname(
  dirname(fileURLToPath(import.meta.resolve("#contracts/credential_registry/compiler/contract-info.json")))
)

function compileCredentialRegistry() {
  return CompiledContract.make<Contract<CredentialRegistryPrivateState>>("credential_registry", Contract).pipe(
    CompiledContract.withWitnesses(credentialRegistryWitnesses),
    CompiledContract.withCompiledFileAssets(credentialRegistryDirectory)
  )
}

export { compileCredentialRegistry, credentialRegistryDirectory }
