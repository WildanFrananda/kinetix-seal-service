import type { RegistryGaugesPort } from "../../src/application/ports/registry_gauges.port.ts"
import type { RegistryDeployOutcome } from "../../src/types/registry_deploy_outcome.type.ts"

class RecordingRegistryGauges implements RegistryGaugesPort {
  generation = 0
  readonly deploys: RegistryDeployOutcome[] = []

  activeGeneration(generation: number): void {
    this.generation = generation
  }

  deployed(outcome: RegistryDeployOutcome): void {
    this.deploys.push(outcome)
  }
}

export default RecordingRegistryGauges
