import { Counter, type Registry } from "prom-client"

import type { PresentationMetricsPort } from "../../application/ports/presentation_metrics.port.ts"
import type { RelayOutcomeKind } from "../../types/relay_outcome_kind.type.ts"

const outcomes: readonly RelayOutcomeKind[] = ["relayed", "not_a_presentation", "no_registry", "sponsor_unavailable"]

class PrometheusPresentationMetrics implements PresentationMetricsPort {
  private readonly relays: Counter<"outcome">

  constructor(registry: Registry) {
    this.relays = new Counter({
      name: "kinetix_seal_presentations_relayed_total",
      help: "Presentations a verifier relayed to the sponsor, by outcome",
      labelNames: ["outcome"],
      registers: [registry]
    })

    for (const outcome of outcomes) {
      this.relays.inc({ outcome }, 0)
    }
  }

  relayed(outcome: RelayOutcomeKind): void {
    this.relays.inc({ outcome })
  }
}

export default PrometheusPresentationMetrics
