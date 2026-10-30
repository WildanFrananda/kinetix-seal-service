import type { RegistryGenerationStatus } from "./registry_generation_status.type.ts"

type RegistryGeneration = {
  generation: number
  contractAddress: string
  networkId: string
  buildDigest: string
  status: RegistryGenerationStatus
  deployTxId: string | undefined
  anchorHeight: number | undefined
  anchorHash: string | undefined
}

export type { RegistryGeneration }
