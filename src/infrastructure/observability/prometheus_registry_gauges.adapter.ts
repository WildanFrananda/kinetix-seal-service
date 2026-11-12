import { Counter, Gauge, type Registry } from "prom-client"

import type { RegistryGaugesPort } from "../../application/ports/registry_gauges.port.ts"
import type { RegistryDeployOutcome } from "../../types/registry_deploy_outcome.type.ts"
import type { RegistryKind } from "../../types/registry_kind.type.ts"

const kinds: readonly RegistryKind[] = ["credential", "report"]
const outcomes: readonly RegistryDeployOutcome[] = ["succeeded", "failed"]

class PrometheusRegistryGauges {
  private readonly generation: Gauge<"registry">
  private readonly deploys: Counter<"registry" | "outcome">

  constructor(registry: Registry) {
    this.generation = new Gauge({
      name: "kinetix_seal_registry_generation",
      help: "The generation in use of each of seal's registries, 0 before the first is deployed",
      labelNames: ["registry"],
      registers: [registry]
    })

    this.deploys = new Counter({
      name: "kinetix_seal_registry_deploys_total",
      help: "Registry deployments, by registry and outcome",
      labelNames: ["registry", "outcome"],
      registers: [registry]
    })

    for (const kind of kinds) {
      this.generation.set({ registry: kind }, 0)

      for (const outcome of outcomes) {
        this.deploys.inc({ registry: kind, outcome }, 0)
      }
    }
  }

  of(kind: RegistryKind): RegistryGaugesPort {
    const generation = this.generation
    const deploys = this.deploys

    return {
      activeGeneration(value: number): void {
        generation.set({ registry: kind }, value)
      },
      deployed(outcome: RegistryDeployOutcome): void {
        deploys.inc({ registry: kind, outcome })
      }
    }
  }
}

export default PrometheusRegistryGauges
