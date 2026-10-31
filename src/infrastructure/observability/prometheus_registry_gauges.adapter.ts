import { Counter, Gauge, type Registry } from "prom-client"

import type { RegistryGaugesPort } from "../../application/ports/registry_gauges.port.ts"
import type { RegistryDeployOutcome } from "../../types/registry_deploy_outcome.type.ts"

const outcomes: readonly RegistryDeployOutcome[] = ["succeeded", "failed"]

class PrometheusRegistryGauges implements RegistryGaugesPort {
  private readonly generation: Gauge
  private readonly deploys: Counter<"outcome">

  constructor(registry: Registry) {
    this.generation = new Gauge({
      name: "kinetix_seal_registry_generation",
      help: "The credential registry generation in use, 0 before the first is deployed",
      registers: [registry]
    })
    this.deploys = new Counter({
      name: "kinetix_seal_registry_deploys_total",
      help: "Credential registry deployments, by outcome",
      labelNames: ["outcome"],
      registers: [registry]
    })

    for (const outcome of outcomes) {
      this.deploys.inc({ outcome }, 0)
    }
  }

  activeGeneration(generation: number): void {
    this.generation.set(generation)
  }

  deployed(outcome: RegistryDeployOutcome): void {
    this.deploys.inc({ outcome })
  }
}

export default PrometheusRegistryGauges
