import type { RegistryDeployOutcome } from "../../types/registry_deploy_outcome.type.ts"

interface RegistryGaugesPort {
  activeGeneration(generation: number): void
  deployed(outcome: RegistryDeployOutcome): void
}

export type { RegistryGaugesPort }
