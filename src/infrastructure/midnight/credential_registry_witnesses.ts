import type { MerkleTreePath, WitnessContext } from "@midnight-ntwrk/compact-runtime"

import type { Credential, Ledger, Witnesses } from "#contracts/credential_registry/contract/index.js"
import type { CredentialRegistryPrivateState } from "../../types/credential_registry_private_state.type.ts"

type Context = WitnessContext<Ledger, CredentialRegistryPrivateState>

function issuerSecret({ privateState }: Context): [CredentialRegistryPrivateState, Uint8Array] {
  if (privateState.role !== "issuer") {
    throw new Error("only the issuer knows the issuer secret")
  }

  return [privateState, privateState.issuerSecret]
}

function holderSecret({ privateState }: Context): [CredentialRegistryPrivateState, Uint8Array] {
  if (privateState.role !== "holder") {
    throw new Error("only a holder knows a holder secret")
  }

  return [privateState, privateState.holderSecret]
}

function heldCredential({ privateState }: Context): [CredentialRegistryPrivateState, Credential] {
  if (privateState.role !== "holder") {
    throw new Error("only a holder holds a credential")
  }

  return [privateState, privateState.credential]
}

function credentialPath(
  { privateState, ledger }: Context,
  leaf: Uint8Array
): [CredentialRegistryPrivateState, MerkleTreePath<Uint8Array>] {
  if (privateState.role !== "holder") {
    throw new Error("only a holder has a credential path")
  }

  if (privateState.leafIndex >= ledger.issued.firstFree()) {
    throw new Error("the credential is not in the registry")
  }

  return [privateState, ledger.issued.pathForLeaf(privateState.leafIndex, leaf)]
}

const credentialRegistryWitnesses: Witnesses<CredentialRegistryPrivateState> = {
  issuerSecret,
  holderSecret,
  heldCredential,
  credentialPath
}

export { credentialRegistryWitnesses }
