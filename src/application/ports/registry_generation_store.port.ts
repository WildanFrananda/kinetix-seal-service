import type { DeployReceipt } from "../../types/deploy_receipt.type.ts"
import type { RegistryGeneration } from "../../types/registry_generation.type.ts"
import type { RegistryRetirement } from "../../types/registry_retirement.type.ts"

interface RegistryGenerationStorePort {
  unretired(): Promise<RegistryGeneration[]>
  highestGeneration(): Promise<number>
  recordDeploying(generation: RegistryGeneration): Promise<void>
  activate(generation: number, receipt: DeployReceipt): Promise<void>
  retire(retirement: RegistryRetirement): Promise<void>
}

export type { RegistryGenerationStorePort }
