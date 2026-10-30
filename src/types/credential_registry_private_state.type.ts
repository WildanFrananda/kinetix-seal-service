import type { HolderPrivateState } from "./holder_private_state.type.ts"
import type { IssuerPrivateState } from "./issuer_private_state.type.ts"

type CredentialRegistryPrivateState = IssuerPrivateState | HolderPrivateState

export type { CredentialRegistryPrivateState }
