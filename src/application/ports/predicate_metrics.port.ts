import type { PredicateChange } from "../../types/predicate_change.type.ts"
import type { PredicateChangeOutcome } from "../../types/predicate_change_outcome.type.ts"

interface PredicateMetricsPort {
  changed(change: PredicateChange, outcome: PredicateChangeOutcome): void
  drifted(count: number): void
}

export type { PredicateMetricsPort }
