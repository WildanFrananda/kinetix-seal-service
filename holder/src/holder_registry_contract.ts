import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js"

import { Contract } from "#contracts/credential_registry/contract/index.js"
import { credentialRegistryWitnesses } from "../../src/infrastructure/midnight/credential_registry_witnesses.ts"
import type { RegistryContract } from "../../src/types/registry_contract.type.ts"

function compileHolderRegistry() {
  return CompiledContract.make<RegistryContract>("credential_registry", Contract).pipe(
    CompiledContract.withWitnesses(credentialRegistryWitnesses),
    CompiledContract.withCompiledFileAssets("credential_registry")
  )
}

export { compileHolderRegistry }
