import type { HolderPrivateState } from "../../src/types/holder_private_state.type.ts"
import type { DecodedRegistrySnapshot } from "./decoded_registry_snapshot.type.ts"

type HolderPresentation = {
  snapshot: DecodedRegistrySnapshot
  holder: HolderPrivateState
  challenge: Uint8Array
  predicateId: Uint8Array
}

export type { HolderPresentation }
