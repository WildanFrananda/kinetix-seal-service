import { Counter, Gauge, type Registry } from "prom-client"

import type { PredicateMetricsPort } from "../../application/ports/predicate_metrics.port.ts"
import type { PredicateChange } from "../../types/predicate_change.type.ts"
import type { PredicateChangeOutcome } from "../../types/predicate_change_outcome.type.ts"

const changes: readonly PredicateChange[] = ["approve", "withdraw"]
const outcomes: readonly PredicateChangeOutcome[] = ["done", "failed"]

class PrometheusPredicateMetrics implements PredicateMetricsPort {
  private readonly changes: Counter<"change" | "outcome">
  private readonly drift: Gauge

  constructor(registry: Registry) {
    this.changes = new Counter({
      name: "kinetix_seal_predicate_changes_total",
      help: "Predicate approvals and withdrawals sent to the active registry, by outcome",
      labelNames: ["change", "outcome"],
      registers: [registry]
    })

    this.drift = new Gauge({
      name: "kinetix_seal_predicate_drift",
      help: "Predicates the active registry still lacks or still holds against the approved set, at the last reconcile",
      registers: [registry]
    })

    for (const change of changes) {
      for (const outcome of outcomes) {
        this.changes.inc({ change, outcome }, 0)
      }
    }
  }

  changed(change: PredicateChange, outcome: PredicateChangeOutcome): void {
    this.changes.inc({ change, outcome })
  }

  drifted(count: number): void {
    this.drift.set(count)
  }
}

export default PrometheusPredicateMetrics
