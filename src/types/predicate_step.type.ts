import type { PlacedPredicate } from "./placed_predicate.type.ts"
import type { PredicateChange } from "./predicate_change.type.ts"

type PredicateStep = {
  change: PredicateChange
  placement: PlacedPredicate
}

export type { PredicateStep }
