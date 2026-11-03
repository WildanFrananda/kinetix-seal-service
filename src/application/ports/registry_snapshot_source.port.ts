import type { RegistryStateBytes } from "../../types/registry_state_bytes.type.ts"

interface RegistrySnapshotSourcePort {
  stateOf(contractAddress: string): Promise<RegistryStateBytes>
}

export type { RegistrySnapshotSourcePort }
