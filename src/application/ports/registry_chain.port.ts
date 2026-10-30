import type { AnchorObservation } from "../../types/anchor_observation.type.ts"
import type { PreparedDeploy } from "../../types/prepared_deploy.type.ts"
import type { RegistryGeneration } from "../../types/registry_generation.type.ts"

interface RegistryChainPort {
  prepareDeploy(generation: number): Promise<PreparedDeploy>
  observeAnchor(generation: RegistryGeneration): Promise<AnchorObservation>
}

export type { RegistryChainPort }
