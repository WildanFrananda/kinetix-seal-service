import type { RegistryStateBytes } from "./registry_state_bytes.type.ts"

type RegistrySnapshot = {
  generation: number
  networkId: string
  contractAddress: string
  state: RegistryStateBytes
  readAt: Date
}

export type { RegistrySnapshot }
