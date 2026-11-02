import type { Contract } from "#contracts/credential_registry/contract/index.js"
import type { CredentialRegistryPrivateState } from "./credential_registry_private_state.type.ts"

type RegistryContract = Contract<CredentialRegistryPrivateState>

export type { RegistryContract }
