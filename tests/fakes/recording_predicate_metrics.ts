import type { PredicateMetricsPort } from "../../src/application/ports/predicate_metrics.port.ts"
import type { PredicateChange } from "../../src/types/predicate_change.type.ts"
import type { PredicateChangeOutcome } from "../../src/types/predicate_change_outcome.type.ts"

class RecordingPredicateMetrics implements PredicateMetricsPort {
  readonly changes: string[] = []
  drift: number | undefined

  changed(change: PredicateChange, outcome: PredicateChangeOutcome): void {
    this.changes.push(`${change} ${outcome}`)
  }

  drifted(count: number): void {
    this.drift = count
  }
}

export default RecordingPredicateMetrics
